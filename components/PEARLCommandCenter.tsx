'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import HeroBanner from './HeroBanner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X, AlertTriangle, AlertCircle, CheckCircle, Activity, Droplets,
  Gauge, TrendingUp, TrendingDown, BarChart3, DollarSign, Users,
  MapPin, Wrench, Shell, Zap, Clock, ThermometerSun, Wind,
  ChevronDown, ChevronUp, ChevronRight, Search, Filter, FileText,
  Calculator, Truck, Radio, Eye, Target, Building2, LogOut,
  RefreshCw, Download, Send, Plus, Minus, Info, Printer
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';

// ─── Types ──────────────────────────────────────────────────────────────────

type ViewLens = 'operations' | 'proposals';

type DeploymentStatus = 'active' | 'maintenance' | 'offline' | 'staging' | 'decommissioned';
type AlertSeverity = 'critical' | 'warning' | 'info' | 'ok';

interface SensorReading {
  timestamp: string;
  do_mgl: number | null;
  temp_c: number | null;
  ph: number | null;
  turbidity_ntu: number | null;
  tss_mgl: number | null;
  flow_gpm: number | null;
  salinity_psu: number | null;
}

interface DeltaAlert {
  id: string;
  severity: AlertSeverity;
  parameter: string;
  message: string;
  diagnosis: string;
  recommendation: string;
  timestamp: string;
  delta: number;      // % change
  baseline: number;
  current: number;
  unit: string;
}

interface Deployment {
  id: string;
  name: string;
  location: string;
  state: string;
  lat: number;
  lon: number;
  status: DeploymentStatus;
  unitModel: string;
  gpmCapacity: number;
  installDate: string;
  lastReading: SensorReading | null;
  baselineReadings: SensorReading;  // 7-day average at install
  alerts: DeltaAlert[];
  uptime: number;               // percentage
  totalGallonsTreated: number;
  tssRemovalRate: number;       // percentage
  waterType: 'fresh' | 'brackish' | 'salt';
  oysterBedStatus: 'healthy' | 'fouling_detected' | 'replacement_due' | 'new';
  resinStatus: 'good' | 'degraded' | 'replacement_due' | 'new';
  pumpStatus: 'running' | 'reduced_flow' | 'failing' | 'offline';
  nextMaintenance: string;
}

interface Prospect {
  id: string;
  name: string;
  jurisdiction: string;
  state: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  stage: 'lead' | 'contacted' | 'demo_scheduled' | 'proposal_sent' | 'negotiating' | 'closed_won' | 'closed_lost';
  estimatedGPM: number;
  estimatedUnits: number;
  estimatedACV: number;      // Annual contract value
  impairedWaterbodies: number;
  freshnessScore: number;
  ms4PermitType: string;
  notes: string;
  lastActivity: string;
  proposalReady: boolean;
}

