import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { supabase } from '../lib/supabase';

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 120000, // 2 minutes timeout for API processing
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && config.headers) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      console.error('Error getting session for API request:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.error('Unauthorized access - redirecting to login');
      // You can add redirect logic here if needed
    }
    return Promise.reject(error);
  }
);

// Helper function to get user ID from Supabase
const getUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

import { Message, UploadedFile } from '../types';

// Response interfaces
interface SessionResponse {
  data: SessionData[];
  status: number;
  statusText: string;
}

interface SessionData {
  session_id: string;
  user_id: string;
  created_at: string;
  name?: string;
}

interface DocumentUploadResponse {
  message: string;
  doc_id: string;
  session_id: string;
  filename: string;
  status: string;
  status_check_url: string;
}

interface SingleSessionResponse {
  data: SessionData;
  status: number;
  statusText: string;
}

interface MessagesResponse {
  data: Message[];
  status: number;
  statusText: string;
}

interface DocumentsResponse {
  data: DocumentUploadResponse | UploadedFile[];
  status: number;
  statusText: string;
}

interface QueryResponse {
  data: {
    status: string;
    session_id: string;
    original_query: string;
    enriched_query: string;
    retrieved_chunks: string;
    masked_chunks: string;
    response: string;
    retrieved_metadata: any[];
    processed_docs: string[];
    chat_log_id?: string;
    warning?: string;
  };
  status: number;
  statusText: string;
}

interface SessionCreateParams {
  name?: string; // Optional name parameter
}

// Sessions API
export const sessionsApi = {
  // Create a new session
  createSession: async (params?: SessionCreateParams): Promise<SingleSessionResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    try {
      // Create payload with user_id and optional name
      const payload = {
        user_id: userId,
        ...(params?.name && { name: params.name }) // Only include name if provided
      };
      
      const response = await api.post('/sessions', payload); // No trailing slash to match backend
      return response;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  },

  // Get all sessions for current user
  getUserSessions: async (): Promise<SessionResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    try {
      const response = await api.get(`/sessions/${userId}`);
      return response;
    } catch (error) {
      console.error('Failed to get user sessions:', error);
      throw error;
    }
  },

  // Get chat history for a session
  getChatHistory: async (sessionId: string): Promise<MessagesResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    // Validate sessionId
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      throw new Error('Invalid session ID provided');
    }
    
    try {
      const response = await api.get(`/sessions/${sessionId}/chat-history?user_id=${userId}`);
      return response;
    } catch (error) {
      console.error('Failed to get chat history:', error);
      throw error;
    }
  },

  // Get documents for a session
  getSessionDocuments: async (sessionId: string): Promise<DocumentsResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    // Validate sessionId
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      throw new Error('Invalid session ID provided');
    }
    
    const response = await api.get(`/sessions/${sessionId}/documents?user_id=${userId}`);
    return response;
  },

  // Link document to session
  linkDocumentToSession: async (sessionId: string, documentId: string): Promise<any> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.post(`/sessions/${sessionId}/link-document?document_id=${documentId}&user_id=${userId}`);
    return response;
  },

  // Save chat log entry
  saveChatLog: async (sessionId: string, prompt: string = "", response: string = ""): Promise<any> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response_data = await api.post(`/sessions/${sessionId}/chat-log`, {
      user_id: userId,
      prompt,
      response
    });
    return response_data;
  },

  // Save only user prompt
  saveUserMessage: async (sessionId: string, prompt: string): Promise<any> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.post(`/sessions/${sessionId}/chat-log`, {
      user_id: userId,
      prompt,
      response: ""
    });
    return response;
  },

  // Save only AI response
  saveAIResponse: async (sessionId: string, response: string): Promise<any> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response_data = await api.post(`/sessions/${sessionId}/chat-log`, {
      user_id: userId,
      prompt: "",
      response
    });
    return response_data;
  },

  // Delete session
  deleteSession: async (sessionId: string): Promise<any> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.delete(`/sessions/${sessionId}?user_id=${userId}`);
    return response;
  },

  // Get all sessions for current user
  getSessions: async (): Promise<SessionResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.get(`/sessions/${userId}`);
    return response;
  },
  
  // Unlink document from session
  unlinkDocumentFromSession: async (sessionId: string, documentId: string, userId: string): Promise<any> => {
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.delete(`/sessions/${sessionId}/unlink-document?document_id=${documentId}&user_id=${userId}`);
    return response;
  },

  // Get chat history for a session
  getSessionMessages: async (sessionId: string): Promise<MessagesResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.get(`/sessions/${sessionId}/chat-history?user_id=${userId}`);
    return response;
  }
};

interface DocumentStatusResponse {
  status: string;
  progress?: number;
  message?: string;
}

