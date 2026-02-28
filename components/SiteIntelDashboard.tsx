'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, MapPin, Droplets, Shield, AlertTriangle, FileText,
  Loader2, ChevronDown, ChevronUp, ExternalLink, TreePine, Waves,
  Factory, Bug, Scale, Gauge, Info, Bell,
} from 'lucide-react';
import HeroBanner from '@/components/HeroBanner';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';
import { useSearchParams } from 'next/navigation';
import { getLensesForHref } from '@/lib/lensRegistry';
import type { SiteIntelligenceReport, RiskIndicator, RiskLevel } from '@/lib/siteIntelTypes';
import type { WaterRiskScoreResult, CategoryKey } from '@/lib/waterRiskScore';

const MapboxMapShell = dynamic(
  () => import('@/components/MapboxMapShell').then(m => m.MapboxMapShell),
  { ssr: false, loading: () => <div className="h-[200px] bg-slate-100 rounded-lg animate-pulse" /> },
);

// ─── Lens config ────────────────────────────────────────────────────────────

interface LensConfig {
  sections: Set<string> | null;
}

const LENS_SECTIONS: Record<string, Set<string>> = {
  overview:       new Set(['location-context', 'env-profile', 'species-habitat', 'contamination', 'regulatory', 'water-score', 'disclaimer']),
  environment:    new Set(['location-context', 'env-profile', 'disclaimer']),
  species:        new Set(['location-context', 'species-habitat', 'disclaimer']),
  contamination:  new Set(['location-context', 'contamination', 'disclaimer']),
  regulatory:     new Set(['location-context', 'regulatory', 'disclaimer']),
  risk:           new Set(['location-context', 'water-score', 'disclaimer']),
};

// ─── Example search chips ───────────────────────────────────────────────────

const EXAMPLE_SEARCHES = [
  { label: 'Baltimore, MD', value: 'Baltimore, MD' },
  { label: 'Flint, MI', value: 'Flint, MI' },
  { label: 'ZIP: 21201', value: '21201' },
  { label: '39.27, -76.61', value: '39.2704, -76.6124' },
];

// ─── Risk summary logic ────────────────────────────────────────────────────

function computeRiskIndicators(report: SiteIntelligenceReport): RiskIndicator[] {
  const indicators: RiskIndicator[] = [];

  // Water Quality
  const ws = report.waterScore;
  const wqScore = ws?.categories?.waterQuality?.score ?? null;
  indicators.push({
    label: 'Water Quality',
    level: wqScore === null ? 'gray' : wqScore >= 70 ? 'green' : wqScore >= 40 ? 'amber' : 'red',
    detail: wqScore !== null ? `Score: ${wqScore}/100` : 'No data',
    panelId: 'water-score',
  });

  // Species Constraints
  const habCount = report.speciesHabitat.criticalHabitat.length;
  indicators.push({
    label: 'Species Constraints',
    level: habCount === 0 ? 'green' : habCount <= 2 ? 'amber' : 'red',
    detail: habCount > 0 ? `${habCount} critical habitat(s) nearby` : 'No critical habitat within 3 mi',
    panelId: 'species-habitat',
  });

  // Contamination Risk
  const sfCount = report.contamination.superfund.length;
  const bfCount = report.contamination.brownfields.length;
  const contTotal = sfCount + bfCount;
  indicators.push({
    label: 'Contamination Risk',
    level: sfCount > 0 ? 'red' : contTotal > 0 ? 'amber' : 'green',
    detail: contTotal > 0 ? `${sfCount} Superfund, ${bfCount} brownfield sites` : 'No contaminated sites within 5 mi',
    panelId: 'contamination',
  });

  // Regulatory Burden
  const violations = report.regulatory.icisViolations.length + report.regulatory.sdwisViolations.length;
  indicators.push({
    label: 'Regulatory Burden',
    level: violations === 0 ? 'green' : violations <= 3 ? 'amber' : 'red',
    detail: violations > 0 ? `${violations} active violation(s)` : 'No active violations',
    panelId: 'regulatory',
  });

  // Flood Risk
  const fz = report.floodZone;
  indicators.push({
    label: 'Flood Risk',
    level: !fz ? 'gray' : fz.sfha ? 'red' : fz.zone === 'X' ? 'green' : 'amber',
    detail: fz ? `Zone ${fz.zone}${fz.sfha ? ' (SFHA)' : ''}` : 'No FEMA data',
    panelId: 'env-profile',
  });

  // EJ Vulnerability
  const ejDemoIdx = report.environmentalProfile.ejscreen?.demographicIndex;
  indicators.push({
    label: 'EJ Vulnerability',
    level: ejDemoIdx == null ? 'gray' : ejDemoIdx >= 80 ? 'red' : ejDemoIdx >= 50 ? 'amber' : 'green',
    detail: ejDemoIdx != null ? `Demographic index: ${ejDemoIdx}th percentile` : 'No EJScreen data',
    panelId: 'env-profile',
  });

  // Data Confidence
  const composite = ws?.composite;
  indicators.push({
    label: 'Data Confidence',
    level: !composite ? 'gray' : composite.confidence >= 0.7 ? 'green' : composite.confidence >= 0.4 ? 'amber' : 'red',
    detail: composite ? `${Math.round(composite.confidence * 100)}% data coverage` : 'Insufficient data',
    panelId: 'water-score',
  });

  return indicators;
}

