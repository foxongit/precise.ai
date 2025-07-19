from .document_manager import document_manager
from .retriever import document_retriever_func, get_retrieved_metadata
from .query_enricher import query_enricher_func
from .pii_masker import pii_masker_func
from .llm_answerer import call_llm
from .unmasking import unmask_llm_response_simple
from typing import List, Dict
from langchain_google_genai import ChatGoogleGenerativeAI
from src.core.config import settings
from .working_agentic import AgenticFormulaSystem
from .final_response import generate_final_response, generate_direct_response
from langchain_openai import ChatOpenAI

class RAGPipeline:
    def __init__(self):
        try:
            # self.llm = ChatGoogleGenerativeAI(
            #     model=settings.GEMINI_MODEL,
            #     google_api_key=settings.GOOGLE_API_KEY,
            #     temperature=0.1
            # )
            self.llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.1
            )
        except Exception as e:
            print(f"Error initializing Gemini API: {e}")
            raise Exception(f"Failed to initialize Gemini API. Please check your GOOGLE_API_KEY: {e}")
        
        self.document_manager = document_manager
    
    def convert_string_to_numeric(self, value: str) -> float:
        """Convert string values like '$ 184,62431' to numeric values"""
        try:
            # Remove currency symbols, spaces, and commas
            cleaned = value.replace('$', '').replace(',', '').replace(' ', '').strip()
            
            # Handle billion and million
            if 'billion' in cleaned.lower():
                number = float(cleaned.lower().replace('billion', '').strip())
                return number * 1000000000
            elif 'million' in cleaned.lower():
                number = float(cleaned.lower().replace('million', '').strip())
                return number * 1000000
            else:
                # Convert to float
                return float(cleaned)
        except (ValueError, AttributeError):
            # If conversion fails, return 0 or raise an error
            print(f"Warning: Could not convert '{value}' to numeric. Using 0.")
            return 0.0
    
    def process_variables_for_agentic(self, variables: dict) -> dict:
        """Convert all string values in variables to numeric values for agentic processing"""
        processed_vars = {}
        for key, value in variables.items():
            if isinstance(value, str):
                processed_vars[key] = self.convert_string_to_numeric(value)
            else:
                processed_vars[key] = value
        return processed_vars
    
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
                     k: int = 4,
                     include_calculation: bool = False) -> Dict:
        """Process a query against selected documents"""
        
        try:
            # Step 1: Enrich query
            print("Enriching query...####################")
            enriched_query = query_enricher_func(query, self.llm)
            print("Ayush######################################")
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
            llm1Response = call_llm(query, masked_chunks, self.llm)
            print("Raw LLM Response:\n", llm1Response)
            
            # Step 6: Unmask the response
            if llm1Response is None or llm1Response.strip() == "":
                return {
                    "status": "error",
                    "error": "LLM returned empty or None response",
                    "original_query": query,
                    "enriched_query": enriched_query,
                    "retrieved_chunks": retrieved_chunks,
                    "masked_chunks": masked_chunks,
                    "raw_response": llm1Response
                }
            
            unmasked_result = unmask_llm_response_simple(llm1Response)
            print("Unmasked Result:\n", unmasked_result)

            # Check if unmasked result has the required fields
            if not isinstance(unmasked_result, dict) or 'formula' not in unmasked_result or 'variables' not in unmasked_result:
                print("Warning: Unmasked result does not contain formula or variables. Skipping agentic processing.")
                computeResponse = None
                originalResult = None
                scaledResult = None
            elif "computeNeeded" in unmasked_result and unmasked_result['computeNeeded'] == "False":
                # Generate direct response when computation is not needed
                direct_response = generate_direct_response(
                    enriched_query,
                    masked_chunks,
                    self.llm)
                print("Direct Response Generated:", direct_response)
                return {
                    "status": "success",
                    "original_query": query,
                    "enriched_query": enriched_query,
                    "retrieved_chunks": retrieved_chunks,
                    "masked_chunks": masked_chunks,
                    "maskedResponse": llm1Response,
                    "unmasked_response": unmasked_result,
                    "direct_response": direct_response,
                    "retrieved_metadata": retrieved_metadata,
                    "processed_docs": doc_ids,
                    "response_type": "direct",
                    "scaled_response": direct_response,  # Use direct response for both scaled and unscaled
                    "unscaled_response": direct_response,
                    "phase2": {"message": "No computation needed for this query"}
                }
            else:
                # Convert variables to numeric format for agentic processing
                processed_variables = self.process_variables_for_agentic(unmasked_result['variables'])
                print(f"DEBUG: Processed variables for agentic: {processed_variables}")

                try:
                    system=AgenticFormulaSystem()
                    computeResponse = system.process_formula(unmasked_result['formula'], processed_variables)
                    print(f"DEBUG: computeResponse = {computeResponse}")
                    originalResult=computeResponse['original_result']
                    scaledResult=computeResponse['scaled_result']
                except Exception as e:
                    print(f"Error in agentic processing: {e}")
                    computeResponse = {"error": str(e)}
                    originalResult = None
                    scaledResult = None

            print("Worksayush###########################################")

            # Only proceed with final response generation if we have valid agentic results
            if scaledResult is not None:
                try:
                    scaledResponse = generate_final_response(
                    enriched_query,
                    scaledResult,
                    self.llm
                    )
                    print(f"DEBUG: scaledResponse = {scaledResponse}")
                except Exception as e:
                    print(f"ERROR in generate_final_response: {e}")
                    scaledResponse = f"Final response generation failed: {str(e)}"

                def replace_value_in_text(text, new_value):
                # Format the new value with commas
                    formatted_value = f"{new_value:,}"
                # Replace the old value with the new formatted value
                    updated_text = text.replace("32,000,000,000", formatted_value)
                    return updated_text

                unscaledResponse = replace_value_in_text(scaledResponse, originalResult)
                print("Unscaled Response:\n", unscaledResponse)
            else:
                scaledResponse = "Agentic processing failed or no formula detected"
                unscaledResponse = "Agentic processing failed or no formula detected"
            
            return {
                "status": "success",
                "original_query": query,
                "enriched_query": enriched_query,
                "retrieved_chunks": retrieved_chunks,
                "masked_chunks": masked_chunks,
                "maskedResponse": llm1Response,
                "unmasked_response": unmasked_result,
                "phase2": computeResponse if computeResponse else {"error": "Agentic processing failed"},
                "scaled_response": scaledResponse,
                "unscaled_response": unscaledResponse,
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
try:
    rag_pipeline = RAGPipeline()
    print("✅ RAG Pipeline initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize RAG Pipeline: {e}")
    # Create a dummy pipeline that will show error messages
    rag_pipeline = None