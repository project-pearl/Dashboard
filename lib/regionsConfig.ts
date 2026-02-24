// lib/regionsConfig.ts
// ─────────────────────────────────────────────────────────────────────────────
// ALIA National Monitoring Network — Region Configuration
// Chesapeake Bay Watershed (7 states + DC) + Gulf of Mexico (5 states)
// Each state: 5 worst impaired waterways identified for ALIA deployment
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use RegionThresholds instead */
export type RegionParameterConfig = RegionThresholds;

export interface RegionThresholds {
  DO?:        { green?: { min?: number; max?: number }; yellow?: { min?: number; max?: number }; };
  turbidity?: { green?: { min?: number; max?: number }; yellow?: { min?: number; max?: number }; };
  TN?:        { green?: { min?: number; max?: number }; yellow?: { min?: number; max?: number }; };
  TP?:        { green?: { min?: number; max?: number }; yellow?: { min?: number; max?: number }; };
  TSS?:       { green?: { min?: number; max?: number }; yellow?: { min?: number; max?: number }; };
  salinity?:  { green?: { min?: number; max?: number }; yellow?: { min?: number; max?: number }; };
}

export interface RegionConfig {
  id: string;
  name: string;
  description?: string;
  dataSource?: string;
  thresholds?: RegionThresholds;
  watershed?: 'chesapeake' | 'gulf' | 'pacific' | 'greatlakes' | 'other';
  impairments?: string[];   // primary pollutant categories
  pearlFit?: string;        // why PEARL is suited for this site
  hasPearlData?: boolean;
}

// Default Chesapeake Bay thresholds (EPA TMDL targets)
const CHESAPEAKE_THRESHOLDS: RegionThresholds = {
  DO:        { green: { min: 5.0 },  yellow: { min: 3.5 }  },
  turbidity: { green: { max: 15 },   yellow: { max: 35 }   },
  TN:        { green: { max: 1.0 },  yellow: { max: 2.0 }  },
  TP:        { green: { max: 0.05 }, yellow: { max: 0.10 } },
  TSS:       { green: { max: 25 },   yellow: { max: 60 }   },
  salinity:  { green: { min: 5, max: 25 }, yellow: { min: 2, max: 30 } },
};

// Default Gulf of Mexico thresholds
const GULF_THRESHOLDS: RegionThresholds = {
  DO:        { green: { min: 4.0 },  yellow: { min: 2.0 }  },
  turbidity: { green: { max: 20 },   yellow: { max: 50 }   },
  TN:        { green: { max: 1.2 },  yellow: { max: 2.5 }  },
  TP:        { green: { max: 0.07 }, yellow: { max: 0.15 } },
  TSS:       { green: { max: 30 },   yellow: { max: 75 }   },
  salinity:  { green: { min: 10, max: 35 }, yellow: { min: 5, max: 40 } },
};

// Urban stormwater variant (tighter TSS/bacteria targets)
const URBAN_THRESHOLDS: RegionThresholds = {
  DO:        { green: { min: 5.0 },  yellow: { min: 3.5 }  },
  turbidity: { green: { max: 10 },   yellow: { max: 25 }   },
  TN:        { green: { max: 0.8 },  yellow: { max: 1.5 }  },
  TP:        { green: { max: 0.04 }, yellow: { max: 0.08 } },
  TSS:       { green: { max: 20 },   yellow: { max: 50 }   },
  salinity:  { green: { min: 0, max: 5 }, yellow: { min: 0, max: 10 } },
};

