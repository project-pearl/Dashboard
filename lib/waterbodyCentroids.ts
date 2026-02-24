// lib/waterbodyCentroids.ts
// Waterway name → approximate centroid for SCC map markers.
// Three-tier resolution: (1) keyword match → (2) HUC-8 from ATTAINS ID → (3) state center cluster
// Coordinates are approximate — good enough for state-level map overview.

export interface WaterwayCentroid {
  lat: number;
  lon: number;
  keywords: string[];
}

// ─── Maryland — comprehensive waterway coverage ────────────────────────────────

const MD_WATERWAYS: WaterwayCentroid[] = [
  // ── Baltimore metro & harbor ──
  { lat: 39.2600, lon: -76.6230, keywords: ['middle branch', 'middle br'] },
  { lat: 39.2440, lon: -76.4000, keywords: ['back river'] },
  { lat: 39.2850, lon: -76.6700, keywords: ['gwynns falls', 'gwynn'] },
  { lat: 39.2250, lon: -76.5000, keywords: ['bear creek'] },
  { lat: 39.2830, lon: -76.6100, keywords: ['inner harbor'] },
  { lat: 39.3100, lon: -76.6100, keywords: ['jones falls'] },
  { lat: 39.1570, lon: -76.5310, keywords: ['stony creek'] },
  { lat: 39.3100, lon: -76.4040, keywords: ['frog mortar'] },
  { lat: 39.2200, lon: -76.5740, keywords: ['curtis creek', 'curtis bay'] },
  { lat: 39.1870, lon: -76.5780, keywords: ['marley creek', 'marley'] },
  { lat: 39.2520, lon: -76.5390, keywords: ['colgate creek'] },
  { lat: 39.3080, lon: -76.5190, keywords: ['herring run'] },
  { lat: 39.3470, lon: -76.5810, keywords: ['chinquapin'] },
  { lat: 39.2680, lon: -76.6050, keywords: ['baltimore harbor'] },
  { lat: 39.2720, lon: -76.5790, keywords: ['northwest harbor'] },
  { lat: 39.2920, lon: -76.4800, keywords: ['bread and cheese'] },
  { lat: 39.3370, lon: -76.3520, keywords: ['dundee creek', 'dundee'] },
  { lat: 39.2900, lon: -76.6300, keywords: ['stony run'] },
  { lat: 39.1870, lon: -76.5810, keywords: ['furnace creek'] },
  { lat: 39.2510, lon: -76.4890, keywords: ['lynch cove'] },

  // ── Patapsco system ──
  { lat: 39.2500, lon: -76.6200, keywords: ['patapsco'] },
  { lat: 39.3500, lon: -76.8820, keywords: ['north branch patapsco'] },
  { lat: 39.3500, lon: -76.9140, keywords: ['south branch patapsco'] },
  { lat: 39.4230, lon: -76.8890, keywords: ['morgan run'] },
  { lat: 39.4200, lon: -76.8900, keywords: ['liberty reservoir', 'liberty res'] },
  { lat: 39.3930, lon: -76.9780, keywords: ['piney run'] },

  // ── Gunpowder / Loch Raven ──
  { lat: 39.3900, lon: -76.3560, keywords: ['gunpowder'] },
  { lat: 39.4300, lon: -76.5500, keywords: ['loch raven'] },
  { lat: 39.6130, lon: -76.1490, keywords: ['deer creek'] },
  { lat: 39.4020, lon: -76.3650, keywords: ['little gunpowder'] },
  { lat: 39.6230, lon: -76.7430, keywords: ['prettyboy'] },
  { lat: 39.4390, lon: -76.3070, keywords: ['winters run'] },
  { lat: 39.3850, lon: -76.3550, keywords: ['bird river'] },

  // ── Potomac mainstem & major tribs ──
  { lat: 38.9500, lon: -77.0600, keywords: ['potomac'] },
  { lat: 39.2800, lon: -77.4500, keywords: ['monocacy'] },
  { lat: 39.4000, lon: -77.6500, keywords: ['antietam'] },
  { lat: 39.4100, lon: -77.5700, keywords: ['catoctin'] },
  { lat: 39.5500, lon: -77.8200, keywords: ['conococheague'] },
  { lat: 39.2000, lon: -77.2500, keywords: ['great seneca', 'seneca cr'] },
  { lat: 39.2200, lon: -77.2000, keywords: ['little seneca'] },
  { lat: 39.1800, lon: -77.1800, keywords: ['muddy branch'] },
  { lat: 39.1500, lon: -77.2800, keywords: ['ten mile creek'] },
  { lat: 38.9900, lon: -77.1500, keywords: ['cabin john'] },
  { lat: 39.5100, lon: -77.3900, keywords: ['fishing creek'] },
  { lat: 39.3800, lon: -77.4000, keywords: ['linganore'] },
  { lat: 39.6000, lon: -77.2700, keywords: ['double pipe', 'pipe creek'] },
  { lat: 39.2800, lon: -77.2300, keywords: ['little bennett'] },
  { lat: 39.5300, lon: -78.5900, keywords: ['north branch potomac'] },

  // ── Anacostia / PG County ──
  { lat: 38.9200, lon: -76.9700, keywords: ['anacostia'] },
  { lat: 38.9600, lon: -76.9800, keywords: ['northeast branch'] },
  { lat: 39.0000, lon: -77.0000, keywords: ['northwest branch'] },
  { lat: 38.9800, lon: -76.9200, keywords: ['paint branch'] },
  { lat: 39.0300, lon: -77.0300, keywords: ['sligo creek', 'sligo'] },
  { lat: 38.8800, lon: -76.9600, keywords: ['indian creek'] },
  { lat: 38.8500, lon: -76.9900, keywords: ['oxon run', 'oxon'] },
  { lat: 38.8000, lon: -76.9400, keywords: ['henson creek'] },
  { lat: 38.5700, lon: -77.0200, keywords: ['mattawoman'] },
  { lat: 38.7000, lon: -77.0800, keywords: ['piscataway'] },
  { lat: 38.7500, lon: -77.0300, keywords: ['broad creek'] },
  { lat: 38.4200, lon: -76.9400, keywords: ['zekiah'] },
  { lat: 38.5200, lon: -77.0200, keywords: ['port tobacco'] },
  { lat: 38.9100, lon: -76.9500, keywords: ['watts branch'] },
  { lat: 38.8700, lon: -76.9400, keywords: ['beaverdam'] },

  // ── Western shore — Anne Arundel ──
  { lat: 38.9600, lon: -76.4500, keywords: ['severn'] },
  { lat: 39.0600, lon: -76.4300, keywords: ['magothy'] },
  { lat: 38.9000, lon: -76.4700, keywords: ['south river'] },
  { lat: 38.8500, lon: -76.5200, keywords: ['rhode river'] },
  { lat: 38.8600, lon: -76.5000, keywords: ['west river'] },
  { lat: 38.9800, lon: -76.4700, keywords: ['spa creek'] },
  { lat: 38.9900, lon: -76.4800, keywords: ['college creek'] },
  { lat: 39.0000, lon: -76.5000, keywords: ['weems creek'] },
  { lat: 39.1300, lon: -76.4400, keywords: ['bodkin'] },

  // ── Patuxent system ──
  { lat: 38.7800, lon: -76.7000, keywords: ['patuxent'] },
  { lat: 39.1500, lon: -76.8500, keywords: ['upper patuxent'] },
  { lat: 38.5500, lon: -76.6500, keywords: ['lower patuxent'] },
  { lat: 39.1000, lon: -76.8800, keywords: ['little patuxent'] },
  { lat: 39.0800, lon: -76.8500, keywords: ['middle patuxent'] },
  { lat: 39.1500, lon: -76.7900, keywords: ['dorsey run'] },

  // ── Calvert / St. Mary's / Charles ──
  { lat: 38.7200, lon: -76.5300, keywords: ['herring bay'] },
  { lat: 38.3900, lon: -76.5000, keywords: ['st. leonard', 'st leonard'] },
  { lat: 38.4400, lon: -76.6100, keywords: ['battle creek'] },
  { lat: 38.5600, lon: -76.6500, keywords: ['hunting creek'] },
  { lat: 38.2600, lon: -76.6500, keywords: ['breton bay'] },
  { lat: 38.1000, lon: -76.4400, keywords: ["st. mary's", "st mary"] },
  { lat: 38.2300, lon: -76.7300, keywords: ['st. clement', 'st clement'] },
  { lat: 38.4000, lon: -77.1200, keywords: ['nanjemoy'] },
  { lat: 38.2500, lon: -76.8300, keywords: ['wicomico r'] },
  { lat: 38.2900, lon: -76.6500, keywords: ['mcintosh'] },
  { lat: 38.1200, lon: -76.4100, keywords: ['smith creek'] },

  // ── Eastern shore — upper (Cecil, Kent, QA) ──
  { lat: 39.4200, lon: -76.0400, keywords: ['elk river', 'elk r'] },
  { lat: 39.5400, lon: -76.0000, keywords: ['northeast river', 'northeast r'] },
  { lat: 39.5600, lon: -76.0400, keywords: ['principio'] },
  { lat: 39.3900, lon: -76.0500, keywords: ['sassafras'] },
  { lat: 39.4800, lon: -75.9400, keywords: ['bohemia'] },
  { lat: 39.0400, lon: -76.0700, keywords: ['chester river', 'chester r'] },
  { lat: 39.0900, lon: -76.1800, keywords: ['langford'] },
  { lat: 39.1200, lon: -76.1200, keywords: ['morgan creek'] },
  { lat: 39.0900, lon: -76.1600, keywords: ['corsica'] },
  { lat: 38.8500, lon: -76.2000, keywords: ['wye'] },

  // ── Eastern shore — middle (Talbot, Caroline, Dorchester) ──
  { lat: 38.7500, lon: -76.0000, keywords: ['choptank'] },
  { lat: 38.7800, lon: -76.1800, keywords: ['miles river', 'miles r'] },
  { lat: 38.6700, lon: -76.1900, keywords: ['tred avon'] },
  { lat: 38.6900, lon: -76.3000, keywords: ['harris creek'] },
  { lat: 38.8800, lon: -75.9000, keywords: ['tuckahoe'] },
  { lat: 38.7000, lon: -75.9000, keywords: ['kings creek'] },
  { lat: 38.3400, lon: -76.0200, keywords: ['fishing bay'] },
  { lat: 38.2300, lon: -76.1000, keywords: ['honga'] },
  { lat: 38.4500, lon: -76.0800, keywords: ['blackwater'] },
  { lat: 38.5300, lon: -75.7600, keywords: ['marshyhope'] },
  { lat: 39.0000, lon: -75.7900, keywords: ['greensboro'] },

  // ── Eastern shore — lower (Wicomico, Somerset, Worcester) ──
  { lat: 38.2300, lon: -75.9200, keywords: ['nanticoke'] },
  { lat: 38.3800, lon: -75.8200, keywords: ['rewastico'] },
  { lat: 38.2900, lon: -75.7600, keywords: ['wicomico'] },
  { lat: 38.1500, lon: -75.5500, keywords: ['pocomoke'] },
  { lat: 38.0900, lon: -75.9200, keywords: ['manokin'] },
  { lat: 38.0500, lon: -75.8700, keywords: ['big annemessex', 'annemessex'] },
  { lat: 38.0900, lon: -75.5400, keywords: ['dividing creek'] },
  { lat: 38.0630, lon: -75.9950, keywords: ['tangier sound'] },

  // ── Coastal bays ──
  { lat: 38.3800, lon: -75.0800, keywords: ['isle of wight'] },
  { lat: 38.4200, lon: -75.0600, keywords: ['assawoman'] },
  { lat: 38.3200, lon: -75.1000, keywords: ['sinepuxent'] },
  { lat: 38.3500, lon: -75.0500, keywords: ['st. martin', 'st martin'] },
  { lat: 38.3300, lon: -75.0800, keywords: ['coastal bay', 'ocean city'] },
  { lat: 38.2500, lon: -75.1500, keywords: ['chincoteague'] },

  // ── Chesapeake mainstem ──
  { lat: 38.8000, lon: -76.3500, keywords: ['chesapeake bay', 'chesapeake'] },
  { lat: 39.0500, lon: -76.3800, keywords: ['upper chesapeake', 'upper bay'] },
  { lat: 38.3000, lon: -76.2500, keywords: ['lower chesapeake', 'lower bay'] },

  // ── Western MD (Garrett, Allegany, Washington) ──
  { lat: 39.5100, lon: -79.3500, keywords: ['deep creek'] },
  { lat: 39.5800, lon: -79.4500, keywords: ['youghiogheny'] },
  { lat: 39.7200, lon: -78.5500, keywords: ['town creek'] },
  { lat: 39.6500, lon: -78.7500, keywords: ['wills creek'] },
  { lat: 39.4500, lon: -79.0500, keywords: ['savage river', 'savage r'] },
  { lat: 39.7200, lon: -78.2000, keywords: ['sideling hill'] },
  { lat: 39.6800, lon: -78.8000, keywords: ['georges creek'] },
  { lat: 39.6200, lon: -78.6500, keywords: ['jennings run'] },
  { lat: 39.6800, lon: -78.4000, keywords: ['fifteenmile'] },
  { lat: 39.6500, lon: -78.1500, keywords: ['tonoloway'] },
  { lat: 39.6000, lon: -78.0500, keywords: ['licking creek'] },
  { lat: 39.5500, lon: -79.2000, keywords: ['casselman'] },
  { lat: 39.5800, lon: -78.9000, keywords: ['north branch'] },
  { lat: 39.6300, lon: -78.3000, keywords: ['evitts creek'] },

  // ── Carroll / Frederick / Howard ──
  { lat: 39.5500, lon: -77.0000, keywords: ['big pipe', 'pipe cr'] },
  { lat: 39.5800, lon: -76.9500, keywords: ['little pipe'] },
  { lat: 39.4500, lon: -76.9000, keywords: ['liberty'] },
  { lat: 39.4200, lon: -77.0500, keywords: ['double pipe'] },
  { lat: 39.5200, lon: -76.8200, keywords: ['beaver run'] },
  { lat: 39.3000, lon: -77.2000, keywords: ['bennett creek'] },
  { lat: 39.3200, lon: -76.9800, keywords: ['gillis falls'] },

  // ── Susquehanna direct tribs (Harford, Cecil) ──
  { lat: 39.5700, lon: -76.0800, keywords: ['susquehanna'] },
  { lat: 39.5500, lon: -76.2000, keywords: ['conowingo'] },
  { lat: 39.6500, lon: -76.1800, keywords: ['octoraro'] },

  // ── County name keywords (catch-all for names with county references) ──
  { lat: 39.5300, lon: -79.0500, keywords: ['garrett'] },
  { lat: 39.6500, lon: -78.6500, keywords: ['allegany'] },
  { lat: 39.6000, lon: -77.8000, keywords: ['washington co'] },
  { lat: 39.4500, lon: -77.3000, keywords: ['frederick co'] },
  { lat: 39.5600, lon: -77.0000, keywords: ['carroll'] },
  { lat: 39.4000, lon: -76.6000, keywords: ['baltimore co'] },
  { lat: 39.3500, lon: -76.4500, keywords: ['harford'] },
  { lat: 39.5700, lon: -75.9500, keywords: ['cecil'] },
  { lat: 39.0800, lon: -76.0800, keywords: ['kent co'] },
  { lat: 39.0500, lon: -76.1500, keywords: ['queen anne'] },
  { lat: 38.9500, lon: -76.5200, keywords: ['anne arundel'] },
  { lat: 39.2000, lon: -76.8200, keywords: ['howard'] },
  { lat: 38.8200, lon: -76.7500, keywords: ['prince george', 'pg county'] },
  { lat: 38.5500, lon: -76.5800, keywords: ['calvert'] },
  { lat: 38.4800, lon: -76.9500, keywords: ['charles co'] },
  { lat: 38.7800, lon: -76.1500, keywords: ['talbot'] },
  { lat: 38.8500, lon: -75.8500, keywords: ['caroline'] },
  { lat: 38.4500, lon: -76.0500, keywords: ['dorchester'] },
  { lat: 38.3800, lon: -75.6500, keywords: ['wicomico co'] },
  { lat: 38.2000, lon: -75.5500, keywords: ['somerset'] },
  { lat: 38.3500, lon: -75.2000, keywords: ['worcester'] },

  // ── Common generic creek/run names (with region hint from other keywords) ──
  { lat: 39.1200, lon: -76.7500, keywords: ['rock creek'] },
  { lat: 39.0000, lon: -76.6000, keywords: ['mill creek'] },
  { lat: 39.2000, lon: -76.6500, keywords: ['spring branch'] },
  { lat: 39.1500, lon: -76.5500, keywords: ['red run'] },
  { lat: 38.9800, lon: -76.5800, keywords: ['cedar branch'] },
];

