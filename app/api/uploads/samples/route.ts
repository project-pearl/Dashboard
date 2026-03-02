import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stateAbbr = searchParams.get('stateAbbr');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radius = parseFloat(searchParams.get('radius') || '0.5');

    let query = supabase
      .from('water_samples')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('sample_date', { ascending: false })
      .limit(500);

    if (stateAbbr) {
      query = query.eq('state_abbr', stateAbbr);
    }

    if (lat && lng) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        query = query
          .gte('latitude', latNum - radius)
          .lte('latitude', latNum + radius)
          .gte('longitude', lngNum - radius)
          .lte('longitude', lngNum + radius);
      }
    }

    const { data, error } = await query;

    if (error) {
      // Table may not exist yet or schema mismatch — return empty gracefully
      const msg = error.message || '';
      const code = error.code || '';
      if (code === '42P01' || code === 'PGRST204' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('Could not find')) {
        console.warn('[uploads/samples] Table not available:', code, msg);
        return NextResponse.json({ samples: [] });
      }
      console.error('[uploads/samples] Supabase error:', JSON.stringify(error));
      return NextResponse.json({ error: 'Failed to fetch samples' }, { status: 500 });
    }

    return NextResponse.json({ samples: data || [] });
  } catch (err) {
    console.error('[uploads/samples] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
