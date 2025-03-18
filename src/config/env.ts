export const config = {
  // Use a single URL configuration
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  telebirr: {
    // Production URLs
    production: {
      baseUrl: "https://portal.ethiomobilemoney.et:37443/apiaccess/payment/gateway",
      webBaseUrl: "https://portal.ethiomobilemoney.et:37443/payment/web/paygate"
    },
    // Test Development URLs
    test: {
      baseUrl: "https://196.188.120.3:38443/apiaccess/payment/gateway",
      webBaseUrl: "https://196.188.120.3:38443/payment/web/paygate"
    }
  }
};

// Helper function to get Telebirr URLs based on environment
export const getTelebirrUrls = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? config.telebirr.production : config.telebirr.test;
};

// Helper function to get properly formatted callback URLs
export const getTelebirrCallbackUrls = () => {
  // Use the single baseUrl configuration
  const baseUrl = config.baseUrl;
  return {
    notifyUrl: `${baseUrl}/api/telebirr/notify`.replace(/([^:]\/)\/+/g, "$1"),
    redirectUrl: `${baseUrl}/payment/complete`.replace(/([^:]\/)\/+/g, "$1")
  };
}; 