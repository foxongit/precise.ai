from fastapi import APIRouter, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Optional
import os
import uuid
from datetime import datetime
import shutil

from src.models.schemas import DocumentStatus
from src.services.document_service import document_service
from src.services.session_service import session_service
from src.core.config import settings
from src.services.rag_pipeline.pipeline import rag_pipeline

router = APIRouter(prefix="/documents", tags=["documents"])

def process_document_background(file_path: str, user_id: str, doc_id: str, filename: str, upload_date: str, session_id: str):
    """Background task to process the document"""
    try:
        # Update status to processing
        document_service.update_document_status(doc_id, "processing", "Document is being processed...")
        
        # Upload file to Supabase Storage
        storage_path = f"{user_id}/{session_id}/{doc_id}_{filename}"
        
        print(f"Uploading to Supabase Storage: {storage_path}")
        
        # Upload to Supabase Storage
        upload_successful = document_service.upload_file_to_storage(file_path, storage_path)
        
        if upload_successful:
            # Check if RAG pipeline is initialized
            if rag_pipeline is None:
                document_service.update_document_status(doc_id, "failed", "RAG pipeline not initialized")
                document_service.delete_from_storage(storage_path)
                return
            
            # Add to RAG system
            result = rag_pipeline.add_document(
                pdf_path=file_path,
                user_id=user_id,
                doc_id=doc_id,
                filename=filename,
                upload_date=upload_date
            )
            
            if result["status"] == "success":
                # Save document info to Supabase database
                doc_data = {
                    "id": doc_id,
                    "filename": filename,
                    "storage_path": storage_path,
                    "upload_date": upload_date
                }
                
                if document_service.save_document_to_supabase(doc_data):
                    # Link document to session via document_sessions table
                    print(f"Linking document {doc_id} to session {session_id}")
                    session_service.link_document_to_session(doc_id, session_id)
                    document_service.update_document_status(
                        doc_id, 
                        "completed", 
                        "Document processed successfully", 
                        result["chunks_added"]
                    )
                else:
                    raise Exception("Failed to save document metadata to database")
            else:
                document_service.update_document_status(doc_id, "failed", result["message"])
                # Clean up Supabase storage if processing failed
                document_service.delete_from_storage(storage_path)
        else:
            raise Exception("Failed to upload file to Supabase Storage")
            
        # Clean up local file after successful upload
        document_service.cleanup_local_file(file_path)
                
    except Exception as e:
        document_service.update_document_status(doc_id, "failed", f"Error processing document: {str(e)}")
        # Clean up local file on error
        document_service.cleanup_local_file(file_path)
        # Clean up Supabase storage on error
        document_service.delete_from_storage(storage_path)

def process_document_background_test(file_path: str, user_id: str, doc_id: str, filename: str, upload_date: str, session_id: str):
    """Background task to process the document without Supabase Storage"""
    try:
        # Update status to processing
        document_service.update_document_status(doc_id, "processing", "Document is being processed...")
        
        print(f"Processing document: {filename}")
        
        # Check if RAG pipeline is initialized
        if rag_pipeline is None:
            document_service.update_document_status(doc_id, "failed", "RAG pipeline not initialized")
            document_service.cleanup_local_file(file_path)
            return
        
        # Add to RAG system directly
        result = rag_pipeline.add_document(
            pdf_path=file_path,
            user_id=user_id,
            doc_id=doc_id,
            filename=filename,
            upload_date=upload_date
        )
        
        if result["status"] == "success":
            # Save document info to Supabase database (without storage path)
            doc_data = {
                "id": doc_id,
                "session_id": session_id,
                "filename": filename,
                "storage_path": f"local/{file_path}",  # Local path for testing
                "upload_date": upload_date
            }
            
            print(f"Saving document metadata: {doc_data}")
            if document_service.save_document_to_supabase(doc_data):
                # Link document to session via document_sessions table
                print(f"Linking document {doc_id} to session {session_id}")
                session_service.link_document_to_session(doc_id, session_id)
                document_service.update_document_status(
                    doc_id, 
                    "completed", 
                    "Document processed successfully", 
                    result["chunks_added"]
                )
                print(f"Document processed successfully: {doc_id}")
            else:
                print(f"Database insert failed")
                raise Exception("Failed to save document metadata to database")
        else:
            document_service.update_document_status(doc_id, "failed", result["message"])
                
    except Exception as e:
        print(f"Error processing document: {str(e)}")
        document_service.update_document_status(doc_id, "failed", f"Error processing document: {str(e)}")
        # Clean up local file on error
        document_service.cleanup_local_file(file_path)