// ─── HUC-8 Centroids — parse from ATTAINS assessment unit IDs ─────────────────

const MD_HUC_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  // HUC-8 codes covering Maryland
  '02050306': { lat: 39.55, lon: -79.42 },   // Youghiogheny
  '02060001': { lat: 39.28, lon: -76.18 },   // Upper Chesapeake Bay
  '02060002': { lat: 39.10, lon: -76.02 },   // Chester-Sassafras
  '02060003': { lat: 38.82, lon: -75.92 },   // Choptank
  '02060004': { lat: 38.48, lon: -75.72 },   // Nanticoke
  '02060005': { lat: 38.12, lon: -75.52 },   // Pocomoke
  '02060006': { lat: 38.85, lon: -76.72 },   // Patuxent
  '02060007': { lat: 38.98, lon: -76.52 },   // Severn
  '02060008': { lat: 38.32, lon: -75.10 },   // Coastal Bays
  '02060009': { lat: 38.55, lon: -76.28 },   // Lower Chesapeake Bay
  '02060010': { lat: 38.65, lon: -75.95 },   // MD Eastern Shore
  '02070001': { lat: 39.15, lon: -79.15 },   // South Branch Potomac
  '02070002': { lat: 39.55, lon: -78.88 },   // North Branch Potomac
  '02070003': { lat: 39.52, lon: -78.42 },   // Cacapon-Town
  '02070004': { lat: 39.58, lon: -77.78 },   // Conococheague-Opequon
  '02070008': { lat: 39.22, lon: -77.42 },   // Middle Potomac-Catoctin
  '02070009': { lat: 39.48, lon: -77.28 },   // Monocacy
  '02070010': { lat: 38.92, lon: -77.08 },   // Middle Potomac-Anacostia
  '02070011': { lat: 38.45, lon: -76.85 },   // Lower Potomac
  '02130101': { lat: 39.72, lon: -76.28 },   // Lower Susquehanna
  '02130102': { lat: 39.62, lon: -76.15 },   // Conowingo-Deer Creek
  '02130103': { lat: 39.38, lon: -76.58 },   // Gunpowder-Patapsco
  '02130104': { lat: 39.26, lon: -76.55 },   // Baltimore Harbor-Back River
  '02130105': { lat: 39.32, lon: -76.72 },   // Patapsco
  '02130106': { lat: 39.42, lon: -76.88 },   // Liberty Reservoir
  // HUC-4 fallbacks (broader region)
  '0205': { lat: 39.55, lon: -79.30 },       // Upper Ohio / Youghiogheny area
  '0206': { lat: 38.70, lon: -76.20 },       // Chesapeake Bay direct
  '0207': { lat: 39.20, lon: -77.50 },       // Potomac basin
  '0213': { lat: 39.35, lon: -76.55 },       // Northern Chesapeake direct
};

