'use client';

import { useState, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { ChatBubbleLeftRightIcon, XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface ChatWidgetProps {
  userType: 'admin' | 'seller';
  targetUserId?: string;
}

export default function ChatWidget({ userType, targetUserId }: ChatWidgetProps) {
  const { socket, isConnected, currentUser } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [targetUser, setTargetUser] = useState<any>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (socket && isConnected && targetUserId) {
      // Load target user info
      loadTargetUser();
      
      // Create or join room
      createOrJoinRoom();
    }
  }, [socket, isConnected, targetUserId]);

  useEffect(() => {
    if (socket) {
      // Listen for new messages
      socket.on('new_message', (message: any) => {
        setMessages(prev => [...prev, message]);
      });

      return () => {
        socket.off('new_message');
      };
    }
  }, [socket]);

  const loadTargetUser = async () => {
    try {
      const response = await fetch(`/api/chat/users?userType=${userType}`);
      const data = await response.json();
      if (data.users) {
        const user = data.users.find((u: any) => u.id === targetUserId);
        setTargetUser(user);
      }
    } catch (error) {
      console.error('Error loading target user:', error);
    }
  };

  const createOrJoinRoom = async () => {
    try {
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomType: 'admin_seller',
          sellerId: userType === 'admin' ? targetUserId : currentUser.id,
          adminId: userType === 'admin' ? currentUser.id : targetUserId
        }),
      });

      const data = await response.json();
      if (data.room) {
        setRoomId(data.room.id);
        socket?.emit('join_room', { roomId: data.room.id });
        loadMessages(data.room.id);
      }
    } catch (error) {
      console.error('Error creating/joining room:', error);
      toast.error('Failed to create chat room');
    }
  };

  const loadMessages = async (roomId: string) => {
    try {
      const response = await fetch(`/api/chat/messages?roomId=${roomId}`);
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !roomId || !socket) return;

    try {
      socket.emit('send_message', {
        roomId,
        senderId: currentUser.id,
        senderType: userType,
        message: newMessage.trim(),
        messageType: 'text'
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isConnected || !targetUserId) {
    return null;
  }

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 p-3 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
      >
        <ChatBubbleLeftRightIcon className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80 h-96 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div>
              <h3 className="font-medium text-gray-900">
                {targetUser?.full_name || 'Chat'}
              </h3>
              <p className="text-sm text-gray-500">
                {isConnected ? 'Online' : 'Offline'}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.sender_id === currentUser?.id
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <p>{message.message}</p>
                  <p className={`text-xs mt-1 ${
                    message.sender_id === currentUser?.id ? 'text-red-100' : 'text-gray-500'
                  }`}>
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 