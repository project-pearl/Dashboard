'use client';

import React, { Suspense, useState, useCallback } from 'react';
import { DashboardSection } from '@/components/DashboardSection';
import { useLensParam } from '@/lib/useLensParam';
import type { WaterRiskScoreResult, CategoryKey } from '@/lib/waterRiskScore';
import {
  MapPin,
  Search,
  AlertTriangle,
  FileCheck,
  Shield,
  Droplets,
  Scale,
  Activity,
  Download,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ─── Lens types ──────────────────────────────────────────────────────────────

type ViewLens =
  | 'overview'
  | 'developer'
  | 'real-estate'
  | 'insurance'
  | 'legal'
  | 'consultant'
  | 'lender'
  | 'appraiser'
  | 'title-company'
  | 'construction'
  | 'ma-due-diligence'
  | 'energy-utilities'
  | 'private-equity'
  | 'corporate-facilities'
  | 'municipal-econ-dev'
  | 'brownfield'
  | 'mining';

// ─── Lens label config ──────────────────────────────────────────────────────

const LENS_LABELS: Record<ViewLens, { risk: string; regulatory: string; ej: string; trends: string; permits: string }> = {
  overview:              { risk: 'Waterbody Risk Profile',      regulatory: 'Regulatory Exposure',        ej: 'EJ Vulnerability Screen',     trends: 'Contamination Screen',         permits: 'Permit Constraints'           },
  developer:             { risk: 'Site Water Risk',             regulatory: 'Development Regulatory Risk',ej: 'EJ Screening for Permits',    trends: 'Contamination Screen',         permits: 'Stormwater Permit Rules'      },
  'real-estate':         { risk: 'Property Water Risk',         regulatory: 'Disclosure Obligations',     ej: 'Environmental Justice Flags',  trends: 'Contamination Screen',         permits: 'Discharge Restrictions'       },
  insurance:             { risk: 'Underwriting Risk Profile',   regulatory: 'Regulatory Exposure',        ej: 'EJ Loss Exposure',             trends: 'Contamination Screen',         permits: 'Permit-Driven Exclusions'     },
  legal:                 { risk: 'Litigation Risk Profile',     regulatory: 'Regulatory History',         ej: 'EJ Liability Factors',         trends: 'Contamination Screen',         permits: 'Permit Violations & Orders'   },
  consultant:            { risk: 'Site Assessment Profile',     regulatory: 'Regulatory Landscape',       ej: 'EJ Screening Summary',         trends: 'Contamination Screen',         permits: 'Applicable Permits'           },
  lender:                { risk: 'Collateral Risk Profile',     regulatory: 'Regulatory Encumbrances',    ej: 'EJ Community Risk',            trends: 'Contamination Screen',         permits: 'Permit Compliance Status'     },
  appraiser:             { risk: 'Environmental Risk Factor',   regulatory: 'Regulatory Overlay',         ej: 'EJ Proximity Flags',           trends: 'Contamination Screen',         permits: 'Active Permits & Limits'      },
  'title-company':       { risk: 'Environmental Encumbrances',  regulatory: 'Regulatory Liens & Orders',  ej: 'EJ Area Designation',          trends: 'Contamination Screen',         permits: 'Permit Attachments'           },
  construction:          { risk: 'Site Water Conditions',       regulatory: 'Construction Permits',       ej: 'EJ Compliance Requirements',   trends: 'Contamination Screen',         permits: 'Stormwater & Erosion Permits' },
  'ma-due-diligence':    { risk: 'Target Water Risk',           regulatory: 'Regulatory Liabilities',     ej: 'EJ Portfolio Exposure',        trends: 'Contamination Screen',         permits: 'Permit Transfer Issues'       },
  'energy-utilities':    { risk: 'Water Supply Risk',           regulatory: 'Water Use Regulations',      ej: 'EJ Community Obligations',     trends: 'Contamination Screen',         permits: 'Withdrawal & Discharge Permits'},
  'private-equity':      { risk: 'Portfolio Water Risk',        regulatory: 'Regulatory Compliance Risk', ej: 'EJ Investment Screening',      trends: 'Contamination Screen',         permits: 'Permit Compliance Summary'    },
  'corporate-facilities':{ risk: 'Facility Water Risk',         regulatory: 'Operational Regulations',    ej: 'EJ Community Relations',       trends: 'Contamination Screen',         permits: 'Operating Permits'            },
  'municipal-econ-dev':  { risk: 'Site Suitability Risk',       regulatory: 'Development Regulations',    ej: 'EJ Community Impact',          trends: 'Contamination Screen',         permits: 'Zoning & Water Permits'       },
  brownfield:            { risk: 'Contamination Risk Profile',  regulatory: 'Cleanup Obligations',        ej: 'EJ Brownfield Screening',      trends: 'Contamination Screen',         permits: 'Cleanup & Reuse Permits'      },
  mining:                { risk: 'Mine Drainage Risk',          regulatory: 'Mining Regulations',         ej: 'EJ Mining Community Impact',   trends: 'Contamination Screen',         permits: 'Mining & Discharge Permits'   },
};

// ─── Types for API responses ─────────────────────────────────────────────────

interface LocationData {
  location: { lat: number; lng: number; state: string; label: string; zip?: string };
  sources: {
    wqp: { records: Array<{ key: string; char: string; val: number; unit: string; date: string; name: string }> } | null;
    sdwis: { systems: Array<{ pwsid: string; name: string; type: string; population: number; sourceWater: string }>; violations: Array<{ pwsid: string; contaminant: string; rule: string; isHealthBased: boolean; compliancePeriod: string }>; enforcement: unknown[] } | null;
    icis: { permits: Array<{ permit: string; facility: string; status: string; type: string; expiration: string }>; violations: Array<{ permit: string; desc: string; date: string; severity: string }> } | null;
    echo: { facilities: Array<{ name: string; registryId: string }>; violations: Array<{ name: string; violationType: string; pollutant: string; qtrsInNc: number }> } | null;
    pfas: { results: Array<{ facilityName: string; contaminant: string; resultValue: number | null; detected: boolean; sampleDate: string }> } | null;
    tri: { facilities: Array<{ facilityName: string; totalReleases: number; topChemicals: string[] }> } | null;
    ejscreen: Record<string, unknown> | null;
    attains: { impaired: number; total: number; topCauses: string[] } | null;
  };
  generatedAt: string;
}

interface ScoreData extends WaterRiskScoreResult {
  location: { lat: number; lng: number; state: string; label: string; huc8?: string; hucDistance?: number };
  generatedAt: string;
}

type FetchState = 'idle' | 'loading' | 'loaded' | 'error';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectInputType(input: string): string {
  const trimmed = input.trim();
  if (/^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(trimmed)) {
    const [lat, lng] = trimmed.split(',').map(s => s.trim());
    return `lat=${lat}&lng=${lng}`;
  }
  if (/^\d{5}(-\d{4})?$/.test(trimmed)) {
    return `zip=${trimmed.slice(0, 5)}`;
  }
  return `address=${encodeURIComponent(trimmed)}`;
}

function conditionLabel(score: number): string {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

function conditionColor(score: number): string {
  if (score >= 80) return 'text-green-700';
  if (score >= 60) return 'text-yellow-700';
  if (score >= 40) return 'text-orange-700';
  return 'text-red-700';
}

function ringColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#ca8a04';
  if (score >= 40) return '#ea580c';
  return '#dc2626';
}

function parseEj(data: Record<string, unknown> | null): Array<{ label: string; value: string; unit: string; flagged: boolean }> {
  if (!data) return [];
  const raw = (data.RAW_DATA as Record<string, unknown>) || data;
  const items: Array<{ label: string; value: string; unit: string; flagged: boolean }> = [];

  const ejIdx = Number(raw['EJINDEX'] || raw['P_LDPNT_D2'] || 0);
  if (ejIdx) items.push({ label: 'EJ Index', value: `${Math.round(ejIdx)}`, unit: 'pctile', flagged: ejIdx > 80 });

  const lowInc = Number(raw['LOWINCPCT'] || raw['P_LWINCPCT'] || 0);
  if (lowInc) items.push({ label: 'Low Income', value: `${Math.round(lowInc * 100)}`, unit: '%', flagged: lowInc > 0.4 });

  const minority = Number(raw['MINORPCT'] || raw['P_MINORITY'] || 0);
  if (minority) items.push({ label: 'Minority', value: `${Math.round(minority * 100)}`, unit: '%', flagged: minority > 0.8 });

  const ww = Number(raw['P_DWATER'] || raw['D_DWATER_2'] || 0);
  if (ww) items.push({ label: 'Wastewater', value: `${Math.round(ww)}`, unit: 'pctile', flagged: ww > 80 });

  return items;
}

// ─── Score Gauge SVG ──────────────────────────────────────────────────────────

function ScoreGauge({ score, letter }: { score: number; letter: string }) {
  const radius = 56;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = ringColor(score);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={140} height={140} className="-rotate-90">
        <circle cx={70} cy={70} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={70} cy={70} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-800">{score}</span>
        <span className="text-sm font-semibold" style={{ color }}>{letter}</span>
      </div>
    </div>
  );
}