// Documents API
export const documentsApi = {
  // Upload document
  uploadDocument: async (file: File, sessionId: string): Promise<DocumentsResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    // Create formData with parameters in the order expected by backend
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);
    formData.append('session_id', sessionId);
    
    console.log('Uploading document with session_id:', sessionId);
    
    try {
      const response = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response;
    } catch (error) {
      console.error('Failed to upload document:', error);
      throw error;
    }
  },

  // Get document status
  getDocumentStatus: async (documentId: string): Promise<DocumentStatusResponse> => {
    const response = await api.get(`/documents/${documentId}/status`);
    return response.data;
  },

  // Get user documents
  getUserDocuments: async (): Promise<DocumentsResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.get(`/documents/user/${userId}`);
    return response;
  },

  // Delete document
  deleteDocument: async (documentId: string): Promise<any> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.delete(`/documents/${documentId}?user_id=${userId}`);
    return response;
  },

  // Get all documents for current user
  getAllDocuments: async (): Promise<DocumentsResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.get(`/documents/user/${userId}`);
    return response;
  },

  // Upload documents
  uploadDocuments: async (formData: FormData): Promise<any> => {
    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  },

  // Verify document IDs before sending a query
  verifyDocumentIds: async (docIds: string[]): Promise<string[]> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    // Array to store valid document IDs
    const validDocIds: string[] = [];
    
    // Check each document ID
    for (const docId of docIds) {
      try {
        // Try to get the document status using the user_id/doc_id endpoint
        const response = await api.get(`/documents/${userId}/${docId}/status`);
        // If successful (no error thrown), add to valid IDs
        if (response.data && response.data.is_ready) {
          validDocIds.push(docId);
        } else if (response.data) {
          // Document exists but is not ready
          console.log(`Document ${docId} found but not ready (status: ${response.data.status})`);
        }
      } catch (error) {
        console.log(`Document ${docId} not found or not ready, skipping`);
        // Skip this document ID
      }
    }
    
    console.log(`Verified ${validDocIds.length} out of ${docIds.length} document IDs as valid`);
    return validDocIds;
  },
};

interface QueryRequest {
  query: string;
  session_id: string;
  user_id?: string;
  document_ids?: string[];
  doc_ids?: string[];
  k?: number;
}


// Query API
export const queryApi = {
  // Process query
  processQuery: async (query: string, sessionId: string, documentIds: string[] = [], k = 4): Promise<QueryResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.post('/query/', {
      query,
      user_id: userId,
      session_id: sessionId,
      doc_ids: documentIds,
      k
    });
    return response;
  },

  // Submit query to RAG API
  submitQuery: async (request: QueryRequest): Promise<QueryResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    try {
      // Deduplicate document IDs first
      const uniqueDocIds = Array.from(new Set(request.doc_ids || []));
      
      // Verify document IDs exist on the server
      const validDocIds = await documentsApi.verifyDocumentIds(uniqueDocIds);
      
      // Always allow queries even with no documents (for general questions)
      console.log(`Query validation: ${validDocIds.length} valid documents out of ${uniqueDocIds.length} requested`);
      
      // Create a properly structured payload matching Postman's successful format
      // Parameter order matters: query, user_id, session_id, doc_ids, k
      const payload = {
        query: request.query,
        user_id: userId,
        session_id: request.session_id,
        doc_ids: validDocIds, // Use valid document IDs (may be empty array)
        k: request.k || 4
      };
      
      console.log('Sending query to API endpoint: /query', {
        userId: payload.user_id,
        sessionId: payload.session_id,
        docIds: payload.doc_ids.length,
        queryLength: payload.query?.length || 0
      });
      
      const startTime = Date.now();
      const response = await api.post('/query', payload); // Remove trailing slash to match Postman
      const elapsedTime = Date.now() - startTime;
      
      console.log(`Query API response received in ${elapsedTime}ms`, { 
        status: response.status,
        statusText: response.statusText,
        hasResponse: !!response.data?.response 
      });
      
      return response;
    } catch (error: any) {
      console.error('Query API error:', error);
      if (error.response) {
        // Check if error is related to API rate limiting or quota
        const errorDetail = error.response.data?.detail || '';
        if (errorDetail.includes('quota') || 
            errorDetail.includes('rate limit') || 
            errorDetail.includes('429') ||
            errorDetail.includes('exceeded')) {
          // Create a more user-friendly error for rate limiting
          const quotaError = new Error('AI service quota exceeded. Please try again later or contact support.');
          quotaError.name = 'QuotaExceededError';
          throw quotaError;
        }
      }
      throw error;
    }
  }
};

interface HealthResponse {
  status: string;
  version?: string;
  uptime?: number;
}

// Health check
export const healthApi = {
  check: async (): Promise<HealthResponse> => {
    // Use a simple GET request without authentication for health check
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    console.log('Health check using baseURL:', baseUrl);
    
    try {
      const response = await axios.get(`${baseUrl}/health`);
      console.log('Health check response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }
};

// Document URL generation API calls
export const documentsUrlApi = {
  // Get signed URL for a specific document
  getDocumentUrl: async (docId: string): Promise<{ data: { url: string; filename: string; expires_in: number } }> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.get(`/documents/${userId}/${docId}/url`);
    return response;
  },

  // Get signed URLs for all documents in a session
  getAllDocumentUrls: async (sessionId?: string): Promise<{ data: { urls: Record<string, { url: string; filename: string; expires_in: number }> } }> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const params = sessionId ? `?session_id=${sessionId}` : '';
    const response = await api.get(`/documents/${userId}/urls${params}`);
    return response;
  }
};

export default api;
