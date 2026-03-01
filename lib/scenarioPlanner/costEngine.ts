// ─── Scenario Planner Cost Computation Engine ────────────────────────────────
// Computes order-of-magnitude cost ranges for water infrastructure scenarios
// using RSMeans-inspired unit costs and state-specific multipliers.

import type {
  ScenarioDefinition,
  ScenarioResult,
  ScenarioPlannerRole,
  CostTier,
  CostTierOutput,
  CostLineItem,
  TimelinePhase,
} from './types';
import { getStateFactors } from './stateFactors';
import type { RiskForecastResult } from '../siteIntelTypes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function tierOutput(tier: CostTier, label: string, items: CostLineItem[]): CostTierOutput {
  return {
    tier,
    label,
    items,
    totalLow: items.reduce((s, i) => s + i.lowEstimate, 0),
    totalHigh: items.reduce((s, i) => s + i.highEstimate, 0),
  };
}

function param(params: Record<string, string | number>, key: string): string {
  return String(params[key] ?? '');
}

function paramNum(params: Record<string, string | number>, key: string): number {
  return Number(params[key]) || 0;
}

// ─── Disclaimer ──────────────────────────────────────────────────────────────

const DISCLAIMER = 'Cost estimates are order-of-magnitude projections based on national averages adjusted for state factors. Actual costs vary significantly based on local conditions, procurement methods, existing infrastructure, and market conditions. These figures are intended for planning and comparison purposes only — not for budgeting or procurement. Consult qualified engineers and financial advisors for project-specific estimates.';

// ─── Role-Specific Summaries ─────────────────────────────────────────────────

function roleSummary(
  role: ScenarioPlannerRole,
  scenarioLabel: string,
  totalLow: number,
  totalHigh: number,
  state: string,
): string {
  const range = `${fmt$(totalLow)} – ${fmt$(totalHigh)}`;
  switch (role) {
    case 'ms4-manager':
      return `As an MS4 manager, a ${scenarioLabel} event in ${state} could trigger compliance obligations costing ${range}. Focus on regulatory reporting deadlines and BMP deployment to mitigate permit exposure.`;
    case 'utility-director':
      return `For utility operations in ${state}, a ${scenarioLabel} scenario projects system-wide costs of ${range}. Prioritize capital reserve adequacy and rate impact analysis for long-term financial planning.`;
    case 'city-manager':
      return `A ${scenarioLabel} in ${state} represents a ${range} budget exposure. Consider emergency reserve adequacy, potential FEMA reimbursement pathways, and constituent communication planning.`;
    case 'state-regulator':
      return `Statewide, a ${scenarioLabel} pattern in ${state} could aggregate to ${range} per affected system. Consider enforcement discretion, compliance schedule flexibility, and SRF loan capacity.`;
    case 'insurer':
      return `Loss modeling for a ${scenarioLabel} in ${state} suggests exposure of ${range} per occurrence. Evaluate portfolio concentration risk and reinsurance trigger thresholds.`;
    case 'consultant':
      return `A ${scenarioLabel} in ${state} (est. ${range}) presents opportunities for emergency response, design services, and regulatory navigation. Key deliverables: damage assessment, remediation design, and permit support.`;
  }
}

// ─── Individual Event Cost Functions ─────────────────────────────────────────

