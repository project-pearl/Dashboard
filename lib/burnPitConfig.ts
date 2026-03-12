/**
 * Burn Pit Configuration — Installation-specific monitoring settings
 * and atmospheric exposure thresholds for force protection.
 */

export interface BurnPitInstallationConfig {
  id: string;
  name: string;
  region: string;
  branch: string;
  lat: number;
  lng: number;
  /** Estimated base personnel count for exposure calculations */
  personnelCount: number;
  /** Installation-specific particulate exposure thresholds */
  exposureThresholds: {
    pm25: { moderate: number; high: number; extreme: number };
    pm10: { moderate: number; high: number; extreme: number };
  };
  /** Wind conditions that trigger alerts */
  windThresholds: {
    calm: number; // m/s - particulate accumulation risk
    dispersive: number; // m/s - good dispersion
    transport: number; // m/s - long-range transport concern
  };
  /** Priority level for alert escalation */
  priority: 'standard' | 'high' | 'critical';
  /** Special operational considerations */
  operationalNotes: string[];
}

/**
 * Installation-specific burn pit monitoring configurations.
 * Based on installation size, mission criticality, and regional atmospheric conditions.
 */
export const BURN_PIT_CONFIGURATIONS: Record<string, BurnPitInstallationConfig> = {
  // ── Middle East Region ────────────────────────────────────────────────────
  'camp-arifjan': {
    id: 'camp-arifjan',
    name: 'Camp Arifjan',
    region: 'middle-east',
    branch: 'Army',
    lat: 28.93,
    lng: 48.10,
    personnelCount: 13000,
    exposureThresholds: {
      pm25: { moderate: 30, high: 50, extreme: 100 }, // Desert dust baseline
      pm10: { moderate: 80, high: 120, extreme: 200 },
    },
    windThresholds: {
      calm: 2,     // Desert inversion conditions
      dispersive: 8, // Typical gulf winds
      transport: 15, // Shamal wind events
    },
    priority: 'critical',
    operationalNotes: [
      'Major logistics hub - significant personnel exposure risk',
      'Desert dust storms can mask burn pit particulates',
      'Shamal winds (NW) provide good dispersion but affect regional areas',
      'Monitor for temperature inversions during early morning hours',
    ],
  },

  'al-udeid': {
    id: 'al-udeid',
    name: 'Al Udeid Air Base',
    region: 'middle-east',
    branch: 'Air Force',
    lat: 25.12,
    lng: 51.31,
    personnelCount: 11000,
    exposureThresholds: {
      pm25: { moderate: 25, high: 45, extreme: 90 },
      pm10: { moderate: 70, high: 110, extreme: 180 },
    },
    windThresholds: {
      calm: 2,
      dispersive: 7,
      transport: 12,
    },
    priority: 'critical',
    operationalNotes: [
      'CENTCOM air operations center - mission-critical personnel',
      'Prevailing winds typically from NE/NW',
      'Summer heat increases atmospheric instability',
      'Coordinate with Qatar Met Service for local conditions',
    ],
  },

  'al-dhafra': {
    id: 'al-dhafra',
    name: 'Al Dhafra Air Base',
    region: 'middle-east',
    branch: 'Air Force',
    lat: 24.25,
    lng: 54.55,
    personnelCount: 5000,
    exposureThresholds: {
      pm25: { moderate: 25, high: 45, extreme: 90 },
      pm10: { moderate: 70, high: 110, extreme: 180 },
    },
    windThresholds: {
      calm: 2,
      dispersive: 7,
      transport: 12,
    },
    priority: 'high',
    operationalNotes: [
      'UAE coastal location - humidity affects particulate behavior',
      'Sea/land breeze cycle influences dispersion patterns',
      'Monitor for industrial pollution from Abu Dhabi',
    ],
  },

  'camp-buehring': {
    id: 'camp-buehring',
    name: 'Camp Buehring',
    region: 'middle-east',
    branch: 'Army',
    lat: 29.25,
    lng: 47.68,
    personnelCount: 8000,
    exposureThresholds: {
      pm25: { moderate: 30, high: 50, extreme: 100 },
      pm10: { moderate: 80, high: 120, extreme: 200 },
    },
    windThresholds: {
      calm: 2,
      dispersive: 8,
      transport: 15,
    },
    priority: 'high',
    operationalNotes: [
      'Training area - transient personnel population',
      'Open desert location - minimal topographic effects',
      'Extreme summer temperatures affect atmospheric mixing',
    ],
  },

  'ali-al-salem': {
    id: 'ali-al-salem',
    name: 'Ali Al Salem Air Base',
    region: 'middle-east',
    branch: 'Air Force',
    lat: 29.35,
    lng: 47.52,
    personnelCount: 4000,
    exposureThresholds: {
      pm25: { moderate: 30, high: 50, extreme: 100 },
      pm10: { moderate: 80, high: 120, extreme: 200 },
    },
    windThresholds: {
      calm: 2,
      dispersive: 8,
      transport: 15,
    },
    priority: 'high',
    operationalNotes: [
      'Strategic airlift operations',
      'Close proximity to Camp Buehring affects regional air quality',
      'Monitor for cross-contamination from neighboring facilities',
    ],
  },

  'prince-sultan': {
    id: 'prince-sultan',
    name: 'Prince Sultan Air Base',
    region: 'middle-east',
    branch: 'Air Force',
    lat: 24.06,
    lng: 47.58,
    personnelCount: 3000,
    exposureThresholds: {
      pm25: { moderate: 25, high: 45, extreme: 90 },
      pm10: { moderate: 70, high: 110, extreme: 180 },
    },
    windThresholds: {
      calm: 2,
      dispersive: 7,
      transport: 12,
    },
    priority: 'standard',
    operationalNotes: [
      'Smaller operational footprint',
      'Desert location with typical gulf atmospheric patterns',
      'Coordinate with Saudi Arabian authorities for regional air quality',
    ],
  },

  // ── Africa Region ─────────────────────────────────────────────────────────
  'camp-lemonnier': {
    id: 'camp-lemonnier',
    name: 'Camp Lemonnier',
    region: 'africa',
    branch: 'Navy',
    lat: 11.55,
    lng: 43.15,
    personnelCount: 4000,
    exposureThresholds: {
      pm25: { moderate: 20, high: 35, extreme: 65 }, // Lower threshold - tropical location
      pm10: { moderate: 50, high: 80, extreme: 130 },
    },
    windThresholds: {
      calm: 3,     // Monsoon effects
      dispersive: 10,
      transport: 18,
    },
    priority: 'high',
    operationalNotes: [
      'AFRICOM headquarters - strategic importance',
      'Tropical climate affects particulate dispersion',
      'Monsoon winds create seasonal patterns',
      'High humidity increases particulate adherence',
      'Monitor for dust from Saharan outflows',
    ],
  },

  'niamey': {
    id: 'niamey',
    name: 'Niamey Air Base 101',
    region: 'africa',
    branch: 'Air Force',
    lat: 13.48,
    lng: 2.18,
    personnelCount: 800,
    exposureThresholds: {
      pm25: { moderate: 35, high: 60, extreme: 120 }, // Sahel dust baseline
      pm10: { moderate: 100, high: 150, extreme: 250 },
    },
    windThresholds: {
      calm: 1,     // Sahel trade winds
      dispersive: 6,
      transport: 12,
    },
    priority: 'standard',
    operationalNotes: [
      'Sahel region - high background dust levels',
      'Harmattan winds carry Saharan dust',
      'Small footprint but remote location',
      'Limited local medical facilities - emphasize prevention',
    ],
  },

  // ── Indo-Pacific Region ──────────────────────────────────────────────────
  'diego-garcia': {
    id: 'diego-garcia',
    name: 'Naval Support Facility Diego Garcia',
    region: 'indo-pacific',
    branch: 'Navy',
    lat: -7.32,
    lng: 72.42,
    personnelCount: 1500,
    exposureThresholds: {
      pm25: { moderate: 15, high: 25, extreme: 50 }, // Pristine oceanic environment
      pm10: { moderate: 30, high: 50, extreme: 90 },
    },
    windThresholds: {
      calm: 4,     // Trade wind environment
      dispersive: 12,
      transport: 20,
    },
    priority: 'high',
    operationalNotes: [
      'Remote oceanic atoll - pristine air quality baseline',
      'Any particulate elevation highly significant',
      'Trade winds provide consistent dispersion',
      'Limited evacuation options - emphasize prevention',
      'Monitor for transpacific pollution transport',
    ],
  },

  // ── Europe Region ─────────────────────────────────────────────────────────
  'camp-bondsteel': {
    id: 'camp-bondsteel',
    name: 'Camp Bondsteel',
    region: 'europe',
    branch: 'Army',
    lat: 42.36,
    lng: 21.25,
    personnelCount: 7000,
    exposureThresholds: {
      pm25: { moderate: 20, high: 35, extreme: 65 }, // European air quality standards
      pm10: { moderate: 40, high: 70, extreme: 120 },
    },
    windThresholds: {
      calm: 2,     // Mountain valley effects
      dispersive: 8,
      transport: 15,
    },
    priority: 'high',
    operationalNotes: [
      'Mountain valley location affects dispersion',
      'European air quality standards apply',
      'Seasonal temperature inversions common',
      'Coordinate with Kosovo environmental authorities',
      'Monitor for regional industrial pollution',
    ],
  },
};

/**
 * Get burn pit configuration for a specific installation.
 */
export function getBurnPitConfig(installationId: string): BurnPitInstallationConfig | null {
  return BURN_PIT_CONFIGURATIONS[installationId] || null;
}

/**
 * Get all burn pit installation configurations.
 */
export function getAllBurnPitConfigs(): BurnPitInstallationConfig[] {
  return Object.values(BURN_PIT_CONFIGURATIONS);
}

/**
 * Get burn pit installations by region.
 */
export function getBurnPitConfigsByRegion(region: string): BurnPitInstallationConfig[] {
  return Object.values(BURN_PIT_CONFIGURATIONS).filter(config => config.region === region);
}

/**
 * Get burn pit installations by priority level.
 */
export function getBurnPitConfigsByPriority(priority: 'standard' | 'high' | 'critical'): BurnPitInstallationConfig[] {
  return Object.values(BURN_PIT_CONFIGURATIONS).filter(config => config.priority === priority);
}