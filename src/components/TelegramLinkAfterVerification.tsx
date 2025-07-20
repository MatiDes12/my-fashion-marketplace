'use client';

import { useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

export default function TelegramLinkAfterVerification() {
  const supabase = createClientComponent();

  useEffect(() => {
    const linkPendingTelegramAccount = async () => {
      try {
        // Check if there's a pending Telegram chat ID
        const pendingChatId = localStorage.getItem('pendingTelegramChatId');
        const pendingUserId = localStorage.getItem('pendingTelegramUserId');

        if (pendingChatId && pendingUserId) {
          console.log('Found pending Telegram chat ID:', pendingChatId);

          // Get the current session
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.access_token) {
            console.log('Session available, attempting to link Telegram account');

            const response = await fetch('/api/telegram/link-account', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                userId: pendingUserId,
                chatId: pendingChatId
              }),
            });

            const responseData = await response.json();
            console.log('Telegram link response:', responseData);

            if (response.ok) {
              console.log('Telegram account linked successfully after verification');
              toast.success('Telegram account linked successfully!');
              
              // Clear the pending data
              localStorage.removeItem('pendingTelegramChatId');
              localStorage.removeItem('pendingTelegramUserId');
            } else {
              console.error('Failed to link Telegram account after verification:', responseData);
              toast.error('Failed to link Telegram account. You can link it manually in your profile.');
            }
          } else {
            console.log('No session available yet, will retry later');
          }
        }
      } catch (error) {
        console.error('Error linking pending Telegram account:', error);
      }
    };

    // Try to link immediately
    linkPendingTelegramAccount();

    // Also try after a delay in case session isn't ready yet
    const timeoutId = setTimeout(linkPendingTelegramAccount, 2000);

    return () => clearTimeout(timeoutId);
  }, [supabase.auth]);

  return null; // This component doesn't render anything
} 