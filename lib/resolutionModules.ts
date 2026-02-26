// =============================================================
// Resolution Modules — 25 Typed Strategy Definitions + Scoring
// =============================================================

export type CostTier = '$' | '$$' | '$$$' | '$$$$';
export type Timeline = '0-6 months' | '6-18 months' | '1-3 years' | '3-5 years' | '5+ years';

export interface StrategyModule {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  icon: string;
  dataSources: string[];
  primaryUsers: string[];
  outputs: string[];
  triggerCauses: string[];
  triggerConditions?: {
    tmdlNeeded?: boolean;
    minImpairedPct?: number;
    requireMultipleCauses?: boolean;
  };
  loadReductionRange: string;
  timeline: Timeline;
  costTier: CostTier;
  costNote: string;
  applicabilityBase: number;
}

export interface StrategyCategory {
  id: string;
  title: string;
  icon: string;
  color: string;
  modules: StrategyModule[];
}

export interface ScoredModule extends StrategyModule {
  applicabilityScore: number;
  matchedCauses: string[];
}

export interface ScoredCategory extends StrategyCategory {
  modules: ScoredModule[];
  topScore: number;
}

export interface ModuleScoringInput {
  topCauses: { cause: string; count: number }[];
  totalImpaired: number;
  totalWaterbodies: number;
  tmdlNeeded?: number;
  cat5?: number;
  cat4a?: number;
}

// ── Category 1: Source Control — Upstream BMPs (7 modules) ──

