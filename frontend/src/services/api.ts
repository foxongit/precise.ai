import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { supabase } from '../lib/supabase';

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000, // 30 seconds timeout
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
  name: string;
  created_at: string;
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
  data: UploadedFile[];
  status: number;
  statusText: string;
}

interface QueryResponse {
  data: {
    id: string;
    answer: string;
    context?: string[];
    source_documents?: string[];
  };
  status: number;
  statusText: string;
}

interface SessionCreateParams {
  name: string;
}

// Sessions API
export const sessionsApi = {
  // Create a new session
  createSession: async (params: SessionCreateParams): Promise<SingleSessionResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.post('/sessions/', {
      user_id: userId,
      name: params.name || 'New Chat'
    });
    return response;
  },

  // Get all sessions for current user
  getUserSessions: async (): Promise<SessionResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.get(`/sessions/${userId}`);
    return response;
  },

  // Get chat history for a session
  getChatHistory: async (sessionId: string): Promise<MessagesResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.get(`/sessions/${sessionId}/chat-history?user_id=${userId}`);
    return response;
  },

  // Get documents for a session
  getSessionDocuments: async (sessionId: string): Promise<DocumentsResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
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

  // Delete session
  deleteSession: async (sessionId: string): Promise<any> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.delete(`/sessions/${sessionId}?user_id=${userId}`);
    return response;
  },

  // Added to match Dashboard.tsx usage
  getSessions: async (): Promise<SessionResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.get(`/sessions/${userId}`);
    return response;
  },

  // Added to match Dashboard.tsx usage
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
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);
    formData.append('session_id', sessionId);
    
    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
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

  // Added to match Dashboard.tsx usage
  getAllDocuments: async (): Promise<DocumentsResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.get(`/documents/user/${userId}`);
    return response;
  },

  // Added to match Dashboard.tsx usage
  uploadDocuments: async (formData: FormData): Promise<any> => {
    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  }
};

interface QueryRequest {
  query: string;
  session_id: string;
  user_id?: string;
  document_ids?: string[]; // Match Dashboard.tsx usage
  doc_ids?: string[];      // Alternative property name
  k?: number;
}

interface QueryResponseData {
  id: string;
  answer: string;
  context?: string[];
  source_documents?: string[];
}

// Query API
export const queryApi = {
  // Process query
  processQuery: async (query: string, sessionId: string, documentIds: string[] = [], k = 4): Promise<QueryResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await api.post('/query/', {
      query,
      session_id: sessionId,
      user_id: userId,
      doc_ids: documentIds,
      k
    });
    return response;
  },

  // Added to match Dashboard.tsx usage
  submitQuery: async (request: QueryRequest): Promise<QueryResponse> => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    request.user_id = userId;
    // Handle both document_ids and doc_ids for flexibility
    if (request.document_ids && !request.doc_ids) {
      request.doc_ids = request.document_ids;
    }
    const response = await api.post('/query/', request);
    return response;
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
    const response = await api.get('/health');
    return response.data;
  }
};

export default api;
