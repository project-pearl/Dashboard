export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPfasAllResults, ensureWarmed } from '@/lib/pfasCache';

export async function GET() {
  await ensureWarmed();
  const results = getPfasAllResults();
  return NextResponse.json({ results });
}
