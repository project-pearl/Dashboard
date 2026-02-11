/*
 * REGION-BASED WATER QUALITY ZONES CONFIGURATION
 *
 * This file defines region-specific thresholds for water quality parameters.
 * Different regions (countries, states, counties, or specific monitoring sites)
 * can have different acceptable ranges based on local regulations and environmental conditions.
 *
 * FUTURE DATABASE MIGRATION:
 * This configuration is designed to be easily migrated to a database.
 * Recommended database schema:
 *
 * Table: regions
 *   - id (uuid, primary key)
 *   - name (text)
 *   - description (text)
 *   - created_at (timestamp)
 *
 * Table: region_thresholds
 *   - id (uuid, primary key)
 *   - region_id (uuid, foreign key -> regions.id)
 *   - parameter_name (text: 'DO', 'turbidity', 'TN', 'TP', 'TSS', 'salinity')
 *   - green_min (numeric, nullable)
 *   - green_max (numeric, nullable)
 *   - yellow_min (numeric, nullable)
 *   - yellow_max (numeric, nullable)
 *   - red_min (numeric, nullable)
 *   - red_max (numeric, nullable)
 *
 * To migrate, replace this file with API calls to fetch regions and thresholds from Supabase.
 */

export interface RegionThresholds {
  green: { min?: number; max?: number };
  yellow: { min?: number; max?: number };
  orange?: { min?: number; max?: number };
  red: { min?: number; max?: number };
}

export interface RegionParameterConfig {
  DO: RegionThresholds;
  turbidity: RegionThresholds;
  TN: RegionThresholds;
  TP: RegionThresholds;
  TSS: RegionThresholds;
  salinity: RegionThresholds;
}

export interface Region {
  id: string;
  name: string;
  hasPearlData: boolean;
  dataSource: string;
  thresholds: RegionParameterConfig;
  description: string;
}

