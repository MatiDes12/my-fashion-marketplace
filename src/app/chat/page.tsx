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
import Link from 'next/link';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useFastChat } from '@/hooks/useFastChat';
import FastMessageInput from '@/components/FastMessageInput';
import FastMessageList from '@/components/FastMessageList';

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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'sellers' | 'admins' | 'recent'>('sellers');
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
      loadSellers();
      loadAdmins();
      loadRooms();
    }
  }, [currentUser]);

  // Define handleStatusUpdate before using it
  const handleStatusUpdate = (userId: string, isOnline: boolean, statusMessage?: string) => {
    // Update user status in the UI
    setSellers(prev => 
      prev.map(seller => 
        seller.id === userId 
          ? { ...seller, user_chat_status: { ...seller.user_chat_status, is_online: isOnline, status_message: statusMessage } }
          : seller
      )
    );
    
    setAdmins(prev => 
      prev.map(admin => 
        admin.id === userId 
          ? { ...admin, user_chat_status: { ...admin.user_chat_status, is_online: isOnline, status_message: statusMessage } }
          : admin
      )
    );
  };

  // Use chat status hook
  const { updateStatus } = useChatStatus(currentUser, handleStatusUpdate);

  const loadSellers = async () => {
    try {
      const response = await fetch('/api/chat/customer-sellers');
      if (response.ok) {
        const data = await response.json();
        setSellers(data.sellers || []);
      }
    } catch (error) {
      console.error('Error loading sellers:', error);
    }
  };

  const loadAdmins = async () => {
    try {
      const response = await fetch('/api/chat/customers');
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.customers || []);
      }
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  };

  const loadRooms = async () => {
    if (!currentUser) return;

    try {
      const { data: roomsData, error } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          seller:users!chat_rooms_seller_id_fkey(*),
          admin:users!chat_rooms_admin_id_fkey(*),
          customer:users!chat_rooms_customer_id_fkey(*)
        `)
        .eq('customer_id', currentUser.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const formattedRooms = roomsData?.map(room => ({
        ...room,
        seller: room.seller,
        admin: room.admin,
        customer: room.customer
      })) || [];

      setRooms(formattedRooms);
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  const createOrJoinRoom = async (userId: string, userType: 'seller' | 'admin' = 'seller') => {
    if (!currentUser) return;

    try {
      // Check if room already exists
      const { data: existingRoom, error: checkError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('customer_id', currentUser.id)
        .eq(userType === 'seller' ? 'seller_id' : 'admin_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingRoom) {
        // Room exists, select it
        setSelectedRoom({
          ...existingRoom,
          seller: sellers.find(s => s.id === existingRoom.seller_id),
          admin: admins.find(a => a.id === existingRoom.admin_id),
          customer: currentUser
        });
        return;
      }

      // Create new room
      const { data: newRoom, error: createError } = await supabase
        .from('chat_rooms')
        .insert({
          room_type: userType === 'seller' ? 'customer_seller' : 'customer_admin',
          customer_id: currentUser.id,
          [userType === 'seller' ? 'seller_id' : 'admin_id']: userId,
          last_message_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (createError) throw createError;

      // Add to rooms list
      const user = userType === 'seller' 
        ? sellers.find(s => s.id === userId)
        : admins.find(a => a.id === userId);

      const roomWithUsers = {
        ...newRoom,
        seller: userType === 'seller' ? user : undefined,
        admin: userType === 'admin' ? user : undefined,
        customer: currentUser
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
            <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('sellers')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'sellers'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sellers
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'admins'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Support
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
          {activeTab === 'sellers' && (
            <div className="p-4 space-y-3">
              {sellers.map((seller) => (
                <div
                  key={seller.id}
                  onClick={() => createOrJoinRoom(seller.id, 'seller')}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="relative">
                    {seller.avatar_url ? (
                      <img
                        src={seller.avatar_url}
                        alt={seller.full_name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <UserCircleIcon className="w-10 h-10 text-gray-400" />
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                      seller.user_chat_status?.is_online ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {seller.full_name || seller.email}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {seller.user_chat_status?.is_online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'admins' && (
            <div className="p-4 space-y-3">
              {admins.map((admin) => (
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

          {activeTab === 'recent' && (
            <div className="p-4 space-y-3">
              {rooms.map((room) => {
                const otherUser = room.seller || room.admin;
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
                  {selectedRoom.seller?.avatar_url || selectedRoom.admin?.avatar_url ? (
                    <img
                      src={selectedRoom.seller?.avatar_url || selectedRoom.admin?.avatar_url}
                      alt={selectedRoom.seller?.full_name || selectedRoom.admin?.full_name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <UserCircleIcon className="w-10 h-10 text-gray-400" />
                  )}
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                    (selectedRoom.seller?.user_chat_status?.is_online || selectedRoom.admin?.user_chat_status?.is_online) ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedRoom.seller?.full_name || selectedRoom.admin?.full_name || 'Unknown'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {(selectedRoom.seller?.user_chat_status?.is_online || selectedRoom.admin?.user_chat_status?.is_online) ? 'Online' : 'Offline'}
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
                Choose a seller or support agent to start chatting.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 