const SOURCE_CONTROL_MODULES: StrategyModule[] = [
  {
    id: '1.1', categoryId: 'source-control',
    title: 'Stormwater Retrofit Prioritizer',
    description: 'Ranks sub-catchments by impervious cover, pollutant loading, and downstream impairment severity to prioritize bioretention, permeable pavement, and green-roof retrofits where they deliver the greatest load reduction per dollar.',
    icon: '🏗️',
    dataSources: ['ATTAINS impairment data', 'NLCD impervious cover', 'MS4 outfall inventory', 'NWIS stream gauges'],
    primaryUsers: ['MS4 Managers', 'Stormwater Engineers', 'Municipal Planners'],
    outputs: ['Prioritized retrofit site list', 'Estimated load-reduction curves', 'Capital cost estimates per site'],
    triggerCauses: ['nutrient', 'nitrogen', 'phosphor', 'sediment', 'turbidity', 'metal', 'bacteria'],
    loadReductionRange: '40-80% TSS, 30-60% nutrients, 50-90% metals',
    timeline: '1-3 years', costTier: '$$$', costNote: '$100K-$2M per project',
    applicabilityBase: 30,
  },
  {
    id: '1.2', categoryId: 'source-control',
    title: 'Illicit Discharge Elimination Tracker',
    description: 'Maps every MS4 outfall, schedules dry-weather screening rounds, logs field results, and tracks source-tracing investigations through to confirmed elimination — generating the documentation trail MS4 permits require.',
    icon: '🔍',
    dataSources: ['MS4 outfall GIS layer', 'Dry-weather screening logs', 'ICIS-NPDES permit records', 'WQP field results'],
    primaryUsers: ['MS4 Managers', 'Field Inspectors', 'Permit Compliance Officers'],
    outputs: ['Outfall screening schedule', 'Source-trace investigation log', 'Annual IDDE compliance report'],
    triggerCauses: ['pathogen', 'bacteria', 'e. coli', 'fecal', 'enterococ', 'nutrient', 'oil', 'toxic'],
    loadReductionRange: 'Varies by source eliminated',
    timeline: '6-18 months', costTier: '$$', costNote: '$50K-$300K program cost',
    applicabilityBase: 25,
  },
  {
    id: '1.3', categoryId: 'source-control',
    title: 'Construction Erosion Control Monitor',
    description: 'Overlays active construction permits with downstream 303(d) segments to flag high-risk sites, schedules inspections, and tracks BMP installation and maintenance through project close-out.',
    icon: '🚧',
    dataSources: ['Construction permit database', 'ATTAINS 303(d) listings', 'NLCD land-cover change', 'Inspection records'],
    primaryUsers: ['Construction Inspectors', 'MS4 Managers', 'State Regulators'],
    outputs: ['High-risk site watchlist', 'Inspection schedule with results', 'Erosion BMP compliance tracker'],
    triggerCauses: ['sediment', 'turbidity', 'siltation', 'total suspended'],
    loadReductionRange: '60-90% TSS during construction',
    timeline: '0-6 months', costTier: '$', costNote: '$5K-$50K per site',
    applicabilityBase: 20,
  },
  {
    id: '1.4', categoryId: 'source-control',
    title: 'Agricultural Load Allocator',
    description: 'Combines USDA cropland data with edge-of-field monitoring and ATTAINS impairment causes to allocate nutrient and sediment reduction targets across agricultural parcels, recommending cover-crop, no-till, and buffer practices that meet TMDL wasteload allocations.',
    icon: '🌾',
    dataSources: ['USDA Cropland Data Layer', 'ATTAINS impairment data', 'NWIS nutrient monitoring', 'CEAP edge-of-field data'],
    primaryUsers: ['Agricultural Advisors', 'State NPS Program Staff', 'Conservation Districts'],
    outputs: ['Parcel-level load-reduction targets', 'BMP recommendation matrix', 'Cost-share eligibility report'],
    triggerCauses: ['nutrient', 'nitrogen', 'phosphor', 'sediment', 'siltation', 'pesticide', 'herbicide'],
    loadReductionRange: '25-50% nutrients, 40-70% sediment',
    timeline: '6-18 months', costTier: '$$', costNote: '$50-$200 per acre annually',
    applicabilityBase: 15,
  },
  {
    id: '1.5', categoryId: 'source-control',
    title: 'MS4 Outfall Screening Scheduler',
    description: 'Generates optimized dry-weather and wet-weather screening routes for MS4 outfalls based on drainage area risk scores, past violations, and downstream impairment status — ensuring permit-required screening frequencies are met efficiently.',
    icon: '📋',
    dataSources: ['MS4 outfall inventory', 'ATTAINS downstream impairments', 'ICIS-NPDES violation history', 'Weather forecast API'],
    primaryUsers: ['MS4 Managers', 'Field Crew Supervisors', 'Permit Compliance Officers'],
    outputs: ['Optimized screening route maps', 'Risk-ranked outfall priority list', 'Screening frequency compliance dashboard'],
    triggerCauses: ['pathogen', 'bacteria', 'nutrient', 'sediment', 'metal', 'oil'],
    loadReductionRange: 'Indirect — enables faster IDDE detection',
    timeline: '0-6 months', costTier: '$', costNote: '$10K-$50K program setup',
    applicabilityBase: 20,
  },
  {
    id: '1.6', categoryId: 'source-control',
    title: 'Industrial Pretreatment Compliance Tracker',
    description: 'Monitors Significant Industrial Users against categorical and local pretreatment limits, flags exceedances, tracks enforcement actions, and generates the reporting packages POTWs must submit to their control authority.',
    icon: '🏭',
    dataSources: ['ICIS-NPDES permit & DMR data', 'Local pretreatment limits', 'SIU self-monitoring reports', 'ECHO compliance history'],
    primaryUsers: ['POTW Pretreatment Coordinators', 'Industrial Compliance Officers', 'State Regulators'],
    outputs: ['SIU compliance status dashboard', 'Exceedance alert log', 'Annual pretreatment report package'],
    triggerCauses: ['metal', 'mercury', 'lead', 'copper', 'zinc', 'toxic', 'organic', 'pcb', 'pfas', 'ph'],
    loadReductionRange: 'Source-dependent, 50-95% at point of discharge',
    timeline: '1-3 years', costTier: '$$$', costNote: '$200K-$5M per facility',
    applicabilityBase: 10,
  },
  {
    id: '1.7', categoryId: 'source-control',
    title: 'Septic System Risk Mapper',
    description: 'Identifies high-risk septic areas by overlaying soil permeability, water-table depth, system age, and proximity to impaired waterways — then prioritizes inspections, pump-out enforcement, and sewer-conversion funding.',
    icon: '🏠',
    dataSources: ['County septic permits', 'SSURGO soil data', 'ATTAINS impairment data', 'Census housing-age data'],
    primaryUsers: ['County Health Departments', 'MS4 Managers', 'State NPS Program Staff'],
    outputs: ['Septic risk heat map', 'Inspection priority list', 'Sewer-conversion cost-benefit analysis'],
    triggerCauses: ['pathogen', 'bacteria', 'nutrient', 'nitrogen', 'nitrate', 'fecal'],
    loadReductionRange: '50-90% bacteria, 30-70% nitrogen',
    timeline: '1-3 years', costTier: '$$$', costNote: '$10K-$30K per system conversion',
    applicabilityBase: 10,
  },
];

