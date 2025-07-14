import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Paperclip, Send, ChevronDown, Upload, Eye, EyeOff } from 'lucide-react';
import type { User } from '@supabase/supabase-js'; // Keep for type definitions only
// @ts-ignore - TypeScript can't find these modules, but they exist
import { useConversations, useChats, useDocuments, Conversation, Document } from '../hooks/useSupabase';
import { queryApi, healthApi, documentsApi, sessionsApi } from '../services/api';
import Sidebar from './Sidebar';
import DocumentViewer from './DocumentViewer';
import ActivityLog from './ActivityLog';

// Define interfaces
interface DashboardProps {
  user: User;
  onLogout: () => void;
}

// Legacy UI types for compatibility
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  lastMessage: Date;
  document_uuid?: string[];
}

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  s3Url: string;
  uploadDate: Date;
}

// Main Chat Interface Component
export default function Dashboard({ user, onLogout }: DashboardProps) {
  // Supabase hooks
  const { 
    conversations, 
    createConversation, 
    updateConversation, 
    deleteConversation,
    loadConversations  // Add loadConversations to our destructuring
  } = useConversations(user);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const { chats: supabaseChats, refreshChats } = useChats(currentConversationId);
  const { documents, refreshDocuments } = useDocuments(user);

  // UI state
  const [inputValue, setInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<UploadedFile | null>(null);
  const [splitPosition, setSplitPosition] = useState(60);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedDocumentsForAnalysis, setSelectedDocumentsForAnalysis] = useState<string[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activityLogPosition, setActivityLogPosition] = useState(70);
  const [documentActivitySplit, setDocumentActivitySplit] = useState(60);
  const [isResizingActivityLog, setIsResizingActivityLog] = useState(false);
  
  // Document URL state
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [isGeneratingUrls, setIsGeneratingUrls] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  
  // Convert Supabase data to UI format for compatibility with existing components
  const chats: Chat[] = conversations
    .filter(conv => conv.id && conv.id !== 'undefined') // Filter out invalid conversations
    .map(conv => ({
      id: conv.id,
      title: conv.title || conv.name || 'Untitled Chat',
      messages: supabaseChats
        .filter(chat => chat.conversation_id === conv.id)
        .sort((a, b) => {
          // Primary sort by step, fallback to timestamp for reliability
          if ((a.step || 0) !== (b.step || 0)) {
            return (a.step || 0) - (b.step || 0);
          }
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        })
        .map(chat => ({
          id: chat.id,
          content: chat.content || '',
          sender: chat.role === 'user' ? 'user' : 'ai' as const,
          timestamp: new Date(chat.created_at)
        })),
      lastMessage: new Date(conv.last_updated || conv.updated_at || conv.created_at),
      document_uuid: conv.document_uuid || []
    }));

  const currentChat = chats.find(chat => chat.id === currentConversationId) || null;

  // Convert documents to UploadedFile format for compatibility using useMemo
  const uploadedFiles: UploadedFile[] = useMemo(() => {
    if (!currentChat || !currentChat.document_uuid || currentChat.document_uuid.length === 0) {
      return [];
    }
    
    return documents
      .filter(doc => currentChat.document_uuid!.includes(doc.id))
      .map(doc => ({
        id: doc.id,
        name: doc.title || doc.filename,
        type: doc.content_type || 'unknown',
        size: 0,
        s3Url: doc.storage_path_s3 || doc.storage_path || '',
        uploadDate: new Date(doc.created_at)
      }))
      .sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime()); // Sort by upload date, newest first
  }, [currentChat, documents]);

  // Backend availability check
  const [isBackendAvailable, setIsBackendAvailable] = useState(true);

  // State for document URLs

  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        await healthApi.check();
        setIsBackendAvailable(true);
      } catch (error) {
        console.warn('Backend health check failed:', error);
        setIsBackendAvailable(false);
      }
    };

    checkBackendHealth();
    // Check every 30 seconds
    const interval = setInterval(checkBackendHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Effect to generate signed URLs for documents
  useEffect(() => {
    const generateDocumentUrls = async () => {
      if (uploadedFiles.length === 0) {
        setDocumentUrls({});
        return;
      }
      
      setIsGeneratingUrls(true);
      console.log('Generating URLs for documents:', uploadedFiles.map(f => f.name));
      
      try {
        // TODO: Use backend API to generate signed URLs for documents
        // For now, we'll use placeholder URLs
        console.log('Backend API endpoint for document URLs needs to be implemented');
        
        // Create placeholder URLs
        const urlMap = uploadedFiles.reduce((acc, file) => {
          // Placeholder URL pattern - in production, this would be a real signed URL from backend
          acc[file.id] = `/api/documents/view/${file.id}`;
          return acc;
        }, {} as Record<string, string>);

        console.log(`Generated ${Object.keys(urlMap).length} placeholder document URLs`);
        setDocumentUrls(urlMap);
      } finally {
        setIsGeneratingUrls(false);
      }
    };

    // Check if we need to generate URLs (when uploadedFiles changes or when URLs are missing)
    const needsUrlGeneration = uploadedFiles.some(file => !documentUrls[file.id]);
    
    if (uploadedFiles.length > 0 && needsUrlGeneration && !isGeneratingUrls) {
      generateDocumentUrls();
    }
  }, [uploadedFiles, isGeneratingUrls]); // Remove documents dependency since we're not using it

  // Enhanced function to get documents with URLs using useMemo
  const documentsWithUrls = useMemo((): UploadedFile[] => {
    return uploadedFiles.map(file => {
      const url = documentUrls[file.id];
      return {
        ...file,
        s3Url: url || ''
      };
    });
  }, [uploadedFiles, documentUrls]);

  const filteredFiles = documentsWithUrls.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingActivityLog || !splitRef.current) return;
      
      e.preventDefault();
      const containerRect = splitRef.current.getBoundingClientRect();
      
      if (selectedDocument) {
        // When document viewer is open, activity log is within the document viewer area
        const documentViewerRect = {
          left: containerRect.left + (containerRect.width * splitPosition / 100),
          right: containerRect.right,
          top: containerRect.top,
          bottom: containerRect.bottom
        };
        const newPosition = ((documentViewerRect.bottom - e.clientY) / (documentViewerRect.bottom - documentViewerRect.top)) * 100;
        setDocumentActivitySplit(Math.max(20, Math.min(80, newPosition)));
      } else {
        // When no document viewer, activity log takes right portion of main area
        const newPosition = ((containerRect.right - e.clientX) / containerRect.width) * 100;
        setActivityLogPosition(Math.max(15, Math.min(75, newPosition)));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsResizingActivityLog(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
    };

    if (isResizingActivityLog) {
      document.body.style.cursor = selectedDocument ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
      document.body.style.pointerEvents = 'none';
      
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (isResizingActivityLog) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';
      }
    };
  }, [isResizingActivityLog, selectedDocument, splitPosition]);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !splitRef.current) return;
      
      e.preventDefault();
      const containerRect = splitRef.current.getBoundingClientRect();
      const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // VS Code-like smooth constraints
      const clampedPosition = Math.max(15, Math.min(85, newPosition));
      setSplitPosition(clampedPosition);
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.body.style.pointerEvents = 'none';
      
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (isResizing) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';
      }
    };
  }, [isResizing]);

  // Utility functions
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const viewDocument = (file: UploadedFile) => {
    setSelectedDocument(file);
  };

  const closeDocumentViewer = () => {
    setSelectedDocument(null);
  };
  
  const toggleDocumentForAnalysis = (fileId: string) => {
    setSelectedDocumentsForAnalysis(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : Array.from(new Set([...prev, fileId])) // Ensure no duplicates
    );
  };

  // Helper functions for cleaner code organization
  const generateChatTitle = (message: string): string => {
    const words = message.split(' ').slice(0, 3);
    return words.join(' ') + (message.split(' ').length > 3 ? '...' : '');
  };

  const findMentionedDocuments = (message: string): string[] => {
    const mentionedDocuments: string[] = [];
    
    // Check for explicitly mentioned documents in the message
    documents.forEach(doc => {
      const docName = doc.title || doc.filename;
      if (message.toLowerCase().includes(docName.toLowerCase())) {
        mentionedDocuments.push(doc.id);
      }
    });
    
    return mentionedDocuments;
  };

  const findUnassociatedDocuments = (): string[] => {
    return documents
      .filter(doc => {
        // Check if this document is already associated with any conversation
        const isAssociated = conversations.some(conv => 
          conv.document_uuid && conv.document_uuid.includes(doc.id)
        );
        return !isAssociated;
      })
      .map(doc => doc.id);
  };

  const shouldAssociateUnassociatedDocs = (message: string): boolean => {
    return message.toLowerCase().includes('analyze') || 
           message.toLowerCase().includes('uploaded') ||
           message.toLowerCase().includes('document');
  };

  // Helper function to add a message to the database
  // These functions are removed as they're not being used

  const validateFiles = (files: File[]): File[] => {
    return files.filter(file => 
      file.type.startsWith('text/') || 
      file.type === 'application/pdf' ||
      file.type.includes('document') ||
      file.type.includes('word')
    );
  };

  const generateUploadMessage = (files: File[]): string => {
    const fileNames = files.map(f => f.name).join(', ');
    return files.length === 1 
      ? `I've uploaded "${fileNames}". Please analyze this document.`
      : `I've uploaded ${files.length} files: ${fileNames}. Please analyze these documents.`;
  };

  // Main action handlers

  const startNewChatSession = () => {
    // Simply start a new chat session without processing any input
    setCurrentConversationId(null);
    setInputValue(''); // Clear any existing input
    setSelectedDocument(null);
    setSelectedDocumentsForAnalysis([]);
  };

  const createNewChat = async () => {
    if (!inputValue.trim()) {
      setCurrentConversationId(null);
      return;
    }

    try {
      // Store input value immediately to prevent it from being lost
      const userMessageContent = inputValue.trim();
      const title = generateChatTitle(userMessageContent);
      
      console.log('Creating new chat with title:', title);
      
      // Find documents to associate with this chat
      let documentsToAssociate = findMentionedDocuments(inputValue);
      
      // ONLY if there's NO current conversation, check for unassociated documents
      // This prevents documents from existing chats being duplicated to new chats
      if (!currentConversationId && documentsToAssociate.length === 0) {
        const unassociatedDocs = findUnassociatedDocuments();
        
        // If there are unassociated docs and the message looks like it's about document analysis
        if (unassociatedDocs.length > 0 && shouldAssociateUnassociatedDocs(inputValue)) {
          documentsToAssociate = unassociatedDocs;
        }
      }
      
      console.log('Documents to associate:', documentsToAssociate);
      
      // Create conversation with any referenced document IDs
      const newConversation = await createConversation(title, documentsToAssociate);
      const newConversationId = newConversation.id;
      
      console.log('Created conversation with ID:', newConversationId);
      
      // Set conversation ID IMMEDIATELY after creation
      setCurrentConversationId(newConversationId);
        // Clear input and set loading state
      setInputValue('');
      setIsLoading(true);

      // IMPORTANT: First, ensure the message itself gets saved to the chat log
      // This ensures the user's message is always saved even if AI generation fails
      try {
        console.log('First, explicitly saving user message to chat log');
        await queryApi.processQuery(
          userMessageContent,
          newConversationId,
          documentsToAssociate,
          4 // Default k value
        );
        
        // Small delay to ensure message is saved
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Then generate AI response using the query API
        const queryRequest = {
          query: userMessageContent,
          session_id: newConversationId,
          doc_ids: Array.from(new Set(documentsToAssociate)), // Deduplicate doc_ids
          k: 4
        };
        
        console.log('Sending query to AI for response:', {
          messageLength: userMessageContent.length,
          sessionId: newConversationId,
          documentCount: documentsToAssociate.length
        });
        
        // Send the query to the API
        const queryResponse = await queryApi.submitQuery(queryRequest);
        
        if (queryResponse && queryResponse.data && queryResponse.data.response) {
          console.log('AI response received successfully');
        } else {
          console.log('Query API returned empty response, falling back to default behavior');
          // If API doesn't return a response, we already saved the user message,
          // so we don't need to call processQuery again
        }
      } catch (error) {
        console.error('Failed to get AI response:', error);
        // Use a fallback method to save a default response if the AI generation failed
        try {
          console.log('Attempting fallback method to save a default AI response');
          const fallbackResponse = await queryApi.processQuery(
            userMessageContent, 
            newConversationId, 
            documentsToAssociate,
            4 // Default k value
          );
          
          console.log('Fallback response saved successfully', fallbackResponse);
        } catch (fallbackError) {
          console.error('Fallback API call also failed:', fallbackError);
          // Even if both attempts fail, we've already saved the user's message earlier,
          // so at least that will be displayed in the UI
        }
      }
      
      // Chat log is automatically saved by the query API
      console.log('Chat log will be saved by the query API');
      
      // Add a small delay to ensure data is committed
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Final refresh to show both messages
      await refreshChats();
      console.log('Final refresh completed');
      setIsLoading(false);
      
    } catch (error) {
      console.error('Failed to create conversation:', error);
      setIsLoading(false);
    }
  };

  const switchToChat = (chat: Chat) => {
    // Before switching, check if there are unassociated documents that need a new chat
    if (!currentConversationId) {
      const unassociatedDocs = findUnassociatedDocuments();
      
      // If there are unassociated documents and there's content in the input field
      if (unassociatedDocs.length > 0 && inputValue.trim()) {
        // Create a new chat for the uploaded documents instead of switching
        createNewChat();
        return;
      }
    }
    
    setCurrentConversationId(chat.id);
  };

  const deleteChat = async (chatId: string) => {
    try {
      // Find the conversation to get associated documents
      const conversationToDelete = conversations.find((conv: Conversation) => conv.id === chatId);
      
      if (conversationToDelete && conversationToDelete.document_uuid && conversationToDelete.document_uuid.length > 0) {
        const documentCount = conversationToDelete.document_uuid.length;
        const confirmMessage = `This chat has ${documentCount} associated document${documentCount > 1 ? 's' : ''}. Deleting this chat will also permanently delete ${documentCount > 1 ? 'these documents' : 'this document'} from your storage. Are you sure you want to continue?`;
        
        if (!confirm(confirmMessage)) {
          return; // User cancelled the deletion
        }
        
        console.log('Deleting documents associated with chat:', conversationToDelete.document_uuid);
        
        // Delete each associated document
        for (const documentId of conversationToDelete.document_uuid) {
          try {
            // Find the document to get storage path
            const documentToDelete = documents.find(doc => doc.id === documentId);
            
            if (documentToDelete) {
              console.log(`Deleting document via API: ${documentId}`, {
                filename: documentToDelete.filename,
                path: documentToDelete.storage_path
              });
              
              // Use backend API to delete the document
              try {
                await documentsApi.deleteDocument(documentId);
                console.log(`Successfully deleted document via API: ${documentId}`);
              } catch (apiError) {
                console.error(`Failed to delete document ${documentId} via API:`, apiError);
                throw apiError;
              }
            }
          } catch (docError) {
            console.error(`Error deleting document ${documentId}:`, docError);
            // Continue with other documents even if one fails
          }
        }
      } else {
        // No documents associated, just confirm chat deletion
        if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
          return;
        }
      }
      
      // Delete the conversation
      await deleteConversation(chatId);
      
      // Clean up UI state if current chat is being deleted
      if (currentConversationId === chatId) {
        setCurrentConversationId(null);
        setSelectedDocument(null);
        setSelectedDocumentsForAnalysis([]);
      }
      
      // Refresh documents to update the UI
      await refreshDocuments();
      
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to delete conversation: ${errorMessage}`);
    }
  };
  
  // Force refresh chats when conversation ID changes to ensure UI sync
  useEffect(() => {
    if (currentConversationId) {
      // Small delay to ensure any pending database operations are complete
      const timeoutId = setTimeout(() => {
        refreshChats();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentConversationId, refreshChats]);

  useEffect(() => {
    // Reset scroll behavior when switching to a different chat
    setIsUserScrolling(false);
    setIsNearBottom(true);
  }, [currentConversationId]);

  useEffect(() => {
    // Only auto-scroll if user isn't manually scrolling or if they're near the bottom
    if (!isUserScrolling || isNearBottom) {
      scrollToBottom();
    }
  }, [currentChat?.messages, isUserScrolling, isNearBottom]);

  useEffect(() => {
    const messagesContainer = document.querySelector('.messages-container');
     
    if (!messagesContainer) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      const isScrolledFromTop = scrollTop > 0;
      const isNearBottomThreshold = scrollHeight - scrollTop - clientHeight < 100; // 100px threshold

      setIsScrolled(isScrolledFromTop);
      setIsNearBottom(isNearBottomThreshold);
      
      // If user scrolls up significantly, mark as manual scrolling
      if (!isNearBottomThreshold) {
        setIsUserScrolling(true);
      } else {
        // If user scrolls back near bottom, allow auto-scroll again
        setIsUserScrolling(false);
      }
    };

    messagesContainer.addEventListener('scroll', handleScroll);
    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, [currentChat]);
  
  const deleteDocument = async (documentId: string) => {
    try {
      console.log('=== Starting document deletion process ===');
      console.log('Document ID to delete:', documentId);
      console.log('User ID:', user.id);
      
      // Find the document to get storage information
      const documentToDelete = documents.find((doc: Document) => doc.id === documentId);
      console.log('Document found in cache:', documentToDelete ? {
        id: documentToDelete.id,
        filename: documentToDelete.filename,
        storage_path: documentToDelete.storage_path
      } : 'Not found');
      
      // Remove document from current conversation if exists
      if (currentConversationId) {
        const currentConv = conversations.find((conv: Conversation) => conv.id === currentConversationId);
        if (currentConv && currentConv.document_uuid) {
          const updatedDocumentIds = currentConv.document_uuid.filter((id: string) => id !== documentId);
          await updateConversation(currentConversationId, {
            document_uuid: updatedDocumentIds
          });
        }
        
        // Unlink document from session using the API
        await sessionsApi.unlinkDocumentFromSession(currentConversationId, documentId, user.id);
      }

      // Clean up UI state
      setSelectedDocumentsForAnalysis(prev => prev.filter(id => id !== documentId));
      
      if (selectedDocument && selectedDocument.id === documentId) {
        setSelectedDocument(null);
      }

      console.log('Attempting to delete document from database:', {
        documentId,
        userId: user.id,
        documentToDelete: documentToDelete ? {
          id: documentToDelete.id,
          filename: documentToDelete.filename,
          user_id: (documentToDelete as any).user_id
        } : 'not found'
      });

      // Delete the document using backend API instead of direct Supabase calls
      try {
        await documentsApi.deleteDocument(documentId);
        console.log('Document deleted successfully via backend API');
      } catch (deleteError) {
        console.error('Failed to delete document via API:', deleteError);
        throw deleteError;
      }

      // Refresh documents to update the UI
      await refreshDocuments();
      
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document. Please try again.');
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    if (!currentConversationId) {
      // Create new chat if none exists
      await createNewChat();
      return;
    }

    // Make sure we have a valid conversation ID before proceeding
    const conversationId = currentConversationId;
    if (!conversationId) {
      console.error('No conversation selected');
      return;
    }

    try {
      const userMessage = inputValue;
      
      // Check if this is the first message in the conversation and update title if needed
      const currentConv = conversations.find((conv: Conversation) => conv.id === conversationId);
      const currentChatMessages = currentChat?.messages || [];
      
      // If this is the first message and the conversation has a generic title, update it
      if (currentConv && currentChatMessages.length === 0) {
        const currentTitle = currentConv.title || currentConv.name || '';
        
        // Check if the current title is a generic document title
        const isGenericTitle = currentTitle.startsWith('Document:') || 
                              currentTitle.endsWith('Documents') || 
                              currentTitle === 'New Chat' ||
                              /^\d+ Documents?$/.test(currentTitle); // Match "1 Document", "3 Documents", etc.
        
        if (isGenericTitle) {
          const newTitle = generateChatTitle(userMessage);
          console.log(`Updating chat title from "${currentTitle}" to "${newTitle}"`);
          
          await updateConversation(conversationId, {
            title: newTitle
          });
          
          // Small delay to ensure title update is committed
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Check if message references any documents and update conversation
      const documentReferences = findMentionedDocuments(inputValue);
      if (documentReferences.length > 0) {
        const conversationData = conversations.find((conv: Conversation) => conv.id === conversationId);
        if (conversationData) {
          const existingIds = conversationData.document_uuid || [];
          const combinedIds = [...new Set([...existingIds, ...documentReferences])];
          
          await updateConversation(conversationId, {
            document_uuid: combinedIds
          });
        }
      }

      // Clear input and set loading state
      setInputValue('');
      setIsLoading(true);

      // Get all documents selected for this conversation
      const chatData = conversations.find((conv: Conversation) => conv.id === conversationId);
      // Deduplicate document IDs using Set to avoid duplicates
      const selectedDocIds = [...new Set([
        ...(chatData?.document_uuid || []),
        ...selectedDocumentsForAnalysis
      ])];

      console.log('Current conversation:', currentConv);
      console.log('Document UUID from conversation:', currentConv?.document_uuid);
      console.log('Selected documents for analysis:', selectedDocumentsForAnalysis);
      console.log('All selected doc IDs:', selectedDocIds);
      console.log('Available documents:', uploadedFiles.map(f => ({ id: f.id, name: f.name })));          // Use selected document IDs as they are

      try {
        // Use the RAG API if documents are selected and backend is available
        if (selectedDocIds.length > 0 && isBackendAvailable) {
          console.log('Using RAG query API with documents:', selectedDocIds);
          console.log('User message:', userMessage);
          console.log('Conversation ID:', conversationId);
          
          // Create a request payload matching the structure expected by the backend
          const queryRequest = {
            query: userMessage,
            session_id: conversationId,
            doc_ids: Array.from(new Set(selectedDocIds)), // Deduplicate doc_ids
            k: 4
          };
          
          // Log minimal info about the request
          console.log('Sending query with:', {
            sessionId: queryRequest.session_id,
            numDocs: queryRequest.doc_ids.length,
            queryLength: queryRequest.query.length
          });
          
          try {
            const queryResponse = await queryApi.submitQuery(queryRequest);
            console.log('RAG API response:', queryResponse);
            console.log('Response data:', queryResponse?.data);
            
            if (queryResponse && queryResponse.data && queryResponse.data.response) {
              console.log('AI response extracted:', queryResponse.data.response);
            } else {
              console.error('Invalid response structure:', queryResponse);
              throw new Error('No response from RAG API');
            }
          } catch (apiError) {
            console.error('API call failed:', apiError);
            throw apiError;
          }
        } else {
          // Fallback response when no documents are selected or backend unavailable
          if (selectedDocIds.length === 0) {
            console.log("No documents selected, displaying standard message");
          } else {
            console.log("Backend unavailable, displaying error message");
          }
        }
        
        // Chat log is automatically saved by the query API
        console.log('Chat log will be saved by the query API');
        
        // Add a small delay for data consistency
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Refresh the chat messages to display both prompt and response
        await refreshChats();
        setIsLoading(false);
        
      } catch (error) {
        console.error('Error using RAG API:', error);
        setIsLoading(false);
        
        // Show and save error message to user via backend API
        try {
          // Create a minimal query request that will be recorded in the backend
          // The backend will handle storing the appropriate error message
          await queryApi.processQuery(userMessage, conversationId, selectedDocumentsForAnalysis);
          
          await refreshChats();
        } catch (logError) {
          console.error('Failed to save error response:', logError);
        }
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
      
      // Show friendly error to user
      alert('Failed to send message. Please check your connection and try again.');
    }
  };

  // Event handlers
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (currentConversationId) {
        handleSendMessage();
      } else {
        createNewChat();
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  };

  const handleFileUpload = async (files: File[]) => {
    const validFiles = validateFiles(files);

    if (validFiles.length === 0) {
      alert('Please upload valid document files (PDF, DOC, DOCX, TXT)');
      return;
    }

    setIsUploading(true);

    try {
      // Array to collect document IDs
      const uploadedDocumentIds: string[] = [];
      
      // Ensure we have a session ID to upload documents to
      let sessionIdToUse = currentConversationId;
      
      // If no current conversation, create one
      if (!sessionIdToUse) {
        console.log('No current conversation, creating one for document upload');
        
        // Check if there are any existing conversations first that we can reuse
        // This helps prevent creating duplicate sessions
        // Make sure we have the latest conversations data
        await loadConversations(); // Now we can use the loadConversations function from the hook
        
        // Find conversations that are empty (no documents or messages)
        const existingEmptyConversations = conversations.filter(conv => {
          // No documents attached
          const noDocuments = !conv.document_uuid || conv.document_uuid.length === 0;
          
          // No messages in this conversation
          const noMessages = !supabaseChats.some(chat => chat.conversation_id === conv.id);
          
          return noDocuments && noMessages;
        });
        
        if (existingEmptyConversations.length > 0) {
          // Reuse the most recent empty conversation
          const conversationToUse = existingEmptyConversations[0];
          sessionIdToUse = conversationToUse.id;
          setCurrentConversationId(sessionIdToUse);
          console.log('Reusing existing empty conversation:', sessionIdToUse);
        } else {
          // Create a new conversation only if no empty ones exist
          const newConversation = await createConversation('Document Upload', []);
          sessionIdToUse = newConversation.id;
          setCurrentConversationId(sessionIdToUse);
          console.log('Created new conversation with ID:', sessionIdToUse);
        }
      }
      
      // At this point we should have a valid session ID
      if (!sessionIdToUse) {
        throw new Error('Failed to create or get a valid session ID');
      }
      
      // Upload all files using the API (RAG backend)
      for (const file of validFiles) {
        console.log(`Uploading file ${file.name} to session ${sessionIdToUse} via API`);
        try {
          // Now sessionIdToUse is guaranteed to be string
          const response = await documentsApi.uploadDocument(file, sessionIdToUse);
          const uploadData = response.data as { doc_id?: string };
          
          if (uploadData && uploadData.doc_id) {
            console.log(`File ${file.name} uploaded successfully, doc_id: ${uploadData.doc_id}`);
            uploadedDocumentIds.push(uploadData.doc_id);
          } else {
            console.error('Upload response missing doc_id:', response);
          }
        } catch (uploadError) {
          console.error(`Error uploading file ${file.name}:`, uploadError);
          // Continue with other files
        }
      }
      
      // Refresh documents to get the latest data
      await refreshDocuments();
      
      if (sessionIdToUse && uploadedDocumentIds.length > 0) {
        // Update the conversation with the uploaded document IDs
        const conversationToUpdate = conversations.find((conv: any) => conv.id === sessionIdToUse);
        if (conversationToUpdate) {
          const existingIds = conversationToUpdate.document_uuid || [];
          const combinedIds = [...new Set([...existingIds, ...uploadedDocumentIds])];
          
          console.log(`Updating conversation ${sessionIdToUse} with document IDs:`, combinedIds);
          
          await updateConversation(sessionIdToUse, {
            document_uuid: combinedIds
          });
        }
        
        // Add upload message to input for current conversation
        const uploadMessage = generateUploadMessage(validFiles);
        setInputValue(prev => prev + (prev ? '\n\n' : '') + uploadMessage);
        
      } else if (uploadedDocumentIds.length > 0) {
        // No current conversation - automatically create a new chat with the uploaded documents
        const chatTitle = validFiles.length === 1 
          ? `Document: ${validFiles[0].name}` 
          : `${validFiles.length} Documents`;
        
        console.log('Auto-creating chat for uploaded documents:', chatTitle);
        
        // Create conversation with uploaded documents
        const newConversation = await createConversation(chatTitle, uploadedDocumentIds);
        const newConversationId = newConversation.id;
        
        console.log('Auto-created conversation with ID:', newConversationId);
        
        // Set conversation ID
        setCurrentConversationId(newConversationId);
        
        // Prepare welcome message for the documents
        const uploadMessage = generateUploadMessage(validFiles);
        setInputValue(uploadMessage);
        
        // Add a small delay to ensure data is committed
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Refresh chats to show the new conversation
        await refreshChats();
        console.log('Auto-created chat refresh completed');
      }
      
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error uploading files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-50 text-gray-800 fixed inset-0">
      {/* Sidebar */}
      <Sidebar
        user={user}
        onLogout={onLogout}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        chats={chats}
        currentChat={currentChat}
        filteredFiles={filteredFiles}
        selectedDocument={selectedDocument}
        selectedDocumentsForAnalysis={selectedDocumentsForAnalysis}
        currentConversationId={currentConversationId}
        createNewChat={startNewChatSession}
        switchToChat={switchToChat}
        deleteChat={deleteChat}
        viewDocument={viewDocument}
        setSelectedDocument={setSelectedDocument}
        toggleDocumentForAnalysis={toggleDocumentForAnalysis}
        deleteDocument={deleteDocument}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white h-full min-w-0 relative" ref={splitRef}>
        {/* Header */}
       <div className={`p-4 bg-white flex-shrink-0 flex items-center justify-between transition-all duration-200 ${isScrolled ? 'border-b border-gray-200 shadow-sm' : '' }`}>
          <div className="flex items-center space-x-3">
            <h2 className="text-4xl top-0 font-Poppins font-semibold  bg-gradient-to-l from-purple-500  to-black  bg-clip-text text-transparent">AI Assistant</h2>
          </div>
        </div>

        {/* Split Pane Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Area */}
          <div 
            className={`flex flex-col bg-white min-w-0 transition-all duration-75 ease-out ${
              isResizing || isResizingActivityLog ? 'transition-none' : ''
            }`}
            style={{ 
              width: selectedDocument 
                ? `${splitPosition}%` 
                : showActivityLog 
                  ? `${100 - activityLogPosition}%` 
                  : '100%' 
            }}
          >
            <div className="h-screen flex flex-col bg-white">
              {/* Messages Area or Welcome Screen */}
              <div className="messages-container flex-1 overflow-y-auto p-4">
                {!currentChat || currentChat?.messages?.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-6 max-w-xl mx-auto">
                    <div className="text-center space-y-3">
                      <div className="w-8 h-8 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="w-6 h-6 text-white" />
                      </div>
                      <h2 className="text-2xl font-Poppins text-gray-800">
                        How can we <span className="bg-gradient-to-l from-purple-600 to-black bg-clip-text text-transparent">assist</span> you today?
                      </h2>
                      <p className="text-gray-600 text-sm">
                        Get tailored insights from AI agent, powered by real-time document understanding.
                      </p>
                    </div>

                    <div 
                      className={`relative w-full border-2 border-dashed border-gray-300 rounded-lg p-8 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer ${
                        isDragging ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="text-center space-y-3">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                        <div>
                          <h3 className="text-base font-medium text-gray-800 mb-1">Upload your documents</h3>
                          <p className="text-gray-600 text-sm mb-3">Drag and drop or browse to upload your documents.</p>
                          <button className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-purple-950 transition-colors">
                            Browse Files
                          </button>
                        </div>
                      </div>
                      
                      {isDragging && (
                        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-2 border-dashed border-blue-500 flex items-center justify-center rounded-lg">
                          <div className="text-center">
                            <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                            <p className="text-blue-700 font-medium text-sm">Drop files here to upload</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {isUploading && (
                      <div className="flex items-center justify-center space-x-2 p-3 bg-yellow-50 rounded-lg w-full">
                        <Upload className="w-4 h-4 text-yellow-600 animate-spin" />
                        <span className="text-yellow-700 text-sm">Uploading files...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">

                    {currentChat.messages.map((message, index) => (
                      <div
                        key={`${message.id}-${index}-${currentConversationId}`} // Enhanced key for better re-rendering
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.sender === 'user'
                              ? 'bg-purple-900 text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap text-left">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.sender === 'user' 
                              ? 'text-blue-100 text-right' 
                              : 'text-gray-500 text-left'
                          }`}>
                            {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-800 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                            </div>
                            <span className="text-sm text-gray-500">AI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                
                    <div ref={messagesEndRef} />
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,text/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const files = Array.from(e.target.files);
                      handleFileUpload(files);
                      // Reset the input so the same file can be uploaded again if needed
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>

            {isUserScrolling && !isNearBottom && (
              <div className="fixed bottom-24 right-8 z-10">
                <button
                  onClick={() => {
                    setIsUserScrolling(false);
                    scrollToBottom();
                  }}
                  className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
                  title="Scroll to bottom"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex-shrink-0">
              <div className="flex items-center space-x-3 max-w-4xl mx-auto">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your message..."
                    className="w-full px-4 py-3 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute p-3 right-0 top-1/2 transform -translate-x -translate-y-1/2 flex">
                    <button
                      onClick={() => setShowActivityLog(!showActivityLog)}
                      className=" p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title={showActivityLog ? "Hide Activity Log" : "Show Activity Log"}
                    >
                      {showActivityLog ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="p-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Activity Log Resizer - VS Code style */}
          {showActivityLog && !selectedDocument && (
            <div
              className={`w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize flex-shrink-0 relative group transition-all duration-150 ${
                isResizingActivityLog ? 'bg-blue-600 w-1' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizingActivityLog(true);
              }}
            >
              <div className="absolute inset-y-0 -left-2 -right-2 group-hover:bg-blue-500 group-hover:bg-opacity-20 transition-all duration-150"></div>
            </div>
          )}

          {/* Document Viewer Resizer - VS Code style */}
          {selectedDocument && (
            <div
              className={`w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize flex-shrink-0 relative group transition-all duration-150 ${
                isResizing ? 'bg-gray-200 w-1' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
            >
              <div className="absolute inset-y-0 -left-2 -right-2 group-hover:bg-gray-200 group-hover:bg-opacity-20 transition-all duration-150"></div>
            </div>
          )}

          {/* Document Viewer with Activity Log */}
          {selectedDocument && (
            <div 
              style={{ width: `${100 - splitPosition}%` }} 
              className={`min-w-0 flex flex-col transition-all duration-75 ease-out ${
                isResizing || isResizingActivityLog ? 'transition-none' : ''
              }`}
            >
              {/* Document Viewer */}
              <div 
                style={{ 
                  height: showActivityLog ? `${100 - documentActivitySplit}%` : '100%' 
                }}
                className={`min-h-0 transition-all duration-75 ease-out ${
                  isResizingActivityLog ? 'transition-none' : ''
                }`}
              >
                <DocumentViewer
                  file={selectedDocument}
                  onClose={closeDocumentViewer}
                  availableFiles={documentsWithUrls}
                  onFileChange={setSelectedDocument}
                />
              </div>

              {/* Document-Activity Log Resizer - VS Code style */}
              {showActivityLog && (
                <div
                  className={`h-1 bg-gray-200 hover:bg-blue-200 cursor-row-resize flex-shrink-0 relative group transition-all duration-150 ${
                    isResizingActivityLog ? 'bg-blue-100 h-1' : ''
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsResizingActivityLog(true);
                  }}
                >
                  <div className="absolute inset-x-0 -top-2 -bottom-2 group-hover:bg-gray-200 group-hover:bg-opacity-20 transition-all duration-150"></div>
                </div>
              )}

              {/* Activity Log within Document Viewer */}
              {showActivityLog && (
                <div 
                  style={{ height: `${documentActivitySplit}%` }}
                  className={`min-h-0 transition-all duration-75 ease-out ${
                    isResizingActivityLog ? 'transition-none' : ''
                  }`}
                >
                  <ActivityLog 
                    currentSessionId={currentConversationId}
                  />
                </div>
              )}
            </div>
          )}

          {/* Standalone Activity Log - only show when no document viewer */}
          {showActivityLog && !selectedDocument && (
            <div 
              style={{ width: `${activityLogPosition}%` }}
              className={`min-w-0 transition-all duration-75 ease-out ${
                isResizingActivityLog ? 'transition-none' : ''
              }`}
            >
              <ActivityLog 
                currentSessionId={currentConversationId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
