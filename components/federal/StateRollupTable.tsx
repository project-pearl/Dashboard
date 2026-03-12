'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrandedPrintBtn } from '@/lib/brandedPrint';
import { getEJScore, getEJData } from '@/lib/ejVulnerability';

export interface StateRollupRow {
  abbr: string;
  name: string;
  grade: { letter: string; bg: string; color: string };
  canGradeState: boolean;
  score: number;
  assessed: number;
  monitored: number;
  unmonitored: number;
  high: number;
  medium: number;
  waterbodies: number;
  cat5: number;
  cat4a: number;
  totalImpaired: number;
  dataSource?: string;
}

export interface StateRollupTableProps {
  stateRollup: StateRollupRow[];
  watershedFilter: string;
  setWatershedFilter: (v: string) => void;
  filteredRegionData: { length: number };
  regionData: { length: number };
  showStateTable: boolean;
  setShowStateTable: (v: boolean) => void;
  collapseStateTable: boolean;
  timeRange: string;
  nationalStats: { totalWaterbodies: number };
  hotspots: unknown;
  selectedState: string;
  setSelectedState: (v: string) => void;
  setWaterbodyFilter: (v: 'all') => void;
  mapSectionRef: React.RefObject<HTMLDivElement | null>;
  setToastMsg: (msg: string | null) => void;
}

