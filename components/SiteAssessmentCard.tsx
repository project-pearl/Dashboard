'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';
import { BrandedPDFGenerator } from '@/lib/brandedPdfGenerator';

// ═══ CONSTANTS ═══
const COST_PER_UNIT_YEAR = 200000;

const STATE_ABBR_TO_NAME: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};


// ═══ TYPES ═══
type AlertLevel = 'high' | 'medium' | 'low' | 'none';

interface WaterParam {
  value: number;
  unit?: string;
  timestamp?: string;
  source?: string;
  lastSampled?: string;
}

export interface SiteAssessmentProps {
  siteId: string;
  regionName: string;
  stateAbbr: string;
  alertLevel: AlertLevel;
  waterParams: Record<string, WaterParam>;
  attainsCategory: string;
  attainsCauses: string[];
}

// ═══ SITE ASSESSMENT CARD ═══
// Standalone component for site-level assessment, severity scoring, deployment sizing,
// treatment prioritization, deployment roadmap, economics, and supporting restoration layers.
// Shared across all views: Federal (NCC), State, MS4, NGO.
export default function SiteAssessmentCard({
  siteId,
  regionName,
  stateAbbr,
  alertLevel,
  waterParams,
  attainsCategory,
  attainsCauses,
}: SiteAssessmentProps) {
  // Local UI state
  const [showRestorationCard, setShowRestorationCard] = useState(false);
  const [showCostPanel, setShowCostPanel] = useState(false);

  // Alias props to match internal variable names used throughout
  const params = waterParams;
  const level = alertLevel;

  // ── Classify waterbody type ──
  const salVal = params.salinity?.value ?? params.conductivity?.value ?? 0;
  const isBrackish = (params.salinity && salVal > 0.5) || (params.conductivity && salVal > 1000);
  const waterType = isBrackish ? 'brackish' : 'freshwater';

  // ── Map ATTAINS causes to treatment flags ──
  const causesLower = attainsCauses.map((c: string) => c.toLowerCase());
  const hasNutrients = causesLower.some((c: string) => c.includes('nutrient') || c.includes('nitrogen') || c.includes('phosphor'));
  const hasBacteria = causesLower.some((c: string) => c.includes('pathogen') || c.includes('e. coli') || c.includes('escherichia') || c.includes('enterococ') || c.includes('fecal') || c.includes('bacteria'));
  const hasSediment = causesLower.some((c: string) => c.includes('sediment') || c.includes('turbidity') || c.includes('total suspended') || c.includes('siltation'));
  const hasMetals = causesLower.some((c: string) => c.includes('mercury') || c.includes('lead') || c.includes('copper') || c.includes('zinc') || c.includes('metal'));
  const hasPFAS = causesLower.some((c: string) => c.includes('pfas') || c.includes('pfoa') || c.includes('pfos') || c.includes('perfluor'));
  const hasPCBs = causesLower.some((c: string) => c.includes('pcb') || c.includes('polychlorinated'));
  const hasTemperature = causesLower.some((c: string) => c.includes('temperature') || c.includes('thermal'));

  // ── Check live parameters against thresholds ──
  const nutrientExceedsBiofilt = (params.TN?.value ?? 0) > 3.0 || (params.TP?.value ?? 0) > 0.3;
  const bacteriaElevated = (params.bacteria?.value ?? 0) > 235;

  const isImpaired = level === 'high' || level === 'medium';
  // isCat5: ATTAINS says Category 5 OR alert system says high (state-listed impaired, TMDL needed)
  // The ATTAINS API doesn't always return a category string, but the alert level is derived from the same data
  const isCat5 = attainsCategory.includes('5') || (level === 'high' && attainsCategory === '');

  // ═══ STATE-AWARE SITE SEVERITY INDEX ═══
  // Maryland: MD DNR Shallow Water Monitoring thresholds (COMAR 1995, DNR SWM 2022-2024)
  // All other states: EPA National Recommended Water Quality Criteria / CWA standards
  const isMD = stateAbbr === 'MD';
  const doVal = params.DO?.value ?? null;
  const chlVal = params.chlorophyll?.value ?? null;
  const turbVal = params.turbidity?.value ?? null;
  const tnVal = params.TN?.value ?? null;
  const tpVal = params.TP?.value ?? null;

  // Threshold source label (for UI and PDF citations)
  const thresholdSource = isMD ? 'MD DNR Shallow Water Monitoring (COMAR 1995)' : 'EPA National Recommended Water Quality Criteria';
  const thresholdSourceShort = isMD ? 'MD DNR' : 'EPA';

  // DO thresholds
  // MD: 5.0 mg/L 30-day avg, 3.2 mg/L instantaneous min (Chesapeake Bay shallow water criteria)
  // National: EPA CWA 5.0 mg/L warm water aquatic life, 4.0 mg/L instantaneous min (40 CFR 131)
  const doCritical = isMD ? 3.2 : 4.0;
  const doStressed = 5.0; // universal
  const doSeverity: 'critical' | 'stressed' | 'adequate' | 'unknown' =
    doVal === null ? 'unknown' : doVal < doCritical ? 'critical' : doVal < doStressed ? 'stressed' : 'adequate';

  // Chlorophyll / bloom thresholds
  // MD: 15 µg/L bloom, 50 significant, 100 severe (DNR SWM protocol)
  // National: EPA ecoregional — 20 µg/L elevated, 40 significant, 60 severe (EPA 822-B-00-001)
  const chlBloom = isMD ? 15 : 20;
  const chlSignificant = isMD ? 50 : 40;
  const chlSevere = isMD ? 100 : 60;
  const bloomSeverity: 'severe' | 'significant' | 'bloom' | 'normal' | 'unknown' =
    chlVal === null ? 'unknown' : chlVal > chlSevere ? 'severe' : chlVal > chlSignificant ? 'significant' : chlVal > chlBloom ? 'bloom' : 'normal';

  // Turbidity thresholds
  // MD: 7 FNU detrimental to SAV growth (DNR SWM, Chesapeake-specific)
  // National: EPA — no single standard; 25 NTU generally considered impaired, 10 NTU elevated
  const turbElevated = isMD ? 7 : 10;
  const turbImpaired = isMD ? 20 : 25;
  const turbiditySeverity: 'impaired' | 'elevated' | 'clear' | 'unknown' =
    turbVal === null ? 'unknown' : turbVal > turbImpaired ? 'impaired' : turbVal > turbElevated ? 'elevated' : 'clear';

  // Nutrient thresholds
  // MD: Chesapeake Bay criteria — TN >1.0 elevated, >3.0 excessive; TP >0.1 elevated, >0.3 excessive
  // National: EPA ecoregional (conservative) — TN >1.5 elevated, >3.0 excessive; TP >0.1 elevated, >0.3 excessive
  const tnElevated = isMD ? 1.0 : 1.5;
  const tnExcessive = 3.0; // similar threshold widely
  const tpElevated = 0.1; // universal
  const tpExcessive = 0.3; // universal
  const nutrientSeverity: 'excessive' | 'elevated' | 'normal' | 'unknown' =
    (tnVal === null && tpVal === null) ? 'unknown'
    : ((tnVal ?? 0) > tnExcessive || (tpVal ?? 0) > tpExcessive) ? 'excessive'
    : ((tnVal ?? 0) > tnElevated || (tpVal ?? 0) > tpElevated) ? 'elevated' : 'normal';

  // ── Treatment Priority Engine ──
  type TreatmentPriority = { rank: number; driver: string; action: string; urgency: 'immediate' | 'high' | 'moderate' | 'low' };
  const treatmentPriorities: TreatmentPriority[] = [];

  // Nutrient-driven bloom cycle
  if (bloomSeverity === 'severe' || bloomSeverity === 'significant') {
    treatmentPriorities.push({ rank: 1, driver: `Algal bloom crisis (chlorophyll ${chlVal} ug/L, >${bloomSeverity === 'severe' ? chlSevere : chlSignificant} ${thresholdSourceShort} threshold)`, action: 'Nutrient interception via PEARL biofiltration + resin', urgency: 'immediate' });
  } else if (nutrientSeverity === 'excessive') {
    treatmentPriorities.push({ rank: 1, driver: `Excessive nutrient loading (TN ${tnVal?.toFixed(2) ?? '?'}, TP ${tpVal?.toFixed(2) ?? '?'} mg/L)`, action: 'Nutrient removal to prevent bloom cycle', urgency: 'high' });
  } else if (bloomSeverity === 'bloom' || nutrientSeverity === 'elevated') {
    treatmentPriorities.push({ rank: 2, driver: 'Elevated nutrients / early bloom conditions', action: 'Nutrient monitoring + biofiltration', urgency: 'moderate' });
  }

  // DO crisis
  if (doSeverity === 'critical') {
    treatmentPriorities.push({ rank: 1, driver: `DO at lethal levels (${doVal?.toFixed(1)} mg/L < ${doCritical} ${thresholdSourceShort} threshold)`, action: 'Immediate treatment to break bloom-crash DO cycle', urgency: 'immediate' });
  } else if (doSeverity === 'stressed') {
    treatmentPriorities.push({ rank: 2, driver: `DO below criteria (${doVal?.toFixed(1)} mg/L < ${doStressed} threshold)`, action: 'Treatment to restore DO above living resource criteria', urgency: 'high' });
  }

  // Turbidity / habitat
  if (turbiditySeverity === 'impaired') {
    treatmentPriorities.push({ rank: 2, driver: `Turbidity at ${turbVal?.toFixed(1)} FNU (>${turbImpaired})${isMD ? ' -- SAV habitat destroyed' : ' -- aquatic habitat impaired'}`, action: 'Sediment pre-screening + source control', urgency: 'high' });
  } else if (turbiditySeverity === 'elevated') {
    treatmentPriorities.push({ rank: 3, driver: `Turbidity at ${turbVal?.toFixed(1)} FNU (>${turbElevated} ${isMD ? 'SAV' : 'habitat'} threshold)`, action: '50um pre-screen captures suspended solids', urgency: 'moderate' });
  }

  // Bacteria
  if (bacteriaElevated) {
    treatmentPriorities.push({ rank: 1, driver: `Bacteria at ${Math.round(params.bacteria?.value ?? 0)} MPN/100mL (>235 EPA recreational standard)`, action: 'UV treatment + pathogen monitoring', urgency: 'immediate' });
  } else if (hasBacteria) {
    treatmentPriorities.push({ rank: 2, driver: 'Pathogen impairment listed in ATTAINS', action: 'Seasonal pathogen monitoring + treatment', urgency: 'moderate' });
  }

  // Sort by rank
  treatmentPriorities.sort((a, b) => a.rank - b.rank);

  // ── Composite Site Severity Score (0-100) ──
  // KEY RULE: "unknown" at an impaired site = "likely bad" (score 70), not "maybe fine" (50)
  // "unknown" at a clean site = neutral (50)
  // This prevents sites like Middle Branch (DNR monitor pulled, no live data, but documented catastrophic conditions) from scoring low
  const impairmentCount = attainsCauses.length;
  const hasMultipleImpairments = impairmentCount >= 3;

  const doScore = doSeverity === 'critical' ? 100 : doSeverity === 'stressed' ? 70 : doSeverity === 'adequate' ? 20
    : (isImpaired ? 70 : 50); // unknown + impaired = assume stressed

  const bloomScore = bloomSeverity === 'severe' ? 100 : bloomSeverity === 'significant' ? 80 : bloomSeverity === 'bloom' ? 60
    : nutrientSeverity === 'excessive' ? 70 : nutrientSeverity === 'elevated' ? 40
    : bloomSeverity === 'normal' ? 10
    : (hasNutrients ? 75 : isImpaired ? 60 : 50); // unknown + nutrient impairment = assume blooms likely

  const turbScore = turbiditySeverity === 'impaired' ? 100 : turbiditySeverity === 'elevated' ? 60 : turbiditySeverity === 'clear' ? 10
    : (hasSediment ? 75 : isImpaired ? 60 : 50); // unknown + sediment impairment = assume poor clarity

  const impairScore = isCat5 ? 100
    : isImpaired ? (hasMultipleImpairments ? 85 : 70) // 3+ causes = worse than 1-2
    : 30;
  // monitoringGapScore computed after dataAgeDays below

  // ── TMDL status ──
  const tmdlStatus = isCat5 ? 'needed'
    : (attainsCategory.includes('4a') || attainsCategory.includes('4A')) ? 'completed'
    : (attainsCategory.includes('4b') || attainsCategory.includes('4B')) ? 'alternative'
    : 'na';

  // ── Build restoration categories ──
  type TreatmentModule = { id: string; label: string; icon: string; status: 'recommended' | 'warranted' | 'co-benefit' | 'accelerator'; detail: string; color: string };
  type RestorationCategory = { id: string; title: string; icon: string; subtitle: string; modules: TreatmentModule[]; color: string };
  const categories: RestorationCategory[] = [];

  // ═══ CATEGORY 1: SOURCE CONTROL — Upstream BMPs ═══
  const bmps: TreatmentModule[] = [];
  if (isImpaired || hasSediment || hasNutrients) {
    bmps.push({ id: 'bioretention', label: 'Bioretention / Rain Gardens', icon: '🌧️', status: 'recommended',
      detail: 'Capture and infiltrate stormwater runoff. Removes 60-80% TSS, 50-70% metals, 30-50% nutrients per EPA BMP guidelines.',
      color: 'bg-green-50 border-green-200 text-green-800' });
  }
  if (hasSediment || isImpaired) {
    bmps.push({ id: 'bioswale', label: 'Vegetated Bioswales', icon: '🌿', status: 'recommended',
      detail: 'Convey and treat stormwater along graded channels with native vegetation. Effective sediment and particulate removal.',
      color: 'bg-green-50 border-green-200 text-green-800' });
  }
  bmps.push({ id: 'permeable', label: 'Permeable Pavement', icon: '🏗️', status: 'recommended',
    detail: 'Reduces impervious surface runoff. Particularly effective in urban MS4 jurisdictions for volume reduction credit.',
    color: 'bg-green-50 border-green-200 text-green-800' });
  bmps.push({ id: 'detention', label: 'Detention / Retention Ponds', icon: '💧', status: 'recommended',
    detail: 'Attenuate peak flows and settle suspended solids. Wet ponds provide additional nutrient uptake via aquatic vegetation.',
    color: 'bg-green-50 border-green-200 text-green-800' });
  bmps.push({ id: 'greenroof', label: 'Green Roofs', icon: '🏢', status: 'co-benefit',
    detail: 'Reduce stormwater volume 40-60% from rooftop area. Co-benefits include urban heat island reduction and habitat.',
    color: 'bg-slate-50 border-slate-200 text-slate-700' });
  bmps.push({ id: 'cistern', label: 'Rain Barrels / Cisterns', icon: '🪣', status: 'co-benefit',
    detail: 'Capture rooftop runoff for reuse. Reduces peak flow volume. Low-cost entry point for residential engagement.',
    color: 'bg-slate-50 border-slate-200 text-slate-700' });
  if (hasSediment) {
    bmps.push({ id: 'erosion', label: 'Erosion & Sediment Control', icon: '🪨', status: 'warranted',
      detail: 'Silt fencing, check dams, stabilized construction entrances. Required during active land disturbance.',
      color: 'bg-amber-50 border-amber-200 text-amber-800' });
  }
  bmps.push({ id: 'sweeping', label: 'Street Sweeping Program', icon: '🧹', status: 'co-benefit',
    detail: 'Removes sediment, debris, and pollutants from impervious surfaces before mobilization. MS4 permit credit eligible.',
    color: 'bg-slate-50 border-slate-200 text-slate-700' });
  categories.push({ id: 'source', title: 'Source Control — Upstream BMPs', icon: '🌱', subtitle: 'Reduce pollutant loading before it reaches the waterbody', modules: bmps, color: 'border-green-200 bg-green-50/30' });

  // ═══ CATEGORY 2: NATURE-BASED SOLUTIONS ═══
  const natureBased: TreatmentModule[] = [];
  natureBased.push({ id: 'wetland', label: 'Constructed Treatment Wetlands', icon: '🌾', status: hasNutrients || hasBacteria ? 'recommended' : 'co-benefit',
    detail: 'Engineered wetland cells for nutrient uptake, pathogen die-off, and sediment settling. 50-90% nutrient removal at scale. Provides habitat co-benefits.',
    color: hasNutrients ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700' });
  natureBased.push({ id: 'wetland-restore', label: 'Wetland Restoration / Preservation', icon: '🦆', status: 'recommended',
    detail: 'Restore degraded wetlands or preserve existing ones. Natural buffers filter runoff, store floodwater, and support biodiversity. Eligible for §404 mitigation banking.',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-800' });
  natureBased.push({ id: 'riparian', label: 'Riparian Buffer Restoration', icon: '🌳', status: hasTemperature ? 'warranted' : 'recommended',
    detail: `Forested and vegetated streamside zones (min 100ft recommended). Filters overland flow, stabilizes banks, moderates temperature${hasTemperature ? ' — critical for thermal impairment listed here' : ''}.`,
    color: hasTemperature ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800' });
  if (waterType === 'brackish') {
    natureBased.push({ id: 'living-shoreline', label: 'Living Shoreline', icon: '🐚', status: 'recommended',
      detail: 'Oyster shell reefs, native marsh grass plantings, and biodegradable coir logs. Reduces erosion, improves habitat, filters water naturally.',
      color: 'bg-teal-50 border-teal-200 text-teal-800' });
  }
  natureBased.push({ id: 'stream-restore', label: 'Stream Channel Restoration', icon: '🏞️', status: hasSediment ? 'recommended' : 'co-benefit',
    detail: 'Natural channel design (NCD), step pools, bank stabilization. Reduces erosion at source, reconnects floodplain for nutrient processing.',
    color: hasSediment ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700' });
  natureBased.push({ id: 'floodplain', label: 'Floodplain Reconnection', icon: '🌊', status: 'co-benefit',
    detail: 'Remove berms or lower levees to restore natural floodplain function. Provides nutrient processing, flood attenuation, and habitat.',
    color: 'bg-slate-50 border-slate-200 text-slate-700' });
  natureBased.push({ id: 'reef-restore', label: waterType === 'brackish' ? 'Oyster Reef Restoration' : 'Mussel Bed Restoration', icon: '🪸', status: 'recommended',
    detail: waterType === 'brackish'
      ? 'Establish or enhance oyster reef habitat. Each adult oyster filters 50 gal/day. Provides shoreline protection and fish nursery habitat.'
      : 'Reintroduce native freshwater mussel populations. Natural biofilters that stabilize substrate and improve water clarity.',
    color: 'bg-teal-50 border-teal-200 text-teal-800' });
  categories.push({ id: 'nature', title: 'Nature-Based Solutions', icon: '🌿', subtitle: 'Restore natural processes for long-term water quality improvement', modules: natureBased, color: 'border-emerald-200 bg-emerald-50/30' });

  // ═══ CATEGORY 3: PEARL ACCELERATOR ═══
  const pearlModules: TreatmentModule[] = [];
  pearlModules.push({ id: 'pearl-core', label: waterType === 'brackish' ? 'PEARL — Oyster Biofiltration Unit' : 'PEARL — Mussel Biofiltration Unit',
    icon: waterType === 'brackish' ? '🦪' : '🐚', status: isImpaired ? 'accelerator' : 'co-benefit',
    detail: waterType === 'brackish'
      ? 'Eastern oyster (C. virginica) biofiltration with real-time TSS, turbidity, and DO monitoring. Accelerates natural filtration with continuous performance data.'
      : 'Native freshwater mussel biofiltration with real-time TSS, turbidity, and DO monitoring. Accelerates natural filtration with continuous performance data.',
    color: 'bg-cyan-50 border-cyan-200 text-cyan-800' });
  pearlModules.push({ id: 'pearl-screen', label: '50μm Pre-Screening Mesh', icon: '🔍', status: 'accelerator',
    detail: 'Mechanical pre-filtration removes sediment, debris, and microplastics (>50μm) before biological stage. Protects organisms and provides microplastic co-benefit.',
    color: 'bg-cyan-50 border-cyan-200 text-cyan-800' });
  pearlModules.push({ id: 'pearl-monitor', label: 'Real-Time Monitoring Array', icon: '📡', status: 'accelerator',
    detail: 'Continuous TSS, turbidity, DO, pH, temperature telemetry. Provides compliance documentation, early warning alerts, and treatment verification data.',
    color: 'bg-cyan-50 border-cyan-200 text-cyan-800' });
  if (hasNutrients || nutrientExceedsBiofilt) {
    pearlModules.push({ id: 'pearl-resin-n', label: 'Ion Exchange — Nutrient Polishing', icon: '🔬', status: nutrientExceedsBiofilt ? 'warranted' : 'accelerator',
      detail: nutrientExceedsBiofilt
        ? `Nutrient levels exceed biofilt capacity (TN: ${params.TN?.value?.toFixed(1) ?? '?'}, TP: ${params.TP?.value?.toFixed(2) ?? '?'}). Resin stage required to meet targets.`
        : 'Supplemental resin polishing enhances nutrient removal beyond what biofiltration alone achieves.',
      color: nutrientExceedsBiofilt ? 'bg-red-50 border-red-200 text-red-800' : 'bg-cyan-50 border-cyan-200 text-cyan-800' });
  }
  if (hasBacteria || bacteriaElevated) {
    pearlModules.push({ id: 'pearl-uv', label: 'UV Disinfection Stage', icon: '🦠', status: bacteriaElevated ? 'warranted' : 'accelerator',
      detail: bacteriaElevated
        ? `Bacteria at ${Math.round(params.bacteria?.value ?? 0)} MPN/100mL (target <235). UV stage required for pathogen reduction.`
        : 'ATTAINS lists pathogen impairment. UV stage provides reliable disinfection without chemical residuals.',
      color: bacteriaElevated ? 'bg-red-50 border-red-200 text-red-800' : 'bg-cyan-50 border-cyan-200 text-cyan-800' });
  }
  if (hasMetals) {
    pearlModules.push({ id: 'pearl-resin-m', label: 'Chelating Resin — Metals', icon: '⚙️', status: 'warranted',
      detail: 'Metal impairment detected. Chelating ion exchange resin targets dissolved metals that biofiltration cannot address.',
      color: 'bg-amber-50 border-amber-200 text-amber-800' });
  }
  if (hasPFAS) {
    pearlModules.push({ id: 'pearl-gac', label: 'GAC + Ion Exchange — PFAS', icon: '☢️', status: 'warranted',
      detail: 'PFAS contamination requires dedicated granular activated carbon (GAC) and ion exchange resin. Beyond biological treatment capacity.',
      color: 'bg-red-50 border-red-200 text-red-800' });
  }
  if (hasPCBs) {
    pearlModules.push({ id: 'pearl-ac', label: 'Activated Carbon — PCBs/Organics', icon: '⚗️', status: 'warranted',
      detail: 'PCB contamination identified. Activated carbon adsorption stage required. May also address other organic contaminants.',
      color: 'bg-red-50 border-red-200 text-red-800' });
  }
  categories.push({ id: 'pearl', title: 'PEARL — Treatment Accelerator', icon: '⚡', subtitle: 'Combines biological filtration + mechanical treatment + real-time data to accelerate restoration outcomes', modules: pearlModules, color: 'border-cyan-200 bg-cyan-50/30' });

  // ═══ CATEGORY 4: COMMUNITY & STEWARDSHIP ═══
  const community: TreatmentModule[] = [];
  community.push({ id: 'adopt', label: 'Adopt-a-Stream / Adopt-a-Waterbody', icon: '🤝', status: 'recommended', detail: 'Partner with local community groups, schools, and civic organizations for ongoing monitoring, cleanup events, and data collection.', color: 'bg-violet-50 border-violet-200 text-violet-800' });
  community.push({ id: 'education', label: 'Watershed Education Program', icon: '📚', status: 'recommended', detail: 'Public workshops on stormwater management, lawn care BMPs, pet waste, and impervious surface reduction. MS4 public education requirement.', color: 'bg-violet-50 border-violet-200 text-violet-800' });
  community.push({ id: 'citizen-science', label: 'Citizen Science Monitoring', icon: '🔬', status: 'recommended', detail: 'Train volunteers for water quality sampling (bacteria, turbidity, nutrients). Supplements professional monitoring with higher spatial and temporal coverage.', color: 'bg-violet-50 border-violet-200 text-violet-800' });
  community.push({ id: 'illicit-discharge', label: 'Illicit Discharge Detection', icon: '🔎', status: isImpaired ? 'warranted' : 'recommended', detail: 'Systematic outfall screening and dye testing to identify and eliminate illicit connections to storm drains. MS4 Minimum Control Measure #3.', color: isImpaired ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-violet-50 border-violet-200 text-violet-800' });
  community.push({ id: 'trash-cleanup', label: 'Trash Trap / Stream Cleanup', icon: '🗑️', status: 'co-benefit', detail: 'Install trash traps at outfalls and organize regular cleanup events. Removes debris that degrades habitat and carries pollutants.', color: 'bg-slate-50 border-slate-200 text-slate-700' });
  if (hasNutrients) {
    community.push({ id: 'lawn-care', label: 'Nutrient Management Outreach', icon: '🌾', status: 'recommended', detail: 'Targeted outreach on fertilizer reduction, soil testing, and nutrient management plans. Addresses nonpoint nutrient loading at the residential scale.', color: 'bg-violet-50 border-violet-200 text-violet-800' });
  }
  if (hasBacteria) {
    community.push({ id: 'pet-waste', label: 'Pet Waste / Septic Outreach', icon: '🐕', status: 'recommended', detail: 'Pet waste station installation, septic system inspection programs, and homeowner education on proper maintenance. Key bacteria source reduction.', color: 'bg-violet-50 border-violet-200 text-violet-800' });
  }
  categories.push({ id: 'community', title: 'Community Engagement & Stewardship', icon: '🏘️', subtitle: 'Build local capacity for sustained watershed health', modules: community, color: 'border-violet-200 bg-violet-50/30' });

  // ═══ CATEGORY 5: REGULATORY & PLANNING ═══
  const regulatory: TreatmentModule[] = [];
  if (tmdlStatus === 'needed') {
    regulatory.push({ id: 'tmdl-dev', label: 'TMDL Development', icon: '📋', status: 'warranted', detail: 'Category 5 waterbody requires Total Maximum Daily Load establishment. PEARL monitoring data can support load allocation modeling and compliance tracking.', color: 'bg-red-50 border-red-200 text-red-800' });
  }
  regulatory.push({ id: 'wip', label: 'Watershed Implementation Plan', icon: '🗺️', status: 'recommended', detail: 'Comprehensive plan identifying pollution sources, BMP locations, responsible parties, timelines, and funding. Required for many grant programs.', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' });
  regulatory.push({ id: 'ms4-credit', label: 'MS4 BMP Credit Documentation', icon: '📊', status: 'recommended', detail: 'Document all implemented BMPs and nature-based solutions for MS4 permit compliance credit. PEARL real-time data provides verifiable performance metrics.', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' });
  regulatory.push({ id: 'adaptive', label: 'Adaptive Management Plan', icon: '🔄', status: 'recommended', detail: 'Iterative monitoring → assessment → adjustment cycle. Use PEARL continuous data to evaluate BMP effectiveness and adjust treatment train over time.', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' });
  categories.push({ id: 'regulatory', title: 'Regulatory & Planning', icon: '📋', subtitle: 'Compliance pathways and planning frameworks', modules: regulatory, color: 'border-indigo-200 bg-indigo-50/30' });

  // ── Threat Assessment ──
  type ThreatLevel = { label: string; level: 'HIGH' | 'MODERATE' | 'LOW'; detail: string; color: string };
  const threats: ThreatLevel[] = [
    { label: 'Microplastics', level: hasSediment || isImpaired ? 'MODERATE' : 'LOW', detail: 'Co-benefit removal via 50μm pre-screening mesh. No dedicated treatment required.', color: hasSediment || isImpaired ? 'text-amber-700' : 'text-green-700' },
    { label: 'PFAS', level: hasPFAS ? 'HIGH' : 'LOW', detail: hasPFAS ? 'Dedicated GAC + ion exchange treatment required.' : 'No PFAS impairment listed. Monitor as emerging contaminant.', color: hasPFAS ? 'text-red-700' : 'text-green-700' },
    { label: 'Pathogens', level: bacteriaElevated ? 'HIGH' : hasBacteria ? 'MODERATE' : 'LOW', detail: bacteriaElevated ? 'Active exceedance — UV treatment stage needed.' : hasBacteria ? 'Listed impairment — seasonal, BMP-addressable.' : 'No pathogen concerns identified.', color: bacteriaElevated ? 'text-red-700' : hasBacteria ? 'text-amber-700' : 'text-green-700' },
  ];

  // ── System summary ──
  const pearlMods = categories.find(c => c.id === 'pearl')?.modules || [];
  const pearlModel = pearlMods.some(t => t.id === 'pearl-gac' || t.id === 'pearl-ac') ? 'PEARL-5X'
    : pearlMods.some(t => t.id === 'pearl-resin-n' || t.id === 'pearl-resin-m') ? 'PEARL-3R'
    : pearlMods.some(t => t.id === 'pearl-uv') ? 'PEARL-3B'
    : 'PEARL-2S';
  const totalBMPs = categories.filter(c => c.id !== 'pearl').reduce((n, c) => n + c.modules.filter(m => m.status === 'recommended' || m.status === 'warranted').length, 0);
  const compliancePathway = tmdlStatus === 'needed' ? 'TMDL development candidate'
    : tmdlStatus === 'completed' ? 'TMDL implementation — monitoring phase'
    : tmdlStatus === 'alternative' ? 'Alternative controls in place — enhancement opportunity'
    : isImpaired ? 'Impaired — restoration candidate' : 'Preventive deployment';

  // ── PEARL Unit Sizing & Cost Model ──
  // 1 PEARL unit = 50 GPM standard, $200K/unit/year
  // ═══ SEVERITY-DRIVEN SIZING MODEL ═══
  // Replaces acreage-only proxy with DNR-threshold treatment need assessment
  // Formula: Site severity determines base deployment, acreage provides scale modifier
  const UNITS_PER_QUAD = 4; // 1 quad = 4 units = 200 GPM

  // Waterbody acreage — estimation (ATTAINS acres not available as prop yet)
  const attainsAcres: number | null = null;
  const estimatedAcres = attainsAcres ?? (
    waterType === 'brackish' ? 150 : 50 // conservative default by type
  );
  const acresSource = attainsAcres ? 'ATTAINS' : 'estimated';

  // ── Data age (must compute BEFORE sizing — monitoring gap affects severity) ──
  const oldestSample = Object.values(params).reduce((oldest: string | null, p: any) => {
    if (!p?.lastSampled) return oldest;
    if (!oldest) return p.lastSampled;
    return new Date(p.lastSampled) < new Date(oldest) ? p.lastSampled : oldest;
  }, null as string | null);
  const dataAgeDays = oldestSample ? Math.round((Date.now() - new Date(oldestSample).getTime()) / 86400000) : null;
  const dataConfidence = dataAgeDays === null ? 'unknown' : dataAgeDays > 90 ? 'low' : dataAgeDays > 30 ? 'moderate' : 'high';
  const monitoringGapScore = dataAgeDays === null ? 80 : dataAgeDays > 365 ? 100 : dataAgeDays > 90 ? 70 : dataAgeDays > 30 ? 40 : 10;

  // ── Complete Site Severity Score (0-100) ──
  // All 5 components computed BEFORE sizing so quads reflect full picture
  // Weights: DO 25%, Bloom/Nutrients 25%, Turbidity 15%, ATTAINS impairment 20%, Monitoring gap 15%
  let siteSeverityScore = Math.round(
    doScore * 0.25 + bloomScore * 0.25 + turbScore * 0.15 + impairScore * 0.20 + monitoringGapScore * 0.15
  );

  // ── Severity floors ──
  // These enforce minimum scores that the composite math alone can't reach
  // because a single adequate snapshot shouldn't override a state impairment listing

  // ═══ BASELINE FLOORS (independent of data age) ═══
  // A state impairment listing is based on multi-year assessment.
  // One good snapshot doesn't override that regulatory determination.

  // Tier 0a: Any impaired site = minimum STRESSED (40)
  // Rationale: State says it's impaired. That's a formal regulatory finding.
  if (isImpaired) {
    siteSeverityScore = Math.max(siteSeverityScore, 40);
  }

  // Tier 0b: Cat 5 = minimum DEGRADED (55)
  // Rationale: Highest impairment category, no TMDL. The state has formally determined
  // this waterbody needs a TMDL — a single good reading doesn't change that.
  if (isCat5) {
    siteSeverityScore = Math.max(siteSeverityScore, 55);
  }

  // Tier 0c: Cat 5 + 3+ impairment causes = minimum high-DEGRADED (65)
  // Rationale: Multiple documented pollution sources AND no TMDL.
  // Systemic multi-cause impairment warrants substantial response.
  if (isCat5 && hasMultipleImpairments) {
    siteSeverityScore = Math.max(siteSeverityScore, 65);
  }

  // ═══ DATA-GAP ESCALATION FLOORS ═══
  // When monitoring has lapsed, severity increases because you're operating blind.

  // Tier 1: Any impaired site with >1 year data gap = minimum DEGRADED (60)
  // Rationale: You know it was bad. You don't know if it's better. You're operating blind.
  if (isImpaired && (dataAgeDays === null || dataAgeDays > 365)) {
    siteSeverityScore = Math.max(siteSeverityScore, 60);
  }

  // Tier 2: Cat 5 + >180 day gap = high DEGRADED (70)
  // Rationale: State has formally determined a TMDL is needed. Significant monitoring lapse.
  if (isCat5 && (dataAgeDays === null || dataAgeDays > 180)) {
    siteSeverityScore = Math.max(siteSeverityScore, 70);
  }

  // Tier 3: Cat 5 + >1 year gap = CRITICAL (75)
  // Rationale: The state's highest impairment category AND no monitoring for over a year.
  // A known severe problem with zero visibility is definitionally critical.
  // This is Middle Branch: DNR documented catastrophic conditions, then lost their monitor.
  if (isCat5 && (dataAgeDays === null || dataAgeDays > 365)) {
    siteSeverityScore = Math.max(siteSeverityScore, 75);
  }

  // Tier 3b: 3+ impairment causes + >1 year gap = CRITICAL (75)
  // Rationale: Multiple pollution sources documented, no current data to track any of them.
  if (hasMultipleImpairments && (dataAgeDays === null || dataAgeDays > 365)) {
    siteSeverityScore = Math.max(siteSeverityScore, 75);
  }

  const siteSeverityLabel = siteSeverityScore >= 75 ? 'CRITICAL' : siteSeverityScore >= 50 ? 'DEGRADED' : siteSeverityScore >= 25 ? 'STRESSED' : 'FAIR';
  const siteSeverityColor = siteSeverityScore >= 75 ? 'text-red-700 bg-red-100' : siteSeverityScore >= 50 ? 'text-amber-700 bg-amber-100' : siteSeverityScore >= 25 ? 'text-yellow-700 bg-yellow-100' : 'text-green-700 bg-green-100';

  // ═══ SEVERITY-DRIVEN SIZING (uses full siteSeverityScore) ═══
  const baseQuads = siteSeverityScore >= 75 ? 3    // CRITICAL: 3 quads — treat multiple inflow zones
    : siteSeverityScore >= 50 ? 2                    // DEGRADED: 2 quads — primary + secondary inflow
    : siteSeverityScore >= 25 ? 1                    // STRESSED: 1 quad — highest-load inflow
    : 1;                                              // FAIR: 1 quad minimum (pilot/monitoring)

  // Scale modifier for large waterbodies (more inflow zones to cover)
  const acresModifier = estimatedAcres > 1000 ? 2 : estimatedAcres > 500 ? 1 : 0;

  // Total deployment
  const totalQuads = baseQuads + acresModifier;
  const totalUnits = totalQuads * UNITS_PER_QUAD;

  // Phasing strategy: each phase gets a distinct zone and mission
  // 1 quad = no phasing. 2 quads = 1+1. 3 quads = 1+1+1. 4+ = 2 then split remainder.
  const phase1Quads = totalQuads <= 1 ? totalQuads
    : totalQuads <= 3 ? 1              // 2Q or 3Q: start with 1 quad at highest-priority zone
    : Math.min(2, Math.ceil(totalQuads * 0.5)); // 4+: start with 2 quads
  const phase1Units = phase1Quads * UNITS_PER_QUAD;
  const isPhasedDeployment = totalQuads > 1;

  // Cost projections
  const phase1AnnualCost = phase1Units * COST_PER_UNIT_YEAR;
  const fullAnnualCost = totalUnits * COST_PER_UNIT_YEAR;
  const phase1GPM = phase1Units * 50;
  const fullGPM = totalUnits * 50;

  // Sizing basis label (for display)
  const sizingBasis = siteSeverityScore >= 75 ? 'Critical severity \u2014 multi-zone treatment'
    : siteSeverityScore >= 50 ? 'Degraded conditions \u2014 dual-zone treatment'
    : siteSeverityScore >= 25 ? 'Stressed conditions \u2014 targeted treatment'
    : 'Monitoring + preventive treatment';
  const severityMultiplier = siteSeverityScore; // downstream compat
  const prelimSeverity = siteSeverityScore; // downstream compat

  // (data age, monitoring gap, and siteSeverityScore computed above, before sizing)

  // ── Why PEARL bullets (DNR-threshold enriched) ──
  const whyBullets: Array<{ icon: string; problem: string; solution: string }> = [];

  // Bloom-driven DO crash cycle
  if ((bloomSeverity === 'severe' || bloomSeverity === 'significant') && (doSeverity === 'critical' || doSeverity === 'stressed')) {
    whyBullets.push({ icon: '💀', problem: `Bloom-crash DO cycle: chlorophyll at ${chlVal} ug/L drives DO to ${doVal?.toFixed(1)} mg/L -- lethal to fish and shellfish (${thresholdSourceShort})`, solution: 'PEARL intercepts nutrients upstream of bloom formation, breaking the eutrophication cycle' });
  } else {
    if (doSeverity === 'critical') whyBullets.push({ icon: '🔴', problem: `DO at ${doVal?.toFixed(1)} mg/L -- below ${doCritical} mg/L lethal threshold (${thresholdSourceShort})`, solution: 'PEARL biofiltration improves DO through nutrient removal and aeration' });
    else if (doSeverity === 'stressed') whyBullets.push({ icon: '🟡', problem: `DO at ${doVal?.toFixed(1)} mg/L -- below ${doStressed} mg/L living resource criteria`, solution: 'PEARL treatment targets nutrient drivers of low DO' });

    if (bloomSeverity === 'severe') whyBullets.push({ icon: '🟤', problem: `Severe algal bloom: chlorophyll at ${chlVal} ug/L (>${chlSevere} = severe per ${thresholdSourceShort})`, solution: 'PEARL nutrient removal starves bloom cycle at the source' });
    else if (bloomSeverity === 'significant') whyBullets.push({ icon: '🟠', problem: `Significant bloom: chlorophyll at ${chlVal} ug/L (>${chlSignificant} ${thresholdSourceShort} threshold)`, solution: 'Biofiltration + ion exchange removes N and P driving blooms' });
    else if (bloomSeverity === 'bloom') whyBullets.push({ icon: '🟡', problem: `Algal bloom detected: chlorophyll at ${chlVal} ug/L (>${chlBloom} ${thresholdSourceShort} threshold)`, solution: 'PEARL monitors bloom dynamics and reduces nutrient loading' });
  }

  if (nutrientSeverity === 'excessive' && bloomSeverity !== 'severe' && bloomSeverity !== 'significant') {
    whyBullets.push({ icon: '🧪', problem: `Excessive nutrients: TN ${tnVal?.toFixed(2) ?? '?'} mg/L, TP ${tpVal?.toFixed(2) ?? '?'} mg/L -- eutrophication risk`, solution: 'PEARL biofiltration + resin removes N and P in real time' });
  } else if (hasNutrients && nutrientSeverity !== 'excessive') {
    whyBullets.push({ icon: '🧪', problem: 'Nutrient impairment listed in ATTAINS -- eutrophication driver', solution: 'PEARL biofiltration + resin removes N and P in real time' });
  }

  if (turbiditySeverity === 'impaired') whyBullets.push({ icon: '🌫️', problem: `Turbidity at ${turbVal?.toFixed(1)} FNU -- exceeds ${turbImpaired} FNU ${isMD ? 'SAV habitat' : 'aquatic habitat'} threshold (${thresholdSourceShort})`, solution: 'PEARL 50um pre-screen + biofilt captures suspended solids, restoring water clarity' });
  else if (turbiditySeverity === 'elevated') whyBullets.push({ icon: '🌫️', problem: `Turbidity at ${turbVal?.toFixed(1)} FNU -- exceeds ${turbElevated} FNU ${isMD ? 'SAV growth' : 'habitat'} threshold (${thresholdSourceShort})`, solution: 'PEARL 50um screening captures suspended solids' });
  else if (hasSediment) whyBullets.push({ icon: '🌫️', problem: 'Sediment/turbidity impairment listed in ATTAINS', solution: 'PEARL 50um screening + biofilt captures suspended solids' });

  if (bacteriaElevated) whyBullets.push({ icon: '🦠', problem: `Bacteria at ${Math.round(params.bacteria?.value ?? 0)} MPN/100mL — exceeds 235 MPN/100mL recreational standard`, solution: 'PEARL UV treatment stage provides immediate pathogen reduction' });
  else if (hasBacteria) whyBullets.push({ icon: '🦠', problem: 'Pathogen impairment listed in ATTAINS', solution: 'PEARL provides pathogen treatment capacity' });

  if (hasMetals) whyBullets.push({ icon: '⚙️', problem: 'Metal contamination in water column', solution: 'Chelating resin stage targets dissolved metals' });

  if (dataAgeDays !== null && dataAgeDays > 365) whyBullets.push({ icon: '📡', problem: `No monitoring data in ${Math.round(dataAgeDays / 365)} year${dataAgeDays > 730 ? 's' : ''} — site is operating blind`, solution: 'PEARL restores continuous, compliance-grade monitoring immediately' });
  else if (dataAgeDays !== null && dataAgeDays > 30) whyBullets.push({ icon: '📡', problem: `Data is ${dataAgeDays} days old — confidence is ${dataAgeDays > 90 ? 'low' : 'moderate'}`, solution: 'PEARL delivers continuous 15-min interval monitoring' });

  if (tmdlStatus === 'needed') whyBullets.push({ icon: '📋', problem: 'No TMDL established — regulatory exposure is open', solution: 'PEARL data supports TMDL development and load allocation' });

  if (whyBullets.length === 0) whyBullets.push({ icon: '🛡️', problem: 'Waterbody at risk without active monitoring', solution: 'PEARL provides early warning and baseline data' });

  return (
    <Card className="border-2 border-cyan-300 shadow-md">
      {/* Collapsed summary header — always visible */}
      <button
        onClick={() => setShowRestorationCard(prev => !prev)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-cyan-50/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🔧</span>
          <div className="text-left">
            <div className="text-sm font-semibold text-cyan-800 flex items-center gap-2">
              Restoration Plan — {regionName}
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${siteSeverityColor}`}>
                {siteSeverityLabel} ({siteSeverityScore})
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              {pearlModel} × {totalUnits} unit{totalUnits > 1 ? 's' : ''} ({totalQuads} quad{totalQuads > 1 ? 's' : ''}, {fullGPM} GPM) + {totalBMPs} BMPs · {waterType === 'brackish' ? '🦪 Oyster' : '🐚 Mussel'} Biofilt · {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(fullAnnualCost)}/yr
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[9px]">
            {categories.reduce((n, c) => n + c.modules.filter(m => m.status === 'warranted').length, 0) > 0 && (
              <span className="bg-red-200 text-red-800 font-bold px-1.5 py-0.5 rounded-full">
                {categories.reduce((n, c) => n + c.modules.filter(m => m.status === 'warranted').length, 0)} warranted
              </span>
            )}
            <span className="bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded-full">{totalBMPs} recommended</span>
          </div>
          <ChevronDown size={16} className={`text-cyan-600 transition-transform ${showRestorationCard ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded content */}
      {showRestorationCard && (
        <CardContent className="pt-0 pb-4 space-y-4">

          {/* ═══ EXECUTIVE SUMMARY ═══ */}
          {(() => {
            return (
              <div className="rounded-lg border-2 border-slate-300 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-900 uppercase tracking-wide">Executive Summary</div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${siteSeverityColor}`}>
                    Site Severity: {siteSeverityLabel} ({siteSeverityScore}/100)
                  </span>
                </div>

                {/* Severity score breakdown bar */}
                <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isMD ? 'MD DNR Threshold' : 'EPA Criteria'} Assessment</div>
                  <div className="grid grid-cols-5 gap-1.5 text-[10px]">
                    <div className="text-center">
                      <div className={`font-bold ${doSeverity === 'critical' ? 'text-red-700' : doSeverity === 'stressed' ? 'text-amber-600' : doSeverity === 'adequate' ? 'text-green-600' : 'text-slate-400'}`}>
                        {doSeverity === 'unknown' ? '?' : doVal?.toFixed(1)} mg/L
                      </div>
                      <div className="text-slate-500">DO</div>
                      <div className={`text-[9px] font-medium ${doSeverity === 'critical' ? 'text-red-600' : doSeverity === 'stressed' ? 'text-amber-600' : 'text-green-600'}`}>
                        {doSeverity !== 'unknown' ? doSeverity : 'no data'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`font-bold ${bloomSeverity === 'severe' || bloomSeverity === 'significant' ? 'text-red-700' : bloomSeverity === 'bloom' ? 'text-amber-600' : bloomSeverity === 'normal' ? 'text-green-600' : 'text-slate-400'}`}>
                        {bloomSeverity === 'unknown' ? '?' : chlVal} ug/L
                      </div>
                      <div className="text-slate-500">Chl-a</div>
                      <div className={`text-[9px] font-medium ${bloomSeverity === 'severe' ? 'text-red-600' : bloomSeverity === 'significant' ? 'text-orange-600' : bloomSeverity === 'bloom' ? 'text-amber-600' : 'text-green-600'}`}>
                        {bloomSeverity !== 'unknown' ? bloomSeverity : 'no data'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`font-bold ${turbiditySeverity === 'impaired' ? 'text-red-700' : turbiditySeverity === 'elevated' ? 'text-amber-600' : turbiditySeverity === 'clear' ? 'text-green-600' : 'text-slate-400'}`}>
                        {turbiditySeverity === 'unknown' ? '?' : turbVal?.toFixed(1)} FNU
                      </div>
                      <div className="text-slate-500">Turbidity</div>
                      <div className={`text-[9px] font-medium ${turbiditySeverity === 'impaired' ? 'text-red-600' : turbiditySeverity === 'elevated' ? 'text-amber-600' : 'text-green-600'}`}>
                        {turbiditySeverity !== 'unknown' ? (turbiditySeverity === 'clear' ? 'ok' : turbiditySeverity) : 'no data'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`font-bold ${nutrientSeverity === 'excessive' ? 'text-red-700' : nutrientSeverity === 'elevated' ? 'text-amber-600' : nutrientSeverity === 'normal' ? 'text-green-600' : 'text-slate-400'}`}>
                        {nutrientSeverity === 'unknown' ? '?' : `TN ${tnVal?.toFixed(1) ?? '?'}`}
                      </div>
                      <div className="text-slate-500">Nutrients</div>
                      <div className={`text-[9px] font-medium ${nutrientSeverity === 'excessive' ? 'text-red-600' : nutrientSeverity === 'elevated' ? 'text-amber-600' : 'text-green-600'}`}>
                        {nutrientSeverity !== 'unknown' ? nutrientSeverity : 'no data'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-slate-700">{attainsCategory || '?'}</div>
                      <div className="text-slate-500">ATTAINS</div>
                      <div className={`text-[9px] font-medium ${isCat5 ? 'text-red-600' : isImpaired ? 'text-amber-600' : 'text-green-600'}`}>
                        {tmdlStatus === 'needed' ? 'no TMDL' : tmdlStatus === 'completed' ? 'has TMDL' : tmdlStatus}
                      </div>
                    </div>
                  </div>
                  {/* Severity bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                    <div className={`h-2 rounded-full transition-all ${siteSeverityScore >= 75 ? 'bg-red-500' : siteSeverityScore >= 50 ? 'bg-amber-500' : siteSeverityScore >= 25 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, siteSeverityScore)}%` }} />
                  </div>
                  <div className="text-[9px] text-slate-400">Composite: DO (25%) + Bloom/Nutrients (25%) + Turbidity (15%) + Impairment (20%) + Monitoring Gap (15%) | Thresholds: {thresholdSource}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Situation */}
                  <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Situation</div>
                    <div className="space-y-1 text-xs text-slate-700 leading-relaxed">
                      <div><span className="font-semibold">{regionName}</span> is {isCat5 ? 'Category 5 impaired' : attainsCategory.includes('4') ? 'Category 4 impaired' : isImpaired ? 'impaired' : 'under monitoring'}{attainsCauses.length > 0 ? ` for ${attainsCauses.slice(0, 2).join(' and ').toLowerCase()}` : ''}.</div>
                      {dataAgeDays !== null && <div>Most recent data is <span className="font-semibold">{dataAgeDays} days old</span>. Confidence is <span className={`font-semibold ${dataConfidence === 'low' ? 'text-red-600' : dataConfidence === 'moderate' ? 'text-amber-600' : 'text-green-600'}`}>{dataConfidence}</span>.</div>}
                      <div>{tmdlStatus === 'needed' ? 'No approved TMDL is in place.' : tmdlStatus === 'completed' ? 'An approved TMDL exists.' : tmdlStatus === 'alternative' ? 'Alternative controls are in place.' : 'TMDL status is not applicable.'}</div>
                    </div>
                  </div>

                  {/* Treatment Priorities */}
                  <div className="rounded-md bg-red-50 border border-red-200 p-3">
                    <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1.5">Treatment Priorities</div>
                    <div className="space-y-1 text-xs text-red-800 leading-relaxed">
                      {treatmentPriorities.length > 0 ? treatmentPriorities.slice(0, 3).map((tp, i) => (
                        <div key={i} className="flex items-start gap-1">
                          <span className={`flex-shrink-0 font-bold ${tp.urgency === 'immediate' ? 'text-red-700' : tp.urgency === 'high' ? 'text-amber-700' : 'text-yellow-700'}`}>
                            {tp.urgency === 'immediate' ? '!!!' : tp.urgency === 'high' ? '!!' : '!'}
                          </span>
                          <span>{tp.driver}</span>
                        </div>
                      )) : (
                        <>
                          {isImpaired && <div>Regulatory exposure under CWA 303(d) and MS4 permits.</div>}
                          {(dataAgeDays === null || dataAgeDays > 60) && <div>High uncertainty due to monitoring gaps.</div>}
                          {!isImpaired && <div>Preventive action recommended to maintain water quality.</div>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Plan */}
                  <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                    <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1.5">Plan</div>
                    <div className="space-y-1 text-xs text-blue-800 leading-relaxed">
                      <div>Layered approach:</div>
                      <div className="pl-2 space-y-0.5 text-[11px]">
                        <div>→ Upstream BMPs and source control</div>
                        <div>→ Nature-based restoration for long-term recovery</div>
                        <div>→ Community programs for compliance and stewardship</div>
                        <div>→ <span className="font-semibold">PEARL for immediate treatment and real-time verification</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Why PEARL First */}
                  <div className="rounded-md bg-cyan-50 border-2 border-cyan-300 p-3">
                    <div className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider mb-1.5">Why PEARL First</div>
                    <div className="space-y-1.5 text-xs text-cyan-900 leading-relaxed">
                      {dataAgeDays !== null && dataAgeDays > 30 && (
                        <div><span className="font-semibold text-red-700">Data is {dataAgeDays} days old.</span> PEARL restores continuous, compliance-grade monitoring.</div>
                      )}
                      {treatmentPriorities.length > 0 && treatmentPriorities[0].urgency === 'immediate' && (
                        <div><span className="font-semibold text-red-700">{treatmentPriorities[0].driver.charAt(0).toUpperCase() + treatmentPriorities[0].driver.slice(1).split('(')[0].trim()}.</span> PEARL provides immediate treatment.</div>
                      )}
                      {treatmentPriorities.length > 0 && treatmentPriorities[0].urgency !== 'immediate' && (
                        <div><span className="font-semibold">{hasBacteria ? 'Pathogen risk is elevated' : hasNutrients ? 'Nutrient loading is degrading habitat' : hasSediment ? 'Sediment is impairing aquatic life' : 'Conditions are deteriorating'}.</span> PEARL begins treatment immediately.</div>
                      )}
                      <div><span className="font-semibold">Long-term restoration takes years.</span> PEARL delivers measurable results in weeks.</div>
                    </div>
                  </div>
                </div>

                {/* Action line */}
                <div className="rounded-md bg-cyan-700 text-white px-4 py-2.5">
                  <div className="text-xs font-semibold">
                    Recommended next step: Deploy {isPhasedDeployment ? `Phase 1 (${phase1Units} unit${phase1Units > 1 ? 's' : ''}, ${phase1GPM} GPM)` : `${totalUnits} PEARL unit${totalUnits > 1 ? 's' : ''}`} at {regionName} and begin continuous monitoring within 30 days.
                  </div>
                  <div className="text-[10px] text-cyan-200 mt-1">
                    Typical deployment: 30-60 days. Pilot generates continuous data and measurable reductions within the first operating cycle.
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ═══ PEARL — IMMEDIATE IMPACT LAYER (elevated, shown first) ═══ */}
          {(() => {
            const pearlCat = categories.find(c => c.id === 'pearl');
            if (!pearlCat) return null;
            const warranted = pearlCat.modules.filter(m => m.status === 'warranted');
            const accelerators = pearlCat.modules.filter(m => m.status === 'accelerator');
            const coBenefits = pearlCat.modules.filter(m => m.status === 'co-benefit');

            return (
              <div className="rounded-lg border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 to-blue-50 p-3 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-cyan-900 uppercase tracking-wide flex items-center gap-2">
                    ⚡ Fastest Path to Measurable Results
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px]">
                    {warranted.length > 0 && <span className="bg-red-200 text-red-800 font-bold px-1.5 py-0.5 rounded-full">{warranted.length} warranted</span>}
                    <span className="bg-cyan-200 text-cyan-800 font-bold px-1.5 py-0.5 rounded-full">{totalQuads}Q / {totalUnits} units / {fullGPM} GPM</span>
                  </div>
                </div>

                {/* Why PEARL here — dynamic evidence box */}
                <div className="rounded-md border border-cyan-300 bg-white p-3 space-y-2">
                  <div className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider">Why PEARL at this site</div>
                  <div className="space-y-1.5">
                    {whyBullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-sm flex-shrink-0 mt-0.5">{b.icon}</span>
                        <div className="text-[11px] leading-relaxed">
                          <span className="text-red-700 font-medium">{b.problem}.</span>{' '}
                          <span className="text-cyan-800">→ {b.solution}.</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PEARL modules */}
                <div className="space-y-1">
                  {[...warranted, ...accelerators].map((t) => (
                    <div key={t.id} className={`rounded-md border p-2 ${t.color}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-sm flex-shrink-0">{t.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{t.label}</span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                              t.status === 'warranted' ? 'bg-red-200 text-red-800' : 'bg-cyan-200 text-cyan-800'
                            }`}>{t.status === 'warranted' ? 'WARRANTED' : 'PEARL'}</span>
                          </div>
                          <div className="text-[10px] mt-0.5 leading-relaxed opacity-90">{t.detail}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {coBenefits.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {coBenefits.map((t) => (
                        <span key={t.id} className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-white/70 border border-slate-200 rounded px-2 py-1" title={t.detail}>
                          {t.icon} {t.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* System config + sizing */}
                <div className="rounded-md bg-white border border-cyan-200 p-3 space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Configuration</div>
                      <div className="text-sm font-bold text-cyan-800">{pearlModel}</div>
                      <div className="text-[10px] text-slate-500">{waterType === 'brackish' ? 'Oyster' : 'Mussel'} Biofilt{pearlMods.some(t => t.id.startsWith('pearl-resin')) ? ' + Resin' : ''}{pearlMods.some(t => t.id === 'pearl-uv') ? ' + UV' : ''}{pearlMods.some(t => t.id === 'pearl-gac') ? ' + GAC' : ''}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Full Build Target</div>
                      <div className="text-sm font-bold text-cyan-800">{totalQuads} quad{totalQuads > 1 ? 's' : ''} ({totalUnits} units)</div>
                      <div className="text-[10px] text-slate-500">{fullGPM} GPM total capacity</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Full Build Annual</div>
                      <div className="text-sm font-bold text-cyan-800">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(fullAnnualCost)}/yr</div>
                      <div className="text-[10px] text-slate-500">$200K/unit/yr</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Sizing Basis</div>
                      <div className={`text-xs font-semibold ${siteSeverityScore >= 75 ? 'text-red-700' : siteSeverityScore >= 50 ? 'text-amber-700' : 'text-slate-700'}`}>Severity {prelimSeverity}/100</div>
                      <div className="text-[10px] text-slate-500">{sizingBasis}</div>
                    </div>
                  </div>
                </div>

                {/* ═══ DEPLOYMENT ROADMAP ═══ */}
                {isPhasedDeployment && (() => {
                  // Each quad targets a ranked critical zone. Every PEARL unit treats AND monitors.
                  // Monitoring continuity & verification is universal -- not unique to any single phase.
                  type PhaseInfo = { phase: string; quads: number; units: number; gpm: number; cost: number; mission: string; placement: string; why: string; trigger: string; color: string; bgColor: string };
                  const phases: PhaseInfo[] = [];
                  const hasMonitoringGap = dataAgeDays === null || dataAgeDays > 365;
                  const monitoringNote = hasMonitoringGap
                    ? `+ Monitoring continuity & verification (restores data record lost for ${dataAgeDays !== null ? Math.round(dataAgeDays / 365) + '+ year' + (Math.round(dataAgeDays / 365) > 1 ? 's' : '') : 'an extended period'})`
                    : '+ Continuous monitoring, compliance-grade data & treatment verification';

                  // ── PHASE 1: #1 most critical zone ──
                  const p1Mission = (hasNutrients || bloomSeverity !== 'normal')
                    ? 'Primary Nutrient Interception'
                    : hasBacteria ? 'Primary Pathogen Treatment'
                    : hasSediment ? 'Primary Sediment Capture'
                    : 'Primary Treatment & Monitoring';

                  const p1Placement = (hasNutrients || bloomSeverity !== 'normal')
                    ? '#1 critical zone: Highest-load tributary confluence -- intercept nutrient and sediment loading at the dominant inflow before it reaches the receiving waterbody'
                    : hasBacteria ? '#1 critical zone: Highest-volume discharge point -- treat pathogen loading at the primary outfall or CSO'
                    : hasSediment ? '#1 critical zone: Primary tributary mouth -- capture suspended solids at the highest-load inflow'
                    : '#1 critical zone: Highest-priority inflow -- treat and monitor at the most impacted location';

                  const p1Why = bloomSeverity !== 'normal' && bloomSeverity !== 'unknown'
                    ? `Chlorophyll at ${chlVal} ug/L confirms active bloom cycle. #1 priority -- intercept nutrients at the dominant source before they drive downstream eutrophication. ${monitoringNote}.`
                    : hasNutrients ? `ATTAINS lists nutrient impairment. #1 priority: treat the primary urban watershed inflow. ${monitoringNote}.`
                    : hasBacteria ? `Bacteria exceeds recreational standards. #1 priority: treat at highest-volume discharge. ${monitoringNote}.`
                    : hasSediment ? `Turbidity at ${turbVal?.toFixed(1) ?? '?'} FNU. #1 priority: capture sediment at the dominant tributary. ${monitoringNote}.`
                    : `#1 priority treatment zone. ${monitoringNote}.`;

                  phases.push({
                    phase: 'Phase 1', quads: phase1Quads, units: phase1Units, gpm: phase1GPM,
                    cost: phase1AnnualCost,
                    mission: p1Mission, placement: p1Placement, why: p1Why,
                    trigger: 'Immediate -- deploy within 30 days of site assessment',
                    color: 'border-cyan-400 text-cyan-900', bgColor: 'bg-cyan-50',
                  });

                  // ── PHASE 2: #2 most critical zone ──
                  if (totalQuads >= 2) {
                    const p2Quads = totalQuads === 2 ? (totalQuads - phase1Quads) : 1;
                    const p2Units = p2Quads * 4;

                    const p2Mission = (hasSediment || turbiditySeverity !== 'clear')
                      ? 'Secondary Outfall Treatment'
                      : (hasNutrients || bloomSeverity !== 'normal') ? 'Secondary Nutrient Treatment'
                      : hasBacteria ? 'Secondary Source Treatment'
                      : 'Secondary Zone Treatment';

                    const p2Placement = waterType === 'brackish'
                      ? (hasSediment || turbiditySeverity !== 'clear'
                        ? '#2 critical zone: MS4 outfall cluster along shoreline -- treat stormwater discharge from adjacent subwatersheds where multiple outfalls concentrate pollutant loading'
                        : '#2 critical zone: Embayment or low-circulation area -- treat where longest water residence time allows bloom development and DO depletion')
                      : (hasSediment || turbiditySeverity !== 'clear'
                        ? '#2 critical zone: Secondary tributary or stormwater outfall cluster -- capture additional loading from adjacent drainage area'
                        : '#2 critical zone: Secondary inflow or pooling area -- treat where nutrient accumulation drives worst conditions');

                    const p2Why = turbiditySeverity !== 'clear' && turbiditySeverity !== 'unknown'
                      ? `Turbidity at ${turbVal?.toFixed(1)} FNU indicates sediment loading from multiple sources. Phase 1 intercepts the primary tributary; Phase 2 treats the next-highest loading zone. ${monitoringNote}.`
                      : hasNutrients && (bloomSeverity !== 'normal')
                      ? `Bloom conditions persist beyond the primary inflow. Phase 2 treats the #2 nutrient loading zone. ${monitoringNote}.`
                      : attainsCauses.length >= 3
                      ? `${attainsCauses.length} impairment causes indicate multiple pollution sources. Phase 2 addresses the #2 priority loading pathway. ${monitoringNote}.`
                      : `Phase 1 data identifies the second-highest treatment priority. ${monitoringNote}.`;

                    phases.push({
                      phase: 'Phase 2', quads: p2Quads, units: p2Units, gpm: p2Units * 50,
                      cost: p2Units * COST_PER_UNIT_YEAR,
                      mission: p2Mission, placement: p2Placement, why: p2Why,
                      trigger: 'After 90 days -- Phase 1 data confirms #2 priority zone and optimal placement',
                      color: 'border-blue-300 text-blue-900', bgColor: 'bg-blue-50',
                    });
                  }

                  // ── PHASE 3: #3 most critical zone ──
                  if (totalQuads >= 3) {
                    const remainQuads = totalQuads - phase1Quads - (totalQuads === 2 ? totalQuads - phase1Quads : 1);
                    const remainUnits = remainQuads * 4;
                    if (remainQuads > 0) {
                      const p3Mission = waterType === 'brackish'
                        ? (hasBacteria ? 'Tertiary Outfall Treatment' : 'Tertiary Zone Treatment')
                        : 'Tertiary Zone Treatment';

                      const p3Placement = waterType === 'brackish'
                        ? (hasBacteria
                          ? '#3 critical zone: Remaining outfall cluster or CSO discharge -- treat pathogen and nutrient loading from the third-highest contributing subwatershed along the tidal corridor'
                          : hasNutrients || bloomSeverity !== 'normal'
                          ? '#3 critical zone: Remaining tributary or embayment -- treat nutrient loading from the third-highest contributing inflow, capturing pollutants that Phases 1+2 cannot reach'
                          : '#3 critical zone: Third-highest loading area along the shoreline -- extend treatment coverage to remaining untreated outfall discharge')
                        : (hasNutrients
                          ? '#3 critical zone: Tertiary inflow or accumulation point -- treat remaining nutrient loading from the third-highest contributing drainage area'
                          : '#3 critical zone: Remaining untreated inflow -- extend treatment coverage to the third-highest loading area in the watershed');

                      const p3Why = attainsCauses.length >= 3
                        ? `${attainsCauses.length} documented impairment causes require treatment across multiple zones. Phases 1+2 address the two highest-load sources. Phase 3 extends to the #3 priority zone -- ${totalUnits} total units providing ${fullGPM} GPM treatment capacity across all major loading points. ${monitoringNote}.`
                        : `Phase 3 extends treatment to the third-highest loading zone identified by Phases 1+2 data. Full ${totalQuads}-quad deployment ensures coverage across all major pollution sources -- ${totalUnits} units, ${fullGPM} GPM total capacity. ${monitoringNote}.`;

                      phases.push({
                        phase: totalQuads > 3 ? `Phase 3 (${remainQuads}Q)` : 'Phase 3', quads: remainQuads, units: remainUnits, gpm: remainUnits * 50,
                        cost: remainUnits * COST_PER_UNIT_YEAR,
                        mission: p3Mission, placement: p3Placement, why: p3Why,
                        trigger: 'After 180 days -- Phase 1+2 data identifies #3 priority zone and confirms full-build need',
                        color: 'border-indigo-300 text-indigo-900', bgColor: 'bg-indigo-50',
                      });
                    }
                  }

                  return (
                    <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Deployment Roadmap -- Path to {totalQuads} Quads ({totalUnits} Units)</div>

                      <div className="space-y-2">
                        {phases.map((p, i) => (
                          <div key={i} className={`rounded-md border-2 ${p.color} ${p.bgColor} p-2.5`}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${i === 0 ? 'bg-cyan-700 text-white' : i === 1 ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'}`}>
                                  {p.phase}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{p.mission}</span>
                              </div>
                              <span className="text-xs font-bold">{p.quads} quad{p.quads > 1 ? 's' : ''} ({p.units}U, {p.gpm} GPM) -- {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p.cost)}/yr</span>
                            </div>
                            <div className="text-[11px] leading-relaxed">
                              <span className="font-semibold">Placement:</span> {p.placement}
                            </div>
                            <div className="text-[11px] leading-relaxed mt-1">
                              <span className="font-semibold">Justification:</span> {p.why}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              <span className="font-medium">Trigger:</span> {p.trigger}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Running total bar */}
                      <div className="flex items-center gap-2 pt-1">
                        {phases.map((p, i) => (
                          <div key={i} className={`flex-1 h-2 rounded-full ${i === 0 ? 'bg-cyan-500' : i === 1 ? 'bg-blue-500' : 'bg-indigo-500'}`} title={`${p.phase}: ${p.units} units`} />
                        ))}
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>Day 1</span>
                        <span>90 days</span>
                        {phases.length > 2 && <span>180 days</span>}
                        <span>Full build: {totalUnits} units, {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(fullAnnualCost)}/yr</span>
                      </div>
                    </div>
                  );
                })()}

                {/* CTAs */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const subject = encodeURIComponent(`PEARL Pilot Deployment Request — ${regionName}, ${stateAbbr}`);
                      const body = encodeURIComponent(
                        `PEARL Pilot Deployment Request\n` +
                        `${'='.repeat(40)}\n\n` +
                        `Site: ${regionName}\n` +
                        `State: ${STATE_ABBR_TO_NAME[stateAbbr] || stateAbbr}\n` +
                        `Site Severity: ${siteSeverityLabel} (${siteSeverityScore}/100)\n` +
                        `EPA Category: ${attainsCategory || 'N/A'}\n` +
                        `Impairment Causes: ${attainsCauses.join(', ') || 'N/A'}\n` +
                        `TMDL Status: ${tmdlStatus === 'needed' ? 'Needed — not established' : tmdlStatus === 'completed' ? 'Approved' : tmdlStatus === 'alternative' ? 'Alternative controls' : 'N/A'}\n` +
                        `Recommended Config: ${pearlModel} (${waterType === 'brackish' ? 'Oyster' : 'Mussel'} Biofiltration)\n` +
                        `Deployment: ${totalQuads} quad${totalQuads > 1 ? 's' : ''} (${totalUnits} units, ${fullGPM} GPM)${isPhasedDeployment ? `\nPhase 1: ${phase1Quads} quad${phase1Quads > 1 ? 's' : ''} (${phase1Units} units, ${phase1GPM} GPM)` : ''}\n` +
                        `Estimated Annual Cost: $${fullAnnualCost.toLocaleString()}${isPhasedDeployment ? ` (Phase 1: $${phase1AnnualCost.toLocaleString()}/yr)` : '/yr'}\n` +
                        `Sizing Basis: ${sizingBasis}\n` +
                        `Compliance Pathway: ${compliancePathway}\n\n` +
                        `Requesting organization: \n` +
                        `Contact name: \n` +
                        `Contact email: \n` +
                        `Preferred timeline: \n` +
                        `Additional notes: \n`
                      );
                      window.open(`mailto:info@project-pearl.org?subject=${subject}&body=${body}`, '_blank');
                    }}
                    className="flex-1 min-w-[140px] bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm"
                  >
                    🚀 Deploy PEARL Pilot Here
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const pdf = new BrandedPDFGenerator('portrait');
                        await pdf.loadLogo();
                        pdf.initialize();

                        // Sanitize text for jsPDF (no emoji, no extended unicode)
                        const clean = (s: string) => s
                          .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')  // emoji block 1
                          .replace(/[\u{2600}-\u{27BF}]/gu, '')    // misc symbols
                          .replace(/[\u{FE00}-\u{FE0F}]/gu, '')    // variation selectors
                          .replace(/[\u{200D}]/gu, '')             // zero-width joiner
                          .replace(/[\u{E0020}-\u{E007F}]/gu, '')  // tags
                          .replace(/\u00B5/g, 'u')                 // micro sign
                          .replace(/\u03BC/g, 'u')                 // greek mu
                          .replace(/\u2192/g, '->')                // right arrow
                          .replace(/\u2190/g, '<-')                // left arrow
                          .replace(/\u2014/g, '--')                // em dash
                          .replace(/\u2013/g, '-')                 // en dash
                          .replace(/\u00A7/g, 'Section ')          // section sign
                          .replace(/\u2022/g, '-')                 // bullet
                          .replace(/\u00B0/g, ' deg')              // degree
                          .replace(/\u2019/g, "'")                 // right single quote
                          .replace(/\u2018/g, "'")                 // left single quote
                          .replace(/\u201C/g, '"')                 // left double quote
                          .replace(/\u201D/g, '"')                 // right double quote
                          .replace(/[^\x00-\x7F]/g, '')           // strip any remaining non-ASCII
                          .replace(/\s+/g, ' ')                    // collapse whitespace
                          .trim();

                        // Category title map (emoji-free)
                        const catTitleMap: Record<string, string> = {
                          source: 'SOURCE CONTROL -- Upstream BMPs',
                          nature: 'NATURE-BASED SOLUTIONS',
                          pearl: 'PEARL -- Treatment Accelerator',
                          community: 'COMMUNITY ENGAGEMENT & STEWARDSHIP',
                          regulatory: 'REGULATORY & PLANNING',
                        };

                        // Title
                        pdf.addTitle('PEARL Deployment Plan');
                        pdf.addText(clean(`${regionName}, ${STATE_ABBR_TO_NAME[stateAbbr] || stateAbbr}`), { bold: true, fontSize: 12 });
                        pdf.addText(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { fontSize: 9 });
                        pdf.addSpacer(5);

                        // Executive Summary
                        pdf.addSubtitle('Executive Summary');
                        pdf.addDivider();

                        pdf.addText(`SITE SEVERITY: ${siteSeverityLabel} (${siteSeverityScore}/100)`, { bold: true });
                        pdf.addText(clean(`Assessment based on ${thresholdSource}: DO (${doSeverity}), Bloom/Nutrients (${bloomSeverity !== 'unknown' ? bloomSeverity : nutrientSeverity}), Turbidity (${turbiditySeverity}), Impairment (${attainsCategory || 'N/A'}).`), { indent: 5, fontSize: 9 });
                        pdf.addSpacer(3);

                        pdf.addText('SITUATION', { bold: true });
                        pdf.addText(clean(`${regionName} is ${isCat5 ? 'Category 5 impaired' : attainsCategory.includes('4') ? 'Category 4 impaired' : isImpaired ? 'impaired' : 'under monitoring'}${attainsCauses.length > 0 ? ` for ${attainsCauses.slice(0, 3).join(', ').toLowerCase()}` : ''}.`), { indent: 5 });
                        if (dataAgeDays !== null) pdf.addText(clean(`Most recent data is ${dataAgeDays} days old. Confidence: ${dataAgeDays > 90 ? 'LOW' : dataAgeDays > 30 ? 'MODERATE' : 'HIGH'}.`), { indent: 5 });
                        pdf.addText(clean(`TMDL Status: ${tmdlStatus === 'needed' ? 'No approved TMDL in place' : tmdlStatus === 'completed' ? 'Approved TMDL exists' : tmdlStatus === 'alternative' ? 'Alternative controls in place' : 'Not applicable'}.`), { indent: 5 });
                        pdf.addSpacer(3);

                        pdf.addText('TREATMENT PRIORITIES', { bold: true });
                        if (treatmentPriorities.length > 0) {
                          for (const tp of treatmentPriorities.slice(0, 4)) {
                            pdf.addText(clean(`- [${tp.urgency.toUpperCase()}] ${tp.driver}`), { indent: 5 });
                            pdf.addText(clean(`  -> ${tp.action}`), { indent: 10, fontSize: 9 });
                          }
                        } else {
                          if (hasBacteria) pdf.addText('- Ongoing public health risk from pathogens.', { indent: 5 });
                          if (hasNutrients) pdf.addText('- Eutrophication risk from nutrient loading.', { indent: 5 });
                          if (isImpaired) pdf.addText('- Regulatory exposure under CWA Section 303(d) and MS4 permits.', { indent: 5 });
                          if (dataAgeDays === null || dataAgeDays > 60) pdf.addText('- High uncertainty due to monitoring gaps.', { indent: 5 });
                        }
                        pdf.addSpacer(3);

                        pdf.addText('RECOMMENDED ACTION', { bold: true });
                        pdf.addText(clean(`Deploy ${isPhasedDeployment ? `Phase 1 (${phase1Quads} quad${phase1Quads > 1 ? 's' : ''}, ${phase1Units} unit${phase1Units > 1 ? 's' : ''}, ${phase1GPM} GPM)` : `${totalUnits} PEARL unit${totalUnits > 1 ? 's' : ''}`} at ${regionName} and begin continuous monitoring within 30 days.`), { indent: 5, bold: true });
                        pdf.addText('Typical deployment: 30-60 days. Pilot generates continuous data and measurable reductions within the first operating cycle.', { indent: 5, fontSize: 9 });
                        pdf.addSpacer(5);

                        // Site Profile
                        pdf.addSubtitle('Site Profile');
                        pdf.addDivider();
                        pdf.addTable(
                          ['Attribute', 'Value'],
                          [
                            ['Waterbody', clean(regionName)],
                            ['State', STATE_ABBR_TO_NAME[stateAbbr] || stateAbbr],
                            ['Water Type', waterType === 'brackish' ? 'Brackish / Estuarine' : 'Freshwater'],
                            ['Site Severity', `${siteSeverityLabel} (${siteSeverityScore}/100)`],
                            ['EPA IR Category', attainsCategory || 'Not assessed'],
                            ['Impairment Causes', clean(attainsCauses.join(', ')) || 'None listed'],
                            ['TMDL Status', tmdlStatus === 'needed' ? 'Needed -- not established' : tmdlStatus === 'completed' ? 'Approved' : tmdlStatus === 'alternative' ? 'Alternative controls' : 'N/A'],
                            ['Compliance Pathway', clean(compliancePathway)],
                            ['Data Age', dataAgeDays !== null ? `${dataAgeDays} days` : 'Unknown'],
                            ['Waterbody Size', `~${estimatedAcres} acres (${acresSource})`],
                            ['DO Status', `${doSeverity !== 'unknown' ? `${doVal?.toFixed(1)} mg/L (${doSeverity})` : 'No data'}`],
                            ['Bloom Status', `${bloomSeverity !== 'unknown' ? `${chlVal} ug/L (${bloomSeverity})` : nutrientSeverity !== 'unknown' ? `Nutrients: ${nutrientSeverity}` : 'No data'}`],
                            ['Turbidity Status', `${turbiditySeverity !== 'unknown' ? `${turbVal?.toFixed(1)} FNU (${turbiditySeverity})` : 'No data'}`],
                          ],
                          [55, 115]
                        );
                        pdf.addSpacer(3);

                        // Live Parameters
                        const paramKeys = Object.keys(params);
                        if (paramKeys.length > 0) {
                          pdf.addSubtitle('Current Water Quality Parameters');
                          pdf.addDivider();
                          const paramRows = paramKeys.map(key => {
                            const p = params[key];
                            const val = p.value < 0.01 && p.value > 0 ? p.value.toFixed(3) : p.value < 1 ? p.value.toFixed(2) : p.value < 100 ? p.value.toFixed(1) : Math.round(p.value).toLocaleString();
                            return [
                              key,
                              clean(`${val} ${p.unit || ''}`),
                              p.source || '',
                              p.lastSampled ? new Date(p.lastSampled).toLocaleDateString() : 'N/A',
                            ];
                          });
                          pdf.addTable(['Parameter', 'Value', 'Source', 'Last Sampled'], paramRows, [40, 45, 35, 50]);
                          pdf.addSpacer(3);
                        }

                        // Why PEARL at this site
                        pdf.addSubtitle('Why PEARL at This Site');
                        pdf.addDivider();
                        for (const b of whyBullets) {
                          pdf.addText(clean(`- ${b.problem}`), { indent: 5, bold: true });
                          pdf.addText(clean(`  -> ${b.solution}.`), { indent: 10 });
                        }
                        pdf.addSpacer(3);

                        // PEARL Configuration
                        pdf.addSubtitle(`PEARL Configuration: ${pearlModel}`);
                        pdf.addDivider();
                        pdf.addText(`System Type: ${waterType === 'brackish' ? 'Oyster (C. virginica)' : 'Freshwater Mussel'} Biofiltration`, { indent: 5 });
                        const pearlCatMods = categories.find(c => c.id === 'pearl');
                        if (pearlCatMods) {
                          const modRows = pearlCatMods.modules
                            .filter(m => m.status !== 'co-benefit')
                            .map(m => [clean(m.label), m.status.toUpperCase(), clean(m.detail)]);
                          pdf.addTable(['Module', 'Status', 'Detail'], modRows, [50, 25, 95]);
                        }
                        pdf.addSpacer(3);

                        // Deployment Sizing & Cost
                        pdf.addSubtitle('Deployment Sizing & Cost Estimate');
                        pdf.addDivider();
                        pdf.addTable(
                          ['Metric', 'Value'],
                          [
                            ['Sizing Method', 'Severity-driven treatment need assessment'],
                            ['Site Severity Score', `${prelimSeverity}/100 (${siteSeverityLabel})`],
                            ['Unit Capacity', '50 GPM per PEARL unit (4 units per quad)'],
                            ['Waterbody Size', `~${estimatedAcres} acres (${acresSource})`],
                            ['Deployment Size', `${totalQuads} quad${totalQuads > 1 ? 's' : ''} (${totalUnits} units, ${fullGPM} GPM)`],
                            ...(isPhasedDeployment ? [
                              ['Phase 1', `${phase1Quads} quad${phase1Quads > 1 ? 's' : ''} (${phase1Units} units, ${phase1GPM} GPM)`],
                              ['Phase 1 Annual Cost', `$${phase1AnnualCost.toLocaleString()}/yr`],
                              ['Full Build Annual Cost', `$${fullAnnualCost.toLocaleString()}/yr`],
                            ] : [
                              ['Annual Cost', `$${fullAnnualCost.toLocaleString()}/yr ($200,000/unit)`],
                            ]),
                            ['Sizing Basis', clean(sizingBasis)],
                          ],
                          [55, 115]
                        );
                        pdf.addSpacer(2);
                        pdf.addText('SIZING METHODOLOGY (v2)', { bold: true, fontSize: 9 });
                        pdf.addText(clean(`Site severity score derived from ${thresholdSource}. Thresholds: DO criteria (${doStressed} mg/L avg, ${doCritical} mg/L min), chlorophyll bloom thresholds (${chlBloom}/${chlSignificant}/${chlSevere} ug/L), turbidity ${isMD ? 'SAV' : 'habitat'} threshold (${turbElevated} FNU), and EPA ATTAINS impairment category. Composite score weighted: DO 25%, Bloom/Nutrients 25%, Turbidity 15%, Impairment 20%, Monitoring Gap 15%. Severity floor: impaired + >1yr data gap = minimum DEGRADED; Cat 5 + >180d gap = near-CRITICAL. CRITICAL (>=75): 3 quads. DEGRADED (>=50): 2 quads. STRESSED (>=25): 1 quad. Large waterbodies (>500 acres) add scale modifier.`), { indent: 5, fontSize: 8 });
                        if (isPhasedDeployment) {
                          pdf.addText(clean(`Phased deployment recommended. Deploy Phase 1 (${phase1Quads} quad${phase1Quads > 1 ? 's' : ''}, ${phase1Units} units) at highest-priority inflow zone(s), then scale to full ${totalQuads}-quad build based on 90 days of monitoring data.`), { indent: 5, fontSize: 9 });
                        }
                        pdf.addSpacer(3);

                        // Phased Deployment Roadmap (matches card detail)
                        if (isPhasedDeployment) {
                          pdf.addSubtitle('Phased Deployment Roadmap');
                          pdf.addDivider();

                          const pdfHasMonitoringGap = dataAgeDays === null || dataAgeDays > 365;
                          const pdfMonitoringNote = pdfHasMonitoringGap
                            ? `+ Monitoring continuity & verification (restores data record lost for ${dataAgeDays !== null ? Math.round(dataAgeDays / 365) + '+ year' + (Math.round(dataAgeDays / 365) > 1 ? 's' : '') : 'an extended period'})`
                            : '+ Continuous monitoring, compliance-grade data & treatment verification';

                          // Phase 1
                          const pdfP1Mission = (hasNutrients || bloomSeverity !== 'normal')
                            ? 'Primary Nutrient Interception'
                            : hasBacteria ? 'Primary Pathogen Treatment'
                            : hasSediment ? 'Primary Sediment Capture'
                            : 'Primary Treatment & Monitoring';
                          const pdfP1Placement = (hasNutrients || bloomSeverity !== 'normal')
                            ? '#1 critical zone: Highest-load tributary confluence -- intercept nutrient and sediment loading at the dominant inflow before it reaches the receiving waterbody'
                            : hasBacteria ? '#1 critical zone: Highest-volume discharge point -- treat pathogen loading at the primary outfall or CSO'
                            : hasSediment ? '#1 critical zone: Primary tributary mouth -- capture suspended solids at the highest-load inflow'
                            : '#1 critical zone: Highest-priority inflow -- treat and monitor at the most impacted location';
                          const pdfP1Why = bloomSeverity !== 'normal' && bloomSeverity !== 'unknown'
                            ? `Chlorophyll at ${chlVal} ug/L confirms active bloom cycle. #1 priority -- intercept nutrients at the dominant source before they drive downstream eutrophication. ${pdfMonitoringNote}.`
                            : hasNutrients ? `ATTAINS lists nutrient impairment. #1 priority: treat the primary urban watershed inflow. ${pdfMonitoringNote}.`
                            : hasBacteria ? `Bacteria exceeds recreational standards. #1 priority: treat at highest-volume discharge. ${pdfMonitoringNote}.`
                            : hasSediment ? `Turbidity at ${turbVal?.toFixed(1) ?? '?'} FNU. #1 priority: capture sediment at the dominant tributary. ${pdfMonitoringNote}.`
                            : `#1 priority treatment zone. ${pdfMonitoringNote}.`;

                          pdf.addText(`PHASE 1: ${pdfP1Mission.toUpperCase()} -- ${phase1Quads} quad${phase1Quads > 1 ? 's' : ''} (${phase1Units} units, ${phase1GPM} GPM) -- $${phase1AnnualCost.toLocaleString()}/yr`, { bold: true, fontSize: 9 });
                          pdf.addText(clean(`Placement: ${pdfP1Placement}`), { indent: 5, fontSize: 9 });
                          pdf.addText(clean(`Justification: ${pdfP1Why}`), { indent: 5, fontSize: 8 });
                          pdf.addText('Trigger: Immediate -- deploy within 30 days of site assessment', { indent: 5, fontSize: 8 });
                          pdf.addSpacer(2);

                          // Phase 2
                          if (totalQuads >= 2) {
                            const pdfP2Quads = totalQuads === 2 ? (totalQuads - phase1Quads) : 1;
                            const pdfP2Units = pdfP2Quads * 4;
                            const pdfP2GPM = pdfP2Units * 50;
                            const pdfP2Cost = pdfP2Units * COST_PER_UNIT_YEAR;

                            const pdfP2Mission = (hasSediment || turbiditySeverity !== 'clear')
                              ? 'Secondary Outfall Treatment'
                              : (hasNutrients || bloomSeverity !== 'normal') ? 'Secondary Nutrient Treatment'
                              : hasBacteria ? 'Secondary Source Treatment'
                              : 'Secondary Zone Treatment';
                            const pdfP2Placement = waterType === 'brackish'
                              ? (hasSediment || turbiditySeverity !== 'clear'
                                ? '#2 critical zone: MS4 outfall cluster along shoreline -- treat stormwater discharge from adjacent subwatersheds where multiple outfalls concentrate pollutant loading'
                                : '#2 critical zone: Embayment or low-circulation area -- treat where longest water residence time allows bloom development and DO depletion')
                              : (hasSediment || turbiditySeverity !== 'clear'
                                ? '#2 critical zone: Secondary tributary or stormwater outfall cluster -- capture additional loading from adjacent drainage area'
                                : '#2 critical zone: Secondary inflow or pooling area -- treat where nutrient accumulation drives worst conditions');
                            const pdfP2Why = turbiditySeverity !== 'clear' && turbiditySeverity !== 'unknown'
                              ? `Turbidity at ${turbVal?.toFixed(1)} FNU indicates sediment loading from multiple sources. Phase 1 intercepts the primary tributary; Phase 2 treats the next-highest loading zone. ${pdfMonitoringNote}.`
                              : hasNutrients && (bloomSeverity !== 'normal')
                              ? `Bloom conditions persist beyond the primary inflow. Phase 2 treats the #2 nutrient loading zone. ${pdfMonitoringNote}.`
                              : attainsCauses.length >= 3
                              ? `${attainsCauses.length} impairment causes indicate multiple pollution sources. Phase 2 addresses the #2 priority loading pathway. ${pdfMonitoringNote}.`
                              : `Phase 1 data identifies the second-highest treatment priority. ${pdfMonitoringNote}.`;

                            pdf.addText(`PHASE 2: ${pdfP2Mission.toUpperCase()} -- ${pdfP2Quads} quad${pdfP2Quads > 1 ? 's' : ''} (${pdfP2Units} units, ${pdfP2GPM} GPM) -- $${pdfP2Cost.toLocaleString()}/yr`, { bold: true, fontSize: 9 });
                            pdf.addText(clean(`Placement: ${pdfP2Placement}`), { indent: 5, fontSize: 9 });
                            pdf.addText(clean(`Justification: ${pdfP2Why}`), { indent: 5, fontSize: 8 });
                            pdf.addText('Trigger: After 90 days -- Phase 1 data confirms #2 priority zone and optimal placement', { indent: 5, fontSize: 8 });
                            pdf.addSpacer(2);
                          }

                          // Phase 3
                          if (totalQuads >= 3) {
                            const pdfP3RemainQuads = totalQuads - phase1Quads - (totalQuads === 2 ? totalQuads - phase1Quads : 1);
                            const pdfP3Units = pdfP3RemainQuads * 4;
                            const pdfP3GPM = pdfP3Units * 50;
                            const pdfP3Cost = pdfP3Units * COST_PER_UNIT_YEAR;
                            if (pdfP3RemainQuads > 0) {
                              const pdfP3Mission = waterType === 'brackish'
                                ? (hasBacteria ? 'Tertiary Outfall Treatment' : 'Tertiary Zone Treatment')
                                : 'Tertiary Zone Treatment';
                              const pdfP3Placement = waterType === 'brackish'
                                ? (hasBacteria
                                  ? '#3 critical zone: Remaining outfall cluster or CSO discharge -- treat pathogen and nutrient loading from the third-highest contributing subwatershed along the tidal corridor'
                                  : hasNutrients || bloomSeverity !== 'normal'
                                  ? '#3 critical zone: Remaining tributary or embayment -- treat nutrient loading from the third-highest contributing inflow, capturing pollutants that Phases 1+2 cannot reach'
                                  : '#3 critical zone: Third-highest loading area along the shoreline -- extend treatment coverage to remaining untreated outfall discharge')
                                : (hasNutrients
                                  ? '#3 critical zone: Tertiary inflow or accumulation point -- treat remaining nutrient loading from the third-highest contributing drainage area'
                                  : '#3 critical zone: Remaining untreated inflow -- extend treatment coverage to the third-highest loading area in the watershed');
                              const pdfP3Why = attainsCauses.length >= 3
                                ? `${attainsCauses.length} documented impairment causes require treatment across multiple zones. Phases 1+2 address the two highest-load sources. Phase 3 extends to the #3 priority zone -- ${totalUnits} total units providing ${fullGPM} GPM treatment capacity across all major loading points. ${pdfMonitoringNote}.`
                                : `Phase 3 extends treatment to the third-highest loading zone identified by Phases 1+2 data. Full ${totalQuads}-quad deployment ensures coverage across all major pollution sources -- ${totalUnits} units, ${fullGPM} GPM total capacity. ${pdfMonitoringNote}.`;

                              const pdfP3Label = totalQuads > 3 ? `PHASE 3 (${pdfP3RemainQuads}Q)` : 'PHASE 3';
                              pdf.addText(`${pdfP3Label}: ${pdfP3Mission.toUpperCase()} -- ${pdfP3RemainQuads} quad${pdfP3RemainQuads > 1 ? 's' : ''} (${pdfP3Units} units, ${pdfP3GPM} GPM) -- $${pdfP3Cost.toLocaleString()}/yr`, { bold: true, fontSize: 9 });
                              pdf.addText(clean(`Placement: ${pdfP3Placement}`), { indent: 5, fontSize: 9 });
                              pdf.addText(clean(`Justification: ${pdfP3Why}`), { indent: 5, fontSize: 8 });
                              pdf.addText('Trigger: After 180 days -- Phase 1+2 data identifies #3 priority zone and confirms full-build need', { indent: 5, fontSize: 8 });
                              pdf.addSpacer(2);
                            }
                          }

                          pdf.addText(`FULL BUILD: ${totalQuads} quads (${totalUnits} units, ${fullGPM} GPM) -- $${fullAnnualCost.toLocaleString()}/yr`, { bold: true, fontSize: 9 });
                          pdf.addSpacer(3);
                        }

                        // Threat Assessment
                        pdf.addSubtitle('Threat Assessment');
                        pdf.addDivider();
                        pdf.addTable(
                          ['Threat', 'Level', 'Detail'],
                          threats.map(t => [t.label, t.level, clean(t.detail)]),
                          [35, 25, 110]
                        );
                        pdf.addSpacer(3);

                        // Full Restoration Plan
                        pdf.addSubtitle('Full Restoration Plan');
                        pdf.addDivider();
                        pdf.addText(`This plan combines ${totalBMPs} conventional BMPs and nature-based solutions with PEARL accelerated treatment.`);
                        pdf.addSpacer(3);

                        for (const cat of categories.filter(c => c.id !== 'pearl')) {
                          pdf.addText(catTitleMap[cat.id] || clean(cat.title), { bold: true });
                          const activeItems = cat.modules.filter(m => m.status === 'warranted' || m.status === 'recommended');
                          const coItems = cat.modules.filter(m => m.status === 'co-benefit');
                          for (const m of activeItems) {
                            pdf.addText(clean(`- [${m.status.toUpperCase()}] ${m.label} -- ${m.detail}`), { indent: 5, fontSize: 9 });
                          }
                          if (coItems.length > 0) {
                            pdf.addText(clean(`Co-benefits: ${coItems.map(m => m.label).join(', ')}`), { indent: 5, fontSize: 8 });
                          }
                          pdf.addSpacer(3);
                        }

                        // Next Steps
                        pdf.addSubtitle('Recommended Next Steps');
                        pdf.addDivider();
                        pdf.addText(clean(`1. Deploy ${isPhasedDeployment ? `Phase 1 (${phase1Quads} quad${phase1Quads > 1 ? 's' : ''}, ${phase1Units} PEARL units, ${phase1GPM} GPM) at highest-priority inflow zone${phase1Quads > 1 ? 's' : ''}` : `${totalUnits} PEARL unit${totalUnits > 1 ? 's' : ''}`} within 30 days.`), { indent: 5 });
                        pdf.addText('2. Begin continuous water quality monitoring (15-min intervals, telemetered).', { indent: 5 });
                        pdf.addText('3. Use 90-day baseline dataset to calibrate treatment priorities and validate severity assessment.', { indent: 5 });
                        if (isPhasedDeployment) {
                          pdf.addText(clean(`4. Scale to full ${totalQuads}-quad (${totalUnits}-unit) deployment based on Phase 1 field data.`), { indent: 5 });
                          pdf.addText('5. Coordinate with state agency on compliance pathway and grant eligibility.', { indent: 5 });
                          pdf.addText('6. Implement supporting BMPs and nature-based solutions per this restoration plan.', { indent: 5 });
                        } else {
                          pdf.addText('4. Coordinate with state agency on compliance pathway and grant eligibility.', { indent: 5 });
                          pdf.addText('5. Implement supporting BMPs and nature-based solutions per this restoration plan.', { indent: 5 });
                        }
                        pdf.addSpacer(5);

                        pdf.addText('Contact: info@project-pearl.org | project-pearl.org', { bold: true });

                        const safeName = regionName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
                        pdf.download(`PEARL_Deployment_Plan_${safeName}_${stateAbbr}.pdf`);
                      } catch (err) {
                        console.error('PDF generation failed:', err);
                        alert('PDF generation failed. Check console for details.');
                      }
                    }}
                    className="flex-1 min-w-[140px] bg-white hover:bg-cyan-50 text-cyan-800 text-xs font-semibold px-4 py-2.5 rounded-lg border-2 border-cyan-300 transition-colors"
                  >
                    📋 Generate Deployment Plan
                  </button>
                  <button
                    onClick={() => setShowCostPanel(prev => !prev)}
                    className={`flex-1 min-w-[140px] text-xs font-semibold px-4 py-2.5 rounded-lg border-2 transition-colors ${showCostPanel ? 'bg-cyan-700 text-white border-cyan-700' : 'bg-white hover:bg-cyan-50 text-cyan-800 border-cyan-300'}`}
                  >
                    {showCostPanel ? '✕ Close' : '💰 Cost & Economics'}
                  </button>
                </div>

                {/* ═══ ECONOMICS PANEL (toggles open) ═══ */}
                {showCostPanel && (() => {
                  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

                  // ═══ COMPLIANCE SAVINGS MODEL ═══
                  // Framed as: "How much existing compliance cost can PEARL replace or compress?"
                  // NOT fines avoided. This is reduced spend on monitoring, reporting, and BMP execution.
                  // Partial displacement assumptions — conservative, defensible for city procurement.

                  const unitCost = COST_PER_UNIT_YEAR; // $200,000
                  const p1Annual = phase1Units * unitCost;
                  const fullAnnual = totalUnits * unitCost;

                  // ── Traditional compliance costs (per zone, annual) ──
                  const tradMonitoringLow = 100000;   // Continuous station install amortized + ops + lab QA + data management
                  const tradMonitoringHigh = 200000;
                  const tradBMPLow = 150000;          // Constructed wetland or engineered BMP, amortized over 20yr + maintenance
                  const tradBMPHigh = 400000;         // Urban sites: land, permitting, space constraints
                  const tradConsultingLow = 75000;    // MS4 program management, lab analysis, quarterly sampling, permit reporting
                  const tradConsultingHigh = 175000;  // Cat 5: TMDL participation, enhanced documentation, regulatory coordination
                  const tradTotalLow = (tradMonitoringLow + tradBMPLow + tradConsultingLow) * totalQuads;
                  const tradTotalHigh = (tradMonitoringHigh + tradBMPHigh + tradConsultingHigh) * totalQuads;

                  // ── Bucket 1: Monitoring & Reporting Efficiency ──
                  // PEARL replaces 50-75% of fixed monitoring station cost
                  const monStationSavingsLow = Math.round(0.50 * tradMonitoringLow * totalQuads);
                  const monStationSavingsHigh = Math.round(0.75 * tradMonitoringHigh * totalQuads);
                  // PEARL replaces 40-60% of consulting, lab, and reporting
                  const consultSavingsLow = Math.round(0.40 * tradConsultingLow * totalQuads);
                  const consultSavingsHigh = Math.round(0.60 * tradConsultingHigh * totalQuads);
                  const bucket1Low = monStationSavingsLow + consultSavingsLow;
                  const bucket1High = monStationSavingsHigh + consultSavingsHigh;

                  // ── Bucket 2: BMP Execution Efficiency ──
                  // PEARL data improves targeting, reduces rework and mis-targeted spend
                  // Conservative: 5-10% of amortized BMP program
                  const bucket2Low = Math.round(0.05 * tradBMPLow * totalQuads);
                  const bucket2High = Math.round(0.10 * tradBMPHigh * totalQuads);

                  // ── Total compliance savings ──
                  const compSavingsLow = bucket1Low + bucket2Low;
                  const compSavingsHigh = bucket1High + bucket2High;
                  // Round for clean presentation
                  const compSavingsLowRound = Math.round(compSavingsLow / 10000) * 10000;
                  const compSavingsHighRound = Math.round(compSavingsHigh / 10000) * 10000;

                  // ── What this means relative to PEARL cost ──
                  const offsetPctLow = Math.round((compSavingsLowRound / fullAnnual) * 100);
                  const offsetPctHigh = Math.round((compSavingsHighRound / fullAnnual) * 100);

                  // ── Grant offset potential ──
                  const grantOffsetLow = Math.round(fullAnnual * 0.40);
                  const grantOffsetHigh = Math.round(fullAnnual * 0.75);

                  // ── Combined: compliance savings + grants ──
                  const combinedOffsetLow = compSavingsLowRound + grantOffsetLow;
                  const combinedOffsetHigh = compSavingsHighRound + grantOffsetHigh;
                  const effectiveCostLow = Math.max(0, fullAnnual - combinedOffsetHigh);
                  const effectiveCostHigh = Math.max(0, fullAnnual - combinedOffsetLow);

                  return (
                    <div className="rounded-lg border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-3 space-y-3">
                      <div className="text-[10px] font-bold text-green-800 uppercase tracking-wider">PEARL Economics -- {regionName}</div>

                      {/* Unit pricing */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-600 uppercase">PEARL Unit Pricing</div>
                        <div className="rounded-md bg-white border border-slate-200 overflow-hidden">
                          <div className="grid grid-cols-[1fr_auto] text-[11px]">
                            <div className="px-2 py-1.5 bg-slate-100 font-semibold border-b border-slate-200">PEARL Unit (50 GPM)</div>
                            <div className="px-2 py-1.5 bg-slate-100 font-bold text-right border-b border-slate-200">{fmt(unitCost)}/unit/year</div>
                            <div className="px-2 py-1.5 border-b border-slate-100 text-[10px] text-slate-500" style={{ gridColumn: '1 / -1' }}>
                              All-inclusive: hardware, deployment, calibration, continuous monitoring, dashboards, automated reporting, maintenance, and support
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Deployment costs by phase */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-600 uppercase">{isPhasedDeployment ? 'Phased Deployment Costs' : 'Deployment Cost'}</div>
                        <div className="rounded-md bg-white border border-slate-200 overflow-hidden">
                          <div className="grid grid-cols-[1fr_auto_auto_auto] text-[11px]">
                            <div className="px-2 py-1 bg-slate-200 font-bold border-b border-slate-300">Phase</div>
                            <div className="px-2 py-1 bg-slate-200 font-bold text-right border-b border-slate-300">Units</div>
                            <div className="px-2 py-1 bg-slate-200 font-bold text-right border-b border-slate-300">GPM</div>
                            <div className="px-2 py-1 bg-slate-200 font-bold text-right border-b border-slate-300">Annual Cost</div>

                            {isPhasedDeployment ? (
                              <>
                                <div className="px-2 py-1.5 font-semibold border-b border-slate-100">Phase 1 ({phase1Quads} quad{phase1Quads > 1 ? 's' : ''})</div>
                                <div className="px-2 py-1.5 text-right border-b border-slate-100">{phase1Units}</div>
                                <div className="px-2 py-1.5 text-right border-b border-slate-100">{phase1GPM}</div>
                                <div className="px-2 py-1.5 font-bold text-right border-b border-slate-100">{fmt(p1Annual)}/yr</div>

                                {totalQuads >= 2 && (() => {
                                  const p2q = totalQuads === 2 ? totalQuads - phase1Quads : 1;
                                  const p2u = p2q * 4;
                                  return (
                                    <>
                                      <div className="px-2 py-1.5 bg-slate-50 font-semibold border-b border-slate-100">+ Phase 2 ({p2q}Q)</div>
                                      <div className="px-2 py-1.5 bg-slate-50 text-right border-b border-slate-100">+{p2u}</div>
                                      <div className="px-2 py-1.5 bg-slate-50 text-right border-b border-slate-100">+{p2u * 50}</div>
                                      <div className="px-2 py-1.5 bg-slate-50 font-bold text-right border-b border-slate-100">+{fmt(p2u * unitCost)}/yr</div>
                                    </>
                                  );
                                })()}

                                {totalQuads >= 3 && (() => {
                                  const p3q = totalQuads - phase1Quads - (totalQuads === 2 ? totalQuads - phase1Quads : 1);
                                  const p3u = p3q * 4;
                                  return p3q > 0 ? (
                                    <>
                                      <div className="px-2 py-1.5 font-semibold border-b border-slate-100">+ Phase 3 ({p3q}Q)</div>
                                      <div className="px-2 py-1.5 text-right border-b border-slate-100">+{p3u}</div>
                                      <div className="px-2 py-1.5 text-right border-b border-slate-100">+{p3u * 50}</div>
                                      <div className="px-2 py-1.5 font-bold text-right border-b border-slate-100">+{fmt(p3u * unitCost)}/yr</div>
                                    </>
                                  ) : null;
                                })()}
                              </>
                            ) : (
                              <>
                                <div className="px-2 py-1.5 font-semibold border-b border-slate-100">Full deployment</div>
                                <div className="px-2 py-1.5 text-right border-b border-slate-100">{totalUnits}</div>
                                <div className="px-2 py-1.5 text-right border-b border-slate-100">{fullGPM}</div>
                                <div className="px-2 py-1.5 font-bold text-right border-b border-slate-100">{fmt(fullAnnual)}/yr</div>
                              </>
                            )}

                            <div className="px-2 py-1.5 bg-cyan-100 font-bold text-cyan-800">Full Build</div>
                            <div className="px-2 py-1.5 bg-cyan-100 font-bold text-cyan-800 text-right">{totalUnits}</div>
                            <div className="px-2 py-1.5 bg-cyan-100 font-bold text-cyan-800 text-right">{fullGPM}</div>
                            <div className="px-2 py-1.5 bg-cyan-100 font-bold text-cyan-800 text-right">{fmt(fullAnnual)}/yr</div>
                          </div>
                        </div>
                      </div>

                      {/* Traditional compliance baseline */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-600 uppercase">Current Compliance Cost Baseline ({totalQuads} Zones, Annual)</div>
                        <div className="rounded-md bg-white border border-slate-200 overflow-hidden">
                          <div className="grid grid-cols-[1fr_auto] text-[11px]">
                            <div className="px-2 py-1.5 border-b border-slate-100">Continuous monitoring stations (install amortized + ops)</div>
                            <div className="px-2 py-1.5 font-bold text-slate-600 text-right border-b border-slate-100">{fmt(tradMonitoringLow * totalQuads)} -- {fmt(tradMonitoringHigh * totalQuads)}/yr</div>
                            <div className="px-2 py-1.5 bg-slate-50 border-b border-slate-100">Treatment BMPs (constructed wetland / bioretention, amortized)</div>
                            <div className="px-2 py-1.5 bg-slate-50 font-bold text-slate-600 text-right border-b border-slate-100">{fmt(tradBMPLow * totalQuads)} -- {fmt(tradBMPHigh * totalQuads)}/yr</div>
                            <div className="px-2 py-1.5 border-b border-slate-100">MS4 consulting, lab work & permit reporting</div>
                            <div className="px-2 py-1.5 font-bold text-slate-600 text-right border-b border-slate-100">{fmt(tradConsultingLow * totalQuads)} -- {fmt(tradConsultingHigh * totalQuads)}/yr</div>
                            <div className="px-2 py-1.5 bg-slate-200 font-semibold text-slate-700">Traditional Total (separate contracts)</div>
                            <div className="px-2 py-1.5 bg-slate-200 font-bold text-slate-700 text-right">{fmt(tradTotalLow)} -- {fmt(tradTotalHigh)}/yr</div>
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-500 px-1">These are costs Baltimore already pays or would pay to achieve equivalent compliance coverage. PEARL does not eliminate all of these -- it partially displaces and compresses them.</div>
                      </div>

                      {/* Compliance cost savings */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-green-700 uppercase">Compliance Cost Savings From Meeting Permit Requirements</div>
                        <div className="rounded-md bg-white border border-green-200 overflow-hidden">
                          <div className="grid grid-cols-[1fr_auto] text-[11px]">
                            <div className="px-2 py-1.5 border-b border-green-100">
                              <div className="font-semibold">Monitoring & reporting efficiency</div>
                              <div className="text-[9px] text-slate-500">Replaces 50-75% of fixed stations, 40-60% of consulting & lab work</div>
                            </div>
                            <div className="px-2 py-1.5 font-bold text-green-700 text-right border-b border-green-100">{fmt(bucket1Low)} -- {fmt(bucket1High)}/yr</div>
                            <div className="px-2 py-1.5 bg-green-50/50 border-b border-green-100">
                              <div className="font-semibold">BMP execution efficiency</div>
                              <div className="text-[9px] text-slate-500">Better targeting reduces rework, redesign & mis-targeted spend (5-10% of BMP program)</div>
                            </div>
                            <div className="px-2 py-1.5 bg-green-50/50 font-bold text-green-700 text-right border-b border-green-100">{fmt(bucket2Low)} -- {fmt(bucket2High)}/yr</div>
                            <div className="px-2 py-1.5 bg-green-200 font-bold text-green-900">Total Compliance Savings</div>
                            <div className="px-2 py-1.5 bg-green-200 font-bold text-green-900 text-right">{fmt(compSavingsLowRound)} -- {fmt(compSavingsHighRound)}/yr</div>
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-500 px-1">This is not avoided fines. This is reduced spend on monitoring, reporting, and inefficient BMP execution -- tied directly to Baltimore's existing cost categories.</div>
                      </div>

                      {/* What this means */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-green-100 border border-green-200 text-center py-2">
                          <div className="text-[9px] text-green-600">Compliance Savings Offset</div>
                          <div className="text-lg font-bold text-green-700">{offsetPctLow}% -- {offsetPctHigh}%</div>
                          <div className="text-[9px] text-green-500">of PEARL cost offset by reduced compliance spend</div>
                        </div>
                        <div className="rounded-md bg-cyan-100 border border-cyan-200 text-center py-2">
                          <div className="text-[9px] text-cyan-600">Time to Compliance Data</div>
                          <div className="text-lg font-bold text-cyan-700">30 -- 60 days</div>
                          <div className="text-[9px] text-cyan-500">vs. 12-24 months traditional BMP</div>
                        </div>
                      </div>

                      {/* Grant offset */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-600 uppercase">Grant Funding Offset</div>
                        <div className="rounded-md bg-white border border-slate-200 overflow-hidden">
                          <div className="grid grid-cols-[1fr_auto] text-[11px]">
                            <div className="px-2 py-1.5 border-b border-slate-100">Estimated grant-eligible portion (40-75%)</div>
                            <div className="px-2 py-1.5 font-bold text-green-700 text-right border-b border-slate-100">{fmt(grantOffsetLow)} -- {fmt(grantOffsetHigh)}/yr</div>
                            <div className="px-2 py-1.5 bg-slate-50 border-b border-slate-100">+ Compliance savings</div>
                            <div className="px-2 py-1.5 bg-slate-50 font-bold text-green-700 text-right border-b border-slate-100">{fmt(compSavingsLowRound)} -- {fmt(compSavingsHighRound)}/yr</div>
                            <div className="px-2 py-1.5 bg-green-200 font-bold text-green-900">Effective Net Cost</div>
                            <div className="px-2 py-1.5 bg-green-200 font-bold text-green-900 text-right">{fmt(effectiveCostLow)} -- {fmt(effectiveCostHigh)}/yr</div>
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-500 px-1">Effective net cost = PEARL annual cost minus grant funding minus compliance savings. This is the incremental budget impact for capabilities that would otherwise require {totalQuads} separate monitoring, treatment, and consulting contracts.</div>
                      </div>

                      {/* Grant alignment */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-600 uppercase">Grant Alignment</div>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">
                          <div className="rounded bg-green-100 border border-green-200 p-1.5 text-center">
                            <div className="font-bold text-green-800">Equipment</div>
                            <div className="text-green-600 text-[9px]">"Pilot deployment & equipment"</div>
                            <div className="font-bold text-green-700 mt-0.5">HIGHLY FUNDABLE</div>
                          </div>
                          <div className="rounded bg-green-100 border border-green-200 p-1.5 text-center">
                            <div className="font-bold text-green-800">Monitoring</div>
                            <div className="text-green-600 text-[9px]">"Monitoring, evaluation & data"</div>
                            <div className="font-bold text-green-700 mt-0.5">HIGHLY FUNDABLE</div>
                          </div>
                          <div className="rounded bg-green-100 border border-green-200 p-1.5 text-center">
                            <div className="font-bold text-green-800">Treatment</div>
                            <div className="text-green-600 text-[9px]">"Nature-based BMP implementation"</div>
                            <div className="font-bold text-green-700 mt-0.5">HIGHLY FUNDABLE</div>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500">Eligible: EPA 319, {stateAbbr === 'MD' ? 'MD Bay Restoration Fund, ' : ''}Justice40, CBRAP, NOAA Habitat Restoration, state revolving funds</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ═══ SUPPORTING LAYERS (source, nature, community, regulatory) ═══ */}
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-1 pt-1">Supporting Restoration Layers</div>
          <div className="text-[11px] text-slate-500 px-1 -mt-2">
            PEARL accelerates results. These layers provide the long-term foundation.
          </div>

          {categories.filter(cat => cat.id !== 'pearl').map((cat) => {
            const warranted = cat.modules.filter(m => m.status === 'warranted');
            const recommended = cat.modules.filter(m => m.status === 'recommended' || m.status === 'accelerator');
            const coBenefits = cat.modules.filter(m => m.status === 'co-benefit');
            return (
              <div key={cat.id} className={`rounded-lg border ${cat.color} p-2.5 space-y-1.5`}>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <span>{cat.icon}</span> {cat.title}
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px]">
                    {warranted.length > 0 && <span className="bg-red-200 text-red-800 font-bold px-1.5 py-0.5 rounded-full">{warranted.length} warranted</span>}
                    {recommended.length > 0 && <span className="bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded-full">{recommended.length} recommended</span>}
                    {coBenefits.length > 0 && <span className="bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded-full">{coBenefits.length} co-benefit</span>}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 -mt-0.5">{cat.subtitle}</div>
                <div className="space-y-1">
                  {[...warranted, ...recommended].map((t) => (
                    <div key={t.id} className={`rounded-md border p-2 ${t.color}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-sm flex-shrink-0">{t.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{t.label}</span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                              t.status === 'warranted' ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'
                            }`}>{t.status}</span>
                          </div>
                          <div className="text-[10px] mt-0.5 leading-relaxed opacity-90">{t.detail}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {coBenefits.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {coBenefits.map((t) => (
                        <span key={t.id} className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-white/70 border border-slate-200 rounded px-2 py-1" title={t.detail}>
                          {t.icon} {t.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Threat Assessment */}
          <div className="grid grid-cols-3 gap-2">
            {threats.map((t) => (
              <div key={t.label} className="bg-white rounded-md border border-cyan-100 p-2 text-center">
                <div className="text-[10px] text-slate-500 uppercase">{t.label}</div>
                <div className={`text-sm font-bold ${t.color}`}>{t.level}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">{t.detail}</div>
              </div>
            ))}
          </div>

          {/* Full Plan Summary */}
          <div className="rounded-md bg-white border border-slate-200 p-2.5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Full Plan</div>
                <div className="text-sm font-bold text-slate-700">{totalBMPs} BMPs + {pearlModel}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Deployment</div>
                <div className="text-sm font-bold text-slate-700">{totalQuads} quad{totalQuads > 1 ? 's' : ''} ({totalUnits} units)</div>
                <div className="text-[9px] text-slate-400">{isPhasedDeployment ? `Phase 1: ${phase1Quads}Q / ${phase1Units}U` : `${fullGPM} GPM`}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Annual Cost</div>
                <div className="text-sm font-bold text-slate-700">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(fullAnnualCost)}/yr</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Severity</div>
                <div className={`text-sm font-bold ${siteSeverityScore >= 75 ? 'text-red-700' : siteSeverityScore >= 50 ? 'text-amber-700' : siteSeverityScore >= 25 ? 'text-yellow-700' : 'text-green-700'}`}>{siteSeverityLabel}</div>
                <div className="text-[9px] text-slate-400">{siteSeverityScore}/100</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Pathway</div>
                <div className="text-xs font-semibold text-slate-700">{compliancePathway}</div>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-100 pt-1.5">
              Sizing derived from {isMD ? 'MD DNR Shallow Water Monitoring thresholds: DO (5.0/3.2 mg/L), chlorophyll (15/50/100 ug/L), turbidity (7 FNU)' : 'EPA National Recommended Water Quality Criteria: DO (5.0/4.0 mg/L), chlorophyll (20/40/60 ug/L), turbidity (10/25 FNU)'}, EPA ATTAINS category. PEARL is the data backbone -- it measures, verifies, and optimizes every restoration layer from day one.
            </div>
          </div>
        </CardContent>
      )}


      </Card>
  );
}

