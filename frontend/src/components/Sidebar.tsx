import { useState, useRef, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, MessageSquare, FileText, User as UserIcon, Settings, Trash2, LogOut, Eye, EyeOff, ChevronDown, ChevronRight, MessageSquarePlus, PanelLeft } from 'lucide-react';
import { SidebarProps, UserProfile, Chat, UploadedFile } from '../types';

export default function Sidebar({
  user,
  onLogout,
  sidebarCollapsed,
  setSidebarCollapsed,
  searchQuery,
  setSearchQuery,
  chats = [],
  currentChat,
  filteredFiles = [],
  selectedDocument,
  selectedDocumentsForAnalysis = [],
  currentConversationId,
  createNewChat,
  switchToChat,
  deleteChat,
  viewDocument,
  setSelectedDocument,
  toggleDocumentForAnalysis,
  deleteDocument
}: SidebarProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [chatHistoryExpanded, setChatHistoryExpanded] = useState<boolean>(true);
  const [documentsExpanded, setDocumentsExpanded] = useState<boolean>(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // User profile from props
  const userProfile: UserProfile = {
    name: user?.user_metadata?.name || (user?.email ? user.email.split('@')[0] : 'User'),
    email: user?.email || '',
    avatar: user?.user_metadata?.avatar_url
  };

  const filteredChats = chats.filter((chat: Chat) => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.messages.some(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setShowSettings(false);
    onLogout();
  };

  return (
    <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-linear-to-b from-purple-950 from-1%  to-black to-15%  flex flex-col h-full transition-all duration-300`}>
      {/* Header */}
      <div className="p-4 flex-shrink-0">
        {sidebarCollapsed ? (
          // Collapsed layout - stack buttons vertically
          <div className="flex flex-col items-center space-y-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
            >
              <PanelLeft className="w-5 h-5 text-white cursor-pointer" />
            </button>
            <button
              onClick={createNewChat}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
              title="Begin a New Chat"
            >
              <MessageSquarePlus className="w-5 h-5 text-white" />
            </button>
          </div>
        ) : (
          // Expanded layout - normal header
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-Poppins text-white">Precise.ai</span>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-gray-700 rounded transition-colors"
              >
                <PanelLeft className="w-5 h-5 text-white cursor-pointer" />
              </button>
            </div>
            
            <button 
              className="w-full flex items-center cursor-pointer space-x-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              onClick={createNewChat}
            >
              <Plus className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Begin a New Chat</span>
            </button>
          </>
        )}
      </div>

      {/* Search - Only show when expanded */}
      {!sidebarCollapsed && (
        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Content Sections */}
      <div className="flex-1 overflow-y-auto px-4 flex flex-col min-h-0 sidebar-main-scroll">
        {/* Chat History Section */}
        <div className="mb-6 flex-shrink-0">
          {sidebarCollapsed ? (
            <div className="flex justify-center">
              {/* <button 
                className="p-2 hover:bg-gray-700 rounded transition-colors"
                title="Chat History"
              >
                <MessageSquare className="w-5 h-5 text-white" />
              </button> */}
            </div>
          ) : (
            <>
              <button
                onClick={() => setChatHistoryExpanded(!chatHistoryExpanded)}
                className="flex cursor-pointer items-center justify-between w-full text-sm font-medium text-gray-300 mb-3 hover:text-white transition-colors"
              >
                <span>Chat History</span>
                {chatHistoryExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              
              {chatHistoryExpanded && (
                <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                  <div className="space-y-1 pr-2">
                    {filteredChats.length === 0 ? (
                      <p className="text-gray-400 text-sm py-2">No chats yet</p>
                    ) : (
                      filteredChats.map((chat: Chat) => (
                        <div key={`chat-${chat.id}`} className="group relative">
                          <button
                            onClick={() => switchToChat(chat)}
                            className={`w-full cursor-pointer flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                              currentChat?.id === chat.id ? 'bg-gray-700' : 'hover:bg-gray-700'
                            }`}
                          >
                            <MessageSquare className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            <span className="text-gray-300 text-sm truncate flex-1 text-left">
                              {chat.title}
                            </span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === chat.id ? null : chat.id);
                            }}
                            className="cursor-pointer absolute right-2 top-1/2 transform -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-600 rounded transition-opacity"
                          >
                            <MoreHorizontal className="w-4 h-4 text-gray-300" />
                          </button>
                          {activeMenuId === chat.id && (
                            <div className="absolute right-0 top-8 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-[120px]" ref={menuRef}>
                              <button
                                onClick={() => deleteChat(chat.id)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Documents Section */}
        <div className="mb-6 flex-shrink-0">
          {sidebarCollapsed ? (
            <div className="flex justify-center">
              {/* <button
                className="p-2 hover:bg-gray-700 rounded transition-colors"
                title="Documents"
              >
                <FileText className="w-5 h-5 text-white" />
              </button> */}
            </div>
          ) : (
            <>
            <div className="flex items-center justify-between w-full mb-3">
                <div
                  onClick={() => setDocumentsExpanded(!documentsExpanded)}
                  className="flex cursor-pointer items-center justify-between w-full text-sm font-medium text-gray-300 mb-3 hover:text-white transition-colors"
                >
                  <span>Choose document</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle document viewer or open first available document
                        if (selectedDocument) {
                          // If document viewer is open, close it
                          setSelectedDocument(null);
                        } else {
                          // If no document viewer, open the first available document
                          if (filteredFiles.length > 0) {
                            viewDocument(filteredFiles[0]);
                          }
                        }
                      }}
                      className="p-1 hover:bg-gray-600 rounded transition-colors cursor-pointer"
                      title={selectedDocument ? "Close document viewer" : "Open document viewer"}
                    >
                      {selectedDocument ? (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    {documentsExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>
              
              {documentsExpanded && (
              <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                <div className="space-y-1 pr-2">
                  {!currentConversationId ? (
                    <p className="text-gray-400 text-sm py-2">Select a chat to view documents</p>
                  ) : filteredFiles.length === 0 ? (
                    <p className="text-gray-400 text-sm py-2">No documents in this chat</p>
                  ) : (
                    <>
                      {filteredFiles.map((file: UploadedFile) => (
                        <div key={`doc-${file.id}`} className="group flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700 transition-colors">
                          {/* Document info */}
                          <button 
                            onClick={() => viewDocument(file)}
                            className="cursor-pointer flex items-center space-x-2 flex-1 min-w-0"
                          >
                            <FileText className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-gray-300 text-sm truncate">
                                {file.name}
                              </span>
                            </div>
                          </button>
                          
                          {/* Action buttons */}
                          <div className="flex items-center space-x-1">
                            {/* Checkbox for analysis */}
                            <input
                              type="checkbox"
                              checked={selectedDocumentsForAnalysis.includes(file.id)}
                              onChange={() => toggleDocumentForAnalysis(file.id)}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                              title="Include in analysis"
                            />
                            
                            {/* Delete button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Are you sure you want to delete "${file.name}"?`)) {
                                  deleteDocument(file.id);
                                }
                              }}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white rounded transition-all duration-200"
                              title="Delete document"
                            >
                              <Trash2 className="w-3 h-3 text-red-400 hover:text-white" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 flex-shrink-0 relative">
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center space-y-3">
            {/* User Icon */}
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-white" />
            </div>
            {/* Settings Icon */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-white truncate">{userProfile.name}</span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
              
              {/* Settings menu for expanded sidebar */}
              {showSettings && (
                <div className="absolute bottom-8 right-0 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-[120px]">
                  <button
                    onClick={handleLogout}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 text-red-500"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Settings menu for collapsed sidebar */}
        {sidebarCollapsed && showSettings && (
          <div className="absolute bottom-16 left-16 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-[120px]">
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 text-red-500"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
