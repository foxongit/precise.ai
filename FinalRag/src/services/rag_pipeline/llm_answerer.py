def llm_answerer_func(inputs: dict, llm) -> str:
    """Ask the LLM to perform symbolic reasoning on masked placeholders using both context and query."""
    masked_context = inputs["context"]
    user_query = inputs["query"]

    prompt = f"""
You are a helpful assistant. Answer the user's question based ONLY on the provided context below. If the context contains masked values like [MONEY_1], [PERCENT_2], etc., use them in your response.

If you cannot find the answer in the context, say "I cannot find that information in the provided documents."

Context:
{masked_context}

Question: {user_query}

Answer based on the context above:
"""
    response = llm.invoke(prompt)
    return response.strip()
