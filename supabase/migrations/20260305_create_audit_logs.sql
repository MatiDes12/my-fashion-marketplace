-- Audit logs table for tracking all system events
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    level text NOT NULL DEFAULT 'info',
    category text NOT NULL DEFAULT 'system',
    action text NOT NULL,
    message text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_level ON public.audit_logs (level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs (category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);

-- RLS: Only service_role can insert (server-side only), admins can read
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by server-side audit logger)
GRANT ALL ON TABLE public.audit_logs TO service_role;

-- No direct access for anon or authenticated users
-- Admin reads go through the API which uses service_role
REVOKE ALL ON TABLE public.audit_logs FROM anon;
REVOKE ALL ON TABLE public.audit_logs FROM authenticated;

-- Auto-cleanup: delete logs older than 90 days (run via cron)
-- This is handled by the expire-subscriptions cron or a dedicated cleanup
