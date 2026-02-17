'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, TrendingUp, Users, Target, Building2, ArrowUp, ChevronRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface PeerBenchmarkingProps {
  removalEfficiencies: Record<string, number> | null | undefined;
  regionId: string | null;
  userRole?: string;
}

type ParamField = 'tss' | 'tn' | 'tp' | 'turbidity';

interface StateBenchmark {
  label: string;
  tss: number;
  tn: number;
  tp: number;
  turbidity: number;
  ms4Count: number;
  bmps: number;
  region: string; // peer group key
}

// ─── Regional peer groups ──────────────────────────────────────────────────
const PEER_REGIONS: Record<string, { name: string; description: string }> = {
  chesapeake:   { name: 'Chesapeake Bay Watershed',   description: 'States sharing Chesapeake Bay TMDL obligations' },
  gulf:         { name: 'Gulf of Mexico Watershed',   description: 'States draining to the Gulf with nutrient/hypoxia concerns' },
  great_lakes:  { name: 'Great Lakes Basin',          description: 'States bordering the Great Lakes with shared water quality goals' },
  northeast:    { name: 'Northeast Coastal',          description: 'Northeast states with coastal stormwater and combined sewer challenges' },
  southeast:    { name: 'Southeast Coastal',          description: 'Southeast states with coastal development and nutrient loading issues' },
  midwest:      { name: 'Upper Midwest',              description: 'Agricultural states with nutrient runoff and TMDL requirements' },
  pacific:      { name: 'Pacific Coast',              description: 'West coast states with stormwater and TMDLs for impaired waters' },
  mountain:     { name: 'Mountain West',              description: 'Western states with mining, agriculture, and sediment challenges' },
  south_central:{ name: 'South Central',              description: 'Southern states with industrial and agricultural water quality pressures' },
};

