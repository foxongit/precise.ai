import uuid
from datetime import datetime
from typing import Dict, Any, List
from src.db.supabase_client import supabase

class SessionService:
    def create_session(self, user_id: str, name: str = None) -> Dict[str, Any]:
        """Create a new chat session"""
        try:
            session_id = str(uuid.uuid4())
            session_data = {
                "id": session_id,
                "user_id": user_id,
                "created_at": datetime.now().isoformat(),
                "name": name
            }
            
            response = supabase.table('sessions').insert(session_data).execute()
            
            if response.data:
                return {
                    "success": True,
                    "session_id": session_id,
                    "user_id": user_id,
                    "created_at": session_data["created_at"]
                }
            else:
                return {"success": False, "error": "Failed to create session"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_user_sessions(self, user_id: str) -> Dict[str, Any]:
        """Get all sessions for a user"""
        try:
            response = supabase.table('sessions').select("*").eq('user_id', user_id).order('created_at', desc=True).execute()
            
            return {
                "success": True,
                "sessions": response.data,
                "total_sessions": len(response.data)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def verify_session(self, session_id: str, user_id: str) -> bool:
        """Verify that a session exists and belongs to the user"""
        try:
            session_check = supabase.table('sessions').select("*").eq('id', session_id).eq('user_id', user_id).execute()
            return bool(session_check.data)
        except Exception as e:
            print(f"Error verifying session: {e}")
            return False
    
    def get_chat_history(self, session_id: str, user_id: str) -> Dict[str, Any]:
        """Get chat history for a session"""
        try:
            # Verify session belongs to user
            if not self.verify_session(session_id, user_id):
                return {"success": False, "error": "Session not found or doesn't belong to user"}
            
            # Get chat logs for the session
            response = supabase.table('chat_logs').select("*").eq('session_id', session_id).order('created_at').execute()
            
            return {
                "success": True,
                "chat_history": response.data,
                "total_messages": len(response.data)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def save_chat_log(self, session_id: str, prompt: str, response: str) -> Dict[str, Any]:
        """Save chat log to database"""
        try:
            chat_log_data = {
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "prompt": prompt,
                "response": response,
                "created_at": datetime.now().isoformat()
            }
            
            chat_response = supabase.table('chat_logs').insert(chat_log_data).execute()
            
            if chat_response.data:
                return {"success": True, "chat_log_id": chat_log_data["id"]}
            else:
                return {"success": False, "error": "Failed to save chat log"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def save_ai_response(self, session_id: str, response: str) -> Dict[str, Any]:
        """Save only AI response to chat log (when user prompt is already saved)"""
        return self.save_chat_log(session_id, "", response)
    
    def link_document_to_session(self, document_id: str, session_id: str) -> Dict[str, Any]:
        """Link a document to a session via document_sessions table"""
        try:
            # First check if the link already exists
            existing_link = supabase.table('document_sessions').select("*").eq('document_id', document_id).eq('session_id', session_id).execute()
            
            if existing_link.data:
                return {"success": True, "link_created": False, "message": "Document already linked to session"}
            
            link_data = {
                "document_id": document_id,
                "session_id": session_id
            }
            
            response = supabase.table('document_sessions').insert(link_data).execute()
            
            if response.data:
                return {"success": True, "link_created": True, "message": "Document linked to session successfully"}
            else:
                return {"success": False, "error": "Failed to link document to session"}
        except Exception as e:
            # Handle potential unique constraint violation
            if "duplicate key value violates unique constraint" in str(e).lower() or "unique constraint" in str(e).lower():
                return {"success": True, "link_created": False, "message": "Document already linked to session"}
            return {"success": False, "error": str(e)}
    
    def get_session_documents(self, session_id: str, user_id: str) -> Dict[str, Any]:
        """Get all documents linked to a session"""
        try:
            # Verify session belongs to user
            if not self.verify_session(session_id, user_id):
                return {"success": False, "error": "Session not found or doesn't belong to user"}
            
            # Get documents linked to this session via document_sessions table
            response = supabase.table('document_sessions').select("documents(*)").eq('session_id', session_id).execute()
            
            documents = []
            if response.data:
                documents = [item['documents'] for item in response.data if item['documents']]
            
            return {
                "success": True,
                "documents": documents,
                "total_documents": len(documents)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def unlink_document_from_session(self, document_id: str, session_id: str) -> Dict[str, Any]:
        """Unlink a document from a session"""
        try:
            response = supabase.table('document_sessions').delete().eq('document_id', document_id).eq('session_id', session_id).execute()
            
            if response.data:
                return {"success": True, "message": "Document unlinked from session successfully"}
            else:
                return {"success": False, "error": "Link not found or already removed"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_document_sessions(self, document_id: str, user_id: str) -> Dict[str, Any]:
        """Get all sessions that a document is linked to (for a specific user)"""
        try:
            # Get sessions linked to this document that belong to the user
            response = supabase.table('document_sessions').select("sessions(*)").eq('document_id', document_id).execute()
            
            # Filter sessions that belong to the user
            user_sessions = []
            if response.data:
                for item in response.data:
                    if item['sessions'] and item['sessions']['user_id'] == user_id:
                        user_sessions.append(item['sessions'])
            
            return {
                "success": True,
                "sessions": user_sessions,
                "total_sessions": len(user_sessions)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def delete_session(self, session_id: str, user_id: str) -> Dict[str, Any]:
        """Delete a session and all its associated data"""
        try:
            # First verify the session belongs to the user
            if not self.verify_session(session_id, user_id):
                return {"success": False, "error": "Session not found or doesn't belong to user"}
            
            # Delete all document-session links for this session
            doc_sessions_response = supabase.table('document_sessions').delete().eq('session_id', session_id).execute()
            
            # Delete all chat logs for this session
            chat_logs_response = supabase.table('chat_logs').delete().eq('session_id', session_id).execute()
            
            # Finally delete the session itself
            session_response = supabase.table('sessions').delete().eq('id', session_id).eq('user_id', user_id).execute()
            
            if session_response.data is not None:  # None means successful deletion
                return {
                    "success": True,
                    "message": "Session deleted successfully",
                    "session_id": session_id
                }
            else:
                return {"success": False, "error": "Failed to delete session"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
# Global instance
session_service = SessionService()
