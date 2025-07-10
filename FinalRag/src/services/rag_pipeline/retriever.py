from typing import List

def document_retriever_func(query: str, retriever) -> str:
    """Retrieve top-k documents relevant to the enriched query from specific documents."""
    if retriever is None:
        raise ValueError("Retriever not provided.")
    
    results = retriever.get_relevant_documents(query)
    # Join top-k docs into one string
    return "\n\n".join([doc.page_content for doc in results])

def get_retrieved_metadata(query: str, retriever) -> List[dict]:
    """Get metadata of retrieved documents"""
    if retriever is None:
        raise ValueError("Retriever not provided.")
    
    results = retriever.get_relevant_documents(query)
    return [doc.metadata for doc in results]