// ─── Virginia ─────────────────────────────────────────────────────────────────

const VA_WATERWAYS: WaterwayCentroid[] = [
  { lat: 36.9200, lon: -76.3400, keywords: ['elizabeth'] },
  { lat: 37.1000, lon: -76.4500, keywords: ['james'] },
  { lat: 37.5900, lon: -76.2900, keywords: ['rappahannock'] },
  { lat: 37.2400, lon: -76.3800, keywords: ['york'] },
  { lat: 36.8800, lon: -76.0800, keywords: ['lynnhaven'] },
  { lat: 38.9000, lon: -78.2000, keywords: ['shenandoah'] },
  { lat: 37.1800, lon: -80.5500, keywords: ['new river'] },
  { lat: 37.4000, lon: -77.1000, keywords: ['chickahominy'] },
  { lat: 36.9100, lon: -76.4600, keywords: ['nansemond'] },
  { lat: 37.0000, lon: -76.3500, keywords: ['hampton roads'] },
  { lat: 38.3500, lon: -77.2900, keywords: ['potomac creek', 'aquia'] },
  { lat: 37.2800, lon: -76.8000, keywords: ['mattaponi'] },
  { lat: 37.6700, lon: -76.4700, keywords: ['corrotoman'] },
  { lat: 37.5200, lon: -76.3000, keywords: ['piankatank'] },
  { lat: 37.8500, lon: -76.3500, keywords: ['great wicomico'] },
  { lat: 37.8000, lon: -77.5000, keywords: ['north anna'] },
  { lat: 37.7000, lon: -77.6000, keywords: ['south anna'] },
  { lat: 37.2700, lon: -79.9400, keywords: ['roanoke'] },
  { lat: 36.5900, lon: -79.3900, keywords: ['dan river'] },
  { lat: 36.8500, lon: -82.0000, keywords: ['clinch'] },
  { lat: 36.7500, lon: -82.9500, keywords: ['powell'] },
  { lat: 36.6500, lon: -81.8000, keywords: ['holston'] },
  { lat: 36.9000, lon: -76.3200, keywords: ['lafayette'] },
  { lat: 37.0500, lon: -76.3000, keywords: ['back river'] },
  { lat: 36.9200, lon: -76.1600, keywords: ['little creek'] },
];

