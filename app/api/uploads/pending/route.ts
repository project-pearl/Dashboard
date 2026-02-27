import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stateAbbr = searchParams.get('stateAbbr');
    const teacherUid = searchParams.get('teacherUid');
    const userRole = searchParams.get('userRole');

    let query = supabase
      .from('water_samples')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(200);

    if (stateAbbr) {
      query = query.eq('state_abbr', stateAbbr);
    }

    if (teacherUid) {
      query = query.eq('teacher_uid', teacherUid);
    }

    if (userRole) {
      query = query.eq('user_role', userRole);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[uploads/pending] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch pending samples' }, { status: 500 });
    }

    return NextResponse.json({ samples: data || [] });
  } catch (err) {
    console.error('[uploads/pending] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
