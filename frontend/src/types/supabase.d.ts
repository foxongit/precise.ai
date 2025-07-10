// Type declarations for Supabase entities

declare module '../hooks/useSupabase' {
  export interface Conversation {
    id: string;
    title: string;
    last_updated: string;
    document_uuid?: string[];
    user_id?: string;
  }

  export interface ChatMessage {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    step: number;
    created_at: string;
  }

  export interface Document {
    id: string;
    user_id: string;
    title: string;
    content_type?: string;
    storage_path_supabase?: string;
    storage_path_s3?: string;
    created_at: string;
    metadata?: any;
    status?: string;
  }

  export function useConversations(user: import('@supabase/supabase-js').User | null): {
    conversations: Conversation[];
    isLoading: boolean;
    loadConversations: () => Promise<void>;
    createConversation: (title: string, documentIds?: string[]) => Promise<Conversation>;
    updateConversation: (conversationId: string, updates: Partial<Conversation>) => Promise<boolean>;
    deleteConversation: (conversationId: string) => Promise<boolean>;
  };

  export function useChats(conversationId: string | null): {
    chats: ChatMessage[];
    isLoading: boolean;
    refreshChats: () => Promise<void>;
  };

  export function useDocuments(user: import('@supabase/supabase-js').User | null): {
    documents: Document[];
    isLoading: boolean;
    refreshDocuments: () => Promise<void>;
    uploadDocument: (file: File, processContent?: boolean) => Promise<Document>;
  };
}

declare module '../lib/geminiService' {
  export type GeminiStatus = 'loaded' | 'missing' | 'error';
  export function checkGeminiStatus(): GeminiStatus;
  export function setGeminiApiKey(apiKey: string): void;
  export function generateGeminiResponse(prompt: string): Promise<string>;
}
