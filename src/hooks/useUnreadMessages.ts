import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClientComponent } from '@/lib/supabase';

export function useUnreadMessages() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchUnreadCount = async () => {
    if (!user) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/chat/unread-count', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      } else {
        // Fallback to client-side calculation (avoids 401 timing issues)
        await clientSideUnreadCount();
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      // Fallback to client-side calculation
      await clientSideUnreadCount();
    } finally {
      setLoading(false);
    }
  };

  const clientSideUnreadCount = async () => {
    try {
      const supabase = createClientComponent();
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData?.user;
      if (!currentUser) {
        setUnreadCount(0);
        return;
      }

      // Get all room IDs where the user is involved
      const { data: rooms, error: roomsError } = await supabase
        .from('chat_rooms')
        .select('id')
        .or(`seller_id.eq.${currentUser.id},admin_id.eq.${currentUser.id},customer_id.eq.${currentUser.id}`);

      if (roomsError || !rooms || rooms.length === 0) {
        setUnreadCount(0);
        return;
      }

      const roomIds = rooms.map(r => r.id);

      // Count unread messages in those rooms (excluding user's own messages)
      const { count, error: countError } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .in('room_id', roomIds)
        .eq('is_read', false)
        .neq('sender_id', currentUser.id);

      if (countError) {
        console.error('Client unread count error:', countError);
        setUnreadCount(0);
        return;
      }

      setUnreadCount(count || 0);
    } catch (e) {
      console.error('Client unread count exception:', e);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
  }, [user]);

  // Refresh unread count every 30 seconds
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Listen for new messages via Pusher (if available)
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    // Listen for custom events that indicate new messages
    const handleNewMessage = () => {
      fetchUnreadCount();
    };

    // Listen for storage events (when messages are marked as read in other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'chat-updated') {
        fetchUnreadCount();
      }
    };

    window.addEventListener('new-message', handleNewMessage);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('new-message', handleNewMessage);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]);

  return {
    unreadCount,
    loading,
    refresh: fetchUnreadCount
  };
} 