export const regionsConfig: Region[] = [
  {
    id: 'florida_escambia',
    name: 'Escambia Bay, Florida (USA)',
    hasPearlData: true,
    dataSource: 'Project Pearl Sensors',
    description: 'Florida DEP standards for Class II/III estuarine waters',
    thresholds: {
      DO: {
        green: { min: 6, max: 9 },
        yellow: { min: 4, max: 11 },
        red: { min: 0, max: 14 }
      },
      turbidity: {
        green: { min: 0, max: 5 },
        yellow: { min: 5, max: 25 },
        orange: { min: 25, max: 100 },
        red: { min: 100, max: 500 }
      },
      TN: {
        green: { min: 0, max: 1.5 },
        yellow: { min: 1.5, max: 6 },
        orange: { min: 6, max: 10 },
        red: { min: 10, max: 25 }
      },
      TP: {
        green: { min: 0, max: 0.05 },
        yellow: { min: 0.05, max: 0.15 },
        orange: { min: 0.15, max: 0.3 },
        red: { min: 0.3, max: 2.0 }
      },
      TSS: {
        green: { min: 0, max: 10 },
        yellow: { min: 10, max: 30 },
        orange: { min: 30, max: 100 },
        red: { min: 100, max: 500 }
      },
      salinity: {
        green: { min: 5, max: 20 },
        yellow: { min: 0, max: 30 },
        red: { min: 30, max: 40 }
      }
    }
  },
  {
    id: 'maryland_middle_branch',
    name: 'Middle Branch, Patapsco River, Maryland (USA)',
    hasPearlData: true,
    dataSource: 'Project Pearl Sensors',
    description: 'Maryland/Chesapeake Bay Program standards for tidal urban estuarine waters',
    thresholds: {
      DO: {
        green: { min: 6, max: 9 },
        yellow: { min: 4, max: 11 },
        red: { min: 0, max: 14 }
      },
      turbidity: {
        green: { min: 0, max: 5 },
        yellow: { min: 5, max: 25 },
        orange: { min: 25, max: 100 },
        red: { min: 100, max: 500 }
      },
      TN: {
        green: { min: 0, max: 1.5 },
        yellow: { min: 1.5, max: 6 },
        orange: { min: 6, max: 10 },
        red: { min: 10, max: 25 }
      },
      TP: {
        green: { min: 0, max: 0.05 },
        yellow: { min: 0.05, max: 0.15 },
        orange: { min: 0.15, max: 0.3 },
        red: { min: 0.3, max: 2.0 }
      },
      TSS: {
        green: { min: 0, max: 10 },
        yellow: { min: 10, max: 30 },
        orange: { min: 30, max: 100 },
        red: { min: 100, max: 500 }
      },
      salinity: {
        green: { min: 5, max: 20 },
        yellow: { min: 0, max: 30 },
        red: { min: 30, max: 40 }
      }
    }
  },
  {
    id: 'dc_anacostia',
    name: 'Anacostia River, DC (USA)',
    hasPearlData: false,
    dataSource: 'Ambient Monitoring (USGS, DC DOEE)',
    description: 'District of Columbia tidal river standards (Pearl deployment planned)',
    thresholds: {
      DO: {
        green: { min: 6, max: 9 },
        yellow: { min: 4, max: 11 },
        red: { min: 0, max: 14 }
      },
      turbidity: {
        green: { min: 0, max: 5 },
        yellow: { min: 5, max: 25 },
        orange: { min: 25, max: 100 },
        red: { min: 100, max: 500 }
      },
      TN: {
        green: { min: 0, max: 1.5 },
        yellow: { min: 1.5, max: 6 },
        orange: { min: 6, max: 10 },
        red: { min: 10, max: 25 }
      },
      TP: {
        green: { min: 0, max: 0.05 },
        yellow: { min: 0.05, max: 0.15 },
        orange: { min: 0.15, max: 0.3 },
        red: { min: 0.3, max: 2.0 }
      },
      TSS: {
        green: { min: 0, max: 10 },
        yellow: { min: 10, max: 30 },
        orange: { min: 30, max: 100 },
        red: { min: 100, max: 500 }
      },
      salinity: {
        green: { min: 5, max: 20 },
        yellow: { min: 0, max: 30 },
        red: { min: 30, max: 40 }
      }
    }
  },
  {
    id: 'maryland_inner_harbor',
    name: 'Inner Harbor, Baltimore, Maryland (USA)',
    hasPearlData: false,
    dataSource: 'Ambient Monitoring (Maryland DNR Eyes on the Bay)',
    description: 'Maryland tidal harbor standards (Pearl deployment planned)',
    thresholds: {
      DO: {
        green: { min: 6, max: 9 },
        yellow: { min: 4, max: 11 },
        red: { min: 0, max: 14 }
      },
      turbidity: {
        green: { min: 0, max: 5 },
        yellow: { min: 5, max: 25 },
        orange: { min: 25, max: 100 },
        red: { min: 100, max: 500 }
      },
      TN: {
        green: { min: 0, max: 1.5 },
        yellow: { min: 1.5, max: 6 },
        orange: { min: 6, max: 10 },
        red: { min: 10, max: 25 }
      },
      TP: {
        green: { min: 0, max: 0.05 },
        yellow: { min: 0.05, max: 0.15 },
        orange: { min: 0.15, max: 0.3 },
        red: { min: 0.3, max: 2.0 }
      },
      TSS: {
        green: { min: 0, max: 10 },
        yellow: { min: 10, max: 30 },
        orange: { min: 30, max: 100 },
        red: { min: 100, max: 500 }
      },
      salinity: {
        green: { min: 5, max: 20 },
        yellow: { min: 0, max: 30 },
        red: { min: 30, max: 40 }
      }
    }
  },
  {
    id: 'california_sf_bay',
    name: 'San Francisco Bay, California (USA)',
    hasPearlData: false,
    dataSource: 'Ambient Monitoring (USGS, State Agencies)',
    description: 'California Regional Water Quality Control Board standards',
    thresholds: {
      DO: {
        green: { min: 6, max: 9 },
        yellow: { min: 4, max: 11 },
        red: { min: 0, max: 14 }
      },
      turbidity: {
        green: { min: 0, max: 5 },
        yellow: { min: 5, max: 25 },
        orange: { min: 25, max: 100 },
        red: { min: 100, max: 500 }
      },
      TN: {
        green: { min: 0, max: 1.5 },
        yellow: { min: 1.5, max: 6 },
        orange: { min: 6, max: 10 },
        red: { min: 10, max: 25 }
      },
      TP: {
        green: { min: 0, max: 0.05 },
        yellow: { min: 0.05, max: 0.15 },
        orange: { min: 0.15, max: 0.3 },
        red: { min: 0.3, max: 2.0 }
      },
      TSS: {
        green: { min: 0, max: 10 },
        yellow: { min: 10, max: 30 },
        orange: { min: 30, max: 100 },
        red: { min: 100, max: 500 }
      },
      salinity: {
        green: { min: 5, max: 20 },
        yellow: { min: 0, max: 30 },
        red: { min: 30, max: 40 }
      }
    }
  },
  {
    id: 'eu_generic',
    name: 'Generic EU Estuarine Waters',
    hasPearlData: false,
    dataSource: 'Ambient Monitoring (Public Databases)',
    description: 'EU Water Framework Directive compliant standards',
    thresholds: {
      DO: {
        green: { min: 6, max: 9 },
        yellow: { min: 4, max: 11 },
        red: { min: 0, max: 14 }
      },
      turbidity: {
        green: { min: 0, max: 5 },
        yellow: { min: 5, max: 25 },
        orange: { min: 25, max: 100 },
        red: { min: 100, max: 500 }
      },
      TN: {
        green: { min: 0, max: 1.5 },
        yellow: { min: 1.5, max: 6 },
        orange: { min: 6, max: 10 },
        red: { min: 10, max: 25 }
      },
      TP: {
        green: { min: 0, max: 0.05 },
        yellow: { min: 0.05, max: 0.15 },
        orange: { min: 0.15, max: 0.3 },
        red: { min: 0.3, max: 2.0 }
      },
      TSS: {
        green: { min: 0, max: 10 },
        yellow: { min: 10, max: 30 },
        orange: { min: 30, max: 100 },
        red: { min: 100, max: 500 }
      },
      salinity: {
        green: { min: 5, max: 20 },
        yellow: { min: 0, max: 30 },
        red: { min: 30, max: 40 }
      }
    }
  }
];

