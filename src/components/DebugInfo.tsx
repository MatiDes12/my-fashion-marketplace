'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function DebugInfo() {
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const getDebugInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionInfo(session);

      if (session) {
        const { data: { user } } = await supabase.auth.getUser();
        setUserInfo(user);

        // Also check the database role
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', user?.id)
          .single();
          
        if (data) {
          setUserInfo(prev => ({ ...prev, dbRole: data.role }));
        }
      }
    };

    getDebugInfo();
  }, []);

  if (!showDebug) {
    return (
      <button 
        onClick={() => setShowDebug(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full z-50"
      >
        Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 max-w-md max-h-96 overflow-auto z-50">
      <div className="flex justify-between mb-2">
        <h3 className="font-bold">Debug Info</h3>
        <button onClick={() => setShowDebug(false)} className="text-gray-500">Close</button>
      </div>
      
      <div className="mb-2">
        <h4 className="font-semibold">Session:</h4>
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
          {sessionInfo ? JSON.stringify(sessionInfo, null, 2) : 'No session'}
        </pre>
      </div>
      
      <div>
        <h4 className="font-semibold">User:</h4>
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
          {userInfo ? JSON.stringify(userInfo, null, 2) : 'No user'}
        </pre>
      </div>
    </div>
  );
} 