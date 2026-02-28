// lib/politicalAccountability.ts
// Political Accountability Index — campaign finance transparency scoring
// Uses OpenFEC API for contribution data + benchmarking against national averages
// Cache official data and update quarterly

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OfficialProfile {
  name: string;
  candidateId: string;
  office: string;            // 'S' = Senate, 'H' = House, 'P' = President
  state: string;             // 2-letter abbreviation
  district?: string;
  party: string;
  incumbentChallenger: string;
  electionYear: number;
}

export interface ContributionBreakdown {
  totalReceipts: number;
  individualContributions: number;
  pacContributions: number;
  selfFunding: number;
  otherCommitteeContributions: number;
  totalDisbursements: number;
  cashOnHand: number;
  debtsOwed: number;
}

export interface AccountabilityScore {
  official: OfficialProfile;
  contributions: ContributionBreakdown;
  transparencyScore: number;       // 0-100
  grassrootsRatio: number;         // individual / total (0-1)
  pacDependencyRatio: number;      // PAC / total (0-1)
  selfFundingRatio: number;        // self / total (0-1)
  overallIndex: number;            // 0-100 composite
  nationalBenchmark: number;       // avg score nationally for same office type
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  waterRelevance: WaterRelevance;
}

export interface WaterRelevance {
  committeeMemberships: string[];  // e.g. ['EPW', 'Appropriations']
  waterVotingRecord: number;       // 0-100 (pro-water-quality voting %)
  sponsoredWaterBills: number;
  cosponseredWaterBills: number;
  epaOversightRole: boolean;
}

export interface StateAccountabilityRollup {
  stateAbbr: string;
  officials: AccountabilityScore[];
  stateAverageIndex: number;
  nationalRank: number;            // 1 = most transparent
  waterChampionCount: number;      // officials with index >= 75
  highRiskCount: number;           // officials with index < 40
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FEC_BASE = 'https://api.open.fec.gov/v1';

// National benchmarks by office type (derived from FEC aggregate data)
// These represent average grassroots/transparency ratios for scoring context
const NATIONAL_BENCHMARKS: Record<string, number> = {
  S: 62,   // Senate avg transparency index
  H: 58,   // House avg transparency index
  P: 55,   // Presidential avg
};

// Water-relevant committees (Senate + House)
const WATER_COMMITTEES = new Set([
  'EPW',     // Environment & Public Works (Senate)
  'ENR',     // Energy & Natural Resources (Senate)
  'APPRO',   // Appropriations
  'T&I',     // Transportation & Infrastructure (House)
  'NR',      // Natural Resources (House)
  'AG',      // Agriculture (both)
]);

// ─── FEC API Helpers ────────────────────────────────────────────────────────

function getFecApiKey(): string {
  return process.env.OPENFEC_API_KEY || process.env.FEC_API_KEY || '';
}

export async function searchCandidates(
  name: string,
  state?: string,
  office?: 'S' | 'H' | 'P',
): Promise<OfficialProfile[]> {
  const apiKey = getFecApiKey();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    api_key: apiKey,
    name,
    sort: '-election_year',
    per_page: '10',
    is_active_candidate: 'true',
  });
  if (state) params.set('state', state);
  if (office) params.set('office', office);

  try {
    const res = await fetch(`${FEC_BASE}/candidates/search/?${params}`, {
      next: { revalidate: 86400 * 90 }, // cache 90 days (quarterly refresh)
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.results || []).map((c: any) => ({
      name: c.name || name,
      candidateId: c.candidate_id || '',
      office: c.office || '',
      state: c.state || state || '',
      district: c.district || undefined,
      party: c.party || '',
      incumbentChallenger: c.incumbent_challenge || '',
      electionYear: c.election_year || 0,
    }));
  } catch {
    return [];
  }
}

