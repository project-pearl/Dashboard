'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { scoreToGrade } from '@/lib/scoringUtils';
import { STATE_ABBR_TO_NAME } from '@/lib/adminStateContext';

interface StateRollupItem {
  abbr: string;
  name: string;
  high: number;
  medium: number;
  low: number;
  none: number;
  total: number;
  waterbodies: number;
  assessed: number;
  monitored: number;
  unmonitored: number;
  canGradeState: boolean;
  score: number;
  grade: { letter: string; color: string; bg: string; textColor?: string };
  dataSource: 'per-waterbody' | 'attains' | 'none';
  flowScore?: number;
  flowSites?: number;
  cat5: number;
  cat4a: number;
  cat4b: number;
  cat4c: number;
  totalImpaired: number;
  topCauses: { cause: string; count: number }[];
}

interface ScorecardData {
  gradedStates: StateRollupItem[];
  nationalGrade: { letter: string; color: string; bg: string; textColor?: string };
  totalImpaired: number;
  totalAssessed: number;
  impairmentPct: number;
  coveragePct: number;
  bottom5: StateRollupItem[];
  top5: StateRollupItem[];
  allStatesAlpha: StateRollupItem[];
}

export interface ScorecardDashboardProps {
  sectionId: string;
  scorecardData: ScorecardData;
  scorecardRegionFilter: 'all' | number;
  setScorecardRegionFilter: (v: 'all' | number) => void;
  nationalStats: {
    statesCovered: number;
    totalWaterbodies: number;
    assessed: number;
    monitored: number;
    unmonitored: number;
  };
  slaMetrics: {
    total: number;
    withinSLA: number;
    overdueCount: number;
  };
  liveSentinelAlertCount: number;
  liveSentinelSevereCount: number;
  setSelectedState: (state: string) => void;
}

