#!/usr/bin/env python3
"""
Database setup script for FinalRAG
Run this to create tables in Supabase
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def setup_database():
    """Create database tables and storage bucket"""
    
    # Get Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file")
        return False
    
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
        
        print("🚀 Setting up database...")
        
        # Test connection
        result = supabase.table('sessions').select('*').limit(1).execute()
        print("✅ Database connection successful!")
        
        # Check if tables exist
        try:
            sessions = supabase.table('sessions').select('*').limit(1).execute()
            print("✅ Sessions table exists")
        except:
            print("❌ Sessions table missing")
            
        try:
            documents = supabase.table('documents').select('*').limit(1).execute()
            print("✅ Documents table exists")
        except:
            print("❌ Documents table missing")
            
        try:
            chat_logs = supabase.table('chat_logs').select('*').limit(1).execute()
            print("✅ Chat logs table exists")
        except:
            print("❌ Chat logs table missing")
            
        try:
            document_sessions = supabase.table('document_sessions').select('*').limit(1).execute()
            print("✅ Document sessions table exists")
        except:
            print("❌ Document sessions table missing")
        
        # Check storage bucket
        try:
            buckets = supabase.storage.list_buckets()
            bucket_names = [bucket.name for bucket in buckets]
            if 'documents' in bucket_names:
                print("✅ Documents storage bucket exists")
            else:
                print("❌ Documents storage bucket missing")
        except:
            print("❌ Storage bucket check failed")
        
        print("\n📋 Next steps:")
        print("1. Go to your Supabase project dashboard")
        print("2. Navigate to SQL Editor")
        print("3. Run the SQL from database_schema.sql")
        print("4. Verify tables are created in Table Editor")
        
        return True
        
    except Exception as e:
        print(f"❌ Error connecting to database: {str(e)}")
        return False

if __name__ == "__main__":
    success = setup_database()
    sys.exit(0 if success else 1)
