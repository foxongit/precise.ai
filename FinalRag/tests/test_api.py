import requests
import json
import time

# API base URL
BASE_URL = "http://localhost:8000"

def test_create_session():
    """Test creating a new chat session"""
    url = f"{BASE_URL}/sessions"
    
    data = {
        "user_id": "user123"
    }
    
    response = requests.post(url, json=data)
    result = response.json()
    print("Create Session Response:", result)
    return result

def test_upload_document(session_id: str):
    """Test document upload with background processing"""
    url = f"{BASE_URL}/upload-document"
    
    # Replace with actual file path
    files = {"file": open("apple.pdf", "rb")}
    data = {
        "user_id": "user123",
        "session_id": session_id,
        "doc_id": "doc001"  # Optional
    }
    
    response = requests.post(url, files=files, data=data)
    result = response.json()
    print("Upload Response:", result)
    
    # If processing in background, wait and check status
    if result.get("status") == "processing":
        doc_id = result["doc_id"]
        user_id = data["user_id"]
        
        print("Document is processing in background, checking status...")
        return wait_for_processing(user_id, doc_id)
    
    return result

def test_query_with_session(session_id: str, doc_ids: list):
    """Test querying documents with session"""
    url = f"{BASE_URL}/query"
    
    data = {
        "query": "What was Apple's revenue?",
        "user_id": "user123",
        "session_id": session_id,
        "doc_ids": doc_ids,
        "k": 4
    }
    
    response = requests.post(url, json=data)
    result = response.json()
    print("Query Response:", result)
    return result

def test_get_chat_history(session_id: str):
    """Test getting chat history for a session"""
    url = f"{BASE_URL}/sessions/{session_id}/chat-history"
    
    params = {"user_id": "user123"}
    response = requests.get(url, params=params)
    result = response.json()
    print("Chat History Response:", result)
    return result

def test_get_user_sessions():
    """Test getting all sessions for a user"""
    url = f"{BASE_URL}/sessions/user123"
    
    response = requests.get(url)
    result = response.json()
    print("User Sessions Response:", result)
    return result

def test_get_documents_for_session(session_id: str):
    """Test getting documents for a specific session"""
    url = f"{BASE_URL}/documents/user123"
    
    params = {"session_id": session_id}
    response = requests.get(url, params=params)
    result = response.json()
    print("Session Documents Response:", result)
    return result

def wait_for_processing(user_id: str, doc_id: str, max_wait: int = 60):
    """Wait for document processing to complete"""
    url = f"{BASE_URL}/documents/{user_id}/{doc_id}/status"
    
    for i in range(max_wait):
        response = requests.get(url)
        if response.status_code == 200:
            status_info = response.json()
            print(f"Status check {i+1}: {status_info['status']} - {status_info['message']}")
            
            if status_info["status"] == "completed":
                print("✅ Document processing completed!")
                return status_info
            elif status_info["status"] == "failed":
                print("❌ Document processing failed!")
                return status_info
        
        time.sleep(1)  # Wait 1 second
    
    print("⏰ Processing timeout reached")
    return {"status": "timeout"}

def check_document_status(user_id: str, doc_id: str):
    """Check the status of a document"""
    url = f"{BASE_URL}/documents/{user_id}/{doc_id}/status"
    
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": f"Status check failed: {response.status_code}"}

if __name__ == "__main__":
    print("Testing RAG API with Sessions...")
    
    # Test 1: Create session
    print("\n1. Testing session creation...")
    session_result = test_create_session()
    session_id = session_result.get("session_id")
    
    if not session_id:
        print("❌ Failed to create session. Stopping tests.")
        exit(1)
    
    # Test 2: Upload document
    print("\n2. Testing document upload...")
    upload_result = test_upload_document(session_id)
    
    # Test 3: Get user sessions
    print("\n3. Testing get user sessions...")
    sessions_result = test_get_user_sessions()
    
    # Test 4: Get documents for session
    print("\n4. Testing get session documents...")
    docs_result = test_get_documents_for_session(session_id)
    
    # Extract doc_ids for query
    doc_ids = []
    if docs_result.get("documents"):
        doc_ids = [doc["id"] for doc in docs_result["documents"]]
    
    if doc_ids:
        # Test 5: Query with session
        print("\n5. Testing query with session...")
        query_result = test_query_with_session(session_id, doc_ids)
        
        # Test 6: Get chat history
        print("\n6. Testing get chat history...")
        history_result = test_get_chat_history(session_id)
    else:
        print("\n⚠️ No documents found, skipping query tests")
    
    print("\n✅ All tests completed!")

def test_get_documents():
    """Test getting user documents"""
    url = f"{BASE_URL}/documents/user123"
    
    response = requests.get(url)
    print("Documents Response:", response.json())
    return response.json()

def test_query():
    """Test querying documents"""
    url = f"{BASE_URL}/query"
    
    data = {
        "query": "What was Apple's revenue?",
        "user_id": "user123",
        "doc_ids": ["doc001"],  # Use actual doc IDs
        "k": 4
    }
    
    response = requests.post(url, json=data)
    print("Query Response:")
    result = response.json()
    
    # Pretty print the important parts
    print(f"Status: {result.get('status')}")
    print(f"Original Query: {result.get('original_query')}")
    print(f"Enriched Query: {result.get('enriched_query')[:100]}...")  # Truncate for readability
    print(f"Response: {result.get('response')}")
    print(f"Retrieved {len(result.get('retrieved_metadata', []))} chunks")
    
    return result

def test_query_debug():
    """Test querying documents with debug info"""
    url = f"{BASE_URL}/query"
    
    data = {
        "query": "As of March  29, 2025,how much is the total unrecognized compensation cost related to outstanding RSUs?",
        "user_id": "user123",
        "doc_ids": ["doc001"],
        "k": 4
    }
    
    response = requests.post(url, json=data)
    result = response.json()
    
    print("=== DEBUG QUERY RESPONSE ===")
    print(f"Status: {result.get('status')}")
    print(f"Original Query: {result.get('original_query')}")
    print(f"Enriched Query: {result.get('enriched_query')}")
    print(f"Retrieved Chunks: {result.get('retrieved_chunks', 'NOT FOUND')}")
    print(f"Masked Chunks: {result.get('masked_chunks', 'NOT FOUND')}")
    print(f"Final Response: {result.get('response')}")
    print("=" * 50)
    
    return result

def test_delete_document():
    """Test deleting a document"""
    url = f"{BASE_URL}/documents/user123/doc001"
    
    response = requests.delete(url)
    print("Delete Response:", response.json())
    return response.json()

if __name__ == "__main__":
    print("Testing RAG API...")
    
    # Test upload
    print("\n1. Testing document upload...")
    upload_result = test_upload_document()
    
    # Test get documents
    print("\n2. Testing get documents...")
    docs_result = test_get_documents()
    
    # Test query
    print("\n3. Testing query...")
    query_result = test_query_debug()  # Use debug version
    
    # Test delete (uncomment if needed)
    print("\n4. Testing document deletion...")
    delete_result = test_delete_document()