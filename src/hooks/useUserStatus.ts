import { useEffect, useRef, useState } from 'react';
import { debounce } from '@/utils/debounce';

export function useUserStatus(currentUser: any) {
  const [isOnline, setIsOnline] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastStatusRef = useRef<string>();
  const lastUpdateRef = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  const updateStatus = async (status: 'online' | 'offline' | 'away') => {
    if (!currentUser || lastStatusRef.current === status) return;
    
    // Prevent too frequent updates (minimum 5 seconds between updates)
    const now = Date.now();
    if (now - lastUpdateRef.current < 5000) {
      console.log('Skipping status update - too frequent');
      return;
    }

    try {
      lastStatusRef.current = status;
      lastUpdateRef.current = now;
      
      const response = await fetch('/api/pusher/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isOnline: status === 'online', 
          statusMessage: status 
        })
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          console.log('Rate limited, will retry later');
          // Don't reset lastStatusRef for 429 errors
          return;
        }
        console.error('Status update failed:', response.status);
        lastStatusRef.current = undefined; // Reset to allow retry
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      lastStatusRef.current = undefined; // Reset to allow retry
    }
  };

  // Debounced version to prevent too frequent updates
  const debouncedUpdateStatus = debounce(updateStatus, 3000);

  useEffect(() => {
    if (!currentUser) return;

    const handleOnline = () => {
      setIsOnline(true);
      clearTimeout(timeoutRef.current);
      clearTimeout(retryTimeoutRef.current);
      updateStatus('online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      updateStatus('offline');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Delay offline status to avoid rapid toggling
        timeoutRef.current = setTimeout(() => {
          setIsOnline(false);
          debouncedUpdateStatus('away');
        }, 5000); // Increased delay to 5 seconds
      } else {
        clearTimeout(timeoutRef.current);
        clearTimeout(retryTimeoutRef.current);
        setIsOnline(true);
        updateStatus('online');
      }
    };

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline status on page unload
      const data = JSON.stringify({ 
        isOnline: false, 
        statusMessage: 'offline' 
      });
      navigator.sendBeacon('/api/pusher/update-status', data);
    };

    // Set initial online status with delay to prevent immediate 429
    const initialTimeout = setTimeout(() => {
      updateStatus('online');
    }, 1000);

    // Event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(timeoutRef.current);
      clearTimeout(retryTimeoutRef.current);
      clearTimeout(initialTimeout);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Set offline when component unmounts
      updateStatus('offline');
    };
  }, [currentUser]);

  return { isOnline, updateStatus: debouncedUpdateStatus };
} 