function costWaterMainBreak(params: Record<string, string | number>, laborMult: number, contractorMult: number): { tiers: CostTierOutput[]; timeline: TimelinePhase[] } {
  const diameter = paramNum(params, 'pipe-diameter');
  const hours = paramNum(params, 'duration-hours');
  const location = param(params, 'location-type');

  // Base repair costs scale with pipe diameter squared (cross-sectional area proxy)
  const diameterFactor = (diameter / 8) ** 1.5;
  const locationMultiplier = location === 'arterial' ? 2.0 : location === 'commercial' ? 1.5 : location === 'critical' ? 2.5 : 1.0;

  const repairCostBase = 25000 * diameterFactor * locationMultiplier;
  const pavingCost = diameter >= 24 ? 50000 * locationMultiplier : 15000 * locationMultiplier;
  const emergencyLabor = (hours / 8) * 5000 * diameterFactor;
  const waterLoss = hours * diameter * 50; // rough gallons lost × cost
  const bottledWater = hours > 12 ? (hours / 24) * 8000 : 0;

  const direct = tierOutput('direct', 'Direct Repair Costs', [
    { label: 'Pipe repair/replacement', lowEstimate: repairCostBase * 0.7 * laborMult, highEstimate: repairCostBase * 1.4 * laborMult * contractorMult, unit: '$' },
    { label: 'Pavement restoration', lowEstimate: pavingCost * 0.8 * laborMult, highEstimate: pavingCost * 1.3 * laborMult, unit: '$' },
    { label: 'Emergency labor (overtime)', lowEstimate: emergencyLabor * 0.8 * laborMult, highEstimate: emergencyLabor * 1.5 * laborMult, unit: '$' },
    { label: 'Water loss', lowEstimate: waterLoss * 0.5, highEstimate: waterLoss, unit: '$' },
    ...(bottledWater > 0 ? [{ label: 'Bottled water / emergency supply', lowEstimate: bottledWater * 0.7, highEstimate: bottledWater * 1.3, unit: '$' }] : []),
  ]);

  const regulatory = tierOutput('regulatory', 'Regulatory & Compliance', [
    { label: 'Boil-water advisory management', lowEstimate: 5000, highEstimate: 25000, unit: '$', notes: 'Public notification, testing, clearance' },
    { label: 'Water quality testing (bacteriological)', lowEstimate: 2000, highEstimate: 8000, unit: '$' },
    ...(hours > 48 ? [{ label: 'State reporting / incident documentation', lowEstimate: 3000, highEstimate: 10000, unit: '$' }] : []),
  ]);

  const businessLoss = location === 'commercial' ? hours * 2000 : location === 'critical' ? hours * 5000 : hours * 500;
  const economic = tierOutput('economic', 'Economic & Community Impact', [
    { label: 'Business/facility disruption', lowEstimate: businessLoss * 0.5, highEstimate: businessLoss * 1.5, unit: '$' },
    { label: 'Traffic rerouting / police details', lowEstimate: hours > 12 ? 3000 : 500, highEstimate: hours > 12 ? 15000 : 3000, unit: '$' },
    ...(location === 'critical' ? [{ label: 'Critical facility backup systems', lowEstimate: 10000, highEstimate: 50000, unit: '$' }] : []),
  ]);

  const timeline = tierOutput('timeline', 'Timeline & Recovery', [
    { label: 'Emergency response mobilization', lowEstimate: 0, highEstimate: 0, unit: 'hours', notes: `${Math.max(2, diameter / 8)} – ${Math.max(4, diameter / 4)} hours` },
    { label: 'Repair execution', lowEstimate: 0, highEstimate: 0, unit: 'hours', notes: `${Math.round(hours * 0.3)} – ${Math.round(hours * 0.7)} hours` },
    { label: 'System restoration & testing', lowEstimate: 0, highEstimate: 0, unit: 'hours', notes: `${Math.round(hours * 0.2)} – ${Math.round(hours * 0.4)} hours` },
  ]);

  const phases: TimelinePhase[] = [
    { phase: 'Emergency Response', duration: `${Math.max(1, Math.round(hours * 0.1))}h`, description: 'Valve isolation, crew mobilization, traffic control' },
    { phase: 'Repair', duration: `${Math.round(hours * 0.4)}h`, description: 'Excavation, pipe repair/replacement, backfill' },
    { phase: 'Restoration', duration: `${Math.round(hours * 0.3)}h`, description: 'Flushing, bacteriological testing, pressure restoration' },
    { phase: 'Surface Repair', duration: '1-5 days', description: 'Permanent pavement patching, landscaping' },
  ];

  return { tiers: [direct, regulatory, economic, timeline], timeline: phases };
}

