// app/api/fema-declarations/route.ts
// Serves FEMA disaster declaration data from femaCache.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ensureWarmed, getFemaDeclarations, getFemaDeclarationsAll } from '@/lib/femaCache';

export async function GET(request: NextRequest) {
  await ensureWarmed();

  const state = request.nextUrl.searchParams.get('state')?.toUpperCase();

  const declarations = state ? (getFemaDeclarations(state) ?? []) : getFemaDeclarationsAll();

  // Aggregate by type
  const byType: Record<string, number> = {};
  const byState: Record<string, number> = {};
  for (const d of declarations) {
    byType[d.incidentType] = (byType[d.incidentType] || 0) + 1;
    byState[d.state] = (byState[d.state] || 0) + 1;
  }

  const topDeclarations = [...declarations]
    .sort((a, b) => new Date(b.declarationDate).getTime() - new Date(a.declarationDate).getTime())
    .slice(0, 20)
    .map(d => ({
      disasterNumber: d.disasterNumber,
      incidentType: d.incidentType,
      declarationTitle: d.declarationTitle,
      state: d.state,
      designatedArea: d.designatedArea,
      declarationDate: d.declarationDate,
      declarationType: d.declarationType,
    }));

  return NextResponse.json({
    totalDeclarations: declarations.length,
    byType,
    byState,
    topDeclarations,
  });
}
