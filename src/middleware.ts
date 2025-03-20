import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // Skip middleware for static files and api routes
  if (
    req.nextUrl.pathname.startsWith('/_next') ||
    req.nextUrl.pathname.startsWith('/static') ||
    req.nextUrl.pathname.startsWith('/api')
  ) {
    return NextResponse.next();
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
      req.nextUrl.pathname === '/auth/callback'
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

// Update matcher to be more specific
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/auth/callback'
  ]
}; 