export default function StateRollupTable({
  stateRollup,
  watershedFilter,
  setWatershedFilter,
  filteredRegionData,
  regionData,
  showStateTable,
  setShowStateTable,
  collapseStateTable,
  timeRange,
  nationalStats,
  hotspots,
  selectedState,
  setSelectedState,
  setWaterbodyFilter,
  mapSectionRef,
  setToastMsg,
}: StateRollupTableProps) {
  return (
    <>
      {/* Feature 2: State Rollup Table -- collapsible when lens says so */}
      <>
        {collapseStateTable && (
          <button
            onClick={() => setShowStateTable(!showStateTable)}
            className="w-full py-2.5 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between transition-colors"
          >
            <span className="text-sm font-medium text-slate-700">State-by-State Coverage & Grading Detail</span>
            <span className="text-xs text-slate-400">{showStateTable ? '▲ Collapse' : '▼ Expand full table'}</span>
          </button>
        )}
        {(!collapseStateTable || showStateTable) && (
          <Card id="section-statebystatesummary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>State-by-State Summary</CardTitle>
                <BrandedPrintBtn sectionId="statebystatesummary" title="State-by-State Summary" />
              </div>
              <CardDescription>Click any state to view its waterbodies on the map above</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Watershed filter + export controls */}
              <div className="flex flex-wrap items-center gap-3 p-3 mb-3 rounded-lg border border-blue-200 bg-blue-50">
                <span className="text-xs font-semibold text-slate-600">Watershed:</span>
                <select
                  value={watershedFilter}
                  onChange={(e) => setWatershedFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs bg-white"
                >
                  <option value="all">All Watersheds</option>
                  <option value="chesapeake">Chesapeake Bay</option>
                  <option value="gulf">Gulf of Mexico</option>
                  <option value="great_lakes">Great Lakes</option>
                  <option value="south_atlantic">South Atlantic</option>
                  <option value="pacific">Pacific Coast</option>
                </select>
                {watershedFilter !== 'all' && (
                  <Button size="sm" variant="outline" onClick={() => setWatershedFilter('all')} className="h-7 text-xs">
                    Clear
                  </Button>
                )}
                {watershedFilter !== 'all' && (
                  <span className="text-xs text-blue-700 font-medium">
                    Showing {filteredRegionData.length} of {regionData.length} waterbodies
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const reportData = {
                        title: 'National Water Quality Report',
                        timeRange,
                        stats: nationalStats,
                        stateRollup,
                        hotspots,
                        filters: { watershedFilter },
                        generated: new Date().toISOString()
                      };
                      console.log('PDF Report Data:', reportData);
                      setToastMsg('PDF report generation coming in the next release. CSV export is available now.');
                      setTimeout(() => setToastMsg(null), 4000);
                    }}
                    className="h-7 text-xs"
                  >
                    📄 PDF Report
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const csv = [
                        ['State', 'Grade', 'Score', 'Assessed', 'Monitored', 'Unmonitored', 'Severe', 'Impaired', 'Total Waterbodies'],
                        ...stateRollup.map(r => [r.name, r.grade.letter, r.canGradeState ? r.score : 'N/A', r.assessed, r.monitored, r.unmonitored, r.high, r.medium, r.waterbodies])
                      ].map(row => row.join(',')).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `pin-national-summary-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                    }}
                    className="h-7 text-xs"
                  >
                    📊 Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const ejSummary = stateRollup.map(s => {
                        const ejScore = getEJScore(s.abbr);
                        const ejData = getEJData(s.abbr);
                        return `${s.name}: EJ Score ${ejScore}${ejData ? `, Poverty ${ejData.povertyPct}%, Minority ${ejData.minorityPct}%, DW Violations ${ejData.drinkingWaterViol}/100k` : ''}`;
                      }).join('\n');
                      const blob = new Blob([`Environmental Justice Impact Report\nGenerated: ${new Date().toISOString()}\n\n${ejSummary}`], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `ej-impact-report-${new Date().toISOString().split('T')[0]}.txt`; a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="h-7 text-xs"
                  >
                    🎯 EJ Report
                  </Button>
                </div>
              </div>
              {/* Grading methodology */}
              <div className="mb-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Grading Scale: </span>
                Grades are based on the average condition of monitored priority waterbodies in each state.
                Each waterbody is scored by its current alert level (Healthy = 100, Watch = 85, Impaired = 65, Severe = 40)
                and averaged across all monitored sites. States with more severe impairments will score lower.
                <span className="text-slate-500 ml-1">A+ (97+) · A (93) · A- (90) · B+ (87) · B (83) · B- (80) · C+ (77) · C (73) · C- (70) · D+ (67) · D (63) · D- (60) · F (&lt;60)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <thead className="table w-full table-fixed">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">State</th>
                      <th className="text-center py-2 px-3 font-semibold text-slate-700">Grade</th>
                      <th className="text-center py-2 px-3 font-semibold text-green-700">Assessed</th>
                      <th className="text-center py-2 px-3 font-semibold text-red-700">Cat 5</th>
                      <th className="text-center py-2 px-3 font-semibold text-amber-700">Has TMDL</th>
                      <th className="text-center py-2 px-3 font-semibold text-orange-700">Impaired</th>
                      <th className="text-center py-2 px-3 font-semibold text-slate-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="block max-h-[126px] overflow-y-auto">
                    {stateRollup.map(row => (
                      <tr
                        key={row.abbr}
                        className={`table w-full table-fixed border-b border-slate-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                          selectedState === row.abbr ? 'bg-blue-100' : ''
                        }`}
                        onClick={() => {
                          setSelectedState(row.abbr);
                          setWaterbodyFilter('all');
                          mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                      >
                        <td className="py-2 px-3 font-medium text-slate-700">{row.name}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-bold ${row.grade.bg} ${row.grade.color}`}>
                            {row.grade.letter}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-green-700 font-medium">
                          {row.assessed || '—'}
                          {row.dataSource === 'attains' && <span className="text-2xs text-blue-500 ml-0.5">EPA</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.cat5 > 0 && <span className="pin-label inline-flex items-center rounded-full px-2 py-0.5 bg-pin-status-severe-bg text-pin-status-severe">{row.cat5}</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.cat4a > 0 && <span className="pin-label inline-flex items-center rounded-full px-2 py-0.5 bg-pin-status-watch-bg text-pin-status-watch">{row.cat4a}</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.totalImpaired > 0 && <span className="pin-label inline-flex items-center rounded-full px-2 py-0.5 bg-pin-status-impaired-bg text-pin-status-impaired">{row.totalImpaired}</span>}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600">{row.waterbodies}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </>
    </>
  );
}
