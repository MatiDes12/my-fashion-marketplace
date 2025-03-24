'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { createClientComponent } from '@/lib/supabase';

export const FloatingPreview = () => {
  const supabase = createClientComponent();
  const [session, setSession] = useState<any>(null);
  const [lastViewedProduct, setLastViewedProduct] = useState<any>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get the current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);

      // Only get last viewed product if user is logged in
      if (session?.user) {
        const stored = localStorage.getItem('lastViewedProduct');
        if (stored) {
          setLastViewedProduct(JSON.parse(stored));
        }
      }
    });

    // Listen for session changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session?.user) {
        setLastViewedProduct(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Add scroll event listener to ensure the component stays visible
  useEffect(() => {
    if (!lastViewedProduct) return;

    const handleScroll = () => {
      if (previewRef.current) {
        // Force the component to stay at its position
        previewRef.current.style.position = 'fixed';
        previewRef.current.style.top = '80px';
        previewRef.current.style.right = '20px';
        previewRef.current.style.zIndex = '9999';
      }
    };

    // Call once to set initial position
    handleScroll();
    
    // Add event listener
    window.addEventListener('scroll', handleScroll);
    
    // Clean up
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastViewedProduct]);

  // Only render if user is logged in and there's a last viewed product
  if (!session?.user || !lastViewedProduct) return null;

  return (
    <div 
      ref={previewRef}
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        backgroundColor: '#1F2937',
        color: 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid #374151',
        maxWidth: '300px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}
    >
      <div style={{
        position: 'relative',
        width: '64px',
        height: '64px'
      }}>
        <Image
          src={lastViewedProduct.image || "/images/recently-viewed.jpg"}
          alt={lastViewedProduct.title || "Recently Viewed"}
          fill
          style={{
            objectFit: 'cover',
            borderRadius: '8px'
          }}
        />
      </div>
      <div>
        <p style={{
          fontSize: '14px',
          color: '#9CA3AF'
        }}>Recently Viewed</p>
        <p style={{
          color: 'white',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '150px'
        }}>{lastViewedProduct.title}</p>
        <p style={{
          fontSize: '14px',
          color: '#F87171'
        }}>ETB {lastViewedProduct.price?.toLocaleString()}</p>
      </div>
      <button 
        onClick={() => {
          setLastViewedProduct(null);
          localStorage.removeItem('lastViewedProduct');
        }}
        style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          backgroundColor: '#4B5563',
          borderRadius: '9999px',
          padding: '4px',
          color: 'white',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        <svg style={{
          width: '16px',
          height: '16px'
        }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}; 