'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export interface UserDetails {
  id: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
  role?: string;
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

  useEffect(() => {
    async function fetchUserDetails() {
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
    }

    fetchUserDetails();
  }, [supabase]);

  return { userDetails, loading };
} 