type Props = {
  onClose: () => void;
  onToggleDevMode?: () => void;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const PEARL_UNITS: Record<string, { gpm: number; footprint: string; price: number; oysterCapacity: string }> = {
  'PEARL-200': { gpm: 200, footprint: "4' × 4'", price: 45000, oysterCapacity: '500 adults' },
  'PEARL-500': { gpm: 500, footprint: "6' × 6'", price: 85000, oysterCapacity: '1,200 adults' },
  'PEARL-1200': { gpm: 1200, footprint: "8' × 10'", price: 165000, oysterCapacity: '3,000 adults' },
  'PEARL-2500': { gpm: 2500, footprint: "10' × 16'", price: 290000, oysterCapacity: '6,500 adults' },
};

// ─── Mock Deployments (replace with real API when sondes go live) ───────────

function generateDeployments(): Deployment[] {
  const now = new Date();
  return [
    {
      id: 'dep-milton-fl-001',
      name: 'Milton FL Pilot',
      location: 'Milton, FL — Blackwater River Outfall',
      state: 'FL',
      lat: 30.6325,
      lon: -87.0397,
      status: 'active',
      unitModel: 'PEARL-500',
      gpmCapacity: 500,
      installDate: '2026-01-09',
      lastReading: {
        timestamp: now.toISOString(),
        do_mgl: 7.2,
        temp_c: 18.4,
        ph: 7.1,
        turbidity_ntu: 4.2,
        tss_mgl: 8.5,
        flow_gpm: 340,
        salinity_psu: 0.3,
      },
      baselineReadings: {
        timestamp: '2026-01-09T12:00:00Z',
        do_mgl: 5.8,
        temp_c: 16.2,
        ph: 6.9,
        turbidity_ntu: 18.6,
        tss_mgl: 85.0,
        flow_gpm: 380,
        salinity_psu: 0.3,
      },
      alerts: [
        {
          id: 'a-001',
          severity: 'info',
          parameter: 'TSS',
          message: 'TSS removal rate exceeding target',
          diagnosis: 'Mechanical filtration + oyster biofiltration performing above spec. Current removal: 90%.',
          recommendation: 'No action — document for case study.',
          timestamp: now.toISOString(),
          delta: -90,
          baseline: 85.0,
          current: 8.5,
          unit: 'mg/L',
        },
      ],
      uptime: 97.2,
      totalGallonsTreated: 18400000,
      tssRemovalRate: 90,
      waterType: 'fresh',
      oysterBedStatus: 'healthy',
      resinStatus: 'good',
      pumpStatus: 'running',
      nextMaintenance: '2026-03-09',
    },
    {
      id: 'dep-aa-county-001',
      name: 'Anne Arundel Demo',
      location: 'Severn River Outfall, AA County, MD',
      state: 'MD',
      lat: 39.0740,
      lon: -76.5460,
      status: 'staging',
      unitModel: 'PEARL-1200',
      gpmCapacity: 1200,
      installDate: '2026-04-15',
      lastReading: null,
      baselineReadings: {
        timestamp: '',
        do_mgl: 0, temp_c: 0, ph: 0, turbidity_ntu: 0,
        tss_mgl: 0, flow_gpm: 0, salinity_psu: 0,
      },
      alerts: [],
      uptime: 0,
      totalGallonsTreated: 0,
      tssRemovalRate: 0,
      waterType: 'brackish',
      oysterBedStatus: 'new',
      resinStatus: 'new',
      pumpStatus: 'offline',
      nextMaintenance: '2026-04-15',
    },
  ];
}

function generateProspects(): Prospect[] {
  return [
    {
      id: 'p-001', name: 'Anne Arundel County', jurisdiction: 'AA County MS4', state: 'MD',
      contactName: 'Erik Michelson', contactTitle: 'Stormwater Program Manager', contactEmail: '',
      stage: 'demo_scheduled', estimatedGPM: 2500, estimatedUnits: 2, estimatedACV: 180000,
      impairedWaterbodies: 34, freshnessScore: 12, ms4PermitType: 'MD MS4 Phase I',
      notes: 'Severn River pilot site confirmed. Erik interested in TSS + nutrient credit potential.',
      lastActivity: '2026-02-14', proposalReady: true,
    },
    {
      id: 'p-002', name: 'City of Pensacola', jurisdiction: 'Pensacola MS4', state: 'FL',
      contactName: '', contactTitle: 'Public Works Director', contactEmail: '',
      stage: 'contacted', estimatedGPM: 1200, estimatedUnits: 1, estimatedACV: 95000,
      impairedWaterbodies: 12, freshnessScore: 8, ms4PermitType: 'FL NPDES MS4 Phase II',
      notes: 'Follow-up from Milton pilot. Interested in Pensacola Bay outfalls.',
      lastActivity: '2026-02-10', proposalReady: false,
    },
    {
      id: 'p-003', name: 'Baltimore City DPW', jurisdiction: 'Baltimore City MS4', state: 'MD',
      contactName: '', contactTitle: 'Bureau of Water & Wastewater', contactEmail: '',
      stage: 'lead', estimatedGPM: 5000, estimatedUnits: 4, estimatedACV: 520000,
      impairedWaterbodies: 48, freshnessScore: 6, ms4PermitType: 'MD MS4 Phase I Large',
      notes: 'Highest impairment density in MD. Back River, Middle Branch, Gwynns Falls all Category 5.',
      lastActivity: '2026-01-28', proposalReady: false,
    },
    {
      id: 'p-004', name: 'UMCES Partnership', jurisdiction: 'Research / Chesapeake Bay', state: 'MD',
      contactName: 'Dr. Erik Schott', contactTitle: 'Research Faculty', contactEmail: '',
      stage: 'negotiating', estimatedGPM: 500, estimatedUnits: 1, estimatedACV: 65000,
      impairedWaterbodies: 0, freshnessScore: 45, ms4PermitType: 'N/A — Research',
      notes: 'Oyster biofiltration efficacy study. Potential co-authored paper. Sensor data sharing agreement.',
      lastActivity: '2026-02-12', proposalReady: true,
    },
    {
      id: 'p-005', name: 'Biohabitats', jurisdiction: 'Consulting / Design Partner', state: 'MD',
      contactName: '', contactTitle: 'Senior Ecologist', contactEmail: '',
      stage: 'negotiating', estimatedGPM: 0, estimatedUnits: 0, estimatedACV: 0,
      impairedWaterbodies: 0, freshnessScore: 0, ms4PermitType: 'N/A — Channel Partner',
      notes: 'Integration into their restoration designs. Co-marketing opportunity. They spec, we supply.',
      lastActivity: '2026-02-16', proposalReady: false,
    },
  ];
}

// ─── Delta Analysis Engine ──────────────────────────────────────────────────
// Compares current readings to baseline, flags anomalies with AI diagnosis

function analyzeDelta(deployment: Deployment): DeltaAlert[] {
  if (!deployment.lastReading || !deployment.baselineReadings.timestamp) return [];
  const lr = deployment.lastReading;
  const bl = deployment.baselineReadings;
  const alerts: DeltaAlert[] = [];
  const ts = lr.timestamp;

  // Flow drop → pump issue
  if (lr.flow_gpm != null && bl.flow_gpm != null && bl.flow_gpm > 0) {
    const flowDelta = ((lr.flow_gpm - bl.flow_gpm) / bl.flow_gpm) * 100;
    if (flowDelta < -25) {
      alerts.push({
        id: `${deployment.id}-flow`, severity: 'critical',
        parameter: 'Flow Rate', message: `Flow dropped ${Math.abs(flowDelta).toFixed(0)}% from baseline`,
        diagnosis: 'Significant flow reduction indicates potential pump impeller wear, intake blockage, or power supply issue. If gradual decline over days, likely mechanical wear. If sudden, check for debris obstruction.',
        recommendation: 'Dispatch field tech. Check intake screen, impeller condition, and power draw (amps). If amps normal but flow low → impeller wear. If amps high → obstruction.',
        timestamp: ts, delta: flowDelta, baseline: bl.flow_gpm, current: lr.flow_gpm, unit: 'GPM',
      });
    } else if (flowDelta < -10) {
      alerts.push({
        id: `${deployment.id}-flow`, severity: 'warning',
        parameter: 'Flow Rate', message: `Flow reduced ${Math.abs(flowDelta).toFixed(0)}% from baseline`,
        diagnosis: 'Moderate flow reduction. Could be seasonal low-flow conditions, partial intake screening, or early pump wear.',
        recommendation: 'Monitor trend over next 48hrs. If continuing to decline, schedule maintenance window.',
        timestamp: ts, delta: flowDelta, baseline: bl.flow_gpm, current: lr.flow_gpm, unit: 'GPM',
      });
    }
  }

  // Turbidity spike post-treatment → resin/media degradation
  if (lr.turbidity_ntu != null && bl.turbidity_ntu != null && bl.turbidity_ntu > 0) {
    const turbDelta = ((lr.turbidity_ntu - bl.turbidity_ntu) / bl.turbidity_ntu) * 100;
    // Post-treatment turbidity should be LOW. If it's rising toward baseline, media is failing.
    if (lr.turbidity_ntu > 15 && turbDelta > 50) {
      alerts.push({
        id: `${deployment.id}-turb`, severity: 'warning',
        parameter: 'Turbidity', message: `Post-treatment turbidity rising — up ${turbDelta.toFixed(0)}%`,
        diagnosis: 'Increasing effluent turbidity suggests mechanical filter media saturation or resin exhaustion. The filtration stage is passing particles that should be captured.',
        recommendation: 'Check resin bed pressure differential. If ΔP > spec, schedule resin replacement. Backwash cycle may resolve temporarily.',
        timestamp: ts, delta: turbDelta, baseline: bl.turbidity_ntu, current: lr.turbidity_ntu, unit: 'NTU',
      });
    }
  }

  // DO drop in oyster bed → fouling or die-off
  if (lr.do_mgl != null && bl.do_mgl != null && bl.do_mgl > 0) {
    const doDelta = ((lr.do_mgl - bl.do_mgl) / bl.do_mgl) * 100;
    if (lr.do_mgl < 4.0 && doDelta < -20) {
      alerts.push({
        id: `${deployment.id}-do`, severity: 'critical',
        parameter: 'Dissolved Oxygen', message: `DO dropped to ${lr.do_mgl.toFixed(1)} mg/L — ${Math.abs(doDelta).toFixed(0)}% below baseline`,
        diagnosis: 'Low DO in the biofiltration chamber suggests oyster bed stress. Possible causes: (1) Excessive organic loading overwhelming oyster filtration capacity, (2) Oyster mortality/fouling reducing active filter area, (3) Seasonal temperature stress affecting oyster metabolism.',
        recommendation: 'Visual inspection of oyster bed. Check for mud/sediment burial, shell gaping (die-off indicator), or biofilm coating. If >20% mortality, schedule bed replacement.',
        timestamp: ts, delta: doDelta, baseline: bl.do_mgl, current: lr.do_mgl, unit: 'mg/L',
      });
    } else if (doDelta > 30 && lr.do_mgl > 10) {
      alerts.push({
        id: `${deployment.id}-do-high`, severity: 'info',
        parameter: 'Dissolved Oxygen', message: `DO elevated ${doDelta.toFixed(0)}% above baseline`,
        diagnosis: 'Significant DO increase in effluent indicates strong oyster biofiltration performance + possible algal photosynthesis contribution.',
        recommendation: 'Positive indicator. Document for efficacy reporting. Monitor for supersaturation (>120% sat) which could indicate algal bloom in bed.',
        timestamp: ts, delta: doDelta, baseline: bl.do_mgl, current: lr.do_mgl, unit: 'mg/L',
      });
    }
  }

  // pH drift → chemical change in bed
  if (lr.ph != null && bl.ph != null && bl.ph > 0) {
    const phDelta = lr.ph - bl.ph;
    if (Math.abs(phDelta) > 0.8) {
      alerts.push({
        id: `${deployment.id}-ph`, severity: 'warning',
        parameter: 'pH', message: `pH shifted ${phDelta > 0 ? '+' : ''}${phDelta.toFixed(1)} from baseline`,
        diagnosis: phDelta > 0
          ? 'Rising pH suggests oyster shell dissolution (calcium carbonate buffering) or algal activity consuming CO₂. Normal in new deployments as shells equilibrate.'
          : 'Falling pH indicates acidification — possible from high organic loading, anaerobic conditions in bed, or upstream acid input.',
        recommendation: Math.abs(phDelta) > 1.2
          ? 'Investigate immediately. Check for upstream contamination or bed degradation.'
          : 'Monitor trend. If pH continues drifting >1.0 from baseline over 7 days, schedule inspection.',
        timestamp: lr.timestamp, delta: phDelta, baseline: bl.ph, current: lr.ph, unit: 'pH',
      });
    }
  }

  // TSS removal rate degradation
  if (lr.tss_mgl != null && bl.tss_mgl != null && bl.tss_mgl > 0) {
    const currentRemoval = ((bl.tss_mgl - lr.tss_mgl) / bl.tss_mgl) * 100;
    if (currentRemoval < 70 && currentRemoval > 0) {
      alerts.push({
        id: `${deployment.id}-tss`, severity: 'warning',
        parameter: 'TSS Removal', message: `Removal rate at ${currentRemoval.toFixed(0)}% — below 70% threshold`,
        diagnosis: 'TSS removal efficiency declining. Mechanical filtration media may be saturated, or influent loading has increased significantly. Cross-reference with flow rate — if flow is also down, likely media issue. If flow is normal, influent quality changed.',
        recommendation: 'Check filter media condition. Compare influent vs effluent TSS. If influent unchanged and removal declining → replace/backwash media. If influent spiked → evaluate sizing adequacy.',
        timestamp: ts, delta: currentRemoval - 90, baseline: 90, current: currentRemoval, unit: '%',
      });
    }
  }

  return alerts;
}

// ─── GPM Calculator Logic ───────────────────────────────────────────────────

interface GPMCalcInputs {
  drainageArea_acres: number;
  imperviousPercent: number;
  rainfallIntensity_inhr: number;  // NOAA Atlas 14 2-yr, 24-hr
  designCapturePercent: number;    // typically 80-90% of storms
}

function calculateGPM(inputs: GPMCalcInputs) {
  // Rational Method: Q = C × i × A (result in cfs)
  // C = runoff coefficient (derived from impervious %)
  const C = 0.05 + (inputs.imperviousPercent / 100) * 0.85; // 0.05 (full pervious) to 0.90 (full impervious)
  const Q_cfs = C * inputs.rainfallIntensity_inhr * inputs.drainageArea_acres;
  const Q_gpm = Q_cfs * 448.83; // 1 cfs = 448.83 GPM
  const designGPM = Q_gpm * (inputs.designCapturePercent / 100);

  // Recommend PEARL unit
  let recommended = 'PEARL-2500';
  if (designGPM <= 200) recommended = 'PEARL-200';
  else if (designGPM <= 500) recommended = 'PEARL-500';
  else if (designGPM <= 1200) recommended = 'PEARL-1200';

  const unit = PEARL_UNITS[recommended];
  const unitsNeeded = Math.ceil(designGPM / unit.gpm);

  return {
    runoffCoeff: C,
    peakFlow_cfs: Q_cfs,
    peakFlow_gpm: Q_gpm,
    designGPM,
    recommended,
    unitsNeeded,
    unitSpec: unit,
    totalCost: unitsNeeded * unit.price,
    estimatedTSSRemoval: 88, // based on Milton pilot
    estimatedAnnualGallons: designGPM * 60 * 24 * 365 * 0.15, // ~15% avg utilization
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function statusColor(s: DeploymentStatus): string {
  switch (s) {
    case 'active': return 'bg-green-100 text-green-800 border-green-300';
    case 'maintenance': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'offline': return 'bg-red-100 text-red-800 border-red-300';
    case 'staging': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'decommissioned': return 'bg-gray-100 text-gray-600 border-gray-300';
  }
}

function severityColor(s: AlertSeverity): string {
  switch (s) {
    case 'critical': return 'bg-red-50 border-red-200 text-red-800';
    case 'warning': return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
    case 'ok': return 'bg-green-50 border-green-200 text-green-800';
  }
}

function severityIcon(s: AlertSeverity) {
  switch (s) {
    case 'critical': return <AlertTriangle size={14} className="text-red-600" />;
    case 'warning': return <AlertCircle size={14} className="text-amber-600" />;
    case 'info': return <Info size={14} className="text-blue-600" />;
    case 'ok': return <CheckCircle size={14} className="text-green-600" />;
  }
}

function stageColor(s: Prospect['stage']): string {
  switch (s) {
    case 'lead': return 'bg-gray-100 text-gray-700';
    case 'contacted': return 'bg-blue-50 text-blue-700';
    case 'demo_scheduled': return 'bg-indigo-50 text-indigo-700';
    case 'proposal_sent': return 'bg-purple-50 text-purple-700';
    case 'negotiating': return 'bg-amber-50 text-amber-700';
    case 'closed_won': return 'bg-green-100 text-green-800';
    case 'closed_lost': return 'bg-red-50 text-red-600';
  }
}

function stageLabel(s: Prospect['stage']): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PEARLCommandCenter(props: Props) {
  const { onClose } = props;
  const { logout, user } = useAuth();

  const [viewLens, setViewLens] = useState<ViewLens>('operations');
  const [deployments] = useState<Deployment[]>(() => generateDeployments());
  const [prospects] = useState<Prospect[]>(() => generateProspects());
  const [expandedDeployment, setExpandedDeployment] = useState<string | null>('dep-milton-fl-001');
  const [expandedProspect, setExpandedProspect] = useState<string | null>(null);
  const [showGPMCalc, setShowGPMCalc] = useState(false);

  // GPM Calculator state
  const [gpmInputs, setGpmInputs] = useState<GPMCalcInputs>({
    drainageArea_acres: 50,
    imperviousPercent: 45,
    rainfallIntensity_inhr: 0.15,
    designCapturePercent: 85,
  });

  const gpmResult = useMemo(() => calculateGPM(gpmInputs), [gpmInputs]);

  // Run delta analysis on active deployments
  const allAlerts = useMemo(() => {
    return deployments.flatMap(d => {
      const computed = analyzeDelta(d);
      return [...d.alerts, ...computed].map(a => ({ ...a, deploymentName: d.name, deploymentId: d.id }));
    });
  }, [deployments]);

  const criticalAlerts = allAlerts.filter(a => a.severity === 'critical');
  const warningAlerts = allAlerts.filter(a => a.severity === 'warning');
  const activeDeployments = deployments.filter(d => d.status === 'active');
  const totalGPM = activeDeployments.reduce((s, d) => s + (d.lastReading?.flow_gpm || 0), 0);
  const totalGallons = deployments.reduce((s, d) => s + d.totalGallonsTreated, 0);
  const avgUptime = activeDeployments.length > 0 ? activeDeployments.reduce((s, d) => s + d.uptime, 0) / activeDeployments.length : 0;
  const pipelineValue = prospects.filter(p => !['closed_won', 'closed_lost'].includes(p.stage)).reduce((s, p) => s + p.estimatedACV, 0);

  // ── National Water Health Score ──
  // Baseline: national water quality is poor (~31/100 based on ATTAINS impairment rates)
  // Each active PEARL deployment nudges it up. This is the number we're trying to move.
  const baselineHealth = 31; // ~69% of US waterbodies have some impairment (ATTAINS 2022)
  const pearlBoost = activeDeployments.length * 0.8 + (totalGallons / 1e8) * 2;
  const nationalHealthScore = Math.min(100, Math.round(baselineHealth + pearlBoost));

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/PearlLogo.png" alt="PEARL" width={32} height={32} className="rounded" />
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">PEARL Intelligence Network — Operations Command Center</h1>
                <p className="text-[10px] text-slate-400 font-mono">Internal Operations · {user?.name || 'Admin'} · {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Lens Switcher */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {(['operations', 'proposals'] as ViewLens[]).map(lens => (
                  <button
                    key={lens}
                    onClick={() => setViewLens(lens)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                      viewLens === lens
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {lens === 'operations' ? '⚙ Operations' : '📋 Proposals'}
                  </button>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={() => setShowGPMCalc(!showGPMCalc)}>
                <Calculator size={14} className="mr-1" /> GPM Calc
              </Button>

              {logout && (
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut size={14} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">

        {/* ── HERO BANNER ── */}
        <HeroBanner role="pearl" />

        {/* ── NATIONAL WATER HEALTH GAUGE ── */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* SVG Gauge */}
              <div className="relative flex-shrink-0">
                <svg width="220" height="140" viewBox="0 0 220 140">
                  {/* Gauge arc background segments: Red → Yellow → Green */}
                  {(() => {
                    const cx = 110, cy = 120, r = 90;
                    const startAngle = Math.PI; // 180° (left)
                    const endAngle = 0;          // 0° (right)
                    const segments = [
                      { from: 0, to: 0.25, color: '#ef4444' },   // 0-25: Critical
                      { from: 0.25, to: 0.45, color: '#f97316' }, // 25-45: Poor
                      { from: 0.45, to: 0.65, color: '#eab308' }, // 45-65: Fair
                      { from: 0.65, to: 0.85, color: '#84cc16' }, // 65-85: Good
                      { from: 0.85, to: 1.0, color: '#22c55e' },  // 85-100: Excellent
                    ];
                    return segments.map((seg, i) => {
                      const a1 = startAngle - seg.from * Math.PI;
                      const a2 = startAngle - seg.to * Math.PI;
                      const x1 = cx + r * Math.cos(a1);
                      const y1 = cy - r * Math.sin(a1);
                      const x2 = cx + r * Math.cos(a2);
                      const y2 = cy - r * Math.sin(a2);
                      const largeArc = (seg.to - seg.from) > 0.5 ? 1 : 0;
                      return (
                        <path key={i}
                          d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`}
                          fill="none" stroke={seg.color} strokeWidth="14" strokeLinecap="round" opacity="0.2"
                        />
                      );
                    });
                  })()}

                  {/* Active gauge fill */}
                  {(() => {
                    const cx = 110, cy = 120, r = 90;
                    const pct = nationalHealthScore / 100;
                    const startAngle = Math.PI;
                    const sweepAngle = pct * Math.PI;
                    const endA = startAngle - sweepAngle;
                    const x1 = cx + r * Math.cos(startAngle);
                    const y1 = cy - r * Math.sin(startAngle);
                    const x2 = cx + r * Math.cos(endA);
                    const y2 = cy - r * Math.sin(endA);
                    const largeArc = pct > 0.5 ? 1 : 0;
                    const color = nationalHealthScore >= 85 ? '#22c55e' : nationalHealthScore >= 65 ? '#84cc16' : nationalHealthScore >= 45 ? '#eab308' : nationalHealthScore >= 25 ? '#f97316' : '#ef4444';
                    return (
                      <path
                        d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`}
                        fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
                      />
                    );
                  })()}

                  {/* Needle */}
                  {(() => {
                    const cx = 110, cy = 120;
                    const pct = nationalHealthScore / 100;
                    const angle = Math.PI - pct * Math.PI;
                    const needleLen = 70;
                    const nx = cx + needleLen * Math.cos(angle);
                    const ny = cy - needleLen * Math.sin(angle);
                    return (
                      <>
                        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx={cx} cy={cy} r="5" fill="#1e293b" />
                      </>
                    );
                  })()}

                  {/* Heart in center */}
                  <text x="110" y="105" textAnchor="middle" fontSize="28" fill="#ef4444">♥</text>

                  {/* Score */}
                  <text x="110" y="138" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#334155" fontFamily="monospace">
                    {nationalHealthScore} / 100
                  </text>

                  {/* Labels */}
                  <text x="18" y="128" textAnchor="start" fontSize="8" fill="#94a3b8">Critical</text>
                  <text x="202" y="128" textAnchor="end" fontSize="8" fill="#94a3b8">Excellent</text>
                </svg>
              </div>

              {/* Score context */}
              <div className="flex-1 text-center md:text-left">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">National Water Health Score</div>
                <div className="text-3xl font-bold text-slate-900 font-mono">{nationalHealthScore}<span className="text-lg text-slate-400">/100</span></div>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Based on EPA ATTAINS impairment data across {(116000).toLocaleString()} assessed waterbodies.
                  {pearlBoost > 0 && (
                    <span className="text-green-600 font-semibold"> PEARL is contributing +{pearlBoost.toFixed(1)} points from {activeDeployments.length} active deployment{activeDeployments.length !== 1 ? 's' : ''} treating {formatNumber(totalGallons)} gallons.</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    { label: 'Critical', range: '0–25', color: 'bg-red-500' },
                    { label: 'Poor', range: '25–45', color: 'bg-orange-500' },
                    { label: 'Fair', range: '45–65', color: 'bg-yellow-500' },
                    { label: 'Good', range: '65–85', color: 'bg-lime-500' },
                    { label: 'Excellent', range: '85–100', color: 'bg-green-500' },
                  ].map(({ label, range, color }) => (
                    <div key={label} className="flex items-center gap-1 text-[10px] text-slate-500">
                      <span className={`w-2 h-2 rounded-full ${color}`} />
                      {label} ({range})
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── AT-A-GLANCE SUMMARY ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Active Units', value: activeDeployments.length, sub: `${deployments.length} total`, icon: <Radio size={14} />, color: 'text-green-600' },
            { label: 'Live GPM', value: totalGPM.toFixed(0), sub: 'current throughput', icon: <Droplets size={14} />, color: 'text-blue-600' },
            { label: 'Gallons Treated', value: formatNumber(totalGallons), sub: 'lifetime', icon: <Activity size={14} />, color: 'text-cyan-600' },
            { label: 'Avg Uptime', value: `${avgUptime.toFixed(1)}%`, sub: 'active fleet', icon: <Gauge size={14} />, color: 'text-emerald-600' },
            { label: 'Critical Alerts', value: criticalAlerts.length, sub: warningAlerts.length + ' warnings', icon: <AlertTriangle size={14} />, color: criticalAlerts.length > 0 ? 'text-red-600' : 'text-slate-400' },
            { label: 'TSS Removal', value: '88–95%', sub: 'Milton validated', icon: <TrendingDown size={14} />, color: 'text-green-600' },
            { label: 'Pipeline', value: `$${formatNumber(pipelineValue)}`, sub: `${prospects.filter(p => !['closed_won','closed_lost'].includes(p.stage)).length} prospects`, icon: <DollarSign size={14} />, color: 'text-purple-600' },
            { label: 'Next Deploy', value: 'Apr 15', sub: 'AA County MD', icon: <Truck size={14} />, color: 'text-indigo-600' },
          ].map((tile) => (
            <Card key={tile.label} className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={tile.color}>{tile.icon}</span>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{tile.label}</span>
              </div>
              <div className="text-xl font-bold text-slate-900 font-mono">{tile.value}</div>
              <div className="text-[10px] text-slate-400">{tile.sub}</div>
            </Card>
          ))}
        </div>

        {/* ── GPM CALCULATOR (collapsible) ── */}
        {showGPMCalc && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calculator size={18} /> PEARL Unit Sizing Calculator
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowGPMCalc(false)}>
                  <X size={14} />
                </Button>
              </div>
              <CardDescription>Rational Method: Q = C × i × A → GPM → Unit recommendation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Inputs */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Site Parameters</h4>
                  {[
                    { label: 'Drainage Area', key: 'drainageArea_acres', unit: 'acres', min: 1, max: 5000, step: 5 },
                    { label: 'Impervious Cover', key: 'imperviousPercent', unit: '%', min: 0, max: 100, step: 5 },
                    { label: 'Rainfall Intensity (2yr/24hr)', key: 'rainfallIntensity_inhr', unit: 'in/hr', min: 0.05, max: 2.0, step: 0.05 },
                    { label: 'Design Capture', key: 'designCapturePercent', unit: '%', min: 50, max: 100, step: 5 },
                  ].map(({ label, key, unit, min, max, step }) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium">{label}</span>
                        <span className="font-mono text-slate-900 font-bold">
                          {(gpmInputs as any)[key]} {unit}
                        </span>
                      </div>
                      <input
                        type="range" min={min} max={max} step={step}
                        value={(gpmInputs as any)[key]}
                        onChange={(e) => setGpmInputs(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                        <span>{min} {unit}</span>
                        <span>{max} {unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Results */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Sizing Results</h4>

                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-sm text-slate-600">Runoff Coefficient (C)</span>
                      <span className="text-sm font-bold font-mono">{gpmResult.runoffCoeff.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-sm text-slate-600">Peak Flow</span>
                      <span className="text-sm font-bold font-mono">{gpmResult.peakFlow_gpm.toFixed(0)} GPM</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-sm text-slate-600">Design Flow ({gpmInputs.designCapturePercent}%)</span>
                      <span className="text-sm font-bold font-mono text-blue-700">{gpmResult.designGPM.toFixed(0)} GPM</span>
                    </div>
                  </div>

                  {/* Recommendation Box */}
                  <div className="mt-4 bg-white rounded-lg border-2 border-blue-200 p-4">
                    <div className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Recommended Configuration</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {gpmResult.unitsNeeded}× {gpmResult.recommended}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {gpmResult.unitSpec.gpm} GPM ea · {gpmResult.unitSpec.footprint} · {gpmResult.unitSpec.oysterCapacity}
                    </div>
                    <div className="flex gap-4 mt-3 pt-3 border-t border-blue-100">
                      <div>
                        <div className="text-[10px] text-slate-400">Est. Capital</div>
                        <div className="text-sm font-bold font-mono">${formatNumber(gpmResult.totalCost)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">TSS Removal</div>
                        <div className="text-sm font-bold font-mono text-green-700">{gpmResult.estimatedTSSRemoval}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Annual Vol.</div>
                        <div className="text-sm font-bold font-mono">{formatNumber(gpmResult.estimatedAnnualGallons)} gal</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── OPERATIONS LENS ──────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'operations' && (
          <>
            {/* ── ALERT FEED ── */}
            {allAlerts.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity size={16} /> AI Delta Analysis
                    <Badge variant="secondary" className="ml-2">{allAlerts.length} signals</Badge>
                  </CardTitle>
                  <CardDescription>Comparing live readings against installation baselines. Anomalies flagged with diagnosis + recommendation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {allAlerts.map((alert) => (
                    <div key={alert.id} className={`rounded-lg border p-3 ${severityColor(alert.severity)}`}>
                      <div className="flex items-start gap-2">
                        {severityIcon(alert.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold">{(alert as any).deploymentName}</span>
                            <span className="text-[10px] font-mono opacity-60">·</span>
                            <span className="text-xs font-semibold">{alert.parameter}</span>
                          </div>
                          <p className="text-xs mt-1 font-medium">{alert.message}</p>
                          <div className="flex gap-3 mt-1 text-[10px] font-mono opacity-70">
                            <span>Baseline: {alert.baseline} {alert.unit}</span>
                            <span>Current: {alert.current} {alert.unit}</span>
                            <span>Δ {alert.delta > 0 ? '+' : ''}{alert.delta.toFixed(1)}{alert.unit === '%' ? '' : ` ${alert.unit}`}</span>
                          </div>
                          <details className="mt-2">
                            <summary className="text-[10px] cursor-pointer font-semibold opacity-70 hover:opacity-100">Diagnosis & Recommendation</summary>
                            <div className="mt-1 text-xs space-y-1 opacity-80">
                              <p><strong>Diagnosis:</strong> {alert.diagnosis}</p>
                              <p><strong>Action:</strong> {alert.recommendation}</p>
                            </div>
                          </details>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ── DEPLOYMENT CARDS ── */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Radio size={14} /> Deployed Fleet ({deployments.length} units)
              </h2>

              {deployments.map((dep) => {
                const isExpanded = expandedDeployment === dep.id;
                const lr = dep.lastReading;
                const bl = dep.baselineReadings;

                return (
                  <Card key={dep.id} className={`overflow-hidden transition-all ${isExpanded ? 'ring-2 ring-blue-200' : ''}`}>
                    {/* Deployment Header */}
                    <div
                      className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedDeployment(isExpanded ? null : dep.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${dep.status === 'active' ? 'bg-green-500 animate-pulse' : dep.status === 'staging' ? 'bg-blue-400' : 'bg-gray-400'}`} />
                          <div>
                            <h3 className="font-bold text-slate-900">{dep.name}</h3>
                            <p className="text-xs text-slate-500">{dep.location}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={statusColor(dep.status)}>{dep.status}</Badge>
                          <span className="text-xs font-mono text-slate-400">{dep.unitModel}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      {/* Mini stats row */}
                      {dep.status === 'active' && lr && (
                        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                          {[
                            { label: 'Flow', value: `${lr.flow_gpm} GPM`, ok: lr.flow_gpm! > (bl.flow_gpm ?? 0) * 0.75 },
                            { label: 'DO', value: `${lr.do_mgl} mg/L`, ok: lr.do_mgl! >= 5.0 },
                            { label: 'TSS', value: `${lr.tss_mgl} mg/L`, ok: lr.tss_mgl! < 20 },
                            { label: 'Temp', value: `${lr.temp_c}°C`, ok: true },
                            { label: 'pH', value: lr.ph?.toFixed(1), ok: lr.ph! >= 6.5 && lr.ph! <= 8.5 },
                            { label: 'Uptime', value: `${dep.uptime}%`, ok: dep.uptime > 95 },
                          ].map(({ label, value, ok }) => (
                            <div key={label} className="text-center">
                              <div className="text-[9px] text-slate-400 uppercase">{label}</div>
                              <div className={`text-xs font-bold font-mono ${ok ? 'text-slate-700' : 'text-amber-600'}`}>{value}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Component Status */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Component Health</h4>
                            <div className="space-y-2">
                              {[
                                { label: 'Pump', status: dep.pumpStatus, icon: <Zap size={12} />,
                                  color: dep.pumpStatus === 'running' ? 'text-green-700 bg-green-50' : dep.pumpStatus === 'reduced_flow' ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50' },
                                { label: 'Oyster Bed', status: dep.oysterBedStatus.replace(/_/g, ' '), icon: <Shell size={12} />,
                                  color: dep.oysterBedStatus === 'healthy' ? 'text-green-700 bg-green-50' : dep.oysterBedStatus === 'new' ? 'text-blue-700 bg-blue-50' : 'text-amber-700 bg-amber-50' },
                                { label: 'Resin Media', status: dep.resinStatus.replace(/_/g, ' '), icon: <Filter size={12} />,
                                  color: dep.resinStatus === 'good' ? 'text-green-700 bg-green-50' : dep.resinStatus === 'new' ? 'text-blue-700 bg-blue-50' : 'text-amber-700 bg-amber-50' },
                              ].map(({ label, status, icon, color }) => (
                                <div key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${color}`}>
                                  {icon}
                                  <span className="text-xs font-medium flex-1">{label}</span>
                                  <span className="text-[10px] font-bold uppercase">{status}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Baseline vs Current */}
                          {lr && bl.timestamp && (
                            <div>
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Baseline → Current</h4>
                              <div className="space-y-1.5">
                                {[
                                  { label: 'DO', bl: bl.do_mgl, cur: lr.do_mgl, unit: 'mg/L', goodUp: true },
                                  { label: 'TSS', bl: bl.tss_mgl, cur: lr.tss_mgl, unit: 'mg/L', goodUp: false },
                                  { label: 'Turbidity', bl: bl.turbidity_ntu, cur: lr.turbidity_ntu, unit: 'NTU', goodUp: false },
                                  { label: 'Flow', bl: bl.flow_gpm, cur: lr.flow_gpm, unit: 'GPM', goodUp: false },
                                  { label: 'pH', bl: bl.ph, cur: lr.ph, unit: '', goodUp: false },
                                ].map(({ label, bl: b, cur, unit, goodUp }) => {
                                  const delta = b && cur != null ? ((cur - b) / b) * 100 : null;
                                  const isGood = delta != null && (goodUp ? delta > 0 : delta < 0);
                                  return (
                                    <div key={label} className="flex items-center gap-2 text-xs">
                                      <span className="w-16 text-slate-500">{label}</span>
                                      <span className="font-mono text-slate-400 w-16 text-right">{b} {unit}</span>
                                      <ChevronRight size={10} className="text-slate-300" />
                                      <span className="font-mono font-bold w-16 text-right">{cur} {unit}</span>
                                      {delta != null && (
                                        <span className={`font-mono text-[10px] font-bold ${isGood ? 'text-green-600' : Math.abs(delta) > 15 ? 'text-red-600' : 'text-amber-600'}`}>
                                          {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Deployment Info */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Deployment Info</h4>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between"><span className="text-slate-500">Unit</span><span className="font-mono font-bold">{dep.unitModel} ({dep.gpmCapacity} GPM)</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Installed</span><span className="font-mono">{dep.installDate}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Next Maint.</span><span className="font-mono">{dep.nextMaintenance}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Water Type</span><span className="font-mono capitalize">{dep.waterType}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Total Treated</span><span className="font-mono font-bold">{formatNumber(dep.totalGallonsTreated)} gal</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">TSS Removal</span><span className="font-mono font-bold text-green-700">{dep.tssRemovalRate}%</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Coordinates</span><span className="font-mono text-[10px]">{dep.lat.toFixed(4)}, {dep.lon.toFixed(4)}</span></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── PROPOSALS LENS ───────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'proposals' && (
          <>
            {/* Pipeline Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(['lead', 'contacted', 'demo_scheduled', 'proposal_sent', 'negotiating'] as Prospect['stage'][]).map(stage => {
                const count = prospects.filter(p => p.stage === stage).length;
                const value = prospects.filter(p => p.stage === stage).reduce((s, p) => s + p.estimatedACV, 0);
                return (
                  <Card key={stage} className="p-3 text-center">
                    <Badge className={`${stageColor(stage)} text-[10px] mb-1`}>{stageLabel(stage)}</Badge>
                    <div className="text-xl font-bold font-mono text-slate-900">{count}</div>
                    <div className="text-[10px] text-slate-400">{value > 0 ? `$${formatNumber(value)} ACV` : '—'}</div>
                  </Card>
                );
              })}
            </div>

            {/* Prospect Cards */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Target size={14} /> Active Pipeline ({prospects.length})
              </h2>

              {prospects.map((p) => {
                const isExpanded = expandedProspect === p.id;
                return (
                  <Card key={p.id} className={`overflow-hidden transition-all ${isExpanded ? 'ring-2 ring-purple-200' : ''}`}>
                    <div
                      className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedProspect(isExpanded ? null : p.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 size={16} className="text-slate-400" />
                          <div>
                            <h3 className="font-bold text-slate-900">{p.name}</h3>
                            <p className="text-xs text-slate-500">{p.jurisdiction} · {p.state} · {p.ms4PermitType}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={stageColor(p.stage)}>{stageLabel(p.stage)}</Badge>
                          {p.proposalReady && <Badge className="bg-green-100 text-green-700 border-green-300">Proposal Ready</Badge>}
                          {p.estimatedACV > 0 && <span className="text-sm font-bold font-mono text-slate-700">${formatNumber(p.estimatedACV)}</span>}
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Contact & Activity */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contact</h4>
                            <div className="space-y-2 text-xs">
                              {p.contactName && <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-medium">{p.contactName}</span></div>}
                              <div className="flex justify-between"><span className="text-slate-500">Title</span><span className="font-medium">{p.contactTitle}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Last Activity</span><span className="font-mono">{p.lastActivity}</span></div>
                            </div>
                          </div>

                          {/* Opportunity Data */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Opportunity</h4>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between"><span className="text-slate-500">Est. GPM</span><span className="font-mono font-bold">{p.estimatedGPM > 0 ? `${formatNumber(p.estimatedGPM)} GPM` : 'N/A'}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Units</span><span className="font-mono font-bold">{p.estimatedUnits || 'TBD'}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Annual Value</span><span className="font-mono font-bold text-green-700">{p.estimatedACV > 0 ? `$${formatNumber(p.estimatedACV)}` : 'Partner'}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Impaired WBs</span><span className="font-mono">{p.impairedWaterbodies || 'N/A'}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Freshness</span><span className={`font-mono font-bold ${p.freshnessScore < 20 ? 'text-red-600' : p.freshnessScore < 50 ? 'text-amber-600' : 'text-green-600'}`}>{p.freshnessScore}/100</span></div>
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notes</h4>
                            <p className="text-xs text-slate-600 leading-relaxed">{p.notes}</p>
                            {p.proposalReady && (
                              <Button size="sm" className="mt-3 w-full">
                                <FileText size={14} className="mr-1" /> Generate Proposal
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* ── FOOTER ── */}
        <div className="border-t border-slate-200 pt-3 mt-6">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="font-mono">PEARL Intelligence Network — Operations Command Center v1.0 · Internal Use Only · Local Seafood Projects Inc.</span>
            <span className="font-mono">Session {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