function costSSO(params: Record<string, string | number>, laborMult: number, penaltyMult: number): { tiers: CostTierOutput[]; timeline: TimelinePhase[] } {
  const volume = paramNum(params, 'volume-gallons');
  const receivingWater = param(params, 'receiving-water');
  const cause = param(params, 'cause');

  const volumeFactor = Math.log10(Math.max(volume, 1000)) - 2; // 1 for 10K, 2 for 100K, etc.
  const waterSensitivity = receivingWater === 'bay-estuary' ? 3.0 : receivingWater === 'river' ? 2.0 : receivingWater === 'stream' ? 1.5 : 1.0;

  const cleanupBase = 15000 * volumeFactor * waterSensitivity;
  const pumpRepair = cause === 'pump-failure' ? 25000 : cause === 'pipe-collapse' ? 80000 : 5000;

  const direct = tierOutput('direct', 'Direct Response Costs', [
    { label: 'Cleanup & containment', lowEstimate: cleanupBase * 0.7 * laborMult, highEstimate: cleanupBase * 1.5 * laborMult, unit: '$' },
    { label: 'Root cause repair', lowEstimate: pumpRepair * 0.8 * laborMult, highEstimate: pumpRepair * 1.5 * laborMult, unit: '$' },
    { label: 'Environmental sampling', lowEstimate: 3000 * waterSensitivity, highEstimate: 15000 * waterSensitivity, unit: '$' },
    { label: 'Bypass pumping', lowEstimate: volume > 100000 ? 10000 : 2000, highEstimate: volume > 100000 ? 50000 : 10000, unit: '$' },
  ]);

  const basePenalty = volume > 1000000 ? 100000 : volume > 100000 ? 25000 : 5000;
  const regulatory = tierOutput('regulatory', 'Regulatory & Penalties', [
    { label: 'CWA penalty (per-day + per-violation)', lowEstimate: basePenalty * 0.5 * penaltyMult, highEstimate: basePenalty * 2.0 * penaltyMult, unit: '$', notes: 'Federal max $64,618/day/violation' },
    { label: 'State supplemental penalty', lowEstimate: basePenalty * 0.2 * penaltyMult, highEstimate: basePenalty * 1.0 * penaltyMult, unit: '$' },
    { label: 'Consent decree / corrective action', lowEstimate: volume > 100000 ? 50000 : 10000, highEstimate: volume > 100000 ? 500000 : 50000, unit: '$' },
    { label: 'Reporting & compliance documentation', lowEstimate: 5000, highEstimate: 20000, unit: '$' },
  ]);

  const economic = tierOutput('economic', 'Economic & Reputational', [
    { label: 'Beach/waterway closure impact', lowEstimate: waterSensitivity > 1.5 ? 20000 : 0, highEstimate: waterSensitivity > 1.5 ? 200000 : 5000, unit: '$' },
    { label: 'Public notification costs', lowEstimate: 2000, highEstimate: 10000, unit: '$' },
    { label: 'Legal exposure (citizen suits)', lowEstimate: 10000, highEstimate: volume > 1000000 ? 500000 : 100000, unit: '$' },
  ]);

  const timeline = tierOutput('timeline', 'Timeline & Recovery', []);

  const phases: TimelinePhase[] = [
    { phase: 'Containment', duration: '2-8h', description: 'Deploy booms, sandbags, vacuum trucks' },
    { phase: 'Cleanup', duration: '1-5 days', description: 'Remove solids, disinfect, environmental sampling' },
    { phase: 'Root Cause Fix', duration: '1-4 weeks', description: 'Repair infrastructure causing overflow' },
    { phase: 'Regulatory Resolution', duration: '3-18 months', description: 'Negotiate penalties, implement corrective action plan' },
  ];

  return { tiers: [direct, regulatory, economic, timeline], timeline: phases };
}

function costHurricane(params: Record<string, string | number>, laborMult: number, contractorMult: number): { tiers: CostTierOutput[]; timeline: TimelinePhase[] } {
  const category = paramNum(params, 'storm-category');
  const surge = paramNum(params, 'surge-height');
  const distance = param(params, 'coastal-distance');

  const catFactor = category ** 1.8; // exponential scaling
  const surgeFactor = surge / 3;
  const distMult = distance === 'coastal' ? 1.5 : distance === 'near-coastal' ? 1.0 : 0.5;

  const systemDamage = 500000 * catFactor * distMult;
  const pumpStationDamage = surge > 6 ? 200000 * surgeFactor * distMult : 50000 * distMult;

  const direct = tierOutput('direct', 'Direct Infrastructure Damage', [
    { label: 'Water/wastewater system damage', lowEstimate: systemDamage * 0.5 * laborMult, highEstimate: systemDamage * 2.0 * laborMult * contractorMult, unit: '$' },
    { label: 'Pump station flood damage', lowEstimate: pumpStationDamage * 0.6, highEstimate: pumpStationDamage * 1.8, unit: '$' },
    { label: 'Emergency generators & fuel', lowEstimate: 20000 * catFactor, highEstimate: 100000 * catFactor, unit: '$' },
    { label: 'Debris removal from waterways', lowEstimate: 50000 * distMult, highEstimate: 300000 * distMult * catFactor, unit: '$' },
  ]);

  const regulatory = tierOutput('regulatory', 'Regulatory & Compliance', [
    { label: 'SSO reporting (storm-caused)', lowEstimate: 5000, highEstimate: 25000, unit: '$' },
    { label: 'Boil-water advisories', lowEstimate: 10000, highEstimate: 50000 * catFactor, unit: '$' },
    { label: 'Emergency permit modifications', lowEstimate: 5000, highEstimate: 30000, unit: '$' },
  ]);

  const economic = tierOutput('economic', 'Economic & Community', [
    { label: 'Service disruption (lost revenue)', lowEstimate: 100000 * catFactor * 0.5, highEstimate: 100000 * catFactor * 3.0, unit: '$' },
    { label: 'Emergency housing/relocation support', lowEstimate: surge > 6 ? 50000 : 0, highEstimate: surge > 6 ? 500000 * catFactor : 10000, unit: '$' },
    { label: 'FEMA match / cost share', lowEstimate: systemDamage * 0.125, highEstimate: systemDamage * 0.25, unit: '$', notes: 'Local match typically 12.5-25% of FEMA-eligible costs' },
  ]);

  const timeline = tierOutput('timeline', 'Timeline & Recovery', []);

  const phases: TimelinePhase[] = [
    { phase: 'Emergency Response', duration: '0-72h', description: 'Life safety, system isolation, generator deployment' },
    { phase: 'Assessment', duration: '1-2 weeks', description: 'Damage assessment, FEMA coordination, insurance claims' },
    { phase: 'Temporary Repairs', duration: '2-8 weeks', description: 'Restore critical services, temporary pumping' },
    { phase: 'Permanent Restoration', duration: '6-24 months', description: 'Full system rebuild, resilience upgrades' },
  ];

  return { tiers: [direct, regulatory, economic, timeline], timeline: phases };
}

