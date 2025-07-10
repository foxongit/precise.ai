import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Paperclip, Send, ChevronDown, Upload, Eye, EyeOff } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
// @ts-ignore - TypeScript can't find these modules, but they exist
import { useConversations, useChats, useDocuments } from '../hooks/useSupabase';
// @ts-ignore - TypeScript can't find these types, but they exist
import { supabase } from '../lib/supabase';
// @ts-ignore - TypeScript can't find these modules, but they exist
import { generateGeminiResponse, checkGeminiStatus } from '../lib/geminiService';
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
  const { conversations, createConversation, updateConversation, deleteConversation } = useConversations(user);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const { chats: supabaseChats, refreshChats } = useChats(currentConversationId);
  const { documents, uploadDocument, refreshDocuments } = useDocuments(user);

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
  const [activityLogPosition, setActivityLogPosition] = useState(70); // Position for activity log split when no document viewer
  const [documentActivitySplit, setDocumentActivitySplit] = useState(60); // Position for activity log within document viewer
  const [isResizingActivityLog, setIsResizingActivityLog] = useState(false);
  
  // Convert Supabase data to UI format for compatibility with existing components
  const chats: Chat[] = conversations.map((conv: any) => ({
    id: conv.id,
    title: conv.title || conv.name,
    messages: supabaseChats
      .filter((chat: any) => chat.conversation_id === conv.id)
      .sort((a: any, b: any) => {
        // Primary sort by step, fallback to timestamp for reliability
        if (a.step !== b.step) {
          return a.step - b.step;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      })
      .map((chat: any) => ({
        id: chat.id,
        content: chat.content,
        sender: chat.role === 'user' ? 'user' : 'ai',
        timestamp: new Date(chat.created_at)
      })),
    lastMessage: new Date(conv.last_updated || conv.updated_at),
    document_uuid: conv.document_uuid || []
  }));

  const currentChat = chats.find(chat => chat.id === currentConversationId) || null;

  // Convert documents to UploadedFile format for compatibility using useMemo
  const uploadedFiles: UploadedFile[] = useMemo(() => {
    console.log('Documents from useDocuments hook:', documents);
    // Show ALL documents, not just ones associated with current conversation
    return documents
      .map((doc: any) => ({
        id: doc.id,
        name: doc.title || doc.filename,
        type: doc.content_type || 'unknown',
        size: 0,
        s3Url: doc.storage_path_s3 || doc.storage_path || '',
        uploadDate: new Date(doc.created_at)
      }))
      .sort((a: UploadedFile, b: UploadedFile) => b.uploadDate.getTime() - a.uploadDate.getTime()); // Sort by upload date, newest first
  }, [documents]);

  // State for document URLs
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [isGeneratingUrls, setIsGeneratingUrls] = useState(false);

  // Effect to generate signed URLs for documents
  useEffect(() => {
    const generateDocumentUrls = async () => {
      if (uploadedFiles.length === 0) {
        setDocumentUrls({});
        return;
      }
      
      // Prevent multiple simultaneous URL generations
      if (isGeneratingUrls) {
        return;
      }
      
      setIsGeneratingUrls(true);
      console.log('Generating URLs for documents:', uploadedFiles.map(f => f.name));
      
      try {
        const urlPromises = uploadedFiles.map(async (file) => {
          const doc = documents.find((d: any) => d.id === file.id);
          if (doc) {
            const storagePath = doc.storage_path_supabase || doc.storage_path_s3;
            
            if (storagePath) {
              try {
                const { data, error } = await supabase.storage
                  .from('documents')
                  .createSignedUrl(storagePath, 3600); // 1 hour expiry

                if (error) {
                  console.error(`Error generating URL for ${file.name}:`, error);
                  return { id: file.id, url: null };
                }
                
                return { id: file.id, url: data.signedUrl };
              } catch (error) {
                console.error(`Failed to generate URL for document ${file.name}:`, error);
                return { id: file.id, url: null };
              }
            } else {
              console.warn(`No storage path found for document ${file.name}`);
            }
          }
          return { id: file.id, url: null };
        });

        const urlResults = await Promise.all(urlPromises);
        const urlMap = urlResults.reduce((acc, result) => {
          if (result.url) {
            acc[result.id] = result.url;
          }
          return acc;
        }, {} as Record<string, string>);

        console.log(`Generated ${Object.keys(urlMap).length} document URLs`);
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
  }, [uploadedFiles, documents, isGeneratingUrls]); // Include isGeneratingUrls to prevent race conditions

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateChatTitle = (message: string): string => {
    const words = message.split(' ').slice(0, 3);
    return words.join(' ') + (message.split(' ').length > 3 ? '...' : '');
  };

  const createNewChat = async () => {
    if (!inputValue.trim()) {
      setCurrentConversationId(null);
      return;
    }

    try {
      const title = generateChatTitle(inputValue);
      const userMessageContent = inputValue;
      
      console.log('Creating new chat with title:', title);
      
      // Check if message references any documents
      const mentionedDocuments: string[] = [];
      documentsWithUrls.forEach(file => {
        if (inputValue.toLowerCase().includes(file.name.toLowerCase())) {
          mentionedDocuments.push(file.id);
        }
      });
      
      // Create conversation with any referenced document IDs
      const newConversation = await createConversation(title, mentionedDocuments);
      const newConversationId = newConversation.id;
      
      console.log('Created conversation with ID:', newConversationId);
      
      // Set conversation ID IMMEDIATELY after creation
      setCurrentConversationId(newConversationId);
      
      // Clear input and set loading state
      setInputValue('');
      setIsLoading(true);
      
      // Generate AI response
      const aiResponse = await generateAIResponse(userMessageContent);
      console.log('Generated AI response:', aiResponse.substring(0, 50) + '...');

      // Create a single chat log entry with both prompt and response
      const { error: chatError } = await supabase
        .from('chat_logs')
        .insert({
          session_id: newConversationId,
          prompt: userMessageContent,
          response: aiResponse,
        });
        
      if (chatError) throw chatError;
      console.log('Chat log created with prompt and response');
      
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
    setCurrentConversationId(chat.id);
  };

  const deleteChat = async (chatId: string) => {
    try {
      await deleteConversation(chatId);
      if (currentConversationId === chatId) {
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      // Show user-friendly error message
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
        : [...prev, fileId]
    );
  };
  
  const deleteDocument = async (documentId: string) => {
    try {
      // First, remove the document from the current conversation's document_uuid array
      if (currentConversationId) {
        const currentConv = conversations.find((conv: any) => conv.id === currentConversationId);
        if (currentConv && currentConv.document_uuid) {
          const updatedDocumentIds = currentConv.document_uuid.filter((id: string) => id !== documentId);
          
          await updateConversation(currentConversationId, {
            document_uuid: updatedDocumentIds
          });
        }
      }

      // Remove from selected documents for analysis
      setSelectedDocumentsForAnalysis(prev => prev.filter(id => id !== documentId));

      // Close document viewer if the deleted document is currently being viewed
      if (selectedDocument && selectedDocument.id === documentId) {
        setSelectedDocument(null);
      }

      // Delete the document from the database
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh documents to update the UI
      await refreshDocuments();
      
      console.log('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document. Please try again.');
    }
  };

  const generateAIResponse = async (message: string, conversationHistory?: Message[]): Promise<string> => {
    try {
      // Check if Gemini is properly configured
      const status = checkGeminiStatus();
      if (status !== 'loaded') {
        throw new Error(`Gemini API key is ${status}`);
      }

      // Build conversation context
      let prompt = '';
      
      // Add conversation history for context (last 10 messages)
      if (conversationHistory && conversationHistory.length > 0) {
        const recentMessages = conversationHistory.slice(-10);
        prompt += "Previous conversation context:\n";
        recentMessages.forEach(msg => {
          prompt += `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        });
        prompt += "\n";
      }
      
      // Check if there are selected documents for analysis
      if (selectedDocumentsForAnalysis.length > 0) {
        prompt += "Note: The user has selected the following documents for analysis: ";
        const selectedDocs = documentsWithUrls.filter(file => selectedDocumentsForAnalysis.includes(file.id));
        prompt += selectedDocs.map(doc => doc.name).join(', ');
        prompt += ". Please reference these documents in your response if relevant.\n\n";
      }
      
      // Check if message references any uploaded files
      const hasFileReference = documentsWithUrls.some(file => 
        message.toLowerCase().includes(file.name.toLowerCase())
      );
      
      if (hasFileReference) {
        prompt += "The user has referenced uploaded documents. Please provide helpful analysis and insights about the documents they've mentioned.\n\n";
      }
      
      // Add the current user message
      prompt += `Current user message: ${message}`;
      
      // Generate response using the service
      const response = await generateGeminiResponse(prompt);
      return response;
      
    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Fallback response
      if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
        return "Hello! I'm your AI assistant powered by Google Gemini. How can I help you today?";
      }
      
      const hasFileReference = documentsWithUrls.some(file => 
        message.toLowerCase().includes(file.name.toLowerCase())
      );
      
      if (hasFileReference) {
        return "I can see you've referenced one of your uploaded documents. I'm ready to help you analyze and understand your documents. What specific information would you like me to help you with?";
      }
      
      return "I'm having trouble connecting to the AI service right now. Please try again in a moment.";
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
      
      // Check if message references any documents
      let documentReferences: string[] = [];
      documentsWithUrls.forEach(file => {
        if (inputValue.toLowerCase().includes(file.name.toLowerCase())) {
          documentReferences.push(file.id);
        }
      });
      
      // If we found document references, update the conversation
      if (documentReferences.length > 0) {
        const currentConv = conversations.find((conv: any) => conv.id === conversationId);
        if (currentConv) {
          const existingIds = currentConv.document_uuid || [];
          const combinedIds = [...new Set([...existingIds, ...documentReferences])];
          
          await updateConversation(conversationId, {
            document_uuid: combinedIds
          });
        }
      }

      // Clear input immediately
      setInputValue('');
      
      // Now set loading state for AI response
      setIsLoading(true);

      // Get conversation history for context
      const conversationHistory = currentChat?.messages || [];

      // Generate AI response with conversation context
      const aiResponse = await generateAIResponse(userMessage, conversationHistory);
      
      // Create a single chat log entry with both prompt and response
      const { error: chatError } = await supabase
        .from('chat_logs')
        .insert({
          session_id: conversationId,
          prompt: userMessage,
          response: aiResponse,
        });
        
      if (chatError) throw chatError;
      
      // Add another small delay for data consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Refresh the chat messages to display both prompt and response
      await refreshChats();
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };

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
    const validFiles = files.filter(file => 
      file.type.startsWith('text/') || 
      file.type === 'application/pdf' ||
      file.type.includes('document') ||
      file.type.includes('word')
    );

    if (validFiles.length === 0) {
      alert('Please upload valid document files (PDF, DOC, DOCX, TXT)');
      return;
    }

    setIsUploading(true);

    try {
      // Array to collect document IDs
      const uploadedDocumentIds: string[] = [];
      
      for (const file of validFiles) {
        // Upload document and get the result
        const uploadedDoc = await uploadDocument(file, true);
        if (uploadedDoc && uploadedDoc.id) {
          uploadedDocumentIds.push(uploadedDoc.id);
        }
      }
      
      // Refresh documents to get the latest data
      await refreshDocuments();
      
      // If we have a current conversation, update its document_uuid array
      if (currentConversationId && uploadedDocumentIds.length > 0) {
        const currentConv = conversations.find((conv: any) => conv.id === currentConversationId);
        if (currentConv) {
          const existingIds = currentConv.document_uuid || [];
          const combinedIds = [...new Set([...existingIds, ...uploadedDocumentIds])];
          
          await updateConversation(currentConversationId, {
            document_uuid: combinedIds
          });
        }
      }
      // If no current conversation exists but we have documents, create one
      else if (uploadedDocumentIds.length > 0 && !currentConversationId) {
        const title = validFiles.length === 1 
          ? `Document: ${validFiles[0].name}` 
          : `Documents (${validFiles.length})`;
        
        const newConversation = await createConversation(title, uploadedDocumentIds);
        setCurrentConversationId(newConversation.id);
      }
      
      const fileNames = validFiles.map(f => f.name).join(', ');
      const uploadMessage = validFiles.length === 1 
        ? `I've uploaded "${fileNames}". Please analyze this document.`
        : `I've uploaded ${validFiles.length} files: ${fileNames}. Please analyze these documents.`;
      
      setInputValue(prev => prev + (prev ? '\n\n' : '') + uploadMessage);
      
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
        createNewChat={createNewChat}
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
            <h2 className="text-4xl top-0 font-Poppins font-semibold bg-gradient-to-l from-purple-500 to-black bg-clip-text text-transparent">AI Assistant</h2>
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
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

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
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
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
