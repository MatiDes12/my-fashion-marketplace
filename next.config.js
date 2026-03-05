/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    // Option to disable image optimization when limit is reached
    unoptimized: process.env.DISABLE_IMAGE_OPTIMIZATION === 'true',
    domains: [
      'qrigmytqvxuzvrbphpcl.supabase.co',
      'unpkg.com',
      'tile.jawg.io'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.jawg.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'unpkg.com',
        pathname: '/leaflet@**',
      }
    ],
    // Reduced device sizes to minimize optimization variants
    deviceSizes: [640, 768, 1024, 1280],
    // Reduced image sizes to minimize optimization variants
    imageSizes: [16, 32, 64, 96, 128],
    // Increased cache TTL to reduce re-optimization
    minimumCacheTTL: 31536000, // 1 year
    // Enable format optimization
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; frame-src 'none'; sandbox;",
  },
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';

    // Content Security Policy — single authoritative policy
    // unsafe-inline required by Next.js for inline scripts/styles
    // unsafe-eval only in dev (Next.js HMR needs it)
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} 'wasm-unsafe-eval' https://*.vercel-scripts.com https://*.jsdelivr.net https://js.stripe.com`,
      "script-src-elem 'self' 'unsafe-inline' https://*.vercel-scripts.com https://*.jsdelivr.net https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://*.supabase.co https://*.jawg.io https://unpkg.com",
      "media-src 'self' blob: data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel-scripts.com https://*.jsdelivr.net https://*.jawg.io https://*.pusher.com wss://*.pusher.com https://sockjs-*.pusher.com https://nominatim.openstreetmap.org https://*.stripe.com https://api.chapa.co",
      "frame-src 'self' https://checkout.stripe.com https://js.stripe.com",
      "frame-ancestors 'none'",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=(), payment=(self), usb=(), accelerometer=(), gyroscope=()' },
          { key: 'Content-Security-Policy', value: cspDirectives },
          { key: 'X-Powered-By', value: '' },
          { key: 'Server', value: '' },
        ],
      },
      {
        source: '/_next/image',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig; 