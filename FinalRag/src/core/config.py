import os
from dotenv import load_dotenv
 
# Load environment variables
load_dotenv()
 
class Settings:
    # API Settings
    API_TITLE = "RAG Document Processing API"
    API_VERSION = "1.0.0"
    API_HOST = "0.0.0.0"
    API_PORT = int(os.getenv("PORT", 8000))  # Use PORT from environment (Render requirement)
   
    # File Upload Settings
    UPLOAD_DIR = "data/uploads"
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS = [".pdf"]
   
    # Data directories
    DATA_DIR = "data"
    CHROMA_DB_DIR = "data/chroma_db"
    MAPPINGS_DIR = "data/mappings"
   
    # Supabase Settings
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "documents")
   
    # OpenAI API Settings
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # or "gpt-4o", "gpt-3.5-turbo"
    
    # Legacy Gemini settings (keep for backward compatibility)
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-pro")
   
    # RAG Settings
    DEFAULT_K = 4
   
    @classmethod
    def validate(cls):
        """Validate required environment variables and create directories"""
        if not cls.SUPABASE_URL or not cls.SUPABASE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")
        
        if not cls.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY must be set in environment variables")
        
        # Ensure all data directories exist
        os.makedirs(cls.UPLOAD_DIR, exist_ok=True)
        os.makedirs(cls.CHROMA_DB_DIR, exist_ok=True)
        os.makedirs(cls.MAPPINGS_DIR, exist_ok=True)
 
settings = Settings()
settings.validate()
 