// ─── DC ───────────────────────────────────────────────────────────────────────

const DC_WATERWAYS: WaterwayCentroid[] = [
  { lat: 38.8900, lon: -76.9700, keywords: ['anacostia'] },
  { lat: 38.9500, lon: -77.0500, keywords: ['rock creek'] },
  { lat: 38.9200, lon: -77.0400, keywords: ['potomac'] },
  { lat: 38.8200, lon: -77.0100, keywords: ['oxon'] },
  { lat: 38.9100, lon: -76.9500, keywords: ['watts branch'] },
  { lat: 38.9200, lon: -76.9700, keywords: ['hickey run'] },
  { lat: 38.9300, lon: -77.0500, keywords: ['klingle'] },
  { lat: 38.9000, lon: -76.9600, keywords: ['nash run'] },
  { lat: 38.8800, lon: -76.9800, keywords: ['pope branch'] },
  { lat: 38.9300, lon: -77.0300, keywords: ['piney branch'] },
];

// ─── Pennsylvania ─────────────────────────────────────────────────────────────

const PA_WATERWAYS: WaterwayCentroid[] = [
  { lat: 39.9300, lon: -76.3800, keywords: ['conestoga'] },
  { lat: 40.3000, lon: -76.6700, keywords: ['swatara'] },
  { lat: 39.9600, lon: -76.7200, keywords: ['codorus'] },
  { lat: 41.0000, lon: -76.8500, keywords: ['susquehanna'] },
  { lat: 40.2000, lon: -76.9500, keywords: ['yellow breeches'] },
  { lat: 39.9000, lon: -76.3500, keywords: ['pequea'] },
  { lat: 40.1500, lon: -76.7500, keywords: ['conewago'] },
  { lat: 39.8000, lon: -76.0500, keywords: ['octoraro'] },
  { lat: 39.7900, lon: -77.7500, keywords: ['conococheague'] },
  { lat: 40.2500, lon: -76.8700, keywords: ['paxton'] },
  { lat: 40.6100, lon: -76.9400, keywords: ['mahantango'] },
  { lat: 40.0000, lon: -76.3000, keywords: ['mill creek'] },
  { lat: 40.1000, lon: -76.6000, keywords: ['chickies'] },
];

