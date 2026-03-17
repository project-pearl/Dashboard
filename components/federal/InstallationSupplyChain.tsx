/* ------------------------------------------------------------------ */
/*  InstallationSupplyChain — Flow diagram + threat panels             */
/* ------------------------------------------------------------------ */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Droplets,
  Waves,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronRight,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LEVEL_COLORS, STATUS_CRITICAL } from '@/lib/design-tokens';
import InstallationPicker from './InstallationPicker';
import {
  useInstallationSupplyChain,
  type SupplyChainWaterSystem,
  type SupplyChainThreat,
  type SupplyChainAnomaly,
} from '@/hooks/useInstallationSupplyChain';

/* ── Constants ── */

const SOURCE_WATER_COLOR: Record<string, string> = {
  GW: '#7B1FA2',
  SW: '#1565C0',
  GU: '#7B1FA2',
  SWP: '#1565C0',
};

const LEVEL_COLOR: Record<string, string> = {
  ANOMALY: LEVEL_COLORS.ANOMALY,
  CRITICAL: LEVEL_COLORS.CRITICAL,
  WATCH: LEVEL_COLORS.WATCH,
  ADVISORY: LEVEL_COLORS.ADVISORY,
};

/* ── Flow Node ── */

function FlowNode({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  color: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-4 py-3 rounded-pin-md min-w-[100px] text-center"
      style={{ border: `1px solid ${color}40`, background: `${color}08` }}
    >
      {icon}
      <span className="text-pin-xs font-semibold">{label}</span>
      {count != null && (
        <span className="text-pin-xs text-pin-text-secondary">{count} found</span>
      )}
    </div>
  );
}

/* ── Water System Card ── */

function WaterSystemCard({ ws }: { ws: SupplyChainWaterSystem }) {
  const swColor = SOURCE_WATER_COLOR[ws.sourceWater] ?? '#616161';
  return (
    <div className="px-3 py-2 border border-pin-border-default rounded-pin-sm text-pin-xs">
      <div className="flex justify-between items-center mb-1">
        <span className="font-semibold">{ws.name}</span>
        <span
          className="px-1.5 rounded-pin-sm text-2xs font-semibold"
          style={{ background: `${swColor}18`, color: swColor }}
        >
          {ws.sourceWater}
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5 text-pin-text-secondary text-pin-xs">
        <span>PWSID: {ws.pwsid}</span>
        <span>Pop: {ws.population.toLocaleString()}</span>
        <span>{ws.distanceKm} km</span>
        {ws.violationCount > 0 && (
          <span className={cn(ws.healthBasedViolations > 0 ? 'text-pin-critical' : 'text-amber-600')}>
            {ws.violationCount} violations{ws.healthBasedViolations > 0 ? ` (${ws.healthBasedViolations} health)` : ''}
          </span>
        )}
        {ws.enforcementCount > 0 && (
          <span className="text-pin-critical">{ws.enforcementCount} enforcements</span>
        )}
      </div>
    </div>
  );
}

/* ── Threat Item ── */

function ThreatItem({ threat }: { threat: SupplyChainThreat }) {
  if (threat.type === 'npdes_discharger') {
    return (
      <div className="px-2.5 py-1.5 border border-pin-border-default rounded-pin-sm text-pin-xs">
        <div className="font-semibold">{(threat as any).facilityName ?? (threat as any).npdesId}</div>
        <div className="flex gap-2.5 text-pin-text-secondary text-pin-xs mt-0.5">
          <span>NPDES: {(threat as any).npdesId}</span>
          <span>{(threat as any).distanceKm} km</span>
          {(threat as any).violationCount > 0 && (
            <span className="text-pin-critical">{(threat as any).violationCount} violations</span>
          )}
          {(threat as any).sncStatus && (
            <span className="text-pin-critical font-semibold">SNC: {(threat as any).sncStatus}</span>
          )}
        </div>
      </div>
    );
  }

  if (threat.type === 'impaired_water') {
    const causes = (threat as any).causes ?? [];
    return (
      <div className="px-2.5 py-1.5 rounded-pin-sm text-pin-xs border border-pin-warning/25 bg-pin-warning-bg/50">
        <div className="font-semibold">{(threat as any).waterbodyName ?? (threat as any).waterbodyId}</div>
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {causes.slice(0, 5).map((c: string, i: number) => (
            <span key={i} className="bg-amber-50 text-amber-600 px-1 rounded-pin-sm text-2xs">{c}</span>
          ))}
          {(threat as any).category && (
            <span className="text-2xs text-pin-text-secondary">Cat {(threat as any).category}</span>
          )}
        </div>
      </div>
    );
  }

  return null;
}

/* ── Sentinel Anomaly Card ── */

