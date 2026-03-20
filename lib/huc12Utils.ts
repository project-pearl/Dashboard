/**
 * HUC-12 Utilities
 *
 * Handles 12-digit Hydrologic Unit Code operations for watershed management.
 * HUC-12 provides subwatershed precision (40-150 square miles).
 */

/**
 * Extract HUC-12 from various formats
 */
export function extractHuc12(input: string): string | null {
  if (!input) return null;

  // Clean input - remove spaces, dashes, and other separators
  const clean = input.replace(/[\s\-\.]/g, '');

  // Extract 12 digits
  const match = clean.match(/(\d{12})/);
  return match ? match[1] : null;
}

/**
 * Convert HUC-12 to parent HUC-8
 */
export function huc12ToHuc8(huc12: string): string {
  if (!huc12 || huc12.length < 8) return '';
  return huc12.slice(0, 8);
}

/**
 * Convert HUC-12 to other hierarchy levels
 */
export function huc12ToHuc10(huc12: string): string {
  if (!huc12 || huc12.length < 10) return '';
  return huc12.slice(0, 10);
}

export function huc12ToHuc6(huc12: string): string {
  if (!huc12 || huc12.length < 6) return '';
  return huc12.slice(0, 6);
}

export function huc12ToHuc4(huc12: string): string {
  if (!huc12 || huc12.length < 4) return '';
  return huc12.slice(0, 4);
}

export function huc12ToHuc2(huc12: string): string {
  if (!huc12 || huc12.length < 2) return '';
  return huc12.slice(0, 2);
}

/**
 * Validate HUC-12 format
 */
export function isValidHuc12(huc: string): boolean {
  return /^\d{12}$/.test(huc);
}

/**
 * Generate HUC-12s within a parent HUC-8
 * (Approximation - in production would use NHD/WBD data)
 */
export function getHuc12sInHuc8(huc8: string): string[] {
  if (!isValidHuc8(huc8)) return [];

  const huc12s: string[] = [];
  // Typical HUC-8 contains 10-20 HUC-12s
  // This is a rough approximation for development
  for (let i = 1; i <= 15; i++) {
    huc12s.push(`${huc8}${i.toString().padStart(4, '0')}`);
  }
  return huc12s;
}

/**
 * Validate HUC-8 format (for compatibility)
 */
export function isValidHuc8(huc: string): boolean {
  return /^\d{8}$/.test(huc);
}

/**
 * Get HUC name/description (would be enhanced with lookup tables)
 */
export function getHuc12Name(huc12: string): string {
  const huc8 = huc12ToHuc8(huc12);
  const huc4 = huc12ToHuc4(huc12);

  // Basic naming based on region codes
  const regionNames: Record<string, string> = {
    '01': 'New England',
    '02': 'Mid-Atlantic',
    '03': 'South Atlantic-Gulf',
    '04': 'Great Lakes',
    '05': 'Ohio',
    '06': 'Tennessee',
    '07': 'Upper Mississippi',
    '08': 'Lower Mississippi',
    '09': 'Souris-Red-Rainy',
    '10': 'Missouri',
    '11': 'Arkansas-White-Red',
    '12': 'Texas-Gulf',
    '13': 'Rio Grande',
    '14': 'Upper Colorado',
    '15': 'Lower Colorado',
    '16': 'Great Basin',
    '17': 'Pacific Northwest',
    '18': 'California',
    '19': 'Alaska',
    '20': 'Hawaii',
    '21': 'Puerto Rico'
  };

  const region = regionNames[huc4.slice(0, 2)] || 'Unknown Region';
  return `${region} Subwatershed ${huc12}`;
}

/**
 * Calculate approximate area in square miles (very rough estimate)
 */
export function getHuc12ApproximateArea(huc12: string): number {
  // HUC-12s typically range from 40-150 square miles
  // Return average for development - would use precise boundaries in production
  return 95; // Average square miles
}

/**
 * Get neighboring HUC-12s (simplified version)
 * In production, this would use spatial adjacency data
 */
export function getAdjacentHuc12s(huc12: string): string[] {
  // Placeholder - would require spatial analysis of HUC boundaries
  // For now, return HUC-12s in same HUC-8 as neighbors
  const huc8 = huc12ToHuc8(huc12);
  return getHuc12sInHuc8(huc8).filter(h => h !== huc12).slice(0, 6);
}