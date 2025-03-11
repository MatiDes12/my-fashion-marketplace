'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClientComponent();

  useEffect(() => {
    const checkUser = async () => {
      try {
        setIsLoading(true);
        console.log("AuthContext - Checking user session");
        
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          return;
        }
        
        if (session?.user) {
          console.log("AuthContext - User is logged in:", session.user.email);
          setUser(session.user);
        } else {
          console.log("AuthContext - No user logged in");
          setUser(null);
        }
      } catch (error) {
        console.error("Unexpected error in AuthContext:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkUser();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("AuthContext - Auth state changed:", event);
        
        if (session?.user) {
          console.log("AuthContext - User is now logged in:", session.user.email);
          setUser(session.user);
        } else {
          console.log("AuthContext - User is now logged out");
          setUser(null);
        }
        
        setIsLoading(false);
      }
    );
    
    // Clean up subscription when component unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}; 