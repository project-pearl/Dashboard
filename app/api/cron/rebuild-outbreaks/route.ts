// app/api/cron/rebuild-outbreaks/route.ts
// Daily CDC waterborne illness outbreak surveillance data refresh
// Correlates outbreaks with water quality violations for health-water evidence

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for outbreak data processing and correlation

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  setWaterborneOutbreakCache,
  setBuildInProgress,
  isBuildInProgress,
  processOutbreakData,
  getWaterborneOutbreakCacheStatus,
} from '@/lib/waterborneIllnessCache';

const CDC_OUTBREAK_ENDPOINTS = {
  // CDC NORS (National Outbreak Reporting System) - Waterborne
  nors: 'https://wonder.cdc.gov/nors/api/waterborne.json',
  // CDC Environmental Health Services API
  ehs: 'https://data.cdc.gov/resource/uzp8-8kgr.json',
  // State environmental health tracking
  tracking: 'https://ephtracking.cdc.gov/apigateway/api/v1/indicators/1,2,3,4/data',
  // CDC Surveillance summaries
  surveillance: 'https://data.cdc.gov/resource/vaux-rurv.json',
} as const;

// SDWIS violation data for correlation
import { getSdwisAllData } from '@/lib/sdwisCache';

interface OutbreakAPIResponse {
  success: boolean;
  data?: any[];
  error?: string;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isBuildInProgress()) {
    return NextResponse.json({
      message: 'Outbreak cache build already in progress',
      status: getWaterborneOutbreakCacheStatus(),
    });
  }

  try {
    setBuildInProgress(true);
    console.log('Starting waterborne outbreak cache rebuild...');

    const allOutbreaks: any[] = [];
    let totalProcessed = 0;

    // Fetch from CDC NORS waterborne data
    console.log('Fetching CDC NORS waterborne outbreak data...');
    const norsOutbreaks = await fetchCDCNORSData();
    if (norsOutbreaks.length > 0) {
      allOutbreaks.push(...norsOutbreaks);
      totalProcessed += norsOutbreaks.length;
      console.log(`Fetched ${norsOutbreaks.length} outbreaks from NORS`);
    }

    // Fetch from CDC Environmental Health Services
    console.log('Fetching CDC EHS outbreak data...');
    const ehsOutbreaks = await fetchCDCEHSData();
    if (ehsOutbreaks.length > 0) {
      allOutbreaks.push(...ehsOutbreaks);
      totalProcessed += ehsOutbreaks.length;
      console.log(`Fetched ${ehsOutbreaks.length} outbreaks from EHS`);
    }

    // Fetch from CDC Environmental Health Tracking
    console.log('Fetching CDC tracking data...');
    const trackingOutbreaks = await fetchCDCTrackingData();
    if (trackingOutbreaks.length > 0) {
      allOutbreaks.push(...trackingOutbreaks);
      totalProcessed += trackingOutbreaks.length;
      console.log(`Fetched ${trackingOutbreaks.length} events from tracking`);
    }

    // Fetch from CDC surveillance summaries
    console.log('Fetching CDC surveillance summaries...');
    const surveillanceOutbreaks = await fetchCDCSurveillanceData();
    if (surveillanceOutbreaks.length > 0) {
      allOutbreaks.push(...surveillanceOutbreaks);
      totalProcessed += surveillanceOutbreaks.length;
      console.log(`Fetched ${surveillanceOutbreaks.length} outbreaks from surveillance`);
    }

    // Deduplicate outbreaks by ID and location
    const deduplicatedOutbreaks = deduplicateOutbreaks(allOutbreaks);
    console.log(`Deduplicated to ${deduplicatedOutbreaks.length} unique outbreaks`);

    if (deduplicatedOutbreaks.length === 0) {
      console.warn('No outbreak data retrieved from any source');
      return NextResponse.json({
        error: 'No outbreak data available',
        sources_attempted: Object.keys(CDC_OUTBREAK_ENDPOINTS),
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // Get SDWIS violations for correlation
    console.log('Loading water violation data for correlation...');
    const sdwisData = getSdwisAllData();
    const waterViolations = sdwisData.violations
      .filter(violation => violation.lat && violation.lng)
      .map(violation => ({
        id: violation.pwsid,
        lat: violation.lat,
        lng: violation.lng,
        violationDate: violation.compliancePeriod,
        systemId: violation.pwsid,
      }));

    console.log(`Loaded ${waterViolations.length} violations for correlation`);

    // Process and correlate outbreak data
    console.log(`Processing ${deduplicatedOutbreaks.length} outbreaks...`);
    const processedOutbreaks = processOutbreakData(deduplicatedOutbreaks, waterViolations);
    console.log(`Successfully processed ${processedOutbreaks.length} outbreaks`);

    // Update cache
    await setWaterborneOutbreakCache(processedOutbreaks);

    const status = getWaterborneOutbreakCacheStatus();
    console.log('Waterborne outbreak cache rebuild completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Waterborne outbreak cache rebuilt successfully',
      stats: {
        total_fetched: allOutbreaks.length,
        total_deduplicated: deduplicatedOutbreaks.length,
        total_processed: processedOutbreaks.length,
        near_military: processedOutbreaks.filter(o => o.proximityToMilitary).length,
        with_violations: processedOutbreaks.filter(o => o.correlatedViolations?.length).length,
        by_source: {
          drinking_water: processedOutbreaks.filter(o => o.suspectedSource === 'drinking_water').length,
          recreational_water: processedOutbreaks.filter(o => o.suspectedSource === 'recreational_water').length,
          well_water: processedOutbreaks.filter(o => o.suspectedSource === 'well_water').length,
        },
        by_illness: {
          gastroenteritis: processedOutbreaks.filter(o => o.illnessType === 'gastroenteritis').length,
          legionella: processedOutbreaks.filter(o => o.illnessType === 'legionella').length,
          cryptosporidium: processedOutbreaks.filter(o => o.illnessType === 'cryptosporidium').length,
        },
      },
      correlation_stats: {
        violations_checked: waterViolations.length,
        correlated_outbreaks: processedOutbreaks.filter(o => o.correlatedViolations?.length).length,
      },
      cache_status: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Waterborne outbreak cache rebuild failed:', error);

    return NextResponse.json({
      error: 'Failed to rebuild outbreak cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });

  } finally {
    setBuildInProgress(false);
  }
}

// ─── Data Fetching Functions ─────────────────────────────────────────────────

async function fetchCDCNORSData(): Promise<any[]> {
  try {
    // Note: This is a mock endpoint - actual CDC NORS data requires special access
    // In practice, would use CDC data sharing agreements or state-level APIs

    // For demonstration, using CDC open data portal endpoints
    const response = await fetch('https://data.cdc.gov/resource/vaux-rurv.json?$where=etiology_confirmed%20like%20%27%25water%25%27&$limit=1000', {
      headers: {
        'User-Agent': 'Water-Quality-Dashboard/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`CDC NORS API responded with ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];

  } catch (error) {
    console.error('Error fetching CDC NORS data:', error);
    return [];
  }
}

async function fetchCDCEHSData(): Promise<any[]> {
  try {
    // CDC Environmental Health Services API
    const response = await fetch('https://data.cdc.gov/resource/uzp8-8kgr.json?$limit=500&$order=year DESC', {
      headers: {
        'User-Agent': 'Water-Quality-Dashboard/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`CDC EHS API responded with ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data.filter(record =>
      record.topic && record.topic.toLowerCase().includes('water')
    ) : [];

  } catch (error) {
    console.error('Error fetching CDC EHS data:', error);
    return [];
  }
}

async function fetchCDCTrackingData(): Promise<any[]> {
  try {
    // CDC Environmental Health Tracking Network
    // Note: Requires API key for full access
    const indicatorIds = [1, 2, 3, 4]; // Water quality indicators
    const url = `https://ephtracking.cdc.gov/apigateway/api/v1/indicators/${indicatorIds.join(',')}/data?$limit=1000`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Water-Quality-Dashboard/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`CDC Tracking API responded with ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];

  } catch (error) {
    console.error('Error fetching CDC tracking data:', error);
    return [];
  }
}

async function fetchCDCSurveillanceData(): Promise<any[]> {
  try {
    // CDC surveillance summaries for waterborne disease
    const response = await fetch('https://data.cdc.gov/resource/mr8w-325u.json?$where=topic%20like%20%27%25waterborne%25%27&$limit=200', {
      headers: {
        'User-Agent': 'Water-Quality-Dashboard/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`CDC Surveillance API responded with ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];

  } catch (error) {
    console.error('Error fetching CDC surveillance data:', error);
    return [];
  }
}

// ─── State-Level Data Sources ────────────────────────────────────────────────

async function fetchStateOutbreakData(): Promise<any[]> {
  const stateOutbreaks: any[] = [];

  // Priority states with good outbreak reporting systems
  const priorityStates = ['CA', 'FL', 'TX', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI'];

  try {
    for (const state of priorityStates) {
      const stateData = await fetchSingleStateData(state);
      if (stateData.length > 0) {
        stateOutbreaks.push(...stateData);
        console.log(`Fetched ${stateData.length} outbreaks from ${state}`);
      }
    }
  } catch (error) {
    console.error('Error fetching state outbreak data:', error);
  }

  return stateOutbreaks;
}

async function fetchSingleStateData(stateCode: string): Promise<any[]> {
  // State-specific APIs would go here
  // For example:
  // - California: https://data.ca.gov/dataset/...
  // - Florida: https://floridadisaster.org/api/...
  // - Texas: https://dshs.texas.gov/api/...

  return [];
}

// ─── Data Processing Utilities ───────────────────────────────────────────────

function deduplicateOutbreaks(outbreaks: any[]): any[] {
  const seen = new Set<string>();
  const deduplicated: any[] = [];

  outbreaks.forEach(outbreak => {
    // Create a unique key based on location, date, and illness type
    const key = [
      outbreak.state || '',
      outbreak.county || '',
      outbreak.city || '',
      outbreak.report_date || outbreak.date_reported || '',
      outbreak.illness_type || outbreak.etiology || '',
      Math.round((parseFloat(outbreak.latitude || outbreak.lat || 0)) * 100) / 100,
      Math.round((parseFloat(outbreak.longitude || outbreak.lng || outbreak.lon || 0)) * 100) / 100,
    ].join('|');

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(outbreak);
    }
  });

  return deduplicated;
}

// ─── Data Enhancement ─────────────────────────────────────────────────────────

async function enhanceOutbreakData(outbreaks: any[]): Promise<any[]> {
  // Add geocoding for outbreaks without coordinates
  const enhanced: any[] = [];

  for (const outbreak of outbreaks) {
    let enhancedOutbreak = { ...outbreak };

    // Geocode if missing coordinates but has location info
    if ((!outbreak.latitude && !outbreak.lat) && (outbreak.city || outbreak.county) && outbreak.state) {
      try {
        const coords = await geocodeLocation(
          outbreak.city || outbreak.county,
          outbreak.state
        );
        if (coords) {
          enhancedOutbreak.latitude = coords.lat;
          enhancedOutbreak.longitude = coords.lng;
        }
      } catch (error) {
        console.warn(`Failed to geocode ${outbreak.city || outbreak.county}, ${outbreak.state}`);
      }
    }

    enhanced.push(enhancedOutbreak);
  }

  return enhanced;
}

async function geocodeLocation(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  // Simple geocoding using a free service
  try {
    const query = encodeURIComponent(`${city}, ${state}`);
    const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${query}&key=YOUR_API_KEY&limit=1`);

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat: result.geometry.lat,
          lng: result.geometry.lng,
        };
      }
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }

  return null;
}