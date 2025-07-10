# RAG Document Processing API

A FastAPI-based backend for document upload, embedding, and intelligent querying with PII masking.

## 🚀 Features

- **Document Upload**: Upload PDF documents with metadata (user_id, doc_id, filename)
- **Vector Storage**: Documents are embedded and stored in ChromaDB with metadata
- **Selective Querying**: Query specific documents by providing doc_ids
- **PII Masking**: Automatic masking of sensitive information (money, percentages, etc.)
- **Query Enhancement**: AI-powered query enrichment for better retrieval
- **User Management**: Separate document spaces for different users

## 📁 Project Structure

```
FinalRag/
├── src/                    # Source code
│   ├── api/               # API routes
│   │   ├── documents.py   # Document upload/management endpoints
│   │   ├── sessions.py    # Session management endpoints
│   │   └── query.py       # Query processing endpoints
│   ├── models/            # Pydantic models
│   │   └── schemas.py     # Request/response schemas
│   ├── services/          # Business logic services
│   │   ├── document_service.py  # Document processing service
│   │   ├── session_service.py   # Session management service
│   │   └── rag_pipeline/        # RAG processing modules
│   │       ├── document_manager.py  # Document embedding & storage
│   │       ├── retriever.py        # Document retrieval
│   │       ├── query_enricher.py   # Query enhancement
│   │       ├── pii_masker.py       # PII masking
│   │       ├── llm_answerer.py     # LLM response generation
│   │       └── pipeline.py         # Main RAG orchestrator
│   ├── db/                # Database configuration
│   │   └── supabase_client.py  # Supabase client setup
│   ├── core/              # Core configuration
│   │   └── config.py      # Application settings
│   └── main.py            # FastAPI application entry point
├── data/                  # Data storage
│   ├── uploads/           # Uploaded documents
│   ├── chroma_db/         # ChromaDB vector database
│   └── mappings/          # PII mapping files
├── tests/                 # Test files
├── requirements.txt       # Python dependencies
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose setup
├── start_direct.bat      # Main startup script
├── start_server.bat      # Legacy startup script
├── app.py                # Original app (backward compatibility)
├── .env                  # Environment variables
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## 🛠️ Setup & Installation

### 1. Quick Start (Recommended)
```bash
# Use the main startup script
start_direct.bat
```

### 2. Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build
```

### 3. Manual Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Start the application
py -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Legacy Setup (Old Structure)
```bash
# Run the original script for backward compatibility
start_server.bat
```
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_md

# Start server
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## 📡 API Endpoints

### 1. Upload Document
```http
POST /upload-document
Content-Type: multipart/form-data

Parameters:
- file: PDF file (required)
- user_id: string (required)
- doc_id: string (optional, auto-generated if not provided)
```

**Example using curl:**
```bash
curl -X POST "http://localhost:8000/upload-document" \
  -F "file=@document.pdf" \
  -F "user_id=user123" \
  -F "doc_id=doc001"
```

### 2. Get User Documents
```http
GET /documents/{user_id}
```

**Example:**
```bash
curl "http://localhost:8000/documents/user123"
```

### 3. Query Documents
```http
POST /query
Content-Type: application/json

{
  "query": "What was the revenue growth?",
  "user_id": "user123",
  "doc_ids": ["doc001", "doc002"],
  "k": 4
}
```

**Example:**
```bash
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What was Apple revenue?",
    "user_id": "user123", 
    "doc_ids": ["doc001"],
    "k": 4
  }'
```

### 4. Delete Document
```http
DELETE /documents/{user_id}/{doc_id}
```

**Example:**
```bash
curl -X DELETE "http://localhost:8000/documents/user123/doc001"
```

### 5. Health Check
```http
GET /health
```

## 🧪 Testing

Use the provided test script:
```bash
python test_api.py
```

Or visit the interactive API documentation at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🔧 Configuration

### Environment Variables
Create a `.env` file (optional):
```
OLLAMA_HOST=localhost:11434
CHROMA_PERSIST_DIR=./chroma_db
```

### LLM Model
The system uses Ollama with `llama3:latest`. Ensure Ollama is running:
```bash
ollama serve
ollama pull llama3:latest
```

## 💡 Usage Examples

### Python Client Example
```python
import requests

# Upload document
files = {"file": open("document.pdf", "rb")}
data = {"user_id": "user123", "doc_id": "doc001"}
response = requests.post("http://localhost:8000/upload-document", 
                        files=files, data=data)

# Query documents
query_data = {
    "query": "What is the main topic?",
    "user_id": "user123",
    "doc_ids": ["doc001"],
    "k": 4
}
response = requests.post("http://localhost:8000/query", json=query_data)
```

### JavaScript/Fetch Example
```javascript
// Upload document
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('user_id', 'user123');
formData.append('doc_id', 'doc001');

fetch('http://localhost:8000/upload-document', {
    method: 'POST',
    body: formData
});

// Query documents
fetch('http://localhost:8000/query', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        query: 'What is the revenue?',
        user_id: 'user123',
        doc_ids: ['doc001'],
        k: 4
    })
});
```

## 🔒 Features

- **Multi-user Support**: Documents are isolated by user_id
- **Metadata Tracking**: Filename, upload date, chunk count stored
- **PII Protection**: Automatic masking of sensitive data
- **Selective Retrieval**: Query only specific documents
- **Persistent Storage**: ChromaDB with disk persistence
- **Error Handling**: Comprehensive error responses

## 🚧 Requirements

- Python 3.8+
- Ollama with llama3:latest model
- spaCy with en_core_web_md model
- ChromaDB for vector storage

## 📝 API Response Examples

### Upload Response
```json
{
  "message": "Document uploaded and processed successfully",
  "doc_id": "doc001",
  "filename": "document.pdf",
  "chunks_added": 25
}
```

### Query Response
```json
{
  "status": "success",
  "original_query": "What was the revenue?",
  "enriched_query": "revenue financial performance earnings income",
  "response": "Based on the context, revenue was [MONEY_1] in Q2...",
  "retrieved_metadata": [
    {
      "doc_id": "doc001",
      "filename": "financial_report.pdf",
      "chunk_id": "doc001_chunk_5"
    }
  ],
  "processed_docs": ["doc001"]
}
```
