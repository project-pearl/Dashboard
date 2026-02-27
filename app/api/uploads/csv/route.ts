import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';

const CSV_TO_PEARL: Record<string, string> = {
  'dissolved_oxygen': 'DO', 'do': 'DO', 'dissolved oxygen': 'DO',
  'ph': 'pH', 'temperature': 'temperature', 'temp': 'temperature',
  'turbidity': 'turbidity', 'e_coli': 'bacteria', 'ecoli': 'bacteria',
  'total_nitrogen': 'TN', 'tn': 'TN', 'total_phosphorus': 'TP', 'tp': 'TP',
  'conductivity': 'conductivity', 'specific_conductance': 'conductivity',
};

const PARAM_UNITS: Record<string, string> = {
  DO: 'mg/L', pH: 'SU', temperature: 'deg C', turbidity: 'NTU',
  bacteria: 'CFU/100mL', TN: 'mg/L', TP: 'mg/L', conductivity: 'uS/cm',
};

function normalizeColumnName(col: string): string {
  return col.trim().toLowerCase().replace(/[^a-z0-9_\s]/g, '').replace(/\s+/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      csv_text, user_id, user_role, column_mapping, state_abbr,
      volunteer_id, teacher_uid, original_file,
    } = body;

    if (!csv_text || !user_id || !user_role) {
      return NextResponse.json({ error: 'Missing required fields: csv_text, user_id, user_role' }, { status: 400 });
    }

    if (user_role !== 'NGO' && user_role !== 'K12') {
      return NextResponse.json({ error: 'user_role must be NGO or K12' }, { status: 400 });
    }

    // Parse CSV
    const parsed = Papa.parse<Record<string, string>>(csv_text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json({ error: 'Failed to parse CSV', details: parsed.errors.slice(0, 5) }, { status: 400 });
    }

    // Build column mapping: detect which CSV columns map to PEARL params
    const headers = parsed.meta.fields || [];
    const mapping: Record<string, string> = column_mapping || {};
    if (!column_mapping) {
      for (const h of headers) {
        const normalized = normalizeColumnName(h);
        if (CSV_TO_PEARL[normalized]) {
          mapping[h] = CSV_TO_PEARL[normalized];
        }
      }
    }

    // Find lat/lng/date columns
    const latCol = headers.find(h => /^(lat|latitude)$/i.test(h.trim()));
    const lngCol = headers.find(h => /^(lng|lon|longitude)$/i.test(h.trim()));
    const dateCol = headers.find(h => /^(date|sample_date|sample date|datetime)$/i.test(h.trim()));
    const siteCol = headers.find(h => /^(site|station|location|location_name|site_name)$/i.test(h.trim()));
    const studentCol = headers.find(h => /^(student|student_name)$/i.test(h.trim()));
    const teamCol = headers.find(h => /^(team|team_name|group)$/i.test(h.trim()));

    const provenance = user_role === 'NGO' ? 'CITIZEN_SCIENCE' : 'EDUCATIONAL';
    const batch_id = crypto.randomUUID();
    const validRows: Array<Record<string, unknown>> = [];
    const errorRows: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      const lat = latCol ? parseFloat(row[latCol]) : null;
      const lng = lngCol ? parseFloat(row[lngCol]) : null;
      const sampleDate = dateCol ? row[dateCol] : new Date().toISOString();
      const locationName = siteCol ? row[siteCol] : null;

      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        errorRows.push({ row: i + 2, error: 'Missing or invalid latitude/longitude' });
        continue;
      }

      // Each mapped parameter column becomes a separate sample row
      for (const [csvCol, pearlKey] of Object.entries(mapping)) {
        const rawVal = row[csvCol];
        if (rawVal == null || rawVal === '') continue;
        const numVal = parseFloat(rawVal);
        if (isNaN(numVal)) {
          errorRows.push({ row: i + 2, error: `Invalid numeric value for ${csvCol}: "${rawVal}"` });
          continue;
        }

        validRows.push({
          parameter: pearlKey,
          value: numVal,
          unit: PARAM_UNITS[pearlKey] || 'unknown',
          sample_date: sampleDate || new Date().toISOString(),
          latitude: lat,
          longitude: lng,
          location_name: locationName,
          state_abbr: state_abbr || null,
          uploaded_by: user_id,
          user_role,
          provenance,
          volunteer_id: volunteer_id || null,
          student_name: studentCol ? row[studentCol] || null : null,
          team_name: teamCol ? row[teamCol] || null : null,
          teacher_uid: teacher_uid || null,
          status: 'PENDING',
          batch_id,
          original_file: original_file || null,
        });
      }
    }

    if (validRows.length === 0) {
      return NextResponse.json({
        error: 'No valid rows to insert',
        errorRows: errorRows.slice(0, 20),
        detectedMapping: mapping,
      }, { status: 400 });
    }

    // Insert in batches of 500
    let insertedCount = 0;
    for (let i = 0; i < validRows.length; i += 500) {
      const batch = validRows.slice(i, i + 500);
      const { error } = await supabase.from('water_samples').insert(batch);
      if (error) {
        console.error('[uploads/csv] Supabase batch insert error:', error);
        return NextResponse.json({
          error: 'Partial insert failure',
          insertedCount,
          totalValid: validRows.length,
        }, { status: 500 });
      }
      insertedCount += batch.length;
    }

    return NextResponse.json({
      success: true,
      batch_id,
      insertedCount,
      errorCount: errorRows.length,
      errorRows: errorRows.slice(0, 20),
      detectedMapping: mapping,
    });
  } catch (err) {
    console.error('[uploads/csv] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
