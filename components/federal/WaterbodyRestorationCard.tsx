'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Info, ArrowRight } from 'lucide-react';
import { BrandedPrintBtn } from '@/lib/brandedPrint';

export interface AttainsAggregation {
  catCounts: Record<string, number>;
  totalAssessed: number;
  totalImpaired: number;
  cat5: number;
  cat4a: number;
  cat4b: number;
  cat4c: number;
  tmdlGapPct: number;
  topCauses: Array<{ cause: string; count: number }>;
  totalCauseInstances: number;
}

export interface WaterbodyRestorationCardProps {
  viewLens: string;
  showTopStrip: boolean;
  attainsAggregation: AttainsAggregation;
}

export default function WaterbodyRestorationCard({
  viewLens,
  showTopStrip,
  attainsAggregation,
}: WaterbodyRestorationCardProps) {
  return (
    <>
    {/* ── National Impairment Profile (overview renders this in usmap; other lenses get it here) ── */}
    {viewLens !== 'overview' && showTopStrip && attainsAggregation.totalAssessed > 0 && (
        <Card id="section-impairmentprofile">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-pin-text-primary">National Impairment Profile</CardTitle>
                <CardDescription className="text-xs mt-0.5 text-pin-text-dim">{attainsAggregation.totalAssessed.toLocaleString()} waterbodies from EPA ATTAINS</CardDescription>
              </div>
              <BrandedPrintBtn sectionId="impairmentprofile" title="Impairment Profile" />
            </div>
          </CardHeader>
          <CardContent className="px-5">
            <div className="space-y-6">

              {/* TMDL Gap Summary (top) */}
              <div>
                <div className="pin-section-label mb-2">TMDL Status</div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`pin-stat-hero text-2xl ${attainsAggregation.tmdlGapPct > 50 ? 'text-pin-status-severe' : ''}`}>
                        {attainsAggregation.tmdlGapPct}%
                      </span>
                      <span className="text-xs text-pin-text-secondary">of impaired lack approved TMDL</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden bg-pin-border-subtle">
                      <div className="h-full rounded-full" style={{
                        width: `${attainsAggregation.tmdlGapPct}%`,
                        background: attainsAggregation.tmdlGapPct > 50 ? 'var(--status-severe)' : 'var(--status-warning)',
                        opacity: 0.6,
                      }} />
                    </div>
                    <div className="flex justify-between mt-1 text-2xs text-pin-text-dim">
                      <span>Cat 5 (no TMDL): {attainsAggregation.cat5.toLocaleString()}</span>
                      <span>Cat 4a (has TMDL): {attainsAggregation.cat4a.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* EPA Category Distribution */}
              <div>
                <div className="pin-section-label mb-2">EPA Assessment Categories</div>
                <div className="space-y-1">
                  {[
                    { cat: '5', label: 'Cat 5 — No TMDL', count: attainsAggregation.cat5, color: 'var(--status-severe)', opacity: 0.5 },
                    { cat: '4A', label: 'Cat 4a — TMDL', count: attainsAggregation.cat4a, color: 'var(--status-warning)', opacity: 0.4 },
                    { cat: '4B', label: 'Cat 4b — Alt. Ctrl', count: attainsAggregation.cat4b, color: 'var(--status-warning)', opacity: 0.3 },
                    { cat: '4C', label: 'Cat 4c — Non-pollut.', count: attainsAggregation.cat4c, color: 'var(--text-dim)', opacity: 0.4 },
                    { cat: '3', label: 'Cat 3 — No Data', count: attainsAggregation.catCounts['3'], color: 'var(--text-dim)', opacity: 0.3 },
                    { cat: '2', label: 'Cat 2 — Concerns', count: attainsAggregation.catCounts['2'], color: 'var(--status-healthy)', opacity: 0.3 },
                    { cat: '1', label: 'Cat 1 — Good', count: attainsAggregation.catCounts['1'], color: 'var(--status-healthy)', opacity: 0.4 },
                  ].filter(r => r.count > 0).map(r => {
                    const pct = attainsAggregation.totalAssessed > 0 ? (r.count / attainsAggregation.totalAssessed) * 100 : 0;
                    return (
                      <div key={r.cat} className="flex items-center gap-2">
                        <div className="w-[110px] text-2xs truncate text-pin-text-dim">{r.label}</div>
                        <div className="flex-1 h-2 rounded-full overflow-hidden bg-pin-border-subtle">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, background: r.color, opacity: r.opacity }} />
                        </div>
                        <div className="text-2xs w-[48px] text-right pin-stat-secondary">{r.count.toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Impairment Causes */}
              <div>
                <div className="pin-section-label mb-2">Top Impairment Causes</div>
                <div className="space-y-1">
                  {attainsAggregation.topCauses.slice(0, 7).map((c, i) => {
                    const maxCount = attainsAggregation.topCauses[0]?.count || 1;
                    const pct = (c.count / maxCount) * 100;
                    return (
                      <div key={i} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => console.log('Filter by cause:', c.cause)}>
                        <div className="w-[110px] text-2xs truncate text-pin-text-dim" title={c.cause}>{c.cause}</div>
                        <div className="flex-1 h-2 rounded-full overflow-hidden bg-pin-border-subtle">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--text-dim)', opacity: 0.35 }} />
                        </div>
                        <div className="text-2xs w-[48px] text-right pin-stat-secondary">{c.count.toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Methodology + Export */}
              <div className="flex items-center justify-between pt-2 border-t border-pin-border-subtle">
                <a
                  href="https://www.epa.gov/waterdata/attains"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xs flex items-center gap-1 hover:underline text-pin-text-dim"
                >
                  <Info className="w-3 h-3" />
                  How is this calculated?
                </a>
                <button
                  onClick={() => {
                    const text = `National Impairment Summary\n${attainsAggregation.totalAssessed.toLocaleString()} waterbodies assessed\nTMDL Gap: ${attainsAggregation.tmdlGapPct}%\n\nTop Causes:\n${attainsAggregation.topCauses.slice(0, 7).map(c => `  ${c.cause}: ${c.count.toLocaleString()}`).join('\n')}`;
                    const blob = new Blob([text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'national-impairment-summary.txt'; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-2xs flex items-center gap-1 px-2 py-1 rounded transition-colors text-pin-text-dim bg-pin-bg-card border border-pin-border-subtle"
                >
                  <ArrowRight className="w-3 h-3" />
                  Download Summary
                </button>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

    </>
  );
}