// ── Category 2: Nature-Based Solutions (6 modules) ──

const NATURE_BASED_MODULES: StrategyModule[] = [
  {
    id: '2.1', categoryId: 'nature-based',
    title: 'Riparian Buffer Designer',
    description: 'Analyzes stream reaches lacking adequate vegetated buffers by overlaying NLCD canopy data, SSURGO soils, and ATTAINS impairment causes — then generates planting plans with species mixes, widths, and expected nutrient/sediment interception rates.',
    icon: '🌳',
    dataSources: ['NLCD tree canopy', 'SSURGO soil data', 'ATTAINS impairment data', 'NHDPlus stream network'],
    primaryUsers: ['Watershed Coordinators', 'Conservation Districts', 'State NPS Program Staff'],
    outputs: ['Buffer gap analysis map', 'Species-specific planting plan', 'Projected load-reduction estimates'],
    triggerCauses: ['nutrient', 'sediment', 'temperature', 'thermal', 'siltation'],
    loadReductionRange: '30-80% nutrients, 50-90% sediment, 2-5°C thermal reduction',
    timeline: '1-3 years', costTier: '$$', costNote: '$500-$3K per acre',
    applicabilityBase: 25,
  },
  {
    id: '2.2', categoryId: 'nature-based',
    title: 'Wetland Restoration Siting Tool',
    description: 'Identifies optimal locations for wetland restoration or constructed-treatment wetlands by scoring hydric soils, historic wetland footprints, contributing drainage area, and downstream impairment severity.',
    icon: '🌿',
    dataSources: ['NWI wetland inventory', 'SSURGO hydric soils', 'ATTAINS impairment data', 'NLCD land cover'],
    primaryUsers: ['Wetland Scientists', 'Watershed Coordinators', 'State 401 Programs'],
    outputs: ['Candidate site ranking', 'Wetland design parameters', 'Expected treatment performance curves'],
    triggerCauses: ['nutrient', 'nitrogen', 'phosphor', 'pathogen', 'bacteria', 'sediment', 'metal'],
    loadReductionRange: '50-90% nutrients, 60-80% pathogens, 70-95% TSS',
    timeline: '1-3 years', costTier: '$$$', costNote: '$50K-$500K per acre',
    applicabilityBase: 25,
  },
  {
    id: '2.3', categoryId: 'nature-based',
    title: 'Living Shoreline Feasibility Assessor',
    description: 'Evaluates shoreline segments for living-shoreline suitability based on wave energy, sediment supply, existing habitat, and adjacent impairments — producing feasibility scores and conceptual designs using natural materials.',
    icon: '🐚',
    dataSources: ['NOAA shoreline data', 'ATTAINS coastal impairments', 'USACE wave energy models', 'NWI coastal wetlands'],
    primaryUsers: ['Coastal Managers', 'Marine Extension Agents', 'Municipal Planners'],
    outputs: ['Feasibility score per shoreline segment', 'Conceptual design schematics', 'Permit pathway checklist'],
    triggerCauses: ['sediment', 'turbidity', 'habitat', 'erosion'],
    loadReductionRange: '40-70% shoreline erosion reduction',
    timeline: '6-18 months', costTier: '$$$', costNote: '$200-$1K per linear foot',
    applicabilityBase: 10,
  },
  {
    id: '2.4', categoryId: 'nature-based',
    title: 'Floodplain Reconnection Planner',
    description: 'Models the hydrologic and water-quality benefits of reconnecting incised channels to their historic floodplains or removing obsolete dams — quantifying flood attenuation, sediment storage, and temperature improvement.',
    icon: '🌊',
    dataSources: ['NHDPlus flowlines', 'USGS dam inventory', 'FEMA floodplain maps', 'NWIS stream gauges'],
    primaryUsers: ['Floodplain Managers', 'State Dam Safety Programs', 'Watershed Coordinators'],
    outputs: ['Reconnection site priority list', 'Hydrologic benefit model results', 'Dam removal feasibility report'],
    triggerCauses: ['flow', 'hydrologic', 'habitat', 'temperature', 'dissolved oxygen', 'sediment'],
    loadReductionRange: 'Hydrologic regime restoration, fish passage',
    timeline: '3-5 years', costTier: '$$$$', costNote: '$1M-$20M per project',
    applicabilityBase: 10,
  },
  {
    id: '2.5', categoryId: 'nature-based',
    title: 'Urban Canopy Optimizer',
    description: 'Identifies urban heat-island and stormwater hotspots where strategic tree planting yields the highest combined benefit for stream-temperature reduction, runoff interception, and air-quality improvement.',
    icon: '🌲',
    dataSources: ['NLCD tree canopy & impervious', 'Urban heat island data', 'ATTAINS thermal impairments', 'Census demographic data'],
    primaryUsers: ['Urban Foresters', 'Municipal Planners', 'MS4 Managers'],
    outputs: ['Canopy gap priority map', 'Planting plan with species recommendations', 'Projected runoff & temperature benefits'],
    triggerCauses: ['nutrient', 'sediment', 'temperature', 'habitat'],
    loadReductionRange: '20-40% nutrient runoff, 2-5°C canopy cooling',
    timeline: '5+ years', costTier: '$$', costNote: '$1K-$10K per acre',
    applicabilityBase: 20,
  },
  {
    id: '2.6', categoryId: 'nature-based',
    title: 'Stream Channel Restoration Sequencer',
    description: 'Prioritizes degraded stream reaches for natural channel design restoration by scoring bank erosion rates, habitat impairment severity, and upstream sediment supply — then sequences projects to maximize cumulative benefit.',
    icon: '🏞️',
    dataSources: ['NHDPlus stream network', 'ATTAINS biological impairments', 'NWIS sediment data', 'LiDAR terrain models'],
    primaryUsers: ['Stream Restoration Engineers', 'Watershed Coordinators', 'State 319 Program Staff'],
    outputs: ['Reach-by-reach priority ranking', 'Restoration sequencing timeline', 'Sediment-budget analysis'],
    triggerCauses: ['sediment', 'turbidity', 'habitat', 'biological', 'benthic', 'dissolved oxygen'],
    loadReductionRange: '50-80% bank erosion, habitat score improvement',
    timeline: '1-3 years', costTier: '$$$$', costNote: '$500K-$5M per mile',
    applicabilityBase: 15,
  },
];