function costDrought(params: Record<string, string | number>, laborMult: number): { tiers: CostTierOutput[]; timeline: TimelinePhase[] } {
  const severity = param(params, 'severity');
  const months = paramNum(params, 'duration-months');
  const source = param(params, 'source-type');

  const sevFactor = severity === 'exceptional' ? 4 : severity === 'extreme' ? 3 : severity === 'severe' ? 2 : 1;
  const durationFactor = months / 3;
  const sourceMult = source === 'reservoir' ? 1.5 : source === 'river' ? 1.3 : source === 'groundwater' ? 0.8 : 1.0;

  const direct = tierOutput('direct', 'Direct Operational Costs', [
    { label: 'Alternative water supply procurement', lowEstimate: 50000 * sevFactor * durationFactor * sourceMult, highEstimate: 300000 * sevFactor * durationFactor * sourceMult, unit: '$' },
    { label: 'Well deepening / new wells', lowEstimate: source === 'groundwater' ? 100000 * sevFactor : 0, highEstimate: source === 'groundwater' ? 500000 * sevFactor : 50000, unit: '$' },
    { label: 'Water hauling / interconnections', lowEstimate: 10000 * durationFactor, highEstimate: 80000 * durationFactor * sevFactor, unit: '$' },
    { label: 'Treatment adaptations (low flow)', lowEstimate: 20000 * sevFactor * laborMult, highEstimate: 100000 * sevFactor * laborMult, unit: '$' },
  ]);

  const regulatory = tierOutput('regulatory', 'Regulatory & Compliance', [
    { label: 'Water use restriction enforcement', lowEstimate: 5000 * durationFactor, highEstimate: 30000 * durationFactor, unit: '$' },
    { label: 'Emergency water rights proceedings', lowEstimate: sevFactor >= 3 ? 20000 : 0, highEstimate: sevFactor >= 3 ? 100000 : 10000, unit: '$' },
    { label: 'Conservation program administration', lowEstimate: 10000 * durationFactor, highEstimate: 50000 * durationFactor, unit: '$' },
  ]);

  const revenueLoss = 50000 * sevFactor * durationFactor; // reduced consumption = reduced revenue
  const economic = tierOutput('economic', 'Economic & Community', [
    { label: 'Revenue loss from conservation', lowEstimate: revenueLoss * 0.5, highEstimate: revenueLoss * 1.5, unit: '$' },
    { label: 'Agricultural/landscape damage', lowEstimate: 20000 * sevFactor, highEstimate: 200000 * sevFactor * durationFactor, unit: '$' },
    { label: 'Rate increase analysis / implementation', lowEstimate: 5000, highEstimate: 30000, unit: '$' },
  ]);

  const timeline = tierOutput('timeline', 'Timeline & Recovery', []);

  const phases: TimelinePhase[] = [
    { phase: 'Conservation Stage', duration: `Month 1-${Math.min(months, 3)}`, description: 'Mandatory water restrictions, public outreach' },
    { phase: 'Emergency Supply', duration: sevFactor >= 3 ? `Month ${Math.min(3, months)}-${months}` : 'If needed', description: 'Alternative supply activation, hauling, interconnections' },
    { phase: 'Recovery', duration: '3-12 months post-drought', description: 'Reservoir recharge, aquifer recovery, rate normalization' },
  ];

  return { tiers: [direct, regulatory, economic, timeline], timeline: phases };
}

