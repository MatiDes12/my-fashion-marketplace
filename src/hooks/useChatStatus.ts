import { useEffect, useCallback, useRef } from 'react';
import { pusherClient } from '@/lib/pusher-client';
import { debounce } from '@/utils/debounce';

// Configuration - Optimized for better performance
const HEARTBEAT_INTERVAL = 120000; // 2 minutes (increased from 60s)
const AWAY_TIMEOUT = 300000; // 5 minutes (increased from 2min)
const OFFLINE_TIMEOUT = 900000; // 15 minutes (increased from 10min)
const MIN_STATUS_UPDATE_INTERVAL = 15000; // 15 seconds minimum between updates

export const useChatStatus = (
  currentUser: any,
  onStatusUpdate?: (userId: string, isOnline: boolean, statusMessage?: string) => void
) => {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const awayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offlineTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastStatusUpdateRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(true);
  const statusChannelRef = useRef<any>(null);
  const lastStatusRef = useRef<string>('');

  const updateStatus = useCallback(async (isOnline: boolean, statusMessage?: string, force: boolean = false) => {
    if (!currentUser || !currentUser.id) {
      console.log('No current user, skipping status update');
      return;
    }

    // Prevent duplicate status updates
    const newStatus = `${isOnline}-${statusMessage}`;
    if (!force && lastStatusRef.current === newStatus) {
      console.log('Skipping duplicate status update');
      return;
    }

    // Prevent too frequent updates
    const now = Date.now();
    if (!force && (now - lastStatusUpdateRef.current) < MIN_STATUS_UPDATE_INTERVAL) {
      console.log('Skipping status update - too frequent');
      return;
    }

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
      
      if (response.ok) {
        lastStatusUpdateRef.current = now;
        lastStatusRef.current = newStatus;
        console.log(`Status updated successfully: ${isOnline ? 'Online' : 'Offline'} - ${statusMessage}`);
      } else if (response.status === 429) {
        console.log('Rate limited, will retry later');
        // Don't retry immediately for 429 errors
      } else {
        console.error('Status update failed:', response.status);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }, [currentUser]);

  // Debounced version for activity-based updates
  const debouncedUpdateStatus = useCallback(
    debounce((isOnline: boolean, statusMessage?: string) => {
      updateStatus(isOnline, statusMessage);
    }, 2000),
    [updateStatus]
  );

  const updateLastActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    // Clear existing timeouts
    if (awayTimeoutRef.current) {
      clearTimeout(awayTimeoutRef.current);
    }
    if (offlineTimeoutRef.current) {
      clearTimeout(offlineTimeoutRef.current);
    }

    // Set user as active if they were away
    if (!isActiveRef.current) {
      isActiveRef.current = true;
      updateStatus(true, 'Online');
    }

    // Set new timeouts
    awayTimeoutRef.current = setTimeout(() => {
      isActiveRef.current = false;
      debouncedUpdateStatus(false, 'Away');
    }, AWAY_TIMEOUT);

    offlineTimeoutRef.current = setTimeout(() => {
      debouncedUpdateStatus(false, 'Offline');
    }, OFFLINE_TIMEOUT);
  }, [updateStatus, debouncedUpdateStatus]);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      if (isActiveRef.current) {
        debouncedUpdateStatus(true, 'Online');
      }
    }, HEARTBEAT_INTERVAL);
  }, [debouncedUpdateStatus]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('Cleaning up chat status for user:', currentUser?.id);
    
    // Clear all timeouts and intervals
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    if (awayTimeoutRef.current) {
      clearTimeout(awayTimeoutRef.current);
    }
    if (offlineTimeoutRef.current) {
      clearTimeout(offlineTimeoutRef.current);
    }

    // Set user as offline
    updateStatus(false, 'Offline', true);
  }, [updateStatus, currentUser]);

  useEffect(() => {
    if (!currentUser || !currentUser.id) {
      console.log('No current user in useChatStatus, skipping setup');
      return;
    }

    console.log('Setting up chat status for user:', currentUser.id);

    // Subscribe to user status updates
    statusChannelRef.current = pusherClient.subscribe('user-status');
    
    statusChannelRef.current.bind('status_update', (data: {
      userId: string;
      isOnline: boolean;
      lastSeen: string;
      statusMessage?: string;
    }) => {
      if (onStatusUpdate) {
        onStatusUpdate(data.userId, data.isOnline, data.statusMessage);
      }
    });

    // Set initial status as online
    updateStatus(true, 'Online', true);
    updateLastActivity();
    startHeartbeat();

    // Activity listeners - reduced frequency
    const activityEvents = ['click', 'keypress'];
    
    const handleActivity = () => {
      updateLastActivity();
    };

    // Add activity listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActiveRef.current = false;
        debouncedUpdateStatus(false, 'Away');
      } else {
        updateLastActivity();
      }
    };

    // Handle beforeunload (logout/navigation)
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline status
      const data = JSON.stringify({ 
        isOnline: false, 
        statusMessage: 'Offline' 
      });
      navigator.sendBeacon('/api/pusher/update-status', data);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      console.log('Cleaning up chat status for user:', currentUser.id);
      
      // Remove event listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Unsubscribe from Pusher
      if (statusChannelRef.current) {
        statusChannelRef.current.unsubscribe();
      }

      // Stop heartbeat and cleanup
      stopHeartbeat();
      cleanup();
    };
  }, [currentUser, updateStatus, updateLastActivity, startHeartbeat, stopHeartbeat, cleanup, onStatusUpdate, debouncedUpdateStatus]);

  return { updateStatus, cleanup };
}; 