// ── Category 3: PEARL Treatment Accelerator (3 modules) ──

const PEARL_MODULES: StrategyModule[] = [
  {
    id: '3.1', categoryId: 'pearl-accelerator',
    title: 'PEARL ALIA Deployment Planner',
    description: 'Identifies optimal outfall locations for PEARL ALIA biofiltration units by scoring drainage area pollutant loads, downstream impairment severity, and site logistics — then generates deployment plans with expected performance benchmarks.',
    icon: '🔬',
    dataSources: ['ATTAINS impairment data', 'MS4 outfall inventory', 'WQP monitoring results', 'PEARL performance database'],
    primaryUsers: ['PEARL Deployment Engineers', 'MS4 Managers', 'State Regulators'],
    outputs: ['Deployment site priority list', 'Expected removal efficiency per site', 'Installation logistics plan'],
    triggerCauses: ['nutrient', 'nitrogen', 'phosphor', 'sediment', 'turbidity', 'pathogen', 'bacteria', 'total suspended'],
    loadReductionRange: '88-95% TSS, 94% bacteria, 30-60% nutrients',
    timeline: '0-6 months', costTier: '$$$', costNote: '$50K-$500K per deployment',
    applicabilityBase: 30,
  },
  {
    id: '3.2', categoryId: 'pearl-accelerator',
    title: 'Real-Time Treatment Performance Dashboard',
    description: 'Streams live sensor data from deployed PEARL units — influent vs. effluent concentrations, flow rates, and maintenance alerts — into a unified dashboard with automated compliance reporting and performance trend analysis.',
    icon: '📡',
    dataSources: ['PEARL unit telemetry', 'NWIS real-time gauges', 'WQP continuous monitoring', 'Weather forecast API'],
    primaryUsers: ['PEARL Operations Staff', 'MS4 Managers', 'State Compliance Officers'],
    outputs: ['Live performance dashboard', 'Automated compliance reports', 'Maintenance alert queue'],
    triggerCauses: ['dissolved oxygen', 'chlorophyll', 'algae', 'cyanobacteria', 'nutrient', 'temperature'],
    loadReductionRange: 'Optimized treatment via continuous data feedback',
    timeline: '0-6 months', costTier: '$$', costNote: '$25K-$200K per system',
    applicabilityBase: 25,
  },
  {
    id: '3.3', categoryId: 'pearl-accelerator',
    title: 'Accelerated Restoration Timeline Modeler',
    description: 'Projects how PEARL deployments compress the traditional 5-10 year restoration arc by modeling cumulative load reductions against TMDL targets — generating milestone timelines for pilot-to-permanent scaling and regulatory credit documentation.',
    icon: '📈',
    dataSources: ['PEARL performance database', 'ATTAINS TMDL targets', 'WQP trend data', 'ICIS permit limits'],
    primaryUsers: ['Watershed Planners', 'State TMDL Program Staff', 'PEARL Business Development'],
    outputs: ['Restoration timeline projection', 'TMDL milestone tracker', 'Regulatory credit documentation package'],
    triggerCauses: ['nutrient', 'sediment', 'pathogen', 'bacteria', 'metal', 'dissolved oxygen', 'temperature', 'turbidity'],
    triggerConditions: { tmdlNeeded: true, minImpairedPct: 20 },
    loadReductionRange: 'Phase-dependent, documented benchmarks',
    timeline: '6-18 months', costTier: '$$$$', costNote: '$500K-$5M scaling budget',
    applicabilityBase: 20,
  },
];

