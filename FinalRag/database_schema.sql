-- FinalRAG Database Schema
-- Run this in Supabase SQL Editor

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_logs table
CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_sessions junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS document_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, session_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_session_id ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_sessions_session_id ON document_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_document_sessions_document_id ON document_sessions(document_id);

-- Enable Row Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sessions
CREATE POLICY "Users can view their own sessions" ON sessions
    FOR SELECT USING (true); -- Allow all for now, add user auth later

CREATE POLICY "Users can create sessions" ON sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own sessions" ON sessions
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own sessions" ON sessions
    FOR DELETE USING (true);

-- Create RLS policies for documents
CREATE POLICY "Users can view all documents" ON documents
    FOR SELECT USING (true);

CREATE POLICY "Users can create documents" ON documents
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update documents" ON documents
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete documents" ON documents
    FOR DELETE USING (true);

-- Create RLS policies for chat_logs
CREATE POLICY "Users can view chat logs" ON chat_logs
    FOR SELECT USING (true);

CREATE POLICY "Users can create chat logs" ON chat_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update chat logs" ON chat_logs
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete chat logs" ON chat_logs
    FOR DELETE USING (true);

-- Create RLS policies for document_sessions
CREATE POLICY "Users can view document sessions" ON document_sessions
    FOR SELECT USING (true);

CREATE POLICY "Users can create document sessions" ON document_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update document sessions" ON document_sessions
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete document sessions" ON document_sessions
    FOR DELETE USING (true);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for documents bucket
CREATE POLICY "Users can upload documents" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Users can view documents" ON storage.objects
    FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "Users can update documents" ON storage.objects
    FOR UPDATE USING (bucket_id = 'documents');

CREATE POLICY "Users can delete documents" ON storage.objects
    FOR DELETE USING (bucket_id = 'documents');

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional)
INSERT INTO sessions (user_id, name) VALUES 
    ('user123', 'Default Session'),
    ('user123', 'Research Session')
ON CONFLICT DO NOTHING;

-- Enable authentication
-- This is handled by Supabase Auth automatically, but we need to link our tables to auth.users

-- Add user profile table (optional, for additional user data)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create profile policies
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'name');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update sessions table to use auth user IDs
-- Note: You might need to adjust this based on your current data

-- FinalRAG Database Schema
-- Run this in Supabase SQL Editor

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_logs table
CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_sessions junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS document_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, session_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_session_id ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_sessions_session_id ON document_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_document_sessions_document_id ON document_sessions(document_id);

-- Enable Row Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sessions
CREATE POLICY "Users can view their own sessions" ON sessions
    FOR SELECT USING (true); -- Allow all for now, add user auth later

CREATE POLICY "Users can create sessions" ON sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own sessions" ON sessions
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own sessions" ON sessions
    FOR DELETE USING (true);

-- Create RLS policies for documents
CREATE POLICY "Users can view all documents" ON documents
    FOR SELECT USING (true);

CREATE POLICY "Users can create documents" ON documents
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update documents" ON documents
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete documents" ON documents
    FOR DELETE USING (true);

-- Create RLS policies for chat_logs
CREATE POLICY "Users can view chat logs" ON chat_logs
    FOR SELECT USING (true);

CREATE POLICY "Users can create chat logs" ON chat_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update chat logs" ON chat_logs
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete chat logs" ON chat_logs
    FOR DELETE USING (true);

-- Create RLS policies for document_sessions
CREATE POLICY "Users can view document sessions" ON document_sessions
    FOR SELECT USING (true);

CREATE POLICY "Users can create document sessions" ON document_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update document sessions" ON document_sessions
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete document sessions" ON document_sessions
    FOR DELETE USING (true);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for documents bucket
CREATE POLICY "Users can upload documents" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Users can view documents" ON storage.objects
    FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "Users can update documents" ON storage.objects
    FOR UPDATE USING (bucket_id = 'documents');

CREATE POLICY "Users can delete documents" ON storage.objects
    FOR DELETE USING (bucket_id = 'documents');

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional)
INSERT INTO sessions (user_id, name) VALUES 
    ('user123', 'Default Session'),
    ('user123', 'Research Session')
ON CONFLICT DO NOTHING;

-- Enable authentication
-- This is handled by Supabase Auth automatically, but we need to link our tables to auth.users

-- Add user profile table (optional, for additional user data)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create profile policies
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'name');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update sessions table to use auth user IDs
-- Note: You might need to adjust this based on your current data

COMMIT;
