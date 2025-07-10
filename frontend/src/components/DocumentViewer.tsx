import { useState, useEffect, useRef } from 'react';
import { FileText, X, ChevronDown } from 'lucide-react';
import { UploadedFile } from '../types';

// Updated interface to match the new UI requirements
interface DocumentViewerProps {
  file: UploadedFile;
  onClose: () => void;
  availableFiles: UploadedFile[];
  onFileChange: (file: UploadedFile) => void;
}

export default function DocumentViewer({ 
  file, 
  onClose, 
  availableFiles, 
  onFileChange
}: DocumentViewerProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // CSV content state
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Effect to fetch CSV content
  useEffect(() => {
    const fetchCsvContent = async () => {
      if (file.name.toLowerCase().endsWith('.csv') && file.s3Url) {
        setCsvLoading(true);
        setCsvError(null);
        setCsvContent(null);
        
        try {
          const response = await fetch(file.s3Url);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const text = await response.text();
          setCsvContent(text);
        } catch (error) {
          console.error('Error fetching CSV:', error);
          setCsvError('Failed to load CSV content');
        } finally {
          setCsvLoading(false);
        }
      }
    };

    fetchCsvContent();
  }, [file.s3Url, file.name]);

  // Handle container resize for responsive behavior
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        // Force iframe refresh when container size changes
        const iframes = containerRef.current.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
          // Trigger a re-render by toggling display
          iframe.style.display = 'none';
          iframe.offsetHeight; // Trigger reflow
          iframe.style.display = '';
        });
      }
    };

    // Create ResizeObserver to watch for container changes
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const renderDocumentContent = () => {
    if (!file.s3Url) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-6">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">Document content not available</p>
            <div className="text-xs text-gray-400 space-y-1">
              <p>File: {file.name}</p>
              <p>Storage URL: {file.s3Url || 'Not generated'}</p>
              <p>Try refreshing or re-uploading the document</p>
            </div>
          </div>
        </div>
      );
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    // Handle different file types
    switch (fileExtension) {
      case 'pdf':
        return (
          <iframe
            src={`${file.s3Url}#toolbar=0&navpanes=0&scrollbar=1`}
            className="w-full h-full border-0"
            title={file.name}
            style={{ 
              minHeight: '100%',
              resize: 'none'
            }}
          />
        );
      
      case 'txt':
      case 'md':
        return (
          <iframe
            src={file.s3Url}
            className="w-full h-full border-0"
            title={file.name}
            style={{ 
              minHeight: '100%',
              resize: 'none'
            }}
          />
        );
      
      case 'csv':
        if (csvLoading) {
          return (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                <p className="text-gray-500">Loading CSV content...</p>
              </div>
            </div>
          );
        }
        
        if (csvError) {
          return (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-6">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-red-500 mb-2">{csvError}</p>
                <button
                  onClick={() => window.open(file.s3Url, '_blank')}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Download File
                </button>
              </div>
            </div>
          );
        }
        
        if (csvContent) {
          const lines = csvContent.split('\n').filter(line => line.trim());
          const headers = lines[0]?.split(',') || [];
          const rows = lines.slice(1).map(line => line.split(','));
          
          return (
            <div className="w-full h-full overflow-auto bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-lg font-medium text-gray-800">CSV Data</h4>
                <button
                  onClick={() => window.open(file.s3Url, '_blank')}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Download
                </button>
              </div>
              
              {/* Table view for better CSV display */}
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      {headers.map((header, index) => (
                        <th
                          key={index}
                          className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-900"
                        >
                          {header.replace(/"/g, '').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          >
                            {cell.replace(/"/g, '').trim()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Raw text view toggle */}
              <div className="mt-4">
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                    View Raw CSV Data
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                    {csvContent}
                  </pre>
                </details>
              </div>
            </div>
          );
        }
        
        // Fallback to iframe if no content loaded
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Loading CSV content...</p>
              <button
                onClick={() => window.open(file.s3Url, '_blank')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Download File
              </button>
            </div>
          </div>
        );
      
      case 'xls':
      case 'xlsx':
        return (
          <div className="w-full h-full overflow-hidden">
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.s3Url)}`}
              className="w-full h-full border-0"
              title={file.name}
              style={{ 
                minHeight: '100%',
                resize: 'none',
                transform: 'scale(1)',
                transformOrigin: 'top left'
              }}
            />
          </div>
        );
      
      case 'doc':
      case 'docx':
        return (
          <div className="w-full h-full overflow-hidden">
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.s3Url)}`}
              className="w-full h-full border-0"
              title={file.name}
              style={{ 
                minHeight: '100%',
                resize: 'none',
                transform: 'scale(1)',
                transformOrigin: 'top left'
              }}
            />
          </div>
        );
      
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-50 overflow-hidden p-4">
            <img
              src={file.s3Url}
              alt={file.name}
              className="object-contain"
              style={{ 
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto'
              }}
            />
          </div>
        );
      
      default:
        return (
          <iframe
            src={file.s3Url}
            className="w-full h-full border-0"
            title={file.name}
            style={{ 
              minHeight: '100%',
              resize: 'none'
            }}
          />
        );
    }
  };

  return (
    <div 
      ref={containerRef}
      className="h-full bg-white border-l border-gray-300 flex flex-col min-h-0 overflow-hidden"
    >
      <div className="p-4 border-b border-gray-300 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <h3 className="text-lg font-medium text-gray-800 truncate">{file.name}</h3>
          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {file.name.split('.').pop()?.toUpperCase()}
          </div>
          
          {/* Document Dropdown - positioned right after title */}
          {availableFiles.length > 1 && (
            <div className="relative ml-2" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="p-1 hover:bg-gray-100 rounded flex items-center space-x-1"
                title="Switch document"
              >
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              
              {isDropdownOpen && (
                <div className="absolute left-0 top-8 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
                  {availableFiles.map((availableFile) => (
                    <button
                      key={availableFile.id}
                      onClick={() => {
                        onFileChange(availableFile);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 ${
                        availableFile.id === file.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{availableFile.name}</span>
                        <span className="text-xs text-gray-500">
                          {availableFile.uploadDate.toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2 flex-shrink-0">
          {/* Close Button */}
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded flex-shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden min-h-0 relative">
        {renderDocumentContent()}
      </div>
    </div>
  );
}