// ── Category 4: Community Engagement & Stewardship (5 modules) ──

const COMMUNITY_MODULES: StrategyModule[] = [
  {
    id: '4.1', categoryId: 'community',
    title: 'Watershed Volunteer Coordinator',
    description: 'Matches citizen-science volunteers to monitoring gaps in the watershed — assigning sites, scheduling sampling events, managing QA/QC protocols, and uploading validated results to WQX for inclusion in state assessments.',
    icon: '🧪',
    dataSources: ['WQP monitoring gaps', 'ATTAINS assessment units', 'Volunteer registries', 'WQX submission portal'],
    primaryUsers: ['Watershed Groups', 'State Volunteer Monitoring Programs', 'Conservation Districts'],
    outputs: ['Volunteer site assignment map', 'Sampling event calendar', 'QA/QC validated data submissions'],
    triggerCauses: ['nutrient', 'pathogen', 'bacteria', 'sediment', 'dissolved oxygen', 'temperature', 'metal'],
    loadReductionRange: 'N/A — data collection & coverage expansion',
    timeline: '0-6 months', costTier: '$', costNote: '$5K-$50K program startup',
    applicabilityBase: 35,
  },
  {
    id: '4.2', categoryId: 'community',
    title: 'Public Water Quality Communicator',
    description: 'Translates complex impairment data into plain-language summaries, interactive maps, and shareable infographics that help residents understand local water quality conditions and what they can do to help.',
    icon: '📢',
    dataSources: ['ATTAINS impairment data', 'WQP monitoring results', 'Census demographic data', 'Local news feeds'],
    primaryUsers: ['Public Affairs Officers', 'Watershed Groups', 'K-12 Educators'],
    outputs: ['Plain-language water quality summaries', 'Interactive community map', 'Shareable infographic templates'],
    triggerCauses: ['nutrient', 'sediment', 'pathogen', 'bacteria'],
    loadReductionRange: '5-15% behavioral load reduction',
    timeline: '6-18 months', costTier: '$', costNote: '$10K-$100K campaign cost',
    applicabilityBase: 30,
  },
  {
    id: '4.3', categoryId: 'community',
    title: 'Adopt-a-Stream Program Manager',
    description: 'Manages the full lifecycle of stream adoption programs — from group registration and reach assignment through activity logging, photo documentation, and annual impact reporting to sponsors and municipalities.',
    icon: '🤝',
    dataSources: ['NHDPlus stream reaches', 'ATTAINS impairment data', 'Volunteer activity logs', 'Municipal partner records'],
    primaryUsers: ['Watershed Groups', 'Municipal Stormwater Programs', 'Corporate Sponsors'],
    outputs: ['Adopted reach map with group assignments', 'Activity & cleanup log', 'Annual impact report for sponsors'],
    triggerCauses: ['trash', 'debris', 'habitat', 'biological', 'bacteria'],
    loadReductionRange: 'Localized cleanup and stewardship impact',
    timeline: '0-6 months', costTier: '$', costNote: '$2K-$20K per program',
    applicabilityBase: 30,
  },
  {
    id: '4.4', categoryId: 'community',
    title: 'Environmental Justice Engagement Planner',
    description: 'Overlays EJScreen indicators with ATTAINS impairment data to identify overburdened communities, then generates targeted engagement plans with culturally appropriate outreach strategies and equitable investment prioritization.',
    icon: '⚖️',
    dataSources: ['EPA EJScreen', 'ATTAINS impairment data', 'Census ACS demographics', 'State EJ mapping tools'],
    primaryUsers: ['EJ Program Coordinators', 'State Regulators', 'Community Organizations'],
    outputs: ['EJ-impairment overlay map', 'Community engagement plan', 'Equitable investment priority matrix'],
    triggerCauses: ['nutrient', 'pathogen', 'bacteria', 'metal', 'toxic', 'pfas'],
    loadReductionRange: 'Equitable investment targeting',
    timeline: '1-3 years', costTier: '$$', costNote: '$50K-$500K program integration',
    applicabilityBase: 25,
  },
  {
    id: '4.5', categoryId: 'community',
    title: 'Targeted Outreach Campaign Builder',
    description: 'Uses impairment causes and land-use data to design behavior-change campaigns aimed at specific pollutant sources — lawn fertilizer, pet waste, improper disposal — with audience segmentation, messaging templates, and effectiveness tracking.',
    icon: '🎯',
    dataSources: ['ATTAINS cause data', 'NLCD land use', 'Census demographics', 'Campaign response metrics'],
    primaryUsers: ['MS4 Public Education Staff', 'Watershed Groups', 'Marketing Consultants'],
    outputs: ['Campaign design brief', 'Audience segmentation analysis', 'Pre/post behavior-change metrics'],
    triggerCauses: ['nutrient', 'pathogen', 'bacteria', 'sediment', 'metal', 'habitat'],
    loadReductionRange: '5-20% behavioral load reduction in target area',
    timeline: '6-18 months', costTier: '$', costNote: '$15K-$75K per campaign',
    applicabilityBase: 25,
  },
];

