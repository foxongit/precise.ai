# from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks
# from fastapi.responses import JSONResponse
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from typing import List, Optional
# import os
# import uuid
# from datetime import datetime
# import shutil
# from supabase import create_client, Client
# from dotenv import load_dotenv

# from src.services.rag_pipeline.pipeline import rag_pipeline

# # Load environment variables
# load_dotenv()

# # Supabase configuration
# SUPABASE_URL = os.getenv("SUPABASE_URL")
# SUPABASE_KEY = os.getenv("SUPABASE_KEY")
# SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "documents")

# if not SUPABASE_URL or not SUPABASE_KEY:
#     raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

# supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# app = FastAPI(title="RAG Document Processing API", version="1.0.0")

# # Add CORS middleware
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:3000", 
#         "http://127.0.0.1:3000",
#         "http://localhost:5173",  # Vite frontend
#         "http://127.0.0.1:5173"
#     ],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Import API routers
# from src.api import documents, sessions, query

# # Include API routers
# app.include_router(documents.router)
# app.include_router(sessions.router)
# app.include_router(query.router)

# # Pydantic models for request/response
# class QueryRequest(BaseModel):
#     query: str
#     user_id: str
#     session_id: str
#     doc_ids: List[str]
#     k: Optional[int] = 4

# class CreateSessionRequest(BaseModel):
#     user_id: str

# class SessionResponse(BaseModel):
#     session_id: str
#     user_id: str
#     created_at: str

# class DocumentInfo(BaseModel):
#     doc_id: str
#     filename: str
#     upload_date: str
#     total_chunks: int

# class DocumentStatus(BaseModel):
#     doc_id: str
#     user_id: str
#     status: str  # "processing", "completed", "failed"
#     message: str
#     chunks_added: int
#     timestamp: str
#     is_ready: bool

# class QueryResponse(BaseModel):
#     status: str
#     original_query: str
#     enriched_query: str
#     retrieved_chunks: str
#     masked_chunks: str
#     response: str
#     retrieved_metadata: List[dict]
#     processed_docs: List[str]
#     message: Optional[str] = None

# # Ensure uploads directory exists
# UPLOAD_DIR = "uploads"
# os.makedirs(UPLOAD_DIR, exist_ok=True)

# # In-memory document status tracking
# # In production, this should be stored in a database like Supabase
# document_status = {}

# def update_document_status(doc_id: str, status: str, message: str = "", chunks_added: int = 0):
#     """Update document processing status"""
#     document_status[doc_id] = {
#         "status": status,  # "processing", "completed", "failed"
#         "message": message,
#         "chunks_added": chunks_added,
#         "timestamp": datetime.now().isoformat()
#     }

# def process_document_background(file_path: str, user_id: str, doc_id: str, filename: str, upload_date: str, session_id: str):
#     """Background task to process the document"""
#     try:
#         # Update status to processing
#         update_document_status(doc_id, "processing", "Document is being processed...")
        
#         # Upload file to Supabase Storage
#         # storage_path = f"{user_id}/{session_id}/{doc_id}_{filename}"
        
#         with open(file_path, 'rb') as file:
#             file_data = file.read()
        
#         print(f"Uploading to Supabase Storage: {storage_path}")
        
#         # Upload to Supabase Storage
#         storage_response = supabase.storage.from_(SUPABASE_BUCKET).upload(
#             path=storage_path,
#             file=file_data,
#             file_options={"content-type": "application/pdf"}
#         )
        
#         print(f"Storage response: {storage_response}")
#         print(f"Storage response type: {type(storage_response)}")
        
#         # Check if upload was successful (response structure may vary)
#         upload_successful = False
#         if hasattr(storage_response, 'data') and storage_response.data:
#             upload_successful = True
#         elif hasattr(storage_response, 'path') or (isinstance(storage_response, dict) and 'path' in storage_response):
#             upload_successful = True
#         elif not hasattr(storage_response, 'error'):
#             upload_successful = True
        
#         if upload_successful:
#             # Add to RAG system
#             result = rag_pipeline.add_document(
#                 pdf_path=file_path,
#                 user_id=user_id,
#                 doc_id=doc_id,
#                 filename=filename,
#                 upload_date=upload_date
#             )
            
