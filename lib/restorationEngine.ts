// lib/restorationEngine.ts
// Pure computation engine for PEARL restoration plans
// Extracted from NCC inline logic — reusable by NCC, SCC, reports, and exports
// Zero React dependencies — this is a data-in, data-out function

// ─── Input Types ─────────────────────────────────────────────────────────────

export type AlertLevel = 'none' | 'low' | 'medium' | 'high';

export interface RestorationInput {
  // Identity
  regionName: string;
  stateAbbr: string;
  alertLevel: AlertLevel;

  // Water quality parameters (from useWaterData or equivalent)
  params: Record<string, { value: number; lastSampled?: string | null; unit?: string }>;

  // ATTAINS data (already resolved — caller handles per-wb vs bulk vs alertLevel merge)
  attainsCategory: string;   // e.g. '5', '4A', '' 
  attainsCauses: string[];   // e.g. ['Phosphorus', 'Methylmercury']
  attainsCycle: string;      // e.g. '2022'

  // Optional enrichment
  attainsAcres?: number | null;
}

// ─── Output Types ────────────────────────────────────────────────────────────

export type TreatmentStatus = 'recommended' | 'warranted' | 'co-benefit' | 'accelerator';

export interface TreatmentModule {
  id: string;
  label: string;
  icon: string;
  status: TreatmentStatus;
  detail: string;
  color: string;
}

export interface RestorationCategory {
  id: string;
  title: string;
  icon: string;
  subtitle: string;
  modules: TreatmentModule[];
  color: string;
}

export interface ImpairmentItem {
  cause: string;
  tier: 1 | 2 | 3;
  tierLabel: string;
  pearlAction: string;
  icon: string;
}

export type ThreatLevel = {
  label: string;
  level: 'HIGH' | 'MODERATE' | 'LOW';
  detail: string;
  color: string;
};

export type TreatmentPriority = {
  rank: number;
  driver: string;
  action: string;
  urgency: 'immediate' | 'high' | 'moderate' | 'low';
};

export type DoSeverity = 'critical' | 'stressed' | 'adequate' | 'unknown';
export type BloomSeverity = 'severe' | 'significant' | 'bloom' | 'normal' | 'unknown';
export type TurbiditySeverity = 'impaired' | 'elevated' | 'clear' | 'unknown';
export type NutrientSeverity = 'excessive' | 'elevated' | 'normal' | 'unknown';
export type SeverityLabel = 'CRITICAL' | 'DEGRADED' | 'STRESSED' | 'FAIR';

export interface WhyBullet {
  icon: string;
  problem: string;
  solution: string;
}

export interface RestorationResult {
  // Identity
  regionName: string;
  stateAbbr: string;
  waterType: 'brackish' | 'freshwater';

  // ATTAINS resolution
  attainsCategory: string;
  attainsCauses: string[];
  attainsCycle: string;
  isCat5: boolean;
  isImpaired: boolean;
  tmdlStatus: 'needed' | 'completed' | 'alternative' | 'na';

  // Impairment classification
  impairmentClassification: ImpairmentItem[];
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  totalClassified: number;
  pearlAddressable: number;
  addressabilityPct: number;

  // Cause flags
  hasNutrients: boolean;
  hasBacteria: boolean;
  hasSediment: boolean;
  hasMetals: boolean;
  hasStormwaterMetals: boolean;
  hasMercury: boolean;
  hasPFAS: boolean;
  hasPCBs: boolean;
  hasTemperature: boolean;
  hasHabitat: boolean;
  hasTrash: boolean;
  hasOrganic: boolean;
  hasDOImpairment: boolean;

  // Parameter severities
  doSeverity: DoSeverity;
  bloomSeverity: BloomSeverity;
  turbiditySeverity: TurbiditySeverity;
  nutrientSeverity: NutrientSeverity;
  nutrientExceedsBiofilt: boolean;
  bacteriaElevated: boolean;

  // Threshold info (for display/PDF citations)
  isMD: boolean;
  thresholdSource: string;
  thresholdSourceShort: string;
  doCritical: number;
  doStressed: number;
  chlBloom: number;
  chlSignificant: number;
  chlSevere: number;
  turbElevated: number;
  turbImpaired: number;

  // Raw parameter values (for display)
  doVal: number | null;
  chlVal: number | null;
  turbVal: number | null;
  tnVal: number | null;
  tpVal: number | null;

  // Severity scoring
  siteSeverityScore: number;
  siteSeverityLabel: SeverityLabel;
  siteSeverityColor: string;
  doScore: number;
  bloomScore: number;
  turbScore: number;
  impairScore: number;
  monitoringGapScore: number;

