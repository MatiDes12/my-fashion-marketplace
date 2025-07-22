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
  admin_id?: string;
  customer_id?: string;
  last_message_at: string;
  seller: User;
  admin?: User;
  customer?: User;
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

export default function SellerChatPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'admins' | 'customers' | 'recent'>('admins');
  const [channel, setChannel] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponent();

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
      loadCustomers();
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
      const response = await fetch('/api/chat/users?userType=seller');
      const data = await response.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/chat/customers?sellerId=' + currentUser.id);
      const data = await response.json();
      if (data.customers) {
        setCustomers(data.customers);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
    }
  };

  const loadRooms = async () => {
    try {
      // Load both admin_seller and customer_seller rooms
      const [adminResponse, customerResponse] = await Promise.all([
        fetch('/api/chat/rooms?userType=seller&roomType=admin_seller'),
        fetch('/api/chat/rooms?userType=seller&roomType=customer_seller')
      ]);

      const adminData = await adminResponse.json();
      const customerData = await customerResponse.json();

      const allRooms = [
        ...(adminData.rooms || []),
        ...(customerData.rooms || [])
      ];

      if (allRooms.length > 0) {
        // Enhance rooms with user data for better display
        const enhancedRooms = allRooms.map((room: any) => ({
          ...room,
          seller: users.find(u => u.id === room.seller_id) || room.seller,
          admin: users.find(u => u.id === room.admin_id) || room.admin,
          customer: customers.find(u => u.id === room.customer_id) || room.customer,
          messages: room.messages || []
        }));
        setRooms(enhancedRooms);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('Failed to load chat rooms');
    }
  };

  const createOrJoinRoom = async (userId: string, userType: 'admin' | 'customer' = 'admin') => {
    try {
      // First, check if a room already exists
      const existingRoom = rooms.find(r => {
        if (userType === 'admin') {
          return r.admin_id === userId && r.seller_id === currentUser.id;
        } else {
          return r.customer_id === userId && r.seller_id === currentUser.id;
        }
      });

      if (existingRoom) {
        // Room exists, just select it and load messages
        setSelectedRoom(existingRoom);
        await loadMessages(existingRoom.id);
        return;
      }

      // If no room exists, create a temporary room for the chat interface
      // but don't save it to the database until a message is sent
      const user = userType === 'admin' 
        ? users.find(u => u.id === userId)
        : customers.find(u => u.id === userId);
        
      if (user) {
        const tempRoom: ChatRoom = {
          id: `temp-${Date.now()}`,
          room_type: userType === 'admin' ? 'admin_seller' : 'customer_seller',
          seller_id: currentUser.id,
          ...(userType === 'admin' ? { admin_id: userId, admin: user } : { customer_id: userId, customer: user }),
          last_message_at: new Date().toISOString(),
          seller: currentUser,
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
              roomType: selectedRoom.room_type,
              sellerId: currentUser.id,
              ...(selectedRoom.admin_id ? { adminId: selectedRoom.admin_id } : {}),
              ...(selectedRoom.customer_id ? { customerId: selectedRoom.customer_id } : {})
            }),
          });

          const data = await response.json();
          if (data.room) {
            roomId = data.room.id;
            
            // Replace temp room with real room
            const realRoom: ChatRoom = {
              ...data.room,
              admin: selectedRoom.admin,
              customer: selectedRoom.customer,
              seller: currentUser,
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
        sender_type: 'seller',
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
          senderType: 'seller',
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

  // Filter admins for the tab
  const adminUsers = users.filter(
    u => u.role === 'admin' || (u.role === 'owner' && u.is_admin)
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Sidebar - Users and Rooms */}
      <div className="w-80 bg-white shadow-xl border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <h1 className="text-xl font-bold text-white">Seller Chat</h1>
          <p className="text-blue-100 text-sm mt-1">Connect with admins and customers</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button 
            onClick={() => setActiveTab('admins')}
            className={`flex-1 py-4 px-4 text-sm font-medium transition-all duration-200 ${
              activeTab === 'admins' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="font-semibold">Admins</span>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full mt-1">
                {adminUsers.length}
              </span>
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('customers')}
            className={`flex-1 py-4 px-4 text-sm font-medium transition-all duration-200 ${
              activeTab === 'customers' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="font-semibold">Customers</span>
              <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full mt-1">
                {customers.length}
              </span>
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('recent')}
            className={`flex-1 py-4 px-4 text-sm font-medium transition-all duration-200 ${
              activeTab === 'recent' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="font-semibold">Recent</span>
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full mt-1">
                {rooms.filter(r => r.messages && r.messages.length > 0).length}
              </span>
            </div>
          </button>
        </div>

        {/* Content based on active tab */}
        <div className="flex-1 overflow-y-auto bg-white">
          {activeTab === 'admins' ? (
            /* Admins List */
            adminUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => createOrJoinRoom(user.id, 'admin')}
                className="p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-all duration-200 group"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {user.full_name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div className="absolute -bottom-1 -right-1">
                      {user.user_chat_status?.is_online ? (
                        <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                      ) : (
                        <div className="w-4 h-4 bg-gray-400 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600">
                      {user.full_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user.user_chat_status?.is_online ? '🟢 Online' : '⚪ Offline'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : activeTab === 'customers' ? (
            /* Customers List */
            customers.map((user) => (
              <div
                key={user.id}
                onClick={() => createOrJoinRoom(user.id, 'customer')}
                className="p-4 border-b border-gray-100 hover:bg-green-50 cursor-pointer transition-all duration-200 group"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {user.full_name?.charAt(0)?.toUpperCase() || 'C'}
                    </div>
                    <div className="absolute -bottom-1 -right-1">
                      {user.user_chat_status?.is_online ? (
                        <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                      ) : (
                        <div className="w-4 h-4 bg-gray-400 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-green-600">
                      {user.full_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user.user_chat_status?.is_online ? '🟢 Online' : '⚪ Offline'}
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
                className={`p-4 border-b border-gray-100 hover:bg-purple-50 cursor-pointer transition-all duration-200 group ${
                  selectedRoom?.id === room.id ? 'bg-purple-100 border-l-4 border-purple-500' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                    {(room.admin?.full_name || room.customer?.full_name || 'U')?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-purple-600">
                      {room.admin?.full_name || room.customer?.full_name || 'Unknown User'}
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
      <div className="flex-1 flex flex-col bg-white shadow-lg">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                  {(selectedRoom.admin?.full_name || selectedRoom.customer?.full_name || 'U')?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {selectedRoom.admin?.full_name || selectedRoom.customer?.full_name || 'Unknown User'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {(selectedRoom.admin?.user_chat_status?.is_online || selectedRoom.customer?.user_chat_status?.is_online) ? '🟢 Online' : '⚪ Offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {messages.map((message, index) => {
                const isOwnMessage = message.sender_id === currentUser?.id;
                return (
                  <div
                    key={`${message.id}-${index}`}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
                        isOwnMessage
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.message}</p>
                      <p className={`text-xs mt-2 ${
                        isOwnMessage ? 'text-blue-100' : 'text-gray-500'
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
                  <div className="bg-white text-gray-900 px-4 py-3 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center space-x-1">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm text-gray-500 ml-2">Typing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-6">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors duration-200"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Start a Conversation</h3>
              <p className="text-gray-600">Select an admin or customer to begin chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 