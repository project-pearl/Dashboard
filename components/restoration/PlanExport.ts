/* ═══════════════════════════════════════════════════════════════════════════
   PDF Export — Restoration Plan
   Uses BrandedPDFGenerator for consistent PEARL branding
   ═══════════════════════════════════════════════════════════════════════════ */

import { BrandedPDFGenerator } from '@/lib/brandedPdfGenerator';
import {
  fmt, CK, CONTAMINANT_LABELS, OPEX_TEAM_YEAR,
  type CalcResult, type ContaminantKey, type NGO, type CommunityEvent,
  type SizeTier,
} from '@/components/treatment/treatmentData';
import type { WaterQualityGrade } from '@/lib/waterQualityScore';
import type { GrantOpportunity } from '@/lib/stateWaterData';
import type { StaffingResult } from './StaffingCalculator';
import { VOLUNTEER_HOURLY_RATE } from './StaffingCalculator';
import type { CachedWaterbody } from '@/lib/attainsCache';

type TargetOutcome = 'fishable' | 'swimmable' | 'healthy' | 'shellfish_safe';

const TARGET_LABELS: Record<TargetOutcome, string> = {
  fishable: 'Fishable', swimmable: 'Swimmable',
  healthy: 'Healthy Ecosystem', shellfish_safe: 'Shellfish Safe',
};