@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form(...),
    session_id: str = Form(...),
    doc_id: Optional[str] = Form(None)
):
    """Upload and process a PDF document asynchronously"""
    
    # Print statement to show when document is uploaded
    print(f"📄 Document upload started - User: {user_id}, Session: {session_id}, File: {file.filename}")
    
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Verify session exists and belongs to user
    if not session_service.verify_session(session_id, user_id):
        raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
    
    # Generate doc_id if not provided
    if not doc_id:
        doc_id = str(uuid.uuid4())
    
    # Save uploaded file temporarily
    upload_date = datetime.now().isoformat()
    file_path = os.path.join(settings.UPLOAD_DIR, f"{user_id}_{session_id}_{doc_id}_{file.filename}")
    
    print(f"💾 Saving file to: {file_path}")
    
    try:
        # Save file first
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Initialize status
        document_service.update_document_status(doc_id, "processing", "Document uploaded, processing started...")
        
        # Add background task for processing
        background_tasks.add_task(
            process_document_background,
            file_path=file_path,
            user_id=user_id,
            doc_id=doc_id,
            filename=file.filename,
            upload_date=upload_date,
            session_id=session_id
        )
        
        # Return immediately with processing status
        return JSONResponse(
            status_code=202,  # 202 Accepted - processing in background
            content={
                "message": "Document uploaded successfully and is being processed",
                "doc_id": doc_id,
                "session_id": session_id,
                "filename": file.filename,
                "status": "processing",
                "status_check_url": f"/documents/{user_id}/{doc_id}/status"
            }
        )
            
    except Exception as e:
        document_service.cleanup_local_file(file_path)
        raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")

@router.post("/upload-test")
async def upload_document_test(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form(...),
    session_id: str = Form(...),
    doc_id: Optional[str] = Form(None)
):
    """Upload and process a PDF document without Supabase Storage (for testing)"""
    
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Verify session exists and belongs to user
    if not session_service.verify_session(session_id, user_id):
        raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
    
    # Generate doc_id if not provided
    if not doc_id:
        doc_id = str(uuid.uuid4())
    
    # Save uploaded file temporarily
    upload_date = datetime.now().isoformat()
    file_path = os.path.join(settings.UPLOAD_DIR, f"{user_id}_{session_id}_{doc_id}_{file.filename}")
    
    try:
        # Save file first
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Initialize status
        document_service.update_document_status(doc_id, "processing", "Document uploaded, processing started...")
        
        # Add background task for processing (without Supabase Storage)
        background_tasks.add_task(
            process_document_background_test,
            file_path=file_path,
            user_id=user_id,
            doc_id=doc_id,
            filename=file.filename,
            upload_date=upload_date,
            session_id=session_id
        )
        
        # Return immediately with processing status
        return JSONResponse(
            status_code=202,  # 202 Accepted - processing in background
            content={
                "message": "Document uploaded successfully and is being processed (test mode)",
                "doc_id": doc_id,
                "session_id": session_id,
                "filename": file.filename,
                "status": "processing",
                "status_check_url": f"/documents/{user_id}/{doc_id}/status"
            }
        )
            
    except Exception as e:
        # Clean up file on error
        document_service.cleanup_local_file(file_path)
        raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")

@router.get("/{user_id}")
async def get_user_documents(user_id: str, session_id: Optional[str] = None):
    """Get all documents for a user or specific session"""
    
    documents = document_service.get_user_documents(user_id, session_id)
    
    if documents is None:
        raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
    
    return {
        "user_id": user_id,
        "session_id": session_id,
        "documents": documents,
        "total_documents": len(documents)
    }

