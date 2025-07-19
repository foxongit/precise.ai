import numpy as np
import subprocess
from typing import Dict, Tuple, List
 
def scale_data(data: Dict[str, float]) -> Tuple[Dict[str, float], Dict]:
    """MinMax scale data to [0,1] range"""
    values = list(data.values())
    min_val, max_val = min(values), max(values)
    if max_val == min_val:
        return {key: 0.5 for key in data}, {'min': min_val, 'max': max_val}
    scaled = {key: (val - min_val) / (max_val - min_val) for key, val in data.items()}
    return scaled, {'min': min_val, 'max': max_val}
 
def descale_data(scaled_data: Dict[str, float], params: Dict) -> Dict[str, float]:
    """Convert scaled data back to original values"""
    min_val, max_val = params['min'], params['max']
    return {key: val * (max_val - min_val) + min_val for key, val in scaled_data.items()}
 
def get_llm_response(scaled_data: Dict[str, float], context: str) -> str:
    """Get LLM analysis using only scaled values"""
    try:
        values_text = ", ".join([f"{k} is {v:.3f}" for k, v in scaled_data.items()])
        prompt = f"Analyze {context} data: {values_text}. Mention these values."
        result = subprocess.run([
            'ollama', 'run', 'llama3.2:1b', prompt
        ], capture_output=True, text=True, timeout=8, encoding='utf-8', errors='replace')
        if result.returncode == 0 and result.stdout.strip():
            return ' '.join(result.stdout.strip().split())
    except Exception:
        pass
    parts = [f"{k} is {v:.3f}" for k, v in scaled_data.items()]
    values_text = ", ".join(parts[:-1]) + f", and {parts[-1]}" if len(parts) > 1 else parts[0]
    return f"The {context} analysis shows {values_text}."
 
def replace_values(text: str, scaled_data: Dict[str, float], descaled_data: Dict[str, float]) -> Tuple[str, List[str]]:
    """Replace scaled values with original values in text"""
    replacements = []
    for key in scaled_data:
        scaled_str = f"{scaled_data[key]:.3f}"
        descaled_val = descaled_data[key]
        descaled_str = f"{descaled_val:,.0f}" if abs(descaled_val) >= 1000 else f"{descaled_val:.2f}"
        if scaled_str in text:
            text = text.replace(scaled_str, descaled_str)
            replacements.append(f"{scaled_str} → {descaled_str}")
    return text, replacements
 
def process_data(data: Dict[str, float], context: str):
    """Complete pipeline: scale → LLM → replace"""
    print(f"\n=== {context.upper()} DATA ===")
    print("Original:", {k: v for k, v in data.items()})
    scaled_data, params = scale_data(data)
    print("Scaled:  ", {k: f"{v:.3f}" for k, v in scaled_data.items()})
    llm_response = get_llm_response(scaled_data, context)
    print(f"LLM: '{llm_response}'")
    descaled_data = descale_data(scaled_data, params)
    final_response, replacements = replace_values(llm_response, scaled_data, descaled_data)
    print("Replacements:", len(replacements))
    print(f"Final: '{final_response}'")
    max_error = max(abs(descaled_data[k] - data[k]) for k in data)
    print(f"Accuracy: {max_error:.1e}")
 
def main():
    """Demo with different data types"""
    datasets = [
        ({'profit': 50000, 'revenue': 150000, 'expenses': 100000, 'growth': 0.1}, "financial"),
        ({'speed': 120.5, 'accuracy': 95.8, 'cost': 45.6}, "performance"),
        ({'temp': 25.5, 'pressure': 1013.2, 'humidity': 65.8}, "weather")
    ]
    print("=== SCALE → LLM → REPLACE PIPELINE ===")
    for data, context in datasets:
        process_data(data, context)
 
if __name__ == "__main__":
    main()