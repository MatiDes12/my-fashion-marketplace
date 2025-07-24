import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
      const response = await fetch('/api/chat/unread-count');
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      } else {
        console.error('Failed to fetch unread count');
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
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