// ─── Delaware ─────────────────────────────────────────────────────────────────

const DE_WATERWAYS: WaterwayCentroid[] = [
  { lat: 39.7400, lon: -75.6600, keywords: ['christina'] },
  { lat: 39.8000, lon: -75.5800, keywords: ['brandywine'] },
  { lat: 39.7000, lon: -75.6000, keywords: ['red clay'] },
  { lat: 39.7000, lon: -75.7200, keywords: ['white clay'] },
  { lat: 38.6000, lon: -75.1200, keywords: ['indian river'] },
  { lat: 38.5800, lon: -75.0800, keywords: ['rehoboth'] },
  { lat: 39.3700, lon: -75.5100, keywords: ['smyrna'] },
  { lat: 39.4200, lon: -76.0400, keywords: ['elk'] },
  { lat: 38.7300, lon: -75.5600, keywords: ['nanticoke'] },
  { lat: 39.3500, lon: -75.6000, keywords: ['appoquinimink'] },
  { lat: 38.9200, lon: -75.4500, keywords: ['st. jones', 'st jones'] },
];

// ─── West Virginia ────────────────────────────────────────────────────────────

const WV_WATERWAYS: WaterwayCentroid[] = [
  { lat: 39.3200, lon: -77.8600, keywords: ['opequon'] },
  { lat: 39.3200, lon: -77.7300, keywords: ['shenandoah'] },
  { lat: 39.1000, lon: -78.9600, keywords: ['south branch'] },
  { lat: 39.6000, lon: -79.9500, keywords: ['monongahela'] },
  { lat: 39.5500, lon: -79.7500, keywords: ['cheat'] },
  { lat: 38.3500, lon: -81.6300, keywords: ['kanawha'] },
  { lat: 37.7900, lon: -80.3800, keywords: ['greenbrier'] },
  { lat: 39.0300, lon: -79.9400, keywords: ['tygart'] },
  { lat: 39.6200, lon: -78.2800, keywords: ['cacapon'] },
  { lat: 39.4500, lon: -79.1100, keywords: ['north branch'] },
  { lat: 38.3500, lon: -81.0000, keywords: ['elk river'] },
  { lat: 38.0500, lon: -80.7500, keywords: ['new river'] },
  { lat: 39.4300, lon: -77.8000, keywords: ['potomac'] },
];