// ─── State benchmark data (all 50 + DC) ────────────────────────────────────
// Values represent aggregate MS4 BMP removal efficiency statewide
const STATE_BENCHMARKS: Record<string, StateBenchmark> = {
  // Chesapeake Bay Watershed
  MD: { label: 'Maryland',       tss: 82.5, tn: 74.8, tp: 78.2, turbidity: 85.1, ms4Count: 24, bmps: 312, region: 'chesapeake' },
  VA: { label: 'Virginia',       tss: 80.1, tn: 72.3, tp: 76.5, turbidity: 83.7, ms4Count: 31, bmps: 285, region: 'chesapeake' },
  PA: { label: 'Pennsylvania',   tss: 79.4, tn: 71.0, tp: 74.8, turbidity: 82.3, ms4Count: 42, bmps: 410, region: 'chesapeake' },
  DE: { label: 'Delaware',       tss: 81.2, tn: 73.5, tp: 77.1, turbidity: 84.5, ms4Count: 8,  bmps: 64,  region: 'chesapeake' },
  NY: { label: 'New York',       tss: 78.8, tn: 70.2, tp: 73.9, turbidity: 81.6, ms4Count: 56, bmps: 520, region: 'chesapeake' },
  WV: { label: 'West Virginia',  tss: 76.3, tn: 68.5, tp: 71.2, turbidity: 79.8, ms4Count: 6,  bmps: 38,  region: 'chesapeake' },
  DC: { label: 'Washington DC',  tss: 84.1, tn: 76.2, tp: 80.5, turbidity: 87.3, ms4Count: 1,  bmps: 45,  region: 'chesapeake' },

  // Gulf of Mexico
  FL: { label: 'Florida',        tss: 80.8, tn: 73.1, tp: 77.5, turbidity: 84.2, ms4Count: 38, bmps: 425, region: 'gulf' },
  TX: { label: 'Texas',          tss: 77.5, tn: 69.8, tp: 73.2, turbidity: 80.5, ms4Count: 52, bmps: 580, region: 'gulf' },
  LA: { label: 'Louisiana',      tss: 74.2, tn: 66.5, tp: 70.1, turbidity: 77.8, ms4Count: 15, bmps: 120, region: 'gulf' },
  MS: { label: 'Mississippi',    tss: 73.5, tn: 65.8, tp: 69.2, turbidity: 76.5, ms4Count: 10, bmps: 72,  region: 'gulf' },
  AL: { label: 'Alabama',        tss: 75.8, tn: 68.2, tp: 71.5, turbidity: 78.9, ms4Count: 12, bmps: 95,  region: 'gulf' },

  // Great Lakes
  MI: { label: 'Michigan',       tss: 79.2, tn: 71.5, tp: 75.2, turbidity: 82.8, ms4Count: 28, bmps: 265, region: 'great_lakes' },
  OH: { label: 'Ohio',           tss: 78.5, tn: 70.8, tp: 74.5, turbidity: 81.5, ms4Count: 35, bmps: 310, region: 'great_lakes' },
  WI: { label: 'Wisconsin',      tss: 80.1, tn: 72.8, tp: 76.2, turbidity: 83.5, ms4Count: 18, bmps: 185, region: 'great_lakes' },
  IN: { label: 'Indiana',        tss: 77.2, tn: 69.5, tp: 73.1, turbidity: 80.2, ms4Count: 22, bmps: 195, region: 'great_lakes' },
  IL: { label: 'Illinois',       tss: 78.8, tn: 71.2, tp: 74.8, turbidity: 82.1, ms4Count: 30, bmps: 280, region: 'great_lakes' },
  MN: { label: 'Minnesota',      tss: 81.5, tn: 73.8, tp: 77.5, turbidity: 84.2, ms4Count: 20, bmps: 210, region: 'great_lakes' },

  // Northeast Coastal
  MA: { label: 'Massachusetts',  tss: 82.1, tn: 74.5, tp: 78.8, turbidity: 85.5, ms4Count: 22, bmps: 245, region: 'northeast' },
  CT: { label: 'Connecticut',    tss: 81.5, tn: 73.8, tp: 77.5, turbidity: 84.8, ms4Count: 14, bmps: 160, region: 'northeast' },
  NJ: { label: 'New Jersey',     tss: 79.8, tn: 72.1, tp: 76.2, turbidity: 83.2, ms4Count: 25, bmps: 275, region: 'northeast' },
  RI: { label: 'Rhode Island',   tss: 80.5, tn: 73.0, tp: 76.8, turbidity: 83.8, ms4Count: 6,  bmps: 55,  region: 'northeast' },
  NH: { label: 'New Hampshire',  tss: 81.8, tn: 74.2, tp: 77.9, turbidity: 85.1, ms4Count: 8,  bmps: 72,  region: 'northeast' },
  ME: { label: 'Maine',          tss: 80.2, tn: 72.5, tp: 76.0, turbidity: 83.5, ms4Count: 5,  bmps: 42,  region: 'northeast' },
  VT: { label: 'Vermont',        tss: 79.5, tn: 71.8, tp: 75.5, turbidity: 82.8, ms4Count: 4,  bmps: 35,  region: 'northeast' },

  // Southeast Coastal
  NC: { label: 'North Carolina', tss: 79.5, tn: 71.8, tp: 75.5, turbidity: 82.8, ms4Count: 28, bmps: 295, region: 'southeast' },
  SC: { label: 'South Carolina', tss: 78.2, tn: 70.5, tp: 74.2, turbidity: 81.5, ms4Count: 16, bmps: 145, region: 'southeast' },
  GA: { label: 'Georgia',        tss: 77.8, tn: 70.1, tp: 73.8, turbidity: 81.0, ms4Count: 20, bmps: 180, region: 'southeast' },
  TN: { label: 'Tennessee',      tss: 76.5, tn: 68.8, tp: 72.5, turbidity: 79.8, ms4Count: 14, bmps: 115, region: 'southeast' },
  KY: { label: 'Kentucky',       tss: 75.8, tn: 68.2, tp: 71.8, turbidity: 79.2, ms4Count: 10, bmps: 85,  region: 'southeast' },

  // Upper Midwest / Agricultural
  IA: { label: 'Iowa',           tss: 76.8, tn: 69.2, tp: 72.8, turbidity: 80.1, ms4Count: 12, bmps: 105, region: 'midwest' },
  MO: { label: 'Missouri',       tss: 77.5, tn: 69.8, tp: 73.5, turbidity: 80.8, ms4Count: 18, bmps: 155, region: 'midwest' },
  KS: { label: 'Kansas',         tss: 76.2, tn: 68.5, tp: 72.2, turbidity: 79.5, ms4Count: 10, bmps: 82,  region: 'midwest' },
  NE: { label: 'Nebraska',       tss: 75.5, tn: 67.8, tp: 71.5, turbidity: 78.8, ms4Count: 8,  bmps: 60,  region: 'midwest' },
  SD: { label: 'South Dakota',   tss: 74.8, tn: 67.2, tp: 70.8, turbidity: 78.1, ms4Count: 4,  bmps: 28,  region: 'midwest' },
  ND: { label: 'North Dakota',   tss: 74.2, tn: 66.5, tp: 70.2, turbidity: 77.5, ms4Count: 3,  bmps: 22,  region: 'midwest' },

  // Pacific Coast
  CA: { label: 'California',     tss: 81.8, tn: 74.2, tp: 78.5, turbidity: 85.2, ms4Count: 48, bmps: 620, region: 'pacific' },
  OR: { label: 'Oregon',         tss: 80.5, tn: 73.0, tp: 77.2, turbidity: 84.0, ms4Count: 12, bmps: 130, region: 'pacific' },
  WA: { label: 'Washington',     tss: 81.2, tn: 73.5, tp: 77.8, turbidity: 84.5, ms4Count: 16, bmps: 175, region: 'pacific' },
  HI: { label: 'Hawaii',         tss: 78.5, tn: 70.8, tp: 74.5, turbidity: 81.8, ms4Count: 4,  bmps: 35,  region: 'pacific' },
  AK: { label: 'Alaska',         tss: 72.5, tn: 65.0, tp: 68.5, turbidity: 76.2, ms4Count: 2,  bmps: 12,  region: 'pacific' },

  // Mountain West
  CO: { label: 'Colorado',       tss: 79.8, tn: 72.2, tp: 76.0, turbidity: 83.2, ms4Count: 14, bmps: 145, region: 'mountain' },
  UT: { label: 'Utah',           tss: 78.5, tn: 71.0, tp: 74.8, turbidity: 82.0, ms4Count: 8,  bmps: 72,  region: 'mountain' },
  NV: { label: 'Nevada',         tss: 77.2, tn: 69.5, tp: 73.2, turbidity: 80.5, ms4Count: 5,  bmps: 48,  region: 'mountain' },
  AZ: { label: 'Arizona',        tss: 78.0, tn: 70.5, tp: 74.2, turbidity: 81.5, ms4Count: 10, bmps: 95,  region: 'mountain' },
  NM: { label: 'New Mexico',     tss: 76.5, tn: 68.8, tp: 72.5, turbidity: 79.8, ms4Count: 6,  bmps: 42,  region: 'mountain' },
  ID: { label: 'Idaho',          tss: 77.8, tn: 70.2, tp: 73.8, turbidity: 81.2, ms4Count: 5,  bmps: 38,  region: 'mountain' },
  MT: { label: 'Montana',        tss: 76.2, tn: 68.5, tp: 72.0, turbidity: 79.5, ms4Count: 4,  bmps: 28,  region: 'mountain' },
  WY: { label: 'Wyoming',        tss: 75.5, tn: 67.8, tp: 71.2, turbidity: 78.8, ms4Count: 3,  bmps: 18,  region: 'mountain' },

  // South Central
  AR: { label: 'Arkansas',       tss: 75.2, tn: 67.5, tp: 71.0, turbidity: 78.5, ms4Count: 8,  bmps: 58,  region: 'south_central' },
  OK: { label: 'Oklahoma',       tss: 76.5, tn: 68.8, tp: 72.5, turbidity: 79.8, ms4Count: 10, bmps: 82,  region: 'south_central' },
};