@router.delete("/{user_id}/{doc_id}")
async def delete_document(user_id: str, doc_id: str):
    """Delete a document"""
    
    try:
        result = rag_pipeline.delete_document(doc_id, user_id)
        
        if result["status"] == "success":
            # Also delete the physical file
            file_pattern = f"{user_id}_{doc_id}_"
            for filename in os.listdir(settings.UPLOAD_DIR):
                if filename.startswith(file_pattern):
                    file_path = os.path.join(settings.UPLOAD_DIR, filename)
                    document_service.cleanup_local_file(file_path)
            
            return JSONResponse(
                status_code=200,
                content=result
            )
        else:
            raise HTTPException(status_code=404, detail=result["message"])
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting document: {str(e)}")

@router.get("/{user_id}/{doc_id}/status")
async def get_document_status(user_id: str, doc_id: str):
    """Get the processing status of a document"""
    
    status_info = document_service.get_document_status(doc_id)
    
    if status_info is None:
        raise HTTPException(status_code=404, detail="Document not found or status not available")
    
    return {
        "doc_id": doc_id,
        "user_id": user_id,
        "status": status_info["status"],
        "message": status_info["message"],
        "chunks_added": status_info.get("chunks_added", 0),
        "timestamp": status_info["timestamp"],
        "is_ready": status_info["status"] == "completed"
    }

@router.get("/debug/{user_id}/{doc_id}/chunks")
async def get_document_chunks(user_id: str, doc_id: str, query: str = "test", k: int = 4):
    """Debug endpoint to see raw chunks from a document"""
    
    try:
        # Get retriever for the document
        retriever = rag_pipeline.document_manager.get_retriever_for_docs([doc_id], user_id, k)
        
        if retriever is None:
            raise HTTPException(status_code=404, detail="Document not found or not processed")
        
        # Get chunks
        results = retriever.get_relevant_documents(query)
        
        chunks_info = []
        for i, doc in enumerate(results):
            chunks_info.append({
                "chunk_number": i + 1,
                "content": doc.page_content,
                "metadata": doc.metadata
            })
        
        return {
            "doc_id": doc_id,
            "user_id": user_id,
            "query": query,
            "total_chunks": len(chunks_info),
            "chunks": chunks_info
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving chunks: {str(e)}")
    
    except Exception as e:
        print(f"Error checking document in database: {str(e)}")
    
    # Document not found
    raise HTTPException(status_code=404, detail="Document not found or status not available")

@router.get("/{user_id}/{doc_id}/url")
async def get_document_url(user_id: str, doc_id: str):
    """Generate a signed URL for document viewing"""
    try:
        # Get document from database
        document = document_service.get_document(doc_id, user_id)
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found or doesn't belong to user")
        
        storage_path = document.get('storage_path')
        if not storage_path:
            raise HTTPException(status_code=404, detail="Document storage path not found")
        
        # Generate signed URL from Supabase Storage
        signed_url = document_service.generate_signed_url(storage_path)
        
        if signed_url:
            return {
                "doc_id": doc_id,
                "user_id": user_id,
                "url": signed_url,
                "expires_in": 3600,  # 1 hour
                "filename": document.get('filename', 'document.pdf')
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to generate document URL")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating document URL: {str(e)}")

@router.get("/{user_id}/urls")
async def get_all_document_urls(user_id: str, session_id: Optional[str] = None):
    """Generate signed URLs for all user documents"""
    try:
        # Get all documents for user/session
        documents = document_service.get_user_documents(user_id, session_id)
        
        if documents is None:
            raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
        
        urls = {}
        for document in documents:
            doc_id = document.get('id')
            storage_path = document.get('storage_path')
            
            if doc_id and storage_path:
                signed_url = document_service.generate_signed_url(storage_path)
                if signed_url:
                    urls[doc_id] = {
                        "url": signed_url,
                        "filename": document.get('filename', 'document.pdf'),
                        "expires_in": 3600
                    }
        
        return {
            "user_id": user_id,
            "session_id": session_id,
            "urls": urls,
            "total_urls": len(urls)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating document URLs: {str(e)}")
