'use client';

import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ChatMessage } from '@/hooks/useFastChat';

interface FastMessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  isLoading?: boolean;
}

export default function FastMessageList({ 
  messages, 
  currentUserId, 
  isLoading = false 
}: FastMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">No messages yet. Start the conversation!</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => {
        const isOwnMessage = message.sender_id === currentUserId;
        const isPending = message.id.startsWith('temp-');
        
        return (
          <div
            key={message.id}
            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                isOwnMessage
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-900'
              } ${isPending ? 'opacity-70' : ''}`}
            >
              {!isOwnMessage && (
                <div className="text-xs font-medium mb-1 text-gray-600">
                  {message.sender_name}
                </div>
              )}
              
              <div className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </div>
              
              <div className={`text-xs mt-1 ${
                isOwnMessage ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {format(new Date(message.created_at), 'HH:mm')}
                {isPending && ' (sending...)'}
                {isOwnMessage && message.is_read && ' ✓'}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
} 