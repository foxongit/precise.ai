import spacy
import re
import json
import os
from datetime import datetime

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

# Load spaCy model once
nlp = spacy.load("en_core_web_sm")

def pii_masker_func(text: str) -> str:
    """Mask PII-like content (money, percent, cardinal, ratios) in the input text."""

    # Step 1 — spaCy NER
    doc = nlp(text)
    entity_counter = {
        "CARDINAL": 0,
        "MONEY": 0,
        "PERCENT": 0,
        "CURRENCY_RANGE": 0,
        "RATIO": 0,
        "PERCENT_POINT": 0
    }
    entity_map = {}
    entities = []
    existing_spans = []

    for ent in doc.ents:
        if ent.label_ in ["CARDINAL", "MONEY", "PERCENT"]:
            ent_text = ent.text.strip()
            ent_label = ent.label_

            if ent_text not in entity_map:
                entity_counter[ent_label] += 1
                placeholder = f"[{ent_label}_{entity_counter[ent_label]}]"
                entity_map[ent_text] = placeholder

            entities.append({
                'text': ent_text,
                'label': ent_label,
                'start': ent.start_char,
                'end': ent.end_char
            })
            existing_spans.append((ent.start_char, ent.end_char))

    # Step 2 — Regex patterns
    regex_patterns = [
        {"label": "CURRENCY_RANGE", "pattern": r"US?\s?\$?\s?\d+(?:\.\d+)?(?:–|-)\d+(?:\.\d+)?\s?(million|billion|M|B)"},
        {"label": "RATIO", "pattern": r"(?:\d+|\d*\.\d+)x"},
        {"label": "PERCENT", "pattern": r"[+-]?\d+(?:\.\d+)?%"},
        {"label": "PERCENT_POINT", "pattern": r"[+-]?\d+(?:\.\d+)?\s?(ppt|ppts)"}
    ]

    for regex in regex_patterns:
        for match in re.finditer(regex["pattern"], text):
            ent_text = match.group(0)
            ent_label = regex["label"]
            start = match.start()
            end = match.end()

            # prevent overlap
            if any(not (end <= s or start >= e) for s, e in existing_spans):
                continue

            if ent_text not in entity_map:
                entity_counter[ent_label] += 1
                placeholder = f"[{ent_label}_{entity_counter[ent_label]}]"
                entity_map[ent_text] = placeholder

            entities.append({
                'text': ent_text,
                'label': ent_label,
                'start': start,
                'end': end
            })
            existing_spans.append((start, end))

    # Step 3 — Replace from end to start
    entities_sorted = sorted(entities, key=lambda x: x['start'], reverse=True)
    for ent in entities_sorted:
        start, end = ent['start'], ent['end']
        text = text[:start] + entity_map[ent['text']] + text[end:]

    # Step 4 — Save mappings to file
    if entity_map:  # Only save if there are mappings
        save_mapping_to_file(entity_map)

    return text
