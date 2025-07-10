import { User as SupabaseUser } from '@supabase/supabase-js';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  lastMessage: Date;
  document_uuid?: string[];
}

export interface UploadedFile {
  id: string;
  name: string;
  filename?: string; // Add alias for backward compatibility
  type: string;
  size: number;
  s3Url: string;
  uploadDate: Date;
  status?: 'completed' | 'processing' | 'uploading' | 'failed' | string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
}

export interface SidebarProps {
  user: SupabaseUser;
  onLogout: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  chats: Chat[];
  currentChat: Chat | null;
  filteredFiles: UploadedFile[];
  selectedDocument: UploadedFile | null;
  selectedDocumentsForAnalysis: string[];
  currentConversationId: string | null;
  createNewChat: () => void;
  switchToChat: (chat: Chat) => void;
  deleteChat: (chatId: string) => void;
  viewDocument: (file: UploadedFile) => void;
  setSelectedDocument: (file: UploadedFile | null) => void;
  toggleDocumentForAnalysis: (fileId: string) => void;
  deleteDocument: (documentId: string) => void;
}

export interface ActivityLogProps {
  currentSessionId: string | null;
  sessions: any[];
}

export interface DocumentViewerProps {
  file: UploadedFile;
  onClose: () => void;
  availableFiles: UploadedFile[];
  onFileChange: (file: UploadedFile) => void;
}

export interface AuthProps {
  onLogin?: () => void;
}

export interface DashboardProps {
  user: SupabaseUser | null;
  onLogout: () => void;
}
