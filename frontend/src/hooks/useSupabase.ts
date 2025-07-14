import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { sessionsApi, documentsApi } from '../services/api';

// Define types for our data based on the actual FinalRag schema
export interface Conversation {
  id: string;               // Primary identifier (uses session.id)
  name: string;             // Session name
  user_id: string;          // User who owns this conversation
  created_at: string;       // Creation timestamp
  updated_at: string;       // Last update timestamp
  // Virtual fields for compatibility with Dashboard
  title?: string;           // Alias for name
  last_updated?: string;    // Alias for updated_at
  document_uuid?: string[]; // Associated document IDs
}

export interface ChatMessage {
  id: string;               // Primary identifier
  session_id: string;       // Session this message belongs to
  prompt: string;           // User input
  response: string;         // AI response
  created_at: string;       // Creation timestamp
  // Virtual fields for compatibility with Dashboard
  conversation_id?: string; // Alias for session_id
  role?: 'user' | 'assistant'; // Message sender
  content?: string;         // Alias for prompt or response
  step?: number;            // Ordering within conversation
}

export interface Document {
  id: string;               // Primary identifier
  filename: string;         // Original file name
  storage_path: string;     // Path to stored file
  upload_date: string;      // Date uploaded
  created_at: string;       // Creation timestamp
  updated_at: string;       // Last update timestamp
  // Virtual fields for compatibility with Dashboard
  user_id?: string;         // User who uploaded the document
  title?: string;           // Display name (defaults to filename)
  content_type?: string;    // MIME type of document
  storage_path_supabase?: string; // Legacy path in Supabase storage
  storage_path_s3?: string;       // Path in S3 or other storage
  metadata?: any;           // Additional document metadata
  status?: string;          // Processing status
}

export interface DocumentSession {
  id: string;               // Primary identifier for the link
  document_id: string;      // Document ID
  session_id: string;       // Session ID
  created_at: string;       // When the link was created
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
      console.log('Loading conversations via FinalRag API...');
      // Use the FinalRag API to get user sessions
      const response = await sessionsApi.getUserSessions();
      const sessions = (response.data as any)?.sessions || response.data || [];
      
      // Transform sessions to match expected conversation format
      let transformedConversations: Conversation[] = sessions
        .filter((session: any) => session.id && session.id !== 'undefined') // Use 'id' instead of 'session_id'
        .map((session: any) => ({
          id: session.id, // Use session.id directly
          name: session.name || 'Unnamed Session',
          user_id: session.user_id,
          created_at: session.created_at,
          updated_at: session.updated_at || session.created_at,
          title: session.name || 'Unnamed Session',
          last_updated: session.updated_at || session.created_at,
          document_uuid: [] // Will be populated by separate API call below
        }));
      
