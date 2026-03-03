/* ------------------------------------------------------------------ */
/*  CDC NWSS — Geographic Correlation (FIPS → HUC-8)                  */
/*                                                                    */
/*  Maps NWSS sewershed data (county FIPS) to PIN's water quality     */
/*  assessment units (HUC-8 basins).                                  */
/*                                                                    */
/*  Join chain:                                                       */
/*    NWSS sewershed → county_fips → HUC-8 basin(s) → PIN units      */
/*                                                                    */
/*  Source: USGS Watershed Boundary Dataset (WBD) HUC-county xwalk.  */
/*  One FIPS can map to multiple HUC-8s (county straddles basins).   */
/*                                                                    */
/*  Temporal alignment for Fusion Engine correlation:                  */
/*    NWSS: weekly samples                                            */
/*    USGS: 15-min intervals                                          */
/*    Window: ±3 days around NWSS sample date (accounts for 24-72h   */
/*    toilet-to-treatment-plant transit time)                          */
/* ------------------------------------------------------------------ */

/**
 * Region 3 FIPS → HUC-8 crosswalk.
 * Covers DE, DC, MD, PA, VA, WV — the Fusion Engine validation scope.
 *
 * Sourced from USGS WBD (Watershed Boundary Dataset) county-HUC crosswalk.
 * Each entry maps a county FIPS code to the HUC-8 basins that overlap it.
 */
const REGION_3_FIPS_TO_HUC8: Record<string, string[]> = {
  // ── Maryland ──────────────────────────────────────────────────────
  '24001': ['02060003'],                          // Allegany → N Branch Potomac
  '24003': ['02060001', '02060004'],              // Anne Arundel → Patuxent, Severn
  '24005': ['02060003', '02060001'],              // Baltimore County → Gunpowder-Patapsco
  '24009': ['02060005'],                          // Calvert → Lower Potomac
  '24011': ['02060005'],                          // Caroline → Choptank
  '24013': ['02060005'],                          // Carroll → Patapsco
  '24015': ['02060005'],                          // Cecil → Lower Susquehanna
  '24017': ['02060004'],                          // Charles → Mattawoman
  '24019': ['02060001'],                          // Dorchester → Nanticoke
  '24021': ['02060003'],                          // Frederick → Monocacy
  '24023': ['02060003'],                          // Garrett → Youghiogheny
  '24025': ['02060006', '02060001'],              // Harford → Bush-Gunpowder
  '24027': ['02060001'],                          // Howard → Patuxent
  '24029': ['02060002'],                          // Kent → Chester
  '24031': ['02070008', '02070010'],              // Montgomery → Middle Potomac-Catoctin
  '24033': ['02060004'],                          // Prince George's → Patuxent-Anacostia
  '24035': ['02060002'],                          // Queen Anne's → Chester-Sassafras
  '24037': ['02060004'],                          // St. Mary's → St. Mary's
  '24039': ['02060002'],                          // Somerset → Tangier
  '24041': ['02060005'],                          // Talbot → Choptank
  '24043': ['02060003'],                          // Washington → Antietam-Conococheague
  '24045': ['02060001'],                          // Wicomico → Wicomico
  '24047': ['02060001'],                          // Worcester → Coastal Bays
  '24510': ['02060003', '02060001'],              // Baltimore City → Patapsco

  // ── Virginia ──────────────────────────────────────────────────────
  '51003': ['02080201'],                          // Albemarle → Rivanna
  '51013': ['03010101'],                          // Arlington → Potomac
  '51041': ['02080201'],                          // Chesterfield → Lower James
  '51059': ['02070010'],                          // Fairfax → Middle Potomac
  '51087': ['02070008'],                          // Henrico → Upper James
  '51107': ['02080201'],                          // Loudoun → Goose Creek
  '51153': ['02080106'],                          // Prince William → Occoquan
  '51510': ['02080201'],                          // Alexandria City → Potomac
  '51550': ['02080201'],                          // Chesapeake City → Hampton Roads
  '51650': ['02080201'],                          // Hampton City → Hampton Roads
  '51700': ['02080201'],                          // Newport News City → Hampton Roads
  '51710': ['02080201'],                          // Norfolk City → Hampton Roads
  '51760': ['02080201'],                          // Richmond City → James
  '51770': ['02080201'],                          // Roanoke City → Roanoke
  '51810': ['02080201'],                          // Virginia Beach City → Hampton Roads

  // ── Pennsylvania ──────────────────────────────────────────────────
  '42003': ['05030101'],                          // Allegheny → Upper Ohio
  '42011': ['02050301'],                          // Berks → Schuylkill
  '42017': ['02050306'],                          // Bucks → Lower Delaware
  '42029': ['02040201'],                          // Chester → Brandywine-Christina
  '42045': ['02050306', '02050305'],              // Delaware → Lower Delaware
  '42049': ['02050201'],                          // Erie → Lake Erie
  '42071': ['02050106'],                          // Lancaster → Lower Susquehanna
  '42077': ['02050104'],                          // Lehigh → Lehigh
  '42091': ['02070008'],                          // Montgomery → Lower Schuylkill
  '42095': ['02040101'],                          // Northampton → Upper Delaware
  '42101': ['02040202', '02050306'],              // Philadelphia → Delaware-Schuylkill
  '42133': ['02050107'],                          // York → Lower Susquehanna

  // ── Delaware ──────────────────────────────────────────────────────
  '10001': ['02040207'],                          // Kent → Murderkill-St. Jones
  '10003': ['02040202'],                          // New Castle → Brandywine-Christina
  '10005': ['02040207'],                          // Sussex → Nanticoke-Indian River

  // ── District of Columbia ──────────────────────────────────────────
  '11001': ['02070010'],                          // DC → Middle Potomac-Anacostia

  // ── West Virginia ─────────────────────────────────────────────────
  '54003': ['02070003'],                          // Berkeley → Opequon
  '54025': ['05020004'],                          // Greenbrier → Greenbrier
  '54037': ['02070001'],                          // Jefferson → Shenandoah
  '54039': ['05050009'],                          // Kanawha → Coal
  '54049': ['02070004'],                          // Marion → Tygart Valley
  '54061': ['05020001'],                          // Monongalia → Monongahela
  '54079': ['05020001'],                          // Putnam → Kanawha
  '54107': ['02070003'],                          // Wood → Little Kanawha
};

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Map a county FIPS code to HUC-8 basin codes.
 * Returns empty array if FIPS is not in the crosswalk.
 */
