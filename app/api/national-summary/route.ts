export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getNationalSummary } from '@/lib/national-summary';
import { ensureWarmed } from '@/lib/attainsCache';
import { ensureWarmed as ensureNwisWarmed } from '@/lib/nwisIvCache';

export async function GET() {
  await Promise.all([ensureWarmed(), ensureNwisWarmed()]);
  const summary = getNationalSummary();
  return NextResponse.json(summary);
}
