from src.core.config import settings
import requests

# --- Prompt Builder ---
def prepare_messages(user_query, masked_text):
    return [
        {
            "role": "system",
            "content": """You are a financial data extraction expert. Extract financial data and formulas from the given text into a strictly formatted JSON response.

Input:
- User query asking about financial calculations
- Text with masked numbers (MONEY_1, PERCENT_1, etc. format)

Output Requirements:
IMPORTANT: Respond ONLY with a valid JSON object containing exactly these fields:
{
    "title": "brief description of calculation",
    "formula": "mathematical formula using variable names",
    "variables": {
        "variable_name": "MONEY_1 or other masked value"
    },
    "computeNeeded": "True or False",
    "computeNeeded": "True or False"
}

Critical Rules:
1. Use EXACT masked values and ALWAYS wrap them in quotes: "MONEY_1", "PERCENT_1"
2. Use proper JSON syntax:
   - Use double quotes for ALL strings, including masked values
   - Every MONEY_X, PERCENT_X must be in quotes like "MONEY_1"
   - No trailing commas
   - No comments
   - No line breaks in values
3. Keep formulas simple and clear
4. Variables must match the formula exactly
5. IMPORTANT: Never use bare MONEY_X values - always use "MONEY_X"
6.IMPOPRTANT: computeNeeded must be "True" if the query requires computation, "False" if it does not

Example of CORRECT JSON response:
{
    "title": "Net Revenue Calculation",
    "formula": "gross_revenue - total_expenses",
    "variables": {
        "gross_revenue": "MONEY_1",
        "total_expenses": "MONEY_2"
    },
    "computeNeeded": "True"
}

Example of INCORRECT response (missing quotes around MONEY values):
{
    "title": "Net Revenue Calculation",
    "formula": "gross_revenue - total_expenses",
    "variables": {
        "gross_revenue": MONEY_1,
        "total_expenses": MONEY_2
    },
    "computeNeeded": "True"
}

Example of CORRECT response with array:
{
    "title": "Total Profit Calculation",
    "formula": "revenue - sum(costs)",
    "variables": {
        "revenue": "MONEY_1",
        "costs": ["MONEY_2", "MONEY_3", "MONEY_4"]
    },
    "computeNeeded": "True"
}

DO NOT:
- Add explanations or notes
- Use single quotes
- Modify masked values
- Include additional fields
- Include line breaks in values

ONLY OUTPUT VALID JSON."""
        },
        {
            "role": "user",
            "content": f"""Query: {user_query}

Here is the masked data:

{masked_text}"""
        }
    ]

# def call_llm(user_query, masked_chunks, llm):
#     """
#     Call the LLM using LangChain's ChatGoogleGenerativeAI
#     """
#     try:
#         messages = prepare_messages(user_query, masked_chunks)
        
#         # Convert to LangChain message format
#         from langchain_core.messages import SystemMessage, HumanMessage
        
#         langchain_messages = [
#             SystemMessage(content=messages[0]["content"]),
#             HumanMessage(content=messages[1]["content"])
#         ]
        
#         # Invoke the LLM using LangChain's interface
#         response = llm.invoke(langchain_messages)
        
#         # Extract the content from the response
#         return response.content
        
#     except Exception as e:
#         print(f"Error calling LLM: {str(e)}")
#         return None


# def llm_answerer_func(context_data, llm):
#     """
#     Legacy function for compatibility with existing pipeline
#     """
#     return call_llm(
#         context_data.get("query", ""), 
#         context_data.get("context", ""), 
#         llm
#     )
    

def call_llm(user_query, masked_text, llm):
    """
    Call the LLM using the initialized LLM instance from the pipeline
    """
    try:
        messages = prepare_messages(user_query, masked_text)
        
        # Convert to LangChain message format
        from langchain_core.messages import SystemMessage, HumanMessage
        
        langchain_messages = [
            SystemMessage(content=messages[0]["content"]),
            HumanMessage(content=messages[1]["content"])
        ]
        
        # Invoke the LLM using LangChain's interface
        response = llm.invoke(langchain_messages)
        
        # Extract the content from the response
        return response.content
        
    except Exception as e:
        print(f"Error calling LLM: {str(e)}")
        return None
