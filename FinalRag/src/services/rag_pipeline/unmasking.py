import json
import re
from typing import Dict, Any
import os

def convert_money_to_numeric(value: str) -> float:
    """Convert money strings to numeric values with support for various units"""
    # Remove currency symbols, spaces, and commas
    cleaned = value.strip().replace('$', '').replace('₹', '').replace(',', '').replace(' ', '')
    
    # Convert to lowercase for unit matching
    cleaned_lower = cleaned.lower()
    
    # Extract number and unit
    match = re.match(r'(\d+(?:\.\d+)?)\s*(\w+)?', cleaned_lower)
    
    if match:
        number = float(match.group(1))
        unit = match.group(2) if match.group(2) else None
        
        multipliers = {
            'billion': 1_000_000_000,
            'million': 1_000_000,
            'thousand': 1_000,
            'crore': 10_000_000,
            'lakh': 100_000,
            'lakhs': 100_000,
            'crores': 10_000_000,
            'b': 1_000_000_000,
            'm': 1_000_000,
            'k': 1_000,
            'cr': 10_000_000,
            'l': 100_000
        }
        
        if unit and unit in multipliers:
            return number * multipliers[unit]
        else:
            return number
    
    # Fallback - try to extract just the number
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def convert_percent_to_numeric(value: str) -> float:
    """Convert percentage strings to decimal values"""
    # Remove % and + signs
    cleaned = value.replace('%', '').replace('+', '').strip()
    try:
        number = float(cleaned)
        return number / 100  # Convert to decimal
    except ValueError:
        return 0.0

