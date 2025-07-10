import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, TABLES } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

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

// Hook for managing conversations
export const useConversations = (user: User | null) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load conversations for user
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.SESSIONS)
        .select(`
          *,
          document_sessions (
            document_id,
            documents (
              id,
              filename
            )
          )
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match expected format
      const transformedConversations: Conversation[] = (data || []).map(session => ({
        ...session,
        title: session.name, // Map name to title for compatibility
        last_updated: session.updated_at, // Map updated_at to last_updated for compatibility
        document_uuid: session.document_sessions?.map((ds: any) => ds.document_id) || [] // Extract document IDs from junction table
      }));
      
      setConversations(transformedConversations);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createConversation = async (title: string, documentIds: string[] = []) => {
    if (!user) throw new Error('User not authenticated');
    
    const newConversation = {
      id: uuidv4(),
      name: title, // Use name instead of title
      user_id: user.id
    };
    
    try {
      const { data, error } = await supabase
        .from(TABLES.SESSIONS)
        .insert(newConversation)
        .select()
        .single();

      if (error) throw error;
      
      // If documentIds are provided, create document_sessions entries
      if (documentIds.length > 0) {
        const documentSessionEntries = documentIds.map(docId => ({
          id: uuidv4(),
          document_id: docId,
          session_id: data.id
        }));
        
        await supabase
          .from(TABLES.DOCUMENT_SESSIONS)
          .insert(documentSessionEntries);
      }
      
      // Refresh conversations list
      await loadConversations();
      
      // Return data with compatibility fields
      return {
        ...data,
        title: data.name,
        last_updated: data.updated_at,
        document_uuid: documentIds
      } as Conversation;
    } catch (err) {
      console.error('Error creating conversation:', err);
      throw err;
    }
  };

  const updateConversation = async (conversationId: string, updates: Partial<Conversation>) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      // Transform updates to match database schema
      const dbUpdates: any = {};
      
      if (updates.title) {
        dbUpdates.name = updates.title;
      }
      if (updates.name) {
        dbUpdates.name = updates.name;
      }
      
      // Handle document_uuid updates by managing document_sessions
      if (updates.document_uuid !== undefined) {
        // First, remove all existing document_sessions for this session
        await supabase
          .from(TABLES.DOCUMENT_SESSIONS)
          .delete()
          .eq('session_id', conversationId);
          
        // Then, add new document_sessions
        if (updates.document_uuid.length > 0) {
          const documentSessionEntries = updates.document_uuid.map(docId => ({
            id: uuidv4(),
            document_id: docId,
            session_id: conversationId
          }));
          
          await supabase
            .from(TABLES.DOCUMENT_SESSIONS)
            .insert(documentSessionEntries);
        }
      }
      
      // Update the session if there are direct field updates
      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase
          .from(TABLES.SESSIONS)
          .update(dbUpdates)
          .eq('id', conversationId)
          .eq('user_id', user.id);

        if (error) throw error;
      }
      
      // Refresh conversations list
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
      // First delete associated chat messages
      const { error: chatError } = await supabase
        .from(TABLES.CHAT_LOGS)
        .delete()
        .eq('session_id', conversationId);

      if (chatError) throw chatError;
      
      // Delete document_sessions associations
      const { error: docSessionError } = await supabase
        .from(TABLES.DOCUMENT_SESSIONS)
        .delete()
        .eq('session_id', conversationId);
        
      if (docSessionError) throw docSessionError;
      
      // Then delete the conversation/session
      const { error } = await supabase
        .from(TABLES.SESSIONS)
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
      
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
    if (!conversationId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.CHAT_LOGS)
        .select('*')
        .eq('session_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Transform chat_logs data to match expected format
      const transformedChats: ChatMessage[] = [];
      
      (data || []).forEach((chatLog, index) => {
        // Add user message
        transformedChats.push({
          ...chatLog,
          id: `${chatLog.id}-user`,
          conversation_id: chatLog.session_id,
          role: 'user',
          content: chatLog.prompt,
          step: (index * 2) + 1
        });
        
        // Add assistant message
        transformedChats.push({
          ...chatLog,
          id: `${chatLog.id}-assistant`,
          conversation_id: chatLog.session_id,
          role: 'assistant',
          content: chatLog.response,
          step: (index * 2) + 2
        });
      });
      
      setChats(transformedChats);
    } catch (err) {
      console.error('Error loading chats:', err);
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
      console.log('Fetching documents from database...');
      // In FinalRag schema, documents are global, not user-specific
      const { data, error } = await supabase
        .from(TABLES.DOCUMENTS)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }
      
      console.log('Raw documents from database:', data);
      
      // Transform documents data to match expected format
      const transformedDocuments: Document[] = (data || []).map(doc => ({
        ...doc,
        user_id: user.id, // Add user_id for compatibility
        title: doc.filename, // Map filename to title for compatibility
        content_type: 'application/pdf', // Default content type
        storage_path_supabase: doc.storage_path,
        storage_path_s3: doc.storage_path,
        status: 'stored'
      }));
      
      console.log('Transformed documents:', transformedDocuments);
      setDocuments(transformedDocuments);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadDocument = async (file: File, processContent: boolean = true) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      console.log('Starting document upload for file:', file.name);
      
      // Generate a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${uuidv4()}.${fileExt}`;
      
      console.log('Generated filename:', fileName);
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }
      
      console.log('File uploaded to storage successfully');
      
      // Create document record
      const documentData = {
        id: uuidv4(),
        filename: file.name,
        storage_path: fileName
      };
      
      console.log('Creating document record:', documentData);
      
      const { data, error } = await supabase
        .from(TABLES.DOCUMENTS)
        .insert(documentData)
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }
      
      console.log('Document record created:', data);
      
      // Refresh document list
      await refreshDocuments();
      
      // Return data with compatibility fields
      const result = {
        ...data,
        user_id: user.id,
        title: data.filename,
        content_type: file.type,
        storage_path_supabase: data.storage_path,
        storage_path_s3: data.storage_path,
        status: processContent ? 'processing' : 'stored'
      } as Document;
      
      console.log('Upload completed, returning:', result);
      
      return result;
    } catch (err) {
      console.error('Error uploading document:', err);
      throw err;
    }
  };

  return {
    documents,
    isLoading,
    refreshDocuments,
    uploadDocument
  };
};
