import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { uploadApproveSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, uploadApproveSchema);
    if (!parsed.success) return parsed.error;
    const { sample_ids, approved_by, action } = parsed.data;

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