export function fipsToHuc8(fips: string): string[] {
  return REGION_3_FIPS_TO_HUC8[fips] || [];
}

/**
 * Map multiple FIPS codes to a deduplicated set of HUC-8 basins.
 */
export function fipsBatchToHuc8(fipsCodes: string[]): string[] {
  const hucs = new Set<string>();
  for (const fips of fipsCodes) {
    for (const huc of fipsToHuc8(fips)) {
      hucs.add(huc);
    }
  }
  return [...hucs];
}

/**
 * Check if a FIPS code is in the Region 3 crosswalk.
 */
export function isRegion3Fips(fips: string): boolean {
  return fips in REGION_3_FIPS_TO_HUC8;
}

/**
 * Get all FIPS codes for a given HUC-8 basin (reverse lookup).
 */
export function huc8ToFips(huc8: string): string[] {
  const result: string[] = [];
  for (const [fips, hucs] of Object.entries(REGION_3_FIPS_TO_HUC8)) {
    if (hucs.includes(huc8)) result.push(fips);
  }
  return result;
}

/**
 * Get the temporal correlation window for NWSS ↔ PIN WQ alignment.
 * Returns [startDate, endDate] as ISO strings.
 *
 * NWSS samples lag environmental contamination by 24-72 hours
 * (toilet-to-treatment-plant transit). Expand WQ window ±3 days.
 */
export function getCorrelationWindow(sampleDate: string): [string, string] {
  const date = new Date(sampleDate);
  const start = new Date(date.getTime() - 3 * 24 * 60 * 60 * 1000);
  const end = new Date(date.getTime() + 3 * 24 * 60 * 60 * 1000);
  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
}
