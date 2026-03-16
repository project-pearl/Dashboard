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
import InstallationPicker from './InstallationPicker';
import { useThreatFusion } from '@/hooks/useThreatFusion';
import type { DomainScore, FusionLevel, ThreatFusionResponse } from '@/lib/threatFusion';

/* ── Constants ── */

const LEVEL_COLOR: Record<FusionLevel, string> = {
  low: '#388E3C',
  moderate: '#1565C0',
  elevated: '#F9A825',
  high: '#F57C00',
  critical: '#D32F2F',
};

const FPCON_COLOR: Record<string, string> = {
  NORMAL: '#388E3C',
  ALPHA: '#1565C0',
  BRAVO: '#F9A825',
  CHARLIE: '#F57C00',
  DELTA: '#D32F2F',
};

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
  const color = LEVEL_COLOR[level];
  // Color zones: green(0-20), blue(21-40), yellow(41-60), orange(61-80), red(81-100)
  const zones = [
    { start: 0, end: 20, color: '#388E3C' },
    { start: 20, end: 40, color: '#1565C0' },
    { start: 40, end: 60, color: '#F9A825' },
    { start: 60, end: 80, color: '#F57C00' },
    { start: 80, end: 100, color: '#D32F2F' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 24, fontWeight: 700, color }}>{score}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color, textTransform: 'uppercase' }}>{level}</span>
      </div>
      <div style={{ position: 'relative', height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
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
        <div style={{
          position: 'absolute',
          left: `${score}%`,
          top: 0,
          bottom: 0,
          width: 3,
          background: color,
          borderRadius: 2,
          transform: 'translateX(-50%)',
          boxShadow: `0 0 4px ${color}80`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
        <span>LOW</span><span>MOD</span><span>ELEV</span><span>HIGH</span><span>CRIT</span>
      </div>
    </div>
  );
}

/* ── Domain Bar ── */

function DomainBar({ domain }: { domain: DomainScore }) {
  const [expanded, setExpanded] = useState(false);
  const barColor = domain.score >= 60 ? '#D32F2F' : domain.score >= 40 ? '#F57C00' : domain.score >= 20 ? '#F9A825' : '#388E3C';

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 0', fontSize: 13 }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 100 }}>
          {DOMAIN_ICON[domain.domain]}
          {domain.domain}
        </span>
        <div style={{ flex: 1, height: 8, background: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${domain.score}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        <span style={{ minWidth: 30, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{domain.score}</span>
      </button>
      {expanded && (
        <div style={{ paddingLeft: 28, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
          {domain.detail} (weight: {(domain.weight * 100).toFixed(0)}%)
        </div>
      )}
    </div>
  );
}

/* ── FPCON Badge ── */

function FpconBadge({ fpcon }: { fpcon: string }) {
  const color = FPCON_COLOR[fpcon] ?? '#9E9E9E';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${color}18`, color, border: `1px solid ${color}40`,
      padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
    }}>
      FPCON {fpcon}
    </span>
  );
}

/* ── Alert Badge ── */

function AlertBadge({ alert, onDismiss }: { alert: { domain: string; message: string }; onDismiss: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
      background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: 4, fontSize: 12,
    }}>
      <AlertTriangle size={13} style={{ color: '#F57C00', flexShrink: 0 }} />
      <span style={{ flex: 1 }}><strong>{alert.domain}:</strong> {alert.message}</span>
      <button onClick={onDismiss} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
        <X size={12} style={{ color: '#9E9E9E' }} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InstallationPicker selected={selectedId} onSelect={setSelectedId} />

      {error && (
        <div style={{ padding: 12, color: '#D32F2F', fontSize: 13 }}>
          <AlertTriangle size={14} style={{ marginRight: 6 }} />{error}
        </div>
      )}

      {isLoading && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading threat fusion...</div>
      )}

      {data && (
        <>
          {/* Composite gauge */}
          <CompositeGauge score={data.compositeScore} level={data.level} />

          {/* FPCON + state info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <FpconBadge fpcon={data.fpcon} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{data.installationName}, {data.state}</span>
          </div>

          {/* Domain breakdown */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>DOMAIN BREAKDOWN</div>
            {data.domains
              .sort((a, b) => b.weightedScore - a.weightedScore)
              .map(d => <DomainBar key={d.domain} domain={d} />)}
          </div>

          {/* Narrative */}
          <div style={{
            padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 6,
            fontSize: 13, lineHeight: 1.5, borderLeft: `3px solid ${LEVEL_COLOR[data.level]}`,
          }}>
            {data.narrative}
          </div>

          {/* Protective actions */}
          {data.protectiveActions && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>PROTECTIVE ACTIONS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {data.protectiveActions.shelterInPlace
                    ? <AlertTriangle size={12} style={{ color: '#D32F2F' }} />
                    : <Check size={12} style={{ color: '#388E3C' }} />}
                  Shelter in Place: {data.protectiveActions.shelterInPlace ? 'ACTIVE' : 'Not required'}
                </div>
                <div>Respiratory: <strong>{data.protectiveActions.respiratoryProtection}</strong></div>
                {data.protectiveActions.evacuationZones.length > 0 && (
                  <div>Evacuation zones: {data.protectiveActions.evacuationZones.join(', ')}</div>
                )}
                {data.protectiveActions.recommendedFPCON !== data.protectiveActions.currentFPCON && (
                  <div style={{ color: '#F57C00', fontWeight: 600 }}>
                    Recommended FPCON: {data.protectiveActions.recommendedFPCON.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alerts */}
          {visibleAlerts.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>ACTIVE ALERTS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
          Select an installation above to view cross-domain threat fusion analysis.
        </div>
      )}
    </div>
  );
}
