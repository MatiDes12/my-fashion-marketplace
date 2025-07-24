import { useEffect, useCallback, useRef } from 'react';
import { pusherClient } from '@/lib/pusher-client';
import { toast } from 'react-hot-toast';

// Retry configuration
const RETRY_DELAYS = [2000, 4000, 8000]; // 2s, 4s, 8s delays between retries
const DEBOUNCE_DELAY = 3000; // 3 seconds debounce

export const useChatStatus = (
  currentUser: any,
  onStatusUpdate?: (userId: string, isOnline: boolean) => void
) => {
  // Track last status and debounce timer
  const lastStatusRef = useRef<{isOnline: boolean | null, statusMessage?: string, lastAttempt?: number}>({ isOnline: null });
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef<number>(0);

  const updateStatus = useCallback(async (isOnline: boolean, statusMessage?: string) => {
    if (!currentUser || !currentUser.id) {
      console.log('No current user, skipping status update');
      return;
    }

    // Only send if status actually changed and enough time has passed
    const now = Date.now();
    if (
      lastStatusRef.current.isOnline === isOnline &&
      lastStatusRef.current.statusMessage === statusMessage &&
      lastStatusRef.current.lastAttempt &&
      now - lastStatusRef.current.lastAttempt < DEBOUNCE_DELAY
    ) {
      return;
    }

    // Update last attempt time
    lastStatusRef.current = { isOnline, statusMessage, lastAttempt: now };

    // Debounce: clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Create a function for the actual API call
    const makeRequest = async (attempt: number = 0): Promise<void> => {
      try {
        const response = await fetch('/api/pusher/update-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isOnline,
            statusMessage
          }),
        });
        
        if (!response.ok) {
          if (response.status === 429) { // Too Many Requests
            const retryDelay = RETRY_DELAYS[attempt];
            if (retryDelay && attempt < RETRY_DELAYS.length) {
              console.log(`Rate limited, retrying in ${retryDelay}ms`);
              setTimeout(() => makeRequest(attempt + 1), retryDelay);
              return;
            }
          }
          throw new Error(`Status update failed: ${response.status}`);
        }

        // Reset retry count on success
        retryCount.current = 0;
      } catch (error) {
        console.error('Error updating status:', error);
        const retryDelay = RETRY_DELAYS[attempt];
        if (retryDelay && attempt < RETRY_DELAYS.length) {
          setTimeout(() => makeRequest(attempt + 1), retryDelay);
        } else {
          toast.error('Failed to update online status');
        }
      }
    };

    // Start the debounced request
    debounceTimer.current = setTimeout(() => {
      makeRequest(retryCount.current);
    }, DEBOUNCE_DELAY);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !currentUser.id) {
      console.log('No current user in useChatStatus, skipping setup');
      return;
    }

    console.log('Setting up chat status for user:', currentUser.id);

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