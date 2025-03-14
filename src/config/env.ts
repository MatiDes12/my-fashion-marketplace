export const config = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL!,
  // Base URLs for Telebirr based on environment
  telebirr: {
    urls: {
      development: {
        api: 'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway',
        web: 'https://developerportal.ethiotelebirr.et:38443/payment/web/paygate',
      },
      production: {
        api: 'https://portal.ethiomobilemoney.et:5118/payment/',
        web: 'https://portal.ethiomobilemoney.et:5118/payment/',
      }
    },
    endpoints: {
      token: '/payment/v1/token',
      preOrder: '/payment/v1/merchant/preOrder',
    },
    timeout: 30000,
    retries: 3,
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  }
} as const;

// Helper function to get the correct base URL based on environment
export const getTelebirrBaseUrl = () => {
  const env = process.env.NODE_ENV || 'development';
  return config.telebirr.urls[env as keyof typeof config.telebirr.urls].api;
};

// Helper function to get the web payment URL
export const getTelebirrWebUrl = () => {
  const env = process.env.NODE_ENV || 'development';
  return config.telebirr.urls[env as keyof typeof config.telebirr.urls].web;
};

// URL validation helper
export const validateTelebirrUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.protocol === 'https:' && 
      (parsedUrl.hostname === '196.188.120.3' || // Test environment
       parsedUrl.hostname.endsWith('.ethiotelecom.et')) // Production domain
    );
  } catch {
    return false;
  }
};

// Environment variable validation
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`Warning: Missing environment variable: ${envVar}`);
    }
  }
} 