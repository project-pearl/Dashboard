'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandedPrintBtn } from '@/lib/brandedPrint';
import { ChevronDown, ExternalLink, TrendingUp } from 'lucide-react';

// ─── Grant outcome data (EPA-verified) ──────────────────────────────────────

interface GrantResult {
  metric: string;
  value: string;
  pct: string;
  target: string;
  progress: number;
}

interface GrantRecord {
  id: number;
  program: string;
  source: string;
  region: string;
  invested: number;
  investedLabel: string;
  timeframe: string;
  duration: string;
  pollutants: string[];
  results: GrantResult[];
  waterbodies: string;
  status: 'Fully Restored' | 'In Progress' | 'Partial Restoration' | 'Ongoing';
  insight: string;
  attainsLink: boolean;
}

const GRANT_DATA: GrantRecord[] = [
  {
    id: 1,
    program: 'Chesapeake Bay TMDL',
    source: 'EPA / Multi-State Partnership',
    region: 'Region 3 (MD, VA, PA, WV, DE, DC)',
    invested: 15_000_000_000,
    investedLabel: '$15B',
    timeframe: '2000–2024',
    duration: '24 years',
    pollutants: ['Nitrogen', 'Phosphorus', 'Sediment'],
    results: [
      { metric: 'Nitrogen reduction', value: '45.5M lbs/yr', pct: '15.3%', target: '25% by 2025', progress: 59 },
      { metric: 'Phosphorus reduction', value: '3.7M lbs/yr', pct: '21.8%', target: '24% by 2025', progress: 92 },
      { metric: 'Sediment reduction', value: '1.44B lbs/yr', pct: '7.6%', target: '20% by 2025', progress: 100 },
    ],
    waterbodies: '92 tidal segments across 64,000 sq mi watershed',
    status: 'In Progress',
    insight: 'Largest TMDL ever developed. Wastewater sector met 2025 goals a decade early. Nitrogen from agriculture remains the gap. PIN tracks all 92 segments in real time.',
    attainsLink: true,
  },
  {
    id: 2,
    program: 'Section 319 — Heron Lake Watershed',
    source: 'EPA CWA §319 + State Match',
    region: 'Minnesota',
    invested: 211_248,
    investedLabel: '$211K',
    timeframe: '1997–2010',
    duration: '13 years',
    pollutants: ['Phosphorus', 'TSS'],
    results: [
      { metric: 'TSS reduction (First Fulda Lake)', value: '72% decrease', pct: '72%', target: 'Meet WQ standard', progress: 100 },
      { metric: 'Phosphorus (First Fulda)', value: '45% decrease', pct: '45%', target: 'Below impairment', progress: 100 },
      { metric: 'Orthophosphorus (North Heron)', value: '94% reduction', pct: '94%', target: 'Below impairment', progress: 100 },
    ],
    waterbodies: '3 lakes delisted from 303(d)',
    status: 'Fully Restored',
    insight: 'Highest ROI 319 grant on record. $211K achieved 94% orthophosphorus reduction and full delisting. PIN would have flagged the trend reversal years earlier.',
    attainsLink: true,
  },
  {
    id: 3,
    program: 'Section 319 — Tyger River Bacteria',
    source: 'EPA CWA §319 + Local Partners',
    region: 'South Carolina',
    invested: 850_000,
    investedLabel: '~$850K',
    timeframe: '2002–2012',
    duration: '10 years',
    pollutants: ['Fecal Coliform'],
    results: [
      { metric: 'Segments meeting FC standard', value: '4 of 20 restored', pct: '20%', target: 'All 20 segments', progress: 20 },
      { metric: 'Septic systems repaired', value: '200+ systems', pct: '', target: 'Eliminate failing systems', progress: 60 },
      { metric: 'Agricultural BMPs installed', value: 'Multiple sites', pct: '', target: 'Watershed-wide coverage', progress: 55 },
    ],
    waterbodies: '20 impaired segments on Tyger River; 4 fully restored',
    status: 'Partial Restoration',
    insight: 'Community-led effort combining septic repairs, ag BMPs, and education. Bacteria impairments require multi-sector coordination — exactly the cross-source view PIN provides.',
    attainsLink: true,
  },
  {
    id: 4,
    program: 'CWSRF — National Portfolio',
    source: 'EPA Clean Water State Revolving Fund',
    region: 'Nationwide (51 programs)',
    invested: 172_000_000_000,
    investedLabel: '$172B',
    timeframe: '1988–2023',
    duration: '35 years',
    pollutants: ['Nutrients', 'Sediment', 'Bacteria', 'Infrastructure'],
    results: [
      { metric: 'Assistance agreements', value: '48,900+', pct: '', target: 'Ongoing', progress: 100 },
      { metric: 'Small community agreements', value: '33,300', pct: '', target: 'Populations <10K', progress: 100 },
      { metric: 'Federal dollar leverage', value: '$3 returned per $1', pct: '300%', target: 'Self-sustaining', progress: 100 },
      { metric: 'Rivers/streams restored', value: '12,300 miles', pct: '', target: 'Ongoing', progress: 75 },
    ],
    waterbodies: '12,300 miles of rivers + 230,000 acres of lakes improved',
    status: 'Ongoing',
    insight: 'Largest water infrastructure financing mechanism in the US. Every $1 of federal investment returns $3. PIN connects CWSRF-funded projects to their downstream water quality outcomes for the first time.',
    attainsLink: false,
  },
  {
    id: 5,
    program: 'Section 319 — Oneida Lake Phosphorus',
    source: 'EPA CWA §319 + NY State + USDA',
    region: 'New York',
    invested: 1_200_000,
    investedLabel: '~$1.2M',
    timeframe: '2000–2008',
    duration: '8 years',
    pollutants: ['Phosphorus'],
    results: [
      { metric: 'Phosphorus loading', value: 'Steady decline achieved', pct: '', target: 'Meet designated use', progress: 100 },
      { metric: '303(d) status', value: 'Proposed for delisting', pct: '', target: 'Full delisting', progress: 95 },
      { metric: 'Ag BMPs implemented', value: '80+ farms enrolled', pct: '', target: 'Watershed-wide AEM', progress: 80 },
    ],
    waterbodies: 'Oneida Lake (79 sq mi) — proposed delisting 2008',
    status: 'Fully Restored',
    insight: 'Voluntary agricultural enrollment of 80+ farms. Demonstrates nutrient reduction at scale without regulatory mandates — a model PIN recommends to similar watersheds.',
    attainsLink: true,
  },
];

