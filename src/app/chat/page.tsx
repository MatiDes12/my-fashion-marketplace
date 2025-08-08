'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { 
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { pusherClient } from '@/lib/pusher-client';
import { useChatStatus } from '@/hooks/useChatStatus';
import Link from 'next/link';
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
  seller_id?: string;
  admin_id?: string;
  customer_id: string;
  last_message_at: string;
  seller?: User;
  admin?: User;
  customer: User;
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

export default function CustomerChatPage() {
  const [sellers, setSellers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'sellers' | 'admins' | 'recent'>('sellers');
  const [channel, setChannel] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponent();
  const { refresh: refreshUnreadCount } = useUnreadMessages();

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
      loadSellers();
      loadAdmins();
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

  // Presence-driven online
  const { isOnline } = useChatStatus(currentUser, undefined);

  const loadSellers = async () => {
    try {
      const response = await fetch('/api/chat/customer-sellers?customerId=' + currentUser.id);
      const data = await response.json();
      console.log('Loaded sellers for customer:', data);
      if (data.sellers) {
        setSellers(data.sellers);
      }
    } catch (error) {
      console.error('Error loading sellers:', error);
      toast.error('Failed to load sellers');
    }
  };

  const loadAdmins = async () => {
    try {
      const response = await fetch('/api/chat/users?userType=customer');
      const data = await response.json();
      if (data.users) {
        setAdmins(data.users);
      }
    } catch (error) {
      console.error('Error loading admins:', error);
      toast.error('Failed to load admins');
    }
  };

  const loadRooms = async () => {
    try {
      // Load both customer_seller and customer_admin rooms
      const [sellerResponse, adminResponse] = await Promise.all([
        fetch('/api/chat/rooms?userType=customer&roomType=customer_seller'),
        fetch('/api/chat/rooms?userType=customer&roomType=customer_admin')
      ]);

      const sellerData = await sellerResponse.json();
      const adminData = await adminResponse.json();

      const allRooms = [
        ...(sellerData.rooms || []),
        ...(adminData.rooms || [])
      ];

      if (allRooms.length > 0) {
        // Enhance rooms with user data for better display
        const enhancedRooms = allRooms.map((room: any) => ({
          ...room,
          seller: sellers.find(u => u.id === room.seller_id) || room.seller,
          admin: admins.find(u => u.id === room.admin_id) || room.admin,
          customer: currentUser,
          messages: room.messages || []
        }));
        
        // Sort rooms by last_message_at (most recent first)
        const sortedRooms = enhancedRooms.sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        });
        
        setRooms(sortedRooms);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('Failed to load chat rooms');
    }
  };

  const createOrJoinRoom = async (userId: string, userType: 'seller' | 'admin' = 'seller') => {
    try {
      const user = userType === 'seller' 
        ? sellers.find(u => u.id === userId)
        : admins.find(u => u.id === userId);
        
      if (user) {
        // Check if room already exists
        const existingRoom = rooms.find(room => {
          if (userType === 'seller') {
            return room.seller_id === userId && room.customer_id === currentUser.id;
          } else {
            return room.admin_id === userId && room.customer_id === currentUser.id;
          }
        });

        if (existingRoom) {
          // Use existing room
          setSelectedRoom(existingRoom);
          await loadMessages(existingRoom.id);
        } else {
          // Create new room
          const roomData = {
            roomType: userType === 'seller' ? 'customer_seller' : 'customer_admin',
            customerId: currentUser.id,
            ...(userType === 'seller' ? { sellerId: userId } : { adminId: userId })
          };

          const response = await fetch('/api/chat/rooms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(roomData),
          });

          const data = await response.json();
          if (!response.ok) {
            console.error('Error creating room:', data.error);
            toast.error('Failed to create chat room');
            return;
          }
          
          if (data.room) {
            const newRoom: ChatRoom = {
              ...data.room,
              seller: userType === 'seller' ? user : undefined,
              admin: userType === 'admin' ? user : undefined,
              customer: currentUser,
              messages: []
            };
            
            // Don't add to rooms list yet (will be added when first message is sent)
            setSelectedRoom(newRoom);
            
            setSelectedRoom(newRoom);
            setMessages([]);
            
            // Refresh rooms to ensure consistency
            setTimeout(() => loadRooms(), 100);
          } else {
            console.error('No room data in response');
            toast.error('Failed to create chat room');
          }
        }
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



      // Add message to local state immediately (optimistic update)
      const tempMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        room_id: selectedRoom.id,
        sender_id: currentUser.id,
        sender_type: 'customer',
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
          roomId: selectedRoom.id,
          senderId: currentUser.id,
          senderType: 'customer',
          message: messageText,
          messageType: 'text'
        }),
      });

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

  return (
    <div className="flex h-[calc(100vh-120px)] bg-gradient-to-br from-green-50 to-emerald-100 mt-4">
      {/* Sidebar - Users and Rooms */}
      <div className={`${selectedRoom ? 'hidden md:flex' : 'flex'} w-full md:w-80 bg-white shadow-xl border-r border-gray-200 flex-col`}>
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-gray-200 bg-gradient-to-r from-green-600 to-emerald-600">
          <div className="flex items-center space-x-2 md:space-x-3">
            <Link href="/" className="text-white hover:text-green-100">
              <ArrowLeftIcon className="w-4 h-4 md:w-5 md:h-5" />
            </Link>
            <div>
              <h1 className="text-base md:text-lg font-bold text-white">Customer Support</h1>
              <p className="text-xs text-green-100">Chat with sellers and admins</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button 
            onClick={() => setActiveTab('sellers')}
            className={`flex-1 py-3 md:py-4 px-2 md:px-4 text-xs md:text-sm font-medium transition-all duration-200 ${
              activeTab === 'sellers' 
                ? 'text-green-600 border-b-2 border-green-600 bg-white' 
                : 'text-gray-600 hover:text-green-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="font-semibold">Sellers</span>
              <span className="text-xs bg-green-100 text-green-600 px-1 md:px-2 py-0.5 md:py-1 rounded-full mt-1">
                {sellers.length}
              </span>
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('admins')}
            className={`flex-1 py-3 md:py-4 px-2 md:px-4 text-xs md:text-sm font-medium transition-all duration-200 ${
              activeTab === 'admins' 
                ? 'text-green-600 border-b-2 border-green-600 bg-white' 
                : 'text-gray-600 hover:text-green-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="font-semibold">Support</span>
              <span className="text-xs bg-blue-100 text-blue-600 px-1 md:px-2 py-0.5 md:py-1 rounded-full mt-1">
                {admins.length}
              </span>
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('recent')}
            className={`flex-1 py-3 md:py-4 px-2 md:px-4 text-xs md:text-sm font-medium transition-all duration-200 ${
              activeTab === 'recent' 
                ? 'text-green-600 border-b-2 border-green-600 bg-white' 
                : 'text-gray-600 hover:text-green-600 hover:bg-gray-100'
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
          {activeTab === 'sellers' ? (
            /* Sellers List */
            sellers.map((user) => (
              <div
                key={user.id}
                onClick={() => createOrJoinRoom(user.id, 'seller')}
                className="p-3 md:p-4 border-b border-gray-100 hover:bg-green-50 cursor-pointer transition-all duration-200 group"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                      {user.full_name?.charAt(0)?.toUpperCase() || 'S'}
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
          ) : activeTab === 'admins' ? (
            /* Admins List */
            admins.map((user) => (
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
                      {user.user_chat_status?.is_online ? (
                        <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                      ) : (
                        <div className="w-4 h-4 bg-gray-400 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0" >
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
                    {(room.seller?.full_name || room.admin?.full_name || 'U')?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-semibold text-gray-900 truncate group-hover:text-purple-600">
                      {room.seller?.full_name || room.admin?.full_name || 'Unknown User'}
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
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 p-3 md:p-4 flex-shrink-0">
              <div className="flex items-center space-x-3 md:space-x-4">
                <button 
                  onClick={() => setSelectedRoom(null)}
                  className="md:hidden p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm md:text-base">
                  {(selectedRoom.seller?.full_name || selectedRoom.admin?.full_name || 'U')?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm md:text-base font-bold text-gray-900 truncate">
                    {selectedRoom.seller?.full_name || selectedRoom.admin?.full_name || 'Unknown User'}
                  </h2>
                  <p className="text-xs text-gray-600">
                     {(selectedRoom.seller && isOnline(selectedRoom.seller.id)) || (selectedRoom.admin && isOnline(selectedRoom.admin.id)) ? '🟢 Online' : '⚪ Offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages - Scrollable area */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3 bg-gray-50">
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
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.message}</p>
                      <p className={`text-xs mt-2 ${
                        isOwnMessage ? 'text-green-100' : 'text-gray-500'
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
            <div className="bg-white border-t border-gray-200 p-2 flex-shrink-0">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors duration-200 text-sm"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2">Start a Conversation</h3>
              <p className="text-sm text-gray-600">Select a seller or support agent to begin chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 