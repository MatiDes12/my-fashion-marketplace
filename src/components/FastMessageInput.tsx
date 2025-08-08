'use client';

import { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';

interface FastMessageInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function FastMessageInput({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Type a message..." 
}: FastMessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!message.trim() || isSending || disabled) return;

    const content = message.trim();
    setMessage('');
    setIsSending(true);

    try {
      await onSendMessage(content);
    } catch (error) {
      console.error('Error sending message:', error);
      // Optionally restore the message if it failed
      setMessage(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  return (
    <div className="flex items-end gap-2 p-4 border-t bg-white">
      <div className="flex-1 relative">
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled || isSending}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          rows={1}
          maxLength={1000}
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          {message.length}/1000
        </div>
      </div>
      
      <button
        onClick={handleSend}
        disabled={!message.trim() || isSending || disabled}
        className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSending ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <PaperAirplaneIcon className="w-5 h-5" />
        )}
      </button>
    </div>
  );
} 