// ─── Category KPI Card ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  waterQuality: 'Water Quality',
  infrastructure: 'Infrastructure',
  compliance: 'Compliance',
  contamination: 'Contamination',
  environmentalJustice: 'Env. Justice',
};

function CategoryCard({ catKey, cat }: { catKey: CategoryKey; cat: WaterRiskScoreResult['categories'][CategoryKey] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-3 py-3 text-center hover:bg-slate-50 transition-colors">
        <div className="text-xl font-bold text-slate-800">{cat.score}</div>
        <div className={`text-[10px] font-semibold uppercase tracking-wider ${conditionColor(cat.score)}`}>
          {conditionLabel(cat.score)}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">{CATEGORY_LABELS[catKey]}</div>
        {open ? <ChevronDown className="w-3 h-3 mx-auto mt-1 text-slate-400" /> : <ChevronRight className="w-3 h-3 mx-auto mt-1 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 py-2 space-y-1">
          {cat.factors.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="text-slate-600 truncate mr-2">{f.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-medium text-slate-700">{f.value}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  f.impact === 'positive' ? 'bg-green-500' :
                  f.impact === 'negative' ? 'bg-red-500' : 'bg-slate-300'
                }`} />
              </div>
            </div>
          ))}
          <div className="text-[10px] text-slate-400 pt-1 flex items-center gap-1">
            <Info className="w-2.5 h-2.5" /> Confidence: {cat.confidence}%
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

function SiteIntelligenceContent() {
  const [lens] = useLensParam<ViewLens>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [error, setError] = useState('');

  const labels = LENS_LABELS[lens] || LENS_LABELS.overview;

  const doSearch = useCallback(async (query: string) => {
    setFetchState('loading');
    setError('');
    const qs = detectInputType(query);
    try {
      const [scoreRes, locRes] = await Promise.allSettled([
        fetch(`/api/water-risk-score?${qs}`).then(r => {
          if (!r.ok) throw new Error(`Score API: ${r.status}`);
          return r.json() as Promise<ScoreData>;
        }),
        fetch(`/api/location-report?${qs}`).then(r => {
          if (!r.ok) throw new Error(`Location API: ${r.status}`);
          return r.json() as Promise<LocationData>;
        }),
      ]);
      if (scoreRes.status === 'fulfilled') setScoreData(scoreRes.value);
      if (locRes.status === 'fulfilled') setLocationData(locRes.value);
      if (scoreRes.status === 'rejected' && locRes.status === 'rejected') {
        throw new Error('Failed to fetch data. Check the address and try again.');
      }
      setFetchState('loaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setFetchState('error');
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) doSearch(searchQuery);
  };

  const handleClear = () => {
    setFetchState('idle');
    setSearchQuery('');
    setScoreData(null);
    setLocationData(null);
    setError('');
  };

  const handleExportPdf = async () => {
    const el = document.getElementById('site-intelligence-report');
    if (!el) return;
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({
        margin: [0.3, 0.4, 0.5, 0.4],
        filename: `Site_Intelligence_${dateStr}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 1000 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.risk-card'] },
      }).from(el).save();
    } catch { /* silent */ }
  };

  // Derived data from location report
  const src = locationData?.sources;
  const attains = src?.attains;
  const ejItems = parseEj(src?.ejscreen ?? null);
  const wqpRecords = src?.wqp?.records ?? [];
  const sdwisSystems = src?.sdwis?.systems ?? [];
  const sdwisViolations = src?.sdwis?.violations ?? [];
  const icisPermits = src?.icis?.permits ?? [];
  const icisViolations = src?.icis?.violations ?? [];

  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Location Search Header ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Site Intelligence</h1>
              <p className="text-xs text-slate-500">Enter an address, ZIP code, or coordinates to assess water quality risk at any location</p>
            </div>
          </div>
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="123 Main St, Baltimore, MD 21201  or  39.2904, -76.6122  or  21201"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
            </div>
            <button
              type="submit"
              disabled={fetchState === 'loading'}
              className="px-5 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {fetchState === 'loading' ? 'Analyzing...' : 'Assess Site'}
            </button>
          </form>
          {error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </div>
          )}
        </div>

        {/* ── Loading state ── */}
        {fetchState === 'loading' && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <Droplets className="w-10 h-10 text-blue-500 mx-auto mb-4 animate-pulse" />
            <h2 className="text-base font-semibold text-slate-700 mb-1">Analyzing Site</h2>
            <p className="text-sm text-slate-500">Querying EPA databases, HUC-8 indices, and environmental data...</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {fetchState === 'idle' && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Search for a location to begin</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Enter any US address, ZIP code, or lat/lng coordinates above. PIN will pull waterbody assessments,
              regulatory data, EJ screening, and permit information for that location.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['Baltimore, MD', 'Flint, MI', '21201', '39.2904, -76.6122'].map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setSearchQuery(ex); doSearch(ex); }}
                  className="px-3 py-1.5 rounded-full border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {fetchState === 'loaded' && (scoreData || locationData) && (
          <div id="site-intelligence-report" className="space-y-6">
            {/* Location summary strip */}
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-sm font-semibold text-slate-800">
                    {scoreData?.location.label || locationData?.location.label || searchQuery}
                  </span>
                  {scoreData?.location.huc8 && (
                    <span className="text-xs text-slate-400 ml-2">HUC-8: {scoreData.location.huc8}</span>
                  )}
                  {(scoreData?.location.state || locationData?.location.state) && (
                    <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-500">
                      {scoreData?.location.state || locationData?.location.state}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleExportPdf} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors">
                  <Download className="w-3 h-3" /> PDF
                </button>
                <button onClick={handleClear} className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
                  Clear
                </button>
              </div>
            </div>

            {/* ── Water Risk Score Hero ── */}
            {scoreData && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Gauge */}
                  <div className="text-center shrink-0">
                    <ScoreGauge score={scoreData.composite.score} letter={scoreData.composite.letter} />
                    <div className="mt-2">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${scoreData.composite.bgColor} ${scoreData.composite.color}`}>
                        {conditionLabel(scoreData.composite.score)} Condition
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Confidence: {scoreData.composite.confidence}%</p>
                  </div>

                  {/* Category KPI grid */}
                  <div className="flex-1 w-full">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Category Breakdown</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map(key => (
                        <CategoryCard key={key} catKey={key} cat={scoreData.categories[key]} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Low confidence banner */}
                {scoreData.composite.confidence < 40 && (
                  <div className="mt-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Limited data available. Score has been adjusted to reflect uncertainty.
                  </div>
                )}

                {/* Observations */}
                {scoreData.details.observations.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {scoreData.details.observations.slice(0, 3).map((obs, i) => (
                      <div key={i} className={`text-xs px-3 py-2 rounded-lg border-l-3 ${
                        obs.severity === 'critical' ? 'bg-red-50 border-l-red-500 text-red-700' :
                        obs.severity === 'warning' ? 'bg-amber-50 border-l-amber-500 text-amber-700' :
                        'bg-blue-50 border-l-blue-500 text-blue-700'
                      }`}>
                        <span className="mr-1.5">{obs.icon}</span>
                        {obs.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Card 1: Risk Profile (ATTAINS + WQP) ── */}
            <DashboardSection title={labels.risk} subtitle="Impairment status and water quality data for nearby waterbodies">
              {attains ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-medium text-slate-700">Waterbody Assessment:</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      attains.impaired > attains.total * 0.5 ? 'bg-red-50 text-red-700 border border-red-200' :
                      attains.impaired > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-green-50 text-green-700 border border-green-200'
                    }`}>
                      {attains.impaired} of {attains.total} impaired
                    </span>
                  </div>
                  {attains.topCauses.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Top Impairment Causes</div>
                      {attains.topCauses.slice(0, 5).map((cause, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-4 py-2.5">
                          <Droplets className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-sm text-slate-700">{cause}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {wqpRecords.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Recent Monitoring Data</div>
                      <div className="overflow-x-auto -mx-5">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-2 px-4 text-slate-500 font-medium text-xs">Parameter</th>
                              <th className="text-left py-2 px-4 text-slate-500 font-medium text-xs">Value</th>
                              <th className="text-left py-2 px-4 text-slate-500 font-medium text-xs">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wqpRecords.slice(0, 8).map((r, i) => (
                              <tr key={i} className="border-b border-slate-50">
                                <td className="py-2 px-4 text-slate-700 font-medium">{r.key || r.char}</td>
                                <td className="py-2 px-4 text-slate-600">{r.val} {r.unit}</td>
                                <td className="py-2 px-4 text-slate-400 text-xs">{r.date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : wqpRecords.length > 0 ? (
                <div>
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Recent Monitoring Data</div>
                  <div className="overflow-x-auto -mx-5">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-4 text-slate-500 font-medium text-xs">Parameter</th>
                          <th className="text-left py-2 px-4 text-slate-500 font-medium text-xs">Value</th>
                          <th className="text-left py-2 px-4 text-slate-500 font-medium text-xs">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wqpRecords.slice(0, 8).map((r, i) => (
                          <tr key={i} className="border-b border-slate-50">
                            <td className="py-2 px-4 text-slate-700 font-medium">{r.key || r.char}</td>
                            <td className="py-2 px-4 text-slate-600">{r.val} {r.unit}</td>
                            <td className="py-2 px-4 text-slate-400 text-xs">{r.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No water quality monitoring data available for this location.</p>
              )}
            </DashboardSection>

            {/* ── Card 2: Regulatory Exposure (SDWIS) ── */}
            <DashboardSection title={labels.regulatory} subtitle="Drinking water systems, violations, and enforcement at this location">
              <div className="space-y-4">
                {sdwisSystems.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Drinking Water Systems</div>
                    <div className="space-y-2">
                      {sdwisSystems.slice(0, 5).map((sys, i) => (
                        <div key={i} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-slate-800">{sys.name}</div>
                            <div className="text-[10px] text-slate-400">{sys.pwsid} · {sys.type} · {sys.sourceWater} · Pop: {sys.population?.toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {sdwisViolations.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">SDWIS Violations</div>
                    <div className="space-y-2">
                      {sdwisViolations.slice(0, 5).map((v, i) => (
                        <div key={i} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className={`w-4 h-4 ${v.isHealthBased ? 'text-red-500' : 'text-amber-500'}`} />
                            <div>
                              <div className="text-sm font-medium text-slate-800">{v.contaminant}</div>
                              <div className="text-[10px] text-slate-400">{v.rule} · {v.compliancePeriod}</div>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            v.isHealthBased ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {v.isHealthBased ? 'Health-Based' : 'Monitoring'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {sdwisSystems.length === 0 && sdwisViolations.length === 0 && (
                  <p className="text-sm text-slate-500">No drinking water system data available for this location.</p>
                )}
              </div>
            </DashboardSection>

            {/* ── Card 3: EJ Vulnerability Screen ── */}
            <DashboardSection title={labels.ej} subtitle="Environmental justice indicators for surrounding census tracts">
              {ejItems.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {ejItems.map((m) => (
                      <div key={m.label} className={`rounded-lg border p-4 text-center ${
                        m.flagged ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
                      }`}>
                        <div className={`text-xl font-bold ${m.flagged ? 'text-amber-700' : 'text-slate-800'}`}>
                          {m.value}<span className="text-xs font-normal ml-0.5">{m.unit}</span>
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{m.label}</div>
                        {m.flagged && <AlertTriangle className="w-3 h-3 text-amber-500 mx-auto mt-1" />}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3">
                    Source: EPA EJScreen. High percentiles indicate elevated environmental justice concern.
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">No EJScreen data available for this location.</p>
              )}
            </DashboardSection>

            {/* ── Card 4: Contamination (PFAS + TRI + ECHO) ── */}
            <DashboardSection title={labels.trends} subtitle="PFAS detections, toxic releases, and enforcement actions nearby">
              <div className="space-y-4">
                {src?.pfas && src.pfas.results.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">PFAS Detections</div>
                    <div className="space-y-2">
                      {src.pfas.results.slice(0, 5).map((r, i) => (
                        <div key={i} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Activity className={`w-4 h-4 ${r.detected ? 'text-red-500' : 'text-green-500'}`} />
                            <div>
                              <div className="text-sm font-medium text-slate-800">{r.contaminant}</div>
                              <div className="text-[10px] text-slate-400">{r.facilityName} · {r.sampleDate}</div>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.detected ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                          }`}>
                            {r.detected ? `${r.resultValue ?? 'Detected'}` : 'Not Detected'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {src?.tri && (src.tri as { facilities: Array<{ facilityName: string; totalReleases: number; topChemicals: string[] }> }).facilities?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Toxic Release Inventory</div>
                    <div className="space-y-2">
                      {(src.tri as { facilities: Array<{ facilityName: string; totalReleases: number; topChemicals: string[] }> }).facilities.slice(0, 5).map((f, i) => (
                        <div key={i} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-slate-800">{f.facilityName}</div>
                            <div className="text-[10px] text-slate-400">{f.topChemicals?.slice(0, 3).join(', ')}</div>
                          </div>
                          <span className="text-xs text-slate-600 font-medium">{f.totalReleases?.toLocaleString()} lbs</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {src?.echo && src.echo.violations.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">ECHO Violations</div>
                    <div className="space-y-2">
                      {src.echo.violations.slice(0, 5).map((v, i) => (
                        <div key={i} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-slate-800">{v.name}</div>
                            <div className="text-[10px] text-slate-400">{v.violationType} · {v.pollutant}</div>
                          </div>
                          <span className="text-xs text-slate-500">{v.qtrsInNc} qtrs non-compliant</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(!src?.pfas || src.pfas.results.length === 0) &&
                 (!src?.echo || src.echo.violations.length === 0) && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3 border border-green-200">
                    <Shield className="w-4 h-4" />
                    No contamination flags detected in nearby monitoring data.
                  </div>
                )}
              </div>
            </DashboardSection>

            {/* ── Card 5: Permit Constraints (ICIS) ── */}
            <DashboardSection title={labels.permits} subtitle="NPDES permits and discharge compliance at this location">
              {icisPermits.length > 0 ? (
                <>
                  <div className="overflow-x-auto -mx-5">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Type</th>
                          <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Permit ID</th>
                          <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Facility</th>
                          <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Status</th>
                          <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Expiry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {icisPermits.slice(0, 10).map((p, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-4 text-slate-600 text-xs">{p.type}</td>
                            <td className="py-2.5 px-4 text-blue-600 font-mono text-xs">{p.permit}</td>
                            <td className="py-2.5 px-4 text-slate-800 font-medium text-xs">{p.facility}</td>
                            <td className="py-2.5 px-4">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                p.status?.toLowerCase().includes('effect') ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 text-xs">{p.expiration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {icisViolations.length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                        Permit Violations ({icisViolations.length})
                      </div>
                      <div className="space-y-2">
                        {icisViolations.slice(0, 5).map((v, i) => (
                          <div key={i} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-4 py-3">
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <div>
                                <div className="text-sm font-medium text-slate-800">{v.desc}</div>
                                <div className="text-[10px] text-slate-400">{v.permit} · {v.date}</div>
                              </div>
                            </div>
                            <span className="text-xs text-slate-500">{v.severity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-600">No NPDES permits found in the immediate vicinity of this location.</span>
                  </div>
                </div>
              )}
            </DashboardSection>

            {/* Data source footer */}
            <div className="text-[10px] text-slate-400 px-1">
              {scoreData?.dataSources && (
                <p>Data: {scoreData.dataSources.join(' | ')}</p>
              )}
              <p className="mt-1">
                Generated {new Date(scoreData?.generatedAt || locationData?.generatedAt || '').toLocaleString()}.
                Scores are estimates based on publicly available data.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SiteIntelligenceCenter() {
  return (
    <Suspense fallback={null}>
      <SiteIntelligenceContent />
    </Suspense>
  );
}