function costPFAS(params: Record<string, string | number>, laborMult: number, penaltyMult: number): { tiers: CostTierOutput[]; timeline: TimelinePhase[] } {
  const concentration = paramNum(params, 'concentration');
  const media = param(params, 'media');
  const population = paramNum(params, 'population-served');

  const concFactor = concentration <= 4 ? 1 : concentration <= 10 ? 1.5 : concentration <= 50 ? 2.5 : 4.0;
  const popFactor = population / 25000;
  const mediaMult = media === 'drinking-water' ? 2.0 : media === 'groundwater' ? 1.5 : 1.0;

  const treatmentCapital = 2000000 * popFactor * concFactor * mediaMult;

  const direct = tierOutput('direct', 'Direct Treatment Costs', [
    { label: 'GAC/IX treatment system (capital)', lowEstimate: treatmentCapital * 0.6 * laborMult, highEstimate: treatmentCapital * 1.5 * laborMult, unit: '$', notes: 'Granular activated carbon or ion exchange' },
    { label: 'Annual O&M (media replacement)', lowEstimate: treatmentCapital * 0.08, highEstimate: treatmentCapital * 0.15, unit: '$/yr' },
    { label: 'Source investigation & monitoring', lowEstimate: 50000 * concFactor, highEstimate: 250000 * concFactor, unit: '$' },
    { label: 'Interim bottled water / blending', lowEstimate: media === 'drinking-water' ? 20000 * popFactor : 0, highEstimate: media === 'drinking-water' ? 100000 * popFactor : 10000, unit: '$' },
  ]);

  const regulatory = tierOutput('regulatory', 'Regulatory & Legal', [
    { label: 'MCL compliance documentation', lowEstimate: 10000, highEstimate: 50000, unit: '$' },
    { label: 'Public notification (SDWA)', lowEstimate: 5000, highEstimate: 25000 * popFactor, unit: '$' },
    { label: 'Potential PRPs / cost recovery litigation', lowEstimate: 50000, highEstimate: 500000 * concFactor, unit: '$', notes: 'Pursuing responsible parties' },
    { label: 'State reporting & health advisory', lowEstimate: 5000 * penaltyMult, highEstimate: 30000 * penaltyMult, unit: '$' },
  ]);

  const economic = tierOutput('economic', 'Economic & Community', [
    { label: 'Property value impacts', lowEstimate: 100000 * popFactor * 0.3, highEstimate: 100000 * popFactor * 2.0, unit: '$' },
    { label: 'Rate increase to fund treatment', lowEstimate: treatmentCapital * 0.05, highEstimate: treatmentCapital * 0.12, unit: '$/yr', notes: 'Debt service on treatment capital' },
    { label: 'Health screening / blood testing', lowEstimate: concentration > 10 ? 50000 * popFactor * 0.1 : 0, highEstimate: concentration > 10 ? 200000 * popFactor * 0.1 : 10000, unit: '$' },
  ]);

  const timeline = tierOutput('timeline', 'Timeline & Recovery', []);

  const phases: TimelinePhase[] = [
    { phase: 'Detection & Notification', duration: '1-4 weeks', description: 'Confirm results, notify public, issue health advisory' },
    { phase: 'Interim Measures', duration: '1-6 months', description: 'Bottled water, blending, point-of-use filters' },
    { phase: 'Treatment Design', duration: '6-18 months', description: 'Engineering design, permitting, procurement' },
    { phase: 'Construction & Startup', duration: '12-36 months', description: 'Treatment system installation and commissioning' },
  ];

  return { tiers: [direct, regulatory, economic, timeline], timeline: phases };
}

