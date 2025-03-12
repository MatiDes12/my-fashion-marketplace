/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'localhost',
      '127.0.0.1',
      'habeshamarket.com',
      'supabase.co',
      'supabase.io',
      'supabase.in',
      'supabase.com',
      'xnvufnoqbtpvoiqhsrdo.supabase.co'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.ethiotelebirr.et',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // Remove allowDynamicRoutes as it's not needed
  },
};

module.exports = nextConfig; 