  // Treatment priorities
  treatmentPriorities: TreatmentPriority[];

  // Restoration categories (all 5)
  categories: RestorationCategory[];

  // PEARL system summary
  pearlModel: string;
  totalBMPs: number;
  compliancePathway: string;

  // Sizing & cost
  totalQuads: number;
  totalUnits: number;
  phase1Quads: number;
  phase1Units: number;
  isPhasedDeployment: boolean;
  phase1AnnualCost: number;
  fullAnnualCost: number;
  phase1GPM: number;
  fullGPM: number;
  sizingBasis: string;
  estimatedAcres: number;
  acresSource: string;

  // Data freshness
  dataAgeDays: number | null;
  dataConfidence: 'high' | 'moderate' | 'low' | 'unknown';

  // Threat assessment
  threats: ThreatLevel[];

  // Why PEARL bullets
  whyBullets: WhyBullet[];

  // Healthy check
  isHealthy: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const COST_PER_UNIT_YEAR = 200000;
export const UNITS_PER_QUAD = 4; // 1 quad = 4 units = 200 GPM

// ─── Engine ──────────────────────────────────────────────────────────────────

export function computeRestorationPlan(input: RestorationInput): RestorationResult {
  const { regionName, stateAbbr, alertLevel: level, params, attainsCategory, attainsCauses, attainsCycle } = input;

  // ── Classify waterbody type ──
  const salVal = params.salinity?.value ?? params.conductivity?.value ?? 0;
  const isBrackish = (params.salinity && salVal > 0.5) || (params.conductivity && salVal > 1000);
  const waterType = isBrackish ? 'brackish' as const : 'freshwater' as const;

  // ── Map ATTAINS causes to treatment flags ──
  const causesLower = attainsCauses.map(c => c.toLowerCase());
  const hasNutrients = causesLower.some(c => c.includes('nutrient') || c.includes('nitrogen') || c.includes('phosphor'));
  const hasBacteria = causesLower.some(c => c.includes('pathogen') || c.includes('e. coli') || c.includes('escherichia') || c.includes('enterococ') || c.includes('fecal') || c.includes('bacteria'));
  const hasSediment = causesLower.some(c => c.includes('sediment') || c.includes('turbidity') || c.includes('total suspended') || c.includes('siltation'));
  const hasMetals = causesLower.some(c => c.includes('mercury') || c.includes('lead') || c.includes('copper') || c.includes('zinc') || c.includes('metal'));
  const hasPFAS = causesLower.some(c => c.includes('pfas') || c.includes('pfoa') || c.includes('pfos') || c.includes('perfluor'));
  const hasPCBs = causesLower.some(c => c.includes('pcb') || c.includes('polychlorinated'));
  const hasTemperature = causesLower.some(c => c.includes('temperature') || c.includes('thermal'));
  const hasStormwaterMetals = causesLower.some(c => c.includes('lead') || c.includes('copper') || c.includes('zinc') || (c.includes('metal') && !c.includes('mercury') && !c.includes('methylmercury')));
  const hasMercury = causesLower.some(c => c.includes('mercury') || c.includes('methylmercury'));
  let hasHabitat = causesLower.some(c => c.includes('habitat') || c.includes('biological') || c.includes('benthic') || c.includes('fish') || c.includes('shellfish'));
  const hasTrash = causesLower.some(c => c.includes('trash') || c.includes('debris') || c.includes('floatable'));
  const hasOrganic = causesLower.some(c => c.includes('organic') && !c.includes('phosphor'));
  let hasDOImpairment = causesLower.some(c => c.includes('dissolved oxygen') || c.includes('oxygen'));

  // ═══ TIERED IMPAIRMENT CLASSIFICATION ═══
  const impairmentClassification: ImpairmentItem[] = [];
  const classifiedCauses = new Set<string>();

  for (const rawCause of attainsCauses) {
    const cl = rawCause.toLowerCase();
    if (classifiedCauses.has(cl)) continue;
    classifiedCauses.add(cl);

    // ── TIER 1: PEARL Primary Target ──
    if (cl.includes('nitrogen') || cl.includes('phosphor') || cl.includes('nutrient')) {
      impairmentClassification.push({ cause: rawCause, tier: 1, tierLabel: 'PEARL Primary Target',
        icon: '✅', pearlAction: 'Biofiltration + ion exchange directly removes N/P from stormwater' });
    } else if (cl.includes('sediment') || cl.includes('turbidity') || cl.includes('total suspended') || cl.includes('siltation') || cl.includes('clarity')) {
      impairmentClassification.push({ cause: rawCause, tier: 1, tierLabel: 'PEARL Primary Target',
        icon: '✅', pearlAction: '50μm pre-screening + biofiltration captures suspended solids' });
    } else if (cl.includes('pathogen') || cl.includes('e. coli') || cl.includes('escherichia') || cl.includes('enterococ') || cl.includes('fecal') || cl.includes('bacteria')) {
      impairmentClassification.push({ cause: rawCause, tier: 1, tierLabel: 'PEARL Primary Target',
        icon: '✅', pearlAction: 'UV disinfection stage provides pathogen reduction' });
    } else if (cl.includes('lead') || cl.includes('copper') || cl.includes('zinc') || (cl.includes('metal') && !cl.includes('mercury') && !cl.includes('methyl'))) {
      impairmentClassification.push({ cause: rawCause, tier: 1, tierLabel: 'PEARL Primary Target',
        icon: '✅', pearlAction: 'Chelating resin targets dissolved stormwater metals' });
    } else if (cl.includes('trash') || cl.includes('debris') || cl.includes('floatable')) {
      impairmentClassification.push({ cause: rawCause, tier: 1, tierLabel: 'PEARL Primary Target',
        icon: '✅', pearlAction: 'Pre-screening mesh captures debris and floatables' });

    // ── TIER 2: PEARL Contributes ──
    } else if (cl.includes('dissolved oxygen') || cl.includes('oxygen, dissolved') || cl.includes('oxygen')) {
      impairmentClassification.push({ cause: rawCause, tier: 2, tierLabel: 'PEARL Contributes',
        icon: '🔶', pearlAction: 'Nutrient removal reduces eutrophication cycle driving low DO' });
    } else if (cl.includes('chlorophyll') || cl.includes('algae') || cl.includes('algal') || cl.includes('cyanobacteria') || cl.includes('harmful algal')) {
      impairmentClassification.push({ cause: rawCause, tier: 2, tierLabel: 'PEARL Contributes',
        icon: '🔶', pearlAction: 'Nutrient removal starves bloom cycle at the source' });
    } else if (cl.includes('pfas') || cl.includes('pfoa') || cl.includes('pfos') || cl.includes('perfluor')) {
      impairmentClassification.push({ cause: rawCause, tier: 2, tierLabel: 'PEARL Planned Capability',
        icon: '🔶', pearlAction: 'PFAS treatment resin module in development — targeted for PEARL treatment train integration' });
    } else if (cl.includes('biological') || cl.includes('benthic') || cl.includes('habitat')) {
      impairmentClassification.push({ cause: rawCause, tier: 2, tierLabel: 'PEARL Contributes',
        icon: '🔶', pearlAction: 'Improved water quality supports biological community recovery' });

    // ── TIER 3: Outside PEARL Scope ──
    } else if (cl.includes('mercury') || cl.includes('methylmercury')) {
      impairmentClassification.push({ cause: rawCause, tier: 3, tierLabel: 'Outside PEARL Scope',
        icon: '⚠️', pearlAction: 'Atmospheric deposition source — requires emission controls, not stormwater treatment' });
    } else if (cl.includes('pcb') || cl.includes('polychlorinated')) {
      impairmentClassification.push({ cause: rawCause, tier: 3, tierLabel: 'Outside PEARL Scope',
        icon: '⚠️', pearlAction: 'Legacy contamination in sediment — requires dredging or capping, not flow-through treatment' });
    } else if (cl.includes('temperature') || cl.includes('thermal')) {
      impairmentClassification.push({ cause: rawCause, tier: 3, tierLabel: 'Outside PEARL Scope',
        icon: '⚠️', pearlAction: 'Thermal pollution — requires canopy restoration, cooling water controls, or discharge limits' });
    } else if (cl.includes('flow') || cl.includes('hydrologic') || cl.includes('alteration')) {
      impairmentClassification.push({ cause: rawCause, tier: 3, tierLabel: 'Outside PEARL Scope',
        icon: '⚠️', pearlAction: 'Hydrologic modification — requires dam removal, flow management, or floodplain reconnection' });
    } else if (cl.includes('dioxin') || cl.includes('pesticide') || cl.includes('herbicide') || cl.includes('insecticide')) {
      impairmentClassification.push({ cause: rawCause, tier: 3, tierLabel: 'Outside PEARL Scope',
        icon: '⚠️', pearlAction: 'Persistent organic pollutant — requires source elimination and advanced remediation' });
    } else if (cl.includes('cause unknown') || cl.includes('unknown')) {
      // Skip "CAUSE UNKNOWN" — not a real impairment
    } else {
      impairmentClassification.push({ cause: rawCause, tier: 2, tierLabel: 'Under Review',
        icon: '🔶', pearlAction: 'Cause requires site-specific assessment to determine PEARL applicability' });
    }
  }

  // ── Addressability Ratio (preliminary — recomputed after habitat inference) ──
  let tier1Count: number, tier2Count: number, tier3Count: number, totalClassified: number, pearlAddressable: number, addressabilityPct: number;

  // ── Check live parameters against thresholds ──
  const nutrientExceedsBiofilt = (params.TN?.value ?? 0) > 3.0 || (params.TP?.value ?? 0) > 0.3;
  const bacteriaElevated = (params.bacteria?.value ?? 0) > 235;

  const isImpaired = level === 'high' || level === 'medium';
  const isCat5 = attainsCategory.includes('5') || level === 'high';

  // ═══ STATE-AWARE SITE SEVERITY INDEX ═══
  const isMD = stateAbbr === 'MD';
  const doVal = params.DO?.value ?? null;
  const chlVal = params.chlorophyll?.value ?? null;
  const turbVal = params.turbidity?.value ?? null;
  const tnVal = params.TN?.value ?? null;
  const tpVal = params.TP?.value ?? null;

  const thresholdSource = isMD ? 'MD DNR Shallow Water Monitoring (COMAR 1995)' : 'EPA National Recommended Water Quality Criteria';
  const thresholdSourceShort = isMD ? 'MD DNR' : 'EPA';

  // DO thresholds
  const doCritical = isMD ? 3.2 : 4.0;
  const doStressed = 5.0;
  const doSeverity: DoSeverity =
    doVal === null ? 'unknown' : doVal < doCritical ? 'critical' : doVal < doStressed ? 'stressed' : 'adequate';

  // Chlorophyll / bloom thresholds
  const chlBloom = isMD ? 15 : 20;
  const chlSignificant = isMD ? 50 : 40;
  const chlSevere = isMD ? 100 : 60;
  const bloomSeverity: BloomSeverity =
    chlVal === null ? 'unknown' : chlVal > chlSevere ? 'severe' : chlVal > chlSignificant ? 'significant' : chlVal > chlBloom ? 'bloom' : 'normal';

  // Turbidity thresholds
  const turbElevated = isMD ? 7 : 10;
  const turbImpaired = isMD ? 20 : 25;
  const turbiditySeverity: TurbiditySeverity =
    turbVal === null ? 'unknown' : turbVal > turbImpaired ? 'impaired' : turbVal > turbElevated ? 'elevated' : 'clear';

  // Nutrient thresholds
  const tnElevated = isMD ? 1.0 : 1.5;
  const tnExcessive = 3.0;
  const tpElevated = 0.1;
  const tpExcessive = 0.3;
  const nutrientSeverity: NutrientSeverity =
    (tnVal === null && tpVal === null) ? 'unknown'
    : ((tnVal ?? 0) > tnExcessive || (tpVal ?? 0) > tpExcessive) ? 'excessive'
    : ((tnVal ?? 0) > tnElevated || (tpVal ?? 0) > tpElevated) ? 'elevated' : 'normal';

  // ═══ HABITAT DEGRADATION INFERENCE ═══
  // If ATTAINS only lists partial causes (e.g. "TRASH") but live parameters show
  // the full eutrophication syndrome (low/stressed DO + bloom-level chlorophyll +
  // elevated turbidity), infer habitat degradation even without an explicit ATTAINS cause.
  // This captures MDE/DNR findings like "poor habitat conditions due to low DO,
  // high algal concentrations, and poor water clarity" that EPA may not itemize.
  if (!hasHabitat && isCat5) {
    const doImpaired = doSeverity === 'critical' || doSeverity === 'stressed';
    const bloomPresent = bloomSeverity !== 'unknown' && bloomSeverity !== 'normal';
    const clarityPoor = turbiditySeverity === 'elevated' || turbiditySeverity === 'impaired';
    // Require at least 2 of 3 eutrophication indicators
    const eutrophicationSignals = [doImpaired, bloomPresent, clarityPoor].filter(Boolean).length;
    if (eutrophicationSignals >= 2) {
      hasHabitat = true;
      hasDOImpairment = hasDOImpairment || doImpaired;
      // Add inferred cause to classification
      impairmentClassification.push({
        cause: 'Habitat Degradation (inferred from parameter data)',
        tier: 2,
        tierLabel: 'PEARL Contributes',
        icon: '🔶',
        pearlAction: 'Improved water quality (DO, clarity, nutrients) supports biological community recovery',
      });
    }
  }

  // ═══ ADDRESSABILITY RATIO (post-inference) ═══
  tier1Count = impairmentClassification.filter(i => i.tier === 1).length;
  tier2Count = impairmentClassification.filter(i => i.tier === 2).length;
  tier3Count = impairmentClassification.filter(i => i.tier === 3).length;
  totalClassified = impairmentClassification.length;
  pearlAddressable = tier1Count + tier2Count;
  addressabilityPct = totalClassified > 0 ? Math.round((pearlAddressable / totalClassified) * 100) : 0;

  // ── Treatment Priority Engine ──
  const treatmentPriorities: TreatmentPriority[] = [];

  if (bloomSeverity === 'severe' || bloomSeverity === 'significant') {
    treatmentPriorities.push({ rank: 1, driver: `Algal bloom crisis (chlorophyll ${chlVal} ug/L, >${bloomSeverity === 'severe' ? chlSevere : chlSignificant} ${thresholdSourceShort} threshold)`, action: 'Nutrient interception via PEARL biofiltration + resin', urgency: 'immediate' });
  } else if (nutrientSeverity === 'excessive') {
    treatmentPriorities.push({ rank: 1, driver: `Excessive nutrient loading (TN ${tnVal?.toFixed(2) ?? '?'}, TP ${tpVal?.toFixed(2) ?? '?'} mg/L)`, action: 'Nutrient removal to prevent bloom cycle', urgency: 'high' });
  } else if (bloomSeverity === 'bloom' || nutrientSeverity === 'elevated') {
    treatmentPriorities.push({ rank: 2, driver: 'Elevated nutrients / early bloom conditions', action: 'Nutrient monitoring + biofiltration', urgency: 'moderate' });
  }

  if (doSeverity === 'critical') {
    treatmentPriorities.push({ rank: 1, driver: `DO at lethal levels (${doVal?.toFixed(1)} mg/L < ${doCritical} ${thresholdSourceShort} threshold)`, action: 'Immediate treatment to break bloom-crash DO cycle', urgency: 'immediate' });
  } else if (doSeverity === 'stressed') {
    treatmentPriorities.push({ rank: 2, driver: `DO below criteria (${doVal?.toFixed(1)} mg/L < ${doStressed} threshold)`, action: 'Treatment to restore DO above living resource criteria', urgency: 'high' });
  }

  if (turbiditySeverity === 'impaired') {
    treatmentPriorities.push({ rank: 2, driver: `Turbidity at ${turbVal?.toFixed(1)} FNU (>${turbImpaired})${isMD ? ' -- SAV habitat destroyed' : ' -- aquatic habitat impaired'}`, action: 'Sediment pre-screening + source control', urgency: 'high' });
  } else if (turbiditySeverity === 'elevated') {
    treatmentPriorities.push({ rank: 3, driver: `Turbidity at ${turbVal?.toFixed(1)} FNU (>${turbElevated} ${isMD ? 'SAV' : 'habitat'} threshold)`, action: '50um pre-screen captures suspended solids', urgency: 'moderate' });
  }

  if (bacteriaElevated) {
    treatmentPriorities.push({ rank: 1, driver: `Bacteria at ${Math.round(params.bacteria?.value ?? 0)} MPN/100mL (>235 EPA recreational standard)`, action: 'UV treatment + pathogen monitoring', urgency: 'immediate' });
  } else if (hasBacteria) {
    treatmentPriorities.push({ rank: 2, driver: 'Pathogen impairment listed in ATTAINS', action: 'Seasonal pathogen monitoring + treatment', urgency: 'moderate' });
  }

  treatmentPriorities.sort((a, b) => a.rank - b.rank);

  // ── Composite Site Severity Score (0-100) ──
  const impairmentCount = attainsCauses.length;
  const hasMultipleImpairments = impairmentCount >= 3;

  const doScore = doSeverity === 'critical' ? 100 : doSeverity === 'stressed' ? 70 : doSeverity === 'adequate' ? 20
    : (isImpaired ? 70 : 50);

  const bloomScore = bloomSeverity === 'severe' ? 100 : bloomSeverity === 'significant' ? 80 : bloomSeverity === 'bloom' ? 60
    : nutrientSeverity === 'excessive' ? 70 : nutrientSeverity === 'elevated' ? 40
    : bloomSeverity === 'normal' ? 10
    : (hasNutrients ? 75 : isImpaired ? 60 : 50);

  const turbScore = turbiditySeverity === 'impaired' ? 100 : turbiditySeverity === 'elevated' ? 60 : turbiditySeverity === 'clear' ? 10
    : (hasSediment ? 75 : isImpaired ? 60 : 50);

  const impairScore = isCat5 ? 100
    : isImpaired ? (hasMultipleImpairments ? 85 : 70)
    : 30;

  // ── TMDL status ──
  const tmdlStatus = isCat5 ? 'needed' as const
    : (attainsCategory.includes('4a') || attainsCategory.includes('4A')) ? 'completed' as const
    : (attainsCategory.includes('4b') || attainsCategory.includes('4B')) ? 'alternative' as const
    : 'na' as const;

  // ── Build restoration categories ──
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
  if (hasStormwaterMetals) {
    pearlModules.push({ id: 'pearl-resin-m', label: 'Chelating Resin — Stormwater Metals', icon: '⚙️', status: 'warranted',
      detail: 'Stormwater metal impairment (lead, copper, zinc) detected. Chelating ion exchange resin targets dissolved metals in runoff.',
      color: 'bg-amber-50 border-amber-200 text-amber-800' });
  }
  if (hasMercury) {
    pearlModules.push({ id: 'pearl-hg-note', label: 'Mercury / Methylmercury — Not Treatable', icon: '⚠️', status: 'co-benefit',
      detail: 'Mercury impairment is primarily atmospheric deposition. PEARL does not address this pollutant. Requires emission source controls and fish tissue monitoring.',
      color: 'bg-slate-50 border-slate-300 text-slate-600' });
  }
  if (hasPFAS) {
    pearlModules.push({ id: 'pearl-gac', label: 'PFAS Treatment Resin Module', icon: '🧪', status: 'warranted',
      detail: 'PFAS contamination identified. Targeted PFAS treatment resin module in development for PEARL treatment train integration. Designed for flow-through application with real-time breakthrough monitoring.',
      color: 'bg-amber-50 border-amber-200 text-amber-800' });
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
  const threats: ThreatLevel[] = [
    { label: 'Microplastics', level: hasSediment || isImpaired ? 'MODERATE' : 'LOW', detail: 'Co-benefit removal via 50μm pre-screening mesh. No dedicated treatment required.', color: hasSediment || isImpaired ? 'text-amber-700' : 'text-green-700' },
    { label: 'PFAS', level: hasPFAS ? 'HIGH' : 'LOW', detail: hasPFAS ? 'PFAS treatment resin module in development for PEARL integration.' : 'No PFAS impairment listed. Monitor as emerging contaminant.', color: hasPFAS ? 'text-red-700' : 'text-green-700' },
    { label: 'Pathogens', level: bacteriaElevated ? 'HIGH' : hasBacteria ? 'MODERATE' : 'LOW', detail: bacteriaElevated ? 'Active exceedance — UV treatment stage needed.' : hasBacteria ? 'Listed impairment — seasonal, BMP-addressable.' : 'No pathogen concerns identified.', color: bacteriaElevated ? 'text-red-700' : hasBacteria ? 'text-amber-700' : 'text-green-700' },
  ];

  // ── System summary ──
  const pearlMods = categories.find(c => c.id === 'pearl')?.modules || [];
  const pearlModel = pearlMods.some(t => t.id === 'pearl-gac' || t.id === 'pearl-ac') ? 'PEARL-5X'
    : pearlMods.some(t => t.id === 'pearl-resin-n' || t.id === 'pearl-resin-m' || t.id === 'pearl-hg-note') ? 'PEARL-3R'
    : pearlMods.some(t => t.id === 'pearl-uv') ? 'PEARL-3B'
    : 'PEARL-2S';
  const totalBMPs = categories.filter(c => c.id !== 'pearl').reduce((n, c) => n + c.modules.filter(m => m.status === 'recommended' || m.status === 'warranted').length, 0);
  const compliancePathway = tmdlStatus === 'needed' ? 'TMDL development candidate'
    : tmdlStatus === 'completed' ? 'TMDL implementation — monitoring phase'
    : tmdlStatus === 'alternative' ? 'Alternative controls in place — enhancement opportunity'
    : isImpaired ? 'Impaired — restoration candidate' : 'Preventive deployment';

  // ── PEARL Unit Sizing & Cost Model ──
  const attainsAcres = input.attainsAcres ?? null;
  const estimatedAcres = attainsAcres ?? (waterType === 'brackish' ? 150 : 50);
  const acresSource = attainsAcres ? 'ATTAINS' : 'estimated';

  // ── Data age ──
  const oldestSample = Object.values(params).reduce((oldest: string | null, p: any) => {
    if (!p?.lastSampled) return oldest;
    if (!oldest) return p.lastSampled;
    return new Date(p.lastSampled) < new Date(oldest) ? p.lastSampled : oldest;
  }, null as string | null);
  const dataAgeDays = oldestSample ? Math.round((Date.now() - new Date(oldestSample).getTime()) / 86400000) : null;
  const dataConfidence = dataAgeDays === null ? 'unknown' as const : dataAgeDays > 90 ? 'low' as const : dataAgeDays > 30 ? 'moderate' as const : 'high' as const;
  const monitoringGapScore = dataAgeDays === null ? 80 : dataAgeDays > 365 ? 100 : dataAgeDays > 90 ? 70 : dataAgeDays > 30 ? 40 : 10;

  // ── Complete Site Severity Score (0-100) ──
  let siteSeverityScore = Math.round(
    doScore * 0.25 + bloomScore * 0.25 + turbScore * 0.15 + impairScore * 0.20 + monitoringGapScore * 0.15
  );

  // ── Severity floors ──
  if (isImpaired && (dataAgeDays === null || dataAgeDays > 365)) {
    siteSeverityScore = Math.max(siteSeverityScore, 60);
  }
  if (isCat5 && (dataAgeDays === null || dataAgeDays > 180)) {
    siteSeverityScore = Math.max(siteSeverityScore, 70);
  }
  if (isCat5 && (dataAgeDays === null || dataAgeDays > 365)) {
    siteSeverityScore = Math.max(siteSeverityScore, 75);
  }
  if (hasMultipleImpairments && (dataAgeDays === null || dataAgeDays > 365)) {
    siteSeverityScore = Math.max(siteSeverityScore, 75);
  }

  const siteSeverityLabel: SeverityLabel = siteSeverityScore >= 75 ? 'CRITICAL' : siteSeverityScore >= 50 ? 'DEGRADED' : siteSeverityScore >= 25 ? 'STRESSED' : 'FAIR';
  const siteSeverityColor = siteSeverityScore >= 75 ? 'text-red-700 bg-red-100' : siteSeverityScore >= 50 ? 'text-amber-700 bg-amber-100' : siteSeverityScore >= 25 ? 'text-yellow-700 bg-yellow-100' : 'text-green-700 bg-green-100';

  // ═══ SEVERITY-DRIVEN SIZING ═══
  const baseQuads = siteSeverityScore >= 75 ? 3
    : siteSeverityScore >= 50 ? 2
    : siteSeverityScore >= 25 ? 1
    : 1;

  const acresModifier = estimatedAcres > 1000 ? 2 : estimatedAcres > 500 ? 1 : 0;
  const totalQuads = baseQuads + acresModifier;
  const totalUnits = totalQuads * UNITS_PER_QUAD;

  const phase1Quads = totalQuads <= 1 ? totalQuads
    : totalQuads <= 3 ? 1
    : Math.min(2, Math.ceil(totalQuads * 0.5));
  const phase1Units = phase1Quads * UNITS_PER_QUAD;
  const isPhasedDeployment = totalQuads > 1;

  const phase1AnnualCost = phase1Units * COST_PER_UNIT_YEAR;
  const fullAnnualCost = totalUnits * COST_PER_UNIT_YEAR;
  const phase1GPM = phase1Units * 50;
  const fullGPM = totalUnits * 50;

  const sizingBasis = siteSeverityScore >= 75 ? 'Critical severity — multi-zone treatment'
    : siteSeverityScore >= 50 ? 'Degraded conditions — dual-zone treatment'
    : siteSeverityScore >= 25 ? 'Stressed conditions — targeted treatment'
    : 'Monitoring + preventive treatment';

  // ── Why PEARL bullets ──
  const whyBullets: WhyBullet[] = [];

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

  if (hasHabitat && !causesLower.some(c => c.includes('habitat'))) {
    // Inferred habitat degradation — not explicitly listed in ATTAINS
    whyBullets.push({ icon: '🐟', problem: 'Habitat degradation inferred: concurrent low DO, algal blooms, and poor clarity indicate living resource impairment', solution: 'PEARL addresses root causes (nutrients, sediment) to restore conditions for aquatic life' });
  } else if (hasHabitat) {
    whyBullets.push({ icon: '🐟', problem: 'Habitat degradation listed in ATTAINS — poor conditions for aquatic life', solution: 'PEARL improves DO, clarity, and nutrient levels to support biological community recovery' });
  }

  if (dataAgeDays !== null && dataAgeDays > 365) whyBullets.push({ icon: '📡', problem: `No monitoring data in ${Math.round(dataAgeDays / 365)} year${dataAgeDays > 730 ? 's' : ''} — site is operating blind`, solution: 'PEARL restores continuous, compliance-grade monitoring immediately' });
  else if (dataAgeDays !== null && dataAgeDays > 30) whyBullets.push({ icon: '📡', problem: `Data is ${dataAgeDays} days old — confidence is ${dataAgeDays > 90 ? 'low' : 'moderate'}`, solution: 'PEARL delivers continuous 15-min interval monitoring' });

  if (tmdlStatus === 'needed') whyBullets.push({ icon: '📋', problem: 'No TMDL established — regulatory exposure is open', solution: 'PEARL data supports TMDL development and load allocation' });

  if (whyBullets.length === 0) whyBullets.push({ icon: '🛡️', problem: 'Waterbody at risk without active monitoring', solution: 'PEARL provides early warning and baseline data' });

  // ── Healthy waterbody check ──
  const isHealthy = level === 'none'
    && !attainsCategory.includes('5') && !attainsCategory.includes('4')
    && (doSeverity === 'adequate' || doSeverity === 'unknown')
    && (nutrientSeverity === 'normal' || nutrientSeverity === 'unknown')
    && (turbiditySeverity === 'clear' || turbiditySeverity === 'unknown')
    && !bacteriaElevated
    && whyBullets.length <= 1;

  return {
    regionName, stateAbbr, waterType,
    attainsCategory, attainsCauses, attainsCycle,
    isCat5, isImpaired, tmdlStatus,
    impairmentClassification, tier1Count, tier2Count, tier3Count, totalClassified, pearlAddressable, addressabilityPct,
    hasNutrients, hasBacteria, hasSediment, hasMetals, hasStormwaterMetals, hasMercury, hasPFAS, hasPCBs, hasTemperature, hasHabitat, hasTrash, hasOrganic, hasDOImpairment,
    doSeverity, bloomSeverity, turbiditySeverity, nutrientSeverity, nutrientExceedsBiofilt, bacteriaElevated,
    isMD, thresholdSource, thresholdSourceShort, doCritical, doStressed, chlBloom, chlSignificant, chlSevere, turbElevated, turbImpaired,
    doVal, chlVal, turbVal, tnVal, tpVal,
    siteSeverityScore, siteSeverityLabel, siteSeverityColor, doScore, bloomScore, turbScore, impairScore, monitoringGapScore,
    treatmentPriorities, categories,
    pearlModel, totalBMPs, compliancePathway,
    totalQuads, totalUnits, phase1Quads, phase1Units, isPhasedDeployment,
    phase1AnnualCost, fullAnnualCost, phase1GPM, fullGPM,
    sizingBasis, estimatedAcres, acresSource,
    dataAgeDays, dataConfidence,
    threats, whyBullets, isHealthy,
  };
}

// ─── ATTAINS Category Resolution Helper ──────────────────────────────────────
// Extracted so NCC and SCC can both use the same three-source worst-case logic

export function resolveAttainsCategory(
  perWbCategory: string,
  bulkCategory: string,
  alertLevel: AlertLevel,
): string {
  const fromLevel = alertLevel === 'high' ? '5' : alertLevel === 'medium' ? '4' : '';
  const candidates = [perWbCategory, bulkCategory, fromLevel].filter(c => /[1-5]/.test(c));
  if (candidates.length === 0) return perWbCategory || bulkCategory || '';
  return candidates.reduce((worst, c) => {
    const wNum = parseInt(worst.match(/[1-5]/)?.[0] || '0');
    const cNum = parseInt(c.match(/[1-5]/)?.[0] || '0');
    return cNum > wNum ? c : worst;
  });
}

// ── Cause Merge Helper ──
export function mergeAttainsCauses(perWbCauses: string[], bulkCauses: string[]): string[] {
  if (perWbCauses.length > 0 && bulkCauses.length > 0) {
    return [...new Set([...perWbCauses, ...bulkCauses])];
  }
  return perWbCauses.length > 0 ? perWbCauses : bulkCauses;
}
