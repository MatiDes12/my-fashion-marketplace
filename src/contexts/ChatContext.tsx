'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

interface ChatContextType {
  socket: Socket | null;
  isConnected: boolean;
  currentUser: any;
  connect: () => void;
  disconnect: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const supabase = createClientComponent();

  const connect = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found, cannot connect to chat');
        return;
      }

      setCurrentUser(user);

      // Create socket connection
      const newSocket = io(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
      
      newSocket.on('connect', () => {
        console.log('Connected to chat server');
        setIsConnected(true);
        
        // Authenticate with socket
        newSocket.emit('authenticate', {
          userId: user.id,
          userType: user.user_metadata?.role || 'customer'
        });
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from chat server');
        setIsConnected(false);
      });

      newSocket.on('authenticated', (data) => {
        if (data.success) {
          console.log('Authenticated with chat server');
        } else {
          console.error('Failed to authenticate with chat server:', data.error);
          toast.error('Failed to connect to chat server');
        }
      });

      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
        toast.error('Chat connection error');
      });

      setSocket(newSocket);
    } catch (error) {
      console.error('Error connecting to chat:', error);
      toast.error('Failed to connect to chat');
    }
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    // Connect when component mounts
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []);

  const value = {
    socket,
    isConnected,
    currentUser,
    connect,
    disconnect
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
} 