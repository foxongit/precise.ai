import { useState, useEffect } from 'react';
import { MessageSquare, Upload, FileText, RefreshCw } from 'lucide-react';

interface Session {
  session_id: string;
  name: string;
  created_at: string;
}

interface Activity {
  id: string;
  type: 'session' | 'upload' | 'document' | string;
  message: string;
  timestamp: Date;
  sessionId: string;
}

interface ActivityLogProps {
  currentSessionId?: string | null;
  sessions?: Session[];
}

export default function ActivityLog({ currentSessionId, sessions = [] }: ActivityLogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Generate activity data based on sessions
    setIsLoading(true);
    
    if (sessions.length === 0) {
      setActivities([]);
      setIsLoading(false);
      return;
    }
    
    // Create a list of activities from sessions data
    const allActivities: Activity[] = [];
    
    // Add session creation activities
    sessions.forEach(session => {
      // Session creation activity
      allActivities.push({
        id: `session-${session.session_id}`,
        type: 'session',
        message: `Created conversation: ${session.name}`,
        timestamp: new Date(session.created_at),
        sessionId: session.session_id
      });
    });
    
    // Sort activities by timestamp (newest first)
    allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    setActivities(allActivities);
    setIsLoading(false);
  }, [sessions]);

  // Filter activities if a current session is selected
  const filteredActivities = currentSessionId 
    ? activities.filter(activity => activity.sessionId === currentSessionId)
    : activities;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'session': return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'upload': return <Upload className="w-4 h-4 text-green-500" />;
      case 'document': return <FileText className="w-4 h-4 text-blue-500" />;
      default: return <MessageSquare className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: Date | undefined) => {
    if (!timestamp) return '';
    return timestamp.toLocaleString();
  };

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Activity Log</h3>
        {currentSessionId && (
          <span className="text-xs bg-purple-100 text-purple-800 py-1 px-2 rounded-full">
            Filtered by current session
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {isLoading ? (
          <div className="text-center py-6">
            <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
            <p className="text-gray-500">Loading activities...</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No activities to display</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
