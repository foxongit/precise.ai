import os
import uuid
from datetime import datetime
from typing import Dict, Any
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

# Global instance
document_service = DocumentService()
