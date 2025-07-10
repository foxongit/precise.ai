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

-- Create RLS policies for sessions (using auth.uid() for authenticated users)
CREATE POLICY "Users can view their own sessions" ON sessions
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create sessions" ON sessions
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own sessions" ON sessions
    FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own sessions" ON sessions
    FOR DELETE USING (user_id = auth.uid()::text);

-- Create RLS policies for documents
CREATE POLICY "Users can view all documents" ON documents
    FOR SELECT USING (true);

CREATE POLICY "Users can create documents" ON documents
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update documents" ON documents
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete documents" ON documents
    FOR DELETE USING (true);

-- Create RLS policies for chat_logs (through session ownership)
CREATE POLICY "Users can view their chat logs" ON chat_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = chat_logs.session_id 
            AND sessions.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can create chat logs" ON chat_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = chat_logs.session_id 
            AND sessions.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update chat logs" ON chat_logs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = chat_logs.session_id 
            AND sessions.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete chat logs" ON chat_logs
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = chat_logs.session_id 
            AND sessions.user_id = auth.uid()::text
        )
    );

-- Create RLS policies for document_sessions (through session ownership)
CREATE POLICY "Users can view their document sessions" ON document_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = document_sessions.session_id 
            AND sessions.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can create document sessions" ON document_sessions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = document_sessions.session_id 
            AND sessions.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update document sessions" ON document_sessions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = document_sessions.session_id 
            AND sessions.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete document sessions" ON document_sessions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = document_sessions.session_id 
            AND sessions.user_id = auth.uid()::text
        )
    );

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

COMMIT;
