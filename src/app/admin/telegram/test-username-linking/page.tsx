'use client';

import { useState } from 'react';

export default function TestUsernameLinking() {
  const [username, setUsername] = useState('');
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const testUsernameLinking = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/telegram/test-username-linking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          chatId: parseInt(chatId),
          firstName: 'Test',
          lastName: 'User'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to test username linking');
      }
    } catch (err) {
      setError('Error testing username linking');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkPendingLinks = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/telegram/check-pending-links');
      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to check pending links');
      }
    } catch (err) {
      setError('Error checking pending links');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Username Linking</h1>

      <div className="space-y-6">
        {/* Test Username Linking */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Test Username Linking Process</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Username (without @)</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g., MATI_xT"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Chat ID</label>
              <input
                type="number"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g., 5265283795"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={testUsernameLinking}
              disabled={loading || !username || !chatId}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Username Linking'}
            </button>
          </div>
        </div>

        {/* Check Pending Links */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Check Pending Links</h2>
          
          <button
            onClick={checkPendingLinks}
            disabled={loading}
            className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check All Pending Links'}
          </button>
        </div>

        {/* Results */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <h3 className="font-semibold mb-2">Result:</h3>
            <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
} 