const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; dot: string }> = {
  green: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  red:   { bg: 'bg-red-50',   text: 'text-red-700',   dot: 'bg-red-500' },
  gray:  { bg: 'bg-slate-50', text: 'text-slate-500',  dot: 'bg-slate-400' },
};

// ─── Grade colors ───────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-green-600', A: 'text-green-600', 'A-': 'text-green-600',
  'B+': 'text-emerald-600', B: 'text-emerald-600', 'B-': 'text-emerald-600',
  'C+': 'text-amber-600', C: 'text-amber-600', 'C-': 'text-amber-600',
  'D+': 'text-orange-600', D: 'text-orange-600', 'D-': 'text-orange-600',
  F: 'text-red-600',
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SiteIntelDashboard() {
  const searchParams = useSearchParams();
  const currentLens = searchParams.get('lens') || 'overview';

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<SiteIntelligenceReport | null>(null);
  const [riskOpen, setRiskOpen] = useState(true);

  // Lens config
  const lens: LensConfig = useMemo(() => ({
    sections: LENS_SECTIONS[currentLens] || null,
  }), [currentLens]);

  // Risk indicators
  const riskIndicators = useMemo(() => report ? computeRiskIndicators(report) : [], [report]);

  // ── Search handler ──
  const handleSearch = useCallback(async (input: string) => {
    const q = input.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setReport(null);

    try {
      // Detect input type
      let url = '/api/site-intelligence?';
      const coordMatch = q.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
      const zipMatch = q.match(/^\d{5}$/);

      if (coordMatch) {
        url += `lat=${coordMatch[1]}&lng=${coordMatch[2]}`;
      } else if (zipMatch) {
        url += `zip=${q}`;
      } else {
        url += `address=${encodeURIComponent(q)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error ${res.status}`);
      }
      const data: SiteIntelligenceReport = await res.json();
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const scrollToPanel = (panelId: string) => {
    const el = document.getElementById(`section-${panelId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-4">
      <HeroBanner role="site-intel" />

      {/* ── Address Search Bar ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter an address, ZIP code, or coordinates..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </form>

        {/* Example chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs text-slate-500">Try:</span>
          {EXAMPLE_SEARCHES.map((ex) => (
            <button
              key={ex.value}
              onClick={() => { setQuery(ex.value); handleSearch(ex.value); }}
              className="text-xs px-2.5 py-1 rounded-full border border-slate-200 hover:bg-amber-50 hover:border-amber-300 text-slate-600 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
              <div className="space-y-2">
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Report Content ── */}
      {report && !loading && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Main panels */}
          <div className="flex-1 min-w-0">
            <LayoutEditor ccKey="SiteIntel">
            {({ sections, isEditMode, onToggleVisibility, collapsedSections }) => {
              return (
              <div className={`space-y-4 ${isEditMode ? 'pl-12' : ''}`}>
              {sections.filter(s => {
                if (isEditMode) return true;
                if (!s.visible) return false;
                if (s.lensControlled && lens.sections) return lens.sections.has(s.id);
                return true;
              }).map(section => {
                const DS = (children: React.ReactNode) => (
                  <DraggableSection key={section.id} id={section.id} label={section.label}
                    isEditMode={isEditMode} isVisible={section.visible} onToggleVisibility={onToggleVisibility}>
                    {children}
                  </DraggableSection>
                );

                switch (section.id) {

                  // ── Location Context ──────────────────────────────────────
                  case 'location-context': return DS(
                    <div id="section-location-context" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-bold text-slate-800">Location Context</span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                        {/* Mini-map */}
                        <div className="h-[220px] lg:h-[280px] border-b lg:border-b-0 lg:border-r border-slate-100">
                          <MapboxMapShell
                            center={[report.location.lat, report.location.lng]}
                            zoom={12}
                            height="100%"
                            mapKey={`site-intel-${report.location.lat}-${report.location.lng}`}
                          />
                        </div>
                        {/* Key-value grid */}
                        <div className="p-4">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            <KV label="Address" value={report.location.label} />
                            <KV label="Coordinates" value={`${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}`} />
                            <KV label="State" value={report.location.state || '—'} />
                            <KV label="County" value={report.census?.county || '—'} />
                            <KV label="FIPS" value={report.census?.fips || '—'} />
                            <KV label="Census Tract" value={report.census?.tract || '—'} />
                            <KV label="Congressional District" value={report.census?.congressionalDistrict || '—'} />
                            <KV label="HUC-8 Watershed" value={report.location.huc8 ? `${report.location.huc8}` : '—'} />
                            {report.location.hucDistance != null && (
                              <KV label="HUC-8 Distance" value={`${report.location.hucDistance} km`} />
                            )}
                            {report.location.zip && <KV label="ZIP Code" value={report.location.zip} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );

                  // ── Environmental Profile ─────────────────────────────────
                  case 'env-profile': return DS(
                    <div id="section-env-profile" className="rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                        <TreePine className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-bold text-slate-800">Environmental Profile</span>
                        <SourceBadge tier="T1+T3" />
                      </div>
                      <div className="p-4 space-y-4">
                        {/* ATTAINS waterbodies */}
                        {report.environmentalProfile.attains && (
                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-2">Waterbody Impairment (ATTAINS)</div>
                            <div className="grid grid-cols-3 gap-3">
                              <MetricBox label="Total Assessed" value={report.environmentalProfile.attains.total} />
                              <MetricBox label="Impaired" value={report.environmentalProfile.attains.impaired} color="text-red-600" />
                              <MetricBox label="% Impaired" value={report.environmentalProfile.attains.total > 0 ? `${Math.round((report.environmentalProfile.attains.impaired / report.environmentalProfile.attains.total) * 100)}%` : '—'} />
                            </div>
                            {report.environmentalProfile.attains.topCauses.length > 0 && (
                              <div className="mt-2 text-[11px] text-slate-600">
                                <span className="font-semibold">Top causes:</span>{' '}
                                {report.environmentalProfile.attains.topCauses.slice(0, 5).join(', ')}
                              </div>
                            )}
                          </div>
                        )}

                        {/* EJScreen indicators */}
                        {report.environmentalProfile.ejscreen && (
                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-2">EJ Indicators (EJScreen)</div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <EJMetric label="Demographic Index" value={report.environmentalProfile.ejscreen.demographicIndex} suffix="pctl" />
                              <EJMetric label="PM2.5" value={report.environmentalProfile.ejscreen.pm25} suffix="pctl" />
                              <EJMetric label="Ozone" value={report.environmentalProfile.ejscreen.ozone} suffix="pctl" />
                              <EJMetric label="Wastewater" value={report.environmentalProfile.ejscreen.wastewater} suffix="pctl" />
                              <EJMetric label="Superfund Proximity" value={report.environmentalProfile.ejscreen.superfundProximity} suffix="pctl" />
                              <EJMetric label="Haz. Waste" value={report.environmentalProfile.ejscreen.hazWaste} suffix="pctl" />
                            </div>
                          </div>
                        )}

                        {/* Flood zone */}
                        {report.floodZone && (
                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-2">FEMA Flood Zone</div>
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${report.floodZone.sfha ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                Zone {report.floodZone.zone}
                              </span>
                              <span className="text-xs text-slate-600">
                                {report.floodZone.sfha ? 'Special Flood Hazard Area (100-yr floodplain)' : 'Outside Special Flood Hazard Area'}
                              </span>
                            </div>
                            {report.floodZone.zoneSubtype && (
                              <div className="mt-1 text-[11px] text-slate-500">Subtype: {report.floodZone.zoneSubtype}</div>
                            )}
                          </div>
                        )}

                        {/* WQP records summary */}
                        {report.environmentalProfile.wqpRecords.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-2">Water Quality Records (WQP)</div>
                            <div className="text-xs text-slate-600">
                              {report.environmentalProfile.wqpRecords.length} parameter reading(s) from nearby monitoring stations
                            </div>
                          </div>
                        )}

                        {!report.environmentalProfile.attains && !report.environmentalProfile.ejscreen && !report.floodZone && report.environmentalProfile.wqpRecords.length === 0 && (
                          <EmptyState message="No environmental profile data available for this location." />
                        )}
                      </div>
                    </div>
                  );

                  // ── Species & Habitat ─────────────────────────────────────
                  case 'species-habitat': return DS(
                    <div id="section-species-habitat" className="rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                        <Bug className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-bold text-slate-800">Species & Habitat</span>
                        <SourceBadge tier="T3" />
                      </div>
                      <div className="p-4">
                        {report.speciesHabitat.criticalHabitat.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="text-left py-2 pr-3 font-semibold text-slate-600">Species</th>
                                  <th className="text-left py-2 pr-3 font-semibold text-slate-600">Scientific Name</th>
                                  <th className="text-left py-2 pr-3 font-semibold text-slate-600">ESA Status</th>
                                  <th className="text-left py-2 font-semibold text-slate-600">Listing Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.speciesHabitat.criticalHabitat.map((h, i) => (
                                  <tr key={i} className="border-b border-slate-50">
                                    <td className="py-1.5 pr-3 text-slate-800 font-medium">{h.species || '—'}</td>
                                    <td className="py-1.5 pr-3 text-slate-600 italic">{h.scientificName || '—'}</td>
                                    <td className="py-1.5 pr-3">
                                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${h.status?.toLowerCase().includes('endangered') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {h.status || '—'}
                                      </span>
                                    </td>
                                    <td className="py-1.5 text-slate-600">{h.listingDate || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <EmptyState message="No designated critical habitat found within 3 miles." />
                        )}

                        {/* Caveat */}
                        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Important:</strong> Absence of records does NOT confirm absence of species.
                            Critical habitat designations cover only federally listed species and may not include all
                            state-listed species, species of concern, or undiscovered populations. A qualified biologist
                            should be consulted for site-specific assessments.
                          </span>
                        </div>
                      </div>
                    </div>
                  );

                  // ── Contamination & Enforcement ───────────────────────────
                  case 'contamination': return DS(
                    <div id="section-contamination" className="rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-bold text-slate-800">Contamination & Enforcement</span>
                        <SourceBadge tier="T1+T3" />
                      </div>
                      <div className="p-4 space-y-4">
                        {/* Superfund */}
                        <SubSection title="Superfund / NPL Sites" icon={<AlertTriangle className="h-3.5 w-3.5 text-red-500" />} count={report.contamination.superfund.length}>
                          {report.contamination.superfund.length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="text-left py-2 pr-3 font-semibold text-slate-600">Site Name</th>
                                  <th className="text-left py-2 pr-3 font-semibold text-slate-600">Distance</th>
                                  <th className="text-left py-2 pr-3 font-semibold text-slate-600">NPL Status</th>
                                  <th className="text-left py-2 font-semibold text-slate-600">EPA ID</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.contamination.superfund.map((s, i) => (
                                  <tr key={i} className="border-b border-slate-50">
                                    <td className="py-1.5 pr-3 text-slate-800 font-medium">{s.name}</td>
                                    <td className="py-1.5 pr-3 text-slate-600">{s.distanceMi} mi</td>
                                    <td className="py-1.5 pr-3 text-slate-600">{s.nplStatus}</td>
                                    <td className="py-1.5 text-slate-500 font-mono text-[10px]">{s.epaId}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : <EmptyState message="No Superfund sites within 5 miles." />}
                        </SubSection>

                        {/* Brownfields */}
                        <SubSection title="Brownfield Sites" icon={<Factory className="h-3.5 w-3.5 text-amber-500" />} count={report.contamination.brownfields.length}>
                          {report.contamination.brownfields.length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="text-left py-2 pr-3 font-semibold text-slate-600">Site Name</th>
                                  <th className="text-left py-2 pr-3 font-semibold text-slate-600">Distance</th>
                                  <th className="text-left py-2 font-semibold text-slate-600">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.contamination.brownfields.map((b, i) => (
                                  <tr key={i} className="border-b border-slate-50">
                                    <td className="py-1.5 pr-3 text-slate-800 font-medium">{b.name}</td>
                                    <td className="py-1.5 pr-3 text-slate-600">{b.distanceMi} mi</td>
                                    <td className="py-1.5 text-slate-600">{b.status}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : <EmptyState message="No brownfield sites within 5 miles." />}
                        </SubSection>

                        {/* ECHO Violations */}
                        <SubSection title="ECHO Facility Violations" icon={<Shield className="h-3.5 w-3.5 text-orange-500" />} count={report.contamination.echoViolations.length}>
                          {report.contamination.echoViolations.length > 0 ? (
                            <div className="text-xs text-slate-600">
                              {report.contamination.echoFacilities.length} facility/ies, {report.contamination.echoViolations.length} violation(s) nearby
                            </div>
                          ) : <EmptyState message="No ECHO violations nearby." />}
                        </SubSection>

                        {/* TRI */}
                        <SubSection title="Toxic Release Inventory" icon={<Droplets className="h-3.5 w-3.5 text-purple-500" />} count={report.contamination.triReleases.length}>
                          {report.contamination.triReleases.length > 0 ? (
                            <div className="text-xs text-slate-600">
                              {report.contamination.triReleases.length} TRI facility/ies reporting toxic releases nearby
                            </div>
                          ) : <EmptyState message="No TRI facilities nearby." />}
                        </SubSection>

                        {report.contamination.pfasDetections > 0 && (
                          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span><strong>{report.contamination.pfasDetections}</strong> PFAS detection(s) in nearby water systems</span>
                          </div>
                        )}

                        {/* Caveat */}
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                          <span>
                            Contamination data is sourced from EPA federal databases and may not include all state-level
                            cleanup programs, underground storage tanks, or emerging contaminant investigations.
                          </span>
                        </div>
                      </div>
                    </div>
                  );

                  // ── Regulatory Context ────────────────────────────────────
                  case 'regulatory': return DS(
                    <div id="section-regulatory" className="rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                        <Scale className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-bold text-slate-800">Regulatory Context</span>
                        <SourceBadge tier="T1" />
                      </div>
                      <div className="p-4 space-y-4">
                        {/* ICIS Permits */}
                        <SubSection title="NPDES Permits (ICIS)" icon={<FileText className="h-3.5 w-3.5 text-blue-500" />} count={report.regulatory.icisPermits.length}>
                          {report.regulatory.icisPermits.length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="text-left py-2 pr-3 font-semibold text-slate-600">Permit #</th>
                                  <th className="text-left py-2 pr-3 font-semibold text-slate-600">Facility</th>
                                  <th className="text-left py-2 font-semibold text-slate-600">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.regulatory.icisPermits.slice(0, 10).map((p, i) => (
                                  <tr key={i} className="border-b border-slate-50">
                                    <td className="py-1.5 pr-3 text-slate-800 font-mono text-[10px]">{p.permit || '—'}</td>
                                    <td className="py-1.5 pr-3 text-slate-600">{p.facility || '—'}</td>
                                    <td className="py-1.5 text-slate-600">{p.status || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : <EmptyState message="No NPDES permits nearby." />}
                        </SubSection>

                        {/* ICIS Violations */}
                        <SubSection title="NPDES Violations" icon={<AlertTriangle className="h-3.5 w-3.5 text-orange-500" />} count={report.regulatory.icisViolations.length}>
                          {report.regulatory.icisViolations.length > 0 ? (
                            <div className="text-xs text-slate-600">
                              {report.regulatory.icisViolations.length} violation(s) at nearby permitted facilities
                            </div>
                          ) : <EmptyState message="No NPDES violations nearby." />}
                        </SubSection>

                        {/* SDWIS Systems */}
                        <SubSection title="Drinking Water Systems (SDWIS)" icon={<Droplets className="h-3.5 w-3.5 text-cyan-500" />} count={report.regulatory.sdwisSystems.length}>
                          {report.regulatory.sdwisSystems.length > 0 ? (
                            <div className="text-xs text-slate-600">
                              {report.regulatory.sdwisSystems.length} public water system(s) nearby
                              {report.regulatory.sdwisViolations.length > 0 && (
                                <span className="text-red-600 font-semibold"> — {report.regulatory.sdwisViolations.length} violation(s)</span>
                              )}
                            </div>
                          ) : <EmptyState message="No SDWIS systems nearby." />}
                        </SubSection>
                      </div>
                    </div>
                  );

                  // ── PIN Water Score ────────────────────────────────────────
                  case 'water-score': return DS(
                    <div id="section-water-score" className="rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-bold text-slate-800">PIN Water Score</span>
                        <SourceBadge tier="T1+T2" />
                      </div>
                      <div className="p-4">
                        {report.waterScore ? (
                          <WaterScoreDisplay score={report.waterScore} />
                        ) : (
                          <EmptyState message="Insufficient data to compute a water risk score for this location." />
                        )}
                      </div>
                    </div>
                  );

                  // ── Disclaimer ────────────────────────────────────────────
                  case 'disclaimer': return DS(
                    <div id="section-disclaimer">
                      <PlatformDisclaimer />
                    </div>
                  );

                  default: return null;
                }
              })}
              </div>
              );
            }}
            </LayoutEditor>
          </div>

          {/* ── Risk Summary Card (sidebar) ── */}
          <div className="lg:w-[320px] lg:flex-shrink-0">
            <div className="lg:sticky lg:top-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button
                onClick={() => setRiskOpen(!riskOpen)}
                className="w-full p-4 flex items-center justify-between border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold text-slate-800">Risk Summary</span>
                </div>
                {riskOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {riskOpen && (
                <div className="p-4 space-y-2">
                  {/* Composite score badge */}
                  {report.waterScore?.composite && (
                    <div className="flex items-center justify-center gap-3 pb-3 border-b border-slate-100 mb-3">
                      <div className={`text-4xl font-black ${GRADE_COLORS[report.waterScore.composite.letter] || 'text-slate-600'}`}>
                        {report.waterScore.composite.letter}
                      </div>
                      <div>
                        <div className="text-lg font-bold text-slate-800">{report.waterScore.composite.score}/100</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">Composite Score</div>
                      </div>
                    </div>
                  )}

                  {/* Traffic-light indicators */}
                  {riskIndicators.map((ind) => {
                    const colors = RISK_COLORS[ind.level];
                    return (
                      <button
                        key={ind.label}
                        onClick={() => scrollToPanel(ind.panelId)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${colors.bg} hover:opacity-80 transition-opacity text-left`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-semibold ${colors.text}`}>{ind.label}</div>
                          <div className="text-[10px] text-slate-500 truncate">{ind.detail}</div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Monitor button */}
                  <button
                    onClick={() => alert('Coming soon — monitor this site for changes.')}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Monitor This Site
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state before search ── */}
      {!report && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">Enter a location to begin</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            Search by address, ZIP code, or coordinates to generate a comprehensive environmental and regulatory dossier.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-xs text-slate-800 font-medium truncate">{value}</div>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-center">
      <div className={`text-lg font-bold ${color || 'text-slate-800'}`}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function EJMetric({ label, value, suffix }: { label: string; value: number | null | undefined; suffix: string }) {
  if (value == null) return null;
  const color = value >= 80 ? 'text-red-600' : value >= 50 ? 'text-amber-600' : 'text-green-600';
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
      <div className={`text-sm font-bold ${color}`}>{Math.round(value)}<span className="text-[10px] text-slate-400 ml-0.5">{suffix}</span></div>
      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

function SourceBadge({ tier }: { tier: string }) {
  return (
    <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
      {tier}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
      <Info className="h-3.5 w-3.5 flex-shrink-0" />
      {message}
    </div>
  );
}

function SubSection({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <span className="text-[10px] text-slate-400">({count})</span>
      </div>
      {children}
    </div>
  );
}

function WaterScoreDisplay({ score }: { score: WaterRiskScoreResult }) {
  const CATEGORY_LABELS: Record<CategoryKey, string> = {
    waterQuality: 'Water Quality',
    infrastructure: 'Infrastructure',
    compliance: 'Compliance',
    contamination: 'Contamination',
    environmentalJustice: 'Environmental Justice',
  };

  return (
    <div className="space-y-4">
      {/* Composite gauge */}
      <div className="flex items-center justify-center gap-6">
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="50" fill="none"
              stroke={score.composite.color}
              strokeWidth="10"
              strokeDasharray={`${(score.composite.score / 100) * 314} 314`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-black ${GRADE_COLORS[score.composite.letter] || 'text-slate-700'}`}>
              {score.composite.letter}
            </span>
            <span className="text-xs text-slate-500">{score.composite.score}/100</span>
          </div>
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800">PIN Water Risk Score</div>
          <div className="text-xs text-slate-500 mt-1">
            {Math.round(score.composite.confidence * 100)}% data confidence
          </div>
          <div className="text-xs text-slate-500">
            {score.dataSources.length} data source(s)
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {(Object.entries(score.categories) as [CategoryKey, typeof score.categories[CategoryKey]][]).map(([key, cat]) => (
          <div key={key} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                {CATEGORY_LABELS[key]}
              </span>
              <span className={`text-sm font-bold ${cat.score >= 70 ? 'text-green-600' : cat.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {cat.score}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${cat.score >= 70 ? 'bg-green-500' : cat.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${cat.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Key observations */}
      {score.details.observations.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1.5">Key Observations</div>
          <div className="space-y-1">
            {score.details.observations.slice(0, 5).map((obs, i) => (
              <div key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>{obs.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
