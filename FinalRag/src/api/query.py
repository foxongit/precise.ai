from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from src.models.schemas import QueryRequest, QueryResponse
from src.services.session_service import session_service
from src.services.document_service import document_service
from src.services.rag_pipeline.pipeline import rag_pipeline

router = APIRouter(tags=["query"])

@router.post("/query", response_model=QueryResponse)
async def process_query(request: QueryRequest):
    """Process a query against selected documents and save to chat logs"""
    
    try:
        # Validate required fields
        if not request.user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        if not request.session_id:
            raise HTTPException(status_code=400, detail="session_id is required")
        if not request.query or not request.query.strip():
            raise HTTPException(status_code=400, detail="query cannot be empty")
        
        # Verify session exists and belongs to user
        if not session_service.verify_session(request.session_id, request.user_id):
            raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
        
        # First, save the user message and get chat log ID
        user_message_result = session_service.save_user_message(request.session_id, request.query)
        
        if not user_message_result["success"]:
            raise HTTPException(status_code=500, detail=f"Failed to save user message: {user_message_result.get('error', 'Unknown error')}")
        
        chat_log_id = user_message_result["chat_log_id"]
        
        # Check if all requested documents are ready (if any documents are provided)
        not_ready_docs = []
        if request.doc_ids:  # Only check if documents are provided
            for doc_id in request.doc_ids:
                status_info = document_service.get_document_status(doc_id)
                if status_info:
                    status = status_info["status"]
                    if status == "processing":
                        not_ready_docs.append(f"{doc_id} (processing)")
                    elif status == "failed":
                        not_ready_docs.append(f"{doc_id} (failed)")
        
        if not_ready_docs:
            # Update chat log with error response
            session_service.update_chat_log_response(
                chat_log_id, 
                f"Some documents are not ready: {', '.join(not_ready_docs)}. Please wait for document processing to complete."
            )
            
            return JSONResponse(
                status_code=202,  # Accepted but not ready
                content={
                    "status": "not_ready",
                    "message": f"Some documents are not ready: {', '.join(not_ready_docs)}",
                    "not_ready_docs": not_ready_docs,
                    "suggestion": "Please wait for document processing to complete or check status endpoints",
                    "chat_log_id": chat_log_id
                }
            )
        
        # Process the query through RAG pipeline
        result = rag_pipeline.process_query(
            query=request.query,
            user_id=request.user_id,
            doc_ids=request.doc_ids,
            k=request.k
        )
        
        if result["status"] == "success":
            # Update the same chat log with AI response
            chat_log_update_result = session_service.update_chat_log_response(
                chat_log_id,
                result["response"]
            )
            
            response_data = {
                "status": result["status"],
                "session_id": request.session_id,
                "original_query": result["original_query"],
                "enriched_query": result["enriched_query"],
                "retrieved_chunks": result["retrieved_chunks"],
                "masked_chunks": result["masked_chunks"],
                "response": result["response"],
                "retrieved_metadata": result["retrieved_metadata"],
                "processed_docs": result["processed_docs"],
                "chat_log_id": chat_log_id
            }
            
            if not chat_log_update_result["success"]:
                # If chat log update failed, still return the result but with a warning
                response_data["warning"] = "Query processed successfully but failed to update chat log with response"
            
            return JSONResponse(
                status_code=200,
                content=response_data
            )
        else:
            # Update chat log with error response
            session_service.update_chat_log_response(
                chat_log_id, 
                f"I encountered an error processing your request: {result['message']}"
            )
            raise HTTPException(status_code=500, detail=result["message"])
            
    except Exception as e:
        # If we have a chat_log_id, update it with error response
        if 'chat_log_id' in locals():
            session_service.update_chat_log_response(
                chat_log_id, 
                "I'm sorry, I encountered an error while processing your request. Please try again."
            )
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")
