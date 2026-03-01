// ─── State-Specific Cost Multipliers ─────────────────────────────────────────
// Values are relative to national average (1.0). Sources: RSMeans regional
// factors, EPA enforcement data patterns, BLS labor statistics (simplified).

export interface StateFactors {
  abbr: string;
  laborRateIndex: number;       // construction/repair labor cost multiplier
  penaltySeverityIndex: number; // state enforcement aggressiveness
  contractorAvailIndex: number; // contractor scarcity (higher = harder to find)
  climateZone: 'tropical' | 'subtropical' | 'temperate' | 'continental' | 'arid' | 'subarctic';
  enforcementPattern: 'aggressive' | 'moderate' | 'lenient';
}

const FACTORS: StateFactors[] = [
  { abbr: 'AL', laborRateIndex: 0.82, penaltySeverityIndex: 0.85, contractorAvailIndex: 0.90, climateZone: 'subtropical', enforcementPattern: 'moderate' },
  { abbr: 'AK', laborRateIndex: 1.45, penaltySeverityIndex: 0.80, contractorAvailIndex: 1.50, climateZone: 'subarctic', enforcementPattern: 'lenient' },
  { abbr: 'AZ', laborRateIndex: 0.95, penaltySeverityIndex: 0.90, contractorAvailIndex: 0.95, climateZone: 'arid', enforcementPattern: 'moderate' },
  { abbr: 'AR', laborRateIndex: 0.78, penaltySeverityIndex: 0.80, contractorAvailIndex: 0.85, climateZone: 'subtropical', enforcementPattern: 'lenient' },
  { abbr: 'CA', laborRateIndex: 1.35, penaltySeverityIndex: 1.40, contractorAvailIndex: 1.20, climateZone: 'temperate', enforcementPattern: 'aggressive' },
  { abbr: 'CO', laborRateIndex: 1.05, penaltySeverityIndex: 1.00, contractorAvailIndex: 1.05, climateZone: 'continental', enforcementPattern: 'moderate' },
  { abbr: 'CT', laborRateIndex: 1.25, penaltySeverityIndex: 1.20, contractorAvailIndex: 1.10, climateZone: 'temperate', enforcementPattern: 'aggressive' },
  { abbr: 'DE', laborRateIndex: 1.10, penaltySeverityIndex: 1.05, contractorAvailIndex: 1.00, climateZone: 'temperate', enforcementPattern: 'moderate' },
  { abbr: 'FL', laborRateIndex: 0.92, penaltySeverityIndex: 1.00, contractorAvailIndex: 0.90, climateZone: 'tropical', enforcementPattern: 'moderate' },
  { abbr: 'GA', laborRateIndex: 0.88, penaltySeverityIndex: 0.90, contractorAvailIndex: 0.90, climateZone: 'subtropical', enforcementPattern: 'moderate' },
  { abbr: 'HI', laborRateIndex: 1.40, penaltySeverityIndex: 1.00, contractorAvailIndex: 1.45, climateZone: 'tropical', enforcementPattern: 'moderate' },
  { abbr: 'ID', laborRateIndex: 0.88, penaltySeverityIndex: 0.80, contractorAvailIndex: 1.00, climateZone: 'continental', enforcementPattern: 'lenient' },
  { abbr: 'IL', laborRateIndex: 1.15, penaltySeverityIndex: 1.10, contractorAvailIndex: 1.00, climateZone: 'continental', enforcementPattern: 'moderate' },
  { abbr: 'IN', laborRateIndex: 0.95, penaltySeverityIndex: 0.95, contractorAvailIndex: 0.95, climateZone: 'continental', enforcementPattern: 'moderate' },
  { abbr: 'IA', laborRateIndex: 0.90, penaltySeverityIndex: 0.90, contractorAvailIndex: 0.95, climateZone: 'continental', enforcementPattern: 'moderate' },
  { abbr: 'KS', laborRateIndex: 0.88, penaltySeverityIndex: 0.85, contractorAvailIndex: 0.95, climateZone: 'continental', enforcementPattern: 'lenient' },
  { abbr: 'KY', laborRateIndex: 0.85, penaltySeverityIndex: 0.90, contractorAvailIndex: 0.90, climateZone: 'temperate', enforcementPattern: 'moderate' },
  { abbr: 'LA', laborRateIndex: 0.85, penaltySeverityIndex: 0.85, contractorAvailIndex: 0.95, climateZone: 'subtropical', enforcementPattern: 'lenient' },
  { abbr: 'ME', laborRateIndex: 1.00, penaltySeverityIndex: 1.00, contractorAvailIndex: 1.10, climateZone: 'temperate', enforcementPattern: 'moderate' },
  { abbr: 'MD', laborRateIndex: 1.10, penaltySeverityIndex: 1.20, contractorAvailIndex: 1.00, climateZone: 'temperate', enforcementPattern: 'aggressive' },
  { abbr: 'MA', laborRateIndex: 1.30, penaltySeverityIndex: 1.25, contractorAvailIndex: 1.15, climateZone: 'temperate', enforcementPattern: 'aggressive' },
  { abbr: 'MI', laborRateIndex: 1.00, penaltySeverityIndex: 1.00, contractorAvailIndex: 0.95, climateZone: 'continental', enforcementPattern: 'moderate' },
  { abbr: 'MN', laborRateIndex: 1.05, penaltySeverityIndex: 1.10, contractorAvailIndex: 1.00, climateZone: 'continental', enforcementPattern: 'aggressive' },
  { abbr: 'MS', laborRateIndex: 0.75, penaltySeverityIndex: 0.80, contractorAvailIndex: 0.90, climateZone: 'subtropical', enforcementPattern: 'lenient' },
  { abbr: 'MO', laborRateIndex: 0.95, penaltySeverityIndex: 0.90, contractorAvailIndex: 0.95, climateZone: 'continental', enforcementPattern: 'moderate' },
  { abbr: 'MT', laborRateIndex: 0.92, penaltySeverityIndex: 0.85, contractorAvailIndex: 1.15, climateZone: 'continental', enforcementPattern: 'lenient' },
  { abbr: 'NE', laborRateIndex: 0.88, penaltySeverityIndex: 0.85, contractorAvailIndex: 1.00, climateZone: 'continental', enforcementPattern: 'lenient' },
  { abbr: 'NV', laborRateIndex: 1.05, penaltySeverityIndex: 0.90, contractorAvailIndex: 1.05, climateZone: 'arid', enforcementPattern: 'moderate' },
  { abbr: 'NH', laborRateIndex: 1.10, penaltySeverityIndex: 1.05, contractorAvailIndex: 1.10, climateZone: 'temperate', enforcementPattern: 'moderate' },
  { abbr: 'NJ', laborRateIndex: 1.25, penaltySeverityIndex: 1.30, contractorAvailIndex: 1.10, climateZone: 'temperate', enforcementPattern: 'aggressive' },
  { abbr: 'NM', laborRateIndex: 0.88, penaltySeverityIndex: 0.85, contractorAvailIndex: 1.05, climateZone: 'arid', enforcementPattern: 'lenient' },
  { abbr: 'NY', laborRateIndex: 1.35, penaltySeverityIndex: 1.35, contractorAvailIndex: 1.15, climateZone: 'temperate', enforcementPattern: 'aggressive' },
  { abbr: 'NC', laborRateIndex: 0.88, penaltySeverityIndex: 1.00, contractorAvailIndex: 0.90, climateZone: 'subtropical', enforcementPattern: 'moderate' },
  { abbr: 'ND', laborRateIndex: 0.90, penaltySeverityIndex: 0.80, contractorAvailIndex: 1.15, climateZone: 'continental', enforcementPattern: 'lenient' },
  { abbr: 'OH', laborRateIndex: 0.98, penaltySeverityIndex: 1.00, contractorAvailIndex: 0.95, climateZone: 'continental', enforcementPattern: 'moderate' },
  { abbr: 'OK', laborRateIndex: 0.82, penaltySeverityIndex: 0.80, contractorAvailIndex: 0.90, climateZone: 'continental', enforcementPattern: 'lenient' },
  { abbr: 'OR', laborRateIndex: 1.10, penaltySeverityIndex: 1.15, contractorAvailIndex: 1.05, climateZone: 'temperate', enforcementPattern: 'aggressive' },
  { abbr: 'PA', laborRateIndex: 1.10, penaltySeverityIndex: 1.10, contractorAvailIndex: 1.00, climateZone: 'temperate', enforcementPattern: 'moderate' },
  { abbr: 'RI', laborRateIndex: 1.15, penaltySeverityIndex: 1.10, contractorAvailIndex: 1.10, climateZone: 'temperate', enforcementPattern: 'moderate' },
  { abbr: 'SC', laborRateIndex: 0.82, penaltySeverityIndex: 0.90, contractorAvailIndex: 0.90, climateZone: 'subtropical', enforcementPattern: 'moderate' },
  { abbr: 'SD', laborRateIndex: 0.85, penaltySeverityIndex: 0.80, contractorAvailIndex: 1.10, climateZone: 'continental', enforcementPattern: 'lenient' },
  { abbr: 'TN', laborRateIndex: 0.85, penaltySeverityIndex: 0.90, contractorAvailIndex: 0.90, climateZone: 'subtropical', enforcementPattern: 'moderate' },
  { abbr: 'TX', laborRateIndex: 0.90, penaltySeverityIndex: 0.90, contractorAvailIndex: 0.85, climateZone: 'subtropical', enforcementPattern: 'moderate' },
  { abbr: 'UT', laborRateIndex: 0.92, penaltySeverityIndex: 0.85, contractorAvailIndex: 1.00, climateZone: 'arid', enforcementPattern: 'lenient' },
  { abbr: 'VT', laborRateIndex: 1.05, penaltySeverityIndex: 1.10, contractorAvailIndex: 1.15, climateZone: 'temperate', enforcementPattern: 'moderate' },
  { abbr: 'VA', laborRateIndex: 1.00, penaltySeverityIndex: 1.05, contractorAvailIndex: 0.95, climateZone: 'temperate', enforcementPattern: 'moderate' },
  { abbr: 'WA', laborRateIndex: 1.15, penaltySeverityIndex: 1.20, contractorAvailIndex: 1.10, climateZone: 'temperate', enforcementPattern: 'aggressive' },
  { abbr: 'WV', laborRateIndex: 0.88, penaltySeverityIndex: 0.85, contractorAvailIndex: 1.00, climateZone: 'temperate', enforcementPattern: 'lenient' },
  { abbr: 'WI', laborRateIndex: 1.00, penaltySeverityIndex: 1.05, contractorAvailIndex: 1.00, climateZone: 'continental', enforcementPattern: 'moderate' },
  { abbr: 'WY', laborRateIndex: 0.90, penaltySeverityIndex: 0.80, contractorAvailIndex: 1.20, climateZone: 'continental', enforcementPattern: 'lenient' },
];

const FACTOR_MAP = new Map(FACTORS.map(f => [f.abbr, f]));

const DEFAULT_FACTORS: StateFactors = {
  abbr: 'US',
  laborRateIndex: 1.0,
  penaltySeverityIndex: 1.0,
  contractorAvailIndex: 1.0,
  climateZone: 'temperate',
  enforcementPattern: 'moderate',
};

export function getStateFactors(stateAbbr: string): StateFactors {
  return FACTOR_MAP.get(stateAbbr.toUpperCase()) ?? DEFAULT_FACTORS;
}