function getStateFromRegion(regionId: string): string {
  const prefixMap: Record<string, string> = {
    maryland: 'MD', virginia: 'VA', pennsylvania: 'PA', delaware: 'DE',
    newyork: 'NY', westvirginia: 'WV', dc: 'DC', florida: 'FL',
    texas: 'TX', louisiana: 'LA', mississippi: 'MS', alabama: 'AL',
    michigan: 'MI', ohio: 'OH', wisconsin: 'WI', indiana: 'IN',
    illinois: 'IL', minnesota: 'MN', california: 'CA', oregon: 'OR',
    washington: 'WA', colorado: 'CO', georgia: 'GA', northcarolina: 'NC',
    southcarolina: 'SC', tennessee: 'TN', massachusetts: 'MA',
    connecticut: 'CT', newjersey: 'NJ', newhampshire: 'NH', maine: 'ME',
    iowa: 'IA', missouri: 'MO', kansas: 'KS', nebraska: 'NE',
    arizona: 'AZ', utah: 'UT', nevada: 'NV', newmexico: 'NM',
    kentucky: 'KY', rhodeisland: 'RI', vermont: 'VT', hawaii: 'HI',
    alaska: 'AK', idaho: 'ID', montana: 'MT', wyoming: 'WY',
    northdakota: 'ND', southdakota: 'SD', arkansas: 'AR', oklahoma: 'OK',
  };
  for (const [prefix, abbr] of Object.entries(prefixMap)) {
    if (regionId.startsWith(prefix)) return abbr;
  }
  return 'MD';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export function PeerBenchmarking({ removalEfficiencies, regionId, userRole }: PeerBenchmarkingProps) {
  const safe = removalEfficiencies || { TSS: 0, TN: 0, TP: 0, DO: 0, turbidity: 0, salinity: 0 };
  const safeRegion = regionId || '';
  if (userRole === 'State') {
    return <StatePeerBenchmarking removalEfficiencies={safe} regionId={safeRegion} />;
  }
  return <MunicipalPeerBenchmarking removalEfficiencies={safe} regionId={safeRegion} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE-VS-STATE BENCHMARKING (with gap-to-#1 roadmap)
// ═══════════════════════════════════════════════════════════════════════════════
function StatePeerBenchmarking({ removalEfficiencies, regionId }: { removalEfficiencies: Record<string, number>; regionId: string }) {
  const stateAbbr = getStateFromRegion(regionId);
  const myState = STATE_BENCHMARKS[stateAbbr] || STATE_BENCHMARKS.MD;

  // Get all states in same region as peers
  const regionKey = myState.region;
  const regionInfo = PEER_REGIONS[regionKey] || PEER_REGIONS.chesapeake;
  const peers = Object.entries(STATE_BENCHMARKS)
    .filter(([abbr, s]) => s.region === regionKey && abbr !== stateAbbr)
    .map(([abbr, s]) => ({ abbr, ...s }));

  const allStates = [{ abbr: stateAbbr, ...myState }, ...peers];

  const params: { key: string; label: string; field: ParamField; unit: string }[] = [
    { key: 'TSS', label: 'Total Suspended Solids', field: 'tss', unit: '% removal' },
    { key: 'TN',  label: 'Total Nitrogen',         field: 'tn',  unit: '% removal' },
    { key: 'TP',  label: 'Total Phosphorus',        field: 'tp',  unit: '% removal' },
    { key: 'turbidity', label: 'Turbidity',         field: 'turbidity', unit: '% removal' },
  ];

  // Rank + gap analysis per parameter
  const rankings = params.map(p => {
    const sorted = [...allStates].sort((a, b) => b[p.field] - a[p.field]);
    const rank = sorted.findIndex(s => s.abbr === stateAbbr) + 1;
    const leader = sorted[0];
    const peerAvg = peers.reduce((sum, s) => sum + s[p.field], 0) / (peers.length || 1);
    const gapTo1 = leader[p.field] - myState[p.field];
    const isLeader = rank === 1;
    return { ...p, rank, total: allStates.length, stateVal: myState[p.field], peerAvg, sorted, leader, gapTo1, isLeader };
  });

  const avgRank = rankings.reduce((sum, r) => sum + r.rank, 0) / rankings.length;
  const leadCount = rankings.filter(r => r.isLeader).length;

  const overallLabel = leadCount === 4 ? '🏆 #1 Across All Metrics' :
    avgRank <= 1.5 ? 'Regional Leader' :
    avgRank <= 2.5 ? 'Above Average' :
    avgRank <= 3.5 ? 'Mid-Pack' : 'Needs Improvement';
  const overallColor = leadCount === 4 ? 'text-green-600' :
    avgRank <= 1.5 ? 'text-green-600' :
    avgRank <= 2.5 ? 'text-blue-600' :
    avgRank <= 3.5 ? 'text-amber-600' : 'text-red-600';

  const totalNeedImprovement = rankings.filter(r => !r.isLeader).length;

  return (
    <Card className="w-full border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-indigo-900">
          <Building2 className="h-6 w-6" />
          State Peer Benchmarking — {myState.label}
        </CardTitle>
        <CardDescription>
          {regionInfo.name} · {regionInfo.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ── Overall Ranking Card ──────────────────────────────────── */}
        <div className="bg-white p-4 rounded-lg border-2 border-indigo-300">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-600" />
              <span className="font-semibold text-slate-900">Regional Standing</span>
            </div>
            <div className={`text-xl font-bold ${overallColor}`}>
              {overallLabel}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>Avg rank <span className="font-bold text-indigo-700">#{Math.round(avgRank)}</span> of {allStates.length} states</span>
            <span className="text-slate-300">|</span>
            <span>{myState.ms4Count} MS4 permittees · {myState.bmps} active BMPs</span>
            {leadCount > 0 && (
              <>
                <span className="text-slate-300">|</span>
                <span className="text-green-600 font-semibold">🏆 #1 in {leadCount} metric{leadCount > 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>

        {/* ── Per-Parameter Rankings ────────────────────────────────── */}
        <div className="space-y-3">
          {rankings.map(r => (
            <div key={r.key} className="bg-white p-4 rounded-lg border">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <span className="font-semibold text-slate-900 text-sm">{r.label}</span>
                  {r.isLeader && <span className="ml-2 text-xs text-green-600 font-bold">🏆 #1</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    r.rank === 1 ? 'bg-green-100 text-green-700' :
                    r.rank === 2 ? 'bg-blue-100 text-blue-700' :
                    r.rank <= Math.ceil(r.total / 2) ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    #{r.rank} of {r.total}
                  </span>
                  <span className="text-lg font-bold text-indigo-600">{r.stateVal.toFixed(1)}%</span>
                </div>
              </div>

              {/* State comparison bars */}
              <div className="space-y-1">
                {r.sorted.map(s => {
                  const isMe = s.abbr === stateAbbr;
                  const isTop = s.abbr === r.leader.abbr;
                  const maxVal = r.sorted[0][r.field];
                  return (
                    <div key={s.abbr} className={`flex items-center gap-2 ${isMe ? 'py-0.5' : ''}`}>
                      <span className={`text-xs w-7 text-right font-mono ${
                        isMe ? 'font-bold text-indigo-700' : isTop ? 'font-semibold text-green-700' : 'text-slate-500'
                      }`}>
                        {s.abbr}
                      </span>
                      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isMe ? 'bg-indigo-500' : isTop ? 'bg-green-400' : 'bg-slate-300'
                          }`}
                          style={{ width: `${(s[r.field] / maxVal) * 100}%` }}
                        />
                        {isMe && (
                          <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-white">
                            {s[r.field].toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <span className={`text-xs w-14 text-right ${
                        isMe ? 'font-bold text-indigo-700' : 'text-slate-500'
                      }`}>
                        {s[r.field].toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Gap to #1 roadmap */}
              {!r.isLeader && (
                <div className="mt-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border border-indigo-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800 mb-1.5">
                    <ArrowUp className="h-3.5 w-3.5" />
                    Path to #1 — close the {r.gapTo1.toFixed(1)}% gap
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                        <span>{myState.label}: {r.stateVal.toFixed(1)}%</span>
                        <span>{r.leader.label}: {r.leader[r.field].toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden relative">
                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(r.stateVal / r.leader[r.field]) * 100}%` }} />
                        <div className="absolute right-0 top-0 h-full w-0.5 bg-green-500" />
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <ChevronRight className="h-3 w-3 text-indigo-500 flex-shrink-0" />
                      <span>Improve {r.label.toLowerCase()} removal by <span className="font-bold text-indigo-700">{r.gapTo1.toFixed(1)}%</span> to match {r.leader.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ChevronRight className="h-3 w-3 text-indigo-500 flex-shrink-0" />
                      <span>
                        {r.key === 'TSS' && 'Focus: enhanced sediment BMPs, PEARL biofiltration, forebay maintenance'}
                        {r.key === 'TN' && 'Focus: bioretention upgrades, denitrification media, oyster biofiltration'}
                        {r.key === 'TP' && 'Focus: P-sorption media, iron-enhanced filtration, constructed wetlands'}
                        {r.key === 'turbidity' && 'Focus: filter media replacement, settling basin optimization, real-time monitoring'}
                      </span>
                    </div>
                    {r.gapTo1 <= 3 && (
                      <div className="flex items-center gap-1 text-green-700 font-medium">
                        <ChevronRight className="h-3 w-3 text-green-500 flex-shrink-0" />
                        <span>Within striking distance — PEARL deployment could close this gap</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {r.isLeader && (
                <div className="mt-3 bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-green-800">
                    <Award className="h-3.5 w-3.5" />
                    {myState.label} leads the {regionInfo.name} in {r.label.toLowerCase()} removal
                  </div>
                  <div className="text-[11px] text-green-700 mt-1">
                    {(r.stateVal - r.peerAvg).toFixed(1)}% above the regional average ({r.peerAvg.toFixed(1)}%) — maintain through continued BMP investment and monitoring
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Summary: what it takes to reach #1 overall ───────────── */}
        {totalNeedImprovement > 0 && (
          <div className="bg-white rounded-lg p-4 border-2 border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-slate-900">Roadmap to Regional Leader</span>
            </div>
            <div className="text-sm text-slate-700 mb-3">
              {myState.label} needs improvement in <span className="font-bold">{totalNeedImprovement} of 4</span> metrics to reach #1 across the board:
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {rankings.map(r => (
                <div key={r.key} className={`text-center p-2 rounded-lg border ${
                  r.isLeader ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-200'
                }`}>
                  <div className="text-xs text-slate-500 mb-0.5">{r.key}</div>
                  {r.isLeader ? (
                    <div className="text-sm font-bold text-green-600">✅ #1</div>
                  ) : (
                    <>
                      <div className="text-sm font-bold text-indigo-700">+{r.gapTo1.toFixed(1)}%</div>
                      <div className="text-[10px] text-slate-500">to match {r.leader.abbr}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Peer Group Info ──────────────────────────────────────── */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-900">{regionInfo.name} Peer Group</span>
          </div>
          <p className="text-xs text-slate-600">
            Comparing {myState.label} against {peers.map(p => p.label).join(', ')}.
            {' '}{regionInfo.description}.
            {' '}Metrics reflect aggregate MS4 permit compliance across
            {' '}{allStates.reduce((sum, s) => sum + s.ms4Count, 0)} total permittees
            and {allStates.reduce((sum, s) => sum + s.bmps, 0)} active BMPs.
            Updated quarterly from EPA NPDES database and state annual reports.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUNICIPALITY BENCHMARKING (MS4 role — unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function MunicipalPeerBenchmarking({ removalEfficiencies, regionId }: { removalEfficiencies: Record<string, number>; regionId: string }) {
  const isUrban = regionId.includes('maryland') || regionId.includes('dc');

  const benchmarkData = {
    TSS: {
      your: removalEfficiencies.TSS,
      regional: isUrban ? 78.3 : 82.5,
      national: 81.2,
      top25: 90.0,
      percentile: removalEfficiencies.TSS >= 90 ? 95 : removalEfficiencies.TSS >= 85 ? 75 : removalEfficiencies.TSS >= 80 ? 60 : 45
    },
    TN: {
      your: removalEfficiencies.TN,
      regional: isUrban ? 72.1 : 75.8,
      national: 74.5,
      top25: 85.0,
      percentile: removalEfficiencies.TN >= 85 ? 95 : removalEfficiencies.TN >= 80 ? 80 : removalEfficiencies.TN >= 75 ? 65 : 50
    },
    TP: {
      your: removalEfficiencies.TP,
      regional: isUrban ? 76.5 : 79.2,
      national: 78.0,
      top25: 88.0,
      percentile: removalEfficiencies.TP >= 88 ? 95 : removalEfficiencies.TP >= 83 ? 80 : removalEfficiencies.TP >= 78 ? 65 : 50
    },
    turbidity: {
      your: removalEfficiencies.turbidity,
      regional: isUrban ? 84.2 : 86.5,
      national: 85.5,
      top25: 92.0,
      percentile: removalEfficiencies.turbidity >= 92 ? 95 : removalEfficiencies.turbidity >= 88 ? 80 : removalEfficiencies.turbidity >= 85 ? 65 : 50
    }
  };

  const avgPercentile = Math.round((benchmarkData.TSS.percentile + benchmarkData.TN.percentile +
    benchmarkData.TP.percentile + benchmarkData.turbidity.percentile) / 4);

  const performanceCategory = avgPercentile >= 90 ? 'Top Performer' :
    avgPercentile >= 75 ? 'Above Average' :
    avgPercentile >= 50 ? 'Average' : 'Below Average';

  const categoryColor = avgPercentile >= 90 ? 'text-green-600' :
    avgPercentile >= 75 ? 'text-blue-600' :
    avgPercentile >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Award className="h-6 w-6" />
          Peer Benchmarking Analysis
        </CardTitle>
        <CardDescription>
          Compare your BMP performance against similar municipalities nationwide
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-white p-4 rounded-lg border-2 border-blue-300">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-slate-900">Overall Ranking</span>
            </div>
            <div className={`text-2xl font-bold ${categoryColor}`}>
              {performanceCategory}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">
              Your performance is in the top <span className="font-bold">{100 - avgPercentile}%</span> of {isUrban ? 'urban' : 'estuarine'} municipalities
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryColor} bg-opacity-10`}
              style={{ backgroundColor: avgPercentile >= 90 ? '#10b98120' : avgPercentile >= 75 ? '#3b82f620' : '#f59e0b20' }}>
              {avgPercentile}th percentile
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(benchmarkData).map(([param, data]) => (
            <div key={param} className="bg-white p-4 rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-slate-900 uppercase text-sm">{param} Removal</span>
                <span className="text-lg font-bold text-blue-600">{data.your.toFixed(1)}%</span>
              </div>

              <Progress value={(data.your / data.top25) * 100} className="h-3 mb-2" />

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-slate-600">Your Performance</div>
                  <div className="font-bold text-blue-600">{data.your.toFixed(1)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-600">Regional Avg</div>
                  <div className="font-semibold">{data.regional.toFixed(1)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-600">National Avg</div>
                  <div className="font-semibold">{data.national.toFixed(1)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-600">Top 25%</div>
                  <div className="font-bold text-green-600">{data.top25.toFixed(1)}%</div>
                </div>
              </div>

              {data.your >= data.top25 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                  <Award className="h-3 w-3" />
                  <span className="font-semibold">Top 25% performer!</span>
                </div>
              )}
              {data.your < data.regional && (
                <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                  <TrendingUp className="h-3 w-3" />
                  <span>Opportunity: {(data.regional - data.your).toFixed(1)}% below regional average</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-900">Comparison Group</span>
          </div>
          <p className="text-xs text-slate-600">
            Benchmarked against 237 MS4 permittees with {isUrban ? 'urban stormwater BMPs' : 'estuarine monitoring programs'}
            {' '}reporting to EPA. Data includes bioretention, permeable pavement, green infrastructure,
            and wet detention systems. Updated quarterly from EPA NPDES database and state MS4 reports.
          </p>
        </div>

        <p className="text-xs text-slate-500 pt-2 border-t">
          Rankings based on pollutant removal efficiency during storm events. Your performance metrics
          are calculated from real-time Pearl sensor data, providing more accurate assessment than
          traditional quarterly grab samples used by most municipalities.
        </p>
      </CardContent>
    </Card>
  );
}