const POLLUTANT_COLORS: Record<string, string> = {
  Nitrogen: 'bg-amber-100 text-amber-800 border-amber-200',
  Phosphorus: 'bg-green-100 text-green-800 border-green-200',
  Sediment: 'bg-orange-100 text-orange-800 border-orange-200',
  TSS: 'bg-orange-100 text-orange-800 border-orange-200',
  'Fecal Coliform': 'bg-red-100 text-red-800 border-red-200',
  Bacteria: 'bg-red-100 text-red-800 border-red-200',
  Nutrients: 'bg-blue-100 text-blue-800 border-blue-200',
  Infrastructure: 'bg-slate-100 text-slate-700 border-slate-200',
};

const STATUS_STYLES: Record<string, string> = {
  'Fully Restored': 'bg-green-600',
  'In Progress': 'bg-amber-600',
  'Partial Restoration': 'bg-orange-600',
  Ongoing: 'bg-blue-700',
};

// ─── Component ──────────────────────────────────────────────────────────────

interface GrantOutcomesCardProps {
  onRunAnalysis?: () => void;
}

export function GrantOutcomesCard({ onRunAnalysis }: GrantOutcomesCardProps) {
  const [expandedId, setExpandedId] = useState<number | null>(1);
  const [filter, setFilter] = useState<'all' | 'restored' | 'progress' | 'region3'>('all');

  const filtered = GRANT_DATA.filter(g => {
    if (filter === 'restored') return g.status === 'Fully Restored';
    if (filter === 'progress') return g.status !== 'Fully Restored';
    if (filter === 'region3') return g.region.includes('Region 3');
    return true;
  });

  const fullyRestored = GRANT_DATA.filter(g => g.status === 'Fully Restored').length;

  return (
    <Card id="section-grant-outcomes" className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Historical Grant Outcomes
            <span className="text-[10px] font-normal text-slate-400 ml-1">
              {GRANT_DATA.length} programs · $187B+ tracked
            </span>
          </CardTitle>
          <BrandedPrintBtn sectionId="grant-outcomes" title="Historical Grant Outcomes" />
        </div>
        <CardDescription>Federal water quality investments and their measurable EPA-verified results</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Programs Tracked', value: '5', sub: 'Featured results', color: 'text-emerald-600' },
            { label: 'Total Invested', value: '$187B+', sub: 'Federal + state + local', color: 'text-blue-600' },
            { label: 'Fully Restored', value: String(fullyRestored), sub: 'Waterbodies delisted', color: 'text-green-600' },
            { label: 'Rivers Improved', value: '12,300', sub: 'Miles documented', color: 'text-violet-600' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
              <div className={`text-xl font-bold ${k.color} mt-1`}>{k.value}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: 'all' as const, label: 'All Programs' },
            { key: 'restored' as const, label: 'Fully Restored' },
            { key: 'progress' as const, label: 'In Progress' },
            { key: 'region3' as const, label: 'Region 3' },
          ]).map(f => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              className={`text-xs h-7 ${filter === f.key ? '' : 'text-slate-600'}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Grant Cards */}
        <div className="space-y-3">
          {filtered.map(grant => {
            const expanded = expandedId === grant.id;
            return (
              <div key={grant.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow">
                <button
                  onClick={() => setExpandedId(expanded ? null : grant.id)}
                  className="w-full text-left p-4 focus:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-sm font-bold text-slate-800 truncate">{grant.program}</h4>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${STATUS_STYLES[grant.status] ?? 'bg-slate-500'}`}>
                          {grant.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-2">{grant.source} · {grant.region}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {grant.pollutants.map(p => (
                          <Badge key={p} variant="outline" className={`text-[10px] py-0 px-1.5 h-5 ${POLLUTANT_COLORS[p] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-green-700">{grant.investedLabel}</div>
                      <div className="text-[10px] text-slate-400">{grant.duration}</div>
                      <ChevronDown className={`h-4 w-4 mx-auto mt-1 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 px-4 pb-4">
                    <div className="pt-3 space-y-3">
                      {/* Measured Outcomes */}
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Measured Outcomes</div>
                        <div className="space-y-2.5">
                          {grant.results.map((r, i) => (
                            <div key={i}>
                              <div className="flex justify-between items-baseline mb-0.5">
                                <span className="text-xs font-medium text-slate-700">{r.metric}</span>
                                <span className="text-xs font-bold text-blue-800">{r.value}</span>
                              </div>
                              {r.progress > 0 && (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-700"
                                      style={{
                                        width: `${Math.min(r.progress, 100)}%`,
                                        backgroundColor: r.progress >= 90 ? '#16a34a' : r.progress >= 50 ? '#d97706' : '#dc2626',
                                      }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-400 shrink-0 w-8 text-right">{r.progress}%</span>
                                </div>
                              )}
                              {r.target && <div className="text-[10px] text-slate-400 mt-0.5">Target: {r.target}</div>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Waterbodies */}
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <div className="text-[10px] text-slate-500 mb-0.5">Waterbodies Affected</div>
                        <div className="text-xs font-medium text-slate-800">{grant.waterbodies}</div>
                      </div>

                      {/* PIN Intelligence callout */}
                      <div className="bg-blue-50 border-l-2 border-blue-400 rounded-lg p-2.5">
                        <div className="text-[10px] font-semibold text-blue-900 mb-0.5">PIN Intelligence</div>
                        <div className="text-xs text-blue-800 leading-relaxed">{grant.insight}</div>
                      </div>

                      {grant.attainsLink && (
                        <button className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" />
                          View these waterbodies in PIN
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-green-900 mb-1">PIN Connects Grants to Outcomes</div>
              <p className="text-xs text-green-800 leading-relaxed">
                PIN is the first platform to link federal grant investments directly to waterbody-level water quality outcomes using ATTAINS assessment data, WQP monitoring observations, and 303(d) listing history.
              </p>
              {onRunAnalysis && (
                <Button size="sm" className="mt-2 bg-green-700 hover:bg-green-800 text-xs" onClick={onRunAnalysis}>
                  View Grant Performance Dashboard
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sources */}
        <div className="text-[10px] text-slate-400 leading-relaxed">
          <p>Sources: EPA ATTAINS · EPA NPS Success Stories · Chesapeake Bay Program · CWSRF NIMS · EPA GRTS</p>
          <p className="mt-0.5">Outcome data reflects published EPA monitoring results and state 303(d) assessments.</p>
        </div>
      </CardContent>
    </Card>
  );
}
