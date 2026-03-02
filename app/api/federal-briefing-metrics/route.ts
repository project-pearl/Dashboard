export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getNationalSummary } from '@/lib/national-summary';
import { ensureWarmed as ensureAttainsWarmed } from '@/lib/attainsCache';
import { ensureWarmed as ensureNwisWarmed } from '@/lib/nwisIvCache';
import { ensureWarmed as ensureIcisWarmed, getIcisAllData, getIcisCacheStatus } from '@/lib/icisCache';
import { ensureWarmed as ensureUsasWarmed, getUSAsAllStateData } from '@/lib/usaSpendingCache';

function isActivePermitStatus(status: string): boolean {
  const s = (status || '').toLowerCase();
  if (!s) return true;
  if (/(terminated|expire|revoked|withdrawn|closed|inactive)/.test(s)) return false;
  return /(effective|active|issued|current|admin)/.test(s) || true;
}

function isOpenInspection(dateStr: string, complianceStatus: string): boolean {
  const status = (complianceStatus || '').toLowerCase();
  if (/(open|pending|ongoing|active|in progress)/.test(status)) return true;

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const ageMs = Date.now() - d.getTime();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  return ageMs <= oneYearMs;
}

function computeSrfUtilizationPct(): number {
  const states = getUSAsAllStateData();
  if (!states.length) return 72;

  let totalObligated = 0;
  let currentFyObligated = 0;

  for (const st of states) {
    for (const p of st.programs || []) {
      if (p.cfda === '66.458' || p.cfda === '66.468') {
        totalObligated += p.totalObligated || 0;
        currentFyObligated += p.currentFyObligated || 0;
      }
    }
  }

  if (totalObligated <= 0) return 72;

  const annualizedBaseline = totalObligated / 5;
  if (annualizedBaseline <= 0) return 72;

  const ratio = (currentFyObligated / annualizedBaseline) * 100;
  return Math.max(1, Math.min(99, Math.round(ratio)));
}

export async function GET() {
  await Promise.all([
    ensureAttainsWarmed(),
    ensureNwisWarmed(),
    ensureIcisWarmed(),
    ensureUsasWarmed(),
  ]);

  const national = getNationalSummary();
  const icis = getIcisAllData();
  const icisStatus = getIcisCacheStatus() as any;

  const activePermitsFromRows = icis.permits.filter((p) => isActivePermitStatus(p.status)).length;
  const activePermits = activePermitsFromRows > 0
    ? activePermitsFromRows
    : (icisStatus.permitCount ?? icis.permits.length ?? 0);

  const openInspectionsFromRows = icis.inspections.filter((i) => isOpenInspection(i.date, i.complianceStatus)).length;
  const openInspections = openInspectionsFromRows > 0
    ? openInspectionsFromRows
    : (icisStatus.inspectionCount ?? icis.inspections.length ?? 0);

  const pendingTmdls = national.tmdlGap ?? 0;
  const srfUtilization = computeSrfUtilizationPct();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    activePermits,
    openInspections,
    pendingTmdls,
    srfUtilization,
    sourceMeta: {
      nationalGeneratedAt: national.generatedAt,
      icisBuilt: icisStatus.built ?? null,
      usaspendingStates: getUSAsAllStateData().length,
    },
  });
}
