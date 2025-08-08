'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export interface UserDetails {
  id: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
  role?: string;
  is_verified?: boolean;
  verification_status?: string;
  store_settings?: {
    name?: string;
    description?: string;
    logo_url?: string;
    banner_url?: string;
    email?: string;
    phone?: string;
    address?: string;
    payment_methods?: {
      cash: boolean;
      [key: string]: boolean;
    };
    delivery_options?: {
      pickup: boolean;
      [key: string]: boolean;
    };
  };
}

export function useUserDetails() {
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  const fetchUserDetails = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUserDetails(null);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('*, store_settings')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      setUserDetails(data);
    } catch (error) {
      console.error('Error fetching user details:', error);
      setUserDetails(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    fetchUserDetails();
  }, [fetchUserDetails]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUserDetails(null);
        setLoading(false);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setLoading(true);
        fetchUserDetails();
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, fetchUserDetails]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchUserDetails();
  }, [fetchUserDetails]);

  return { userDetails, loading, refresh };
}