def load_entity_mappings() -> Dict[str, str]:
    """
    Load entity mappings from the JSON file
    Returns a dictionary mapping masked values to real values
    """
    try:
        # Try multiple possible paths for the entity mappings file
        possible_paths = [
            os.path.join(os.getcwd(), "mappings", "entity_mappings.json"),
            os.path.join(os.getcwd(), "data", "mappings", "entity_mappings.json"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "mappings", "entity_mappings.json"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "mappings", "entity_mappings.json")
        ]
        
        mappings_path = None
        for path in possible_paths:
            if os.path.exists(path):
                mappings_path = path
                break
        
        if not mappings_path:
            raise FileNotFoundError("Entity mappings file not found in any of the expected locations")
        
        with open(mappings_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get("mappings", {})
    
    except Exception as e:
        print(f"Error loading entity mappings: {str(e)}")
        return {}

def create_reverse_mappings(mappings: Dict[str, str]) -> Dict[str, str]:
    """
    Create reverse mappings from masked placeholders to real values
    e.g., "[MONEY_1]" -> "1"
    """
    reverse_mappings = {}
    for real_value, masked_value in mappings.items():
        reverse_mappings[masked_value] = real_value
    return reverse_mappings

def create_value_to_masked_lookup(mappings: Dict[str, str]) -> Dict[str, str]:
    """
    Create lookup from real values to masked placeholders
    e.g., "1" -> "[MONEY_1]"
    """
    return mappings.copy()

def unmask_data_structure(data: Any, reverse_mappings: Dict[str, str]) -> Any:
    """
    Recursively unmask data structures (dict, list, string, etc.)
    """
    if isinstance(data, dict):
        unmasked_dict = {}
        for key, value in data.items():
            print(f"DEBUG: Processing key '{key}' with value type {type(value)}")
            unmasked_value = unmask_data_structure(value, reverse_mappings)
            # Special handling for variables dict - convert money/percent values to numbers
            if key == 'variables' and isinstance(unmasked_value, dict):
                print(f"DEBUG: Found variables key, calling convert_variables_to_numeric")
                unmasked_dict[key] = convert_variables_to_numeric(unmasked_value, reverse_mappings)
            else:
                unmasked_dict[key] = unmasked_value
        return unmasked_dict
    
    elif isinstance(data, list):
        return [unmask_data_structure(item, reverse_mappings) for item in data]
    
    elif isinstance(data, str):
        return unmask_string(data, reverse_mappings)
    
    else:
        return data

def convert_variables_to_numeric(variables: Dict[str, Any], reverse_mappings: Dict[str, str]) -> Dict[str, Any]:
    """
    Convert variables dictionary values to numeric if they represent money or percentages
    """
    print(f"DEBUG: convert_variables_to_numeric called with variables: {variables}")
    
    # Create value-to-masked lookup for efficient reverse lookup
    value_to_masked = {}
    for masked_val, real_val in reverse_mappings.items():
        value_to_masked[real_val] = masked_val
    
    print(f"DEBUG: Created value_to_masked lookup with {len(value_to_masked)} entries")
    
    converted_vars = {}
    for var_name, var_value in variables.items():
        print(f"DEBUG: Processing variable '{var_name}' with value '{var_value}' (type: {type(var_value)})")
        
        if isinstance(var_value, str):
            # Check if this value was originally a MONEY or PERCENT placeholder
            original_masked = value_to_masked.get(var_value)
            print(f"DEBUG: Original masked value for '{var_value}': {original_masked}")
            
            # Convert to numeric if it was a MONEY or PERCENT value
            if original_masked:
                if original_masked.startswith('[MONEY_'):
                    numeric_value = convert_money_to_numeric(var_value)
                    print(f"DEBUG: Converting MONEY '{var_value}' to numeric: {numeric_value}")
                    converted_vars[var_name] = numeric_value
                elif original_masked.startswith('[PERCENT_'):
                    numeric_value = convert_percent_to_numeric(var_value)
                    print(f"DEBUG: Converting PERCENT '{var_value}' to numeric: {numeric_value}")
                    converted_vars[var_name] = numeric_value
                else:
                    converted_vars[var_name] = var_value
            else:
                converted_vars[var_name] = var_value
        else:
            converted_vars[var_name] = var_value
    
    print(f"DEBUG: Final converted variables: {converted_vars}")
    return converted_vars

def unmask_string(text: str, reverse_mappings: Dict[str, str]) -> str:
    """
    Unmask a string by replacing masked placeholders with real values
    """
    unmasked_text = text
    
    # Find all masked placeholders in the text - handle both formats
    # Format 1: [MONEY_1] (with brackets)
    masked_patterns_with_brackets = re.findall(r'\[(?:MONEY|PERCENT|TIME|MONEY_RANGE)_\d+\]', text)
    # Format 2: MONEY_1 (without brackets)
    masked_patterns_without_brackets = re.findall(r'(?:MONEY|PERCENT|TIME|MONEY_RANGE)_\d+', text)
    
    # Process patterns with brackets
    for masked_value in masked_patterns_with_brackets:
        if masked_value in reverse_mappings:
            real_value = reverse_mappings[masked_value]
            
            # For string contexts, don't convert to numeric - keep original values
            # The conversion will happen later in convert_variables_to_numeric
            unmasked_text = unmasked_text.replace(masked_value, real_value)
        else:
            print(f"Warning: Masked value {masked_value} not found in mappings")
    
    # Process patterns without brackets - add brackets to check mappings
    for masked_value in masked_patterns_without_brackets:
        # Skip if this is part of a bracketed pattern we already processed
        if f"[{masked_value}]" in text:
            continue
            
        bracketed_value = f"[{masked_value}]"
        if bracketed_value in reverse_mappings:
            real_value = reverse_mappings[bracketed_value]
            
            # Smart replacement to avoid duplication
            # Look for common patterns and handle them intelligently
            original_context = unmasked_text
            
            # Pattern 1: "US $MONEY_X billion" -> should become "US $6.0 billion" not "US $$6.0 billion billion"
            if re.search(rf'US \${masked_value} billion', unmasked_text):
                # Remove "US $" and "billion" from the real value if present
                clean_real_value = real_value
                if clean_real_value.startswith('$'):
                    clean_real_value = clean_real_value[1:]  # Remove leading $
                if clean_real_value.endswith(' billion'):
                    clean_real_value = clean_real_value[:-8]  # Remove " billion"
                unmasked_text = re.sub(rf'US \${masked_value} billion', f'US ${clean_real_value} billion', unmasked_text)
            
            # Pattern 2: "$MONEY_X million" -> should become "$6.0 million" not "$$6.0 million million"
            elif re.search(rf'\${masked_value} million', unmasked_text):
                clean_real_value = real_value
                if clean_real_value.startswith('$'):
                    clean_real_value = clean_real_value[1:]  # Remove leading $
                if clean_real_value.endswith(' million'):
                    clean_real_value = clean_real_value[:-8]  # Remove " million"
                unmasked_text = re.sub(rf'\${masked_value} million', f'${clean_real_value} million', unmasked_text)
            
            # Pattern 3: "$MONEY_X billion" -> should become "$6.0 billion" not "$$6.0 billion billion"
            elif re.search(rf'\${masked_value} billion', unmasked_text):
                clean_real_value = real_value
                if clean_real_value.startswith('$'):
                    clean_real_value = clean_real_value[1:]  # Remove leading $
                if clean_real_value.endswith(' billion'):
                    clean_real_value = clean_real_value[:-8]  # Remove " billion"
                unmasked_text = re.sub(rf'\${masked_value} billion', f'${clean_real_value} billion', unmasked_text)
            
            # Default pattern: simple replacement
            else:
                unmasked_text = unmasked_text.replace(masked_value, real_value)
        else:
            print(f"Warning: Masked value {bracketed_value} not found in mappings")
    
    return unmasked_text

def unmask_llm_response_simple(llm_response: str) -> Dict[str, Any]:
    """
    Simple unmasking that returns the response in the same format as LLM,
    but with placeholders replaced by real values.
    
    Args:
        llm_response: JSON string response from LLM
        
    Returns:
        Same structure as LLM response but with unmasked values
    """
    try:
        # Handle None input
        if llm_response is None:
            return {
                "error": "LLM response is None"
            }
        
        # Handle empty or None input
        if not llm_response or llm_response.strip() == "":
            return {
                "error": "Empty LLM response received"
            }
        
        # Clean the response if it contains markdown code blocks
        cleaned_response = llm_response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]  # Remove ```json
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]  # Remove ```
        cleaned_response = cleaned_response.strip()
        
        # Parse the JSON response
        response_data = json.loads(cleaned_response)
        
        # Load entity mappings
        mappings = load_entity_mappings()
        reverse_mappings = create_reverse_mappings(mappings)
        
        # Unmask the response
        unmasked_response = unmask_data_structure(response_data, reverse_mappings)
        
        return unmasked_response
        
    except json.JSONDecodeError as e:
        return {
            "error": f"Invalid JSON in LLM response: {str(e)}"
        }
    except Exception as e:
        return {
            "error": f"Error unmasking response: {str(e)}"
        }
