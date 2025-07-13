def query_enricher_func(query: str, llm) -> str:
    """Use LLM to enrich or rephrase user query for better retrieval."""
    prompt = f"""
You are a query rewriting assistant. Given a user's search query, rewrite it to make it more specific and relevant for keyword-based document search.
 
IMPORTANT: Only output the rewritten query keywords/phrases, nothing else. No explanations, no instructions, just the improved search terms.
 
Original Query: "{query}"
Rewritten Query (keywords only):
"""
    enriched = llm.invoke(prompt)
    return enriched.content.strip() if hasattr(enriched, 'content') else str(enriched).strip()