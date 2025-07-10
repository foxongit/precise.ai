@echo off
echo Starting RAG Document Processing API...
echo.

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    py -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate

REM Install requirements
echo Installing requirements...
py -m pip install -r requirements.txt

REM Download spaCy model if not exists
echo Checking spaCy model...
py -c "import spacy; spacy.load('en_core_web_md')" 2>nul || (
    echo Downloading spaCy model...
    py -m spacy download en_core_web_md
)

REM Start the FastAPI server
echo.
echo Starting FastAPI server...
echo API will be available at: http://localhost:8000
echo API documentation at: http://localhost:8000/docs
echo.

py -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload