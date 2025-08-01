'use client';

import { useState } from 'react';

export default function TestBotUrl() {
  const [botUrl, setBotUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const testBotUrl = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/telegram/bot-url');
      const data = await response.json();
      
      if (data.success) {
        setBotUrl(data.botUrl);
      } else {
        setError('Failed to get bot URL');
      }
    } catch (err) {
      setError('Error fetching bot URL');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openBot = () => {
    if (botUrl) {
      window.open(botUrl, '_blank');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Test Bot URL</h1>
      
      <div className="space-y-4">
        <button
          onClick={testBotUrl}
          disabled={loading}
          className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Bot URL'}
        </button>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {botUrl && (
          <div className="space-y-2">
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              <strong>Bot URL:</strong> {botUrl}
            </div>
            
            <button
              onClick={openBot}
              className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
            >
              Open Bot
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 