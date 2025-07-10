// import { FileText, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
// import { UploadedFile } from '../types';

// interface StatusIconProps {
//   status: string;
// }

// interface DocumentListProps {
//   documents: UploadedFile[];
//   searchQuery: string;
//   selectedDocument: UploadedFile | null;
//   onSelectDocument: (doc: UploadedFile) => void;
//   selectedDocumentsForAnalysis: string[];
//   onToggleDocumentSelection: (docId: string) => void;
//   documentStatuses: Record<string, string>;
// }

// export default function DocumentList({ 
//   documents = [],
//   searchQuery = '',
//   selectedDocument = null,
//   onSelectDocument,
//   selectedDocumentsForAnalysis = [],
//   onToggleDocumentSelection,
//   documentStatuses = {}
// }: DocumentListProps) {
//   // Filter documents by search query
//   const filteredDocuments = documents.filter(doc => 
//     doc.name.toLowerCase().includes(searchQuery.toLowerCase())
//   );
  
//   // Get document status with fallback
//   const getDocumentStatus = (doc: UploadedFile): string => {
//     return documentStatuses[doc.id] || doc.status || 'unknown';
//   };

//   // Status icon component
//   const StatusIcon = ({ status }: StatusIconProps) => {
//     switch(status) {
//       case 'completed':
//         return <CheckCircle className="w-4 h-4 text-green-500" />;
//       case 'processing':
//       case 'uploading':
//         return <Clock className="w-4 h-4 text-yellow-500" />;
//       case 'failed':
//         return <XCircle className="w-4 h-4 text-red-500" />;
//       default:
//         return <Clock className="w-4 h-4 text-gray-500" />;
//     }
//   };

//   return (
//     <div className="flex-1 overflow-y-auto">
//       {filteredDocuments.length === 0 ? (
//         <div className="h-full flex flex-col items-center justify-center text-center p-4">
//           <FileText className="h-12 w-12 text-gray-300 mb-3" />
//           <h3 className="text-lg font-medium text-gray-700 mb-1">No documents found</h3>
//           <p className="text-gray-500 text-sm max-w-xs">
//             {searchQuery 
//               ? `No documents match your search: "${searchQuery}"`
//               : "Upload a document to get started"}
//           </p>
//         </div>
//       ) : (
//         <div className="p-4 grid gap-3">
//           {filteredDocuments.map(doc => (
//             <div 
//               key={doc.id}
//               className={`border rounded-lg overflow-hidden cursor-pointer transition-all ${
//                 selectedDocument?.id === doc.id 
//                   ? 'border-purple-500 shadow-sm' 
//                   : 'border-gray-200 hover:border-purple-200'
//               }`}
//               onClick={() => onSelectDocument(doc)}
//             >
//               <div className="flex items-center p-3 bg-white">
//                 <div className="flex-shrink-0 mr-3">
//                   <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
//                     getDocumentStatus(doc) === 'completed' 
//                       ? 'bg-green-100' 
//                       : getDocumentStatus(doc) === 'failed'
//                       ? 'bg-red-100'
//                       : 'bg-yellow-100'
//                   }`}>
//                     <FileText className="w-5 h-5 text-gray-700" />
//                   </div>
//                 </div>
                
//                 <div className="min-w-0 flex-1">
//                   <h3 className="text-sm font-medium text-gray-900 truncate">
//                     {doc.name}
//                   </h3>
//                   <div className="flex items-center mt-1">
//                     <StatusIcon status={getDocumentStatus(doc)} />
//                     <span className="text-xs text-gray-500 ml-1">
//                       {getDocumentStatus(doc) === 'completed' 
//                         ? 'Ready for analysis' 
//                         : getDocumentStatus(doc) === 'failed'
//                         ? 'Processing failed'
//                         : 'Processing...'}
//                     </span>
//                   </div>
//                 </div>
                
//                 <button
//                   onClick={(e) => {
//                     e.stopPropagation();
//                     onToggleDocumentSelection(doc.id);
//                   }}
//                   className={`p-2 rounded-full ${
//                     selectedDocumentsForAnalysis.includes(doc.id)
//                       ? 'bg-purple-100 text-purple-700'
//                       : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
//                   }`}
//                   title={selectedDocumentsForAnalysis.includes(doc.id) ? "Selected for analysis" : "Select for analysis"}
//                   disabled={getDocumentStatus(doc) !== 'completed'}
//                 >
//                   <Eye className="w-4 h-4" />
//                 </button>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }
