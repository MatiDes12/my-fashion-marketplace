import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Basic rate limiting map (in production, use Redis or similar)
const rateLimit = new Map();

// Allowed image dimensions
const ALLOWED_DIMENSIONS = [16, 32, 48, 64, 96, 128, 256, 640, 750, 828, 1080, 1200, 1920];

// Function to validate image optimization parameters
function validateImageRequest(url: URL): boolean {
  const q = Number(url.searchParams.get('q')) || 75;
  const w = Number(url.searchParams.get('w')) || 0;
  
  // Validate quality parameter
  if (q < 10 || q > 100) {
    return false;
  }

  // Validate width parameter
  if (!ALLOWED_DIMENSIONS.includes(w)) {
    return false;
  }

  // Validate URL parameter
  const imageUrl = url.searchParams.get('url');
  if (!imageUrl) {
    return false;
  }

  try {
    const parsedUrl = new URL(imageUrl, 'https://www.avrioxshop.com');
    // Only allow images from trusted domains
    const allowedDomains = ['qrigmytqvxuzvrbphpcl.supabase.co', 'www.avrioxshop.com'];
    return allowedDomains.some(domain => parsedUrl.hostname.endsWith(domain));
  } catch {
    // If URL is relative, it's from our domain which is fine
    return true;
  }
}

// Function to check for common attack patterns
function detectMaliciousRequest(request: NextRequest) {
  const url = request.nextUrl.toString().toLowerCase();
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';

  // Check for common SQL injection patterns
  if (url.includes('union select') || url.includes('execute(') || url.includes('1=1')) {
    return true;
  }

  // Check for common XSS patterns
  if (url.includes('<script') || url.includes('javascript:')) {
    return true;
  }

  // Check for suspicious user agents
  if (userAgent.includes('sqlmap') || userAgent.includes('nikto') || userAgent.includes('nmap')) {
    return true;
  }

  return false;
}

export async function middleware(req: NextRequest) {
  // List of public API endpoints that don't require authentication
  const publicApiRoutes = [
    '/api/delivery/validate-token',
    '/api/delivery/update-status',
    '/api/delivery/get-deliveries',
    '/api/delivery/upload-proof'
  ];

  // Skip middleware for static files and specific public routes
  if (
    req.nextUrl.pathname.startsWith('/_next/static') ||
    req.nextUrl.pathname.startsWith('/static') ||
    req.nextUrl.pathname.startsWith('/delivery/login') ||
    publicApiRoutes.includes(req.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  // Handle image optimization requests
  if (req.nextUrl.pathname.startsWith('/_next/image')) {
    if (!validateImageRequest(req.nextUrl)) {
      return new NextResponse('Invalid image request', { status: 400 });
    }
  }

  // Security Checks
  // 1. Rate limiting
  const ip = req.ip || 'unknown';
  if (rateLimit.has(ip)) {
    const { count, timestamp } = rateLimit.get(ip);
    const timeDiff = Date.now() - timestamp;

    if (timeDiff > 60000) {
      rateLimit.set(ip, { count: 1, timestamp: Date.now() });
    } else if (count > 100) { // More than 100 requests per minute
      return new NextResponse('Too Many Requests', { status: 429 });
    } else {
      rateLimit.set(ip, { count: count + 1, timestamp });
    }
  } else {
    rateLimit.set(ip, { count: 1, timestamp: Date.now() });
  }

  // 2. Check for malicious patterns
  if (detectMaliciousRequest(req)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // 3. Ensure HTTPS in production
  if (process.env.NODE_ENV === 'production' && !req.nextUrl.protocol.includes('https')) {
    return NextResponse.redirect(
      `https://${req.nextUrl.host}${req.nextUrl.pathname}`,
      301
    );
  }

  // Create a response object that we'll modify and return
  const res = NextResponse.next();
  
  // Create a Supabase client specifically for the middleware
  const supabase = createMiddlewareClient({ req, res });
  
  try {
    // Only check session for protected routes
    if (
      req.nextUrl.pathname.startsWith('/dashboard') ||
      req.nextUrl.pathname.startsWith('/admin') ||
      req.nextUrl.pathname === '/auth/callback' ||
      (req.nextUrl.pathname.startsWith('/delivery') && !req.nextUrl.pathname.startsWith('/delivery/login'))
    ) {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('🔍 Middleware: Session error:', error.message);
        return NextResponse.redirect(new URL('/login?message=Session+error', req.url));
      }

      // For dashboard routes, check authentication and role
      if (req.nextUrl.pathname.startsWith('/dashboard')) {
        if (!session) {
          return NextResponse.redirect(new URL('/login?message=Please+login+to+access+the+dashboard', req.url));
        }
        
        // Check role only if we have a session
        const { data, error: roleError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (roleError || data?.role !== 'owner') {
          return NextResponse.redirect(new URL('/?message=Access+denied', req.url));
        }
      }

      // For delivery routes (except login), check delivery session
      if (req.nextUrl.pathname.startsWith('/delivery') && !req.nextUrl.pathname.startsWith('/delivery/login')) {
        // Check if delivery account info exists in session storage
        const deliveryAccount = req.cookies.get('deliveryAccount');
        if (!deliveryAccount) {
          return NextResponse.redirect(new URL('/delivery/login', req.url));
        }
      }

      // Handle admin routes
      if (req.nextUrl.pathname.startsWith('/admin')) {
        if (!session) {
          const returnUrl = encodeURIComponent(req.nextUrl.pathname);
          return NextResponse.redirect(new URL(`/login?returnUrl=${returnUrl}`, req.url));
        }

        const { data: userData } = await supabase
          .from('users')
          .select('is_admin, role')
          .eq('id', session.user.id)
          .single();

        if (!userData?.is_admin && userData?.role !== 'owner') {
          return NextResponse.redirect(new URL('/?message=Access+denied', req.url));
        }
      }
    }
    
    return res;
  } catch (error) {
    console.error('🔍 Middleware error:', error);
    return NextResponse.redirect(new URL('/login?message=Authentication+error', req.url));
  }
}

// Update matcher to include all necessary paths
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/dashboard/:path*',
    '/admin/:path*',
    '/auth/callback',
    '/_next/image'
  ]
}; 