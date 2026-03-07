// app/api/cron/rebuild-ipac/route.ts
// Cron endpoint — fetches USFWS ECOS endangered species listings per state.
// Iterates all US states, counts endangered/threatened/candidate species,
// filters for aquatic species (fish, mussel, crayfish, amphibian, turtle).
// Schedule: weekly Sunday via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setIpacCache, getIpacCacheStatus,
  isIpacBuildInProgress, setIpacBuildInProgress,
  type IpacStateData,
} from '@/lib/ipacCache';
import { ALL_STATES } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';

// ── Config ───────────────────────────────────────────────────────────────────

const ECOS_URL = 'https://ecos.fws.gov/ecp/report/species-listings-by-state';
const FETCH_TIMEOUT_MS = 30_000;
const CONCURRENCY = 5;
const DELAY_MS = 500;

const AQUATIC_KEYWORDS = ['fish', 'mussel', 'crayfish', 'amphibian', 'turtle', 'salamander', 'frog', 'toad', 'clam', 'snail'];

function isAquatic(group: string, speciesName: string): boolean {
  const combined = `${group} ${speciesName}`.toLowerCase();
  return AQUATIC_KEYWORDS.some(kw => combined.includes(kw));
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isIpacBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'IPaC build already in progress',
      cache: getIpacCacheStatus(),
    });
  }

  setIpacBuildInProgress(true);
  const startTime = Date.now();

  try {
    const states: Record<string, IpacStateData> = {};
    let fetchErrors = 0;

    for (let i = 0; i < ALL_STATES.length; i += CONCURRENCY) {
      const batch = ALL_STATES.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (st) => {
          try {
            const url = `${ECOS_URL}?stateAbbrev=${st}&format=json`;
            const res = await fetch(url, {
              headers: { 'User-Agent': 'PEARL-Platform/1.0', 'Accept': 'application/json' },
              signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });

            if (!res.ok) {
              console.warn(`[IPaC Cron] ${st}: HTTP ${res.status}`);
              fetchErrors++;
              return null;
            }

            const data = await res.json();
            const species: any[] = Array.isArray(data) ? data : (data?.species || data?.data || []);

            let endangered = 0;
            let threatened = 0;
            let candidate = 0;
            const aquaticSpecies: string[] = [];

            for (const sp of species) {
              const status = (sp.status || sp.Status || sp.listing_status || '').toLowerCase();
              const name = sp.comname || sp.common_name || sp.scientificName || sp.species || '';
              const group = sp.group || sp.species_group || sp.taxon || '';

              if (status.includes('endangered') || status === 'e') {
                endangered++;
              } else if (status.includes('threatened') || status === 't') {
                threatened++;
              } else if (status.includes('candidate') || status === 'c') {
                candidate++;
              }

              if ((status.includes('endangered') || status.includes('threatened') || status === 'e' || status === 't') && isAquatic(group, name)) {
                const displayName = name || sp.sciname || sp.scientific_name || 'Unknown';
                if (!aquaticSpecies.includes(displayName)) {
                  aquaticSpecies.push(displayName);
                }
              }
            }

            return {
              state: st,
              totalListed: endangered + threatened + candidate,
              endangered,
              threatened,
              candidate,
              aquaticSpecies,
            } as IpacStateData;
          } catch (err) {
            console.warn(`[IPaC Cron] ${st}: fetch error`, err);
            fetchErrors++;
            return null;
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          states[r.value.state] = r.value;
        }
      }

      if (i + CONCURRENCY < ALL_STATES.length) await delay(DELAY_MS);
    }

    const stateCount = Object.keys(states).length;

    // Empty-data guard
    if (stateCount === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[IPaC Cron] 0 states in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getIpacCacheStatus(),
      });
    }

    await setIpacCache({
      _meta: {
        built: new Date().toISOString(),
        stateCount,
      },
      states,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[IPaC Cron] Complete in ${elapsed}s — ${stateCount} states, ${fetchErrors} errors`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stateCount,
      fetchErrors,
      cache: getIpacCacheStatus(),
    });

  } catch (err: any) {
    console.error('[IPaC Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'IPaC build failed' },
      { status: 500 },
    );
  } finally {
    setIpacBuildInProgress(false);
  }
}