function AnomalyCard({ anomaly }: { anomaly: SupplyChainAnomaly }) {
  const color = LEVEL_COLOR[anomaly.level] ?? '#9E9E9E';
  return (
    <div
      className="px-2.5 py-1.5 rounded-pin-sm text-pin-xs"
      style={{ border: `1px solid ${color}40`, background: `${color}08` }}
    >
      <div className="flex justify-between">
        <span className="font-semibold">HUC {anomaly.huc8}</span>
        <span className="font-semibold text-pin-xs" style={{ color }}>{anomaly.level} ({anomaly.score.toFixed(0)})</span>
      </div>
      {anomaly.patterns.length > 0 && (
        <div className="flex gap-1 mt-0.5">
          {anomaly.patterns.map(p => (
            <span
              key={p}
              className="px-1 rounded-pin-sm text-2xs"
              style={{ background: `${color}18`, color }}
            >{p}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Collapsible Panel ── */

function Panel({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 py-1.5 border-none bg-transparent cursor-pointer text-pin-sm font-semibold"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {icon}
        {title} ({count})
      </button>
      {open && <div className="flex flex-col gap-1 pl-5">{children}</div>}
    </div>
  );
}

/* ── Main ── */

export default function InstallationSupplyChain() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, error, fetch: fetchChain } = useInstallationSupplyChain();

  useEffect(() => {
    if (selectedId) fetchChain(selectedId);
  }, [selectedId, fetchChain]);

  const npdesThreats = data?.upstreamThreats?.filter(t => t.type === 'npdes_discharger') ?? [];
  const impairedThreats = data?.upstreamThreats?.filter(t => t.type === 'impaired_water') ?? [];

  return (
    <div className="flex flex-col gap-4">
      <InstallationPicker selected={selectedId} onSelect={setSelectedId} />

      {error && (
        <div className="p-3 text-pin-critical text-pin-sm">
          <AlertTriangle size={14} className="inline mr-1.5" />{error}
        </div>
      )}

      {isLoading && (
        <div className="p-6 text-center text-pin-text-secondary">Loading supply chain data...</div>
      )}

      {data?.unavailable && (
        <div className="p-4 text-pin-text-secondary text-pin-sm text-center">
          <Shield size={20} className="mb-2" /><br />
          Supply chain analysis is not available for overseas installations.
          <br /><span className="text-pin-xs">Reason: {data.reason}</span>
        </div>
      )}

      {data && !data.unavailable && data.installation && (
        <>
          {/* Flow diagram */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <FlowNode
              icon={<Building2 size={20} className="text-blue-800" />}
              label={data.installation.name}
              color="#1565C0"
            />
            <ArrowLeft size={16} className="text-pin-text-secondary" />
            <FlowNode
              icon={<Droplets size={20} className="text-purple-700" />}
              label="Water Systems"
              count={data.waterSystems.length}
              color="#7B1FA2"
            />
            <ArrowLeft size={16} className="text-pin-text-secondary" />
            <FlowNode
              icon={<Waves size={20} className="text-cyan-800" />}
              label="Source Water"
              count={data.upstreamNavigation ? 1 : 0}
              color="#00838F"
            />
            <ArrowLeft size={16} className="text-pin-text-secondary" />
            <FlowNode
              icon={<AlertTriangle size={20} className="text-amber-600" />}
              label="Upstream Threats"
              count={data.upstreamThreats.length + data.sentinelAnomalies.length}
              color="#F57C00"
            />
          </div>

          {/* Water Systems */}
          {data.waterSystems.length > 0 && (
            <Panel title="Water Systems" icon={<Droplets size={14} className="text-purple-700" />} count={data.waterSystems.length}>
              {data.waterSystems.map(ws => <WaterSystemCard key={ws.pwsid} ws={ws} />)}
            </Panel>
          )}

          {/* NPDES dischargers */}
          {npdesThreats.length > 0 && (
            <Panel title="NPDES Dischargers" icon={<Activity size={14} className="text-amber-600" />} count={npdesThreats.length}>
              {npdesThreats.map((t, i) => <ThreatItem key={i} threat={t} />)}
            </Panel>
          )}

          {/* Impaired waters */}
          {impairedThreats.length > 0 && (
            <Panel title="Impaired Waters" icon={<AlertTriangle size={14} className="text-pin-warning" />} count={impairedThreats.length}>
              {impairedThreats.map((t, i) => <ThreatItem key={i} threat={t} />)}
            </Panel>
          )}

          {/* Sentinel anomalies */}
          {data.sentinelAnomalies.length > 0 && (
            <Panel title="Sentinel Anomalies" icon={<Shield size={14} className="text-pin-critical" />} count={data.sentinelAnomalies.length}>
              {data.sentinelAnomalies.map(a => <AnomalyCard key={a.huc8} anomaly={a} />)}
            </Panel>
          )}

          {/* Empty state */}
          {data.waterSystems.length === 0 && data.upstreamThreats.length === 0 && data.sentinelAnomalies.length === 0 && (
            <div className="p-4 text-center text-pin-text-secondary text-pin-sm">
              No water supply chain data found for this installation. This may indicate limited data coverage in the area.
            </div>
          )}
        </>
      )}

      {!selectedId && !isLoading && (
        <div className="p-6 text-center text-pin-text-secondary text-pin-sm">
          Select an installation above to trace its water supply chain.
        </div>
      )}
    </div>
  );
}
