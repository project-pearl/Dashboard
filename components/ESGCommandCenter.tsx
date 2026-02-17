// components/ESGCommandCenter.tsx
// Corporate ESG Command Center — portfolio water risk, disclosure readiness, impact reporting
// Architecture: SCC lens system + ESG-specific sections + existing ESG components from page.tsx

'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { feature } from 'topojson-client';
import statesTopo from 'us-atlas/states-10m.json';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Droplets, BarChart3, Shield, TrendingUp, TrendingDown, AlertTriangle, ChevronDown,
  Minus, MapPin, Building2, FileText, Award, Globe, Leaf, Users, Target,
  DollarSign, Eye, Lock, Activity, ArrowRight, ChevronRight, Search, Filter,
  Download, ExternalLink, Star, Zap, Heart, Scale, X, LogOut
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertLevel = 'high' | 'medium' | 'low' | 'none';

type FacilityRow = {
  id: string;
  name: string;
  state: string;
  type: 'manufacturing' | 'office' | 'warehouse' | 'datacenter' | 'retail' | 'other';
  alertLevel: AlertLevel;
  activeAlerts: number;
  lastUpdatedISO: string;
  status: 'monitored' | 'assessed' | 'unmonitored';
  dataSourceCount: number;
  waterRiskScore: number;    // 0-100, higher = more risk
  attainsId?: string;
  lat?: number;
  lon?: number;
};

type ESGLens = 'overview' | 'disclosure' | 'risk' | 'impact' | 'compliance';

type LensConfig = {
  label: string;
  description: string;
  icon: any;
  showMap: boolean;
  showImpact: boolean;
  showDisclosure: boolean;
  showRisk: boolean;
  showCompliance: boolean;
  showBenchmark: boolean;
  showGrants: boolean;
  showBrand: boolean;
  showShareholder: boolean;
};

const LENS_CONFIG: Record<ESGLens, LensConfig> = {
  overview: {
    label: 'Executive Overview',
    description: 'Portfolio-level ESG summary for leadership',
    icon: Building2,
    showMap: true, showImpact: true, showDisclosure: true, showRisk: true,
    showCompliance: true, showBenchmark: true, showGrants: false, showBrand: true, showShareholder: true,
  },
  disclosure: {
    label: 'Disclosure & Reporting',
    description: 'GRI, SASB, CDP, TCFD framework readiness',
    icon: FileText,
    showMap: false, showImpact: true, showDisclosure: true, showRisk: false,
    showCompliance: true, showBenchmark: false, showGrants: false, showBrand: false, showShareholder: true,
  },
  risk: {
    label: 'Water Risk Portfolio',
    description: 'Facility-level water stress & impairment exposure',
    icon: AlertTriangle,
    showMap: true, showImpact: false, showDisclosure: false, showRisk: true,
    showCompliance: true, showBenchmark: true, showGrants: false, showBrand: false, showShareholder: false,
  },
  impact: {
    label: 'Environmental Impact',
    description: 'Measured outcomes & ecosystem restoration metrics',
    icon: Leaf,
    showMap: true, showImpact: true, showDisclosure: false, showRisk: false,
    showCompliance: false, showBenchmark: true, showGrants: true, showBrand: true, showShareholder: false,
  },
  compliance: {
    label: 'Regulatory Compliance',
    description: 'Permit status, violations, enforcement exposure',
    icon: Shield,
    showMap: true, showImpact: false, showDisclosure: false, showRisk: true,
    showCompliance: true, showBenchmark: false, showGrants: true, showBrand: false, showShareholder: false,
  },
};

// ─── Overlay types for map ───────────────────────────────────────────────────

type OverlayId = 'waterrisk' | 'compliance' | 'impact';

const OVERLAYS: { id: OverlayId; label: string; description: string; icon: any }[] = [
  { id: 'waterrisk', label: 'Water Risk', description: 'Facility water stress exposure from ATTAINS & WRI Aqueduct', icon: Droplets },
  { id: 'compliance', label: 'Compliance Status', description: 'EPA ECHO violations & permit status', icon: Shield },
  { id: 'impact', label: 'PEARL Impact', description: 'Active treatment performance by facility', icon: Leaf },
];

