import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  console.log('🔍 Middleware executing for path:', req.nextUrl.pathname);
  
  // Create a response object that we'll modify and return
  const res = NextResponse.next();
  
  // Skip auth for webhook
  if (req.nextUrl.pathname === '/api/telebirr/webhook') {
    return res;
  }
  
  // Create a Supabase client specifically for the middleware
  const supabase = createMiddlewareClient({ req, res });
  
  try {
    // This will refresh the session if needed and set the cookies
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // Log any session errors
    if (error) {
      console.error('🔍 Middleware: Session error:', error.message);
      return NextResponse.redirect(new URL('/login?message=Session+error', req.url));
    }
    
    console.log('🔍 Middleware: Session exists?', !!session);
    
    // For dashboard routes, check authentication and role
    if (req.nextUrl.pathname.startsWith('/dashboard')) {
      console.log('🔍 Middleware: Processing dashboard route');
      
      // If no session, redirect to login
      if (!session) {
        console.log('🔍 Middleware: No session found, redirecting to login');
        
        // Create a redirect response with cache control headers
        const redirectUrl = new URL('/login?message=Please+login+to+access+the+dashboard', req.url);
        const response = NextResponse.redirect(redirectUrl);
        
        // Add headers to prevent caching
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        response.headers.set('Surrogate-Control', 'no-store');
        
        return response;
      }
      
      // If we have a session, check the role
      try {
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (error) {
          console.error('🔍 Middleware: Error checking role:', error.message);
          return NextResponse.redirect(new URL('/login?message=Error+checking+permissions', req.url));
        }
        
        if (data?.role !== 'owner') {
          console.log('🔍 Middleware: User is not an owner, redirecting to home');
          return NextResponse.redirect(new URL('/?message=Access+denied', req.url));
        }
        
        console.log('🔍 Middleware: User is an owner, allowing access to dashboard');
        
        // Add cache control headers to the successful response too
        res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.headers.set('Pragma', 'no-cache');
        res.headers.set('Expires', '0');
        res.headers.set('Surrogate-Control', 'no-store');
      } catch (error) {
        console.error('🔍 Middleware: Error checking role:', error);
        return NextResponse.redirect(new URL('/login?message=Error+checking+permissions', req.url));
      }
    }
    
    // Handle auth callback
    if (req.nextUrl.pathname === '/auth/callback') {
      try {
        const code = req.nextUrl.searchParams.get('code');
        
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          return NextResponse.redirect(new URL('/', req.url));
        }
      } catch (error) {
        console.error('🔍 Middleware: Auth callback error:', error);
        return NextResponse.redirect(new URL('/login?error=Auth+failed', req.url));
      }
    }
    
    // Handle admin routes
    if (req.nextUrl.pathname.startsWith('/admin')) {
      if (!session) {
        // Not logged in, redirect to regular login with return URL
        const returnUrl = encodeURIComponent(req.nextUrl.pathname);
        return NextResponse.redirect(new URL(`/login?returnUrl=${returnUrl}`, req.url));
      }

      // Check if user is admin or owner
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin, role')
        .eq('id', session.user.id)
        .single();

      if (!userData?.is_admin && userData?.role !== 'owner') {
        // Not an admin or owner, redirect to home
        return NextResponse.redirect(new URL('/?message=Access+denied', req.url));
      }
    }
    
    // Return the response with the session cookie set
    return res;
  } catch (error) {
    console.error('🔍 Middleware error:', error);
    return NextResponse.redirect(new URL('/login?message=Authentication+error', req.url));
  }
}

// Run middleware on dashboard routes and auth callback
export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/auth/callback',
    '/admin',
    '/admin/revenue',
    '/admin/withdrawals',
    '/admin/withdrawals/manage',
    '/admin/:path*',
    '/api/telebirr/webhook'
  ]
}; 