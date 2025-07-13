from .document_manager import document_manager
from .retriever import document_retriever_func, get_retrieved_metadata
from .query_enricher import query_enricher_func
from .pii_masker import pii_masker_func
from .llm_answerer import llm_answerer_func
from typing import List, Dict
from langchain_google_genai import ChatGoogleGenerativeAI
from src.core.config import settings

class RAGPipeline:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0.1
        )
        self.document_manager = document_manager
    
    def add_document(self, 
                    pdf_path: str, 
                    user_id: str, 
                    doc_id: str, 
                    filename: str,
                    upload_date: str = None) -> Dict:
        """Add document to the RAG system"""
        return self.document_manager.add_document(
            pdf_path, user_id, doc_id, filename, upload_date
        )
    
    def get_user_documents(self, user_id: str) -> List[Dict]:
        """Get all documents for a user"""
        return self.document_manager.get_user_documents(user_id)
    
    def delete_document(self, doc_id: str, user_id: str) -> Dict:
        """Delete a document"""
        return self.document_manager.delete_document(doc_id, user_id)
    
    def process_query(self, 
                     query: str, 
                     user_id: str, 
                     doc_ids: List[str],
                     k: int = 4) -> Dict:
        """Process a query against selected documents"""
        
        try:
            # Step 1: Enrich query
            enriched_query = query_enricher_func(query, self.llm)
            
            # Step 2: Get retriever for selected documents
            retriever = self.document_manager.get_retriever_for_docs(
                doc_ids, user_id, k
            )
            
            # Step 3: Retrieve relevant chunks
            retrieved_chunks = document_retriever_func(enriched_query, retriever)
            retrieved_metadata = get_retrieved_metadata(enriched_query, retriever)
            
            # Step 4: Mask PII
            masked_chunks = pii_masker_func(retrieved_chunks)
            
            # Step 5: Generate answer
            response = llm_answerer_func({
                "context": masked_chunks, 
                "query": query
            }, self.llm)
            
            return {
                "status": "success",
                "original_query": query,
                "enriched_query": enriched_query,
                "retrieved_chunks": retrieved_chunks,
                "masked_chunks": masked_chunks,
                "response": response,
                "retrieved_metadata": retrieved_metadata,
                "processed_docs": doc_ids
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "original_query": query,
                "processed_docs": doc_ids
            }

# Global RAG pipeline instance
rag_pipeline = RAGPipeline()