function getMarkerColor(overlay: OverlayId, f: FacilityRow): string {
  if (overlay === 'waterrisk') {
    return f.waterRiskScore >= 70 ? '#ef4444' :
           f.waterRiskScore >= 40 ? '#f59e0b' :
           f.waterRiskScore >= 20 ? '#eab308' : '#22c55e';
  }
  if (overlay === 'compliance') {
    return f.alertLevel === 'high' ? '#ef4444' :
           f.alertLevel === 'medium' ? '#f59e0b' :
           f.alertLevel === 'low' ? '#eab308' : '#22c55e';
  }
  // impact: monitored vs not
  if (f.status === 'monitored') return '#166534';
  if (f.status === 'assessed') return '#f59e0b';
  return '#9ca3af';
}

// ─── ESG Disclosure Frameworks ───────────────────────────────────────────────

interface DisclosureFramework {
  id: string;
  name: string;
  fullName: string;
  relevantMetrics: string[];
  status: 'ready' | 'partial' | 'gap';
  coverage: number; // 0-100%
}

const ESG_FRAMEWORKS: DisclosureFramework[] = [
  {
    id: 'gri', name: 'GRI', fullName: 'Global Reporting Initiative',
    relevantMetrics: ['GRI 303: Water & Effluents', 'GRI 304: Biodiversity', 'GRI 306: Waste', 'GRI 413: Local Communities'],
    status: 'partial', coverage: 65,
  },
  {
    id: 'sasb', name: 'SASB', fullName: 'Sustainability Accounting Standards Board',
    relevantMetrics: ['Water Management', 'Ecological Impacts', 'Waste & Hazardous Materials'],
    status: 'partial', coverage: 55,
  },
  {
    id: 'cdp', name: 'CDP', fullName: 'Carbon Disclosure Project — Water Security',
    relevantMetrics: ['W1: Current State', 'W2: Business Impacts', 'W3: Procedures', 'W4: Risk Assessment', 'W8: Targets'],
    status: 'gap', coverage: 30,
  },
  {
    id: 'tcfd', name: 'TCFD', fullName: 'Task Force on Climate-related Financial Disclosures',
    relevantMetrics: ['Physical Risk (water stress)', 'Transition Risk (regulation)', 'Metrics & Targets'],
    status: 'partial', coverage: 45,
  },
  {
    id: 'tnfd', name: 'TNFD', fullName: 'Taskforce on Nature-related Financial Disclosures',
    relevantMetrics: ['Dependencies on water ecosystems', 'Impacts on freshwater', 'Risk management', 'Metrics & targets'],
    status: 'gap', coverage: 20,
  },
];

// ─── State GEO (reuse from SCC) ─────────────────────────────────────────────

const STATE_GEO: Record<string, { center: [number, number]; scale: number }> = {
  US: { center: [-98.5, 39.8] as [number, number], scale: 1000 },
  MD: { center: [-76.7, 39.0] as [number, number], scale: 7500 },
  VA: { center: [-79.5, 37.5] as [number, number], scale: 4500 },
  DC: { center: [-77.02, 38.9] as [number, number], scale: 90000 },
  PA: { center: [-77.8, 40.9] as [number, number], scale: 4500 },
  FL: { center: [-82.5, 28.5] as [number, number], scale: 3200 },
  DE: { center: [-75.5, 39.0] as [number, number], scale: 14000 },
};

// ─── Props ──────────────────────────────────────────────────────────────────

