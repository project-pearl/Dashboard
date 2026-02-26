// HUC-8 watershed extraction and grouping utilities

type AlertLevel = 'none' | 'low' | 'medium' | 'high';

export interface RegionRow {
  id: string;
  name: string;
  state: string;
  alertLevel: AlertLevel;
  activeAlerts: number;
  lastUpdatedISO: string;
  status: 'assessed' | 'monitored' | 'unmonitored';
  dataSourceCount: number;
}

export interface AttainsBulkEntry {
  id: string;
  name: string;
  category: string;
  alertLevel: AlertLevel;
  causes: string[];
  cycle: string;
  lat?: number | null;
  lon?: number | null;
  waterType?: string | null;
  causeCount: number;
}

export interface WatershedGroup {
  huc8: string;
  name: string;
  waterbodies: RegionRow[];
  total: number;
  impaired: number;
  severe: number;
  activeAlerts: number;
  healthPct: number;
  hasCoastal: boolean;
}

export const PRIORITY_WB_ALERT_THRESHOLD = 10;

export const COASTAL_WATER_TYPES = new Set(['ES', 'OC', 'CW', 'ESTUARY', 'OCEAN', 'COASTAL']);

const SEVERITY: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };

/**
 * Extract HUC-8 code from an ATTAINS assessment unit ID.
 * Patterns handled:
 *   MD-02120201-Lower_Susquehanna  → 02120201
 *   AL03130002-0602-100            → 03130002
 *   MD-021202010319-Rock_Run1      → 02120201 (first 8 digits)
 */
export function extractHuc8(attainsId: string): string | null {
  if (!attainsId) return null;

  // Pattern 1: STATE-XXXXXXXX (with dash separator)
  const m1 = attainsId.match(/^[A-Z]{2}-(\d{8,})/);
  if (m1) return m1[1].slice(0, 8);

  // Pattern 2: STXXXXXXXX (no dash, digits immediately after 2-letter code)
  const m2 = attainsId.match(/^[A-Z]{2}(\d{8,})/);
  if (m2) return m2[1].slice(0, 8);

  return null;
}

/**
 * Check if a waterbody qualifies as a priority waterbody.
 * Priority = high alert level AND (activeAlerts >= threshold OR causeCount >= 3)
 */
export function isPriorityWaterbody(
  row: RegionRow,
  attainsEntry?: AttainsBulkEntry | null
): boolean {
  if (row.alertLevel !== 'high') return false;
  const causeCount = attainsEntry?.causeCount ?? attainsEntry?.causes?.length ?? 0;
  return row.activeAlerts >= PRIORITY_WB_ALERT_THRESHOLD || causeCount >= 3;
}

/**
 * Check if an ATTAINS entry represents a coastal waterbody.
 */
export function isCoastalWaterbody(attainsEntry?: AttainsBulkEntry | null): boolean {
  if (!attainsEntry?.waterType) return false;
  const wt = attainsEntry.waterType.toUpperCase();
  return COASTAL_WATER_TYPES.has(wt) ||
    wt.includes('ESTUAR') || wt.includes('OCEAN') || wt.includes('COAST');
}

interface RegionMeta {
  huc8: string;
  name: string;
  [key: string]: any;
}

/**
 * Group waterbodies by HUC-8 watershed.
 *
 * Resolution order for each waterbody's HUC-8:
 * 1. Extract from matching ATTAINS assessment unit ID
 * 2. Fall back to REGION_META huc8 field (via registryMeta)
 * 3. Assign to "OTHER" bucket
 */
export function groupByWatershed(
  regionData: RegionRow[],
  attainsBulk: AttainsBulkEntry[],
  huc8Names: Record<string, string>,
  registryMeta: Record<string, RegionMeta>
): WatershedGroup[] {
  // Build lookup: waterbody ID → ATTAINS entry (for HUC extraction)
  const attainsById = new Map<string, AttainsBulkEntry>();
  // Build lookup: normalized name → ATTAINS entry
  const attainsByName = new Map<string, AttainsBulkEntry>();
  for (const a of attainsBulk) {
    if (a.id) attainsById.set(a.id, a);
    const norm = a.name.toLowerCase().trim();
    if (norm) attainsByName.set(norm, a);
  }

  const groups = new Map<string, { rows: RegionRow[]; hasCoastal: boolean }>();

  for (const row of regionData) {
    let huc8: string | null = null;

    // Try matching ATTAINS entry by ID first, then fuzzy name match
    let attainsMatch = attainsById.get(row.id);
    if (!attainsMatch) {
      const normName = row.name.toLowerCase().replace(/,.*$/, '').trim();
      attainsMatch = attainsByName.get(normName) || undefined;
      if (!attainsMatch) {
        // Fuzzy: check if any attains name contains or is contained by the row name
        for (const a of attainsBulk) {
          const aN = a.name.toLowerCase().trim();
          if (aN.includes(normName) || normName.includes(aN)) {
            attainsMatch = a;
            break;
          }
        }
      }
    }

    // Resolution 1: extract from ATTAINS ID
    if (attainsMatch) {
      huc8 = extractHuc8(attainsMatch.id);
    }

    // Resolution 2: REGION_META huc8 field
    if (!huc8) {
      const meta = registryMeta[row.id];
      if (meta?.huc8 && meta.huc8 !== 'nan') {
        huc8 = meta.huc8;
      }
    }

    // Resolution 3: "OTHER"
    if (!huc8) huc8 = 'OTHER';

    const existing = groups.get(huc8);
    const coastal = isCoastalWaterbody(attainsMatch);
    if (existing) {
      existing.rows.push(row);
      if (coastal) existing.hasCoastal = true;
    } else {
      groups.set(huc8, { rows: [row], hasCoastal: coastal });
    }
  }

  // Build WatershedGroup array
  const result: WatershedGroup[] = [];
  for (const [huc8, { rows, hasCoastal }] of groups) {
    const impaired = rows.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length;
    const severe = rows.filter(r => r.alertLevel === 'high').length;
    const alerts = rows.reduce((sum, r) => sum + r.activeAlerts, 0);
    const healthy = rows.filter(r => r.alertLevel === 'none' || r.alertLevel === 'low').length;
    const healthPct = rows.length > 0 ? Math.round((healthy / rows.length) * 100) : 100;

    const name = huc8 === 'OTHER'
      ? 'Other Waterbodies'
      : huc8Names[huc8] || `Watershed ${huc8}`;

    result.push({
      huc8,
      name,
      waterbodies: [...rows].sort((a, b) => SEVERITY[b.alertLevel] - SEVERITY[a.alertLevel] || a.name.localeCompare(b.name)),
      total: rows.length,
      impaired,
      severe,
      activeAlerts: alerts,
      healthPct,
      hasCoastal,
    });
  }

  // Sort: most impaired first, OTHER last
  result.sort((a, b) => {
    if (a.huc8 === 'OTHER') return 1;
    if (b.huc8 === 'OTHER') return -1;
    return b.impaired - a.impaired || b.severe - a.severe || a.name.localeCompare(b.name);
  });

  return result;
}
