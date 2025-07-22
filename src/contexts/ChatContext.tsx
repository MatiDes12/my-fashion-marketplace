'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface ChatContextType {
  socket: any;
  isConnected: boolean;
  currentUser: any;
}

const ChatContext = createContext<ChatContextType>({
  socket: null,
  isConnected: false,
  currentUser: null,
});

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection when user is available
    if (user) {
      // For now, we'll use a simple mock socket
      // In a real implementation, you'd connect to your WebSocket server
      const mockSocket = {
        on: (event: string, callback: Function) => {
          // Mock socket event listener
        },
        off: (event: string) => {
          // Mock socket event removal
        },
        emit: (event: string, data: any) => {
          // Mock socket emit
          console.log('Socket emit:', event, data);
        },
      };
      
      setSocket(mockSocket);
      setIsConnected(true);
    }
  }, [user]);

  const value = {
    socket,
    isConnected,
    currentUser: user,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}; 