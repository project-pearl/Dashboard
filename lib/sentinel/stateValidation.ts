/* ------------------------------------------------------------------ */
/*  PIN Sentinel — US State Code Validation                           */
/*  Prevents regex extraction from matching non-state 2-letter codes  */
/* ------------------------------------------------------------------ */

/** All valid US state + territory 2-letter codes */
export const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY',
  // Territories
  'AS', 'GU', 'MP', 'PR', 'VI',
]);

/** Returns true if the string is a valid US state/territory code */
export function isValidState(code: string | undefined): boolean {
  return code != null && US_STATES.has(code);
}