      // For each conversation/session, fetch associated document IDs
      for (let i = 0; i < transformedConversations.length; i++) {
        const conversation = transformedConversations[i];
        try {
          // Get documents for this session
          const docsResponse = await sessionsApi.getSessionDocuments(conversation.id);
          const docs = (docsResponse.data as any)?.documents || [];
          
          // Extract document IDs and update conversation
          const docIds = docs.map((doc: any) => doc.id);
          transformedConversations[i] = {
            ...conversation,
            document_uuid: docIds
          };
          console.log(`Loaded ${docIds.length} document IDs for conversation ${conversation.id}:`, docIds);
        } catch (docErr) {
          console.error(`Error fetching documents for session ${conversation.id}:`, docErr);
          // Keep empty document_uuid array if there's an error
        }
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
      
      // Get session ID from response - session_id is used by the API response
      const sessionId = data.session_id || '';
      if (!sessionId) {
        console.error('Failed to get session_id from API response:', data);
        throw new Error('Invalid session ID in API response');
      }
      
      // Link documents if provided
      if (documentIds.length > 0) {
        try {
          console.log(`Linking ${documentIds.length} documents to session ${sessionId}`);
          // For each document ID, call the API to link the document to the session
          for (const docId of documentIds) {
            // Note that the API expects (sessionId, documentId) order
            await sessionsApi.linkDocumentToSession(sessionId, docId);
          }
        } catch (linkErr) {
          console.error('Error linking documents to session:', linkErr);
          // Continue even if document linking fails
        }
      }
      
      // Refresh conversations list
      await loadConversations();
      
      // Return data with compatibility fields
      const conversation: Conversation = {
        id: sessionId,
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
    if (!conversationId || conversationId === 'undefined') {
      throw new Error('Invalid conversation ID');
    }
    
    try {
      console.log('Updating conversation:', conversationId, updates);
      
      // Handle document linking/unlinking if document_uuid has changed
      if (updates.document_uuid) {
        // Get current conversation to compare documents
        const currentConversation = conversations.find(c => c.id === conversationId);
        
        if (currentConversation) {
          const currentDocIds = currentConversation.document_uuid || [];
          const newDocIds = updates.document_uuid || [];
          
          // Find documents to add (in newDocIds but not in currentDocIds)
          const docsToAdd = newDocIds.filter(id => !currentDocIds.includes(id));
          
          // Find documents to remove (in currentDocIds but not in newDocIds)
          const docsToRemove = currentDocIds.filter(id => !newDocIds.includes(id));
          
          // Add new document links
          for (const docId of docsToAdd) {
            try {
              await sessionsApi.linkDocumentToSession(conversationId, docId);
              console.log(`Linked document ${docId} to conversation ${conversationId}`);
            } catch (linkErr) {
              console.error(`Error linking document ${docId}:`, linkErr);
            }
          }
          
          // Remove old document links
          for (const docId of docsToRemove) {
            try {
              // Get user ID from the current user
              const userId = user.id;
              await sessionsApi.unlinkDocumentFromSession(conversationId, docId, userId);
              console.log(`Unlinked document ${docId} from conversation ${conversationId}`);
            } catch (unlinkErr) {
              console.error(`Error unlinking document ${docId}:`, unlinkErr);
            }
          }
        }
      }
      
      // Name update could be implemented here if API supports it
      if (updates.name || updates.title) {
        // TODO: When backend supports session name updates, implement that here
        console.log('Session name update not implemented in backend API yet');
      }
      
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
    if (!conversationId || conversationId === 'undefined') {
      throw new Error('Invalid conversation ID');
    }
    
    try {
      console.log('Deleting conversation:', conversationId);
      
      // Use the sessions API to delete the session
      await sessionsApi.deleteSession(conversationId);
      console.log(`Deleted conversation ${conversationId}`);
      
      // Refresh conversations list to get updated state
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
      console.log(`Refreshing chats for conversation: ${conversationId}`);
      
      // Use backend API to get chat history
      const response = await sessionsApi.getChatHistory(conversationId);
      const chatHistory = (response.data as any)?.chat_history || [];
      
      console.log(`Received ${chatHistory.length} chat messages for conversation ${conversationId}`);
      
      // Transform chat history data to match expected format
      const transformedChats: ChatMessage[] = [];
      
      chatHistory.forEach((chatLog: any, index: number) => {
        if (!chatLog.id) {
          console.warn('Chat message missing ID:', chatLog);
          return; // Skip messages without IDs
        }
        
        // Check if this is a user message (has prompt but no response)
        if (chatLog.prompt && chatLog.prompt.trim() && (!chatLog.response || !chatLog.response.trim())) {
          transformedChats.push({
            ...chatLog,
            id: `${chatLog.id}-user`,
            conversation_id: chatLog.session_id,
            role: 'user',
            content: chatLog.prompt,
            step: index + 1
          });
        }
        
        // Check if this is an AI response (has response but no prompt)
        if (chatLog.response && chatLog.response.trim() && (!chatLog.prompt || !chatLog.prompt.trim())) {
          transformedChats.push({
            ...chatLog,
            id: `${chatLog.id}-assistant`,
            conversation_id: chatLog.session_id,
            role: 'assistant',
            content: chatLog.response,
            step: index + 1
          });
        }
        
        // Legacy support: if both prompt and response exist in the same row (old format)
        if (chatLog.prompt && chatLog.prompt.trim() && chatLog.response && chatLog.response.trim()) {
          transformedChats.push({
            ...chatLog,
            id: `${chatLog.id}-user`,
            conversation_id: chatLog.session_id,
            role: 'user',
            content: chatLog.prompt,
            step: (index * 2) + 1
          });
          
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
      
      console.log(`Transformed ${transformedChats.length} chat messages for UI`);
      setChats(transformedChats);
    } catch (err) {
      console.error(`Error loading chats for conversation ${conversationId}:`, err);
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

  const uploadDocument = async (file: File, sessionId: string) => {
    if (!user) throw new Error('User not authenticated');
    if (!sessionId || sessionId === 'undefined') {
      throw new Error('Invalid session ID for document upload');
    }
    
    try {
      console.log(`Starting document upload for file: ${file.name} to session: ${sessionId}`);
      
      // Use the backend API to upload the document
      console.log('Uploading document via API...');
      const response = await documentsApi.uploadDocument(file, sessionId);
      const uploadResult = response.data as any;
      
      console.log('Document upload response:', uploadResult);
      
      // Check if document was successfully uploaded and linked to session
      if (!uploadResult.doc_id) {
        throw new Error('No document ID returned from upload');
      }
      
      // The session-document linking is handled by the backend during upload
      // when sessionId is provided, so no need for a separate linkDocumentToSession call
      
      // Refresh document list to get latest data
      await refreshDocuments();
      
      // Return data with compatibility fields
      const result = {
        id: uploadResult.doc_id,
        filename: uploadResult.filename,
        storage_path: uploadResult.filename, // Backend stores the path
        upload_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: user.id,
        title: uploadResult.filename,
        content_type: file.type || 'application/pdf',
        storage_path_supabase: uploadResult.filename,
        storage_path_s3: uploadResult.filename,
        status: uploadResult.status || 'processing'
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