#             if result["status"] == "success":
#                 # Save document info to Supabase database
#                 doc_data = {
#                     "id": doc_id,
#                     "session_id": session_id,
#                     "filename": filename,
#                     "storage_path": storage_path,
#                     "upload_date": upload_date
#                 }
                
#                 db_response = supabase.table('documents').insert(doc_data).execute()
                
#                 if db_response.data:
#                     update_document_status(
#                         doc_id, 
#                         "completed", 
#                         "Document processed successfully", 
#                         result["chunks_added"]
#                     )
#                 else:
#                     raise Exception("Failed to save document metadata to database")
#             else:
#                 update_document_status(doc_id, "failed", result["message"])
#                 # Clean up Supabase storage if processing failed
#                 supabase.storage.from_(SUPABASE_BUCKET).remove([storage_path])
#         else:
#             error_msg = "Failed to upload file to Supabase Storage"
#             if hasattr(storage_response, 'error'):
#                 error_msg += f": {storage_response.error}"
#             raise Exception(error_msg)
            
#         # Clean up local file after successful upload
#         if os.path.exists(file_path):
#             os.remove(file_path)
                
#     except Exception as e:
#         update_document_status(doc_id, "failed", f"Error processing document: {str(e)}")
#         # Clean up local file on error
#         if os.path.exists(file_path):
#             os.remove(file_path)
#         # Clean up Supabase storage on error
#         try:
#             supabase.storage.from_(SUPABASE_BUCKET).remove([storage_path])
#         except:
#             pass

# @app.get("/")
# async def root():
#     return {"message": "RAG Document Processing API is running"}

# @app.post("/upload-document")
# async def upload_document(
#     background_tasks: BackgroundTasks,
#     file: UploadFile = File(...),
#     user_id: str = Form(...),
#     session_id: str = Form(...),
#     doc_id: Optional[str] = Form(None)
# ):
#     """Upload and process a PDF document asynchronously"""
    
#     # Validate file type
#     if not file.filename.endswith('.pdf'):
#         raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
#     # Verify session exists and belongs to user
#     try:
#         session_check = supabase.table('sessions').select("*").eq('id', session_id).eq('user_id', user_id).execute()
#         if not session_check.data:
#             raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error verifying session: {str(e)}")
    
#     # Generate doc_id if not provided
#     if not doc_id:
#         doc_id = str(uuid.uuid4())
    
#     # Save uploaded file temporarily
#     upload_date = datetime.now().isoformat()
#     file_path = os.path.join(UPLOAD_DIR, f"{user_id}_{session_id}_{doc_id}_{file.filename}")
    
#     try:
#         # Save file first
#         with open(file_path, "wb") as buffer:
#             shutil.copyfileobj(file.file, buffer)
        
#         # Initialize status
#         update_document_status(doc_id, "processing", "Document uploaded, processing started...")
        
#         # Add background task for processing
#         background_tasks.add_task(
#             process_document_background,
#             file_path=file_path,
#             user_id=user_id,
#             doc_id=doc_id,
#             filename=file.filename,
#             upload_date=upload_date,
#             session_id=session_id
#         )
        
#         # Return immediately with processing status
#         return JSONResponse(
#             status_code=202,  # 202 Accepted - processing in background
#             content={
#                 "message": "Document uploaded successfully and is being processed",
#                 "doc_id": doc_id,
#                 "session_id": session_id,
#                 "filename": file.filename,
#                 "status": "processing",
#                 "status_check_url": f"/documents/{user_id}/{doc_id}/status"
#             }
#         )
            
#     except Exception as e:
#         # Clean up file on error
#         if os.path.exists(file_path):
#             os.remove(file_path)
#         raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")

# @app.post("/upload-document-test")
# async def upload_document_test(
#     background_tasks: BackgroundTasks,
#     file: UploadFile = File(...),
#     user_id: str = Form(...),
#     session_id: str = Form(...),
#     doc_id: Optional[str] = Form(None)
# ):
#     """Upload and process a PDF document without Supabase Storage (for testing)"""
    
#     # Validate file type
#     if not file.filename.endswith('.pdf'):
#         raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
#     # Verify session exists and belongs to user
#     try:
#         session_check = supabase.table('sessions').select("*").eq('id', session_id).eq('user_id', user_id).execute()
#         if not session_check.data:
#             raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error verifying session: {str(e)}")
    
#     # Generate doc_id if not provided
#     if not doc_id:
#         doc_id = str(uuid.uuid4())
    
