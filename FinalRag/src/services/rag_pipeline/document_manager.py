from langchain_core.documents import Document
import pdfplumber
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
import os
from datetime import datetime
from typing import Dict, List, Optional
import shutil

class DocumentManager:
    def __init__(self, persist_directory: str = "./chroma_db"):
        self.persist_directory = persist_directory
        self.embedding = HuggingFaceEmbeddings(model_name="BAAI/bge-large-en-v1.5")
        self.vectordb = None
        self._initialize_db()
    
    def _initialize_db(self):
        """Initialize or load existing Chroma database"""
        if os.path.exists(self.persist_directory):
            # Load existing database
            self.vectordb = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embedding
            )
        else:
            # Create new database
            self.vectordb = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embedding
            )
    
    def add_document(self, 
                    pdf_path: str, 
                    user_id: str, 
                    doc_id: str, 
                    filename: str,
                    upload_date: str = None) -> Dict:
        """Add a document to the vector database with metadata"""
        
        if upload_date is None:
            upload_date = datetime.now().isoformat()
        
        try:
            # Load and split document
            # loader = PyMuPDFLoader(pdf_path)
            # docs = loader.load()

            # Load and split document using pdfplumber
            def load_pdf_with_pdfplumber(pdf_path: str):
                docs = []
                with pdfplumber.open(pdf_path) as pdf:
                    for i, page in enumerate(pdf.pages):
                        text = page.extract_text() or ""
                        metadata = {
                            "page_number": i + 1,
                            "source": pdf_path
                        }
                        docs.append(Document(page_content=text, metadata=metadata))
                return docs

            # Load the PDF
            docs = load_pdf_with_pdfplumber(pdf_path)

            
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=300, 
                chunk_overlap=50
            )
            chunks = splitter.split_documents(docs)
            
            # Add metadata to each chunk
            for i, chunk in enumerate(chunks):
                chunk.metadata.update({
                    "user_id": user_id,
                    "doc_id": doc_id,
                    "filename": filename,
                    "upload_date": upload_date,
                    "chunk_id": f"{doc_id}_chunk_{i}",
                    "total_chunks": len(chunks)
                })
            
            # Add to vector database
            self.vectordb.add_documents(chunks)
            # self.vectordb.persist()
            
            return {
                "status": "success",
                "doc_id": doc_id,
                "chunks_added": len(chunks),
                "message": f"Document {filename} successfully added to database"
            }
            
        except Exception as e:
            return {
                "status": "error",
                "doc_id": doc_id,
                "message": f"Error adding document: {str(e)}"
            }
    
    def get_retriever_for_docs(self, doc_ids: List[str], user_id: str, k: int = 4):
        """Get retriever filtered by specific document IDs and user ID"""
        
        # Create filter for specific documents and user
        filter_dict = {
            "$and": [
                {"user_id": {"$eq": user_id}},
                {"doc_id": {"$in": doc_ids}}
            ]
        }
        
        return self.vectordb.as_retriever(
            search_kwargs={
                "k": k,
                "filter": filter_dict
            }
        )
    
    def get_user_documents(self, user_id: str) -> List[Dict]:
        """Get list of all documents for a user"""
        try:
            # Get all documents for user
            results = self.vectordb.get(
                where={"user_id": user_id}
            )
            
            # Extract unique documents
            docs_info = {}
            for metadata in results['metadatas']:
                doc_id = metadata['doc_id']
                if doc_id not in docs_info:
                    docs_info[doc_id] = {
                        "doc_id": doc_id,
                        "filename": metadata['filename'],
                        "upload_date": metadata['upload_date'],
                        "total_chunks": metadata['total_chunks']
                    }
            
            return list(docs_info.values())
            
        except Exception as e:
            return []
    
    def delete_document(self, doc_id: str, user_id: str) -> Dict:
        """Delete a document from the database"""
        try:
            # Get document chunks to delete
            results = self.vectordb.get(
                where={
                    "$and": [
                        {"user_id": {"$eq": user_id}},
                        {"doc_id": {"$eq": doc_id}}
                    ]
                }
            )
            
            if not results['ids']:
                return {
                    "status": "error",
                    "message": "Document not found"
                }
            
            # Delete the chunks
            self.vectordb.delete(ids=results['ids'])
            # self.vectordb.persist()
            
            return {
                "status": "success",
                "message": f"Document {doc_id} deleted successfully",
                "chunks_deleted": len(results['ids'])
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error deleting document: {str(e)}"
            }

# Global instance
document_manager = DocumentManager()
