// =============================================================================
// Example API Routes for Next.js App Router
// =============================================================================
//
// Drop these into your app/api/ directory. Adjust paths to match your project.
//
// These are the three endpoints your frontend needs:
//   GET /api/wqp/waterbody?huc=02060003        → observations for a waterbody
//   GET /api/wqp/state?state=MD                 → summary for state card
//   GET /api/wqp/stations?state=MD              → stations for map markers
//   GET /api/wqp/stations?huc=02060003          → stations in a HUC
//
// =============================================================================


// ─── app/api/wqp/waterbody/route.ts ─────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getWaterbodyObservations } from "@/lib/wqp";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const huc = searchParams.get("huc");
  const siteId = searchParams.get("siteid");
  const yearsBack = parseInt(searchParams.get("years") || "5", 10);

  if (!huc && !siteId) {
    return NextResponse.json(
      { error: "Provide ?huc=XXXXXXXX or ?siteid=XXXXX" },
      { status: 400 }
    );
  }

  try {
    const data = await getWaterbodyObservations({
      huc: huc || undefined,
      siteId: siteId || undefined,
      yearsBack,
    });

    return NextResponse.json(data, {
      headers: {
        // Let the CDN cache for 15 min, browser for 5 min
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[WQP waterbody]", err);
    return NextResponse.json(
      { error: "Failed to fetch WQP data", detail: String(err) },
      { status: 502 }
    );
  }
}


// ─── app/api/wqp/state/route.ts ─────────────────────────────────────────────

// import { NextRequest, NextResponse } from "next/server";
// import { getStateSummary } from "@/lib/wqp";

export async function GET_state(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state");

  if (!state) {
    return NextResponse.json(
      { error: "Provide ?state=MD" },
      { status: 400 }
    );
  }

  try {
    const data = await getStateSummary(state);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("[WQP state]", err);
    return NextResponse.json(
      { error: "Failed to fetch state summary", detail: String(err) },
      { status: 502 }
    );
  }
}


// ─── app/api/wqp/stations/route.ts ──────────────────────────────────────────

// import { NextRequest, NextResponse } from "next/server";
// import { getStationsForMap } from "@/lib/wqp";

export async function GET_stations(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state");
  const huc = searchParams.get("huc");
  const county = searchParams.get("county");

  if (!state && !huc && !county) {
    return NextResponse.json(
      { error: "Provide ?state=MD, ?huc=XXXXXXXX, or ?county=US:24:003" },
      { status: 400 }
    );
  }

  try {
    const data = await getStationsForMap({
      stateAbbr: state || undefined,
      huc: huc || undefined,
      countyFips: county || undefined,
    });
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[WQP stations]", err);
    return NextResponse.json(
      { error: "Failed to fetch stations", detail: String(err) },
      { status: 502 }
    );
  }
}