export async function exportRestorationPDF(data: {
  regionName: string;
  stateAbbr: string;
  waterbodyOverride: CachedWaterbody | null;
  sizeTier: SizeTier;
  sizeLabel: string;
  activePillars: Set<string>;
  calc: CalcResult;
  baseline: Record<ContaminantKey, number>;
  grade: WaterQualityGrade;
  target: TargetOutcome;
  timelineYrs: number;
  selectedNGOs: NGO[];
  selectedEvents: CommunityEvent[];
  staffing: StaffingResult;
  stateGrants: GrantOpportunity[];
  attainsCategory?: string;
  attainsCauses?: string[];
}): Promise<void> {
  const pdf = new BrandedPDFGenerator('portrait');
  await pdf.loadLogo();
  pdf.initialize();

  const {
    regionName, stateAbbr, sizeTier, sizeLabel, calc, baseline,
    grade, target, timelineYrs, selectedNGOs, selectedEvents,
    staffing, stateGrants, attainsCategory, attainsCauses,
  } = data;

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── 1. Header ──
  pdf.addTitle(`Restoration Plan \u2014 ${regionName}`);
  pdf.addMetadata('Date', date);
  pdf.addMetadata('State', stateAbbr);
  if (data.waterbodyOverride?.id) pdf.addMetadata('Waterbody ID', data.waterbodyOverride.id);
  pdf.addMetadata('Size Tier', `${sizeTier} (${sizeLabel})`);
  pdf.addMetadata('Target', TARGET_LABELS[target]);
  pdf.addMetadata('Timeline', `${timelineYrs} years`);
  pdf.addSpacer(5);
  pdf.addDivider();

  // ── 2. Waterbody Assessment ──
  pdf.addSubtitle('Waterbody Assessment');
  if (attainsCategory) pdf.addText(`ATTAINS Category: ${attainsCategory}`);
  if (attainsCauses?.length) pdf.addText(`Listed Causes: ${attainsCauses.join(', ')}`);
  pdf.addText(`Current Grade: ${grade.letter} (${grade.score ?? 'N/A'}/100)`);
  pdf.addSpacer(3);
  pdf.addText('Baseline Contaminant Levels:', { bold: true });
  for (const k of CK) {
    if (baseline[k] > 0) {
      pdf.addText(`  ${CONTAMINANT_LABELS[k]}: ${baseline[k]}% impairment`, { indent: 5, fontSize: 9 });
    }
  }
  pdf.addSpacer(5);
  pdf.addDivider();

  // ── 3. Treatment Modules ──
  pdf.addSubtitle('Treatment Modules');
  if (calc.active.length > 0) {
    pdf.addTable(
      ['Module', 'Units', 'Cost', 'GPM', 'Deploy', 'Key Reductions'],
      calc.active.map(m => [
        m.name.trim(),
        String(m.units),
        fmt(m.totalCost),
        m.gpm > 0 ? `${(m.gpm * m.units).toLocaleString()}` : '\u2014',
        `${m.mo}mo`,
        CK.filter(k => m[k] > 0).map(k => `${k.toUpperCase()} ${m[k]}%`).join(', ') || '\u2014',
      ]),
      [55, 15, 25, 20, 18, 45],
    );
  } else {
    pdf.addText('No treatment modules selected.');
  }
  pdf.addSpacer(3);
  pdf.addDivider();

  // ── 4. Partners & Community ──
  pdf.addSubtitle('Partners & Community');
  if (selectedNGOs.length > 0) {
    pdf.addText('Partners:', { bold: true });
    pdf.addTable(
      ['Partner', 'Type', 'In-Kind Value', 'Alignment'],
      selectedNGOs.map(n => [
        n.name,
        n.type,
        fmt(n.value),
        n.aligned ? 'ALIGNED' : 'Review',
      ]),
      [55, 40, 30, 25],
    );
  }
  if (selectedEvents.length > 0) {
    pdf.addText('Community Events:', { bold: true });
    pdf.addTable(
      ['Event', 'Frequency', 'Cost/yr', 'Volunteers'],
      selectedEvents.map(e => [
        e.name,
        e.freq,
        fmt(e.cost),
        String(e.volunteers),
      ]),
      [60, 30, 30, 30],
    );
  }
  pdf.addSpacer(3);
  pdf.addDivider();

  // ── 5. Staffing & Operations ──
  pdf.addSubtitle('Staffing & Operations');
  pdf.addTable(
    ['Metric', 'Value'],
    [
      ['Restoration Staff (FTE)', String(staffing.restorationStaff)],
      ['Annual Staff Cost', fmt(staffing.annualStaffCost)],
      ['Partner FTE Offset', staffing.partnerFteOffset.toFixed(1)],
      ['Volunteer Hours/Year', staffing.volunteerHoursYear.toLocaleString()],
      ['Volunteer Cost Offset', `${fmt(staffing.volunteerCostOffset)}/yr @ $${VOLUNTEER_HOURLY_RATE}/hr`],
      ['Volunteer FTE Offset', staffing.volunteerFteOffset.toFixed(1)],
      ['Net Staff Needed', staffing.netStaffNeeded.toFixed(1)],
      ['Net Annual Cost', fmt(staffing.netAnnualCost)],
    ],
    [80, 70],
  );
  pdf.addSpacer(3);
  pdf.addDivider();

  // ── 6. Grant Eligibility ──
  pdf.addSubtitle('Grant Eligibility');
  if (calc.grants.length > 0) {
    pdf.addText('Federal Grant Matches:', { bold: true });
    pdf.addTable(
      ['Grant', 'Match %', 'Potential Savings'],
      calc.grants.map(g => [g.name, `${Math.round(g.match * 100)}%`, fmt(g.savings)]),
      [70, 30, 50],
    );
  }
  if (stateGrants.length > 0) {
    pdf.addText(`${stateAbbr} State Grant Programs:`, { bold: true });
    const highFit = stateGrants.filter(g => g.fit === 'high' || g.fit === 'medium');
    if (highFit.length > 0) {
      pdf.addTable(
        ['Program', 'Amount', 'Fit', 'Source'],
        highFit.slice(0, 8).map(g => [g.name, g.amount, g.fit.toUpperCase(), g.source]),
        [55, 30, 20, 30],
      );
    }
  }
  pdf.addSpacer(3);
  pdf.addDivider();

  // ── 7. Financial Summary ──
  pdf.addSubtitle('Financial Summary');
  const eventCostTotal = selectedEvents.reduce((s, e) => s + e.cost, 0) * timelineYrs;
  const staffCostTotal = staffing.netAnnualCost * timelineYrs;
  const totalLifecycle = calc.lifecycle + eventCostTotal + staffCostTotal;
  const totalGrants = calc.grantTotal + selectedNGOs.reduce((s, n) => s + n.value, 0);
  const netCost = Math.max(0, totalLifecycle - totalGrants);

  pdf.addTable(
    ['Line Item', 'Amount'],
    [
      ['Capital Expenditure (CapEx)', fmt(calc.capex)],
      [`Operating Expenditure (${timelineYrs}yr)`, fmt(calc.totalOpex)],
      [`Staffing (${timelineYrs}yr)`, fmt(staffCostTotal)],
      [`Community Programs (${timelineYrs}yr)`, fmt(eventCostTotal)],
      ['Total Lifecycle', fmt(totalLifecycle)],
      ['Federal Grant Potential', `-${fmt(calc.grantTotal)}`],
      ['Partner In-Kind Value', `-${fmt(selectedNGOs.reduce((s, n) => s + n.value, 0))}`],
      ['Net Cost', fmt(netCost)],
    ],
    [100, 50],
  );

  pdf.addSpacer(8);
  pdf.addText(
    'All projections are modeled estimates based on EPA ATTAINS assessments, published intervention efficacy literature, and industry cost data. Actual outcomes depend on site-specific hydrology, land use, climate variability, and implementation fidelity.',
    { fontSize: 8 },
  );

  pdf.download(`PEARL-Restoration-Plan-${regionName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}
