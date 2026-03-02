/**
 * Shared EJScreen Fetch Module — Centralized EPA EJScreen REST API client
 * with multi-tier fallback for resilience.
 *
 * === IMPORTANT: EPA EJScreen Removal Notice ===
 * On February 5, 2025, the EPA removed EJScreen from its website as part of
 * the administration's rollback of environmental justice programs. The official
 * endpoint at ejscreen.epa.gov is no longer accessible.
 *
 * Fallback chain:
 *   Tier 1: EPA EJScreen REST broker (ejscreen.epa.gov) — OFFLINE since Feb 2025
 *   Tier 2: PEDP mirror (pedp-ejscreen.azurewebsites.net) — web UI only, REST broker returns 404
 *   Tier 3: Local approximation from Census ACS + SDWIS data (lib/ejVulnerability.ts)
 *
 * The Tier 3 fallback provides state-level EJ vulnerability scores derived from
 * Census ACS 5-Year Estimates (poverty, minority, uninsured, linguistic isolation,
 * education) and EPA SDWIS drinking water violation rates. While less granular
 * than the block-group-level EJScreen data, it ensures the EJ scoring pipeline
 * never returns null.
 *
 * If the EPA restores EJScreen or a reliable third-party mirror with REST API
 * support becomes available, Tier 1/2 will automatically resume working.
 *
 * References:
 *   - https://envirodatagov.org/epa-removes-ejscreen-from-its-website/
 *   - https://screening-tools.com/epa-ejscreen (data preserved at Harvard DataVerse)
 *   - https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/RLR5AX
 */

import { getEJData, type EJStateData } from './ejVulnerability';

// ── Endpoint URLs ──────────────────────────────────────────────────────────────

const EPA_EJSCREEN_BASE = 'https://ejscreen.epa.gov/mapper/ejscreenRESTbroker1.aspx';
const PEDP_EJSCREEN_BASE = 'https://pedp-ejscreen.azurewebsites.net/mapper/ejscreenRESTbroker1.aspx';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EJScreenResult {
  data: Record<string, unknown>;
  source: 'epa-ejscreen' | 'pedp-mirror' | 'local-census-sdwis';
  degraded: boolean; // true when using local fallback (state-level, not block-group)
}

// ── Core fetch with Tier 1 + Tier 2 remote attempts ───────────────────────────

async function tryRemoteEjscreen(lat: number, lng: number): Promise<EJScreenResult | null> {
  const urls: Array<{ url: string; source: EJScreenResult['source'] }> = [
    {
      url: `${EPA_EJSCREEN_BASE}?namestr=&geometry=${lng},${lat}&distance=1&unit=9035&aession=&f=json`,
      source: 'epa-ejscreen',
    },
    {
      url: `${PEDP_EJSCREEN_BASE}?namestr=&geometry=${lng},${lat}&distance=1&unit=9035&f=json`,
      source: 'pedp-mirror',
    },
  ];

  for (const { url, source } of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000), // 8s timeout per attempt
        next: { revalidate: 604800 }, // Cache 7 days — EJScreen data is static annually
      });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error && typeof data === 'object') {
          return { data, source, degraded: false };
        }
      }
    } catch {
      // Network error, timeout, or parse error — try next URL
    }
  }
  return null;
}

// ── Tier 3: Local Census/SDWIS approximation ─────────────────────────────────
//
// Synthesizes an EJScreen-like response object from state-level EJ vulnerability
// data (lib/ejVulnerability.ts). The response shape mirrors the fields that
// waterRiskScore.ts, SiteIntelDashboard, and SitePropertyIntelligence parse:
//   - LOWINCPCT, MINORPCT: demographic percentages (as fractions 0-1)
//   - EJINDEX: composite EJ index (0-100 percentile proxy)
//   - P_DWATER / D_DWATER_2: drinking water discharge proxy
//   - _source, _degraded: metadata flags for downstream consumers

function buildLocalFallback(state: string): EJScreenResult | null {
  if (!state) return null;
  const ejData = getEJData(state);
  if (!ejData) return null;

  // Map state-level data into EJScreen-compatible field names.
  // Consumers parse: LOWINCPCT (fraction), MINORPCT (fraction), EJINDEX (0-100),
  // P_DWATER (percentile proxy). We set _source and _degraded so UI components
  // can show a "state-level estimate" badge when rendering.
  const data: Record<string, unknown> = {
    // Demographic indicators (expressed as fractions to match EJScreen format)
    LOWINCPCT: ejData.povertyPct / 100,
    MINORPCT: ejData.minorityPct / 100,
    LINGISOPCT: ejData.lingIsolatedPct / 100,

    // Composite EJ index (our 0-100 score maps to percentile-like value)
    EJINDEX: ejData.score,
    P_LDPNT_D2: ejData.score,

    // Drinking water violation proxy (normalized to 0-100 scale)
    P_DWATER: Math.min(100, Math.round((ejData.drinkingWaterViol / 50) * 100)),
    D_DWATER_2: Math.min(100, Math.round((ejData.drinkingWaterViol / 50) * 100)),

    // Metadata: signal to downstream consumers that this is an approximation
    _source: 'local-census-sdwis',
    _degraded: true,
    _stateLevel: true,
    _stateAbbr: ejData.abbr,
    _note: 'State-level approximation from Census ACS 5-Year + EPA SDWIS data. '
         + 'EPA EJScreen REST API offline since Feb 2025. See lib/ejscreenFetch.ts.',
  };

  return { data, source: 'local-census-sdwis', degraded: true };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch EJScreen data for a point location with full fallback chain.
 *
 * @param lat  Latitude
 * @param lng  Longitude
 * @param state  Optional state abbreviation for Tier 3 local fallback
 * @returns EJScreenResult with data, source indicator, and degraded flag.
 *          Returns null only if no state is provided AND remote APIs fail.
 */
export async function ejscreenFetch(
  lat: number,
  lng: number,
  state?: string,
): Promise<EJScreenResult | null> {
  // Tier 1 + 2: Try remote endpoints
  const remote = await tryRemoteEjscreen(lat, lng);
  if (remote) return remote;

  // Tier 3: Local fallback from Census ACS + SDWIS state-level data
  if (state) {
    return buildLocalFallback(state);
  }

  return null;
}

/**
 * Extract just the data payload (for backward compatibility with routes that
 * previously returned Record<string, unknown> | null).
 */
export async function ejscreenFetchData(
  lat: number,
  lng: number,
  state?: string,
): Promise<Record<string, unknown> | null> {
  const result = await ejscreenFetch(lat, lng, state);
  return result?.data ?? null;
}
