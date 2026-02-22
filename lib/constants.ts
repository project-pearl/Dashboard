/**
 * Shared constants used across cron jobs and cache modules.
 */

// 19 priority states fetched by daily cron jobs.
// Covers major watersheds: Chesapeake, Great Lakes, Gulf Coast, West Coast.
export const PRIORITY_STATES = [
  'MD', 'VA', 'DC', 'PA', 'DE', 'FL', 'WV', 'CA', 'TX', 'NY',
  'NJ', 'OH', 'NC', 'MA', 'GA', 'IL', 'MI', 'WA', 'OR',
] as const;

export type PriorityState = (typeof PRIORITY_STATES)[number];

// Priority states with FIPS codes (used by WQP which needs FIPS in the URL)
export const PRIORITY_STATES_WITH_FIPS: [string, string][] = [
  ['MD', '24'], ['VA', '51'], ['DC', '11'], ['PA', '42'], ['DE', '10'],
  ['FL', '12'], ['WV', '54'], ['CA', '06'], ['TX', '48'], ['NY', '36'],
  ['NJ', '34'], ['OH', '39'], ['NC', '37'], ['MA', '25'], ['GA', '13'],
  ['IL', '17'], ['MI', '26'], ['WA', '53'], ['OR', '41'],
];
