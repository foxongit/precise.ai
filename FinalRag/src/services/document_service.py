import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from src.db.supabase_client import supabase, SUPABASE_BUCKET
from src.core.config import settings

class DocumentService:
    def __init__(self):
        self.document_status = {}
    
    def update_document_status(self, doc_id: str, status: str, message: str = "", chunks_added: int = 0):
        """Update document processing status"""
        self.document_status[doc_id] = {
            "status": status,  # "processing", "completed", "failed"
            "message": message,
            "chunks_added": chunks_added,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_document_status(self, doc_id: str) -> Dict[str, Any]:
        """Get document processing status"""
        if doc_id not in self.document_status:
            return None
        return self.document_status[doc_id]
    
    def save_document_to_supabase(self, doc_data: Dict[str, Any]) -> bool:
        """Save document metadata to Supabase"""
        try:
            db_response = supabase.table('documents').insert(doc_data).execute()
            return bool(db_response.data)
        except Exception as e:
            print(f"Error saving document to Supabase: {e}")
            return False
    
    def upload_file_to_storage(self, file_path: str, storage_path: str) -> bool:
        """Upload file to Supabase Storage"""
        try:
            with open(file_path, 'rb') as file:
                file_data = file.read()
            
            storage_response = supabase.storage.from_(SUPABASE_BUCKET).upload(
                path=storage_path,
                file=file_data,
                file_options={"content-type": "application/pdf"}
            )
            
            # Check if upload was successful
            if hasattr(storage_response, 'data') and storage_response.data:
                return True
            elif hasattr(storage_response, 'path') or (isinstance(storage_response, dict) and 'path' in storage_response):
                return True
            elif not hasattr(storage_response, 'error'):
                return True
            
            return False
        except Exception as e:
            print(f"Error uploading file to storage: {e}")
            return False
    
    def delete_from_storage(self, storage_path: str) -> bool:
        """Delete file from Supabase Storage"""
        try:
            supabase.storage.from_(SUPABASE_BUCKET).remove([storage_path])
            return True
        except Exception as e:
            print(f"Error deleting file from storage: {e}")
            return False
    
    def cleanup_local_file(self, file_path: str):
        """Clean up local file"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Error cleaning up local file: {e}")
    
    def get_user_documents(self, user_id: str, session_id: str = None):
        """Get documents for a user or session"""
        try:
            if session_id:
                # Get documents for specific session via document_sessions table
                response = supabase.table('document_sessions').select("documents(*)").eq('session_id', session_id).execute()
                
                # Also verify session belongs to user
                session_check = supabase.table('sessions').select("*").eq('id', session_id).eq('user_id', user_id).execute()
                if not session_check.data:
                    return None
                
                # Extract documents from the join result
                documents = []
                if response.data:
                    documents = [item['documents'] for item in response.data if item['documents']]
                return documents
            else:
                # Get all documents for user across all sessions
                user_sessions = supabase.table('sessions').select("id").eq('user_id', user_id).execute()
                session_ids = [session['id'] for session in user_sessions.data]
                
                if session_ids:
                    # Get documents linked to user's sessions
                    response = supabase.table('document_sessions').select("documents(*)").in_('session_id', session_ids).execute()
                    documents = []
                    if response.data:
                        documents = [item['documents'] for item in response.data if item['documents']]
                    return documents
                else:
                    return []
            
        except Exception as e:
            print(f"Error getting user documents: {e}")
            return None
    
    def get_document_by_id(self, doc_id: str) -> Dict[str, Any]:
        """Get document by ID"""
        try:
            response = supabase.table('documents').select("*").eq('id', doc_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error getting document by ID: {e}")
            return None
            return None
    
    def get_document(self, doc_id: str, user_id: str = None) -> Dict[str, Any]:
        """Get document information from database"""
        try:
            # Query for document in Supabase
            query = supabase.table('documents').select('*').eq('id', doc_id)
            response = query.execute()
            
            # Check if document was found
            if response.data and len(response.data) > 0:
                document = response.data[0]
                
                # If user_id is provided, verify document is associated with user through document_sessions
                if user_id:
                    # Check if this document is associated with any session belonging to this user
                    session_query = supabase.table('document_sessions').select('*') \
                        .eq('document_id', doc_id) \
                        .execute()
                    
                    if session_query.data and len(session_query.data) > 0:
                        # Get all session IDs associated with this document
                        session_ids = [s['session_id'] for s in session_query.data]
                        
                        # Check if any of these sessions belong to the user
                        user_sessions = supabase.table('sessions').select('*') \
                            .in_('id', session_ids) \
                            .eq('user_id', user_id) \
                            .execute()
                        
                        if user_sessions.data and len(user_sessions.data) > 0:
                            # Document is associated with user
                            return document
                        else:
                            # Document exists but doesn't belong to user
                            print(f"Document {doc_id} exists but is not associated with user {user_id}")
                            return None
                    else:
                        # Document exists but not associated with any session
                        return document
                else:
                    # No user filter, just return the document
                    return document
            return None
        except Exception as e:
            print(f"Error retrieving document from database: {str(e)}")
            return None
    
    def delete_document(self, doc_id: str, user_id: str) -> Dict[str, Any]:
        """Delete a document and all its associated data"""
        try:
            # First verify document exists and belongs to user
            document = self.get_document(doc_id, user_id)
            if not document:
                return {"success": False, "error": "Document not found or doesn't belong to user"}
            
            # Delete from RAG pipeline/vector store
            from src.services.rag_pipeline.pipeline import rag_pipeline
            rag_result = rag_pipeline.delete_document(doc_id, user_id)
            
            # Delete from Supabase storage
            try:
                storage_path = document.get('storage_path')
                if storage_path:
                    supabase.storage.from_(SUPABASE_BUCKET).remove([storage_path])
            except Exception as e:
                print(f"Warning: Could not delete from storage: {e}")
            
            # Delete all document-session links
            supabase.table('document_sessions').delete().eq('document_id', doc_id).execute()
            
            # Delete the document record
            db_response = supabase.table('documents').delete().eq('id', doc_id).execute()
            
            # Clean up status tracking
            if doc_id in self.document_status:
                del self.document_status[doc_id]
            
            return {
                "success": True,
                "message": "Document deleted successfully",
                "doc_id": doc_id
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def generate_signed_url(self, storage_path: str, expires_in: int = 3600) -> Optional[str]:
        """Generate a signed URL for a document in Supabase Storage"""
        try:
            # Generate signed URL that expires in 1 hour (3600 seconds)
            response = supabase.storage.from_(SUPABASE_BUCKET).create_signed_url(
                path=storage_path,
                expires_in=expires_in
            )
            
            if hasattr(response, 'data') and response.data:
                return response.data.get('signedUrl') or response.data.get('signedURL')
            elif isinstance(response, dict) and 'signedUrl' in response:
                return response['signedUrl']
            elif isinstance(response, dict) and 'signedURL' in response:
                return response['signedURL']
                
            return None
        except Exception as e:
            print(f"Error generating signed URL for {storage_path}: {e}")
            return None
    
    def generate_public_url(self, storage_path: str) -> Optional[str]:
        """Generate a public URL for a document (if bucket is public)"""
        try:
            response = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(storage_path)
            
            if hasattr(response, 'data') and response.data:
                return response.data.get('publicUrl') or response.data.get('publicURL')
            elif isinstance(response, dict) and 'publicUrl' in response:
                return response['publicUrl']
            elif isinstance(response, dict) and 'publicURL' in response:
                return response['publicURL']
                
            return None
        except Exception as e:
            print(f"Error generating public URL for {storage_path}: {e}")
            return None

# Global instance
document_service = DocumentService()
