import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { sessionsApi, documentsApi } from '../services/api';

// Define types for our data based on the actual FinalRag schema
export interface Conversation {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  // Virtual fields for compatibility with Dashboard
  title?: string;
  last_updated?: string;
  document_uuid?: string[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  prompt: string;
  response: string;
  created_at: string;
  // Virtual fields for compatibility with Dashboard
  conversation_id?: string;
  role?: 'user' | 'assistant';
  content?: string;
  step?: number;
}

export interface Document {
  id: string;
  filename: string;
  storage_path: string;
  upload_date: string;
  created_at: string;
  updated_at: string;
  // Virtual fields for compatibility with Dashboard
  user_id?: string;
  title?: string;
  content_type?: string;
  storage_path_supabase?: string;
  storage_path_s3?: string;
  metadata?: any;
  status?: string;
}

export interface DocumentSession {
  id: string;
  document_id: string;
  session_id: string;
  created_at: string;
}

// Hook for managing conversations (sessions)
export const useConversations = (user: User | null) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      console.log('Loading conversations via sessions API...');
      const response = await sessionsApi.getUserSessions();
      const sessions = (response.data as any)?.sessions || [];
      
      console.log('Raw sessions from API:', sessions);

      // Transform sessions to conversation format and populate document_uuid
      const transformedConversations: Conversation[] = [];
      
      for (const session of sessions) {
        if (!session.id || session.id === 'undefined') {
          console.warn('Skipping session with invalid ID:', session);
          continue;
        }
        
        // Get documents for this session
        let sessionDocumentIds: string[] = [];
        try {
          const sessionDocsResponse = await sessionsApi.getSessionDocuments(session.id);
          const sessionDocs = (sessionDocsResponse.data as any)?.documents || [];
          sessionDocumentIds = sessionDocs.map((doc: any) => doc.id || doc.document_id).filter(Boolean);
          console.log(`Session ${session.id} has ${sessionDocumentIds.length} documents:`, sessionDocumentIds);
        } catch (sessionError) {
          console.warn(`Failed to get documents for session ${session.id}:`, sessionError);
        }
        
        const transformedConversation: Conversation = {
          id: session.id,
          name: session.name || 'Unnamed Session',
          user_id: session.user_id,
          created_at: session.created_at,
          updated_at: session.updated_at || session.created_at,
          title: session.name || 'Unnamed Session',
          last_updated: session.updated_at || session.created_at,
          document_uuid: sessionDocumentIds
        };
        
        transformedConversations.push(transformedConversation);
      }
      
      setConversations(transformedConversations);
      console.log('Loaded conversations via API:', transformedConversations);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createConversation = async (title: string, documentIds: string[] = []) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      // Use the FinalRag sessions API to create a session
      const sessionResponse = await sessionsApi.createSession({ name: title });
      const data = sessionResponse.data;
      
      console.log('Session created via API:', data);
      
      // Document linking will be handled by the backend when documents are uploaded
      
      // Refresh conversations list
      await loadConversations();
      
      // Return data with compatibility fields
      const conversation: Conversation = {
        id: data.session_id,
        name: title || 'New Chat',
        user_id: data.user_id,
        created_at: data.created_at,
        updated_at: data.created_at,
        title: title || 'New Chat',
        last_updated: data.created_at,
        document_uuid: documentIds
      };
      
      return conversation;
    } catch (err) {
      console.error('Error creating conversation:', err);
      throw err;
    }
  };

  const updateConversation = async (conversationId: string, updates: Partial<Conversation>) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      console.log('Updating conversation (API integration needed):', conversationId, updates);
      
      // TODO: Implement proper API endpoint for updating conversations
      // For now, just update local state and refresh
      
      // Refresh conversations list to get latest data
      await loadConversations();
      
      return true;
    } catch (err) {
      console.error('Error updating conversation:', err);
      throw err;
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      console.log('Deleting conversation via API:', conversationId);
      
      // Use the sessions API to delete the session
      await sessionsApi.deleteSession(conversationId);
      
      // Refresh conversations list
      await loadConversations();
      
      return true;
    } catch (err) {
      console.error('Error deleting conversation:', err);
      throw err;
    }
  };

  return {
    conversations,
    isLoading,
    loadConversations,
    createConversation,
    updateConversation,
    deleteConversation
  };
};

