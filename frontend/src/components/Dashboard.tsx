import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Paperclip, Send, ChevronDown, Upload, Eye, EyeOff } from 'lucide-react';
import type { User } from '@supabase/supabase-js'; // Keep for type definitions only
// @ts-ignore - TypeScript can't find these modules, but they exist
import { useConversations, useChats, useDocuments, Conversation, Document } from '../hooks/useSupabase';
import { queryApi, healthApi, documentsApi, sessionsApi, documentsUrlApi } from '../services/api';
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
  
  // Chat state management
  const [chatMessages, setChatMessages] = useState<Record<string, Message[]>>({});
  const [isSwitchingChat, setIsSwitchingChat] = useState(false);
  
  // Document URL state
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [isGeneratingUrls, setIsGeneratingUrls] = useState(false);
  
  // Process tracking state
  const [processSteps, setProcessSteps] = useState<Array<{
    step: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    message: string;
    timestamp: Date;
  }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  
  // Convert Supabase data to UI format for compatibility with existing components
  // Use a stable structure to prevent unnecessary re-renders
  const chats: Chat[] = useMemo(() => {
    const result = conversations
      .filter(conv => conv.id && conv.id !== 'undefined') // Filter out invalid conversations
      .map(conv => {
        const conversationId = conv.id;
        
        // Get messages for this conversation, use cached version if available
        const conversationMessages = chatMessages[conversationId] || 
          supabaseChats
            .filter(chat => chat.conversation_id === conversationId)
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
              // Ensure UTC parsing for created_at
              timestamp: new Date(
                typeof chat.created_at === 'string'
                  ? chat.created_at.replace(' ', 'T').replace('+00', 'Z')
                  : chat.created_at
              )
            }));

        return {
          id: conversationId,
          title: conv.title || conv.name || 'Untitled Chat',
          messages: conversationMessages,
          lastMessage: new Date(conv.last_updated || conv.updated_at || conv.created_at),
          document_uuid: conv.document_uuid || []
        };
      });
    
    return result;
  }, [conversations, supabaseChats, chatMessages]);

  // Update message cache when supabaseChats changes
  useEffect(() => {
    const newChatMessages = { ...chatMessages };
    
    // Group messages by conversation
    const messagesByConversation: Record<string, Message[]> = {};
    
    supabaseChats.forEach(chat => {
      const conversationId = chat.conversation_id || '';
      if (conversationId && !messagesByConversation[conversationId]) {
        messagesByConversation[conversationId] = [];
      }
    });
    
    // Convert supabaseChats to UI format and group by conversation
    Object.keys(messagesByConversation).forEach(conversationId => {
      const conversationChats = supabaseChats
        .filter(chat => chat.conversation_id === conversationId)
        .sort((a, b) => {
          if ((a.step || 0) !== (b.step || 0)) {
            return (a.step || 0) - (b.step || 0);
          }
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        })
        .map(chat => ({
          id: chat.id,
          content: chat.content || '',
          sender: chat.role === 'user' ? 'user' : 'ai',
          timestamp: new Date(chat.created_at)
        }) as Message);
      
      newChatMessages[conversationId] = conversationChats;
    });
    
    // Only update the cache if there are actual changes
    const hasChanges = Object.keys(newChatMessages).some(id => 
      JSON.stringify(newChatMessages[id]) !== JSON.stringify(chatMessages[id])
    );
    
    if (hasChanges) {
      setChatMessages(newChatMessages);
      
      // If we have data for the current conversation, stop the switching animation
      if (currentConversationId && newChatMessages[currentConversationId] && isSwitchingChat) {
        setIsSwitchingChat(false);
      }
    }
  }, [supabaseChats, currentConversationId, chatMessages, isSwitchingChat]);

  const currentChat = useMemo(() => {
    if (!currentConversationId) return null;
    
    // Find the chat in the chats array
    const foundChat = chats.find(chat => chat.id === currentConversationId);
    
    // If we found the chat, return it
    if (foundChat) {
      return foundChat;
    }
    
    // If we're switching and haven't found the chat yet, return a stable placeholder
    if (isSwitchingChat) {
      // Check if we have any conversation data for this ID
      const conversation = conversations.find(conv => conv.id === currentConversationId);
      
      return {
        id: currentConversationId,
        title: conversation?.title || conversation?.name || 'Loading...',
        messages: [],
        lastMessage: new Date(),
        document_uuid: conversation?.document_uuid || []
      };
    }
    
    return null;
  }, [chats, currentConversationId, isSwitchingChat, conversations]);

  // Determine if we should show the welcome screen
  const shouldShowWelcomeScreen = useMemo(() => {
    // Always show welcome screen if no conversation is selected
    if (!currentConversationId) return true;
    
    // Never show welcome screen if we're switching chats
    if (isSwitchingChat) return false;
    
    // Never show welcome screen if we don't have a current chat object
    if (!currentChat) return false;
    
    // Show welcome screen only if chat exists, has no messages, and we're not loading
    return currentChat.messages.length === 0 && !isLoading;
  }, [currentConversationId, currentChat, isLoading, isSwitchingChat]);

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
        // Use the new backend API to generate signed URLs
        if (isBackendAvailable && currentConversationId) {
          try {
            const response = await documentsUrlApi.getAllDocumentUrls(currentConversationId);
            const urlMap: Record<string, string> = {};
            
            // Map the response URLs to our document IDs
            for (const file of uploadedFiles) {
              const urlData = response.data.urls[file.id];
              if (urlData && urlData.url) {
                urlMap[file.id] = urlData.url;
                console.log(`Generated signed URL for ${file.name}:`, urlData.url);
              } else {
                console.warn(`No URL generated for document ${file.id} (${file.name})`);
                // Fallback to placeholder
                urlMap[file.id] = `/api/documents/view/${file.id}`;
              }
            }
            
            console.log(`Generated ${Object.keys(urlMap).length} document URLs from backend`);
            setDocumentUrls(urlMap);
          } catch (backendError) {
            console.warn('Backend URL generation failed, using fallback:', backendError);
            // Fallback to placeholder URLs if backend fails
            const urlMap = uploadedFiles.reduce((acc, file) => {
              acc[file.id] = `/api/documents/view/${file.id}`;
              return acc;
            }, {} as Record<string, string>);
            setDocumentUrls(urlMap);
          }
        } else {
          // Create placeholder URLs when backend is not available
          console.log('Backend not available, using placeholder URLs');
          const urlMap = uploadedFiles.reduce((acc, file) => {
            acc[file.id] = `/api/documents/view/${file.id}`;
            return acc;
          }, {} as Record<string, string>);

          console.log(`Generated ${Object.keys(urlMap).length} placeholder document URLs`);
          setDocumentUrls(urlMap);
        }
      } finally {
        setIsGeneratingUrls(false);
      }
    };

    // Check if we need to generate URLs (when uploadedFiles changes or when URLs are missing)
    const needsUrlGeneration = uploadedFiles.some(file => !documentUrls[file.id]);
    
    if (uploadedFiles.length > 0 && needsUrlGeneration && !isGeneratingUrls) {
      generateDocumentUrls();
    }
  }, [uploadedFiles, isGeneratingUrls, isBackendAvailable, currentConversationId]); // Include backend status and session

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
      // Use the element's clientWidth to exclude scrollbar width
      const containerWidth = splitRef.current.clientWidth;
      const newPosition = ((e.clientX - containerRect.left) / containerWidth) * 100;
      
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
    setIsSwitchingChat(false); // Clear loading state
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

      // IMPORTANT: First, save the user message to chat log
      // This ensures the user's message is always saved even if AI generation fails
      try {
        console.log('Saving user message to chat log');
        await sessionsApi.saveUserMessage(newConversationId, userMessageContent);
        
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
          console.log('Query API returned empty response, saving default response');
          // Save a default response if AI doesn't respond
          await sessionsApi.saveAIResponse(newConversationId, "I'm having trouble processing your request right now. Please try again.");
        }
      } catch (error) {
        console.error('Failed to get AI response:', error);
        // Save an error response if the AI generation failed
        try {
          console.log('Saving error response to chat log');
          await sessionsApi.saveAIResponse(newConversationId, "Please upload a document to continue querying.");
        } catch (logError) {
          console.error('Failed to save error response:', logError);
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
    
    // Don't switch if we're already on this chat
    if (currentConversationId === chat.id) {
      return;
    }
    
    // Set loading state immediately when switching
    setIsSwitchingChat(true);
    setCurrentConversationId(chat.id);
    
    // Add a failsafe timeout to prevent stuck loading state
    setTimeout(() => {
      setIsSwitchingChat(false);
    }, 5000); // 5 second timeout
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
      // Set loading state immediately when switching conversations
      setIsSwitchingChat(true);
      
      // Initiate the chat refresh
      const refreshChat = async () => {
        try {
          await refreshChats();
        } catch (error) {
          console.error('Error refreshing chats:', error);
          // Even if refresh fails, stop the loading state
          setIsSwitchingChat(false);
        }
      };
      
      // Small delay to ensure any pending database operations are complete
      const timeoutId = setTimeout(refreshChat, 100);
      
      return () => {
        clearTimeout(timeoutId);
      };
    } else {
      setIsSwitchingChat(false);
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
      
      // Initialize process tracking and show activity log
      setProcessSteps([]); // Clear previous process steps
      setIsProcessing(true);
      setShowActivityLog(true);
      
      // Add initial step
      const addProcessStep = (step: string, status: 'pending' | 'in-progress' | 'completed' | 'error', message: string) => {
        setProcessSteps(prev => {
          const existingIndex = prev.findIndex(s => s.step === step);
          const newStep = { step, status, message, timestamp: new Date() };
          
          if (existingIndex >= 0) {
            // Update existing step
            const updated = [...prev];
            updated[existingIndex] = newStep;
            return updated;
          } else {
            // Add new step
            return [...prev, newStep];
          }
        });
      };
      
      // Step 1: Initialize query
      addProcessStep('query', 'in-progress', 'Processing user query...');
      
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

      // Complete query step
      addProcessStep('query', 'completed', 'Query initialized successfully');

      // Clear input and set loading state
      setInputValue('');
      setIsLoading(true);

      // Get all documents selected for this conversation
      // Use only checked documents for analysis
      const selectedDocIds = [...new Set(selectedDocumentsForAnalysis)];

      console.log('Selected documents for analysis:', selectedDocumentsForAnalysis);
      console.log('All selected doc IDs:', selectedDocIds);
      console.log('Available documents:', uploadedFiles.map(f => ({ id: f.id, name: f.name })));

      try {
        // First, save the user message to chat log
        console.log('Saving user message to chat log');
        await sessionsApi.saveUserMessage(conversationId, userMessage);
        
        // Use the RAG API if documents are selected and backend is available
        if (selectedDocIds.length > 0 && isBackendAvailable) {
          console.log('Using RAG query API with documents:', selectedDocIds);
          console.log('User message:', userMessage);
          console.log('Conversation ID:', conversationId);
          
          // Step 2: Query enrichment
          addProcessStep('enrich', 'in-progress', 'Enriching query with context...');
          
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
            // Step 3: Document retrieval
            addProcessStep('retrieve', 'in-progress', `Retrieving relevant content from ${selectedDocIds.length} documents...`);
            
            const queryResponse = await queryApi.submitQuery(queryRequest);
            console.log('RAG API response:', queryResponse);
            console.log('Response data:', queryResponse?.data);
            
            // Step 4: PII masking
            addProcessStep('retrieve', 'completed', 'Document retrieval completed');
            addProcessStep('mask', 'in-progress', 'Applying privacy protection...');
            
            // Step 5: Response generation
            addProcessStep('mask', 'completed', 'Privacy protection applied');
            addProcessStep('response', 'in-progress', 'Generating AI response...');
            
            if (queryResponse && queryResponse.data) {
              const responseData: any = queryResponse.data;
              console.log('AI response extracted:', responseData.scaled_response || responseData.response);
              
              // Add detailed transparency steps for ActivityLog
              addProcessStep('transparency', 'in-progress', 'Processing response details...');
              
              // Add user query details (using correct property names)
              addProcessStep('user_query', 'completed', `User Query: "${responseData.user_query || responseData.original_query || 'N/A'}"`);
              
              // Add transformed query details
              const transformedQuery = responseData.transformed_query || responseData.enriched_query;
              const userQuery = responseData.user_query || responseData.original_query;
              if (transformedQuery && transformedQuery !== userQuery) {
                addProcessStep('transformed_query', 'completed', `Transformed Query: "${transformedQuery}"`);
              }
              
              // Add retrieved chunks info
              const retrievedChunks = responseData.retrieved_chunks;
              if (retrievedChunks && Array.isArray(retrievedChunks) && retrievedChunks.length > 0) {
                addProcessStep('retrieved_chunks', 'completed', `Retrieved ${retrievedChunks.length} relevant chunks from documents`);
                retrievedChunks.forEach((chunk: any, index: number) => {
                  const chunkText = typeof chunk === 'string' ? chunk : chunk.content || chunk.text || 'No content';
                  addProcessStep(`chunk_${index}`, 'completed', `Chunk ${index + 1}: "${chunkText.substring(0, 100)}..."`);
                });
              } else if (typeof retrievedChunks === 'string') {
                addProcessStep('retrieved_chunks', 'completed', `Retrieved chunks: ${retrievedChunks}`);
              } else {
                addProcessStep('retrieved_chunks', 'completed', 'No chunks retrieved (no documents selected)');
              }
              
              // Add masked chunks info
              const maskedChunks = responseData.masked_chunks;
              if (maskedChunks && Array.isArray(maskedChunks) && maskedChunks.length > 0) {
                addProcessStep('masked_chunks', 'completed', `Applied privacy masking to ${maskedChunks.length} chunks`);
              } else if (typeof maskedChunks === 'string') {
                addProcessStep('masked_chunks', 'completed', `Masked chunks: ${maskedChunks}`);
              }
              
              // Add response details (using correct property names)
              const maskedResponse = responseData.maskedResponse || responseData.masked_response;
              if (maskedResponse) {
                addProcessStep('masked_response', 'completed', `Masked Response: "${maskedResponse}"`);
              }
              
              const unmaskedResponse = responseData.unmasked_response;
              if (unmaskedResponse && unmaskedResponse !== maskedResponse) {
                addProcessStep('unmasked_response', 'completed', `Unmasked Response: "${unmaskedResponse}"`);
              }
              
              const scaledResponse = responseData.scaled_response || responseData.response;
              if (scaledResponse) {
                addProcessStep('scaled_response', 'completed', `Final Response: "${scaledResponse}"`);
              }
              
              const unscaledResponse = responseData.unscaled_response;
              if (unscaledResponse && unscaledResponse !== scaledResponse) {
                addProcessStep('unscaled_response', 'completed', `Unscaled Response: "${unscaledResponse}"`);
              }
              
              // Add processed docs info
              if (responseData.processed_docs && responseData.processed_docs.length > 0) {
                addProcessStep('processed_docs', 'completed', `Processed ${responseData.processed_docs.length} documents: ${responseData.processed_docs.join(', ')}`);
              }
              
              addProcessStep('transparency', 'completed', 'Response details processed for transparency');
              addProcessStep('response', 'completed', 'AI response generated successfully');
            } else {
              console.error('Invalid response structure:', queryResponse);
              addProcessStep('response', 'error', 'Failed to generate AI response');
              // Save a default response if AI doesn't respond
              await sessionsApi.saveAIResponse(conversationId, "I'm having trouble processing your request right now. Please try again.");
            }
          } catch (apiError) {
            console.error('API call failed:', apiError);
            addProcessStep('response', 'error', 'API call failed');
            // Save an error response if the API fails
            await sessionsApi.saveAIResponse(conversationId, "Please upload a document to continue querying.");
          }
        } else {
          // Fallback response when no documents are selected or backend unavailable
          addProcessStep('response', 'in-progress', 'Generating fallback response...');
          
          if (selectedDocIds.length === 0) {
            console.log("No documents selected, saving general response");
            await sessionsApi.saveAIResponse(conversationId, "I'd be happy to help! Please upload some documents so I can provide more specific assistance, or ask me a general question.");
            addProcessStep('response', 'completed', 'General response provided');
          } else {
            console.log("Backend unavailable, saving error response");
            await sessionsApi.saveAIResponse(conversationId, "I'm currently unable to process your request. Please check your connection and try again.");
            addProcessStep('response', 'error', 'Backend unavailable');
          }
        }
        
        // Add a small delay for data consistency
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Refresh the chat messages to display both prompt and response
        await refreshChats();
        setIsLoading(false);
        setIsProcessing(false);
        
        // Keep activity log open so users can see the completed process
        // Auto-hide activity log after 10 seconds but keep process history
        setTimeout(() => {
          setShowActivityLog(false);
          // Don't clear process steps here - let ActivityLog component handle history
        }, 10000);
        
      } catch (error) {
        console.error('Error processing message:', error);
        setIsLoading(false);
        setIsProcessing(false);
        
        addProcessStep('response', 'error', 'Processing failed: ' + (error as Error).message);
        
        // Save error message to user
        try {
          await sessionsApi.saveAIResponse(conversationId, "Please upload a document to continue querying.");
          await refreshChats();
        } catch (logError) {
          console.error('Failed to save error response:', logError);
        }
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
      setIsProcessing(false);
      
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
    
    // Initialize upload tracking and show activity log
    setProcessSteps([]); // Clear previous process steps
    setIsProcessing(true);
    setShowActivityLog(true);
    
    // Helper function to add upload process steps
    const addUploadStep = (step: string, status: 'pending' | 'in-progress' | 'completed' | 'error', message: string) => {
      setProcessSteps(prev => {
        const existingIndex = prev.findIndex(s => s.step === step);
        const newStep = { step, status, message, timestamp: new Date() };
        
        if (existingIndex >= 0) {
          // Update existing step
          const updated = [...prev];
          updated[existingIndex] = newStep;
          return updated;
        } else {
          // Add new step
          return [...prev, newStep];
        }
      });
    };      // Step 1: Initialize upload
      addUploadStep('upload', 'in-progress', `Preparing to upload ${validFiles.length} file(s)...`);

    try {
      // Array to collect document IDs
      const uploadedDocumentIds: string[] = [];
      
      // Ensure we have a session ID to upload documents to
      let sessionIdToUse = currentConversationId;
      
      // If no current conversation, create one
      if (!sessionIdToUse) {
        addUploadStep('session', 'in-progress', 'Creating session for document upload...');
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
          addUploadStep('session', 'completed', 'Reusing existing session');
        } else {
          // Create a new conversation only if no empty ones exist
          const newConversation = await createConversation('Document Upload', []);
          sessionIdToUse = newConversation.id;
          setCurrentConversationId(sessionIdToUse);
          console.log('Created new conversation with ID:', sessionIdToUse);
          addUploadStep('session', 'completed', 'Created new session');
        }
      } else {
        addUploadStep('session', 'completed', 'Using current session');
      }
      
      // At this point we should have a valid session ID
      if (!sessionIdToUse) {
        throw new Error('Failed to create or get a valid session ID');
      }
      
      // Step 2: Upload files
      addUploadStep('upload', 'in-progress', `Uploading ${validFiles.length} file(s)...`);
      
      // Upload all files using the API (RAG backend)
      for (const file of validFiles) {
        addUploadStep('upload', 'in-progress', `Uploading ${file.name}...`);
        console.log(`Uploading file ${file.name} to session ${sessionIdToUse} via API`);
        try {
          // Now sessionIdToUse is guaranteed to be string
          const response = await documentsApi.uploadDocument(file, sessionIdToUse);
          const uploadData = response.data as { doc_id?: string };
          
          if (uploadData && uploadData.doc_id) {
            console.log(`File ${file.name} uploaded successfully, doc_id: ${uploadData.doc_id}`);
            uploadedDocumentIds.push(uploadData.doc_id);
            addUploadStep('upload', 'in-progress', `✓ ${file.name} uploaded successfully`);
          } else {
            console.error('Upload response missing doc_id:', response);
            addUploadStep('upload', 'error', `✗ ${file.name} upload failed - no doc_id`);
          }
        } catch (uploadError) {
          console.error(`Error uploading file ${file.name}:`, uploadError);
          addUploadStep('upload', 'error', `✗ ${file.name} upload failed`);
          // Continue with other files
        }
      }
      
      // Step 3: Process documents
      if (uploadedDocumentIds.length > 0) {
        addUploadStep('document', 'in-progress', 'Processing uploaded documents...');
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
        
        addUploadStep('document', 'completed', `${uploadedDocumentIds.length} document(s) processed successfully`);
        
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
        
        addUploadStep('document', 'completed', `Auto-created chat: ${chatTitle}`);
        
        // Prepare welcome message for the documents
        const uploadMessage = generateUploadMessage(validFiles);
        setInputValue(uploadMessage);
        
        // Add a small delay to ensure data is committed
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Refresh chats to show the new conversation
        await refreshChats();
        console.log('Auto-created chat refresh completed');
      }
      
      // Mark upload as complete
      addUploadStep('upload', 'completed', `Upload completed: ${uploadedDocumentIds.length} of ${validFiles.length} files successful`);
      setIsProcessing(false);
      
      // Auto-hide activity log after 8 seconds for uploads but keep history
      setTimeout(() => {
        setShowActivityLog(false);
        // Don't clear process steps here - let ActivityLog component handle history
      }, 8000);
      
    } catch (error) {
      console.error('Error uploading files:', error);
      addUploadStep('upload', 'error', `Upload failed: ${(error as Error).message}`);
      setIsProcessing(false);
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
            <h2 className="text-4xl top-0 font-Poppins font-semibold  bg-gradient-to-l from-purple-500  to-black  bg-clip-text text-transparent">Precise.ai</h2>
          </div>
        </div>

        {/* Split Pane Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Area */}
          <div 
            className={`chat-area-container flex flex-col bg-white min-w-0 transition-all duration-75 ease-out ${
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
            <div className="h-full flex flex-col bg-white">
              {/* Messages Area or Welcome Screen */}
              <div className="messages-container flex-1 overflow-y-auto p-4 scrollbar-gutter-stable">
                {shouldShowWelcomeScreen ? (
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
                ) : currentChat && currentChat.messages ? (
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
                            {message.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
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
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      <span className="text-gray-500">
                        {isSwitchingChat ? 'Loading messages...' : 'Loading chat...'}
                      </span>
                    </div>
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
              className={`min-w-0 flex flex-col transition-all duration-75 ease-out overflow-hidden ${
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
                    sessions={conversations}
                    currentProcess={processSteps}
                    isProcessing={isProcessing}
                    onClose={() => setShowActivityLog(false)}
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
                sessions={conversations}
                currentProcess={processSteps}
                isProcessing={isProcessing}
                onClose={() => setShowActivityLog(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