function costChemicalSpill(params: Record<string, string | number>, laborMult: number, penaltyMult: number): { tiers: CostTierOutput[]; timeline: TimelinePhase[] } {
  const chemical = param(params, 'chemical-type');
  const volume = paramNum(params, 'volume-gallons');
  const proximity = param(params, 'proximity');

  const volFactor = Math.log10(Math.max(volume, 100)); // 2 for 100, 3 for 1000, etc.
  const chemMult = chemical === 'unknown' ? 2.0 : chemical === 'industrial' ? 1.8 : chemical === 'agricultural' ? 1.3 : 1.0;
  const proxMult = proximity === 'upstream-close' ? 3.0 : proximity === 'upstream-far' ? 1.5 : proximity === 'groundwater' ? 2.0 : 0.5;

  const direct = tierOutput('direct', 'Direct Response Costs', [
    { label: 'Spill containment & recovery', lowEstimate: 20000 * volFactor * chemMult * laborMult, highEstimate: 100000 * volFactor * chemMult * laborMult, unit: '$' },
    { label: 'Intake shutdown / alternative supply', lowEstimate: proxMult > 1 ? 30000 * proxMult : 0, highEstimate: proxMult > 1 ? 200000 * proxMult : 5000, unit: '$' },
    { label: 'Enhanced treatment / activated carbon', lowEstimate: 10000 * chemMult * proxMult, highEstimate: 80000 * chemMult * proxMult, unit: '$' },
    { label: 'Environmental remediation', lowEstimate: 50000 * volFactor * chemMult * 0.5, highEstimate: 50000 * volFactor * chemMult * 3.0, unit: '$' },
  ]);

  const regulatory = tierOutput('regulatory', 'Regulatory & Legal', [
    { label: 'NRC / state spill reporting', lowEstimate: 2000, highEstimate: 10000, unit: '$' },
    { label: 'CERCLA / RCRA liability', lowEstimate: 25000 * volFactor * penaltyMult, highEstimate: 250000 * volFactor * penaltyMult, unit: '$' },
    { label: 'Natural resource damage assessment', lowEstimate: proxMult > 1 ? 20000 : 5000, highEstimate: proxMult > 1 ? 150000 * chemMult : 20000, unit: '$' },
  ]);

  const economic = tierOutput('economic', 'Economic & Community', [
    { label: 'Water supply interruption', lowEstimate: 10000 * proxMult, highEstimate: 100000 * proxMult * volFactor, unit: '$' },
    { label: 'Responsible party cost recovery', lowEstimate: 0, highEstimate: 0, unit: '$', notes: 'Potential to recover 50-100% from responsible party' },
    { label: 'Public health response', lowEstimate: chemical === 'unknown' ? 20000 : 5000, highEstimate: chemical === 'unknown' ? 100000 : 25000, unit: '$' },
  ]);

  const timeline = tierOutput('timeline', 'Timeline & Recovery', []);

  const phases: TimelinePhase[] = [
    { phase: 'Emergency Response', duration: '1-24h', description: 'Spill notification, containment, intake shutdown if needed' },
    { phase: 'Assessment & Cleanup', duration: '1-8 weeks', description: 'Characterize contamination, remove/treat affected media' },
    { phase: 'Monitoring', duration: '3-12 months', description: 'Downstream/groundwater monitoring to confirm cleanup' },
    { phase: 'Legal Resolution', duration: '6-36 months', description: 'Cost recovery, enforcement, natural resource damages' },
  ];

  return { tiers: [direct, regulatory, economic, timeline], timeline: phases };
}

function costNewTMDL(params: Record<string, string | number>, laborMult: number): { tiers: CostTierOutput[]; timeline: TimelinePhase[] } {
  const parameter = param(params, 'parameter');
  const reductionPct = paramNum(params, 'reduction-percent');
  const years = paramNum(params, 'compliance-timeline');

  const reductionFactor = reductionPct / 20; // 1 for 20%, 2 for 40%, 3 for 60%, 4 for 80%
  const paramMult = parameter === 'nitrogen' ? 1.5 : parameter === 'phosphorus' ? 1.3 : parameter === 'sediment' ? 1.0 : 0.8;
  const urgencyMult = years <= 3 ? 1.5 : years <= 5 ? 1.2 : years <= 10 ? 1.0 : 0.8;

  const bmpCapital = 500000 * reductionFactor * paramMult;

  const direct = tierOutput('direct', 'Direct Implementation Costs', [
    { label: 'BMP design & construction', lowEstimate: bmpCapital * 0.6 * laborMult * urgencyMult, highEstimate: bmpCapital * 1.8 * laborMult * urgencyMult, unit: '$' },
    { label: 'Treatment upgrades (if point source)', lowEstimate: reductionPct > 40 ? 200000 * reductionFactor * laborMult : 50000, highEstimate: reductionPct > 40 ? 2000000 * reductionFactor * laborMult : 200000, unit: '$' },
    { label: 'Monitoring network establishment', lowEstimate: 30000 * paramMult, highEstimate: 100000 * paramMult, unit: '$' },
    { label: 'Annual monitoring & reporting', lowEstimate: 15000 * paramMult, highEstimate: 50000 * paramMult, unit: '$/yr' },
  ]);

  const regulatory = tierOutput('regulatory', 'Regulatory & Planning', [
    { label: 'TMDL implementation plan development', lowEstimate: 50000, highEstimate: 200000, unit: '$' },
    { label: 'Permit modification / WLA incorporation', lowEstimate: 10000, highEstimate: 50000, unit: '$' },
    { label: 'Stakeholder engagement process', lowEstimate: 20000 * urgencyMult, highEstimate: 80000 * urgencyMult, unit: '$' },
  ]);

  const economic = tierOutput('economic', 'Economic & Community', [
    { label: 'Rate impact (debt service)', lowEstimate: bmpCapital * 0.06, highEstimate: bmpCapital * 0.12, unit: '$/yr' },
    { label: 'Agricultural / development constraints', lowEstimate: 10000 * reductionFactor, highEstimate: 200000 * reductionFactor, unit: '$' },
    { label: 'Grant / SRF funding pursuit', lowEstimate: 5000, highEstimate: 30000, unit: '$', notes: 'Application costs; potential 40-80% funding offset' },
  ]);

  const timeline = tierOutput('timeline', 'Timeline & Recovery', []);

  const phases: TimelinePhase[] = [
    { phase: 'Planning', duration: `Year 1${years > 5 ? '-2' : ''}`, description: 'Implementation plan, stakeholder engagement, funding' },
    { phase: 'Design & Permitting', duration: `Year ${years > 5 ? '2-3' : '1-2'}`, description: 'Engineering design, environmental review, permits' },
    { phase: 'Construction', duration: `Year ${years > 5 ? '3' : '2'}-${years}`, description: 'BMP construction, treatment upgrades, adaptive management' },
    { phase: 'Compliance Demonstration', duration: 'Ongoing', description: 'Monitoring, reporting, TMDL milestone tracking' },
  ];

  return { tiers: [direct, regulatory, economic, timeline], timeline: phases };
}

