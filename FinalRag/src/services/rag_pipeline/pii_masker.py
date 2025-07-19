import re
import json
import os
from datetime import datetime
from collections import defaultdict

def save_mapping_to_file(entity_map: dict, filename: str = "entity_mappings.json"):
    """Save entity mappings to a JSON file with timestamp."""
    # Create mappings directory if it doesn't exist
    mappings_dir = "mappings"
    if not os.path.exists(mappings_dir):
        os.makedirs(mappings_dir)
    
    # Full path for the mapping file
    file_path = os.path.join(mappings_dir, filename)
    
    # Prepare data with timestamp
    mapping_data = {
        "timestamp": datetime.now().isoformat(),
        "mappings": entity_map
    }
    
    # Load existing mappings if file exists
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                # Update existing mappings with new ones
                existing_data["mappings"].update(entity_map)
                existing_data["timestamp"] = datetime.now().isoformat()
                mapping_data = existing_data
        except (json.JSONDecodeError, KeyError):
            # If file is corrupted, start fresh
            pass
    
    # Save updated mappings
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(mapping_data, f, indent=2, ensure_ascii=False)
    
    return file_path

def load_mapping_from_file(filename: str = "entity_mappings.json"):
    """Load entity mappings from a JSON file."""
    mappings_dir = "mappings"
    file_path = os.path.join(mappings_dir, filename)
    
    if not os.path.exists(file_path):
        return {}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get("mappings", {})
    except (json.JSONDecodeError, FileNotFoundError) as e:
        return {}


def pii_masker_func(text: str) -> str:
    """Mask PII-like content (money, percent, ranges) using regex patterns."""
    
    # Load existing mappings to avoid duplicate placeholders
    existing_mappings = load_mapping_from_file()
    
    # Define regex patterns in order of priority
    patterns = [
        (
            r'('  # MONEY_RANGE
            r'(?:\$|\u20b9|\u20ac|\u00a3)?\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:M|B|K|million|billion|crore)?'
            r')\s?[\u2013-]\s?('
            r'(?:\$|\u20b9|\u20ac|\u00a3)?\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:M|B|K|million|billion|crore)?'
            r')', 'MONEY_RANGE'),
        
        (r'[+\-]?\d+(?:\.\d+)?\s?[\u2013-]\s?[+\-]?\d+(?:\.\d+)?\s?%', 'PERCENT_RANGE'),
        (r'[+\-]?\d+(?:\.\d+)?\s?%', 'PERCENT'),
        (r'(?:\$|\u20b9|\u20ac|\u00a3)?\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:M|B|K|\s?million|\s?billion|\s?crore)?', 'MONEY')
    ]

    entity_map = existing_mappings.copy()  # Start with existing mappings
    
    # Calculate current max counters for each label type
    entity_counts = defaultdict(int)
    for original_value, placeholder in existing_mappings.items():
        # Extract label and number from placeholder like "[MONEY_5]"
        if placeholder.startswith('[') and placeholder.endswith(']'):
            parts = placeholder[1:-1].split('_')
            if len(parts) == 2:
                label, num_str = parts
                try:
                    num = int(num_str)
                    entity_counts[label] = max(entity_counts[label], num)
                except ValueError:
                    continue
    
    occupied = [False] * len(text)
    replacements = []

    # Process each pattern
    for pattern, label in patterns:
        for match in re.finditer(pattern, text):
            span = match.span()
            value = match.group().strip()
            
            # Skip if this span is already occupied
            if any(occupied[i] for i in range(span[0], span[1])):
                continue
            
            # Mark this span as occupied
            for i in range(span[0], span[1]):
                occupied[i] = True
            
            # Create placeholder if this value hasn't been seen before
            if value not in entity_map:
                entity_counts[label] += 1
                placeholder = f"[{label}_{entity_counts[label]}]"
                entity_map[value] = placeholder
            
            # Store replacement info
            replacements.append((span, entity_map[value]))

    # Apply replacements from end to start to avoid position shifts
    for (start, end), placeholder in sorted(replacements, reverse=True):
        text = text[:start] + placeholder + text[end:]

    # Save mappings to file (only if new entities were found)
    new_mappings = {k: v for k, v in entity_map.items() if k not in existing_mappings}
    if new_mappings:
        save_mapping_to_file(new_mappings)

    return text