export const regionsConfig: RegionConfig[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  //  CHESAPEAKE BAY WATERSHED — 7 States + DC
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── MARYLAND ──────────────────────────────────────────────────────────────
  // Existing ALIA deployment state. Urban stormwater + Bay tributaries.
  {
    id: 'maryland_middle_branch',
    name: 'Middle Branch, Baltimore Harbor',
    dataSource: 'ALIA + MDE ambient',
    watershed: 'chesapeake',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['TSS', 'bacteria', 'nutrients', 'trash'],
    pearlFit: 'Active ALIA deployment. Urban CSO outfall, high sediment load from Gwynns Falls confluence. Oyster biofiltration addresses bacteria + TSS simultaneously.',
  },
  {
    id: 'maryland_back_river',
    name: 'Back River, Dundalk',
    dataSource: 'MDE ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'bacteria', 'low DO'],
    pearlFit: 'Adjacent to Back River WWTP — persistent nutrient exceedances from treatment plant bypass events. ALIA screens effluent-impacted stormwater before Bay entry.',
  },
  {
    id: 'maryland_gwynns_falls',
    name: 'Gwynns Falls, West Baltimore',
    dataSource: 'MDE ambient',
    watershed: 'chesapeake',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['TSS', 'bacteria', 'trash', 'metals'],
    pearlFit: 'Highest bacteria counts in Baltimore watershed. 65,000-acre urban drainage. ALIA atoutfall points intercepts sediment + bacteria before Middle Branch.',
  },
  {
    id: 'maryland_bear_creek',
    name: 'Bear Creek, Dundalk',
    dataSource: 'MDE ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['TSS', 'metals', 'bacteria'],
    pearlFit: 'Industrial legacy area — Sparrows Point steel mill site. High TSS from disturbed sediment. ALIA mechanical screening captures legacy particulates.',
  },
  {
    id: 'maryland_rock_creek_aa',
    name: 'Rock Creek, Anne Arundel Co.',
    dataSource: 'MDE ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'sediment', 'bacteria'],
    pearlFit: 'MS4 compliance target for Anne Arundel County. Suburban nutrient loading from residential development. ALIA provides measurable TMDL credit.',
  },

  // Existing MD regions (retained from original config)
  { id: 'maryland_inner_harbor', name: 'Inner Harbor, Baltimore', dataSource: 'ALIA + MDE ambient', watershed: 'chesapeake', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'TSS', 'trash'] },
  { id: 'maryland_patapsco', name: 'Patapsco River', dataSource: 'MDE ambient', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['sediment', 'nutrients'] },
  { id: 'maryland_severn', name: 'Severn River', dataSource: 'MDE ambient', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'bacteria'] },
  { id: 'maryland_patuxent', name: 'Patuxent River', dataSource: 'MDE ambient', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['sediment', 'nutrients'] },
  { id: 'maryland_potomac', name: 'Potomac River (MD)', dataSource: 'MDE ambient', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'sediment'] },
  { id: 'maryland_chester', name: 'Chester River', dataSource: 'MDE ambient', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'bacteria'] },
  { id: 'maryland_choptank', name: 'Choptank River', dataSource: 'MDE ambient', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'sediment'] },
  { id: 'maryland_gunpowder', name: 'Gunpowder River', dataSource: 'MDE ambient', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'sediment'] },
  { id: 'maryland_magothy', name: 'Magothy River', dataSource: 'MDE ambient', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'bacteria'] },
  { id: 'maryland_jones_falls', name: 'Jones Falls', dataSource: 'MDE ambient', watershed: 'chesapeake', thresholds: URBAN_THRESHOLDS, impairments: ['TSS', 'bacteria'] },
  { id: 'chesapeake_bay_main', name: 'Chesapeake Bay Mainstem', dataSource: 'CBP monitoring', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'low DO', 'sediment'] },

  // ─── VIRGINIA ──────────────────────────────────────────────────────────────
  // 75%+ of estuaries impaired. Elizabeth River is worst in entire Bay watershed.
  {
    id: 'virginia_elizabeth',
    name: 'Elizabeth River, Norfolk',
    dataSource: 'VA DEQ ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['sediment toxics', 'PAHs', 'metals', 'bacteria', 'low DO'],
    pearlFit: 'EPA-designated most polluted waterway in Chesapeake watershed. Navy/industrial legacy sediment. ALIA intercepts ongoing stormwater TSS before it resuspends contaminated bottom sediment.',
  },
  {
    id: 'virginia_lynnhaven',
    name: 'Lynnhaven River, Virginia Beach',
    dataSource: 'VA DEQ ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'shellfish closures', 'nutrients'],
    pearlFit: 'Chronic bacteria impairment causing shellfish harvest closures. ALIA oyster biofiltration directly addresses bacterial load — proven 850K+ CFU/day reduction in pilot.',
  },
  {
    id: 'virginia_james_lower',
    name: 'James River (Lower), Richmond',
    dataSource: 'VA DEQ ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'toxics', 'bacteria', 'PCBs'],
    pearlFit: '31st most polluted waterway nationally. 1.7M lbs toxic discharge. ALIA aturban outfalls filters stormwater carrying legacy pollutants.',
  },
  {
    id: 'virginia_rappahannock_tidal',
    name: 'Rappahannock River (Tidal)',
    dataSource: 'VA DEQ ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['sediment', 'nutrients', 'bacteria'],
    pearlFit: 'Major sediment contributor to Bay. Agricultural watershed drains into tidal zone. ALIA attributary confluences reduces sediment loading at scale.',
  },
  {
    id: 'virginia_back_bay',
    name: 'Back Bay, Virginia Beach',
    dataSource: 'VA DEQ ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'low DO', 'algal blooms'],
    pearlFit: 'Shallow embayment with chronic nutrient loading and low DO. ALIA oyster filtration improves DO while reducing TN/TP — dual benefit.',
  },

  // Existing VA regions
  { id: 'virginia_james', name: 'James River', dataSource: 'VA DEQ ambient', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'sediment'] },
  { id: 'virginia_york', name: 'York River', dataSource: 'VA DEQ ambient', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'bacteria'] },
  { id: 'virginia_rappahannock', name: 'Rappahannock River', dataSource: 'VA DEQ ambient', watershed: 'chesapeake', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['sediment', 'nutrients'] },

  // ─── PENNSYLVANIA ──────────────────────────────────────────────────────────
  // #1 contributor of nutrients + sediment to Bay via Susquehanna. Agricultural heartland.
  {
    id: 'pennsylvania_conestoga',
    name: 'Conestoga River, Lancaster Co.',
    dataSource: 'PA DEP ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'sediment', 'bacteria'],
    pearlFit: 'Highest nutrient loading tributary in entire Chesapeake watershed. Lancaster Co. agriculture drives chronic TN/TP. ALIA atoutfall points filters before Susquehanna entry.',
  },
  {
    id: 'pennsylvania_swatara',
    name: 'Swatara Creek, Lebanon Co.',
    dataSource: 'PA DEP ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['sediment', 'nutrients', 'AMD'],
    pearlFit: 'Combined agricultural sediment + legacy acid mine drainage. ALIA mechanical screening captures fine sediment; biofiltration addresses nutrient load.',
  },
  {
    id: 'pennsylvania_codorus',
    name: 'Codorus Creek, York',
    dataSource: 'PA DEP ambient',
    watershed: 'chesapeake',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['TSS', 'bacteria', 'nutrients'],
    pearlFit: 'Urban MS4 stormwater from York metro. High bacteria + TSS from combined sewer area. ALIA addresses MS4 permit requirements directly.',
  },
  {
    id: 'pennsylvania_pequea',
    name: 'Pequea Creek, Lancaster Co.',
    dataSource: 'PA DEP ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['sediment', 'nutrients'],
    pearlFit: 'Agricultural runoff hotspot. Heavy sediment from tillage operations. ALIA atstream confluence captures sediment before Susquehanna delivery.',
  },
  {
    id: 'pennsylvania_susquehanna_lower',
    name: 'Susquehanna River (Lower), Columbia',
    dataSource: 'PA DEP + USGS',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'sediment'],
    pearlFit: 'Last filtration opportunity before Conowingo Dam and Bay. Carries cumulative load from entire PA watershed. Strategic ALIA deployment maximizes downstream impact.',
  },

  // ─── DELAWARE ──────────────────────────────────────────────────────────────
  // Small state, significant urban + agricultural impairment feeding Bay watershed.
  {
    id: 'delaware_christina',
    name: 'Christina River, Wilmington',
    dataSource: 'DE DNREC ambient',
    watershed: 'chesapeake',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'TSS', 'metals'],
    pearlFit: 'Urban industrial corridor. Wilmington stormwater carries heavy bacterial + TSS load. ALIA atmajor outfalls addresses MS4 compliance for New Castle County.',
  },
  {
    id: 'delaware_brandywine',
    name: 'Brandywine Creek (Lower)',
    dataSource: 'DE DNREC ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'sediment', 'bacteria'],
    pearlFit: 'Suburban development driving nutrient + sediment loading. Creek feeds Christina → Delaware Bay. ALIA provides upstream intervention before urban reach.',
  },
  {
    id: 'delaware_red_clay',
    name: 'Red Clay Creek',
    dataSource: 'DE DNREC ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'nutrients'],
    pearlFit: 'Chronic bacteria impairment from aging septic systems + suburban runoff. ALIA biofiltration directly targets bacterial colony reduction.',
  },
  {
    id: 'delaware_appoquinimink',
    name: 'Appoquinimink River',
    dataSource: 'DE DNREC ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'bacteria'],
    pearlFit: 'Agricultural watershed transitioning to suburban. Nutrient loading from poultry operations. ALIA reduces TN/TP at discharge points.',
  },
  {
    id: 'delaware_st_jones',
    name: 'St. Jones River, Dover',
    dataSource: 'DE DNREC ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'sediment'],
    pearlFit: 'State capital urban stormwater + agricultural transition zone. Moderate but persistent nutrient loading. ALIA pilot would demonstrate state-level commitment.',
  },

  // ─── WASHINGTON DC ─────────────────────────────────────────────────────────
  // Dense urban watershed. Combined sewer overflows are primary driver.
  {
    id: 'dc_anacostia',
    name: 'Anacostia River',
    dataSource: 'DC DOEE ambient',
    watershed: 'chesapeake',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['TSS', 'bacteria', 'trash', 'PCBs', 'nutrients'],
    pearlFit: 'Most impaired urban river in DC. 18+ CSO outfalls. Massive sediment + bacteria loading. ALIA atstrategic outfalls addresses multiple pollutants simultaneously.',
  },
  {
    id: 'dc_rock_creek',
    name: 'Rock Creek (Lower)',
    dataSource: 'DC DOEE ambient',
    watershed: 'chesapeake',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'TSS', 'nutrients'],
    pearlFit: 'High bacteria counts from urban runoff through dense NW DC. Recreational waterway with persistent swimming advisories. ALIA reduces bacteria for public health benefit.',
  },
  {
    id: 'dc_oxon_run',
    name: 'Oxon Run',
    dataSource: 'DC DOEE ambient',
    watershed: 'chesapeake',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'TSS', 'trash'],
    pearlFit: 'SE DC stormwater channel. Environmental justice community. High TSS + bacteria from impervious surface runoff. ALIA deployment supports EJ restoration goals.',
  },
  {
    id: 'dc_watts_branch',
    name: 'Watts Branch',
    dataSource: 'DC DOEE ambient',
    watershed: 'chesapeake',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'sediment'],
    pearlFit: 'NE DC tributary to Anacostia. Active stream restoration corridor. ALIA complements existing green infrastructure with measurable pollutant reduction.',
  },
  {
    id: 'dc_hickey_run',
    name: 'Hickey Run',
    dataSource: 'DC DOEE ambient',
    watershed: 'chesapeake',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['metals', 'TSS', 'bacteria'],
    pearlFit: 'Industrial legacy drainage near DC rail yards. Metal + sediment contamination. ALIA mechanical screening captures particulate-bound metals.',
  },

  // ─── NEW YORK ──────────────────────────────────────────────────────────────
  // Southern tier drains to Susquehanna → Chesapeake. Agricultural + legacy industrial.
  {
    id: 'newyork_chemung',
    name: 'Chemung River, Elmira',
    dataSource: 'NY DEC ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'sediment', 'bacteria'],
    pearlFit: 'Major Susquehanna tributary with agricultural + urban loading from Elmira metro. ALIA atconfluence reduces cumulative nutrient delivery to PA reach.',
  },
  {
    id: 'newyork_susquehanna_upper',
    name: 'Susquehanna River, Binghamton',
    dataSource: 'NY DEC ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'TSS', 'bacteria'],
    pearlFit: 'Headwaters urban loading from Binghamton. Stormwater from legacy industrial area. Early intervention here reduces downstream accumulation across PA.',
  },
  {
    id: 'newyork_cayuga_inlet',
    name: 'Cayuga Inlet, Ithaca',
    dataSource: 'NY DEC ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'sediment', 'algal blooms'],
    pearlFit: 'Feeds Cayuga Lake which drains to Susquehanna system. Nutrient loading drives algal blooms. ALIA biofiltration reduces bloom-feeding nutrients.',
  },
  {
    id: 'newyork_owego_creek',
    name: 'Owego Creek, Tioga Co.',
    dataSource: 'NY DEC ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['sediment', 'nutrients'],
    pearlFit: 'Agricultural watershed with heavy sediment loading from dairy operations. ALIA captures fine sediment + associated phosphorus.',
  },
  {
    id: 'newyork_cohocton',
    name: 'Cohocton River, Steuben Co.',
    dataSource: 'NY DEC ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['sediment', 'nutrients'],
    pearlFit: 'Feeds Chemung → Susquehanna. Agricultural sediment delivery. Strategic PEARL placement at tributary junction intercepts load before major river.',
  },

  // ─── WEST VIRGINIA ─────────────────────────────────────────────────────────
  // Potomac headwaters. Agriculture + karst geology amplify nutrient transport.
  {
    id: 'westvirginia_shenandoah',
    name: 'Shenandoah River, Harpers Ferry',
    dataSource: 'WV DEP ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'algal blooms', 'intersex fish', 'bacteria'],
    pearlFit: 'Notorious for intersex fish linked to endocrine disruptors + nutrients. Algal bloom hotspot. ALIA biofiltration reduces nutrient concentrations driving biological impacts.',
  },
  {
    id: 'westvirginia_opequon',
    name: 'Opequon Creek, Berkeley Co.',
    dataSource: 'WV DEP ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'sediment'],
    pearlFit: 'Worst bacteria-impaired stream in WV eastern panhandle. Livestock + failing septic systems. ALIA directly targets bacterial reduction — proven 850K+ CFU/day capability.',
  },
  {
    id: 'westvirginia_potomac_sb',
    name: 'S. Branch Potomac River',
    dataSource: 'WV DEP ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['sediment', 'nutrients', 'bacteria'],
    pearlFit: 'Agricultural corridor — poultry + cattle operations along streambanks. Heavy sediment + nutrient delivery to Potomac mainstem. ALIA atkey tributaries.',
  },
  {
    id: 'westvirginia_cacapon',
    name: 'Cacapon River',
    dataSource: 'WV DEP ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'sediment'],
    pearlFit: 'Scenic river with increasing nutrient pressure from development. Early-stage impairment where ALIA prevents degradation before 303(d) listing.',
  },
  {
    id: 'westvirginia_lost_river',
    name: 'Lost River, Hardy Co.',
    dataSource: 'WV DEP ambient',
    watershed: 'chesapeake',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'sediment'],
    pearlFit: 'Karst geology rapidly transports livestock bacteria to surface water. ALIA atspring resurgence points intercepts contaminated groundwater entering stream.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  GULF OF MEXICO WATERSHED — 5 States
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── FLORIDA (Gulf Coast) ──────────────────────────────────────────────────
  // Existing ALIA deployment state (Panhandle). Expanding to Tampa Bay + SW coast.
  {
    id: 'florida_escambia',
    name: 'Escambia Bay, Pensacola',
    dataSource: 'PEARL + FL DEP ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'sediment', 'bacteria'],
    pearlFit: 'Active ALIA deployment since Milton pilot (Jan 2025). 88-95% TSS removal demonstrated. Expanding coverage across bay tributaries.',
  },
  {
    id: 'florida_pensacola_bay',
    name: 'Pensacola Bay',
    dataSource: 'PEARL + FL DEP ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'bacteria', 'sediment'],
    pearlFit: 'Adjacent to Escambia deployment. Navy base stormwater + urban runoff. ALIA network extends coverage across shared bay system.',
  },
  {
    id: 'florida_tampa_bay',
    name: 'Tampa Bay, Hillsborough Co.',
    dataSource: 'FL DEP ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'algal blooms', 'red tide', 'low DO'],
    pearlFit: 'Largest open-water estuary in FL. Piney Point disaster (2021) released 215M gal nutrient-laden water. ALIA reduces nutrient load feeding red tide and algal blooms.',
  },
  {
    id: 'florida_charlotte_harbor',
    name: 'Charlotte Harbor, Lee Co.',
    dataSource: 'FL DEP ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'red tide', 'algal blooms'],
    pearlFit: 'Red tide epicenter. Caloosahatchee River delivers Lake Okeechobee nutrients. ALIA atriver mouth reduces nutrient pulse feeding harmful algal blooms.',
  },
  {
    id: 'florida_apalachicola',
    name: 'Apalachicola Bay',
    dataSource: 'FL DEP ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['low freshwater flow', 'nutrients', 'oyster collapse'],
    pearlFit: 'Historic oyster fishery collapsed. ALIA oyster biofiltration component directly supports oyster population recovery while filtering remaining pollutants.',
  },
  // Existing FL regions
  { id: 'florida_blackwater', name: 'Blackwater River', dataSource: 'FL DEP ambient', watershed: 'gulf', thresholds: GULF_THRESHOLDS, impairments: ['sediment'] },
  { id: 'florida_yellow_river', name: 'Yellow River', dataSource: 'FL DEP ambient', watershed: 'gulf', thresholds: GULF_THRESHOLDS, impairments: ['sediment', 'nutrients'] },

  // ─── TEXAS ─────────────────────────────────────────────────────────────────
  // Houston Ship Channel + Galveston Bay are industrial epicenters. Gulf dead zone western edge.
  {
    id: 'texas_houston_ship',
    name: 'Houston Ship Channel',
    dataSource: 'TX CEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['low DO', 'bacteria', 'PCBs', 'dioxins', 'metals'],
    pearlFit: 'One of most polluted waterways in US. Industrial discharge + urban stormwater from 4th largest US metro. ALIA attributary outfalls reduces pollutant load entering channel.',
  },
  {
    id: 'texas_galveston',
    name: 'Galveston Bay',
    dataSource: 'TX CEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'low DO', 'PCBs'],
    pearlFit: 'Largest estuary in TX. $3.4B seafood + tourism economy threatened. Chronic bacteria closures. ALIA biofiltration addresses bacteria for shellfish harvest reopening.',
  },
  {
    id: 'texas_san_jacinto',
    name: 'San Jacinto River',
    dataSource: 'TX CEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['dioxins', 'bacteria', 'nutrients', 'TSS'],
    pearlFit: 'Superfund-adjacent contamination. Floods resuspend legacy toxics. ALIA mechanical screening captures contaminated sediment during storm events.',
  },
  {
    id: 'texas_lavaca',
    name: 'Lavaca Bay, Calhoun Co.',
    dataSource: 'TX CEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['mercury', 'bacteria', 'nutrients'],
    pearlFit: 'Mercury contamination from Alcoa plant. Fish consumption advisories active. ALIA captures particulate-bound mercury in stormwater runoff.',
  },
  {
    id: 'texas_corpus_christi',
    name: 'Corpus Christi Bay',
    dataSource: 'TX CEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'low DO'],
    pearlFit: 'Urban + industrial bay. Chronic bacteria impairment closes recreational areas. ALIA atbayou outfalls reduces bacteria before bay entry.',
  },

  // ─── LOUISIANA ─────────────────────────────────────────────────────────────
  // Ground zero for Gulf dead zone. Mississippi River nutrient delivery + coastal subsidence.
  {
    id: 'louisiana_pontchartrain',
    name: 'Lake Pontchartrain, New Orleans',
    dataSource: 'LA DEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'low DO', 'CSOs'],
    pearlFit: 'Urban lake receiving New Orleans CSO overflow. 630 sq mi surface area. ALIA atmajor canal outfalls intercepts bacteria + nutrients before lake entry.',
  },
  {
    id: 'louisiana_barataria',
    name: 'Barataria Bay',
    dataSource: 'LA DEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'oil residue', 'low DO', 'sediment'],
    pearlFit: 'Deepwater Horizon oil spill impact zone. Ongoing sediment contamination + nutrient loading. ALIA filters contaminated stormwater from restored marshland edges.',
  },
  {
    id: 'louisiana_calcasieu',
    name: 'Calcasieu River, Lake Charles',
    dataSource: 'LA DEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['mercury', 'nutrients', 'bacteria', 'industrial toxics'],
    pearlFit: 'Petrochemical corridor — 15+ industrial facilities discharge to river. ALIA atpublic waterway access points filters ambient pollutant load for community benefit.',
  },
  {
    id: 'louisiana_vermilion',
    name: 'Vermilion Bay',
    dataSource: 'LA DEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'low DO', 'hypoxia'],
    pearlFit: 'Adjacent to seasonal dead zone. Agricultural nutrient delivery from Atchafalaya system. ALIA reduces nutrient concentration entering hypoxia-prone waters.',
  },
  {
    id: 'louisiana_atchafalaya',
    name: 'Atchafalaya Basin Outfall',
    dataSource: 'LA DEQ + USGS',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'hypoxia', 'sediment'],
    pearlFit: 'Carries 30% of Mississippi River flow to Gulf. Primary driver of dead zone western extent. Strategic ALIA deployment at distributary channels reduces nutrient delivery.',
  },

  // ─── MISSISSIPPI ───────────────────────────────────────────────────────────
  // Coastal counties face hypoxia + hurricane recovery. Seafood economy at risk.
  {
    id: 'mississippi_biloxi',
    name: 'Biloxi Bay',
    dataSource: 'MS DEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['bacteria', 'low DO', 'nutrients'],
    pearlFit: 'Chronic bacteria closures impact $800M Gulf Coast seafood industry. ALIA biofiltration reopens shellfish harvesting areas by reducing bacterial counts.',
  },
  {
    id: 'mississippi_back_bay',
    name: 'Back Bay of Biloxi',
    dataSource: 'MS DEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['low DO', 'nutrients', 'bacteria', 'hypoxia'],
    pearlFit: 'Enclosed bay with severe seasonal hypoxia. Limited flushing concentrates nutrients. ALIA reduces nutrient load that drives oxygen depletion.',
  },
  {
    id: 'mississippi_pascagoula',
    name: 'Pascagoula River (Lower)',
    dataSource: 'MS DEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'sediment', 'bacteria'],
    pearlFit: 'Last unimpounded river in lower 48 — high conservation value. ALIA provides non-structural intervention that preserves natural flow while reducing pollutants.',
  },
  {
    id: 'mississippi_pearl_lower',
    name: 'Pearl River (Lower)',
    dataSource: 'MS DEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'sediment'],
    pearlFit: 'Jackson metro stormwater delivery. Chronic bacteria + nutrient loading from upstream urban area. ALIA atlower reach intercepts before coastal marsh impact.',
  },
  {
    id: 'mississippi_wolf_river',
    name: 'Wolf River, Gulfport',
    dataSource: 'MS DEQ ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['bacteria', 'TSS'],
    pearlFit: 'Urban stormwater from Gulfport. Post-hurricane development increased impervious cover. ALIA atoutfalls reduces bacteria + sediment before coastal delivery.',
  },

  // ─── ALABAMA ───────────────────────────────────────────────────────────────
  // Mobile Bay is 4th largest estuary in US. Dog River is most complained-about waterway in state.
  {
    id: 'alabama_mobile_bay',
    name: 'Mobile Bay (Upper)',
    dataSource: 'AL DEM ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'low DO', 'sediment', 'hypoxia'],
    pearlFit: '4th largest estuary in US. Jubilee events (mass fish kills from hypoxia) are increasing. ALIA reduces nutrient load driving oxygen depletion in shallow zones.',
  },
  {
    id: 'alabama_dog_river',
    name: 'Dog River, Mobile',
    dataSource: 'AL DEM ambient',
    watershed: 'gulf',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'TSS', 'trash'],
    pearlFit: 'Most impaired urban waterway in Alabama. Chronic bacteria from aging infrastructure. ALIA atmajor stormwater outfalls targets bacteria + TSS for recreational reopening.',
  },
  {
    id: 'alabama_fowl_river',
    name: 'Fowl River',
    dataSource: 'AL DEM ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'bacteria', 'low DO'],
    pearlFit: 'Residential development driving nutrient loading into Mobile Bay tributary. ALIA provides suburban-scale treatment that feeds cleaner water to bay.',
  },
  {
    id: 'alabama_bayou_la_batre',
    name: 'Bayou La Batre',
    dataSource: 'AL DEM ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['bacteria', 'shellfish closures', 'nutrients'],
    pearlFit: '"Seafood Capital of Alabama" — harvest closures from bacteria threaten local economy. ALIA biofiltration directly supports shellfish area reopening.',
  },
  {
    id: 'alabama_wolf_bay',
    name: 'Wolf Bay, Baldwin Co.',
    dataSource: 'AL DEM ambient',
    watershed: 'gulf',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'bacteria'],
    pearlFit: 'Tourist economy bay with increasing development pressure. Early-stage nutrient loading. ALIA prevents degradation before impairment reaches 303(d) threshold.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  OTHER REGIONS (existing)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'california_sf_bay', name: 'San Francisco Bay', dataSource: 'CA SWRCB ambient', watershed: 'pacific', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'mercury', 'PCBs'] },
  { id: 'california_los_angeles', name: 'Los Angeles River', dataSource: 'CA SWRCB ambient', watershed: 'pacific', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'metals', 'TSS'] },
  { id: 'california_santa_monica', name: 'Santa Monica Bay', dataSource: 'CA SWRCB ambient', watershed: 'pacific', thresholds: GULF_THRESHOLDS, impairments: ['bacteria', 'DDT legacy', 'nutrients'], pearlFit: 'Chronic beach closures from bacteria. DDT legacy sediment offshore. ALIA atstorm drain outfalls reduces bacteria counts for recreational reopening.' },
  { id: 'california_san_diego', name: 'San Diego Bay / Tijuana River', dataSource: 'CA SWRCB ambient', watershed: 'pacific', thresholds: GULF_THRESHOLDS, impairments: ['bacteria', 'trash', 'sediment', 'cross-border sewage'], pearlFit: 'Cross-border sewage crisis. Billions of gallons of untreated wastewater. ALIA atriver mouth and outfall points provides immediate bacterial reduction.' },
  { id: 'california_sacramento', name: 'Sacramento–San Joaquin Delta', dataSource: 'CA SWRCB ambient', watershed: 'pacific', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'pesticides', 'sediment', 'salinity intrusion'], pearlFit: 'Largest estuary on West Coast. Agricultural pesticide + nutrient loading threatens drinking water for 25M people. ALIA filters at key channelpoints.' },

  // ═══════════════════════════════════════════════════════════════════════════
  //  SOUTH ATLANTIC — NC, SC, GA
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── NORTH CAROLINA ────────────────────────────────────────────────────────
  // Neuse + Cape Fear basins most impaired. 400+ new miles proposed for 303(d) in 2024.
  {
    id: 'northcarolina_neuse',
    name: 'Neuse River Estuary, New Bern',
    dataSource: 'NC DEQ ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'algal blooms', 'fish kills', 'low DO'],
    pearlFit: 'Notorious for massive fish kills — 1 billion fish killed in 1991. Persistent nutrient loading from hog farms + WWTPs. ALIA reduces TN/TP driving algal blooms.',
  },
  {
    id: 'northcarolina_cape_fear',
    name: 'Cape Fear River (Lower)',
    dataSource: 'NC DEQ ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['PFAS', 'nutrients', 'bacteria', '1,4-dioxane'],
    pearlFit: 'GenX/PFAS contamination from Chemours plant. 500+ miles impaired in basin. ALIA mechanical screening captures particulate-bound contaminants at outfalls.',
  },
  {
    id: 'northcarolina_haw',
    name: 'Haw River, Alamance Co.',
    dataSource: 'NC DEQ ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'sediment', 'bacteria'],
    pearlFit: 'Feeds Jordan Lake drinking water supply for Raleigh-Durham. Nutrient loading threatens regional water supply. ALIA reduces TN/TP before reservoir entry.',
  },
  {
    id: 'northcarolina_pamlico',
    name: 'Pamlico Sound (Western)',
    dataSource: 'NC DEQ ambient',
    watershed: 'other',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'low DO', 'shellfish closures'],
    pearlFit: 'Largest lagoon on US East Coast. Agricultural runoff from Tar-Pamlico basin. ALIA attributary mouths filters nutrients before sound entry.',
  },
  {
    id: 'northcarolina_crabtree',
    name: 'Crabtree Creek, Raleigh',
    dataSource: 'NC DEQ ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['PCBs', 'bacteria', 'TSS'],
    pearlFit: 'PCB contamination from Ward Transformer Superfund site. Urban stormwater from growing Raleigh metro. ALIA captures particulate-bound PCBs + bacteria.',
  },

  // ─── SOUTH CAROLINA ────────────────────────────────────────────────────────
  {
    id: 'southcarolina_charleston',
    name: 'Charleston Harbor',
    dataSource: 'SC DES ambient',
    watershed: 'other',
    thresholds: GULF_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'metals', 'low DO'],
    pearlFit: 'Major port with urban stormwater + legacy industrial contamination. Bacteria closures impact shellfish industry. ALIA biofiltration targets bacterial reduction.',
  },
  {
    id: 'southcarolina_waccamaw',
    name: 'Waccamaw River, Myrtle Beach',
    dataSource: 'SC DES ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'turbidity'],
    pearlFit: 'Tourism-driven development increases impervious surface runoff. Beach bacteria advisories threaten $8B tourism economy. ALIA reduces bacteria at source.',
  },
  {
    id: 'southcarolina_saluda',
    name: 'Saluda River, Greenville',
    dataSource: 'SC DES ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'sediment', 'nutrients'],
    pearlFit: 'Urban growth corridor. Greenville MS4 stormwater + construction sediment. ALIA provides measurable pollutant reduction for permit compliance.',
  },
  {
    id: 'southcarolina_broad',
    name: 'Broad River (Lower)',
    dataSource: 'SC DES ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'nutrients'],
    pearlFit: 'Drains through Columbia metro area. Bacterial loading from aging infrastructure. ALIA atkey outfalls reduces bacterial load entering Congaree.',
  },
  {
    id: 'southcarolina_catawba',
    name: 'Catawba River, Rock Hill',
    dataSource: 'SC DES ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'sediment'],
    pearlFit: 'Cross-state river (NC→SC) with cumulative nutrient loading. Suburban development driving impairment. ALIA attributary confluences.',
  },

  // ─── GEORGIA ───────────────────────────────────────────────────────────────
  {
    id: 'georgia_savannah',
    name: 'Savannah River (Lower)',
    dataSource: 'GA EPD ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['low DO', 'bacteria', 'nutrients', 'legacy toxics'],
    pearlFit: 'Major port city + industrial corridor. DO impairment from harbor deepening + nutrient loading. ALIA improves DO via oyster biofiltration while filtering TSS.',
  },
  {
    id: 'georgia_altamaha',
    name: 'Altamaha River Estuary',
    dataSource: 'GA EPD ambient',
    watershed: 'other',
    thresholds: GULF_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'low DO'],
    pearlFit: 'Largest river system on East Coast between Chesapeake and St. Johns. ALIA atestuary edge protects critical marshland habitat.',
  },
  {
    id: 'georgia_chattahoochee',
    name: 'Chattahoochee River, Atlanta',
    dataSource: 'GA EPD ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'TSS', 'CSOs'],
    pearlFit: 'Metro Atlanta stormwater — 5.5M people in watershed. Chronic bacteria from CSOs. ALIA atmajor outfalls addresses bacteria for recreational use.',
  },
  {
    id: 'georgia_ogeechee',
    name: 'Ogeechee River',
    dataSource: 'GA EPD ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['low DO', 'bacteria'],
    pearlFit: 'Industrial discharge incident killed 38,000 fish in 2011. Ongoing DO impairment. ALIA biofiltration improves dissolved oxygen naturally.',
  },
  {
    id: 'georgia_satilla',
    name: 'Satilla River',
    dataSource: 'GA EPD ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'low DO'],
    pearlFit: 'Blackwater river with natural low DO + anthropogenic bacterial loading. ALIA addresses bacterial impairment without disrupting natural chemistry.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  GREAT LAKES WATERSHED — OH, MI, WI, IL, IN, MN
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── OHIO ──────────────────────────────────────────────────────────────────
  {
    id: 'ohio_cuyahoga',
    name: 'Cuyahoga River, Cleveland',
    dataSource: 'OH EPA ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['legacy sediment', 'bacteria', 'nutrients', 'habitat degradation'],
    pearlFit: 'Iconic river that caught fire in 1969. Still an EPA Area of Concern with 4 remaining impairments. ALIA aturban reaches addresses ongoing bacteria + sediment loading.',
  },
  {
    id: 'ohio_maumee',
    name: 'Maumee River, Toledo',
    dataSource: 'OH EPA ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['phosphorus', 'algal blooms', 'sediment'],
    pearlFit: 'Primary driver of Lake Erie harmful algal blooms. Largest Great Lakes tributary. ALIA atsub-watershed outfalls reduces phosphorus load before lake delivery.',
  },
  {
    id: 'ohio_grand',
    name: 'Grand River, Lake Co.',
    dataSource: 'OH EPA ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['sediment', 'nutrients', 'bacteria'],
    pearlFit: 'Agricultural + suburban runoff to Lake Erie. ALIA filters sediment-bound phosphorus at tributary mouths.',
  },
  {
    id: 'ohio_sandusky',
    name: 'Sandusky Bay',
    dataSource: 'OH EPA ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'algal blooms', 'low DO'],
    pearlFit: 'Shallow bay with chronic algal blooms fed by agricultural phosphorus. ALIA reduces nutrient concentrations in enclosed bay environment.',
  },
  {
    id: 'ohio_black_river',
    name: 'Black River, Lorain',
    dataSource: 'OH EPA ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['sediment', 'bacteria', 'legacy contamination'],
    pearlFit: 'EPA Area of Concern. Legacy industrial sediment contamination. ALIA captures ongoing stormwater sediment delivery to prevent recontamination.',
  },

  // ─── MICHIGAN ──────────────────────────────────────────────────────────────
  {
    id: 'michigan_rouge',
    name: 'Rouge River, Detroit',
    dataSource: 'MI EGLE ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['CSOs', 'bacteria', 'TSS', 'oil & grease'],
    pearlFit: 'Most impaired urban river in Michigan. 168 CSO outfalls. ALIA atstrategic points intercepts bacteria + sediment from combined sewer overflow events.',
  },
  {
    id: 'michigan_detroit_river',
    name: 'Detroit River',
    dataSource: 'MI EGLE ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['legacy sediment', 'bacteria', 'nutrients', 'habitat'],
    pearlFit: 'Connects Lake Huron to Lake Erie — strategic filtration point. EPA Area of Concern. ALIA reduces pollutant transfer between Great Lakes.',
  },
  {
    id: 'michigan_saginaw',
    name: 'Saginaw River / Bay',
    dataSource: 'MI EGLE ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['PCBs', 'dioxins', 'sediment', 'nutrients'],
    pearlFit: 'Largest Great Lakes AOC by area. Dow Chemical legacy contamination. ALIA captures contaminated stormwater sediment before bay entry.',
  },
  {
    id: 'michigan_kalamazoo',
    name: 'Kalamazoo River',
    dataSource: 'MI EGLE ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['PCBs', 'oil (Enbridge spill)', 'sediment'],
    pearlFit: '2010 Enbridge oil spill — 1M gallons. Ongoing PCB contamination. ALIA mechanical screening captures residual contaminated sediment during high-flow events.',
  },
  {
    id: 'michigan_clinton',
    name: 'Clinton River, Macomb Co.',
    dataSource: 'MI EGLE ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'sediment'],
    pearlFit: 'Suburban Detroit stormwater. High bacteria from aging septic + urban runoff. ALIA biofiltration targets bacteria for Lake St. Clair protection.',
  },

  // ─── WISCONSIN ─────────────────────────────────────────────────────────────
  {
    id: 'wisconsin_milwaukee',
    name: 'Milwaukee River Estuary',
    dataSource: 'WI DNR ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'PCBs', 'PAHs', 'legacy sediment'],
    pearlFit: 'EPA Area of Concern. Three rivers converge at Lake Michigan. ALIA atconfluence filters bacteria + contaminated sediment from urban core.',
  },
  {
    id: 'wisconsin_menomonee',
    name: 'Menomonee River, Milwaukee',
    dataSource: 'WI DNR ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'TSS', 'metals'],
    pearlFit: 'Industrial corridor stormwater. Heavy metal loading from manufacturing legacy. ALIA captures particulate-bound metals + bacteria.',
  },
  {
    id: 'wisconsin_fox',
    name: 'Fox River / Green Bay',
    dataSource: 'WI DNR ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['PCBs', 'nutrients', 'sediment'],
    pearlFit: 'Largest PCB remediation in US history. 39-mile contaminated reach. ALIA prevents recontamination by filtering ongoing stormwater sediment delivery.',
  },
  {
    id: 'wisconsin_sheboygan',
    name: 'Sheboygan River',
    dataSource: 'WI DNR ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['PCBs', 'PAHs', 'sediment'],
    pearlFit: 'EPA Area of Concern with legacy contamination. Ongoing urban stormwater delivery. ALIA atkey outfalls reduces sediment recontamination.',
  },
  {
    id: 'wisconsin_kinnickinnic',
    name: 'Kinnickinnic River, Milwaukee',
    dataSource: 'WI DNR ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'TSS', 'low DO'],
    pearlFit: 'Concrete-channelized urban river. CSO overflow hotspot. ALIA provides biological treatment capacity the hardened channel lacks.',
  },

  // ─── ILLINOIS ──────────────────────────────────────────────────────────────
  {
    id: 'illinois_chicago',
    name: 'Chicago River',
    dataSource: 'IL EPA ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'CSOs', 'low DO'],
    pearlFit: 'Reversed river that now flows away from Lake Michigan. Deep Tunnel system still overwhelmed during storms. ALIA atoverflow points reduces bacteria spikes.',
  },
  {
    id: 'illinois_calumet',
    name: 'Calumet River, South Chicago',
    dataSource: 'IL EPA ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['legacy sediment', 'metals', 'bacteria', 'oil'],
    pearlFit: 'Steel industry legacy — among most contaminated US waterways. EPA Area of Concern. ALIA captures ongoing industrial + urban stormwater pollutants.',
  },
  {
    id: 'illinois_des_plaines',
    name: 'Des Plaines River',
    dataSource: 'IL EPA ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'sediment'],
    pearlFit: 'Suburban Chicago drainage. WWTP effluent + stormwater nutrients. ALIA reduces nutrient loading that feeds downstream Mississippi/Gulf dead zone.',
  },
  {
    id: 'illinois_waukegan',
    name: 'Waukegan Harbor',
    dataSource: 'IL EPA ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['PCBs', 'legacy sediment', 'metals'],
    pearlFit: 'Superfund site. Outboard Marine Corp PCB contamination. ALIA prevents recontamination from stormwater sediment transport.',
  },
  {
    id: 'illinois_north_shore',
    name: 'North Shore Channel',
    dataSource: 'IL EPA ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'CSOs'],
    pearlFit: 'Evanston/Wilmette urban drainage to Lake Michigan. Bacteria from CSO events. ALIA reduces bacteria at discharge points protecting lakefront beaches.',
  },

  // ─── INDIANA ───────────────────────────────────────────────────────────────
  {
    id: 'indiana_grand_calumet',
    name: 'Grand Calumet River, Gary',
    dataSource: 'IN DEM ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['legacy toxics', 'metals', 'oil', 'bacteria', 'PCBs'],
    pearlFit: 'EPA calls it "most polluted river in the Midwest." Steel mill legacy. ALIA atremaining active outfalls captures ongoing industrial stormwater.',
  },
  {
    id: 'indiana_indiana_harbor',
    name: 'Indiana Harbor Canal',
    dataSource: 'IN DEM ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['heavy metals', 'PCBs', 'oil', 'legacy sediment'],
    pearlFit: 'Largest Great Lakes Superfund site by volume. 4.6M cubic yards contaminated sediment. ALIA prevents ongoing stormwater recontamination during remediation.',
  },
  {
    id: 'indiana_little_calumet',
    name: 'Little Calumet River',
    dataSource: 'IN DEM ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'nutrients', 'sediment'],
    pearlFit: 'Urban/industrial corridor draining to Lake Michigan. Chronic bacteria. ALIA atkey points reduces loading before lake entry.',
  },
  {
    id: 'indiana_trail_creek',
    name: 'Trail Creek, Michigan City',
    dataSource: 'IN DEM ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'sediment', 'nutrients'],
    pearlFit: 'Beach closures impact Indiana Dunes tourism. Bacteria from urban runoff. ALIA atcreek mouth reduces bacteria for beach reopening.',
  },
  {
    id: 'indiana_burns_ditch',
    name: 'Burns Ditch, Portage',
    dataSource: 'IN DEM ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'sediment'],
    pearlFit: 'Primary drainage channel for Little Calumet system. ALIA atoutfall provides last filtration before Lake Michigan discharge.',
  },

  // ─── MINNESOTA ─────────────────────────────────────────────────────────────
  {
    id: 'minnesota_st_louis',
    name: 'St. Louis River, Duluth',
    dataSource: 'MN PCA ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['legacy sediment', 'PAHs', 'mercury', 'habitat degradation'],
    pearlFit: 'Largest US tributary to Lake Superior. EPA Area of Concern. Steel + mining legacy. ALIA captures mercury-laden sediment from urban stormwater.',
  },
  {
    id: 'minnesota_mississippi_tc',
    name: 'Mississippi River, Twin Cities',
    dataSource: 'MN PCA ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'bacteria', 'PFAS', 'sediment'],
    pearlFit: 'Twin Cities metro stormwater + WWTP discharge. Nutrients here ultimately feed Gulf dead zone. ALIA atheadwater metro reduces downstream cumulative loading.',
  },
  {
    id: 'minnesota_minnesota_lower',
    name: 'Minnesota River (Lower)',
    dataSource: 'MN PCA ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['turbidity', 'nutrients', 'bacteria'],
    pearlFit: 'Most sediment-impaired river in state. Agricultural tiling + erosion. ALIA attributary outlets captures sediment + phosphorus before Mississippi River confluence.',
  },
  {
    id: 'minnesota_vermillion',
    name: 'Vermillion River, Dakota Co.',
    dataSource: 'MN PCA ambient',
    watershed: 'other',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'turbidity', 'nutrients'],
    pearlFit: 'Designated trout stream impaired by suburban growth. ALIA provides treatment compatible with cold-water fishery protection.',
  },
  {
    id: 'minnesota_bassett_creek',
    name: 'Bassett Creek, Minneapolis',
    dataSource: 'MN PCA ambient',
    watershed: 'other',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'TSS', 'chloride'],
    pearlFit: 'Urban creek draining to Mississippi through downtown Minneapolis. Road salt + bacteria loading. ALIA addresses bacteria and TSS at stormwater outfalls.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  WEST COAST — WA, OR (CA expanded above)
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── WASHINGTON ─────────────────────────────────────────────────────────────
  {
    id: 'washington_duwamish',
    name: 'Duwamish River, Seattle',
    dataSource: 'WA Ecology ambient',
    watershed: 'pacific',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['PCBs', 'arsenic', 'dioxins', 'bacteria'],
    pearlFit: 'Superfund site — most contaminated waterway in WA. Industrial legacy in urban Seattle. ALIA atstormwater outfalls prevents recontamination during cleanup.',
  },
  {
    id: 'washington_puget_south',
    name: 'Puget Sound (South), Tacoma',
    dataSource: 'WA Ecology ambient',
    watershed: 'pacific',
    thresholds: GULF_THRESHOLDS,
    impairments: ['nutrients', 'low DO', 'toxics', 'bacteria'],
    pearlFit: 'Low-DO zones expanding. Stormwater from Tacoma metro. ALIA biofiltration improves dissolved oxygen while reducing nutrient loading.',
  },
  {
    id: 'washington_commencement',
    name: 'Commencement Bay, Tacoma',
    dataSource: 'WA Ecology ambient',
    watershed: 'pacific',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['metals', 'PCBs', 'legacy sediment'],
    pearlFit: 'Superfund site — smelter + industrial legacy. ALIA captures contaminated stormwater sediment to prevent re-deposition in remediated bay.',
  },
  {
    id: 'washington_spokane',
    name: 'Spokane River',
    dataSource: 'WA Ecology ambient',
    watershed: 'pacific',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['PCBs', 'nutrients', 'temperature'],
    pearlFit: 'PCB-impaired from unknown sources. Phosphorus loading drives algal growth. ALIA addresses nutrient reduction while investigation of PCB sources continues.',
  },
  {
    id: 'washington_columbia_lower',
    name: 'Columbia River (Lower)',
    dataSource: 'WA Ecology ambient',
    watershed: 'pacific',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['temperature', 'toxics', 'bacteria'],
    pearlFit: 'Largest Pacific Northwest river. Temperature impairment from dams + stormwater. ALIA attributary outfalls reduces bacteria + sediment entering mainstem.',
  },

  // ─── OREGON ────────────────────────────────────────────────────────────────
  {
    id: 'oregon_willamette',
    name: 'Willamette River, Portland',
    dataSource: 'OR DEQ ambient',
    watershed: 'pacific',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['bacteria', 'mercury', 'temperature', 'legacy toxics'],
    pearlFit: 'Superfund site — Portland Harbor. 10-mile contaminated stretch. ALIA aturban stormwater outfalls prevents ongoing pollutant delivery to remediated sediment.',
  },
  {
    id: 'oregon_columbia_slough',
    name: 'Columbia Slough, Portland',
    dataSource: 'OR DEQ ambient',
    watershed: 'pacific',
    thresholds: URBAN_THRESHOLDS,
    impairments: ['bacteria', 'pesticides', 'metals', 'PCBs'],
    pearlFit: 'Industrial/airport drainage. Low-flow channel concentrates pollutants. ALIA provides continuous treatment in low-velocity environment ideal for biofiltration.',
  },
  {
    id: 'oregon_tualatin',
    name: 'Tualatin River',
    dataSource: 'OR DEQ ambient',
    watershed: 'pacific',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'bacteria', 'temperature'],
    pearlFit: 'Suburban Portland watershed. Phosphorus TMDL active. ALIA reduces nutrient loading to meet TMDL targets for MS4 permittees.',
  },
  {
    id: 'oregon_coos_bay',
    name: 'Coos Bay',
    dataSource: 'OR DEQ ambient',
    watershed: 'pacific',
    thresholds: GULF_THRESHOLDS,
    impairments: ['bacteria', 'sediment', 'shellfish closures'],
    pearlFit: 'Commercial oyster harvest area with bacteria closures. ALIA oyster biofiltration directly supports both water quality improvement and shellfish industry.',
  },
  {
    id: 'oregon_klamath',
    name: 'Klamath River (Upper)',
    dataSource: 'OR DEQ ambient',
    watershed: 'pacific',
    thresholds: CHESAPEAKE_THRESHOLDS,
    impairments: ['nutrients', 'algal blooms', 'low DO', 'fish kills'],
    pearlFit: 'Largest dam removal project in US history (2024). Post-dam nutrient pulse. ALIA filters nutrient-laden sediment during river restoration transition.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  REMAINING US STATES — Complete National Coverage (3 sites each)
  // ═══════════════════════════════════════════════════════════════════════════

  // Alaska
  { id: 'alaska_cook_inlet', name: 'Cook Inlet, Anchorage', dataSource: 'AK DEC ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['sediment', 'petroleum'], pearlFit: 'Glacial sediment + urban stormwater from Anchorage. ALIA screens petroleum-contaminated runoff.' },
  { id: 'alaska_matanuska', name: 'Matanuska River', dataSource: 'AK DEC ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['sediment', 'turbidity'] },
  { id: 'alaska_ship_creek', name: 'Ship Creek, Anchorage', dataSource: 'AK DEC ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'petroleum', 'metals'], pearlFit: 'Urban salmon stream in downtown Anchorage. Bacteria + petroleum from stormwater. ALIA protects salmon habitat.' },

  // Arizona
  { id: 'arizona_salt_river', name: 'Salt River, Phoenix', dataSource: 'AZ DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'metals'], pearlFit: 'Phoenix metro stormwater in arid channel. Concentrated pollutant load during monsoon events. ALIA captures first flush.' },
  { id: 'arizona_gila', name: 'Gila River', dataSource: 'AZ DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['sediment', 'nutrients', 'salinity'] },
  { id: 'arizona_santa_cruz', name: 'Santa Cruz River, Tucson', dataSource: 'AZ DEQ ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'nutrients'], pearlFit: 'Effluent-dependent stream. WWTP discharge is baseflow. ALIA polishes effluent for riparian habitat.' },

  // Arkansas
  { id: 'arkansas_buffalo', name: 'Buffalo River (Lower)', dataSource: 'AR DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients'], pearlFit: 'National River threatened by CAFO runoff. ALIA protects scenic waterway from agricultural nutrient loading.' },
  { id: 'arkansas_illinois', name: 'Illinois River, NW Arkansas', dataSource: 'AR DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['phosphorus', 'bacteria', 'algal blooms'], pearlFit: 'Poultry industry nutrient loading. Phosphorus TMDL active. ALIA reduces TP at discharge points.' },
  { id: 'arkansas_bayou_meto', name: 'Bayou Meto', dataSource: 'AR DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['sediment', 'nutrients'] },

  // Colorado
  { id: 'colorado_south_platte', name: 'South Platte River, Denver', dataSource: 'CO DPHE ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'selenium'], pearlFit: 'Denver metro stormwater. Selenium from agricultural irrigation return flow. ALIA aturban outfalls.' },
  { id: 'colorado_clear_creek', name: 'Clear Creek, Idaho Springs', dataSource: 'CO DPHE ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['metals', 'AMD', 'zinc'], pearlFit: 'Superfund site — mining legacy. Acid mine drainage. ALIA mechanical screening captures metal-laden sediment.' },
  { id: 'colorado_arkansas', name: 'Arkansas River, Pueblo', dataSource: 'CO DPHE ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['metals', 'sediment'] },

  // Connecticut
  { id: 'connecticut_housatonic', name: 'Housatonic River', dataSource: 'CT DEEP ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['PCBs', 'bacteria', 'metals'], pearlFit: 'GE Superfund site — PCB contamination. ALIA captures PCB-laden sediment at stormwater outfalls.' },
  { id: 'connecticut_naugatuck', name: 'Naugatuck River', dataSource: 'CT DEEP ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'CSOs', 'nutrients'] },
  { id: 'connecticut_harbor', name: 'New Haven Harbor', dataSource: 'CT DEEP ambient', watershed: 'other', thresholds: GULF_THRESHOLDS, impairments: ['bacteria', 'metals', 'legacy sediment'], pearlFit: 'Urban harbor with CSO overflow. ALIA atoutfalls reduces bacteria for recreational use.' },

  // Hawaii
  { id: 'hawaii_ala_wai', name: 'Ala Wai Canal, Honolulu', dataSource: 'HI DOH ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'sediment'], pearlFit: 'Most impaired waterway in Hawaii. Waikiki stormwater. ALIA atcanal inlets reduces bacteria threatening world-famous beach.' },
  { id: 'hawaii_pearl_harbor', name: 'Pearl Harbor', dataSource: 'HI DOH ambient', watershed: 'other', thresholds: GULF_THRESHOLDS, impairments: ['metals', 'petroleum', 'sediment'] },
  { id: 'hawaii_kaneohe', name: 'Kaneohe Bay', dataSource: 'HI DOH ambient', watershed: 'other', thresholds: GULF_THRESHOLDS, impairments: ['nutrients', 'sediment', 'coral stress'], pearlFit: 'Coral reef bay threatened by urban runoff. ALIA reduces sediment + nutrients to protect reef ecosystem.' },

  // Idaho
  { id: 'idaho_boise', name: 'Boise River (Lower)', dataSource: 'ID DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['sediment', 'bacteria', 'temperature'] },
  { id: 'idaho_coeur_dalene', name: "Coeur d'Alene River", dataSource: 'ID DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['metals', 'lead', 'zinc', 'legacy mining'], pearlFit: 'Largest Superfund site by area in US. Century of mining waste. ALIA captures metal-laden stormwater runoff.' },
  { id: 'idaho_snake_lower', name: 'Snake River (Lower)', dataSource: 'ID DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'sediment', 'temperature'] },

  // Iowa
  { id: 'iowa_des_moines', name: 'Des Moines River', dataSource: 'IA DNR ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nitrate', 'bacteria', 'sediment'], pearlFit: 'Top contributor to Gulf dead zone. $1.5M/year for nitrate removal at water treatment. ALIA reduces upstream loading.' },
  { id: 'iowa_raccoon', name: 'Raccoon River', dataSource: 'IA DNR ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nitrate', 'bacteria'], pearlFit: 'Des Moines drinking water source. Chronic nitrate exceedances from row crop agriculture. ALIA attributary points.' },
  { id: 'iowa_iowa_river', name: 'Iowa River, Iowa City', dataSource: 'IA DNR ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'sediment'] },

  // Kansas
  { id: 'kansas_kansas_river', name: 'Kansas River, Lawrence', dataSource: 'KS DHE ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'sediment'] },
  { id: 'kansas_smoky_hill', name: 'Smoky Hill River', dataSource: 'KS DHE ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['chloride', 'sediment'] },
  { id: 'kansas_tuttle_creek', name: 'Tuttle Creek Reservoir', dataSource: 'KS DHE ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'algal blooms', 'sediment'], pearlFit: 'Chronic HABs close recreational areas. ALIA reduces nutrient load feeding cyanobacteria blooms.' },

  // Kentucky
  { id: 'kentucky_ohio_river', name: 'Ohio River, Louisville', dataSource: 'KY DEP ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'CSOs'], pearlFit: 'Louisville CSO system serves 200K+ residents. ALIA atoverflow points reduces bacteria during wet weather.' },
  { id: 'kentucky_beargrass', name: 'Beargrass Creek, Louisville', dataSource: 'KY DEP ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'TSS'] },
  { id: 'kentucky_licking', name: 'Licking River', dataSource: 'KY DEP ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'sediment'] },

  // Maine
  { id: 'maine_androscoggin', name: 'Androscoggin River', dataSource: 'ME DEP ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'low DO', 'legacy toxics'], pearlFit: 'Historic paper mill pollution. Water quality improving but legacy impairments persist. ALIA accelerates recovery.' },
  { id: 'maine_penobscot', name: 'Penobscot River', dataSource: 'ME DEP ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['mercury', 'dioxins'] },
  { id: 'maine_casco_bay', name: 'Casco Bay, Portland', dataSource: 'ME DEP ambient', watershed: 'other', thresholds: GULF_THRESHOLDS, impairments: ['bacteria', 'nutrients'] },

  // Massachusetts
  { id: 'massachusetts_charles', name: 'Charles River, Boston', dataSource: 'MA DEP ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'CSOs'], pearlFit: 'Iconic river, B+ grade but CSOs still impact bacteria. ALIA atremaining overflow points achieves A-grade target.' },
  { id: 'massachusetts_mystic', name: 'Mystic River', dataSource: 'MA DEP ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'metals'] },
  { id: 'massachusetts_boston', name: 'Boston Harbor', dataSource: 'MA DEP ambient', watershed: 'other', thresholds: GULF_THRESHOLDS, impairments: ['bacteria', 'nutrients'], pearlFit: 'Massive cleanup success story but CSOs remain. ALIA provides last-mile bacteria reduction at remaining problem outfalls.' },

  // Missouri
  { id: 'missouri_mississippi_stl', name: 'Mississippi River, St. Louis', dataSource: 'MO DNR ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'CSOs'], pearlFit: 'Major Mississippi confluence point. St. Louis CSOs contribute to downstream Gulf dead zone. ALIA atoverflow points.' },
  { id: 'missouri_meramec', name: 'Meramec River', dataSource: 'MO DNR ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients'] },
  { id: 'missouri_grand', name: 'Grand River', dataSource: 'MO DNR ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['sediment', 'nutrients'] },

  // Montana
  { id: 'montana_clark_fork', name: 'Clark Fork River, Missoula', dataSource: 'MT DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['metals', 'sediment', 'nutrients'], pearlFit: 'Largest Superfund complex in US — 130 miles. Mining legacy. ALIA captures metals in stormwater.' },
  { id: 'montana_yellowstone', name: 'Yellowstone River (Lower)', dataSource: 'MT DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'sediment'] },
  { id: 'montana_silver_bow', name: 'Silver Bow Creek, Butte', dataSource: 'MT DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['metals', 'arsenic', 'copper'], pearlFit: 'Berkeley Pit Superfund headwaters. Chronic heavy metal loading. ALIA mechanical screening at downstream points.' },

  // Nebraska
  { id: 'nebraska_platte', name: 'Platte River (Lower)', dataSource: 'NE DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients'] },
  { id: 'nebraska_missouri_ne', name: 'Missouri River, Omaha', dataSource: 'NE DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'sediment'] },
  { id: 'nebraska_salt_creek', name: 'Salt Creek, Lincoln', dataSource: 'NE DEQ ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'TSS'], pearlFit: 'Lincoln metro stormwater. Chronic bacteria. ALIA aturban outfalls addresses MS4 compliance.' },

  // Nevada
  { id: 'nevada_truckee', name: 'Truckee River, Reno', dataSource: 'NV DEP ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'temperature', 'TDS'] },
  { id: 'nevada_las_vegas_wash', name: 'Las Vegas Wash', dataSource: 'NV DEP ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['nutrients', 'bacteria', 'selenium'], pearlFit: 'Sole drainage from Las Vegas metro to Lake Mead. Nutrient loading threatens drinking water for 25M people. ALIA atchannel.' },
  { id: 'nevada_humboldt', name: 'Humboldt River', dataSource: 'NV DEP ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['mercury', 'sediment'] },

  // New Hampshire
  { id: 'newhampshire_merrimack', name: 'Merrimack River', dataSource: 'NH DES ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'PFAS', 'nutrients'], pearlFit: 'PFAS contamination from firefighting foam. ALIA captures particulate-bound PFAS at stormwater outfalls.' },
  { id: 'newhampshire_great_bay', name: 'Great Bay Estuary', dataSource: 'NH DES ambient', watershed: 'other', thresholds: GULF_THRESHOLDS, impairments: ['nutrients', 'bacteria', 'eelgrass decline'] },
  { id: 'newhampshire_piscataquog', name: 'Piscataquog River', dataSource: 'NH DES ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria'] },

  // New Jersey
  { id: 'newjersey_passaic', name: 'Passaic River, Newark', dataSource: 'NJ DEP ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['dioxins', 'mercury', 'PCBs', 'bacteria'], pearlFit: 'Largest dioxin Superfund site in US — Diamond Alkali. ALIA prevents recontamination at urban stormwater outfalls.' },
  { id: 'newjersey_raritan', name: 'Raritan Bay', dataSource: 'NJ DEP ambient', watershed: 'other', thresholds: GULF_THRESHOLDS, impairments: ['bacteria', 'metals', 'CSOs'] },
  { id: 'newjersey_barnegat', name: 'Barnegat Bay', dataSource: 'NJ DEP ambient', watershed: 'other', thresholds: GULF_THRESHOLDS, impairments: ['nutrients', 'algal blooms', 'shellfish closures'], pearlFit: 'Shallow lagoon with chronic nutrient loading. Tourism economy threatened. ALIA reduces nutrients at stormwater inlets.' },

  // New Mexico
  { id: 'newmexico_rio_grande', name: 'Rio Grande, Albuquerque', dataSource: 'NM ED ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'temperature'], pearlFit: 'Albuquerque metro stormwater in arid river. ALIA atoutfalls captures concentrated pollutant load.' },
  { id: 'newmexico_pecos', name: 'Pecos River', dataSource: 'NM ED ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['salinity', 'bacteria'] },
  { id: 'newmexico_gila', name: 'Gila River (Upper)', dataSource: 'NM ED ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['temperature', 'sediment'] },

  // North Dakota
  { id: 'northdakota_red_river', name: 'Red River, Fargo', dataSource: 'ND DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'bacteria', 'sulfate'], pearlFit: 'Agricultural nutrient loading threatens Lake Winnipeg. ALIA reduces nutrient export at key tributary points.' },
  { id: 'northdakota_missouri_nd', name: 'Missouri River, Bismarck', dataSource: 'ND DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['sediment', 'bacteria'] },
  { id: 'northdakota_sheyenne', name: 'Sheyenne River', dataSource: 'ND DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'sulfate'] },

  // Oklahoma
  { id: 'oklahoma_illinois_ok', name: 'Illinois River, Tahlequah', dataSource: 'OK DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['phosphorus', 'algal blooms', 'bacteria'], pearlFit: 'Scenic Rivers Act waterway. Poultry litter phosphorus from Arkansas. ALIA reduces TP for recreational protection.' },
  { id: 'oklahoma_grand_lake', name: "Grand Lake o' the Cherokees", dataSource: 'OK DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'algal blooms'] },
  { id: 'oklahoma_north_canadian', name: 'North Canadian River, OKC', dataSource: 'OK DEQ ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'nutrients'] },

  // Rhode Island
  { id: 'rhodeisland_narragansett', name: 'Narragansett Bay', dataSource: 'RI DEM ambient', watershed: 'other', thresholds: GULF_THRESHOLDS, impairments: ['nutrients', 'low DO', 'hypoxia'], pearlFit: 'Hypoxia-prone estuary. WWTP nutrient loading. ALIA reduces nutrients in shallow embayment zones.' },
  { id: 'rhodeisland_providence', name: 'Providence River', dataSource: 'RI DEM ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'CSOs', 'metals'] },
  { id: 'rhodeisland_pawtuxet', name: 'Pawtuxet River', dataSource: 'RI DEM ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients'] },

  // South Dakota
  { id: 'southdakota_big_sioux', name: 'Big Sioux River, Sioux Falls', dataSource: 'SD DANR ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'TSS', 'nutrients'], pearlFit: 'Most impaired river in SD. Meatpacking + urban stormwater. ALIA addresses bacteria + TSS at outfalls.' },
  { id: 'southdakota_james', name: 'James River', dataSource: 'SD DANR ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'nutrients'] },
  { id: 'southdakota_whitewood', name: 'Whitewood Creek, Lead', dataSource: 'SD DANR ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['arsenic', 'metals', 'legacy mining'], pearlFit: 'Homestake Mine legacy. Arsenic contamination. ALIA captures metal-laden stormwater.' },

  // Tennessee
  { id: 'tennessee_cumberland', name: 'Cumberland River, Nashville', dataSource: 'TN DEC ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'CSOs'], pearlFit: 'Nashville metro CSOs + rapid growth. Bacteria closures affect recreational use. ALIA atoverflow points.' },
  { id: 'tennessee_harpeth', name: 'Harpeth River, Franklin', dataSource: 'TN DEC ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'bacteria', 'low DO'] },
  { id: 'tennessee_wolf_tn', name: 'Wolf River, Memphis', dataSource: 'TN DEC ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['sediment', 'bacteria'] },

  // Utah
  { id: 'utah_jordan', name: 'Jordan River, Salt Lake City', dataSource: 'UT DEQ ambient', watershed: 'other', thresholds: URBAN_THRESHOLDS, impairments: ['bacteria', 'nutrients', 'metals', 'low DO'], pearlFit: 'Most impaired river in UT. SLC metro stormwater. ALIA atkey outfalls addresses multiple pollutants.' },
  { id: 'utah_great_salt_lake', name: 'Great Salt Lake', dataSource: 'UT DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['receding shoreline', 'dust', 'mercury', 'selenium'] },
  { id: 'utah_utah_lake', name: 'Utah Lake', dataSource: 'UT DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'algal blooms', 'phosphorus'], pearlFit: 'Chronic HABs close lake annually. WWTP + agricultural phosphorus. ALIA reduces TP at tributary inflows.' },

  // Vermont
  { id: 'vermont_lake_champlain', name: 'Lake Champlain, Burlington', dataSource: 'VT DEC ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['phosphorus', 'algal blooms', 'bacteria'], pearlFit: 'EPA TMDL active. Agricultural phosphorus drives HABs. ALIA attributary mouths reduces TP before lake entry.' },
  { id: 'vermont_winooski', name: 'Winooski River', dataSource: 'VT DEC ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['bacteria', 'sediment'] },
  { id: 'vermont_otter_creek', name: 'Otter Creek', dataSource: 'VT DEC ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['nutrients', 'bacteria'] },

  // Wyoming
  { id: 'wyoming_north_platte', name: 'North Platte River', dataSource: 'WY DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['selenium', 'temperature'] },
  { id: 'wyoming_bighorn', name: 'Bighorn River', dataSource: 'WY DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['temperature', 'bacteria'] },
  { id: 'wyoming_powder_river', name: 'Powder River', dataSource: 'WY DEQ ambient', watershed: 'other', thresholds: CHESAPEAKE_THRESHOLDS, impairments: ['salinity', 'selenium'] },
];

// ─── Helper Functions ────────────────────────────────────────────────────────

export function getRegionById(id: string): RegionConfig | undefined {
  return regionsConfig.find((r) => r.id === id);
}

export function isChesapeakeBayRegion(id: string): boolean {
  const region = getRegionById(id);
  return region?.watershed === 'chesapeake' || id.includes('chesapeake') ||
    id.startsWith('maryland_') || id.startsWith('virginia_') ||
    id.startsWith('pennsylvania_') || id.startsWith('delaware_') ||
    id.startsWith('dc_') || id.startsWith('newyork_') ||
    id.startsWith('westvirginia_');
}

export function isGulfRegion(id: string): boolean {
  const region = getRegionById(id);
  return region?.watershed === 'gulf' ||
    id.startsWith('florida_') || id.startsWith('texas_') ||
    id.startsWith('louisiana_') || id.startsWith('mississippi_') ||
    id.startsWith('alabama_');
}

export function isGreatLakesRegion(id: string): boolean {
  const region = getRegionById(id);
  if (region?.watershed === 'greatlakes') return true;
  return id.startsWith('ohio_') || id.startsWith('michigan_') ||
    id.startsWith('wisconsin_') || id.startsWith('illinois_') ||
    id.startsWith('indiana_') || id.startsWith('minnesota_');
}

export function isPacificRegion(id: string): boolean {
  const region = getRegionById(id);
  return region?.watershed === 'pacific' ||
    id.startsWith('california_') || id.startsWith('washington_') ||
    id.startsWith('oregon_');
}

export function isSouthAtlanticRegion(id: string): boolean {
  return id.startsWith('northcarolina_') || id.startsWith('southcarolina_') ||
    id.startsWith('georgia_');
}

export function getRegionsByState(state: string): RegionConfig[] {
  const prefixMap: Record<string, string> = {
    MD: 'maryland_', VA: 'virginia_', PA: 'pennsylvania_', DE: 'delaware_',
    DC: 'dc_', NY: 'newyork_', WV: 'westvirginia_', FL: 'florida_',
    TX: 'texas_', LA: 'louisiana_', MS: 'mississippi_', AL: 'alabama_',
    CA: 'california_', NC: 'northcarolina_', SC: 'southcarolina_', GA: 'georgia_',
    OH: 'ohio_', MI: 'michigan_', WI: 'wisconsin_', IL: 'illinois_',
    IN: 'indiana_', MN: 'minnesota_', WA: 'washington_', OR: 'oregon_',
    AK: 'alaska_', AZ: 'arizona_', AR: 'arkansas_', CO: 'colorado_',
    CT: 'connecticut_', HI: 'hawaii_', ID: 'idaho_', IA: 'iowa_',
    KS: 'kansas_', KY: 'kentucky_', ME: 'maine_', MA: 'massachusetts_',
    MO: 'missouri_', MT: 'montana_', NE: 'nebraska_', NV: 'nevada_',
    NH: 'newhampshire_', NJ: 'newjersey_', NM: 'newmexico_', ND: 'northdakota_',
    OK: 'oklahoma_', RI: 'rhodeisland_', SD: 'southdakota_', TN: 'tennessee_',
    UT: 'utah_', VT: 'vermont_', WY: 'wyoming_',
  };
  const prefix = prefixMap[state];
  if (!prefix) return [];
  return regionsConfig.filter((r) => r.id.startsWith(prefix) || (state === 'MD' && r.id === 'chesapeake_bay_main')).sort((a, b) => a.name.localeCompare(b.name));
}
