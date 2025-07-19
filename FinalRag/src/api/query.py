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
        # Verify session exists and belongs to user
        if not session_service.verify_session(request.session_id, request.user_id):
            raise HTTPException(status_code=404, detail="Session not found or doesn't belong to user")
        
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
            return JSONResponse(
                status_code=202,  # Accepted but not ready
                content={
                    "status": "not_ready",
                    "message": f"Some documents are not ready: {', '.join(not_ready_docs)}",
                    "not_ready_docs": not_ready_docs,
                    "suggestion": "Please wait for document processing to complete or check status endpoints"
                }
            )
        
        # Check if RAG pipeline is initialized
        if rag_pipeline is None:
            raise HTTPException(
                status_code=503, 
                detail="RAG pipeline not initialized. Please check server configuration."
            )
        
        # Handle empty doc_ids - return appropriate response
        if not request.doc_ids or len(request.doc_ids) == 0:
            # Save general query response to chat log
            general_response = "I'd be happy to help! Please select some documents using the checkboxes in the sidebar so I can provide specific information from your documents."
            
            chat_log_result = session_service.save_chat_log(
                session_id=request.session_id,
                prompt=request.query,
                response=general_response
            )
            
            response_data = {
                "status": "success",
                "session_id": request.session_id,
                "user_query": request.query,
                "transformed_query": request.query,
                "retrieved_chunks": [],
                "masked_chunks": [],
                "maskedResponse": general_response,
                "unmasked_response": general_response,
                "phase2": "",
                "scaled_response": general_response,
                "unscaled_response": general_response,
                "retrieved_metadata": [],
                "processed_docs": []
            }
            
            if chat_log_result["success"]:
                response_data["chat_log_id"] = chat_log_result["chat_log_id"]
            else:
                response_data["warning"] = "Query processed successfully but failed to save chat log"
            
            return JSONResponse(
                status_code=200,
                content=response_data
            )
        
        # Process the query through RAG pipeline
        result = rag_pipeline.process_query(
            query=request.query,
            user_id=request.user_id,
            doc_ids=request.doc_ids,
            k=request.k
        )
        
        if result["status"] == "success":
            # Save chat log to database
            chat_log_result = session_service.save_chat_log(
                session_id=request.session_id,
                prompt=request.query,
                response=result["scaled_response"]  # Use scaled_response instead of response
            )
            
            response_data = {
                "status": result["status"],
                "session_id": request.session_id,
                "user_query": result["original_query"],
                "transformed_query": result["enriched_query"],
                "retrieved_chunks": result["retrieved_chunks"],
                "masked_chunks": result["masked_chunks"],
                "maskedResponse": result["maskedResponse"],
                "unmasked_response": result["unmasked_response"], 
                "phase2": result["phase2"],
                "scaled_response": result["scaled_response"],
                "unscaled_response": result["unscaled_response"],
                "retrieved_metadata": result["retrieved_metadata"],
                "processed_docs": result["processed_docs"]
            }
            
            if chat_log_result["success"]:
                response_data["chat_log_id"] = chat_log_result["chat_log_id"]
            else:
                # If chat log saving failed, still return the result but with a warning
                response_data["warning"] = "Query processed successfully but failed to save chat log"
            
            return JSONResponse(
                status_code=200,
                content=response_data
            )
        else:
            raise HTTPException(status_code=500, detail=result["message"])
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")
