'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { 
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import { pusherClient } from '@/lib/pusher-client';
import { useChatStatus } from '@/hooks/useChatStatus';

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role?: string;
  is_admin?: boolean;
  user_chat_status: {
    is_online: boolean;
    last_seen: string;
  };
}

interface ChatRoom {
  id: string;
  room_type: string;
  seller_id: string;
  admin_id: string;
  last_message_at: string;
  seller: User;
  admin: User;
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_type: 'admin' | 'seller' | 'customer';
  message: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
  sender: User;
}

export default function AdminChatPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'sellers' | 'recent'>('sellers');
  const [channel, setChannel] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponent();

  // Handle real-time status updates
  const handleStatusUpdate = (userId: string, isOnline: boolean) => {
    setUsers(prev => prev.map(user => 
      user.id === userId 
        ? { ...user, user_chat_status: { ...user.user_chat_status, is_online: isOnline } }
        : user
    ));
  };

  // Initialize chat status
  useChatStatus(currentUser, handleStatusUpdate);

  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadUsers();
      loadRooms();
    }
  }, [currentUser]);

  // Subscribe to room channel when selectedRoom changes
  useEffect(() => {
    if (selectedRoom && !selectedRoom.id.startsWith('temp-')) {
      // Unsubscribe from previous channel
      if (channel) {
        channel.unsubscribe();
      }

      // Subscribe to new room channel
      const newChannel = pusherClient.subscribe(`room-${selectedRoom.id}`);
      
      newChannel.bind('new_message', (message: ChatMessage) => {
        console.log('Received new message:', message);
        setMessages(prev => {
          // Remove any temp message with the same text and sender (within last 5 seconds)
          const fiveSecondsAgo = Date.now() - 5000;
          const filtered = prev.filter(m => {
            if (m.id.startsWith('temp-')) {
              const tempTime = parseInt(m.id.replace('temp-', ''));
              return !(tempTime > fiveSecondsAgo && m.message === message.message && m.sender_id === message.sender_id);
            }
            return true;
          });
          
          // Check if message already exists to prevent duplicates
          const exists = filtered.some(m => m.id === message.id);
          if (exists) return filtered;
          
          return [...filtered, message];
        });
        if (selectedRoom && message.room_id === selectedRoom.id) {
          scrollToBottom();
        }
      });

      setChannel(newChannel);
    }

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [selectedRoom]);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/chat/users?userType=admin');
      const data = await response.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const loadRooms = async () => {
    try {
      const response = await fetch('/api/chat/rooms?userType=admin&roomType=admin_seller');
      const data = await response.json();
      if (data.rooms) {
        // Enhance rooms with user data for better display
        const enhancedRooms = data.rooms.map((room: any) => ({
          ...room,
          seller: users.find(u => u.id === room.seller_id) || room.seller,
          admin: users.find(u => u.id === room.admin_id) || room.admin,
          messages: room.messages || []
        }));
        setRooms(enhancedRooms);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('Failed to load chat rooms');
    }
  };

  const createOrJoinRoom = async (sellerId: string) => {
    try {
      // First, check if a room already exists
      const existingRoom = rooms.find(r => 
        r.seller_id === sellerId && r.admin_id === currentUser.id
      );

      if (existingRoom) {
        // Room exists, just select it and load messages
        setSelectedRoom(existingRoom);
        await loadMessages(existingRoom.id);
        return;
      }

      // If no room exists, create a temporary room for the chat interface
      // but don't save it to the database until a message is sent
      const seller = users.find(u => u.id === sellerId);
      if (seller) {
        const tempRoom: ChatRoom = {
          id: `temp-${Date.now()}`,
          room_type: 'admin_seller',
          seller_id: sellerId,
          admin_id: currentUser.id,
          last_message_at: new Date().toISOString(),
          seller,
          admin: currentUser,
          messages: []
        };
        
        setSelectedRoom(tempRoom);
        setMessages([]);
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
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || !currentUser) return;

    const messageText = newMessage.trim();
    
    try {
      // Clear input immediately for better UX
      setNewMessage('');
      setIsTyping(false);

      // If this is a temp room, create a real room first
      let roomId = selectedRoom.id;
      if (selectedRoom.id.startsWith('temp-')) {
        try {
          const response = await fetch('/api/chat/rooms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              roomType: 'admin_seller',
              sellerId: selectedRoom.seller_id,
              adminId: currentUser.id
            }),
          });

          const data = await response.json();
          if (data.room) {
            roomId = data.room.id;
            
            // Replace temp room with real room
            const realRoom: ChatRoom = {
              ...data.room,
              seller: selectedRoom.seller,
              admin: currentUser,
              messages: []
            };
            
            setRooms(prev => [realRoom, ...prev]);
            setSelectedRoom(realRoom);
          }
        } catch (error) {
          console.error('Error creating room:', error);
          toast.error('Failed to create chat room');
          setNewMessage(messageText);
          return;
        }
      }

      // Add message to local state immediately (optimistic update)
      const tempMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        room_id: roomId,
        sender_id: currentUser.id,
        sender_type: 'admin',
        message: messageText,
        message_type: 'text',
        is_read: false,
        created_at: new Date().toISOString(),
        sender: currentUser
      };

      setMessages(prev => [...prev, tempMessage]);
      scrollToBottom();

      // Send message via API
      const response = await fetch('/api/pusher/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: roomId,
          senderId: currentUser.id,
          senderType: 'admin',
          message: messageText,
          messageType: 'text'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Auto-remove temp message after 10 seconds if not replaced
      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      }, 10000);

      // Fallback: reload messages from server after 1 second
      setTimeout(() => {
        if (selectedRoom) loadMessages(selectedRoom.id);
      }, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      // Restore message if sending failed
      setNewMessage(messageText);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime()) || !dateString || dateString.startsWith('temp-')) {
        return 'Sending...';
      }
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Date formatting error:', error, dateString);
      return 'Sending...';
    }
  };

  const getLastMessage = (room: ChatRoom) => {
    if (room.messages && room.messages.length > 0) {
      const lastMsg = room.messages[room.messages.length - 1];
      return lastMsg.message.length > 50 
        ? lastMsg.message.substring(0, 50) + '...' 
        : lastMsg.message;
    }
    return 'No messages yet';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Users and Rooms */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Admin Chat</h1>
          <p className="text-sm text-gray-500">Chat with sellers</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('sellers')}
            className={`flex-1 py-3 px-4 text-sm font-medium ${
              activeTab === 'sellers' 
                ? 'text-gray-900 border-b-2 border-red-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sellers ({users.length})
          </button>
          <button 
            onClick={() => setActiveTab('recent')}
            className={`flex-1 py-3 px-4 text-sm font-medium ${
              activeTab === 'recent' 
                ? 'text-gray-900 border-b-2 border-red-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Recent Chats ({rooms.filter(r => r.messages && r.messages.length > 0).length})
          </button>
        </div>

        {/* Content based on active tab */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'sellers' ? (
            /* Users List */
            users.map((user) => (
              <div
                key={user.id}
                onClick={() => createOrJoinRoom(user.id)}
                className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <UserCircleIcon className="w-10 h-10 text-gray-400" />
                    <div className="absolute -bottom-1 -right-1">
                      {user.user_chat_status?.is_online ? (
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.full_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user.user_chat_status?.is_online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            /* Recent Chats List */
            rooms.filter(room => room.messages && room.messages.length > 0).map((room) => (
              <div
                key={room.id}
                onClick={async () => {
                  setSelectedRoom(room);
                  await loadMessages(room.id);
                }}
                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                  selectedRoom?.id === room.id ? 'bg-gray-100' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <UserCircleIcon className="w-10 h-10 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {room.seller?.full_name || 'Unknown Seller'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {getLastMessage(room)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                {selectedRoom.seller ? (
                  <UserCircleIcon className="w-8 h-8 text-gray-400" />
                ) : null}
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    {selectedRoom.seller.full_name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedRoom.seller.user_chat_status?.is_online ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => {
                const isOwnMessage = message.sender_id === currentUser?.id;
                return (
                  <div
                    key={`${message.id}-${index}`}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isOwnMessage
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.message}</p>
                      <p className={`text-xs mt-1 ${
                        isOwnMessage ? 'text-red-100' : 'text-gray-500'
                      }`}>
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
                    <p className="text-sm italic">Typing...</p>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <UserCircleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a seller to start chatting
              </h3>
              <p className="text-gray-500">
                Choose a seller from the list to begin a conversation
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 