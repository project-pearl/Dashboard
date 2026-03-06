import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { InvitePayload, checkIsAdmin, normalizeUserRole } from '@/lib/authTypes';
import { encodeInviteToken } from '@/lib/inviteTokens';

type CreateInviteBody = {
  role?: string;
  email?: string;
  jurisdiction?: string;
  state?: string;
  organization?: string;
  expiresInDays?: number;
};

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
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

  const supabaseAdmin = createClient(anonUrl, serviceKey);
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single();
  const isAdmin = !!profile?.is_admin || checkIsAdmin(userData.user.email || '');
  if (!isAdmin) return unauthorized('Admin access required.');

  const body = (await request.json().catch(() => ({}))) as CreateInviteBody;
  const role = normalizeUserRole(body.role);
  const expiresInDays = Math.max(1, Math.min(30, Number(body.expiresInDays) || 7));
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const payload: InvitePayload = {
    role,
    invitedBy: userData.user.id,
    createdAt,
    expiresAt,
    email: body.email ? String(body.email).trim().toLowerCase() : undefined,
    organization: body.organization ? String(body.organization).trim() : undefined,
    state: body.state ? String(body.state).trim().toUpperCase() : undefined,
    jurisdiction: body.jurisdiction ? String(body.jurisdiction).trim() : undefined,
  };

  let inviteToken = '';
  try {
    inviteToken = encodeInviteToken(payload);
  } catch {
    return NextResponse.json({ error: 'Invite token signing is not configured.' }, { status: 500 });
  }
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '');
  const link = `${baseUrl}/login?invite=${encodeURIComponent(inviteToken)}`;

  return NextResponse.json({ link, expiresAt });
}