export function getRegionById(id: string): Region | undefined {
  return regionsConfig.find(region => region.id === id);
}

export function isChesapeakeBayRegion(regionId: string): boolean {
  const chesapeakeBayRegions = [
    'maryland_middle_branch',
    'maryland_inner_harbor',
    'dc_anacostia'
  ];
  return chesapeakeBayRegions.includes(regionId);
}

/*
 * TO ADD A NEW REGION:
 *
 * 1. Add a new Region object to the regionsConfig array above
 * 2. Define unique id (snake_case format recommended)
 * 3. Set display name and description
 * 4. Configure thresholds for all 6 parameters (DO, turbidity, TN, TP, TSS, salinity)
 * 5. Ensure thresholds follow the pattern:
 *    - green: healthy/optimal range
 *    - yellow: caution/monitoring range
 *    - red: unhealthy/action required range
 *
 * Example regions that could be added:
 * - Chesapeake Bay, Maryland (USA)
 * - Great Barrier Reef, Queensland (Australia)
 * - Thames Estuary, England (UK)
 * - Tokyo Bay, Japan
 * - Baltic Sea, Sweden
 * - Any custom Pearl monitoring site
 *
 * When loaded from database, this function would become an async API call:
 * export async function fetchRegions(): Promise<Region[]> {
 *   const { data } = await supabase.from('regions').select('*, region_thresholds(*)');
 *   return transformToRegionConfig(data);
 * }
 */
