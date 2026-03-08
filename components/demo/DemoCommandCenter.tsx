'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IntelGrid } from './IntelGrid';
import { SentinelAlertDrawer } from './SentinelAlertDrawer';
import { WaterScoreBreakdown } from './WaterScoreBreakdown';
import { GridByNumbers } from './GridByNumbers';
import { EntitySelector } from './EntitySelector';
import { PotomacScenario } from './PotomacScenario';
import { AccessGate } from './AccessGate';

/* ── Types for API response ─────────────────────────────────────────── */

export interface DemoGridData {
  sites: GeoJSON.FeatureCollection;
  totalMonitoringPoints: number;
  lastUpdated: string;
  impairmentByState: Record<string, number>;
}

/* ── Constants ──────────────────────────────────────────────────────── */

const FALLBACK_DATA: DemoGridData = {
  sites: { type: 'FeatureCollection', features: [] },
  totalMonitoringPoints: 13_247,
  lastUpdated: new Date().toISOString(),
  impairmentByState: {},
};

/* ── Component ──────────────────────────────────────────────────────── */

export function DemoCommandCenter() {
  const [gridData, setGridData] = useState<DemoGridData>(FALLBACK_DATA);
  const [activeEntity, setActiveEntity] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  /* Fetch live grid data */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/demo-grid');
        if (!res.ok) throw new Error(res.statusText);
        const data: DemoGridData = await res.json();
        if (!cancelled) setGridData(data);
      } catch {
        // keep fallback
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Entity card click → swap overlay + scroll to map */
  const handleEntitySelect = useCallback((entity: string) => {
    setActiveEntity(entity);
    mapRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /* Alert marker click → open drawer */
  const handleAlertClick = useCallback((alertId: string) => {
    setSelectedAlert(alertId);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Section 1 — The Grid (full viewport map) */}
      <div ref={mapRef}>
        <IntelGrid
          gridData={gridData}
          activeEntity={activeEntity}
          onAlertClick={handleAlertClick}
        />
      </div>

      {/* Section 2 — Sentinel Alert Drawer */}
      <SentinelAlertDrawer
        selectedAlert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
      />

      {/* Section 3 — The Score */}
      <WaterScoreBreakdown />

      {/* Section 4 — Grid by Numbers */}
      <GridByNumbers />

      {/* Section 5 — Entity Selector */}
      <EntitySelector
        activeEntity={activeEntity}
        onSelect={handleEntitySelect}
      />

      {/* Section 6 — Potomac Scenario */}
      <PotomacScenario />

      {/* Section 7 — Access Gate */}
      <AccessGate />
    </div>
  );
}
