'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { 
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { useChatStatus } from '@/hooks/useChatStatus';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useFastChat } from '@/hooks/useFastChat';
import FastMessageInput from '@/components/FastMessageInput';
import FastMessageList from '@/components/FastMessageList';
import Link from 'next/link';

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
    status_message?: string;
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'admins' | 'customers' | 'recent'>('admins');
  const supabase = createClientComponent();
  const { refresh: refreshUnreadCount } = useUnreadMessages();

  // Use fast chat hook for the selected room
  const {
    messages: fastMessages,
    sendMessage: fastSendMessage,
    isLoading: messagesLoading,
    error: messagesError,
    markAsRead
  } = useFastChat(selectedRoom?.id || '', currentUser);

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

  // Define handleStatusUpdate before using it
  const handleStatusUpdate = (userId: string, isOnline: boolean, statusMessage?: string) => {
    setUsers(prev => prev.map(user => 
      user.id === userId 
        ? { 
            ...user, 
            user_chat_status: { 
              ...user.user_chat_status, 
              is_online: isOnline,
              status_message: statusMessage 
            } 
          }
        : user
    ));
    setCustomers(prev => prev.map(user => 
      user.id === userId 
        ? { 
            ...user, 
            user_chat_status: { 
              ...user.user_chat_status, 
              is_online: isOnline,
              status_message: statusMessage 
            } 
          }
        : user
    ));
  };

  // Use chat status hook
  const { updateStatus } = useChatStatus(currentUser, handleStatusUpdate);

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
    if (!currentUser) return;

    try {
      // Check if room already exists
      const { data: existingRoom, error: checkError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('seller_id', currentUser.id)
        .eq(userType === 'admin' ? 'admin_id' : 'customer_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingRoom) {
        // Room exists, select it
        const user = userType === 'admin' 
          ? users.find(u => u.id === existingRoom.admin_id)
          : customers.find(u => u.id === existingRoom.customer_id);

        setSelectedRoom({
          ...existingRoom,
          seller: currentUser,
          admin: userType === 'admin' ? user : undefined,
          customer: userType === 'customer' ? user : undefined
        });
        return;
      }

      // Create new room
      const { data: newRoom, error: createError } = await supabase
        .from('chat_rooms')
        .insert({
          room_type: userType === 'admin' ? 'admin_seller' : 'customer_seller',
          seller_id: currentUser.id,
          [userType === 'admin' ? 'admin_id' : 'customer_id']: userId,
          last_message_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (createError) throw createError;

      // Add to rooms list
      const user = userType === 'admin' 
        ? users.find(u => u.id === userId)
        : customers.find(u => u.id === userId);

      const roomWithUsers = {
        ...newRoom,
        seller: currentUser,
        admin: userType === 'admin' ? user : undefined,
        customer: userType === 'customer' ? user : undefined
      };

      setRooms(prev => [roomWithUsers, ...prev]);
      setSelectedRoom(roomWithUsers);
      
      toast.success(`Started chat with ${user?.full_name || user?.email}`);
    } catch (error) {
      console.error('Error creating/joining room:', error);
      toast.error('Failed to start chat');
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedRoom || !content.trim()) return;

    try {
      await fastSendMessage(content);
      
      // Update room's last_message_at
      await supabase
        .from('chat_rooms')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedRoom.id);

      // Refresh unread count
      refreshUnreadCount();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const getLastMessage = (room: ChatRoom) => {
    if (fastMessages.length > 0 && room.id === selectedRoom?.id) {
      const lastMessage = fastMessages[fastMessages.length - 1];
      return {
        content: lastMessage.content,
        time: formatTime(lastMessage.created_at),
        sender: lastMessage.sender_name
      };
    }
    
    // Fallback to room data
    return {
      content: 'No messages yet',
      time: formatTime(room.last_message_at),
      sender: ''
    };
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Seller Chat</h1>
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('admins')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'admins'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Admins ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'customers'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Customers ({customers.length})
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'recent'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Recent
          </button>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'admins' && (
            <div className="p-4 space-y-3">
              {users.map((admin) => (
                <div
                  key={admin.id}
                  onClick={() => createOrJoinRoom(admin.id, 'admin')}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="relative">
                    {admin.avatar_url ? (
                      <img
                        src={admin.avatar_url}
                        alt={admin.full_name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <UserCircleIcon className="w-10 h-10 text-gray-400" />
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                      admin.user_chat_status?.is_online ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {admin.full_name || admin.email}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {admin.user_chat_status?.is_online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="p-4 space-y-3">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => createOrJoinRoom(customer.id, 'customer')}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="relative">
                    {customer.avatar_url ? (
                      <img
                        src={customer.avatar_url}
                        alt={customer.full_name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <UserCircleIcon className="w-10 h-10 text-gray-400" />
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                      customer.user_chat_status?.is_online ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {customer.full_name || customer.email}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {customer.user_chat_status?.is_online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'recent' && (
            <div className="p-4 space-y-3">
              {rooms.map((room) => {
                const otherUser = room.admin || room.customer;
                const lastMessage = getLastMessage(room);
                
                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer ${
                      selectedRoom?.id === room.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="relative">
                      {otherUser?.avatar_url ? (
                        <img
                          src={otherUser.avatar_url}
                          alt={otherUser.full_name}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <UserCircleIcon className="w-10 h-10 text-gray-400" />
                      )}
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                        otherUser?.user_chat_status?.is_online ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {otherUser?.full_name || otherUser?.email}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {lastMessage.content}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {lastMessage.time}
                    </div>
                  </div>
                );
              })}
            </div>
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
                <button
                  onClick={() => setSelectedRoom(null)}
                  className="lg:hidden text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div className="relative">
                  {selectedRoom.admin?.avatar_url || selectedRoom.customer?.avatar_url ? (
                    <img
                      src={selectedRoom.admin?.avatar_url || selectedRoom.customer?.avatar_url}
                      alt={selectedRoom.admin?.full_name || selectedRoom.customer?.full_name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <UserCircleIcon className="w-10 h-10 text-gray-400" />
                  )}
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                    (selectedRoom.admin?.user_chat_status?.is_online || selectedRoom.customer?.user_chat_status?.is_online) ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedRoom.admin?.full_name || selectedRoom.customer?.full_name || 'Unknown'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {(selectedRoom.admin?.user_chat_status?.is_online || selectedRoom.customer?.user_chat_status?.is_online) ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <FastMessageList
              messages={fastMessages}
              currentUserId={currentUser.id}
              isLoading={messagesLoading}
            />

            {/* Message Input */}
            <FastMessageInput
              onSendMessage={handleSendMessage}
              disabled={messagesLoading}
              placeholder="Type a message..."
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <UserCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No conversation selected</h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose an admin or customer to start chatting.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 