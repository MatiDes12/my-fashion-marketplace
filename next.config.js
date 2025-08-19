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
    dangerouslyAllowSVG: false,
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
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), accelerometer=(), gyroscope=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob: https://*.supabase.co https://*.jawg.io https://unpkg.com; font-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; upgrade-insecure-requests; block-all-mixed-content"
          },
          {
            key: 'X-Powered-By',
            value: ''
          },
          {
            key: 'Server',
            value: ''
          }
        ]
      },
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; img-src 'self' data: https: blob: https://*.supabase.co https://*.jawg.io https://unpkg.com;"
          }
        ]
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=self'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://*.vercel-scripts.com https://*.jsdelivr.net https://js.stripe.com",
              "script-src-elem 'self' 'unsafe-inline' https://*.vercel-scripts.com https://*.jsdelivr.net",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https: https://*.supabase.co https://*.jawg.io https://unpkg.com",
              "media-src 'self' blob: data:",
              "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://*.vercel-scripts.com https://*.jsdelivr.net wss://*.supabase.co https://*.jawg.io https://*.pusher.com wss://*.pusher.com https://sockjs-*.pusher.com https://nominatim.openstreetmap.org https://*.stripe.com https://api.stripe.com",
              "frame-src 'self' https://checkout.stripe.com https://js.stripe.com",
              "font-src 'self' https: data:",
              "worker-src 'self' blob:",
              "child-src 'self' blob:"
            ].join('; ')
          }
        ]
      }
    ]
  },
};

module.exports = nextConfig; 