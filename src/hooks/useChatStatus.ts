import { useEffect, useCallback, useRef } from 'react';
import { pusherClient } from '@/lib/pusher-client';

export const useChatStatus = (
  currentUser: any,
  onStatusUpdate?: (userId: string, isOnline: boolean) => void
) => {
  // Track last status and debounce timer
  const lastStatusRef = useRef<{isOnline: boolean | null, statusMessage?: string}>({ isOnline: null });
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const updateStatus = useCallback((isOnline: boolean, statusMessage?: string) => {
    if (!currentUser) return;
    // Only send if status actually changed
    if (
      lastStatusRef.current.isOnline === isOnline &&
      lastStatusRef.current.statusMessage === statusMessage
    ) {
      return;
    }
    lastStatusRef.current = { isOnline, statusMessage };

    // Debounce: clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/pusher/update-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isOnline,
            statusMessage
          }),
        });
      } catch (error) {
        console.error('Error updating status:', error);
      }
    }, 1000); // 1 second debounce
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    // Subscribe to user status updates
    const statusChannel = pusherClient.subscribe('user-status');
    
    statusChannel.bind('status_update', (data: {
      userId: string;
      isOnline: boolean;
      lastSeen: string;
      statusMessage?: string;
    }) => {
      if (onStatusUpdate) {
        onStatusUpdate(data.userId, data.isOnline);
      }
    });

    // Set user as online when component mounts
    updateStatus(true, 'Online');

    // Set user as offline when component unmounts or page unloads
    const handleBeforeUnload = () => {
      updateStatus(false, 'Offline');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateStatus(false, 'Away');
      } else {
        updateStatus(true, 'Online');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      statusChannel.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Set offline when component unmounts
      updateStatus(false, 'Offline');
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [currentUser, updateStatus, onStatusUpdate]);

  return { updateStatus };
}; 