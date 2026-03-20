// app/api/force-protection/route.ts
// Returns Force Protection Intelligence assessments from cache.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  ensureWarmed,
  getForceProtectionAll,
  getForceProtectionById,
} from '@/lib/forceProtectionCache';

export async function GET(request: NextRequest) {
  await ensureWarmed();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const assessment = getForceProtectionById(id);
    if (!assessment) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }
    return NextResponse.json(assessment);
  }

  const assessments = getForceProtectionAll();
  return NextResponse.json({
    assessments,
    count: assessments.length,
  });
}
