import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sample_ids, approved_by, action } = body;

    if (!sample_ids || !Array.isArray(sample_ids) || sample_ids.length === 0) {
      return NextResponse.json({ error: 'sample_ids must be a non-empty array' }, { status: 400 });
    }

    if (!approved_by) {
      return NextResponse.json({ error: 'approved_by is required' }, { status: 400 });
    }

    const status = action === 'reject' ? 'REJECTED' : 'ACTIVE';

    const { data, error } = await supabase
      .from('water_samples')
      .update({
        status,
        approved_by,
        approved_at: new Date().toISOString(),
      })
      .in('id', sample_ids)
      .eq('status', 'PENDING')
      .select();

    if (error) {
      console.error('[uploads/approve] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to update samples' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updatedCount: data?.length || 0,
      status,
    });
  } catch (err) {
    console.error('[uploads/approve] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