function costPermitTightening(params: Record<string, string | number>, laborMult: number): { tiers: CostTierOutput[]; timeline: TimelinePhase[] } {
  const parameter = param(params, 'parameter');
  const currentLimit = param(params, 'current-limit');
  const newLimit = param(params, 'new-limit');

  const limitDrop = (() => {
    const levels = ['high', 'moderate', 'low', 'very-low', 'lod'];
    const curr = levels.indexOf(currentLimit);
    const next = levels.indexOf(newLimit);
    return Math.max(1, next - curr);
  })();

  const paramMult = parameter === 'nitrogen' ? 1.5 : parameter === 'ammonia' ? 1.3 : parameter === 'metals' ? 1.8 : 1.2;
  const isAdvancedTreatment = newLimit === 'very-low' || newLimit === 'lod';

  const capitalCost = isAdvancedTreatment
    ? 5000000 * limitDrop * paramMult
    : 1000000 * limitDrop * paramMult;

  const direct = tierOutput('direct', 'Direct Treatment Upgrade Costs', [
    { label: 'Treatment process upgrade (capital)', lowEstimate: capitalCost * 0.6 * laborMult, highEstimate: capitalCost * 1.5 * laborMult, unit: '$' },
    { label: 'Additional O&M (chemical, energy)', lowEstimate: capitalCost * 0.05, highEstimate: capitalCost * 0.12, unit: '$/yr' },
    { label: 'Pilot testing / technology evaluation', lowEstimate: isAdvancedTreatment ? 50000 : 10000, highEstimate: isAdvancedTreatment ? 200000 : 50000, unit: '$' },
    { label: 'Operator training & certification', lowEstimate: 5000, highEstimate: 25000, unit: '$' },
  ]);

  const regulatory = tierOutput('regulatory', 'Regulatory & Compliance', [
    { label: 'Compliance schedule negotiation', lowEstimate: 10000, highEstimate: 50000, unit: '$' },
    { label: 'Engineering report / permit application', lowEstimate: 20000, highEstimate: 80000, unit: '$' },
    { label: 'Variance / mixing zone application', lowEstimate: isAdvancedTreatment ? 15000 : 0, highEstimate: isAdvancedTreatment ? 75000 : 10000, unit: '$' },
  ]);

  const economic = tierOutput('economic', 'Economic & Rate Impact', [
    { label: 'Rate increase (debt service + O&M)', lowEstimate: capitalCost * 0.08, highEstimate: capitalCost * 0.15, unit: '$/yr' },
    { label: 'SRF / WIFIA financing costs', lowEstimate: 5000, highEstimate: 30000, unit: '$', notes: 'Loan application; sub-market rates available' },
    { label: 'Affordability analysis', lowEstimate: 5000, highEstimate: 20000, unit: '$' },
  ]);

  const timeline = tierOutput('timeline', 'Timeline & Recovery', []);

  const phases: TimelinePhase[] = [
    { phase: 'Compliance Schedule', duration: '0-6 months', description: 'Negotiate schedule with permitting authority' },
    { phase: 'Engineering & Design', duration: '6-18 months', description: 'Evaluate alternatives, design upgrade, obtain financing' },
    { phase: 'Construction', duration: '12-36 months', description: 'Build treatment upgrades, startup, optimization' },
    { phase: 'Compliance Verification', duration: 'Ongoing', description: 'Demonstrate consistent compliance with new limits' },
  ];

  return { tiers: [direct, regulatory, economic, timeline], timeline: phases };
}

