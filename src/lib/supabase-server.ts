import { createClient } from '@supabase/supabase-js';

// Validate public environment variables (available on client and server)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
}

// Server-side client with service role key for admin operations (server only)
let supabaseServerInternal: ReturnType<typeof createClient> | undefined;
if (typeof window === 'undefined') {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  supabaseServerInternal = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Export as non-optional type to avoid TS noise in server-only imports.
// Do NOT import this in client components.
export const supabaseServer = (supabaseServerInternal as unknown as ReturnType<typeof createClient>);

export function getSupabaseServer() {
  if (!supabaseServerInternal) {
    throw new Error('supabaseServer is only available on the server');
  }
  return supabaseServerInternal;
}

// Server/client-safe anon client for regular operations
export const supabaseServerAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});