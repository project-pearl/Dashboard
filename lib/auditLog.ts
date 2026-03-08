import { createClient } from '@supabase/supabase-js';

interface AuditEntry {
  actor_id: string;
  actor_email: string;
  action: string;
  target_id?: string;
  target_email?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget admin audit log.
 * Writes to the `admin_audit_log` table using the service-role client.
 * Failures are silently swallowed so they never block the calling route.
 */
export function logAdminAction(entry: AuditEntry): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key);
  supabase
    .from('admin_audit_log')
    .insert({
      actor_id: entry.actor_id,
      actor_email: entry.actor_email,
      action: entry.action,
      target_id: entry.target_id ?? null,
      target_email: entry.target_email ?? null,
      metadata: entry.metadata ?? null,
    })
    .then(() => {}, () => {});
}
