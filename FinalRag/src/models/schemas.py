from pydantic import BaseModel
from typing import List, Optional

class QueryRequest(BaseModel):
    query: str
    user_id: str
    session_id: str
    doc_ids: List[str]
    k: Optional[int] = 4

class CreateSessionRequest(BaseModel):
    user_id: str
    name: Optional[str] = None

class SessionResponse(BaseModel):
    session_id: str
    user_id: str
    created_at: str
    name: Optional[str] = None

class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    storage_path: str
    upload_date: str
    total_chunks: Optional[int] = None

class DocumentSessionLink(BaseModel):
    document_id: str
    session_id: str

class ChatLogResponse(BaseModel):
    id: str
    session_id: str
    prompt: str
    response: str
    created_at: str

class DocumentStatus(BaseModel):
    doc_id: str
    user_id: str
    status: str  # "processing", "completed", "failed"
    message: str
    chunks_added: int
    timestamp: str
    is_ready: bool

class QueryResponse(BaseModel):
    status: str
    original_query: str
    enriched_query: str
    retrieved_chunks: str
    masked_chunks: str
    response: str
    retrieved_metadata: List[dict]
    processed_docs: List[str]
    message: Optional[str] = None