#     # Save uploaded file temporarily
#     upload_date = datetime.now().isoformat()
#     file_path = os.path.join(UPLOAD_DIR, f"{user_id}_{session_id}_{doc_id}_{file.filename}")
    
#     try:
#         # Save file first
#         with open(file_path, "wb") as buffer:
#             shutil.copyfileobj(file.file, buffer)
        
#         # Initialize status
#         update_document_status(doc_id, "processing", "Document uploaded, processing started...")
        
#         # Add background task for processing (without Supabase Storage)
#         background_tasks.add_task(
#             process_document_background_test,
#             file_path=file_path,
#             user_id=user_id,
#             doc_id=doc_id,
#             filename=file.filename,
#             upload_date=upload_date,
#             session_id=session_id
#         )
        
#         # Return immediately with processing status
#         return JSONResponse(
#             status_code=202,  # 202 Accepted - processing in background
#             content={
#                 "message": "Document uploaded successfully and is being processed (test mode)",
#                 "doc_id": doc_id,
#                 "session_id": session_id,
#                 "filename": file.filename,
#                 "status": "processing",
#                 "status_check_url": f"/documents/{user_id}/{doc_id}/status"
#             }
#         )
            
#     except Exception as e:
#         # Clean up file on error
#         if os.path.exists(file_path):
#             os.remove(file_path)
#         raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")

# def process_document_background_test(file_path: str, user_id: str, doc_id: str, filename: str, upload_date: str, session_id: str):
#     """Background task to process the document without Supabase Storage"""
#     try:
#         # Update status to processing
#         update_document_status(doc_id, "processing", "Document is being processed...")
        
#         print(f"Processing document: {filename}")
        
#         # Add to RAG system directly
#         result = rag_pipeline.add_document(
#             pdf_path=file_path,
#             user_id=user_id,
#             doc_id=doc_id,
#             filename=filename,
#             upload_date=upload_date
#         )
        
#         if result["status"] == "success":
#             # Save document info to Supabase database (without storage path)
#             doc_data = {
#                 "id": doc_id,
#                 "session_id": session_id,
#                 "filename": filename,
#                 "storage_path": f"local/{file_path}",  # Local path for testing
#                 "upload_date": upload_date
#             }
            
#             print(f"Saving document metadata: {doc_data}")
#             db_response = supabase.table('documents').insert(doc_data).execute()
            
#             if db_response.data:
#                 update_document_status(
#                     doc_id, 
#                     "completed", 
#                     "Document processed successfully", 
#                     result["chunks_added"]
#                 )
#                 print(f"Document processed successfully: {doc_id}")
#             else:
#                 print(f"Database insert failed: {db_response}")
#                 raise Exception("Failed to save document metadata to database")
#         else:
#             update_document_status(doc_id, "failed", result["message"])
                
#     except Exception as e:
#         print(f"Error processing document: {str(e)}")
#         update_document_status(doc_id, "failed", f"Error processing document: {str(e)}")
#         # Clean up local file on error
#         if os.path.exists(file_path):
#             os.remove(file_path)

# @app.get("/documents/{user_id}")
# async def get_user_documents(user_id: str, session_id: Optional[str] = None):
#     """Get all documents for a user or specific session"""
    
#     try:
#         if session_id:
#             # Get documents for specific session
#             response = supabase.table('documents').select("*").eq('session_id', session_id).execute()
#             # Also verify session belongs to user
#             session_check = supabase.table('sessions').select("*").eq('id', session_id).eq('user_id', user_id).execute()
#             if not session_check.data:
#                 raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
#         else:
#             # Get all documents for user across all sessions
#             # First get all user sessions
#             user_sessions = supabase.table('sessions').select("id").eq('user_id', user_id).execute()
#             session_ids = [session['id'] for session in user_sessions.data]
            
#             if session_ids:
#                 response = supabase.table('documents').select("*").in_('session_id', session_ids).execute()
#             else:
#                 response = supabase.table('documents').select("*").eq('session_id', 'none').execute()  # Empty result
        
#         return {
#             "user_id": user_id,
#             "session_id": session_id,
#             "documents": response.data,
#             "total_documents": len(response.data)
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error retrieving documents: {str(e)}")
        
# @app.delete("/documents/{user_id}/{doc_id}")
# async def delete_document(user_id: str, doc_id: str):
#     """Delete a document"""
    
