#!/usr/bin/env bash
# Build script for Render

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Creating data directories..."
mkdir -p data/uploads
mkdir -p data/chroma_db  
mkdir -p data/mappings

echo "Build completed successfully!"