export default function ScorecardDashboard({
  sectionId,
  scorecardData,
  scorecardRegionFilter,
  setScorecardRegionFilter,
  nationalStats,
  slaMetrics,
  liveSentinelAlertCount,
  liveSentinelSevereCount,
  setSelectedState,
}: ScorecardDashboardProps) {
  switch (sectionId) {
    case 'scorecard-kpis':
      return (
        <>
          {/* ── SCORECARD: EPA Region Filter ── */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">EPA Region:</span>
            <select
              value={scorecardRegionFilter === 'all' ? 'all' : scorecardRegionFilter}
              onChange={(e) => setScorecardRegionFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-2.5 py-1 rounded text-xs font-medium bg-white text-slate-700 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All Regions</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(r => (
                <option key={r} value={r}>Region {r}</option>
              ))}
            </select>
            {scorecardRegionFilter !== 'all' && (
              <button onClick={() => setScorecardRegionFilter('all')} className="text-xs text-blue-600 hover:underline">Clear filter</button>
            )}
          </div>
          {/* ── SCORECARD: KPI Strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className={`rounded-xl border-2 p-4 text-center ${scorecardData.nationalGrade.bg}`}>
              <div className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">National Grade</div>
              <div className={`text-4xl font-black ${scorecardData.nationalGrade.color}`}>{scorecardData.nationalGrade.letter}</div>
              <div className="text-2xs text-slate-400 mt-1">{scorecardData.gradedStates.length} states graded</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">States Monitored</div>
              <div className="text-3xl font-bold text-slate-800">{nationalStats.statesCovered}</div>
              <div className="text-2xs text-slate-400 mt-1">{nationalStats.totalWaterbodies?.toLocaleString()} waterbodies</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">Total Violations</div>
              <div className={`text-3xl font-bold ${liveSentinelSevereCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{liveSentinelAlertCount.toLocaleString()}</div>
              <div className="text-2xs text-slate-400 mt-1">{liveSentinelSevereCount} severe</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">Impairment Rate</div>
              <div className={`text-3xl font-bold ${scorecardData.impairmentPct > 30 ? 'text-red-600' : scorecardData.impairmentPct > 15 ? 'text-amber-600' : 'text-green-600'}`}>{scorecardData.impairmentPct}%</div>
              <div className="text-2xs text-slate-400 mt-1">{scorecardData.totalImpaired?.toLocaleString()} impaired</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">Coverage Rate</div>
              <div className={`text-3xl font-bold ${scorecardData.coveragePct > 70 ? 'text-green-600' : scorecardData.coveragePct > 40 ? 'text-amber-600' : 'text-red-600'}`}>{scorecardData.coveragePct}%</div>
              <div className="text-2xs text-slate-400 mt-1">{nationalStats.assessed + nationalStats.monitored} with data</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">SLA Compliance</div>
              <div className={`text-3xl font-bold ${slaMetrics.overdueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{slaMetrics.total > 0 ? Math.round((slaMetrics.withinSLA / slaMetrics.total) * 100) : 100}%</div>
              <div className="text-2xs text-slate-400 mt-1">{slaMetrics.overdueCount} overdue</div>
            </div>
          </div>
        </>
      );

    case 'scorecard-grades':
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">State Grades</CardTitle>
            <CardDescription>Water quality grades for all {scorecardData.allStatesAlpha.length} states based on ATTAINS assessments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-13 gap-1.5">
              {scorecardData.allStatesAlpha.map(s => {
                const g = s.canGradeState ? scoreToGrade(s.score) : { letter: 'N/A', color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200', textColor: 'text-slate-400' };
                return (
                  <button
                    key={s.abbr}
                    onClick={() => { setSelectedState(s.abbr); }}
                    className={`rounded-lg border p-1.5 text-center transition-all hover:shadow-md hover:scale-105 ${g.bg}`}
                    title={`${STATE_ABBR_TO_NAME[s.abbr] || s.abbr}: ${g.letter} (${s.score >= 0 ? s.score : '?'})`}
                  >
                    <div className="text-2xs font-bold text-slate-600">{s.abbr}</div>
                    <div className={`text-sm font-black ${g.color}`}>{g.letter}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      );

    case 'scorecard-rankings':
      return (
        <>
          {/* ── Bottom 5 / Top 5 ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-red-700">Needs Attention</CardTitle>
                <CardDescription>5 lowest-scoring states</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {scorecardData.bottom5.map((s, i) => {
                    const g = scoreToGrade(s.score);
                    return (
                      <div key={s.abbr} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                          <span className="text-sm font-semibold text-slate-800">{STATE_ABBR_TO_NAME[s.abbr] || s.abbr}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{s.high} severe · {s.medium} moderate</span>
                          <span className={`text-sm font-black px-2 py-0.5 rounded ${g.bg} ${g.color}`}>{g.letter}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-green-700">Top Performers</CardTitle>
                <CardDescription>5 highest-scoring states</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {scorecardData.top5.map((s, i) => {
                    const g = scoreToGrade(s.score);
                    return (
                      <div key={s.abbr} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                          <span className="text-sm font-semibold text-slate-800">{STATE_ABBR_TO_NAME[s.abbr] || s.abbr}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{s.assessed} assessed · {s.monitored} monitored</span>
                          <span className={`text-sm font-black px-2 py-0.5 rounded ${g.bg} ${g.color}`}>{g.letter}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      );

    case 'scorecard-choropleth':
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              National Grade Choropleth
            </CardTitle>
            <CardDescription>Geographic distribution of state water quality grades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="text-sm font-medium text-slate-500">Choropleth Map</div>
                <div className="text-xs text-slate-400 mt-1">Connect to state grade data for interactive geographic view</div>
              </div>
            </div>
          </CardContent>
        </Card>
      );

    case 'scorecard-trends':
      return (
        <>
          {/* ── Scorecard data context snapshot ── */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 mb-3">
            <p className="text-xs font-semibold text-blue-800">What These Numbers Represent</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Current national inputs used to calculate scorecard grades (not a separate table and not 30-day trends).
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Active Alerts (Sentinel)', value: liveSentinelAlertCount, color: 'text-red-600', sub: `${liveSentinelSevereCount} severe alerts` },
              { label: 'ATTAINS Assessments', value: scorecardData.totalAssessed, color: 'text-blue-600', sub: 'waterbodies assessed' },
              { label: 'Monitoring Coverage', value: `${scorecardData.coveragePct}%`, color: 'text-emerald-600', sub: 'assessed + monitored / tracked' },
              { label: 'States With Grades', value: scorecardData.gradedStates.length, color: 'text-violet-600', sub: 'states with sufficient grading data' },
            ].map(t => (
              <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">{t.label}</div>
                <div className={`text-2xl font-bold ${t.color} mt-1`}>{typeof t.value === 'number' ? t.value.toLocaleString() : t.value}</div>
                <div className="text-2xs text-slate-500 mt-2">{t.sub}</div>
              </div>
            ))}
          </div>
        </>
      );
  }

  return null;
}
