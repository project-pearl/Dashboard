import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { InvitePayload, normalizeUserRole, resolveAdminLevel } from '@/lib/authTypes';
import { encodeInviteToken } from '@/lib/inviteTokens';
import { getInvitableRoles, canInviteRole } from '@/lib/adminHierarchy';
import type { AdminLevel } from '@/lib/authTypes';

type CreateInviteBody = {
  role?: string;
  email?: string;
  jurisdiction?: string;
  state?: string;
  organization?: string;
  expiresInDays?: number;
  isMilitary?: boolean;
};

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!anonUrl || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Server is missing Supabase configuration.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return unauthorized('Missing auth token.');

  const supabaseAuth = createClient(anonUrl, anonKey);
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData.user) return unauthorized('Invalid auth token.');

  // Fetch caller profile with admin_level and scope fields
  const supabaseAdmin = createClient(anonUrl, serviceKey);
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('admin_level, role, state, ms4_jurisdiction, email')
    .eq('id', userData.user.id)
    .single();

  const callerEmail = profile?.email || userData.user.email || '';
  const adminLevel = resolveAdminLevel(profile?.admin_level, callerEmail);
  if (adminLevel === 'none') return forbidden('You do not have invite permissions.');

  const callerRole = normalizeUserRole(profile?.role);

  const body = (await request.json().catch(() => ({}))) as CreateInviteBody;
  const targetRole = normalizeUserRole(body.role);

  // Check role is in caller's invitable list
  const allowed = getInvitableRoles(adminLevel, callerRole);
  if (!allowed.includes(targetRole)) {
    return forbidden(`Your admin level cannot invite ${targetRole} users.`);
  }

  // Scope containment: force caller's state/jurisdiction for non-super admins
  let effectiveState = body.state ? String(body.state).trim().toUpperCase() : undefined;
  let effectiveJurisdiction = body.jurisdiction ? String(body.jurisdiction).trim() : undefined;

  if (adminLevel !== 'super_admin' && callerRole !== 'Federal') {
    // Lock state to caller's state
    if (profile?.state) {
      effectiveState = profile.state;
    }
    // Lock jurisdiction for Local/MS4
    if ((callerRole === 'Local' || callerRole === 'MS4') && profile?.ms4_jurisdiction) {
      effectiveJurisdiction = profile.ms4_jurisdiction;
    }
  }

  // Full scope validation
  const check = canInviteRole(
    { adminLevel, role: callerRole, state: profile?.state, jurisdiction: profile?.ms4_jurisdiction },
    { role: targetRole, state: effectiveState, jurisdiction: effectiveJurisdiction },
  );
  if (!check.ok) return forbidden(check.reason || 'Invite not permitted.');

  const expiresInDays = Math.max(1, Math.min(30, Number(body.expiresInDays) || 7));
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const payload: InvitePayload = {
    role: targetRole,
    invitedBy: userData.user.id,
    createdAt,
    expiresAt,
    email: body.email ? String(body.email).trim().toLowerCase() : undefined,
    organization: body.organization ? String(body.organization).trim() : undefined,
    state: effectiveState,
    jurisdiction: effectiveJurisdiction,
    isMilitary: targetRole === 'Federal' && body.isMilitary ? true : undefined,
  };

  let inviteToken = '';
  try {
    inviteToken = encodeInviteToken(payload);
  } catch {
    return NextResponse.json({ error: 'Invite token signing is not configured.' }, { status: 500 });
  }
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '');
  const link = `${baseUrl}/login?invite=${encodeURIComponent(inviteToken)}`;

  // Write audit log
  await supabaseAdmin.from('invite_audit_log').insert({
    action: 'invite_created',
    actor_id: userData.user.id,
    actor_email: callerEmail,
    actor_admin_level: adminLevel,
    target_email: payload.email || null,
    target_role: targetRole,
    target_state: effectiveState || null,
    target_jurisdiction: effectiveJurisdiction || null,
    target_admin_level: 'none',
    metadata: { expires_at: expiresAt, is_military: payload.isMilitary || false },
  }).then(() => {}, () => {}); // fire-and-forget

  return NextResponse.json({ link, expiresAt });
}