type Props = {
  companyName?: string;
  facilities?: FacilityRow[];
  onBack?: () => void;
  onToggleDevMode?: () => void;
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function ESGCommandCenter({ companyName = 'PEARL Portfolio', facilities: propFacilities, onBack, onToggleDevMode }: Props) {
  const { user, logout } = useAuth();

  // ── View Lens ──
  const [viewLens, setViewLens] = useState<ESGLens>('overview');
  const lens = LENS_CONFIG[viewLens];
  const [showLensDropdown, setShowLensDropdown] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);

  // ── Map state ──
  const [overlay, setOverlay] = useState<OverlayId>('waterrisk');
  const [mapZoom, setMapZoom] = useState(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>(STATE_GEO['US'].center);
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // ── Collapse state ──
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleCollapse = (id: string) => setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  const isSectionOpen = (id: string) => !collapsedSections[id];

  // ── Expanded section state (for cards) ──
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  const isSectionExpanded = (id: string) => expandedSections[id] ?? false;

  // ── Topo data ──
  const topo = useMemo(() => {
    try { return feature(statesTopo as any, (statesTopo as any).objects.states) as any; }
    catch { return null; }
  }, []);

  // ── Demo facilities (replace with real data when available) ──
  const facilitiesData: FacilityRow[] = useMemo(() => {
    if (propFacilities && propFacilities.length > 0) return propFacilities;
    // Demo: 5 facilities across Chesapeake region for development
    return [
      { id: 'fac_annapolis_hq', name: 'Annapolis HQ', state: 'MD', type: 'office', alertLevel: 'low', activeAlerts: 1, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 3, waterRiskScore: 35, lat: 38.978, lon: -76.492 },
      { id: 'fac_baltimore_plant', name: 'Baltimore Processing', state: 'MD', type: 'manufacturing', alertLevel: 'high', activeAlerts: 4, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 5, waterRiskScore: 78, lat: 39.268, lon: -76.610 },
      { id: 'fac_norfolk_dist', name: 'Norfolk Distribution', state: 'VA', type: 'warehouse', alertLevel: 'medium', activeAlerts: 2, lastUpdatedISO: new Date().toISOString(), status: 'assessed', dataSourceCount: 1, waterRiskScore: 55, lat: 36.850, lon: -76.285 },
      { id: 'fac_wilmington_ops', name: 'Wilmington Operations', state: 'DE', type: 'manufacturing', alertLevel: 'medium', activeAlerts: 3, lastUpdatedISO: new Date().toISOString(), status: 'assessed', dataSourceCount: 2, waterRiskScore: 62, lat: 39.740, lon: -75.550 },
      { id: 'fac_dc_office', name: 'DC Government Affairs', state: 'DC', type: 'office', alertLevel: 'none', activeAlerts: 0, lastUpdatedISO: new Date().toISOString(), status: 'unmonitored', dataSourceCount: 0, waterRiskScore: 15, lat: 38.905, lon: -77.035 },
    ];
  }, [propFacilities]);

  // ── Filtered list ──
  const filteredFacilities = useMemo(() => {
    let filtered = facilitiesData;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(f => f.name.toLowerCase().includes(q) || f.state.toLowerCase().includes(q));
    }
    if (filterLevel !== 'all') {
      filtered = filtered.filter(f => f.alertLevel === filterLevel);
    }
    return filtered.sort((a, b) => b.waterRiskScore - a.waterRiskScore);
  }, [facilitiesData, searchQuery, filterLevel]);

  // ── Aggregate scores ──
  const portfolioScores = useMemo(() => {
    const total = facilitiesData.length;
    const highRisk = facilitiesData.filter(f => f.waterRiskScore >= 70).length;
    const medRisk = facilitiesData.filter(f => f.waterRiskScore >= 40 && f.waterRiskScore < 70).length;
    const lowRisk = facilitiesData.filter(f => f.waterRiskScore < 40).length;
    const monitored = facilitiesData.filter(f => f.status === 'monitored').length;
    const avgRisk = total > 0 ? Math.round(facilitiesData.reduce((s, f) => s + f.waterRiskScore, 0) / total) : 0;
    const avgESG = Math.max(0, 100 - avgRisk); // Inverse of risk for ESG score
    return { total, highRisk, medRisk, lowRisk, monitored, avgRisk, avgESG };
  }, [facilitiesData]);

  // ── Selected facility detail ──
  const selectedFac = facilitiesData.find(f => f.id === selectedFacility) || null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="max-w-[1600px] mx-auto p-4 space-y-4">

        {/* ── HEADER ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="relative h-12 w-40 cursor-default select-none"
                onDoubleClick={() => onToggleDevMode?.()}
              >
                <Image src="/Logo_Pearl_as_Headline.JPG" alt="Project Pearl Logo" fill className="object-contain object-left" priority />
              </div>
              <div>
                <div className="text-xl font-semibold text-slate-800">Corporate E/S/G Command Center</div>
                <div className="text-sm text-slate-600">
                  Portfolio water risk, ESG disclosure readiness &amp; environmental impact verification
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
            {/* Lens selector */}
            <div className="relative">
              <button
                onClick={() => setShowLensDropdown(!showLensDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-sm font-medium text-emerald-800 hover:bg-emerald-50 transition-colors shadow-sm"
              >
                <lens.icon className="h-3.5 w-3.5" />
                {lens.label}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showLensDropdown && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  {(Object.entries(LENS_CONFIG) as [ESGLens, LensConfig][]).map(([id, cfg]) => (
                    <button
                      key={id}
                      onClick={() => { setViewLens(id); setShowLensDropdown(false); }}
                      className={`w-full text-left px-3 py-2 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2 ${viewLens === id ? 'bg-emerald-50' : ''}`}
                    >
                      <cfg.icon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{cfg.label}</div>
                        <div className="text-[10px] text-slate-500">{cfg.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export ESG Report */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
              <Download className="h-3.5 w-3.5" />
              Export Report
            </button>

            {/* Account */}
            {user && (
            <div className="relative">
              <button
                onClick={() => setShowAccountPanel(!showAccountPanel)}
                className="inline-flex items-center h-8 px-3 text-xs font-semibold rounded-md border bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <Leaf className="h-3.5 w-3.5 mr-1.5" />
                {user.name || 'ESG Officer'}
                <span className="ml-1.5 text-emerald-400">▾</span>
              </button>

              {showAccountPanel && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAccountPanel(false)} />
                <div
                  className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                          {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'ES'}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{user.name || 'ESG Officer'}</div>
                          <div className="text-[11px] text-slate-500">{user.email || 'esg@project-pearl.org'}</div>
                        </div>
                      </div>
                      <button onClick={() => setShowAccountPanel(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Account info */}
                  <div className="px-4 py-3 space-y-2 text-xs border-b border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Role</span>
                      <span className="font-medium text-slate-700">Corporate / ESG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Organization</span>
                      <span className="font-medium text-slate-700 text-right">{user.organization || companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Access Level</span>
                      <Badge variant="outline" className="text-[10px] h-5 bg-green-50 border-green-200 text-green-700">Full Access</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Facilities</span>
                      <span className="font-medium text-slate-700">{facilitiesData.length} monitored</span>
                    </div>
                  </div>

                  {/* Account actions */}
                  <div className="px-4 py-2.5 space-y-1">
                    <button
                      onClick={() => { /* TODO: wire to password change route */ }}
                      className="w-full text-left px-3 py-2 rounded-md text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <Shield size={13} className="text-slate-400" />
                      Change Password
                    </button>
                    <button
                      onClick={() => { setShowAccountPanel(false); logout(); }}
                      className="w-full text-left px-3 py-2 rounded-md text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                    <span className="text-[10px] text-slate-400">PEARL ESGCC v1.0 · {companyName} · Session {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                </>
              )}
            </div>
            )}
            </div>
        </div>
          <div className="text-2xl font-bold text-emerald-700 text-center pt-3">{companyName}</div>
        </div>

        {/* ── PORTFOLIO SCORECARD ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-emerald-700">{portfolioScores.avgESG}</div>
              <div className="text-[10px] text-emerald-600 font-medium">ESG Score</div>
            </CardContent>
          </Card>
          <Card className="border border-slate-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-slate-800">{portfolioScores.total}</div>
              <div className="text-[10px] text-slate-500">Facilities</div>
            </CardContent>
          </Card>
          <Card className="border border-red-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{portfolioScores.highRisk}</div>
              <div className="text-[10px] text-red-500">High Risk</div>
            </CardContent>
          </Card>
          <Card className="border border-amber-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{portfolioScores.medRisk}</div>
              <div className="text-[10px] text-amber-500">Medium Risk</div>
            </CardContent>
          </Card>
          <Card className="border border-green-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{portfolioScores.lowRisk}</div>
              <div className="text-[10px] text-green-500">Low Risk</div>
            </CardContent>
          </Card>
          <Card className="border border-blue-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{portfolioScores.monitored}</div>
              <div className="text-[10px] text-blue-500">PEARL Active</div>
            </CardContent>
          </Card>
          <Card className="border border-slate-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-slate-600">{portfolioScores.avgRisk}</div>
              <div className="text-[10px] text-slate-500">Avg Risk Score</div>
            </CardContent>
          </Card>
        </div>

        {/* ── MAP + FACILITY LIST ── */}
        {lens.showMap && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LEFT: Map (2/3) */}
            <Card className="lg:col-span-2 border-2 border-slate-200">
              <CardContent className="p-0">
                {/* Overlay toggle */}
                <div className="flex items-center gap-2 p-2 bg-slate-50 border-b border-slate-200">
                  {OVERLAYS.map(o => (
                    <button
                      key={o.id}
                      onClick={() => setOverlay(o.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        overlay === o.id
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <o.icon className="h-3 w-3" />
                      {o.label}
                    </button>
                  ))}
                </div>

                <div className="p-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span>{companyName} · {facilitiesData.length} facilities</span>
                  {mapZoom > 1.1 && <span className="text-slate-400">{mapZoom.toFixed(1)}×</span>}
                </div>

                <div className="h-[450px] w-full relative">
                  {/* Zoom controls */}
                  <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                    <button onClick={() => setMapZoom(z => Math.min(z * 1.5, 12))} className="w-7 h-7 rounded bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 text-sm font-bold">+</button>
                    <button onClick={() => setMapZoom(z => Math.max(z / 1.5, 1))} className="w-7 h-7 rounded bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 text-sm font-bold">−</button>
                    <button onClick={() => { setMapZoom(1); setMapCenter(STATE_GEO['US'].center); }} className="w-7 h-7 rounded bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-500 hover:bg-slate-50 text-[10px] font-medium">⌂</button>
                  </div>

                  {topo && (
                    <ComposableMap
                      projection="geoMercator"
                      projectionConfig={{ center: STATE_GEO['US'].center, scale: STATE_GEO['US'].scale }}
                      width={800}
                      height={470}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <ZoomableGroup
                        zoom={mapZoom}
                        center={mapCenter}
                        onMoveEnd={({ coordinates, zoom }) => { setMapCenter(coordinates as [number, number]); setMapZoom(zoom); }}
                        minZoom={1}
                        maxZoom={12}
                      >
                        <Geographies geography={topo}>
                          {({ geographies }: { geographies: any[] }) =>
                            geographies.map((g: any) => (
                              <Geography
                                key={g.rsmKey ?? g.id}
                                geography={g}
                                style={{
                                  default: { fill: '#f1f5f9', outline: 'none', stroke: '#cbd5e1', strokeWidth: 0.3 / mapZoom },
                                  hover: { fill: '#e2e8f0', outline: 'none', stroke: '#cbd5e1', strokeWidth: 0.3 / mapZoom },
                                  pressed: { fill: '#e2e8f0', outline: 'none' },
                                }}
                              />
                            ))
                          }
                        </Geographies>

                        {/* Facility markers */}
                        {facilitiesData.filter(f => f.lat && f.lon).map(f => {
                          const isActive = f.id === selectedFacility;
                          const color = getMarkerColor(overlay, f);
                          return (
                            <Marker key={f.id} coordinates={[f.lon!, f.lat!]}>
                              <circle
                                r={isActive ? 8 / mapZoom : 5 / mapZoom}
                                fill={color}
                                stroke={isActive ? '#1e40af' : '#ffffff'}
                                strokeWidth={(isActive ? 2.5 : 1.5) / mapZoom}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedFacility(isActive ? null : f.id)}
                              />
                              {/* Facility type icon — small square for manufacturing, circle for office */}
                              {f.type === 'manufacturing' && (
                                <rect
                                  x={-2 / mapZoom} y={-2 / mapZoom}
                                  width={4 / mapZoom} height={4 / mapZoom}
                                  fill="white" opacity={0.8}
                                  style={{ pointerEvents: 'none' }}
                                />
                              )}
                              {isActive && (
                                <text textAnchor="middle" y={-12 / mapZoom} style={{ fontSize: `${10 / mapZoom}px`, fontWeight: 700, fill: '#1e3a5f', pointerEvents: 'none' }}>
                                  {f.name}
                                </text>
                              )}
                            </Marker>
                          );
                        })}
                      </ZoomableGroup>
                    </ComposableMap>
                  )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-2 p-3 text-xs bg-slate-50 border-t border-slate-200">
                  {overlay === 'waterrisk' && (
                    <>
                      <span className="text-slate-500 font-medium self-center mr-1">Water Risk:</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Low (&lt;20)</Badge>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Moderate (20-40)</Badge>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Elevated (40-70)</Badge>
                      <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">High (70+)</Badge>
                    </>
                  )}
                  {overlay === 'compliance' && (
                    <>
                      <span className="text-slate-500 font-medium self-center mr-1">Compliance:</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Clean</Badge>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Watch</Badge>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Violations</Badge>
                      <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">Enforcement</Badge>
                    </>
                  )}
                  {overlay === 'impact' && (
                    <>
                      <span className="text-slate-500 font-medium self-center mr-1">PEARL Status:</span>
                      <Badge variant="secondary" className="bg-gray-200 text-gray-700">No System</Badge>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Assessed Only</Badge>
                      <Badge variant="secondary" className="bg-green-800 text-white">Active PEARL</Badge>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* RIGHT: Facility List (1/3) */}
            <Card className="lg:col-span-1 border-2 border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 size={16} />
                      Facilities
                    </CardTitle>
                    <CardDescription>{filteredFacilities.length} of {facilitiesData.length}</CardDescription>
                  </div>
                </div>
                {/* Search */}
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search facilities..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                {filteredFacilities.map(f => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFacility(f.id === selectedFacility ? null : f.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                      f.id === selectedFacility ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      f.waterRiskScore >= 70 ? 'bg-red-500' :
                      f.waterRiskScore >= 40 ? 'bg-amber-500' :
                      f.waterRiskScore >= 20 ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-800 truncate">{f.name}</div>
                      <div className="text-[10px] text-slate-500">{f.state} · {f.type} · Risk: {f.waterRiskScore}</div>
                    </div>
                    {f.status === 'monitored' && <Leaf className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── ENVIRONMENTAL IMPACT SUMMARY ── */}
        {lens.showImpact && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('impact')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">🌍 Environmental Impact Summary</span>
              {isSectionOpen('impact') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {isSectionOpen('impact') && (
              <div className="p-4 space-y-4">
                {/* Aggregate impact metrics across all facilities */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                    <Droplets className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-emerald-700">2.4M</div>
                    <div className="text-[10px] text-emerald-600">Gallons Treated (projected)</div>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
                    <TrendingDown className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-blue-700">12,400</div>
                    <div className="text-[10px] text-blue-600">lbs Pollutants Removed</div>
                  </div>
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3 text-center">
                    <Heart className="h-5 w-5 text-cyan-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-cyan-700">340</div>
                    <div className="text-[10px] text-cyan-600">Acres Watershed Restored</div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-center">
                    <Target className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-amber-700">88-95%</div>
                    <div className="text-[10px] text-amber-600">TSS Removal Efficiency</div>
                  </div>
                </div>
                {/* Projection banner */}
                <div className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-1.5 flex items-center gap-2">
                  <BarChart3 className="h-3 w-3 text-amber-600 flex-shrink-0" />
                  <span className="text-[10px] text-amber-700">Impact metrics projected from Milton pilot data (Jan 2025, 88-95% TSS, 50K GPD). Update with verified deployment data as available.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CORPORATE SUSTAINABILITY DASHBOARD ── */}
        {lens.showImpact && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('sustainability')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">♻️ Corporate Sustainability Dashboard</span>
              {isSectionOpen('sustainability') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {isSectionOpen('sustainability') && (
              <div className="p-4">
                <p className="text-xs text-slate-500 mb-3">Integrate CorporateESGDashboard component here with portfolio-level scores.</p>
                {/* TODO: Wire CorporateESGDashboard with portfolio-aggregated scores */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-medium text-slate-600 mb-1">Water Quality Score</div>
                    <div className="text-xl font-bold text-blue-600">{Math.max(0, 100 - portfolioScores.avgRisk)}</div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                      <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${Math.max(0, 100 - portfolioScores.avgRisk)}%` }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-medium text-slate-600 mb-1">Load Reduction Score</div>
                    <div className="text-xl font-bold text-emerald-600">72</div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                      <div className="h-1.5 bg-emerald-500 rounded-full" style={{ width: '72%' }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-medium text-slate-600 mb-1">Ecosystem Health</div>
                    <div className="text-xl font-bold text-cyan-600">58</div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                      <div className="h-1.5 bg-cyan-500 rounded-full" style={{ width: '58%' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DISCLOSURE & REPORTING READINESS ── */}
        {lens.showDisclosure && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('disclosure')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">📋 Disclosure & Reporting Readiness</span>
              {isSectionOpen('disclosure') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {isSectionOpen('disclosure') && (
              <div className="p-4 space-y-3">
                {ESG_FRAMEWORKS.map(fw => (
                  <div key={fw.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{fw.name}</span>
                        <span className="text-[10px] text-slate-500">{fw.fullName}</span>
                      </div>
                      <Badge variant="secondary" className={
                        fw.status === 'ready' ? 'bg-green-100 text-green-700 border-green-200' :
                        fw.status === 'partial' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        'bg-red-100 text-red-700 border-red-200'
                      }>
                        {fw.status === 'ready' ? 'Ready' : fw.status === 'partial' ? 'Partial' : 'Gaps'}
                      </Badge>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${
                          fw.coverage >= 80 ? 'bg-green-500' : fw.coverage >= 50 ? 'bg-amber-500' : 'bg-red-400'
                        }`}
                        style={{ width: `${fw.coverage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-[10px] text-slate-500">{fw.coverage}% coverage</div>
                      <div className="flex flex-wrap gap-1">
                        {fw.relevantMetrics.slice(0, 3).map(m => (
                          <span key={m} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-600">{m}</span>
                        ))}
                        {fw.relevantMetrics.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-500">+{fw.relevantMetrics.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SHAREHOLDER REPORTING ── */}
        {lens.showShareholder && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('shareholder')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">📈 Shareholder & Investor Reporting</span>
              {isSectionOpen('shareholder') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {isSectionOpen('shareholder') && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">Financial Materiality</span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between"><span>Water risk exposure</span><span className="font-medium">${(portfolioScores.highRisk * 850_000).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Compliance cost avoidance</span><span className="font-medium text-emerald-600">$340,000/yr</span></div>
                      <div className="flex justify-between"><span>Insurance premium reduction</span><span className="font-medium text-emerald-600">~8-12%</span></div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800">ESG Rating Impact</span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between"><span>MSCI ESG Rating</span><span className="font-medium">A → AA (projected)</span></div>
                      <div className="flex justify-between"><span>Sustainalytics Risk</span><span className="font-medium">Medium → Low</span></div>
                      <div className="flex justify-between"><span>CDP Water Score</span><span className="font-medium">C → B</span></div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-bold text-slate-800">Stakeholder Value</span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between"><span>Community benefit</span><span className="font-medium">{portfolioScores.monitored} watersheds</span></div>
                      <div className="flex justify-between"><span>Jobs supported</span><span className="font-medium">12-18 FTE</span></div>
                      <div className="flex justify-between"><span>EJ community overlap</span><span className="font-medium">3 of {portfolioScores.total} sites</span></div>
                    </div>
                  </div>
                </div>
                {/* Projection banner */}
                <div className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-1.5 flex items-center gap-2">
                  <BarChart3 className="h-3 w-3 text-amber-600 flex-shrink-0" />
                  <span className="text-[10px] text-amber-700">Rating projections are modeled estimates. Actual ESG rating changes depend on verified deployment data and reporting agency methodology.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── INDUSTRY ESG BENCHMARKING ── */}
        {lens.showBenchmark && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('benchmark')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">📊 Industry ESG Benchmarking</span>
              {isSectionOpen('benchmark') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {isSectionOpen('benchmark') && (
              <div className="p-4 space-y-3">
                <div className="text-xs text-slate-500 mb-2">Comparison against industry peers on water stewardship metrics</div>
                {/* Benchmark bars */}
                {[
                  { metric: 'Water Intensity (gal/$M revenue)', yours: 35, industry: 58, better: 'lower' },
                  { metric: 'Wastewater Treatment Rate', yours: 92, industry: 67, better: 'higher' },
                  { metric: 'Water Risk Mitigation Coverage', yours: portfolioScores.monitored / Math.max(1, portfolioScores.total) * 100, industry: 28, better: 'higher' },
                  { metric: 'Watershed Restoration Investment ($/facility)', yours: 72, industry: 18, better: 'higher' },
                  { metric: 'Real-Time Monitoring Coverage', yours: (portfolioScores.monitored / Math.max(1, portfolioScores.total)) * 100, industry: 12, better: 'higher' },
                ].map(b => (
                  <div key={b.metric} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-700 font-medium">{b.metric}</span>
                      <span className="text-slate-500">
                        You: <span className="font-bold text-emerald-700">{Math.round(b.yours)}%</span>
                        {' · '}Industry: <span className="font-bold text-slate-600">{b.industry}%</span>
                      </span>
                    </div>
                    <div className="relative h-2 bg-slate-100 rounded-full">
                      <div className="absolute h-2 bg-slate-300 rounded-full" style={{ width: `${b.industry}%` }} />
                      <div className="absolute h-2 bg-emerald-500 rounded-full" style={{ width: `${Math.round(b.yours)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REGULATORY COMPLIANCE ── */}
        {lens.showCompliance && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('compliance')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">🛡️ Regulatory Compliance Status</span>
              {isSectionOpen('compliance') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {isSectionOpen('compliance') && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 text-center">
                    <Shield className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-green-700">{facilitiesData.filter(f => f.alertLevel === 'none').length}</div>
                    <div className="text-[10px] text-green-600">Clean Record</div>
                  </div>
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3 text-center">
                    <Eye className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-yellow-700">{facilitiesData.filter(f => f.alertLevel === 'low').length}</div>
                    <div className="text-[10px] text-yellow-600">Watch List</div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-amber-700">{facilitiesData.filter(f => f.alertLevel === 'medium').length}</div>
                    <div className="text-[10px] text-amber-600">Violations</div>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-center">
                    <Scale className="h-5 w-5 text-red-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-red-700">{facilitiesData.filter(f => f.alertLevel === 'high').length}</div>
                    <div className="text-[10px] text-red-600">Enforcement Action</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Source: EPA ECHO facility compliance database · Updated at page load
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BRAND & VALUE TRUST ── */}
        {lens.showBrand && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('brand')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">⭐ Brand & Value Trust</span>
              {isSectionOpen('brand') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {isSectionOpen('brand') && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-emerald-600" />
                      Public Impact Narrative
                    </div>
                    <div className="text-[11px] text-slate-600 leading-relaxed">
                      "{companyName} actively invests in nature-based water infrastructure across {facilitiesData.length} facilities,
                      treating stormwater runoff and restoring aquatic ecosystems in the communities where we operate.
                      Our PEARL biofiltration systems combine oyster-powered natural filtration with real-time water quality monitoring,
                      demonstrating measurable environmental improvement at every deployment."
                    </div>
                    <div className="text-[9px] text-slate-400 italic">Auto-generated narrative — customize for annual report, press releases, investor comms</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      Trust Indicators
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center"><Zap className="h-2.5 w-2.5 text-green-600" /></div>
                        <span>Real-time monitoring — data available 24/7, not self-reported</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center"><Lock className="h-2.5 w-2.5 text-green-600" /></div>
                        <span>Chain of custody — NIST-traceable calibration, immutable audit trail</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center"><Shield className="h-2.5 w-2.5 text-green-600" /></div>
                        <span>Third-party verification — monthly split samples by state-certified lab</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center"><Users className="h-2.5 w-2.5 text-green-600" /></div>
                        <span>Community benefit — EJ overlay shows impact in underserved areas</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── WATER RISK DETAIL (selected facility) ── */}
        {lens.showRisk && selectedFac && (
          <div className="rounded-xl border-2 border-emerald-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-800">📍 {selectedFac.name} — Water Risk Detail</span>
              <button onClick={() => setSelectedFacility(null)} className="text-xs text-slate-500 hover:text-slate-700">Close ✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedFac.waterRiskScore}</div>
                  <div className="text-[10px] text-slate-500">Water Risk Score</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedFac.state}</div>
                  <div className="text-[10px] text-slate-500">State</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedFac.activeAlerts}</div>
                  <div className="text-[10px] text-slate-500">Active Alerts</div>
                </div>
                <div className="text-center">
                  <Badge variant="secondary" className={
                    selectedFac.status === 'monitored' ? 'bg-green-100 text-green-700' :
                    selectedFac.status === 'assessed' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }>
                    {selectedFac.status === 'monitored' ? 'PEARL Active' : selectedFac.status === 'assessed' ? 'Assessed Only' : 'Unmonitored'}
                  </Badge>
                  <div className="text-[10px] text-slate-500 mt-1">PEARL Status</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500">
                Water risk score derived from EPA ATTAINS impairment data for receiving waterbodies within facility's HUC-12 watershed.
                Compliance status from EPA ECHO. PEARL monitoring data where deployed.
              </div>
            </div>
          </div>
        )}

        {/* ── GRANT OPPORTUNITIES ── */}
        {lens.showGrants && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('grants')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">💰 Grant & Incentive Opportunities</span>
              {isSectionOpen('grants') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {isSectionOpen('grants') && (
              <div className="p-4">
                <p className="text-xs text-slate-500 mb-3">
                  Environmental grants, tax incentives, and sustainability funding that align with your PEARL deployments.
                  Filtered by facility locations and eligible programs.
                </p>
                {/* TODO: Wire GrantOpportunityMatcher component */}
                <div className="space-y-2">
                  {[
                    { name: 'EPA Clean Water State Revolving Fund', amount: '$500K-$5M', match: 'High', deadline: 'Rolling' },
                    { name: 'CWA Section 319 Nonpoint Source', amount: '$100K-$500K', match: 'High', deadline: 'Varies by state' },
                    { name: 'USDA Conservation Innovation Grants', amount: '$150K-$2M', match: 'Medium', deadline: 'Annual' },
                    { name: 'State Green Infrastructure Tax Credit', amount: 'Up to 50% of cost', match: 'Medium', deadline: 'Varies' },
                  ].map(g => (
                    <div key={g.name} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                      <div>
                        <div className="text-xs font-medium text-slate-800">{g.name}</div>
                        <div className="text-[10px] text-slate-500">{g.amount} · Deadline: {g.deadline}</div>
                      </div>
                      <Badge variant="secondary" className={g.match === 'High' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                        {g.match} Match
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-200">
          <span>PEARL Corporate E/S/G Command Center v1.0 · {companyName} · {facilitiesData.length} facilities</span>
          <span className="font-medium text-slate-500">Data Sources:</span>
          <span>EPA ATTAINS · EPA ECHO · WRI Aqueduct · USGS NWIS · NOAA CO-OPS</span>
        </div>

      </div>
    </div>
  );
}
