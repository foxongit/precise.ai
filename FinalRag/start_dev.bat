@echo off
echo =========================================
echo RAG Document Processing API - Dev Setup
echo =========================================
echo.

REM Check Python version
echo Checking Python version...
py --version
echo.

REM Check if new structure exists
if not exist "src\main.py" (
    echo ❌ New structure not found. Running migration...
    py migrate.py
    echo.
)

REM Check dependencies
echo Checking dependencies...
py -c "
try:
    import fastapi
    import uvicorn
    import supabase
    import chromadb
    print('✅ All core dependencies available')
except ImportError as e:
    print('❌ Missing dependency:', e)
    print('Installing requirements...')
    import subprocess
    subprocess.call(['pip', 'install', '-r', 'requirements.txt'])
"

REM Create data directories
echo.
echo Setting up data directories...
if not exist "data\uploads" mkdir "data\uploads"
if not exist "data\chroma_db" mkdir "data\chroma_db"
if not exist "data\mappings" mkdir "data\mappings"
echo ✅ Data directories ready

REM Check environment variables
echo.
echo Checking environment variables...
py -c "
import os
from dotenv import load_dotenv
load_dotenv()
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')
if supabase_url and supabase_key:
    print('✅ Environment variables configured')
else:
    print('❌ Missing environment variables in .env file')
"

REM Test import
echo.
echo Testing new structure...
py -c "
try:
    from src.main import app
    print('✅ New structure imports successfully')
except Exception as e:
    print('❌ Import failed:', e)
    exit(1)
"

REM Start application
echo.
echo =========================================
echo Starting application...
echo Server: http://localhost:8000
echo Docs: http://localhost:8000/docs
echo Health: http://localhost:8000/health
echo =========================================
echo.
py -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

pause
