import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/**
 * Log an impersonation start event to audit_logs.
 * Returns the audit log ID so it can be stored in localStorage
 * and linked to the end event.
 */
export async function logImpersonationStart(params: {
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetName: string;
  targetRole: string;
  targetEmail: string;
}): Promise<string | null> {
  try {
    const { data, error } = await sb
      .from('audit_logs')
      .insert({
        user_id: params.adminId,
        action: 'impersonate_start',
        table_name: 'users',
        record_id: params.targetUserId,
        new_value: {
          admin_email: params.adminEmail,
          target_user_id: params.targetUserId,
          target_name: params.targetName,
          target_role: params.targetRole,
          target_email: params.targetEmail,
          started_at: new Date().toISOString(),
        },
        reason: `Admin ${params.adminEmail} started impersonating ${params.targetName} (${params.targetRole})`,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[audit] Failed to log impersonation start:', error);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.error('[audit] impersonation start error:', err);
    return null;
  }
}

/**
 * Log an impersonation end event to audit_logs.
 * Links to the start event via the auditLogId.
 */
export async function logImpersonationEnd(params: {
  adminId: string;
  adminEmail: string;
  auditLogId: string;
  targetUserId: string;
  targetName: string;
  targetRole: string;
  startedAt: string;
}): Promise<void> {
  try {
    const startTime = new Date(params.startedAt).getTime();
    const durationSeconds = startTime > 0
      ? Math.round((Date.now() - startTime) / 1000)
      : 0;

    await sb.from('audit_logs').insert({
      user_id: params.adminId,
      action: 'impersonate_end',
      table_name: 'users',
      record_id: params.targetUserId,
      old_value: {
        audit_log_id: params.auditLogId,
      },
      new_value: {
        admin_email: params.adminEmail,
        target_user_id: params.targetUserId,
        target_name: params.targetName,
        target_role: params.targetRole,
        duration_seconds: durationSeconds,
        duration_display: formatDuration(durationSeconds),
        ended_at: new Date().toISOString(),
      },
      reason: `Admin ${params.adminEmail} stopped impersonating ${params.targetName} (${params.targetRole}) after ${formatDuration(durationSeconds)}`,
    });
  } catch (err) {
    console.error('[audit] impersonation end error:', err);
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}
