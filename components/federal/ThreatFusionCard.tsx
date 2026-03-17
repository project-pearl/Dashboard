/* ------------------------------------------------------------------ */
/*  ThreatFusionCard — Composite threat gauge + domain breakdown        */
/* ------------------------------------------------------------------ */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  Flame,
  Wind,
  Droplets,
  Wifi,
  Activity,
  ChevronDown,
  ChevronRight,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FUSION_LEVEL_COLORS,
  FPCON_COLORS,
  STATUS_CRITICAL,
  STATUS_SUCCESS,
} from '@/lib/design-tokens';
import InstallationPicker from './InstallationPicker';
import { useThreatFusion } from '@/hooks/useThreatFusion';
import type { DomainScore, FusionLevel, ThreatFusionResponse } from '@/lib/threatFusion';

/* ── Constants ── */

const DOMAIN_ICON: Record<string, React.ReactNode> = {
  CBRN: <Shield size={14} />,
  Cyber: <Wifi size={14} />,
  Sentinel: <Activity size={14} />,
  Fire: <Flame size={14} />,
  'Air Quality': <Wind size={14} />,
  Flood: <Droplets size={14} />,
};

/* ── Gauge ── */

function CompositeGauge({ score, level }: { score: number; level: FusionLevel }) {
  const color = FUSION_LEVEL_COLORS[level];
  // Color zones: green(0-20), blue(21-40), yellow(41-60), orange(61-80), red(81-100)
  const zones = [
    { start: 0, end: 20, color: FUSION_LEVEL_COLORS.low },
    { start: 20, end: 40, color: FUSION_LEVEL_COLORS.moderate },
    { start: 40, end: 60, color: FUSION_LEVEL_COLORS.elevated },
    { start: 60, end: 80, color: FUSION_LEVEL_COLORS.high },
    { start: 80, end: 100, color: FUSION_LEVEL_COLORS.critical },
  ];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-pin-xl font-bold" style={{ color }}>{score}</span>
        <span className="text-pin-sm font-semibold uppercase" style={{ color }}>{level}</span>
      </div>
      <div className="relative h-3 rounded-md overflow-hidden flex">
        {zones.map(z => (
          <div
            key={z.start}
            style={{
              flex: `${z.end - z.start}`,
              background: `${z.color}30`,
              borderRight: z.end < 100 ? '1px solid var(--bg-primary)' : 'none',
            }}
          />
        ))}
        {/* Indicator needle */}
        <div
          className="absolute top-0 bottom-0 w-[3px] rounded-sm -translate-x-1/2"
          style={{
            left: `${score}%`,
            background: color,
            boxShadow: `0 0 4px ${color}80`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-pin-text-secondary">
        <span>LOW</span><span>MOD</span><span>ELEV</span><span>HIGH</span><span>CRIT</span>
      </div>
    </div>
  );
}

/* ── Domain Bar ── */

function DomainBar({ domain }: { domain: DomainScore }) {
  const [expanded, setExpanded] = useState(false);
  const barColor =
    domain.score >= 60
      ? FUSION_LEVEL_COLORS.critical
      : domain.score >= 40
        ? FUSION_LEVEL_COLORS.high
        : domain.score >= 20
          ? FUSION_LEVEL_COLORS.elevated
          : FUSION_LEVEL_COLORS.low;

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full border-none bg-transparent cursor-pointer py-1 text-pin-sm"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="flex items-center gap-1 min-w-[100px]">
          {DOMAIN_ICON[domain.domain]}
          {domain.domain}
        </span>
        <div className="flex-1 h-2 bg-gray-300 rounded-pin-sm overflow-hidden">
          <div
            className="h-full rounded-pin-sm transition-[width] duration-300"
            style={{ width: `${domain.score}%`, background: barColor }}
          />
        </div>
        <span className="min-w-[30px] text-right font-semibold tabular-nums">{domain.score}</span>
      </button>
      {expanded && (
        <div className="pl-7 text-pin-xs text-pin-text-secondary mb-1">
          {domain.detail} (weight: {(domain.weight * 100).toFixed(0)}%)
        </div>
      )}
    </div>
  );
}

/* ── FPCON Badge ── */

function FpconBadge({ fpcon }: { fpcon: string }) {
  const color = FPCON_COLORS[fpcon as keyof typeof FPCON_COLORS] ?? '#9E9E9E';
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pin-sm text-pin-xs font-semibold"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      FPCON {fpcon}
    </span>
  );
}

