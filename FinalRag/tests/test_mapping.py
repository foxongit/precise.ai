# Test script to demonstrate entity mapping functionality
from zStable.masker import pii_masker_func, print_mappings

# Test text with various entities
test_text = """
Apple's revenue increased by 15% to $10,000 million this quarter.
The company spent $2.5 billion on R&D, which is 2.5x higher than last year.
Profit margins improved by 200 basis points.
"""

print("Original Text:")
print(test_text)

print("\nMasked Text:")
masked_text = pii_masker_func(test_text)
print(masked_text)

print("\nSaved Mappings:")
print_mappings()
