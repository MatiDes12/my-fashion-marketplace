'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';

export function useOwnerCheck() {
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClientComponent();
    
    const checkOwnerStatus = async () => {
      try {
        setLoading(true);
        console.log('🔍 useOwnerCheck: Checking owner status...');
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        console.log('🔍 useOwnerCheck: Session exists?', !!session);
        
        if (!session) {
          console.log('🔍 useOwnerCheck: No session found');
          setIsOwner(false);
          setUserId(null);
          return;
        }
        
        console.log('🔍 useOwnerCheck: User ID from session:', session.user.id);
        setUserId(session.user.id);
        
        // Check directly in the users table
        console.log('🔍 useOwnerCheck: Checking role in database...');
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        console.log('🔍 useOwnerCheck: Role check result:', data, error);
        
        if (error) {
          console.error('🔍 useOwnerCheck: Error checking owner status:', error);
          setIsOwner(false);
          return;
        }
        
        const isUserOwner = data?.role === 'owner';
        console.log('🔍 useOwnerCheck: Is user owner?', isUserOwner);
        setIsOwner(isUserOwner);
      } catch (error) {
        console.error('🔍 useOwnerCheck: Owner check error:', error);
        setIsOwner(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkOwnerStatus();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔍 useOwnerCheck: Auth state changed:', event, !!session);
      checkOwnerStatus();
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  return { isOwner, loading, userId };
} 