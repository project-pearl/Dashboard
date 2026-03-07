import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveAdminLevel } from '@/lib/authTypes';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!anonUrl || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Server is missing Supabase configuration.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Missing auth token.' }, { status: 401 });

  const authClient = createClient(anonUrl, anonKey);
  const { data: userData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !userData.user) {
    return NextResponse.json({ error: 'Invalid auth token.' }, { status: 401 });
  }

  const adminClient = createClient(anonUrl, serviceKey);
  const { data: profile } = await adminClient
    .from('profiles')
    .select('admin_level, email')
    .eq('id', userData.user.id)
    .single();

  const adminLevel = resolveAdminLevel(profile?.admin_level, profile?.email || userData.user.email || '');
  if (adminLevel === 'none') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const uid = params.uid;
  if (!uid) return NextResponse.json({ error: 'Missing target user id.' }, { status: 400 });
  if (uid === userData.user.id) {
    return NextResponse.json({ error: 'Admins cannot delete their own account from this panel.' }, { status: 400 });
  }

  // Keep profile delete as a fallback cleanup even if auth user is already gone.
  await adminClient.from('profiles').delete().eq('id', uid);

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(uid);
  if (deleteError && !/not found/i.test(deleteError.message || '')) {
    return NextResponse.json({ error: deleteError.message || 'Failed to delete auth user.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