// ─── Florida ──────────────────────────────────────────────────────────────────

const FL_WATERWAYS: WaterwayCentroid[] = [
  { lat: 30.5400, lon: -87.1700, keywords: ['escambia'] },
  { lat: 27.7500, lon: -82.5500, keywords: ['tampa bay'] },
  { lat: 26.9000, lon: -82.1000, keywords: ['charlotte harbor'] },
  { lat: 30.3800, lon: -87.1500, keywords: ['pensacola'] },
  { lat: 30.5700, lon: -87.0000, keywords: ['blackwater'] },
  { lat: 30.3900, lon: -87.4300, keywords: ['perdido'] },
  { lat: 30.4500, lon: -86.9200, keywords: ['east bay'] },
  { lat: 30.4400, lon: -86.3500, keywords: ['choctawhatchee'] },
  { lat: 30.1500, lon: -85.6900, keywords: ['st. andrew', 'st andrew'] },
  { lat: 29.9000, lon: -81.3000, keywords: ['st. johns', 'st johns'] },
  { lat: 28.0500, lon: -80.6000, keywords: ['indian river'] },
  { lat: 25.7600, lon: -80.8500, keywords: ['everglades'] },
  { lat: 26.5200, lon: -81.9000, keywords: ['caloosahatchee'] },
  { lat: 30.6300, lon: -87.0400, keywords: ['milton', 'santa rosa'] },
  { lat: 27.4600, lon: -81.1600, keywords: ['kissimmee'] },
  { lat: 27.2000, lon: -80.2500, keywords: ['st. lucie', 'st lucie'] },
  { lat: 26.7000, lon: -80.0800, keywords: ['lake worth'] },
  { lat: 29.0500, lon: -82.6000, keywords: ['withlacoochee'] },
  { lat: 29.7300, lon: -84.9800, keywords: ['apalachicola'] },
  { lat: 29.2900, lon: -83.1600, keywords: ['suwannee'] },
  { lat: 25.7500, lon: -80.1500, keywords: ['biscayne'] },
  { lat: 25.0000, lon: -80.7400, keywords: ['florida bay'] },
];

