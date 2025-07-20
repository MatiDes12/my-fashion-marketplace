'use client';

import { useState } from 'react';
import { TestTelegramBot, getTestTelegramConfig } from '@/lib/telegram-test';
import { toast } from 'react-hot-toast';

export default function TelegramTestPage() {
  const [bot] = useState(() => new TestTelegramBot(getTestTelegramConfig()));
  const [messageLog, setMessageLog] = useState<any[]>([]);

  const testOrderNotification = async () => {
    try {
      await bot.sendOrderNotification('test-user', {
        id: 'order-123',
        product: { title: 'Test Product' },
        total_price: 1500,
        order_status: 'confirmed',
        buyer: { full_name: 'Test Customer', phone: '+251912345678' },
        created_at: new Date().toISOString()
      });
      
      setMessageLog(bot.getMessageLog());
      toast.success('Order notification test sent!');
    } catch (error) {
      toast.error('Failed to send test notification');
    }
  };

  const testPaymentNotification = async () => {
    try {
      await bot.sendPaymentNotification('test-user', {
        order_id: 'order-123',
        amount: 1500,
        method: 'telebirr',
        status: 'SUCCESS'
      });
      
      setMessageLog(bot.getMessageLog());
      toast.success('Payment notification test sent!');
    } catch (error) {
      toast.error('Failed to send test notification');
    }
  };

  const testDeliveryUpdate = async () => {
    try {
      await bot.sendDeliveryUpdate('test-user', {
        order_id: 'order-123',
        status: 'in_transit',
        notes: 'Package is on the way',
        updated_at: new Date().toISOString()
      });
      
      setMessageLog(bot.getMessageLog());
      toast.success('Delivery update test sent!');
    } catch (error) {
      toast.error('Failed to send test notification');
    }
  };

  const testAdminAlert = async () => {
    try {
      await bot.sendAdminAlert('This is a test admin alert message', 'info');
      
      setMessageLog(bot.getMessageLog());
      toast.success('Admin alert test sent!');
    } catch (error) {
      toast.error('Failed to send test notification');
    }
  };

  const clearLog = () => {
    bot.clearMessageLog();
    setMessageLog([]);
    toast.success('Message log cleared!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Telegram Integration Test</h1>
        <div className="text-sm text-gray-500 bg-yellow-50 px-3 py-1 rounded-full">
          Test Mode - No Real Bot Required
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-yellow-800 font-medium">Test Mode Active</span>
        </div>
        <p className="text-yellow-700 text-sm mt-1">
          This page allows you to test the Telegram integration without a real bot. 
          Messages will be logged to the console and displayed below instead of being sent to Telegram.
        </p>
      </div>

      {/* Test Buttons */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Notifications</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={testOrderNotification}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Test Order Notification
          </button>
          
          <button
            onClick={testPaymentNotification}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
          >
            Test Payment Notification
          </button>
          
          <button
            onClick={testDeliveryUpdate}
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Test Delivery Update
          </button>
          
          <button
            onClick={testAdminAlert}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
          >
            Test Admin Alert
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={clearLog}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Clear Message Log
          </button>
        </div>
      </div>

      {/* Message Log */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Message Log</h2>
          <p className="text-sm text-gray-500 mt-1">
            Messages that would be sent to Telegram (check browser console for more details)
          </p>
        </div>
        
        <div className="p-6">
          {messageLog.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>No messages sent yet. Click the test buttons above to see messages here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messageLog.map((message, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      To: {message.chat_id}
                    </span>
                    <span className="text-xs text-gray-500">
                      {message.timestamp ? new Date(message.timestamp).toLocaleString() : 'Now'}
                    </span>
                  </div>
                  <div className="bg-white rounded p-3 border">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                      {message.text}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Next Steps */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Next Steps</h3>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• Wait for your Telegram bot ban to expire (1 month)</li>
          <li>• Create a new bot with @BotFather</li>
          <li>• Get your bot token and chat ID</li>
          <li>• Update environment variables with real values</li>
          <li>• Deploy and set up webhook</li>
          <li>• Test with real notifications</li>
        </ul>
      </div>
    </div>
  );
} 