/* ── Alert Badge ── */

function AlertBadge({ alert, onDismiss }: { alert: { domain: string; message: string }; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-pin-sm text-pin-xs">
      <AlertTriangle size={13} className="text-amber-600 shrink-0" />
      <span className="flex-1"><strong>{alert.domain}:</strong> {alert.message}</span>
      <button onClick={onDismiss} className="border-none bg-transparent cursor-pointer p-0">
        <X size={12} className="text-gray-400" />
      </button>
    </div>
  );
}

/* ── Main ── */

export default function ThreatFusionCard() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, error, fetch: fetchFusion } = useThreatFusion();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedId) {
      fetchFusion(selectedId);
      setDismissedAlerts(new Set());
    }
  }, [selectedId, fetchFusion]);

  const visibleAlerts = (data?.alerts ?? []).filter((_, i) => !dismissedAlerts.has(String(i)));

  return (
    <div className="flex flex-col gap-4">
      <InstallationPicker selected={selectedId} onSelect={setSelectedId} />

      {error && (
        <div className="p-3 text-pin-critical text-pin-sm">
          <AlertTriangle size={14} className="mr-1.5 inline-block" />{error}
        </div>
      )}

      {isLoading && (
        <div className="p-6 text-center text-pin-text-secondary">Loading threat fusion...</div>
      )}

      {data && (
        <>
          {/* Composite gauge */}
          <CompositeGauge score={data.compositeScore} level={data.level} />

          {/* FPCON + state info */}
          <div className="flex items-center gap-3 flex-wrap">
            <FpconBadge fpcon={data.fpcon} />
            <span className="text-pin-xs text-pin-text-secondary">{data.installationName}, {data.state}</span>
          </div>

          {/* Domain breakdown */}
          <div>
            <div className="text-pin-xs font-semibold text-pin-text-secondary mb-1.5">DOMAIN BREAKDOWN</div>
            {data.domains
              .sort((a, b) => b.weightedScore - a.weightedScore)
              .map(d => <DomainBar key={d.domain} domain={d} />)}
          </div>

          {/* Narrative */}
          <div
            className="px-3.5 py-2.5 bg-[var(--bg-secondary)] rounded-pin-md text-pin-sm leading-relaxed"
            style={{ borderLeft: `3px solid ${FUSION_LEVEL_COLORS[data.level]}` }}
          >
            {data.narrative}
          </div>

          {/* Protective actions */}
          {data.protectiveActions && (
            <div>
              <div className="text-pin-xs font-semibold text-pin-text-secondary mb-1.5">PROTECTIVE ACTIONS</div>
              <div className="flex flex-col gap-1 text-pin-xs">
                <div className="flex items-center gap-1.5">
                  {data.protectiveActions.shelterInPlace
                    ? <AlertTriangle size={12} className="text-pin-critical" />
                    : <Check size={12} className="text-pin-success" />}
                  Shelter in Place: {data.protectiveActions.shelterInPlace ? 'ACTIVE' : 'Not required'}
                </div>
                <div>Respiratory: <strong>{data.protectiveActions.respiratoryProtection}</strong></div>
                {data.protectiveActions.evacuationZones.length > 0 && (
                  <div>Evacuation zones: {data.protectiveActions.evacuationZones.join(', ')}</div>
                )}
                {data.protectiveActions.recommendedFPCON !== data.protectiveActions.currentFPCON && (
                  <div className="text-pin-warning font-semibold">
                    Recommended FPCON: {data.protectiveActions.recommendedFPCON.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alerts */}
          {visibleAlerts.length > 0 && (
            <div>
              <div className="text-pin-xs font-semibold text-pin-text-secondary mb-1.5">ACTIVE ALERTS</div>
              <div className="flex flex-col gap-1">
                {data.alerts.map((a, i) => (
                  !dismissedAlerts.has(String(i)) && (
                    <AlertBadge
                      key={i}
                      alert={a}
                      onDismiss={() => setDismissedAlerts(prev => new Set([...prev, String(i)]))}
                    />
                  )
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!selectedId && !isLoading && (
        <div className="p-6 text-center text-pin-text-secondary text-pin-sm">
          Select an installation above to view cross-domain threat fusion analysis.
        </div>
      )}
    </div>
  );
}
