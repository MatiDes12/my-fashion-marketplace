import { useState, useCallback, useRef, useEffect } from 'react';
import { pusherClient } from '@/lib/pusher-client';
import { createClientComponent } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  sender_name?: string;
  sender_avatar?: string;
}

export function useFastChat(roomId: string, currentUser: any) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponent();
  const channelRef = useRef<any>(null);
  const pendingMessagesRef = useRef<Set<string>>(new Set());

  // Optimistic message sending - add message immediately to UI
  const sendMessage = useCallback(async (content: string) => {
    if (!currentUser || !content.trim()) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      room_id: roomId,
      sender_id: currentUser.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      is_read: false,
      sender_name: currentUser.user_metadata?.full_name || currentUser.email,
    };

    // Add message optimistically to UI immediately
    setMessages(prev => [...prev, tempMessage]);
    pendingMessagesRef.current.add(tempId);

    try {
      // Send to server
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: currentUser.id,
          content: content.trim(),
        })
        .select('*')
        .single();

      if (error) throw error;

      // Replace temp message with real message
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId ? { ...data, sender_name: currentUser.user_metadata?.full_name || currentUser.email } : msg
        )
      );
      pendingMessagesRef.current.delete(tempId);

    } catch (err) {
      console.error('Error sending message:', err);
      // Remove failed message from UI
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      pendingMessagesRef.current.delete(tempId);
      setError('Failed to send message');
    }
  }, [currentUser, roomId, supabase]);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!roomId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          users!chat_messages_sender_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages = data?.map(msg => ({
        ...msg,
        sender_name: msg.users?.full_name || 'Unknown',
        sender_avatar: msg.users?.avatar_url
      })) || [];

      setMessages(formattedMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [roomId, supabase]);

  // Mark messages as read
  const markAsRead = useCallback(async (messageIds: string[]) => {
    if (!currentUser || messageIds.length === 0) return;

    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .in('id', messageIds)
        .neq('sender_id', currentUser.id);

      // Update local state
      setMessages(prev => 
        prev.map(msg => 
          messageIds.includes(msg.id) && msg.sender_id !== currentUser.id 
            ? { ...msg, is_read: true }
            : msg
        )
      );
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }, [currentUser, supabase]);

  // Setup real-time subscription
  useEffect(() => {
    if (!roomId || !currentUser) return;

    // Load initial messages
    loadMessages();

    // Subscribe to new messages
    const channelName = `chat-room-${roomId}`;
    channelRef.current = pusherClient.subscribe(channelName);

    channelRef.current.bind('new_message', (newMessage: ChatMessage) => {
      // Don't add if it's our own pending message
      if (pendingMessagesRef.current.has(newMessage.id)) return;

      setMessages(prev => {
        // Check if message already exists
        if (prev.some(msg => msg.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });

      // Mark as read if we're the recipient
      if (newMessage.sender_id !== currentUser.id) {
        markAsRead([newMessage.id]);
      }
    });

    channelRef.current.bind('message_read', (data: { message_id: string }) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === data.message_id 
            ? { ...msg, is_read: true }
            : msg
        )
      );
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [roomId, currentUser, loadMessages, markAsRead]);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    markAsRead,
    loadMessages
  };
} 