// ─── New York (Chesapeake portion) ────────────────────────────────────────────

const NY_WATERWAYS: WaterwayCentroid[] = [
  { lat: 42.1000, lon: -76.8000, keywords: ['susquehanna', 'chemung'] },
  { lat: 42.6900, lon: -76.7000, keywords: ['cayuga'] },
  { lat: 42.0500, lon: -75.9000, keywords: ['chenango'] },
  { lat: 42.3500, lon: -77.0500, keywords: ['cohocton'] },
  { lat: 42.4500, lon: -76.0500, keywords: ['tioughnioga'] },
];

// ─── State Lookup ─────────────────────────────────────────────────────────────

const STATE_WATERWAYS: Record<string, WaterwayCentroid[]> = {
  MD: MD_WATERWAYS, VA: VA_WATERWAYS, DC: DC_WATERWAYS,
  PA: PA_WATERWAYS, DE: DE_WATERWAYS, WV: WV_WATERWAYS,
  FL: FL_WATERWAYS, NY: NY_WATERWAYS,
};

const STATE_HUC_CENTROIDS: Record<string, Record<string, { lat: number; lon: number }>> = {
  MD: MD_HUC_CENTROIDS,
};

// State geographic centers for final fallback
const STATE_CENTERS: Record<string, { lat: number; lon: number }> = {
  MD: { lat: 39.05, lon: -76.80 },
  VA: { lat: 37.55, lon: -78.50 },
  DC: { lat: 38.91, lon: -77.02 },
  PA: { lat: 40.90, lon: -77.80 },
  DE: { lat: 39.15, lon: -75.50 },
  WV: { lat: 38.60, lon: -80.60 },
  FL: { lat: 28.60, lon: -82.40 },
  NY: { lat: 42.15, lon: -76.50 },
};

