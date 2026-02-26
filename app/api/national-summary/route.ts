export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getNationalSummary } from '@/lib/national-summary';
import { ensureWarmed } from '@/lib/attainsCache';

export async function GET() {
  await ensureWarmed();
  const summary = getNationalSummary();
  return NextResponse.json(summary);
}
