import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors when env vars aren't available
let supabaseServerInstance: ReturnType<typeof createClient> | undefined;
let supabaseAnonInstance: ReturnType<typeof createClient> | undefined;

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function createServerClient() {
  if (!supabaseServerInstance) {
    const url = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = getEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY');
    supabaseServerInstance = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseServerInstance;
}

function createAnonClient() {
  if (!supabaseAnonInstance) {
    const url = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    supabaseAnonInstance = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAnonInstance;
}

// Proxy that lazily initializes on first property access
// This prevents build-time errors when env vars aren't set
export const supabaseServer = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (createServerClient() as any)[prop];
  },
});

export function getSupabaseServer() {
  return createServerClient();
}

// Server/client-safe anon client for regular operations
export const supabaseServerAnon = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (createAnonClient() as any)[prop];
  },
});
