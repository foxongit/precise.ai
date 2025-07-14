from fastapi import APIRouter, HTTPException
from src.models.schemas import CreateSessionRequest, SessionResponse
from src.services.session_service import session_service

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.post("/", response_model=SessionResponse)
async def create_chat_session(request: CreateSessionRequest):
    """Create a new chat session for a user"""
    
    result = session_service.create_session(request.user_id, request.name)
    
    if result["success"]:
        return SessionResponse(
            session_id=result["session_id"],
            user_id=result["user_id"],
            created_at=result["created_at"],
            name=request.name
        )
    else:
        raise HTTPException(status_code=500, detail=result["error"])

@router.get("/{user_id}")
async def get_user_sessions(user_id: str):
    """Get all sessions for a user"""
    
    result = session_service.get_user_sessions(user_id)
    
    if result["success"]:
        return {
            "user_id": user_id,
            "sessions": result["sessions"],
            "total_sessions": result["total_sessions"]
        }
    else:
        raise HTTPException(status_code=500, detail=result["error"])

@router.get("/{session_id}/chat-history")
async def get_chat_history(session_id: str, user_id: str):
    """Get chat history for a session"""
    
    result = session_service.get_chat_history(session_id, user_id)
    
    if result["success"]:
        return {
            "session_id": session_id,
            "user_id": user_id,
            "chat_history": result["chat_history"],
            "total_messages": result["total_messages"]
        }
    else:
        raise HTTPException(status_code=404, detail=result["error"])

@router.get("/{session_id}/documents")
async def get_session_documents(session_id: str, user_id: str):
    """Get all documents linked to a session"""
    
    result = session_service.get_session_documents(session_id, user_id)
    
    if result["success"]:
        return {
            "session_id": session_id,
            "user_id": user_id,
            "documents": result["documents"],
            "total_documents": result["total_documents"]
        }
    else:
        raise HTTPException(status_code=404, detail=result["error"])

@router.post("/{session_id}/link-document")
async def link_document_to_session(session_id: str, document_id: str, user_id: str):
    """Link a document to a session"""
    
    # Verify session belongs to user
    if not session_service.verify_session(session_id, user_id):
        raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
    
    result = session_service.link_document_to_session(document_id, session_id)
    
    if result["success"]:
        return {"message": "Document linked to session successfully"}
    else:
        raise HTTPException(status_code=500, detail=result["error"])

@router.delete("/{session_id}/unlink-document")
async def unlink_document_from_session(session_id: str, document_id: str, user_id: str):
    """Unlink a document from a session"""
    
    # Verify session belongs to user
    if not session_service.verify_session(session_id, user_id):
        raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
    
    result = session_service.unlink_document_from_session(document_id, session_id)
    
    if result["success"]:
        return {"message": result["message"]}
    else:
        raise HTTPException(status_code=500, detail=result["error"])

@router.post("/{session_id}/chat-log")
async def save_chat_log(session_id: str, request: dict):
    """Save a chat log entry (user message or AI response)"""
    
    # Verify session belongs to user
    if not session_service.verify_session(session_id, request.get("user_id")):
        raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
    
    # Extract prompt and response from request
    prompt = request.get("prompt", "")
    response = request.get("response", "")
    
    if not prompt and not response:
        raise HTTPException(status_code=400, detail="Either prompt or response must be provided")
    
    result = session_service.save_chat_log(session_id, prompt, response)
    
    if result["success"]:
        return {
            "success": True,
            "chat_log_id": result["chat_log_id"],
            "session_id": session_id,
            "message": "Chat log saved successfully"
        }
    else:
        raise HTTPException(status_code=500, detail=result["error"])

@router.delete("/{session_id}")
async def delete_session(session_id: str, user_id: str):
    """Delete a session"""
    
    # Verify session belongs to user
    if not session_service.verify_session(session_id, user_id):
        raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
    
    result = session_service.delete_session(session_id, user_id)
    
    if result["success"]:
        return {"message": "Session deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail=result["error"])