// Hook for managing chats within a conversation
export const useChats = (conversationId: string | null) => {
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (conversationId) {
      refreshChats();
    } else {
      setChats([]);
    }
  }, [conversationId]);

  const refreshChats = async () => {
    if (!conversationId || conversationId === 'undefined') {
      console.warn('Invalid conversation ID, skipping chat refresh');
      setChats([]);
      return;
    }
    
    setIsLoading(true);
    try {
      // Use backend API to get chat history
      const response = await sessionsApi.getChatHistory(conversationId);
      const chatHistory = (response.data as any)?.chat_history || [];
      
      // Transform chat history data to match expected format
      const transformedChats: ChatMessage[] = [];
      
      chatHistory.forEach((chatLog: any, index: number) => {
        // Add user message
        transformedChats.push({
          ...chatLog,
          id: `${chatLog.id}-user`,
          conversation_id: chatLog.session_id,
          role: 'user',
          content: chatLog.prompt,
          step: (index * 2) + 1
        });
        
        // Only add assistant message if response is not empty
        // This allows us to show user messages immediately while AI generates response
        if (chatLog.response && chatLog.response.trim()) {
          transformedChats.push({
            ...chatLog,
            id: `${chatLog.id}-assistant`,
            conversation_id: chatLog.session_id,
            role: 'assistant',
            content: chatLog.response,
            step: (index * 2) + 2
          });
        }
      });
      
      setChats(transformedChats);
    } catch (err) {
      console.error('Error loading chats:', err);
      setChats([]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    chats,
    isLoading,
    refreshChats
  };
};

// Hook for managing documents
export const useDocuments = (user: User | null) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      refreshDocuments();
    }
  }, [user]);

  const refreshDocuments = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      console.log('Fetching documents via session-based API...');
      
      // First, get all user sessions
      const sessionsResponse = await sessionsApi.getUserSessions();
      const sessions = (sessionsResponse.data as any)?.sessions || [];
      
      console.log('User sessions:', sessions);
      
      // Get documents from all sessions
      const allDocuments: Document[] = [];
      
      for (const session of sessions) {
        // Check if session has a valid id
        const sessionId = session.id;
        if (!sessionId || sessionId === 'undefined') {
          console.warn('Skipping session with invalid ID:', session);
          continue;
        }
        
        try {
          // Get documents for each session
          const sessionDocsResponse = await sessionsApi.getSessionDocuments(sessionId);
          const sessionDocs = (sessionDocsResponse.data as any)?.documents || [];
          
          console.log(`Documents for session ${sessionId}:`, sessionDocs);
          
          // Transform and add to collection
          const transformedDocs: Document[] = sessionDocs.map((doc: any) => ({
            id: doc.id || doc.document_id,
            filename: doc.filename || doc.name,
            storage_path: doc.storage_path || '',
            upload_date: doc.upload_date || doc.created_at,
            created_at: doc.created_at || new Date().toISOString(),
            updated_at: doc.updated_at || doc.created_at || new Date().toISOString(),
            user_id: user.id,
            title: doc.filename || doc.name,
            content_type: 'application/pdf',
            storage_path_supabase: doc.storage_path || '',
            storage_path_s3: doc.storage_path || '',
            status: doc.status || 'stored'
          }));
          
          // Add to collection (avoid duplicates)
          transformedDocs.forEach(doc => {
            if (!allDocuments.find(existing => existing.id === doc.id)) {
              allDocuments.push(doc);
            }
          });
          
        } catch (sessionError) {
          console.warn(`Failed to get documents for session ${sessionId}:`, sessionError);
          // Continue with other sessions
        }
      }
      
      console.log('All documents from sessions:', allDocuments);
      setDocuments(allDocuments);
    } catch (err) {
      console.error('Error loading documents via sessions:', err);
      setDocuments([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  return {
    documents,
    isLoading,
    refreshDocuments
  };
};
