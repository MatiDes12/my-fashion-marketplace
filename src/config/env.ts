export const config = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  telebirr: {
    // Base URLs
    baseUrl: {
      development: 'https://196.188.120.3:38443/apiaccess/payment/gateway', // Test environment
      production: process.env.NEXT_PUBLIC_TELEBIRR_PROD_URL || 'https://196.188.120.3:38443/apiaccess/payment/gateway', // Replace with actual prod URL
    },
    // API endpoints
    endpoints: {
      token: '/payment/v1/token',
      preOrder: '/payment/v1/merchant/preOrder',
    },
    // Connection settings
    timeout: 30000, // 30 seconds
    retries: 3,
    proxyUrl: process.env.ETHIOPIAN_PROXY_URL,
    useProxy: process.env.NODE_ENV === 'production',
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
} as const;

export const getTelebirrUrl = () => {
  const env = process.env.NODE_ENV || 'development';
  return config.telebirr.baseUrl[env as keyof typeof config.telebirr.baseUrl];
};

export const validateTelebirrUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.protocol === 'https:' && 
      (parsedUrl.hostname === '196.188.120.3' || // Test environment
       parsedUrl.hostname.endsWith('.telebirr.com')) // Production domain (example)
    );
  } catch {
    return false;
  }
};

// Only validate in development and server-side
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_TELEBIRR_API_URL'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`Warning: Missing environment variable: ${envVar}`);
    }
  }
} 