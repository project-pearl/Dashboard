export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getIcisAllData, ensureWarmed } from '@/lib/icisCache';

export async function GET() {
  await ensureWarmed();
  const data = getIcisAllData();
  return NextResponse.json(data);
}
