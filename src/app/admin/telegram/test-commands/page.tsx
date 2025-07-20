'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function TestCommandsPage() {
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);

  const testCommand = async (command: string) => {
    if (!chatId) {
      toast.error('Please enter a Chat ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/telegram/test-new-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: parseInt(chatId),
          command
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`${data.message} to Chat ID: ${chatId}`);
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error testing command:', error);
      toast.error('Failed to test command');
    } finally {
      setLoading(false);
    }
  };

  const commands = [
    { name: 'Search Instructions', command: 'search', description: 'Test /search command' },
    { name: 'Categories', command: 'categories', description: 'Test /categories command' },
    { name: 'All Deals', command: 'deals', description: 'Test /deals command' },
    { name: 'Products Overview', command: 'products', description: 'Test /products command' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Test New Telegram Bot Commands</h1>
        
        <div className="mb-6">
          <label htmlFor="chatId" className="block text-sm font-medium text-gray-700 mb-2">
            Chat ID to Test
          </label>
          <input
            type="number"
            id="chatId"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Enter Telegram Chat ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">
            Enter the Telegram Chat ID where you want to test the commands
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {commands.map((cmd) => (
            <div key={cmd.command} className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{cmd.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{cmd.description}</p>
              <button
                onClick={() => testCommand(cmd.command)}
                disabled={loading || !chatId}
                className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Testing...' : `Test /${cmd.command}`}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">New Commands Added:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <code>/search</code> - Product search instructions</li>
            <li>• <code>/categories</code> - Browse products by category</li>
            <li>• <code>/deals</code> - View all active deals & promotions</li>
            <li>• <code>/products</code> - Latest products overview</li>
          </ul>
        </div>

        <div className="mt-6 p-4 bg-green-50 rounded-lg">
          <h3 className="text-lg font-semibold text-green-900 mb-2">Features:</h3>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• Categories show product counts and emojis</li>
            <li>• Deals show total savings and product counts</li>
            <li>• Products show ratings, likes, and store info</li>
            <li>• Interactive buttons for navigation</li>
            <li>• Proper error handling and logging</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 