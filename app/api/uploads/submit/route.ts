import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const VALID_PARAMS = ['DO', 'pH', 'temperature', 'turbidity', 'bacteria', 'TN', 'TP', 'conductivity'] as const;

const PARAM_UNITS: Record<string, string> = {
  DO: 'mg/L', pH: 'SU', temperature: 'deg C', turbidity: 'NTU',
  bacteria: 'CFU/100mL', TN: 'mg/L', TP: 'mg/L', conductivity: 'uS/cm',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      parameter, value, latitude, longitude, location_name, sample_date,
      user_id, user_role, volunteer_id, qa_checklist, student_name, team_name, teacher_uid,
      state_abbr,
    } = body;

    // Validate required fields
    if (!parameter || value == null || !latitude || !longitude || !user_id || !user_role) {
      return NextResponse.json({ error: 'Missing required fields: parameter, value, latitude, longitude, user_id, user_role' }, { status: 400 });
    }

    if (!VALID_PARAMS.includes(parameter)) {
      return NextResponse.json({ error: `Invalid parameter. Must be one of: ${VALID_PARAMS.join(', ')}` }, { status: 400 });
    }

    if (typeof value !== 'number' || isNaN(value)) {
      return NextResponse.json({ error: 'Value must be a valid number' }, { status: 400 });
    }

    if (user_role !== 'NGO' && user_role !== 'K12') {
      return NextResponse.json({ error: 'user_role must be NGO or K12' }, { status: 400 });
    }

    const provenance = user_role === 'NGO' ? 'CITIZEN_SCIENCE' : 'EDUCATIONAL';
    const unit = PARAM_UNITS[parameter] || 'unknown';

    const { data, error } = await supabase.from('water_samples').insert({
      parameter,
      value,
      unit,
      sample_date: sample_date || new Date().toISOString(),
      latitude,
      longitude,
      location_name: location_name || null,
      state_abbr: state_abbr || null,
      uploaded_by: user_id,
      user_role,
      provenance,
      volunteer_id: volunteer_id || null,
      qa_checklist: qa_checklist || null,
      student_name: student_name || null,
      team_name: team_name || null,
      teacher_uid: teacher_uid || null,
      status: 'PENDING',
    }).select().single();

    if (error) {
      console.error('[uploads/submit] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to insert sample' }, { status: 500 });
    }

    return NextResponse.json({ success: true, sample: data });
  } catch (err) {
    console.error('[uploads/submit] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