// ── Category 5: Regulatory & Planning (4 modules) ──

const REGULATORY_MODULES: StrategyModule[] = [
  {
    id: '5.1', categoryId: 'regulatory',
    title: 'TMDL Implementation Tracker',
    description: 'Tracks progress toward TMDL wasteload and load allocations by linking installed BMPs, permit compliance data, and ambient monitoring trends to the numeric targets in approved TMDL documents — flagging segments falling behind schedule.',
    icon: '📋',
    dataSources: ['ATTAINS TMDL data', 'ICIS-NPDES permits', 'WQP monitoring trends', 'BMP tracking databases'],
    primaryUsers: ['State TMDL Program Staff', 'EPA Regional Offices', 'Watershed Coordinators'],
    outputs: ['TMDL progress dashboard', 'Allocation tracking report', 'Behind-schedule segment alerts'],
    triggerCauses: ['nutrient', 'sediment', 'pathogen', 'bacteria', 'metal', 'dissolved oxygen', 'temperature', 'turbidity'],
    triggerConditions: { tmdlNeeded: true },
    loadReductionRange: 'Regulatory load allocation framework',
    timeline: '1-3 years', costTier: '$$$', costNote: '$100K-$500K per TMDL',
    applicabilityBase: 15,
  },
  {
    id: '5.2', categoryId: 'regulatory',
    title: 'Permit Compliance Pathway Generator',
    description: 'Analyzes an MS4 or NPDES permit\'s specific requirements against current program status, then generates a gap analysis and step-by-step compliance pathway with deadlines, responsible parties, and documentation templates.',
    icon: '📄',
    dataSources: ['ICIS-NPDES permit records', 'ECHO compliance history', 'MS4 annual reports', 'State permit templates'],
    primaryUsers: ['MS4 Managers', 'NPDES Permit Holders', 'Compliance Consultants'],
    outputs: ['Permit gap analysis', 'Compliance pathway timeline', 'Documentation template library'],
    triggerCauses: ['nutrient', 'sediment', 'metal', 'pathogen', 'bacteria'],
    loadReductionRange: 'Permit-driven BMP tracking',
    timeline: '6-18 months', costTier: '$$', costNote: '$50K-$300K compliance program',
    applicabilityBase: 20,
  },
  {
    id: '5.3', categoryId: 'regulatory',
    title: 'Funding & Grant Alignment Engine',
    description: 'Matches watershed restoration needs to eligible funding sources — CWA 319, SRF, USDA EQIP, FEMA BRIC, state revolving funds — by cross-referencing impairment types, project readiness, and grant cycle deadlines.',
    icon: '💰',
    dataSources: ['Grants.gov listings', 'EPA 319 program data', 'USDA EQIP allocations', 'State SRF project lists'],
    primaryUsers: ['Grant Writers', 'Watershed Coordinators', 'State NPS Program Staff'],
    outputs: ['Matched funding opportunity list', 'Application readiness checklist', 'Grant cycle calendar with deadlines'],
    triggerCauses: ['nutrient', 'sediment', 'pathogen', 'bacteria', 'metal', 'habitat', 'dissolved oxygen'],
    loadReductionRange: 'Comprehensive planning framework, funding eligibility',
    timeline: '1-3 years', costTier: '$$', costNote: '$100K-$400K plan development',
    applicabilityBase: 25,
  },
  {
    id: '5.4', categoryId: 'regulatory',
    title: 'Delisting Readiness Assessor',
    description: 'Evaluates whether an impaired segment has accumulated sufficient monitoring data and demonstrated sustained water quality improvement to support a delisting decision — generating the evidence package states need for their Integrated Report.',
    icon: '✅',
    dataSources: ['ATTAINS assessment history', 'WQP trend data', 'State WQ standards', 'Delisting methodology guides'],
    primaryUsers: ['State Assessment Staff', 'EPA Regional Offices', 'Watershed Coordinators'],
    outputs: ['Delisting evidence package', 'Trend analysis summary', 'Data sufficiency gap report'],
    triggerCauses: ['nutrient', 'nitrogen', 'phosphor', 'pathogen', 'bacteria', 'sediment'],
    loadReductionRange: 'Assessment-driven — supports formal delisting',
    timeline: '1-3 years', costTier: '$$', costNote: '$50K-$200K assessment package',
    applicabilityBase: 10,
  },
];

