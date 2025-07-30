'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
}

export default function OptimizedImage({
  src,
  alt,
  className = '',
  fill = false,
  width,
  height,
  priority = false,
  sizes,
  quality = 75,
  placeholder = 'empty',
  blurDataURL
}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px 0px', // Start loading 50px before the image comes into view
        threshold: 0.1
      }
    );

    if (imageRef.current) {
      observer.observe(imageRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  // Optimize sizes based on usage context
  const getOptimizedSizes = () => {
    if (sizes) return sizes;
    
    if (fill) {
      return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
    }
    
    if (width && width <= 128) {
      return `${width}px`;
    }
    
    return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw';
  };

  // Optimize quality based on image size
  const getOptimizedQuality = () => {
    if (width && width <= 64) return 60;
    if (width && width <= 128) return 70;
    return quality;
  };

  // Handle image error
  const handleError = () => {
    setImageError(true);
  };

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true);
  };

  // Don't render if not in view and not priority
  if (!isInView && !priority) {
    return (
      <div 
        ref={imageRef}
        className={`bg-gray-200 animate-pulse ${className}`}
        style={fill ? {} : { width, height }}
      />
    );
  }

  // Show placeholder on error
  if (imageError) {
    return (
      <div 
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        style={fill ? {} : { width, height }}
      >
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div ref={imageRef} className={`relative ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        sizes={getOptimizedSizes()}
        quality={getOptimizedQuality()}
        priority={priority}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        onError={handleError}
        onLoad={handleLoad}
      />
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
} 