from typing import List, Dict, Any

def generate_final_response(enriched_query: str, scaled_result: Any, llm) -> str:
    """
    Generate final response using enriched query, and scaled result.
    
    Args:
        enriched_query: The enriched/processed query
        scaled_result: The scaled result from phase 2 processing
        llm: The LLM instance to use for generation
        
    Returns:
        str: Final response text or error message
    """
    try:
        print("DEBUG: Starting generate_final_response...")
                
        # Create the prompt for final response generation
        prompt = f"""
USER QUERY: {enriched_query}

CALCULATED RESULT: {scaled_result}

INSTRUCTIONS:
1. Provide a clear, comprehensive answer to the user's query
2. Use the calculated result
3. Be precise and factual
5. Keep the response well-structured and easy to understand and in natural language

Generate a final response that combines the calculated result to answer the user's query:
"""
        
        print(f"DEBUG: Prompt length: {len(prompt)} characters")
        print(f"DEBUG: About to invoke LLM with llm type: {type(llm)}")
        
        # Generate response using LLM
        response = llm.invoke(prompt)
        print(f"DEBUG: LLM response received, type: {type(response)}")
        
        final_text = response.content.strip() if hasattr(response, 'content') else str(response).strip()
        print(f"DEBUG: Final text length: {len(final_text)} characters")
        
        # Check if response is empty
        if not final_text:
            return "Final response generation failed: LLM returned empty response"
        
        return final_text
        
    except Exception as e:
        print(f"DEBUG: Exception in generate_final_response: {e}")
        print(f"DEBUG: Exception type: {type(e)}")
        return f"Final response generation failed: {str(e)}"


def generate_direct_response(enriched_query: str, masked_chunks: str, llm) -> str:
    try:
        prompt = f"""
You are a helpful assistant that provides direct answers from the given context.

USER QUERY: {enriched_query}

CONTEXT (contains masked values like MONEY_1, PERCENT_1):
{masked_chunks}

INSTRUCTIONS:
1. Answer the query using ONLY the information from the context
2. Use the masked values (like MONEY_1) directly in your response - DO NOT try to unmask them
3. Be specific and reference the exact parts of the context you're using
4. If you see values like MONEY_1, use them exactly as they appear
5. Keep your response clear and focused on the query
6. If you can't find relevant information in the context, say so
7. Use natural language but keep the masked values intact

Remember: Never try to calculate or modify the masked values. Use them exactly as they appear in the context.
"""
        # Convert to LangChain message format for better handling
        from langchain_core.messages import SystemMessage, HumanMessage
        
        langchain_messages = [
            SystemMessage(content=prompt)
        ]
        
        # Generate response using LLM
        response = llm.invoke(langchain_messages)
        final_text = response.content.strip() if hasattr(response, 'content') else str(response).strip()
        
        if not final_text:
            return "Direct response generation failed: Empty response received"
            
        return final_text
        
    except Exception as e:
        print(f"Error in generate_direct_response: {e}")
        return f"Direct response generation failed: {str(e)}"