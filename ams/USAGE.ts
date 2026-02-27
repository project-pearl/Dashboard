// =============================================================================
// USAGE EXAMPLES — How to wire AMS into existing PIN pages
// =============================================================================

// ---------------------------------------------------------------------------
// 1. Add GlobalAlertBadge to your top nav / app layout
// ---------------------------------------------------------------------------

/*
  In your main layout (e.g., app/layout.tsx or wherever your top nav lives):

  import { GlobalAlertBadge, MOCK_ALERT_SUMMARY } from "@/ams";

  // In the nav bar, next to user avatar / settings:
  <GlobalAlertBadge
    summary={alertSummary}       // Replace with live data hook
    onNavigateToDisaster={() => router.push("/disaster-emergency")}
  />
*/

// ---------------------------------------------------------------------------
// 2. Add AMSAlertMonitor card to Disaster/Emergency sidebar
// ---------------------------------------------------------------------------

/*
  In your Disaster/Emergency page (wherever that sidebar renders cards):

  import { AMSAlertMonitor, MOCK_ALERT_SUMMARY } from "@/ams";

  // Add as a card alongside existing cards in the sidebar:
  <AMSAlertMonitor
    summary={alertSummary}       // Replace with live data hook
    role={currentUserRole}        // PinRole enum value
    onOpenResponsePlanner={(event) => {
      // Navigate to Response Planner with event context pre-loaded
      router.push(`/disaster-emergency/response-planner?huc8=${event.huc8}`);
    }}
  />
*/

// ---------------------------------------------------------------------------
// 3. Add SentinelHealthMonitor to admin/settings
// ---------------------------------------------------------------------------

/*
  In your admin settings page:

  import { SentinelHealthMonitor, MOCK_SENTINEL_HEALTH } from "@/ams";

  <SentinelHealthMonitor sources={sentinelHealth} />
*/

// ---------------------------------------------------------------------------
// 4. Data hook pattern (replace mock data with real API)
// ---------------------------------------------------------------------------

/*
  Create a hook that polls your Sentinel API:

  import { useState, useEffect } from "react";
  import type { AlertSummary, SentinelHealth } from "@/ams";

  export function useAlertSummary(role: PinRole, pollIntervalMs = 30000) {
    const [summary, setSummary] = useState<AlertSummary | null>(null);

    useEffect(() => {
      const fetchAlerts = async () => {
        const res = await fetch(`/api/sentinel/alerts?role=${role}`);
        const data = await res.json();
        setSummary(data);
      };

      fetchAlerts();
      const interval = setInterval(fetchAlerts, pollIntervalMs);
      return () => clearInterval(interval);
    }, [role, pollIntervalMs]);

    return summary;
  }

  export function useSentinelHealth(pollIntervalMs = 60000) {
    const [health, setHealth] = useState<SentinelHealth[]>([]);

    useEffect(() => {
      const fetchHealth = async () => {
        const res = await fetch("/api/sentinel/health");
        const data = await res.json();
        setHealth(data);
      };

      fetchHealth();
      const interval = setInterval(fetchHealth, pollIntervalMs);
      return () => clearInterval(interval);
    }, [pollIntervalMs]);

    return health;
  }
*/

// ---------------------------------------------------------------------------
// 5. File structure — where to put these in your project
// ---------------------------------------------------------------------------

/*
  Recommended placement in your Next.js project:

  src/
    ams/
      index.ts                          ← barrel exports
      types/
        sentinel.ts                     ← core type definitions
        scoring-config.ts               ← tunable scoring parameters
      components/
        AMSAlertMonitor.tsx             ← card for Disaster/Emergency sidebar
        GlobalAlertBadge.tsx            ← top nav alert bell
        SentinelHealthMonitor.tsx       ← admin source health view
      data/
        mock-alerts.ts                  ← test data (delete in production)
      hooks/
        useAlertSummary.ts              ← you build this (real API hook)
        useSentinelHealth.ts            ← you build this (real API hook)

  The Tier 1 sentinel and Tier 2 scoring engine themselves run server-side
  (as part of your existing Python fetch system + a new TS scoring module).
  These UI components just consume the output.
*/

export {};
