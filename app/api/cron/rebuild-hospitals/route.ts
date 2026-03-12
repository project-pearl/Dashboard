// app/api/cron/rebuild-hospitals/route.ts
// Daily hospital facility data refresh from HealthData.gov
// Populates hospital cache with proximity to military installations

export const dynamic = 'force-dynamic';
export const maxDuration = 240; // 4 minutes for hospital data processing

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  setHospitalCache,
  setBuildInProgress,
  isBuildInProgress,
  processHospitalData,
  getHospitalCacheStatus,
} from '@/lib/hospitalCache';

const HEALTHDATA_HOSPITAL_ENDPOINTS = {
  // CMS Hospital General Information
  general: 'https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0',
  // Hospital capacity data
  capacity: 'https://healthdata.gov/resource/g62h-syeh.json',
  // Quality ratings
  quality: 'https://data.cms.gov/provider-data/api/1/datastore/query/yv7e-xc69/0',
} as const;

interface HospitalAPIResponse {
  success: boolean;
  result?: {
    records: any[];
    total: number;
  };
  error?: string;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isBuildInProgress()) {
    return NextResponse.json({
      message: 'Hospital cache build already in progress',
      status: getHospitalCacheStatus(),
    });
  }

  try {
    setBuildInProgress(true);
    console.log('Starting hospital cache rebuild...');

    const allHospitals: any[] = [];
    let totalProcessed = 0;

    // Fetch from CMS Hospital General Information API
    console.log('Fetching hospital general information...');
    const generalHospitals = await fetchHospitalGeneralInfo();
    if (generalHospitals.length > 0) {
      allHospitals.push(...generalHospitals);
      totalProcessed += generalHospitals.length;
      console.log(`Fetched ${generalHospitals.length} hospitals from general info API`);
    }

    // Fetch capacity data and merge
    console.log('Fetching hospital capacity data...');
    const capacityData = await fetchHospitalCapacityData();
    if (capacityData.length > 0) {
      mergeCapacityData(allHospitals, capacityData);
      console.log(`Merged capacity data for ${capacityData.length} hospitals`);
    }

    // Fetch quality ratings and merge
    console.log('Fetching hospital quality ratings...');
    const qualityData = await fetchHospitalQualityData();
    if (qualityData.length > 0) {
      mergeQualityData(allHospitals, qualityData);
      console.log(`Merged quality data for ${qualityData.length} hospitals`);
    }

    if (allHospitals.length === 0) {
      console.warn('No hospital data retrieved from any source');
      return NextResponse.json({
        error: 'No hospital data available',
        sources_attempted: Object.keys(HEALTHDATA_HOSPITAL_ENDPOINTS),
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // Process and validate hospital data
    console.log(`Processing ${allHospitals.length} hospitals...`);
    const processedHospitals = processHospitalData(allHospitals);
    console.log(`Successfully processed ${processedHospitals.length} hospitals`);

    // Update cache
    await setHospitalCache(processedHospitals);

    const status = getHospitalCacheStatus();
    console.log('Hospital cache rebuild completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Hospital cache rebuilt successfully',
      stats: {
        total_fetched: allHospitals.length,
        total_processed: processedHospitals.length,
        near_military: processedHospitals.filter(h => h.proximityToMilitary).length,
        with_emergency: processedHospitals.filter(h => h.emergencyServices).length,
        with_capacity: processedHospitals.filter(h => h.capacity?.totalBeds).length,
      },
      cache_status: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Hospital cache rebuild failed:', error);

    return NextResponse.json({
      error: 'Failed to rebuild hospital cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });

  } finally {
    setBuildInProgress(false);
  }
}

// ─── Data Fetching Functions ─────────────────────────────────────────────────

async function fetchHospitalGeneralInfo(): Promise<any[]> {
  try {
    const response = await fetch(HEALTHDATA_HOSPITAL_ENDPOINTS.general, {
      headers: {
        'User-Agent': 'Water-Quality-Dashboard/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Hospital general info API responded with ${response.status}`);
    }

    const data: HospitalAPIResponse = await response.json();

    if (!data.success || !data.result?.records) {
      throw new Error('Invalid response format from hospital general info API');
    }

    return data.result.records;

  } catch (error) {
    console.error('Error fetching hospital general info:', error);
    return [];
  }
}

async function fetchHospitalCapacityData(): Promise<any[]> {
  try {
    // Use SODA API format for HealthData.gov
    const url = new URL(HEALTHDATA_HOSPITAL_ENDPOINTS.capacity);
    url.searchParams.set('$limit', '10000');
    url.searchParams.set('$order', 'hospital_name');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Water-Quality-Dashboard/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Hospital capacity API responded with ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];

  } catch (error) {
    console.error('Error fetching hospital capacity data:', error);
    return [];
  }
}

async function fetchHospitalQualityData(): Promise<any[]> {
  try {
    const response = await fetch(HEALTHDATA_HOSPITAL_ENDPOINTS.quality, {
      headers: {
        'User-Agent': 'Water-Quality-Dashboard/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Hospital quality API responded with ${response.status}`);
    }

    const data: HospitalAPIResponse = await response.json();

    if (!data.success || !data.result?.records) {
      throw new Error('Invalid response format from hospital quality API');
    }

    return data.result.records;

  } catch (error) {
    console.error('Error fetching hospital quality data:', error);
    return [];
  }
}

// ─── Data Merging Functions ──────────────────────────────────────────────────

function mergeCapacityData(hospitals: any[], capacityData: any[]): void {
  const capacityMap = new Map();

  capacityData.forEach(cap => {
    const key = (cap.hospital_name || cap.facility_name || '').toLowerCase().trim();
    if (key) {
      capacityMap.set(key, {
        total_beds: cap.total_beds || cap.bed_count || cap.licensed_beds,
        icu_beds: cap.icu_beds || cap.total_icu_beds || cap.staffed_icu_beds,
        operating_rooms: cap.operating_rooms || cap.or_count,
        ...(cap.state && { state_check: cap.state }),
      });
    }
  });

  hospitals.forEach(hospital => {
    const hospitalName = (hospital.facility_name || hospital.hospital_name || hospital.provider_name || '').toLowerCase().trim();
    const capacity = capacityMap.get(hospitalName);

    if (capacity) {
      // Verify state match if available
      const hospitalState = hospital.state || hospital.provider_state;
      const capacityState = capacity.state_check;

      if (!capacityState || !hospitalState || hospitalState.toUpperCase() === capacityState.toUpperCase()) {
        Object.assign(hospital, capacity);
      }
    }
  });
}

function mergeQualityData(hospitals: any[], qualityData: any[]): void {
  const qualityMap = new Map();

  qualityData.forEach(qual => {
    const providerId = qual.provider_id || qual.facility_id;
    if (providerId) {
      qualityMap.set(providerId, {
        hospital_overall_rating: qual.hospital_overall_rating || qual.overall_rating,
        mortality_rating: qual.mortality_national_comparison,
        safety_rating: qual.safety_of_care_national_comparison,
        readmission_rating: qual.readmission_national_comparison,
        experience_rating: qual.patient_experience_national_comparison,
        effectiveness_rating: qual.effectiveness_of_care_national_comparison,
        timeliness_rating: qual.timeliness_of_care_national_comparison,
        imaging_rating: qual.efficient_use_of_medical_imaging_national_comparison,
      });
    }
  });

  hospitals.forEach(hospital => {
    const providerId = hospital.provider_id || hospital.facility_id || hospital.cms_id;
    const quality = qualityMap.get(providerId);

    if (quality) {
      Object.assign(hospital, quality);
    }
  });
}

// ─── Alternative Data Sources (Fallback) ─────────────────────────────────────

async function fetchFromAlternativeSource(): Promise<any[]> {
  try {
    // Fallback to state-level hospital databases or other sources
    console.log('Attempting fallback data sources...');

    // This could fetch from:
    // - Individual state health department APIs
    // - Hospital association databases
    // - OpenData portals
    // - Cached backup data

    return [];
  } catch (error) {
    console.error('Error fetching from alternative sources:', error);
    return [];
  }
}