// ─── Router ──────────────────────────────────────────────────────────────────

function computeCosts(scenario: ScenarioDefinition, params: Record<string, string | number>, state: string): { tiers: CostTierOutput[]; timeline: TimelinePhase[] } {
  const sf = getStateFactors(state);
  const labor = sf.laborRateIndex;
  const penalty = sf.penaltySeverityIndex;
  const contractor = sf.contractorAvailIndex;

  switch (scenario.id) {
    case 'water-main-break': return costWaterMainBreak(params, labor, contractor);
    case 'sso-overflow': return costSSO(params, labor, penalty);
    case 'hurricane-storm-surge': return costHurricane(params, labor, contractor);
    case 'drought': return costDrought(params, labor);
    case 'pfas-detection': return costPFAS(params, labor, penalty);
    case 'chemical-spill': return costChemicalSpill(params, labor, penalty);
    case 'new-tmdl': return costNewTMDL(params, labor);
    case 'permit-limit-tightening': return costPermitTightening(params, labor);
    default: return { tiers: [], timeline: [] };
  }
}

// ─── Expected Loss Linkage ───────────────────────────────────────────────────

const CATEGORY_TO_FORECAST: Record<string, string> = {
  'infrastructure': 'infrastructure-failure',
  'natural-event': 'cascading-impact',
  'contamination': 'public-health-exposure',
  'regulatory': 'enforcement-probability',
};

function linkExpectedLoss(
  scenario: ScenarioDefinition,
  totalCostMid: number,
  riskForecast?: RiskForecastResult | null,
): ScenarioResult['expectedLoss'] {
  if (!riskForecast) return null;
  const forecastCategory = CATEGORY_TO_FORECAST[scenario.category];
  const prediction = riskForecast.predictions.find(p => p.category === forecastCategory);
  if (!prediction) return null;
  const probability = prediction.probability / 100;
  return {
    probability: prediction.probability,
    totalCost: totalCostMid,
    expectedValue: Math.round(probability * totalCostMid),
  };
}

// ─── Score Impact Estimation ─────────────────────────────────────────────────

function estimateScoreImpact(scenario: ScenarioDefinition, params: Record<string, string | number>): ScenarioResult['scoreImpact'] {
  const before = 65; // assume moderate baseline
  let delta = 0;

  switch (scenario.category) {
    case 'infrastructure': {
      const severity = scenario.id === 'water-main-break'
        ? paramNum(params, 'pipe-diameter') / 8
        : Math.log10(paramNum(params, 'volume-gallons')) - 3;
      delta = -Math.round(3 + severity * 3);
      break;
    }
    case 'natural-event':
      delta = -Math.round(5 + paramNum(params, 'storm-category') * 4);
      break;
    case 'contamination':
      delta = -Math.round(4 + (paramNum(params, 'concentration') > 10 ? 6 : 2));
      break;
    case 'regulatory':
      delta = -Math.round(2 + paramNum(params, 'reduction-percent') / 20);
      break;
  }

  delta = Math.max(-30, Math.min(0, delta));
  return { before, after: before + delta, delta };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function computeScenarioCost(
  scenario: ScenarioDefinition,
  paramValues: Record<string, string | number>,
  role: ScenarioPlannerRole,
  state: string,
  riskForecast?: RiskForecastResult | null,
): ScenarioResult {
  const { tiers, timeline } = computeCosts(scenario, paramValues, state);

  const totalCostLow = tiers.reduce((s, t) => s + t.totalLow, 0);
  const totalCostHigh = tiers.reduce((s, t) => s + t.totalHigh, 0);
  const totalCostMid = (totalCostLow + totalCostHigh) / 2;

  return {
    scenario,
    role,
    state,
    costTiers: tiers,
    totalCostLow,
    totalCostHigh,
    expectedLoss: linkExpectedLoss(scenario, totalCostMid, riskForecast),
    scoreImpact: estimateScoreImpact(scenario, paramValues),
    timeline,
    summary: roleSummary(role, scenario.label, totalCostLow, totalCostHigh, state),
    disclaimer: DISCLAIMER,
  };
}

export { fmt$ };