#     try:
#         result = rag_pipeline.delete_document(doc_id, user_id)
        
#         if result["status"] == "success":
#             # Also delete the physical file
#             file_pattern = f"{user_id}_{doc_id}_"
#             for filename in os.listdir(UPLOAD_DIR):
#                 if filename.startswith(file_pattern):
#                     file_path = os.path.join(UPLOAD_DIR, filename)
#                     if os.path.exists(file_path):
#                         os.remove(file_path)
            
#             return JSONResponse(
#                 status_code=200,
#                 content=result
#             )
#         else:
#             raise HTTPException(status_code=404, detail=result["message"])
            
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error deleting document: {str(e)}")

# @app.post("/query")
# async def process_query(request: QueryRequest):
#     """Process a query against selected documents and save to chat logs"""
    
#     try:
#         # Verify session exists and belongs to user
#         session_check = supabase.table('sessions').select("*").eq('id', request.session_id).eq('user_id', request.user_id).execute()
#         if not session_check.data:
#             raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
        
#         # Check if all requested documents are ready
#         not_ready_docs = []
#         for doc_id in request.doc_ids:
#             if doc_id in document_status:
#                 status = document_status[doc_id]["status"]
#                 if status == "processing":
#                     not_ready_docs.append(f"{doc_id} (processing)")
#                 elif status == "failed":
#                     not_ready_docs.append(f"{doc_id} (failed)")
        
#         if not_ready_docs:
#             return JSONResponse(
#                 status_code=202,  # Accepted but not ready
#                 content={
#                     "status": "not_ready",
#                     "message": f"Some documents are not ready: {', '.join(not_ready_docs)}",
#                     "not_ready_docs": not_ready_docs,
#                     "suggestion": "Please wait for document processing to complete or check status endpoints"
#                 }
#             )
        
#         # Process the query through RAG pipeline
#         result = rag_pipeline.process_query(
#             query=request.query,
#             user_id=request.user_id,
#             doc_ids=request.doc_ids,
#             k=request.k
#         )
        
#         if result["status"] == "success":
#             # Save chat log to Supabase
#             chat_log_data = {
#                 "id": str(uuid.uuid4()),
#                 "session_id": request.session_id,
#                 "prompt": request.query,
#                 "response": result["response"],
#                 "created_at": datetime.now().isoformat()
#             }
            
#             # Insert chat log
#             chat_response = supabase.table('chat_logs').insert(chat_log_data).execute()
            
#             response_data = {
#                 "status": result["status"],
#                 "chat_log_id": chat_log_data["id"],
#                 "session_id": request.session_id,
#                 "original_query": result["original_query"],
#                 "enriched_query": result["enriched_query"],
#                 "retrieved_chunks": result["retrieved_chunks"],
#                 "masked_chunks": result["masked_chunks"],
#                 "response": result["response"],
#                 "retrieved_metadata": result["retrieved_metadata"],
#                 "processed_docs": result["processed_docs"]
#             }
            
#             if not chat_response.data:
#                 # If chat log saving failed, still return the result but with a warning
#                 response_data["warning"] = "Query processed successfully but failed to save chat log"
            
#             return JSONResponse(
#                 status_code=200,
#                 content=response_data
#             )
#         else:
#             raise HTTPException(status_code=500, detail=result["message"])
            
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")

# @app.post("/query-test")
# async def process_query_test(request: QueryRequest):
#     """Test query endpoint without session verification for debugging"""
    
#     try:
#         print(f"Test query endpoint received request: {request}")
        
#         # Check if all requested documents are ready
#         not_ready_docs = []
#         for doc_id in request.doc_ids:
#             if doc_id in document_status:
#                 status = document_status[doc_id]["status"]
#                 if status == "processing":
#                     not_ready_docs.append(f"{doc_id} (processing)")
#                 elif status == "failed":
#                     not_ready_docs.append(f"{doc_id} (failed)")
        
#         if not_ready_docs:
#             return JSONResponse(
#                 status_code=202,  # Accepted but not ready
#                 content={
#                     "status": "not_ready",
#                     "message": f"Some documents are not ready: {', '.join(not_ready_docs)}",
#                     "not_ready_docs": not_ready_docs,
#                     "suggestion": "Please wait for document processing to complete or check status endpoints"
#                 }
#             )
        
