'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useJurisdictionContext } from '@/lib/jurisdiction-context';

interface TrendPoint {
  timestamp: string;
  usAqi: number | null;
  pm25: number | null;
  ozone: number | null;
}

const EPA_THRESHOLDS = [
  { value: 50, label: 'Good', color: '#22c55e' },
  { value: 100, label: 'Moderate', color: '#eab308' },
  { value: 150, label: 'USG', color: '#f97316' },
  { value: 200, label: 'Unhealthy', color: '#ef4444' },
];

const CHART_W = 800;
const CHART_H = 200;
const PAD = { top: 15, right: 50, bottom: 30, left: 40 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
}

function buildPolyline(
  data: TrendPoint[],
  key: 'usAqi' | 'pm25' | 'ozone',
  maxY: number,
): string {
  const pts: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const v = data[i][key];
    if (v == null) continue;
    const x = PAD.left + (i / Math.max(data.length - 1, 1)) * PLOT_W;
    const y = PAD.top + PLOT_H - (v / maxY) * PLOT_H;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

export function AqiTrendChart({ selectedState }: { selectedState?: string }) {
  const { activeJurisdiction } = useJurisdictionContext();
  const effectiveState = (activeJurisdiction?.parent_state || selectedState || 'MD').toUpperCase();

  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: TrendPoint } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/air-quality/latest?state=${encodeURIComponent(effectiveState)}&trends=true`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!cancelled && Array.isArray(json?.trendHistory)) {
          setData(json.trendHistory);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [effectiveState]);

  const maxY = useMemo(() => {
    let max = 200;
    for (const pt of data) {
      if (pt.usAqi != null && pt.usAqi > max) max = pt.usAqi;
      if (pt.pm25 != null && pt.pm25 > max) max = pt.pm25;
      if (pt.ozone != null && pt.ozone > max) max = pt.ozone;
    }
    return Math.ceil(max / 50) * 50;
  }, [data]);

  // X-axis labels (show every ~4h worth of data points)
  const xLabels = useMemo(() => {
    if (data.length < 2) return [];
    const step = Math.max(1, Math.floor(data.length / 6));
    const labels: Array<{ x: number; label: string }> = [];
    for (let i = 0; i < data.length; i += step) {
      const x = PAD.left + (i / Math.max(data.length - 1, 1)) * PLOT_W;
      labels.push({ x, label: formatTime(data[i].timestamp) });
    }
    return labels;
  }, [data]);

  // Y-axis labels
  const yLabels = useMemo(() => {
    const labels: Array<{ y: number; label: string }> = [];
    for (let v = 0; v <= maxY; v += 50) {
      const y = PAD.top + PLOT_H - (v / maxY) * PLOT_H;
      labels.push({ y, label: String(v) });
    }
    return labels;
  }, [maxY]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (data.length < 2) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * CHART_W;
    const idx = Math.round(((mouseX - PAD.left) / PLOT_W) * (data.length - 1));
    if (idx < 0 || idx >= data.length) { setTooltip(null); return; }
    const x = PAD.left + (idx / Math.max(data.length - 1, 1)) * PLOT_W;
    const val = data[idx].usAqi ?? data[idx].pm25 ?? 100;
    const y = PAD.top + PLOT_H - ((val ?? 100) / maxY) * PLOT_H;
    setTooltip({ x, y, point: data[idx] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            AQI Trend Analysis — {effectiveState}
          </CardTitle>
          <button className="p-1 rounded-md border border-slate-200 bg-white/90 shadow-sm hover:bg-slate-50 transition-colors" title="Historical AQI trend analysis showing air quality patterns over time.">
            <HelpCircle className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <CardDescription className="text-xs">
          Multi-pollutant trend with EPA threshold reference lines. Hover for exact values.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && <div className="text-xs text-slate-500">Loading trend data...</div>}
        {!loading && data.length < 2 && (
          <div className="text-xs text-slate-500">Not enough trend data yet. Trends populate after 2+ cron cycles.</div>
        )}
        {!loading && data.length >= 2 && (
          <div className="relative">
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="w-full h-[140px] sm:h-[170px] md:h-[200px]"
              preserveAspectRatio="xMidYMid meet"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Grid lines */}
              {yLabels.map(yl => (
                <line key={yl.label} x1={PAD.left} y1={yl.y} x2={CHART_W - PAD.right} y2={yl.y}
                  stroke="#e2e8f0" strokeWidth="0.5" />
              ))}

              {/* EPA threshold dashed lines */}
              {EPA_THRESHOLDS.filter(t => t.value <= maxY).map(t => {
                const y = PAD.top + PLOT_H - (t.value / maxY) * PLOT_H;
                return (
                  <g key={t.value}>
                    <line x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y}
                      stroke={t.color} strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
                    <text x={CHART_W - PAD.right + 4} y={y + 3} fontSize="9" fill={t.color}>
                      {t.label}
                    </text>
                  </g>
                );
              })}

              {/* Data lines */}
              <polyline points={buildPolyline(data, 'usAqi', maxY)} fill="none"
                stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={buildPolyline(data, 'pm25', maxY)} fill="none"
                stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
              <polyline points={buildPolyline(data, 'ozone', maxY)} fill="none"
                stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />

              {/* Y-axis labels */}
              {yLabels.map(yl => (
                <text key={`yl-${yl.label}`} x={PAD.left - 6} y={yl.y + 3} fontSize="9" fill="#64748b" textAnchor="end">
                  {yl.label}
                </text>
              ))}

              {/* X-axis labels */}
              {xLabels.map((xl, i) => (
                <text key={i} x={xl.x} y={CHART_H - 6} fontSize="8" fill="#64748b" textAnchor="middle">
                  {xl.label}
                </text>
              ))}

              {/* Tooltip crosshair */}
              {tooltip && (
                <>
                  <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + PLOT_H}
                    stroke="#475569" strokeWidth="0.5" strokeDasharray="2 2" />
                  <circle cx={tooltip.x} cy={tooltip.y} r="4" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
                </>
              )}
            </svg>

            {/* Tooltip popup */}
            {tooltip && (
              <div
                className="absolute bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none z-10"
                style={{
                  left: `${(tooltip.x / CHART_W) * 100}%`,
                  top: 0,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="font-semibold text-slate-700">{formatTime(tooltip.point.timestamp)}</div>
                <div className="text-blue-600">AQI: {tooltip.point.usAqi ?? 'N/A'}</div>
                <div className="text-slate-500">PM2.5: {tooltip.point.pm25 ?? 'N/A'}</div>
                <div className="text-green-600">Ozone: {tooltip.point.ozone ?? 'N/A'}</div>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 text-2xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-blue-500 inline-block" /> AQI
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-slate-400 inline-block" style={{ borderTop: '1px dashed' }} /> PM2.5
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-green-500 inline-block" style={{ borderTop: '1px dashed' }} /> Ozone
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