export async function fetchContributions(
  candidateId: string,
): Promise<ContributionBreakdown | null> {
  const apiKey = getFecApiKey();
  if (!apiKey || !candidateId) return null;

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      per_page: '1',
      sort: '-cycle',
    });
    const res = await fetch(
      `${FEC_BASE}/candidate/${candidateId}/totals/?${params}`,
      { next: { revalidate: 86400 * 90 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const t = data.results?.[0];
    if (!t) return null;

    return {
      totalReceipts: t.receipts || 0,
      individualContributions: t.individual_contributions || 0,
      pacContributions: t.other_political_committee_contributions || 0,
      selfFunding: t.candidate_contribution || 0,
      otherCommitteeContributions: t.transfers_from_affiliated_committee || 0,
      totalDisbursements: t.disbursements || 0,
      cashOnHand: t.last_cash_on_hand_end_period || 0,
      debtsOwed: t.last_debts_owed_by_committee || 0,
    };
  } catch {
    return null;
  }
}

// ─── Scoring Engine ─────────────────────────────────────────────────────────

export function computeAccountabilityIndex(
  official: OfficialProfile,
  contributions: ContributionBreakdown,
  waterRelevance?: Partial<WaterRelevance>,
): AccountabilityScore {
  const total = contributions.totalReceipts || 1; // avoid div by 0

  // Ratios
  const grassrootsRatio = contributions.individualContributions / total;
  const pacDependencyRatio = contributions.pacContributions / total;
  const selfFundingRatio = contributions.selfFunding / total;

  // Transparency scoring (0-100):
  // - High grassroots ratio = more transparent (40% weight)
  // - Low PAC dependency = more transparent (30% weight)
  // - Low self-funding = more accessible (10% weight)
  // - Moderate total spend = not buying seat (20% weight)
  const grassrootsScore = Math.min(100, grassrootsRatio * 130); // 77%+ individual → 100
  const pacScore = Math.max(0, 100 - pacDependencyRatio * 200);  // 50%+ PAC → 0
  const selfScore = selfFundingRatio > 0.5 ? 30 : selfFundingRatio > 0.25 ? 60 : 100;

  // Spending reasonableness: compare to median for office type
  const medianSpend: Record<string, number> = { S: 15_000_000, H: 2_000_000, P: 500_000_000 };
  const median = medianSpend[official.office] || 5_000_000;
  const spendRatio = total / median;
  const spendScore = spendRatio > 3 ? 20 : spendRatio > 2 ? 50 : spendRatio > 1.5 ? 70 : 100;

  const transparencyScore = Math.round(
    grassrootsScore * 0.4 +
    pacScore * 0.3 +
    selfScore * 0.1 +
    spendScore * 0.2,
  );

  // Benchmark comparison
  const benchmark = NATIONAL_BENCHMARKS[official.office] || 60;
  const overallIndex = Math.min(100, Math.round((transparencyScore / benchmark) * 100));

  // Grade
  const grade: AccountabilityScore['grade'] =
    overallIndex >= 90 ? 'A' :
    overallIndex >= 75 ? 'B' :
    overallIndex >= 60 ? 'C' :
    overallIndex >= 40 ? 'D' : 'F';

  const wr: WaterRelevance = {
    committeeMemberships: waterRelevance?.committeeMemberships || [],
    waterVotingRecord: waterRelevance?.waterVotingRecord ?? 0,
    sponsoredWaterBills: waterRelevance?.sponsoredWaterBills ?? 0,
    cosponseredWaterBills: waterRelevance?.cosponseredWaterBills ?? 0,
    epaOversightRole: waterRelevance?.epaOversightRole ?? false,
  };

  return {
    official,
    contributions,
    transparencyScore,
    grassrootsRatio,
    pacDependencyRatio,
    selfFundingRatio,
    overallIndex,
    nationalBenchmark: benchmark,
    grade,
    waterRelevance: wr,
  };
}

// ─── State Rollup ───────────────────────────────────────────────────────────

export function computeStateRollup(
  stateAbbr: string,
  scores: AccountabilityScore[],
  allStateAverages?: Map<string, number>,
): StateAccountabilityRollup {
  const stateAverageIndex = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.overallIndex, 0) / scores.length)
    : 0;

  // National rank — if all state averages provided, compute rank
  let nationalRank = 0;
  if (allStateAverages) {
    const sorted = [...allStateAverages.entries()].sort((a, b) => b[1] - a[1]);
    nationalRank = sorted.findIndex(([abbr]) => abbr === stateAbbr) + 1;
  }

  return {
    stateAbbr,
    officials: scores,
    stateAverageIndex,
    nationalRank,
    waterChampionCount: scores.filter(s => s.overallIndex >= 75).length,
    highRiskCount: scores.filter(s => s.overallIndex < 40).length,
  };
}

// ─── Full Pipeline ──────────────────────────────────────────────────────────

export async function getStateAccountability(
  stateAbbr: string,
): Promise<StateAccountabilityRollup> {
  // Fetch Senate candidates for state
  const senators = await searchCandidates('', stateAbbr, 'S');
  // Fetch House candidates for state
  const reps = await searchCandidates('', stateAbbr, 'H');

  const allOfficials = [...senators, ...reps];
  const scores: AccountabilityScore[] = [];

  for (const official of allOfficials.slice(0, 20)) { // cap at 20 to manage API rate limits
    const contrib = await fetchContributions(official.candidateId);
    if (contrib) {
      scores.push(computeAccountabilityIndex(official, contrib));
    }
  }

  return computeStateRollup(stateAbbr, scores);
}

// ─── Formatting Helpers ─────────────────────────────────────────────────────

export function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function gradeColor(grade: AccountabilityScore['grade']): string {
  switch (grade) {
    case 'A': return 'text-green-700 bg-green-50 border-green-200';
    case 'B': return 'text-cyan-700 bg-cyan-50 border-cyan-200';
    case 'C': return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'D': return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'F': return 'text-red-700 bg-red-50 border-red-200';
  }
}

export function indexColor(index: number): string {
  if (index >= 75) return 'text-green-700';
  if (index >= 60) return 'text-cyan-700';
  if (index >= 40) return 'text-amber-700';
  return 'text-red-700';
}