// ── Category Definitions ──

export const ALL_CATEGORIES: StrategyCategory[] = [
  {
    id: 'source-control',
    title: 'Source Control — Upstream BMPs',
    icon: '🛡️',
    color: 'border-green-200 bg-green-50/30',
    modules: SOURCE_CONTROL_MODULES,
  },
  {
    id: 'nature-based',
    title: 'Nature-Based Solutions',
    icon: '🌿',
    color: 'border-emerald-200 bg-emerald-50/30',
    modules: NATURE_BASED_MODULES,
  },
  {
    id: 'pearl-accelerator',
    title: 'PEARL Treatment Accelerator',
    icon: '⚡',
    color: 'border-cyan-200 bg-cyan-50/30',
    modules: PEARL_MODULES,
  },
  {
    id: 'community',
    title: 'Community Engagement & Stewardship',
    icon: '👥',
    color: 'border-violet-200 bg-violet-50/30',
    modules: COMMUNITY_MODULES,
  },
  {
    id: 'regulatory',
    title: 'Regulatory & Planning',
    icon: '⚖️',
    color: 'border-indigo-200 bg-indigo-50/30',
    modules: REGULATORY_MODULES,
  },
];

// ── Scoring Engine ──

export function scoreModules(input: ModuleScoringInput): ScoredCategory[] {
  const { topCauses, totalImpaired, totalWaterbodies, tmdlNeeded, cat5 } = input;
  const impairmentPct = totalWaterbodies > 0 ? (totalImpaired / totalWaterbodies) * 100 : 0;
  const causesLower = topCauses.map(c => ({ cause: c.cause.toLowerCase(), count: c.count }));

  return ALL_CATEGORIES
    .map((cat): ScoredCategory => {
      const scoredModules = cat.modules.map((mod): ScoredModule => {
        let score = mod.applicabilityBase;
        const matchedCauses: string[] = [];

        // Cause-match bonus: 8-18 per match, capped at +50
        let causeBonus = 0;
        for (const trigger of mod.triggerCauses) {
          const triggerLower = trigger.toLowerCase();
          for (const c of causesLower) {
            if (c.cause.includes(triggerLower) || triggerLower.includes(c.cause)) {
              const points = 8 + Math.min(10, Math.ceil(c.count / 100));
              causeBonus += points;
              matchedCauses.push(c.cause);
              break; // one match per trigger keyword
            }
          }
        }
        score += Math.min(50, causeBonus);

        // Condition bonuses (up to +20)
        const conds = mod.triggerConditions;
        if (conds) {
          if (conds.tmdlNeeded && ((tmdlNeeded && tmdlNeeded > 0) || (cat5 && cat5 > 0))) {
            score += 10;
          }
          if (conds.minImpairedPct && impairmentPct >= conds.minImpairedPct) {
            score += 5;
          }
          if (conds.requireMultipleCauses && topCauses.length >= 3) {
            score += 5;
          }
        }

        return {
          ...mod,
          applicabilityScore: Math.min(100, score),
          matchedCauses: [...new Set(matchedCauses)],
        };
      });

      // Sort modules by score descending
      scoredModules.sort((a, b) => b.applicabilityScore - a.applicabilityScore);

      return {
        ...cat,
        modules: scoredModules,
        topScore: scoredModules[0]?.applicabilityScore ?? 0,
      };
    })
    // Sort categories by highest module score
    .sort((a, b) => b.topScore - a.topScore);
}
