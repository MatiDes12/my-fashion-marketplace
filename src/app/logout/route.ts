import { createRouteClient } from '@/lib/supabase-route';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = await createRouteClient();
  
  // Sign out the user
  await supabase.auth.signOut();
  
  // Create a response that redirects to the home page
  const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
  
  // Add cache control headers to prevent caching
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  
  // Clear all cookies related to authentication
  const allCookies = cookieStore.getAll();
  for (const cookie of allCookies) {
    if (cookie.name.includes('supabase') || cookie.name.includes('auth') || cookie.name.includes('sb-')) {
      response.cookies.delete(cookie.name);
    }
  }
  
  return response;
}