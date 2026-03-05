import { supabaseServer } from '@/lib/supabase-server';

export type AuditLevel = 'info' | 'warn' | 'error' | 'critical';
export type AuditCategory =
  | 'auth'
  | 'payment'
  | 'order'
  | 'delivery'
  | 'admin'
  | 'security'
  | 'system'
  | 'user'
  | 'api';

interface AuditLogEntry {
  level: AuditLevel;
  category: AuditCategory;
  action: string;
  message: string;
  user_id?: string | null;
  ip_address?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Logs an audit event to the audit_logs table.
 * Fire-and-forget — does not throw on failure.
 */
export async function auditLog(entry: AuditLogEntry) {
  try {
    await supabaseServer
      .from('audit_logs')
      .insert({
        level: entry.level,
        category: entry.category,
        action: entry.action,
        message: entry.message,
        user_id: entry.user_id || null,
        ip_address: entry.ip_address || null,
        metadata: entry.metadata || null,
      });
  } catch (err) {
    // Never let audit logging break the main flow
    console.error('[audit-logger] Failed to write audit log:', err);
  }
}

/**
 * Extract IP from request headers (works on Vercel).
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
