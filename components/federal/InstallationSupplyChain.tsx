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
  ANOMALY: '#7B1FA2',
  CRITICAL: '#D32F2F',
  WATCH: '#F9A825',
  ADVISORY: '#9E9E9E',
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
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '12px 16px', borderRadius: 8, border: `1px solid ${color}40`,
      background: `${color}08`, minWidth: 100, textAlign: 'center',
    }}>
      {icon}
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
      {count != null && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{count} found</span>}
    </div>
  );
}

/* ── Water System Card ── */

function WaterSystemCard({ ws }: { ws: SupplyChainWaterSystem }) {
  const swColor = SOURCE_WATER_COLOR[ws.sourceWater] ?? '#616161';
  return (
    <div style={{ padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{ws.name}</span>
        <span style={{
          background: `${swColor}18`, color: swColor,
          padding: '0 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
        }}>
          {ws.sourceWater}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: 'var(--text-secondary)', fontSize: 11 }}>
        <span>PWSID: {ws.pwsid}</span>
        <span>Pop: {ws.population.toLocaleString()}</span>
        <span>{ws.distanceKm} km</span>
        {ws.violationCount > 0 && (
          <span style={{ color: ws.healthBasedViolations > 0 ? '#D32F2F' : '#F57C00' }}>
            {ws.violationCount} violations{ws.healthBasedViolations > 0 ? ` (${ws.healthBasedViolations} health)` : ''}
          </span>
        )}
        {ws.enforcementCount > 0 && (
          <span style={{ color: '#D32F2F' }}>{ws.enforcementCount} enforcements</span>
        )}
      </div>
    </div>
  );
}

/* ── Threat Item ── */

function ThreatItem({ threat }: { threat: SupplyChainThreat }) {
  if (threat.type === 'npdes_discharger') {
    return (
      <div style={{ padding: '6px 10px', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12 }}>
        <div style={{ fontWeight: 600 }}>{(threat as any).facilityName ?? (threat as any).npdesId}</div>
        <div style={{ display: 'flex', gap: 10, color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>
          <span>NPDES: {(threat as any).npdesId}</span>
          <span>{(threat as any).distanceKm} km</span>
          {(threat as any).violationCount > 0 && (
            <span style={{ color: '#D32F2F' }}>{(threat as any).violationCount} violations</span>
          )}
          {(threat as any).sncStatus && (
            <span style={{ color: '#D32F2F', fontWeight: 600 }}>SNC: {(threat as any).sncStatus}</span>
          )}
        </div>
      </div>
    );
  }

  if (threat.type === 'impaired_water') {
    const causes = (threat as any).causes ?? [];
    return (
      <div style={{ padding: '6px 10px', border: '1px solid #F9A82540', borderRadius: 4, fontSize: 12, background: '#F9A82508' }}>
        <div style={{ fontWeight: 600 }}>{(threat as any).waterbodyName ?? (threat as any).waterbodyId}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          {causes.slice(0, 5).map((c: string, i: number) => (
            <span key={i} style={{ background: '#FFF8E1', color: '#F57C00', padding: '0 4px', borderRadius: 3, fontSize: 10 }}>{c}</span>
          ))}
          {(threat as any).category && (
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Cat {(threat as any).category}</span>
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
    <div style={{ padding: '6px 10px', border: `1px solid ${color}40`, borderRadius: 4, fontSize: 12, background: `${color}08` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>HUC {anomaly.huc8}</span>
        <span style={{ color, fontWeight: 600, fontSize: 11 }}>{anomaly.level} ({anomaly.score.toFixed(0)})</span>
      </div>
      {anomaly.patterns.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
          {anomaly.patterns.map(p => (
            <span key={p} style={{ background: `${color}18`, color, padding: '0 4px', borderRadius: 3, fontSize: 10 }}>{p}</span>
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
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {icon}
        {title} ({count})
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>{children}</div>}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InstallationPicker selected={selectedId} onSelect={setSelectedId} />

      {error && (
        <div style={{ padding: 12, color: '#D32F2F', fontSize: 13 }}>
          <AlertTriangle size={14} style={{ marginRight: 6 }} />{error}
        </div>
      )}

      {isLoading && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading supply chain data...</div>
      )}

      {data?.unavailable && (
        <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center' }}>
          <Shield size={20} style={{ marginBottom: 8 }} /><br />
          Supply chain analysis is not available for overseas installations.
          <br /><span style={{ fontSize: 11 }}>Reason: {data.reason}</span>
        </div>
      )}

      {data && !data.unavailable && data.installation && (
        <>
          {/* Flow diagram */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <FlowNode
              icon={<Building2 size={20} style={{ color: '#1565C0' }} />}
              label={data.installation.name}
              color="#1565C0"
            />
            <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
            <FlowNode
              icon={<Droplets size={20} style={{ color: '#7B1FA2' }} />}
              label="Water Systems"
              count={data.waterSystems.length}
              color="#7B1FA2"
            />
            <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
            <FlowNode
              icon={<Waves size={20} style={{ color: '#00838F' }} />}
              label="Source Water"
              count={data.upstreamNavigation ? 1 : 0}
              color="#00838F"
            />
            <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
            <FlowNode
              icon={<AlertTriangle size={20} style={{ color: '#F57C00' }} />}
              label="Upstream Threats"
              count={data.upstreamThreats.length + data.sentinelAnomalies.length}
              color="#F57C00"
            />
          </div>

          {/* Water Systems */}
          {data.waterSystems.length > 0 && (
            <Panel title="Water Systems" icon={<Droplets size={14} style={{ color: '#7B1FA2' }} />} count={data.waterSystems.length}>
              {data.waterSystems.map(ws => <WaterSystemCard key={ws.pwsid} ws={ws} />)}
            </Panel>
          )}

          {/* NPDES dischargers */}
          {npdesThreats.length > 0 && (
            <Panel title="NPDES Dischargers" icon={<Activity size={14} style={{ color: '#F57C00' }} />} count={npdesThreats.length}>
              {npdesThreats.map((t, i) => <ThreatItem key={i} threat={t} />)}
            </Panel>
          )}

          {/* Impaired waters */}
          {impairedThreats.length > 0 && (
            <Panel title="Impaired Waters" icon={<AlertTriangle size={14} style={{ color: '#F9A825' }} />} count={impairedThreats.length}>
              {impairedThreats.map((t, i) => <ThreatItem key={i} threat={t} />)}
            </Panel>
          )}

          {/* Sentinel anomalies */}
          {data.sentinelAnomalies.length > 0 && (
            <Panel title="Sentinel Anomalies" icon={<Shield size={14} style={{ color: '#D32F2F' }} />} count={data.sentinelAnomalies.length}>
              {data.sentinelAnomalies.map(a => <AnomalyCard key={a.huc8} anomaly={a} />)}
            </Panel>
          )}

          {/* Empty state */}
          {data.waterSystems.length === 0 && data.upstreamThreats.length === 0 && data.sentinelAnomalies.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              No water supply chain data found for this installation. This may indicate limited data coverage in the area.
            </div>
          )}
        </>
      )}

      {!selectedId && !isLoading && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
          Select an installation above to trace its water supply chain.
        </div>
      )}
    </div>
  );
}
