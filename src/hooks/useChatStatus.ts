import { useEffect, useRef, useCallback, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { pusherClient } from '@/lib/pusher-client';

// Presence-based chat status (no DB writes)
type UseChatStatusOptions = {
  channelName?: string; // presence channel name
  enabled?: boolean;    // subscribe only when true
};

export const useChatStatus = (
  currentUser: any,
  onStatusUpdate?: (userId: string, isOnline: boolean) => void,
  options?: UseChatStatusOptions
) => {
  const channelName = options?.channelName || 'presence-users';
  const enabled = options?.enabled ?? true;
  const presenceChannelRef = useRef<any>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const supabase = createClientComponent();

  const handleSubscriptionSucceeded = useCallback(() => {
    try {
      const presence = presenceChannelRef.current;
      const members = presence?.members;
      if (!members) return;
      // Iterate currently online members
      if (typeof members.each === 'function') {
        const next = new Set<string>();
        members.each((member: any) => {
          if (member?.id) {
            next.add(member.id);
            if (onStatusUpdate) onStatusUpdate(member.id, true);
          }
        });
        setOnlineUserIds(next);
      } else if (Array.isArray(members?.members)) {
        const next = new Set<string>();
        members.members.forEach((member: any) => {
          if (member?.id) {
            next.add(member.id);
            if (onStatusUpdate) onStatusUpdate(member.id, true);
          }
        });
        setOnlineUserIds(next);
      }
    } catch {}
  }, [onStatusUpdate]);

  useEffect(() => {
    if (!enabled || !currentUser || !currentUser.id) return;

    // Subscribe to a presence channel for global user presence
    const presence = pusherClient.subscribe(channelName);
    presenceChannelRef.current = presence;

    // When we connect successfully, mark all current members as online
    presence.bind('pusher:subscription_succeeded', handleSubscriptionSucceeded);

    // Member joined
    presence.bind('pusher:member_added', (member: any) => {
      if (member?.id) {
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          next.add(member.id);
          return next;
        });
        if (onStatusUpdate) onStatusUpdate(member.id, true);
      }
    });

    // Member left
    presence.bind('pusher:member_removed', (member: any) => {
      if (member?.id) {
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          next.delete(member.id);
          return next;
        });
        if (onStatusUpdate) onStatusUpdate(member.id, false);
      }
    });

    return () => {
      try {
        presence.unbind('pusher:subscription_succeeded', handleSubscriptionSucceeded);
        presence.unbind('pusher:member_added');
        presence.unbind('pusher:member_removed');
        presence.unsubscribe();
      } catch {}
      presenceChannelRef.current = null;
    };
  }, [enabled, currentUser, channelName, handleSubscriptionSucceeded, onStatusUpdate]);

  // Force cleanup on sign-out to avoid lingering presence
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        try {
          const ch = presenceChannelRef.current;
          if (ch) {
            ch.unsubscribe();
          }
        } catch {}
        try {
          pusherClient.disconnect();
        } catch {}
        setOnlineUserIds(new Set());
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Keep API-compatible return, but no-op since presence handles updates
  const updateStatus = useCallback((_isOnline: boolean, _statusMessage?: string) => {}, []);
  const isOnline = useCallback((userId: string | undefined | null) => {
    if (!userId) return false;
    return onlineUserIds.has(userId);
  }, [onlineUserIds]);
  return { updateStatus, onlineUserIds, isOnline };
};