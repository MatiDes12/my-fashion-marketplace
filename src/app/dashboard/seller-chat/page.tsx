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
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

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
  const { refresh: refreshUnreadCount } = useUnreadMessages();

  // Presence-driven online
  const { isOnline } = useChatStatus(currentUser, undefined);

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
      console.log('Current user in seller chat:', currentUser);
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
        
        // Update room order when new message is received
        setRooms(prev => {
          const updatedRooms = prev.map(room => {
            if (room.id === message.room_id) {
              return {
              ...room,
              last_message_at: message.created_at,
              messages: [...(room.messages || []), message]
            };
            }
            return room;
          });
          
          // Re-sort rooms by last_message_at (most recent first)
          return updatedRooms.sort((a, b) => {
            const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return bTime - aTime;
          });
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
      console.log('Loaded users for seller:', data);
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
      console.log('Loaded customers for seller:', data);
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

      console.log('Loaded rooms for seller:', { adminData, customerData, allRooms });

      if (allRooms.length > 0) {
        // Enhance rooms with user data for better display
        const enhancedRooms = allRooms.map((room: any) => ({
          ...room,
          seller: users.find(u => u.id === room.seller_id) || room.seller,
          admin: users.find(u => u.id === room.admin_id) || room.admin,
          customer: customers.find(u => u.id === room.customer_id) || room.customer,
          messages: room.messages || []
        }));
        
        // Sort rooms by last_message_at (most recent first)
        const sortedRooms = enhancedRooms.sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        });
        
        setRooms(sortedRooms);
      } else {
        setRooms([]);
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
    // Don't load messages for temporary rooms
    if (roomId.startsWith('temp-')) {
      setMessages([]);
      return;
    }

    try {
      const response = await fetch(`/api/chat/messages?roomId=${roomId}`);
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
        
        // Mark messages as read when entering the room
        try {
          await fetch('/api/chat/mark-read', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ roomId }),
          });
          
          // Refresh unread count to update notification badges
          refreshUnreadCount();
        } catch (error) {
          console.error('Error marking messages as read:', error);
        }
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
            
            // Don't add to rooms list yet (will be added when first message is sent)
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

      // If this is the first message in a room, add it to the rooms list
      if (!rooms.some(r => r.id === selectedRoom.id)) {
        setRooms(prev => {
          const updatedRooms = [selectedRoom, ...prev];
          return updatedRooms.sort((a, b) => {
            const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return bTime - aTime;
          });
        });
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
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

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

  // Users from API are already filtered to be admins
  const adminUsers = users;

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gradient-to-br from-blue-50 to-indigo-100 -mt-4">
      {/* Sidebar - Users and Rooms */}
      <div className={`${selectedRoom ? 'hidden md:flex' : 'flex'} w-full md:w-80 bg-white shadow-xl border-r border-gray-200 flex-col`}>
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <h1 className="text-lg md:text-xl font-bold text-white">Seller Chat</h1>
          <p className="text-blue-100 text-xs md:text-sm mt-1">Connect with admins and customers</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button 
            onClick={() => setActiveTab('admins')}
            className={`flex-1 py-3 md:py-4 px-2 md:px-4 text-xs md:text-sm font-medium transition-all duration-200 ${
              activeTab === 'admins' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="font-semibold">Admins</span>
              <span className="text-xs bg-blue-100 text-blue-600 px-1 md:px-2 py-0.5 md:py-1 rounded-full mt-1">
                {adminUsers.length}
              </span>
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('customers')}
            className={`flex-1 py-3 md:py-4 px-2 md:px-4 text-xs md:text-sm font-medium transition-all duration-200 ${
              activeTab === 'customers' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="font-semibold">Customers</span>
              <span className="text-xs bg-green-100 text-green-600 px-1 md:px-2 py-0.5 md:py-1 rounded-full mt-1">
                {customers.length}
              </span>
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('recent')}
            className={`flex-1 py-3 md:py-4 px-2 md:px-4 text-xs md:text-sm font-medium transition-all duration-200 ${
              activeTab === 'recent' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="font-semibold">Recent</span>
              <span className="text-xs bg-purple-100 text-purple-600 px-1 md:px-2 py-0.5 md:py-1 rounded-full mt-1">
                {rooms.filter(room => room.messages?.length > 0).length}
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
                className="p-3 md:p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-all duration-200 group"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                      {user.full_name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div className="absolute -bottom-1 -right-1">
                      {isOnline(user.id) ? (
                        <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                      ) : (
                        <div className="w-4 h-4 bg-gray-400 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600">
                      {user.full_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {isOnline(user.id) ? '🟢 Online' : '⚪ Offline'}
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
                className="p-3 md:p-4 border-b border-gray-100 hover:bg-green-50 cursor-pointer transition-all duration-200 group"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                      {user.full_name?.charAt(0)?.toUpperCase() || 'C'}
                    </div>
                    <div className="absolute -bottom-1 -right-1">
                      {isOnline(user.id) ? (
                        <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                      ) : (
                        <div className="w-4 h-4 bg-gray-400 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-semibold text-gray-900 truncate group-hover:text-green-600">
                      {user.full_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {isOnline(user.id) ? '🟢 Online' : '⚪ Offline'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            /* Recent Chats List - Only show rooms with messages */
            rooms.filter(room => room.messages?.length > 0).map((room) => (
              <div
                key={room.id}
                onClick={async () => {
                  setSelectedRoom(room);
                  await loadMessages(room.id);
                }}
                className={`p-3 md:p-4 border-b border-gray-100 hover:bg-purple-50 cursor-pointer transition-all duration-200 group ${
                  selectedRoom?.id === room.id ? 'bg-purple-100 border-l-4 border-purple-500' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                    {(room.admin?.full_name || room.customer?.full_name || 'U')?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-semibold text-gray-900 truncate group-hover:text-purple-600">
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
      <div className={`${selectedRoom ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-white shadow-lg`}>
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 p-4 md:p-6 flex-shrink-0">
              <div className="flex items-center space-x-3 md:space-x-4">
                <button 
                  onClick={() => setSelectedRoom(null)}
                  className="md:hidden p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                  {(selectedRoom.admin?.full_name || selectedRoom.customer?.full_name || 'U')?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-gray-900 truncate">
                    {selectedRoom.admin?.full_name || selectedRoom.customer?.full_name || 'Unknown User'}
                  </h2>
                  <p className="text-xs md:text-sm text-gray-600">
                    {(selectedRoom.admin && isOnline(selectedRoom.admin.id)) || (selectedRoom.customer && isOnline(selectedRoom.customer.id)) ? '🟢 Online' : '⚪ Offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages - Scrollable area */}
            <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4 bg-gray-50">
              {messages.map((message, index) => {
                const isOwnMessage = message.sender_id === currentUser?.id;
                return (
                  <div
                    key={`${message.id}-${index}`}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-xs lg:max-w-md px-3 md:px-4 py-2 md:py-3 rounded-2xl shadow-sm ${
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

            {/* Message Input - Fixed at bottom */}
            <div className="bg-white border-t border-gray-200 p-3 md:p-6 flex-shrink-0">
              <div className="flex space-x-2 md:space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors duration-200 text-sm md:text-base"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <PaperAirplaneIcon className="w-4 h-4 md:w-5 md:h-5" />
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