// app/api/lens-story/route.ts
// Server-side endpoint that warms relevant caches and runs the Lens Story engine.
// Returns structured findings for a given lens/role/state combination.
//
// GET /api/lens-story?lens=water-quality&role=Federal&state=CA

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateLensStory, getCacheNamesForLens } from '@/lib/lensStoryEngine';

// ── Cache warming imports ───────────────────────────────────────────────────

import { ensureWarmed as warmSdwis } from '@/lib/sdwisCache';
import { ensureWarmed as warmEcho } from '@/lib/echoCache';
import { ensureWarmed as warmAttains } from '@/lib/attainsCache';
import { ensureWarmed as warmDam } from '@/lib/damCache';
import { ensureWarmed as warmUsdm } from '@/lib/usdmCache';
import { ensureWarmed as warmNwisIv } from '@/lib/nwisIvCache';
import { ensureWarmed as warmNwps } from '@/lib/nwpsCache';
import { ensureWarmed as warmFema } from '@/lib/femaCache';
import { ensureWarmed as warmAirQuality } from '@/lib/airQualityCache';
import { ensureWarmed as warmEjscreen } from '@/lib/ejscreenCache';
import { ensureWarmed as warmDodPfas } from '@/lib/dodPfasCache';
import { ensureWarmed as warmWqp } from '@/lib/wqpCache';
import { ensureWarmed as warmNwsAlerts } from '@/lib/nwsAlertCache';
import { ensureWarmed as warmPfas } from '@/lib/pfasCache';
import { ensureWarmed as warmIcis } from '@/lib/icisCache';
import { ensureWarmed as warmFirms } from '@/lib/firmsCache';

// ── Cache name → warm function mapping ──────────────────────────────────────

const WARM_FNS: Record<string, () => Promise<void>> = {
  sdwis: warmSdwis,
  echo: warmEcho,
  attains: warmAttains,
  dam: warmDam,
  usdm: warmUsdm,
  nwisIv: warmNwisIv,
  nwps: warmNwps,
  fema: warmFema,
  airQuality: warmAirQuality,
  ejscreen: warmEjscreen,
  dodPfas: warmDodPfas,
  wqp: warmWqp,
  nwsAlerts: warmNwsAlerts,
  pfas: warmPfas,
  icis: warmIcis,
  firms: warmFirms,
};

// ── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lens = searchParams.get('lens');
    const role = searchParams.get('role') ?? 'Federal';
    const state = searchParams.get('state')?.toUpperCase() || null;

    if (!lens) {
      return NextResponse.json(
        { error: 'Missing required parameter: lens' },
        { status: 400 },
      );
    }

    // Warm only the caches needed for this lens
    const cacheNames = getCacheNamesForLens(lens);
    const warmPromises = cacheNames
      .map(name => WARM_FNS[name])
      .filter(Boolean)
      .map(fn => fn());
    await Promise.allSettled(warmPromises);

    // Also warm nwps (used by nwisIv evaluator)
    if (cacheNames.includes('nwisIv')) {
      await Promise.allSettled([warmNwps()]);
    }

    const story = await generateLensStory(lens, role, state);

    return NextResponse.json(story);
  } catch (err: any) {
    console.error('[lens-story] Error:', err?.message ?? err);
    return NextResponse.json(
      { error: 'Failed to generate lens story', detail: err?.message },
      { status: 500 },
    );
  }
}
