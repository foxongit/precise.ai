@echo off
echo Starting RAG Document Processing API (New Structure)...
echo.

REM Check if required packages are installed
echo Checking dependencies...
py -c "import fastapi, uvicorn; print('✅ Core dependencies found')" || (
    echo ❌ Required packages not found. Installing...
    pip install -r requirements.txt
)

REM Create data directories if they don't exist
echo Creating data directories...
if not exist "data\uploads" mkdir "data\uploads"
if not exist "data\chroma_db" mkdir "data\chroma_db"
if not exist "data\mappings" mkdir "data\mappings"

REM Start the application
echo.
echo Starting the application...
echo Server will be available at: http://localhost:8000
echo API Documentation: http://localhost:8000/docs
echo.
py -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

pause
