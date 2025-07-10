import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database table names
export const TABLES = {
  SESSIONS: 'sessions',
  DOCUMENTS: 'documents',
  CHAT_LOGS: 'chat_logs',
  DOCUMENT_SESSIONS: 'document_sessions'
} as const

// Storage bucket name
export const STORAGE_BUCKET = 'documents'
