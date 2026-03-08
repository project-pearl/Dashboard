import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { uploadSubmitSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';

export const dynamic = 'force-dynamic';

const VALID_PARAMS = ['DO', 'pH', 'temperature', 'turbidity', 'bacteria', 'TN', 'TP', 'conductivity'] as const;

const PARAM_UNITS: Record<string, string> = {
  DO: 'mg/L', pH: 'SU', temperature: 'deg C', turbidity: 'NTU',
  bacteria: 'CFU/100mL', TN: 'mg/L', TP: 'mg/L', conductivity: 'uS/cm',
};

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, uploadSubmitSchema);
    if (!parsed.success) return parsed.error;
    const {
      parameter, value, latitude, longitude, location_name, sample_date,
      user_id, user_role, volunteer_id, qa_checklist, student_name, team_name, teacher_uid,
      state_abbr,
    } = parsed.data;

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
