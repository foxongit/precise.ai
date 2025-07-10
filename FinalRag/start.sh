#!/usr/bin/env bash
# Start script for Render

echo "Starting RAG Document Processing API..."
python -m uvicorn src.main:app --host 0.0.0.0 --port $PORT