#         # Process the query through RAG pipeline
#         result = rag_pipeline.process_query(
#             query=request.query,
#             user_id=request.user_id,
#             doc_ids=request.doc_ids,
#             k=request.k
#         )
        
#         if result["status"] == "success":
#             response_data = {
#                 "status": result["status"],
#                 "original_query": result["original_query"],
#                 "enriched_query": result["enriched_query"],
#                 "retrieved_chunks": result["retrieved_chunks"],
#                 "masked_chunks": result["masked_chunks"],
#                 "response": result["response"],
#                 "retrieved_metadata": result["retrieved_metadata"],
#                 "processed_docs": result["processed_docs"],
#                 "test_mode": True
#             }
            
#             return JSONResponse(
#                 status_code=200,
#                 content=response_data
#             )
#         else:
#             raise HTTPException(status_code=500, detail=result["message"])
            
#     except Exception as e:
#         print(f"Test query endpoint error: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")

# @app.get("/health")
# async def health_check():
#     """Health check endpoint"""
#     return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# @app.get("/documents/{user_id}/{doc_id}/status")
# async def get_document_status(user_id: str, doc_id: str):
#     """Get the processing status of a document"""
    
#     # First check in-memory status
#     if doc_id in document_status:
#         status_info = document_status[doc_id]
        
#         return {
#             "doc_id": doc_id,
#             "user_id": user_id,
#             "status": status_info["status"],
#             "message": status_info["message"],
#             "chunks_added": status_info.get("chunks_added", 0),
#             "timestamp": status_info["timestamp"],
#             "is_ready": status_info["status"] == "completed"
#         }
    
#     # If not in memory, check if document exists in the database
#     try:
#         # Check if document exists in Supabase (without user_id filter)
#         doc_query = supabase.table('documents').select('*').eq('id', doc_id).execute()
        
#         if doc_query.data and len(doc_query.data) > 0:
#             # Document exists in database, assume it's completed
#             return {
#                 "doc_id": doc_id,
#                 "user_id": user_id,
#                 "status": "completed",
#                 "message": "Document processed successfully",
#                 "chunks_added": 0,  # We don't know how many chunks without the in-memory data
#                 "timestamp": datetime.now().isoformat(),
#                 "is_ready": True
#             }
#     except Exception as e:
#         print(f"Error checking document in database: {str(e)}")
    
#     # If we get here, the document was not found
#     raise HTTPException(status_code=404, detail="Document not found or status not available")

# @app.post("/sessions", response_model=SessionResponse)
# async def create_chat_session(request: CreateSessionRequest):
#     """Create a new chat session for a user"""
    
#     try:
#         session_id = str(uuid.uuid4())
#         session_data = {
#             "id": session_id,
#             "user_id": request.user_id,
#             "created_at": datetime.now().isoformat()
#         }
        
#         # Insert session into Supabase
#         response = supabase.table('sessions').insert(session_data).execute()
        
#         if response.data:
#             return SessionResponse(
#                 session_id=session_id,
#                 user_id=request.user_id,
#                 created_at=session_data["created_at"]
#             )
#         else:
#             raise HTTPException(status_code=500, detail="Failed to create session")
            
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error creating session: {str(e)}")

# @app.get("/sessions/{user_id}")
# async def get_user_sessions(user_id: str):
#     """Get all sessions for a user"""
    
#     try:
#         response = supabase.table('sessions').select("*").eq('user_id', user_id).order('created_at', desc=True).execute()
        
#         return {
#             "user_id": user_id,
#             "sessions": response.data,
#             "total_sessions": len(response.data)
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error retrieving sessions: {str(e)}")

# @app.get("/sessions/{session_id}/chat-history")
# async def get_chat_history(session_id: str, user_id: str):
#     """Get chat history for a session"""
    
#     try:
#         # Verify session belongs to user
#         session_check = supabase.table('sessions').select("*").eq('id', session_id).eq('user_id', user_id).execute()
#         if not session_check.data:
#             raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
        
#         # Get chat logs for the session
#         response = supabase.table('chat_logs').select("*").eq('session_id', session_id).order('created_at').execute()
        
#         return {
#             "session_id": session_id,
#             "user_id": user_id,
#             "chat_history": response.data,
#             "total_messages": len(response.data)
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error retrieving chat history: {str(e)}")

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)
