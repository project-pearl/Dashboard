// app/api/advocacy/route.ts
// Serves cached advocacy data (bills, hearings, comment periods) plus
// derived violation alerts from the existing ECHO cache.

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ensureWarmed, getAdvocacyCache } from '@/lib/advocacyCache';
import { getEchoAllData } from '@/lib/echoCache';
import { ensureWarmed as warmEcho } from '@/lib/echoCache';

interface ViolationAlert {
  id: string;
  facility: string;
  state: string;
  violation: string;
  priority: 'critical' | 'high' | 'medium';
  daysSinceDetection: number;
  permit: string;
}

function deriveViolations(): ViolationAlert[] {
  const { violations } = getEchoAllData();
  return violations
    .filter(v => v.qtrsInNc > 0)
    .sort((a, b) => b.qtrsInNc - a.qtrsInNc)
    .slice(0, 25)
    .map(v => ({
      id: `echo-${v.registryId}`,
      facility: v.name,
      state: v.state,
      violation: `${v.violationType}${v.pollutant ? ' — ' + v.pollutant : ''}`,
      priority: (v.qtrsInNc >= 4 ? 'critical' : v.qtrsInNc >= 2 ? 'high' : 'medium') as 'critical' | 'high' | 'medium',
      daysSinceDetection: v.qtrsInNc * 90,
      permit: v.registryId,
    }));
}

export async function GET() {
  await Promise.allSettled([ensureWarmed(), warmEcho()]);

  const data = getAdvocacyCache();
  const violations = deriveViolations();

  return NextResponse.json({
    bills: data?.bills || [],
    hearings: data?.hearings || [],
    commentPeriods: data?.commentPeriods || [],
    violations,
    meta: data?.meta || null,
    fetchedAt: new Date().toISOString(),
  });
}
