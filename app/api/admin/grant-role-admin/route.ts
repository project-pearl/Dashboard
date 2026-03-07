import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveAdminLevel } from '@/lib/authTypes';
import type { AdminLevel } from '@/lib/authTypes';

export async function POST(request: NextRequest) {
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!anonUrl || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Server configuration missing.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return NextResponse.json({ error: 'Missing auth token.' }, { status: 401 });
  }

  const supabaseAuth = createClient(anonUrl, anonKey);
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Invalid auth token.' }, { status: 401 });
  }

  // Verify caller is super_admin
  const supabaseAdmin = createClient(anonUrl, serviceKey);
  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('admin_level, email')
    .eq('id', userData.user.id)
    .single();

  const callerEmail = callerProfile?.email || userData.user.email || '';
  const callerAdminLevel = resolveAdminLevel(callerProfile?.admin_level, callerEmail);
  if (callerAdminLevel !== 'super_admin') {
    return NextResponse.json({ error: 'Only super admins can grant admin privileges.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({} as any));
  const targetUserId = body.targetUserId as string;
  const newAdminLevel = body.adminLevel as AdminLevel;

  if (!targetUserId) {
    return NextResponse.json({ error: 'targetUserId is required.' }, { status: 400 });
  }
  if (newAdminLevel !== 'role_admin' && newAdminLevel !== 'none') {
    return NextResponse.json({ error: 'adminLevel must be "role_admin" or "none".' }, { status: 400 });
  }

  // Prevent self-demotion
  if (targetUserId === userData.user.id) {
    return NextResponse.json({ error: 'Cannot change your own admin level.' }, { status: 400 });
  }

  // Update target user
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ admin_level: newAdminLevel })
    .eq('id', targetUserId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update admin level.' }, { status: 500 });
  }

  // Fetch target email for audit log
  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('email, role')
    .eq('id', targetUserId)
    .single();

  // Write audit log
  const action = newAdminLevel === 'role_admin' ? 'admin_granted' : 'admin_revoked';
  await supabaseAdmin.from('invite_audit_log').insert({
    action,
    actor_id: userData.user.id,
    actor_email: callerEmail,
    actor_admin_level: callerAdminLevel,
    target_email: targetProfile?.email || null,
    target_role: targetProfile?.role || '',
    target_admin_level: newAdminLevel,
  }).then(() => {}, () => {});

  return NextResponse.json({ success: true, adminLevel: newAdminLevel });
}