/**
 * Resolve approximate coordinates for a waterbody.
 * Priority: (1) keyword match → (2) HUC-8 from attainsId → (3) state center with jitter
 */
export function resolveWaterbodyCoordinates(
  name: string,
  stateAbbr: string,
  attainsId?: string,
): { lat: number; lon: number } | null {
  const waterways = STATE_WATERWAYS[stateAbbr];
  const hash = simpleHash(name);

  // ── Tier 1: keyword match ──
  if (waterways) {
    const lower = name.toLowerCase();
    for (const ww of waterways) {
      for (const kw of ww.keywords) {
        if (lower.includes(kw)) {
          // Tight jitter: ±0.03° ≈ ±2 miles
          const jLat = ((hash % 60) - 30) * 0.001;
          const jLon = (((hash >> 8) % 60) - 30) * 0.001;
          return { lat: ww.lat + jLat, lon: ww.lon + jLon };
        }
      }
    }
  }

  // ── Tier 2: HUC from ATTAINS assessment unit ID ──
  if (attainsId) {
    const hucCentroids = STATE_HUC_CENTROIDS[stateAbbr];
    if (hucCentroids) {
      // Extract numeric portion: "MD-02130903" → "02130903"
      const numMatch = attainsId.match(/(\d{8})/);
      if (numMatch) {
        const huc8 = numMatch[1];
        const centroid = hucCentroids[huc8] || hucCentroids[huc8.substring(0, 4)];
        if (centroid) {
          const jLat = ((hash % 80) - 40) * 0.001;
          const jLon = (((hash >> 8) % 80) - 40) * 0.001;
          return { lat: centroid.lat + jLat, lon: centroid.lon + jLon };
        }
      }
      // Try HUC-4 prefix from shorter IDs
      const huc4Match = attainsId.match(/(\d{4})/);
      if (huc4Match) {
        const centroid = hucCentroids[huc4Match[1]];
        if (centroid) {
          const jLat = ((hash % 100) - 50) * 0.001;
          const jLon = (((hash >> 8) % 100) - 50) * 0.001;
          return { lat: centroid.lat + jLat, lon: centroid.lon + jLon };
        }
      }
    }
  }

  // ── Tier 3: state center with small spread ──
  const center = STATE_CENTERS[stateAbbr];
  if (center) {
    // Spread: ±0.15° ≈ ±10 miles from state center
    const jLat = ((hash % 300) - 150) * 0.001;
    const jLon = (((hash >> 8) % 300) - 150) * 0.001;
    return { lat: center.lat + jLat, lon: center.lon + jLon };
  }

  return null;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
