import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for route handlers that properly handles
 * Next.js 15's async cookies() API.
 *
 * The @supabase/auth-helpers-nextjs package doesn't properly handle
 * the async cookies() in Next.js 15. We resolve the cookie store
 * first and pass it as a resolved value.
 *
 * Usage:
 *   const supabase = await createRouteClient();
 */
export async function createRouteClient() {
  const cookieStore = await cookies();
  // Type assertion needed: auth-helpers types expect Promise<cookies>
  // but the runtime doesn't await it, so we pass the resolved value
  return createRouteHandlerClient({
    cookies: () => cookieStore as any,
  });
}
