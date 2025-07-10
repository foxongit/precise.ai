#!/usr/bin/env python3
"""
Migration script to transition from old app.py structure to new modular structure.
This script helps maintain backward compatibility while using the new structure.
"""

import os
import sys
import shutil
from pathlib import Path

def migrate_project():
    """Migrate the project structure"""
    print("🚀 Starting project migration...")
    
    # Check if already migrated
    if os.path.exists("src/main.py"):
        print("✅ Project already migrated to new structure!")
        return
    
    # Create new directory structure if it doesn't exist
    directories = [
        "src/api",
        "src/models", 
        "src/services",
        "src/db",
        "src/core",
        "data/uploads",
        "data/chroma_db",
        "data/mappings",
        "tests"
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        # Create __init__.py files for Python packages
        if directory.startswith("src/"):
            init_file = os.path.join(directory, "__init__.py")
            if not os.path.exists(init_file):
                with open(init_file, "w") as f:
                    f.write("")
    
    # Move existing data directories
    moves = [
        ("uploads", "data/uploads"),
        ("chroma_db", "data/chroma_db"),
        ("mappings", "data/mappings"),
        ("rag_pipeline", "src/services/rag_pipeline")
    ]
    
    for src, dst in moves:
        if os.path.exists(src) and not os.path.exists(dst):
            print(f"📁 Moving {src} to {dst}")
            shutil.move(src, dst)
    
    # Move test files
    test_files = ["test_api.py", "test_mapping.py", "test_processing_monitor.py"]
    for test_file in test_files:
        if os.path.exists(test_file):
            dst = os.path.join("tests", test_file)
            if not os.path.exists(dst):
                print(f"📄 Moving {test_file} to tests/")
                shutil.move(test_file, dst)
    
    print("✅ Migration completed!")
    print("\n📋 Next steps:")
    print("1. Use 'start_direct.bat' to start the application")
    print("2. Use 'py -m uvicorn src.main:app --reload' for development")
    print("3. Use 'docker-compose up --build' for Docker deployment")
    print("4. The old app.py is preserved for backward compatibility")

if __name__ == "__main__":
    migrate_project()
