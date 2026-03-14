'use client';

import { useEffect, useMemo, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { MockDataBadge } from './MockDataBadge';
import HeroBanner from './HeroBanner';

const CronHealthDashboard = lazy(() => import('./CronHealthDashboard'));
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, AreaChart, Area, Cell, PieChart, Pie,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X, AlertTriangle, AlertCircle, CheckCircle, Activity, Droplets,
  Gauge, TrendingUp, TrendingDown, BarChart3, DollarSign, Users,
  MapPin, Wrench, Shell, Zap, Clock, ThermometerSun, Wind,
  ChevronDown, ChevronUp, ChevronRight, Search, Filter, FileText,
  Calculator, Truck, Radio, Eye, Target, Building2,
  RefreshCw, Download, Send, Plus, Minus, Info, Printer
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import type { UserRole } from '@/lib/authTypes';
import { UserManagementPanel } from './UserManagementPanel';
import { AlertsManagementPanel } from './AlertsManagementPanel';
import WhatIfSimulator from './WhatIfSimulator';
import RestorationPlanner from '@/components/RestorationPlanner';
import PredictiveRiskEngine from './PredictiveRiskEngine';
import ScenarioPlannerPanel from './ScenarioPlannerPanel';
import RiskInvestigationFlow from './RiskInvestigationFlow';
import type { RiskPrediction, RiskForecastResult } from '@/lib/siteIntelTypes';
import { DataFreshnessFooter } from '@/components/DataFreshnessFooter';
import { GrantOpportunityMatcher } from './GrantOpportunityMatcher';
import BudgetPlannerPanel from '@/components/BudgetPlannerPanel';
import RoleTrainingGuide from '@/components/RoleTrainingGuide';
const PINQuiz = lazy(() => import('@/components/PINQuiz'));
import { useLensParam } from '@/lib/useLensParam';
import { usePearlFunding } from '@/lib/usePearlFunding';
import { AlertDeepDive, type DeepDiveAlert } from './AlertDeepDive';
import { AskPinUniversalCard } from '@/components/AskPinUniversalCard';

// ─── Types ──────────────────────────────────────────────────────────────────

type ViewLens = 'operations' | 'restoration' | 'opportunities' | 'grants' | 'proposals' | 'scenarios' | 'predictions' | 'scenario-planner' | 'budget-planner' | 'investigation' | 'users' | 'alerts' | 'quiz' | 'training';

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

interface SourceHealthEntry {
  id: string;
  name: string;
  status: 'online' | 'degraded' | 'offline';
  responseTimeMs: number;
  httpStatus: number | null;
  error: string | null;
  checkedAt: string;
}

type Props = {
  onClose: () => void;
  onToggleDevMode?: () => void;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const PIN_UNITS: Record<string, { gpm: number; footprint: string; price: number; oysterCapacity: string }> = {
  'PIN-200': { gpm: 200, footprint: "4' × 4'", price: 45000, oysterCapacity: '500 adults' },
  'PIN-500': { gpm: 500, footprint: "6' × 6'", price: 85000, oysterCapacity: '1,200 adults' },
  'PIN-1200': { gpm: 1200, footprint: "8' × 10'", price: 165000, oysterCapacity: '3,000 adults' },
  'PIN-2500': { gpm: 2500, footprint: "10' × 16'", price: 290000, oysterCapacity: '6,500 adults' },
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
      unitModel: 'PIN-500',
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
      unitModel: 'PIN-1200',
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

  // Recommend PIN unit
  let recommended = 'PIN-2500';
  if (designGPM <= 200) recommended = 'PIN-200';
  else if (designGPM <= 500) recommended = 'PIN-500';
  else if (designGPM <= 1200) recommended = 'PIN-1200';

  const unit = PIN_UNITS[recommended];
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

type OutreachInsight = {
  title: string;
  metric: string;
  whyItMatters: string;
  meetingHook: string;
};

type OutreachMetrics = {
  nationalHealthScore: number;
  activeUnits: number;
  gallonsTreated: number;
  avgUptime: number;
  criticalAlerts: number;
  warningAlerts: number;
  pipelineValue: number;
  topProspectName: string;
  topProspectAcv: number;
  tssRemoval: string;
  infraFailureLikelihood: number;
  infraFailureConfidence: string;
};

type OutreachContact = {
  name: string;
  title: string;
  organization: string;
};

const OUTREACH_ROLE_LABELS: Record<UserRole, string> = {
  Federal: 'Federal Agency',
  State: 'State Agency',
  Local: 'Local Government',
  MS4: 'MS4 Managers',
  Corporate: 'Sustainability',
  Researcher: 'Research & Science',
  College: 'Higher Education',
  NGO: 'NGO',
  K12: 'K-12 Education',
  Temp: 'Temporary / Pilot',
  Pearl: 'PIN Admin',
  Utility: 'Utility Operations',
  Agriculture: 'Agriculture',
  Lab: 'Laboratory',
  Biotech: 'Biotech',
  Investor: 'Investor',
};

const OUTREACH_ROLE_ORDER: UserRole[] = [
  'MS4', 'State', 'Federal', 'NGO', 'Corporate',
  'Local', 'Utility', 'Agriculture', 'Lab', 'Biotech',
  'Investor', 'Researcher', 'College', 'K12', 'Temp', 'Pearl',
];

const OUTREACH_CONTACTS: Record<UserRole, OutreachContact[]> = {
  MS4: [
    { name: 'Erik Michelson', title: 'Stormwater Program Manager', organization: 'Anne Arundel County MS4' },
    { name: 'Nina Alvarez', title: 'MS4 Compliance Lead', organization: 'City of Pensacola Public Works' },
  ],
  State: [
    { name: 'Megan Carter', title: 'Water Standards Program Manager', organization: 'State Agency Water Division' },
    { name: 'James Patel', title: 'NPDES Oversight Lead', organization: 'State Compliance Bureau' },
  ],
  Federal: [
    { name: 'Taylor Nguyen', title: 'Program Analyst', organization: 'Federal Water Programs Office' },
    { name: 'Chris Morgan', title: 'Regional Enforcement Coordinator', organization: 'EPA Regional Office' },
  ],
  NGO: [
    { name: 'Ari Johnson', title: 'Watershed Director', organization: 'Regional Watershed Alliance' },
    { name: 'Maya Brooks', title: 'Policy & Advocacy Lead', organization: 'Clean Water Coalition' },
  ],
  Corporate: [
    { name: 'Jordan Lee', title: 'Director of Sustainability', organization: 'Enterprise ESG Office' },
    { name: 'Sam Rivera', title: 'Water Stewardship Manager', organization: 'Corporate Sustainability Team' },
  ],
  Local: [
    { name: 'Alex Brown', title: 'Public Works Director', organization: 'City Public Works' },
    { name: 'Riley Chen', title: 'Environmental Programs Manager', organization: 'County Government' },
  ],
  Utility: [
    { name: 'Morgan White', title: 'Operations Superintendent', organization: 'Regional Utility Authority' },
    { name: 'Cameron Davis', title: 'Treatment Plant Manager', organization: 'Water Utility Operations' },
  ],
  Agriculture: [
    { name: 'Evan Reed', title: 'Conservation Program Lead', organization: 'Ag Water Stewardship Office' },
    { name: 'Paige Flores', title: 'Nutrient Management Coordinator', organization: 'Regional Ag Partnership' },
  ],
  Lab: [
    { name: 'Priya Shah', title: 'Lab Director', organization: 'Water Quality Laboratory' },
    { name: 'Noah Kim', title: 'QA/QC Manager', organization: 'Environmental Testing Lab' },
  ],
  Biotech: [
    { name: 'Harper Green', title: 'R&D Program Manager', organization: 'Biotech Water Innovation Team' },
    { name: 'Drew Hall', title: 'Pilot Operations Lead', organization: 'Applied Biofiltration Group' },
  ],
  Investor: [
    { name: 'Casey Bell', title: 'Portfolio Risk Lead', organization: 'Infrastructure Investment Group' },
    { name: 'Reese Moore', title: 'ESG Analyst', organization: 'Water Impact Fund' },
  ],
  Researcher: [
    { name: 'Dr. Ana Kim', title: 'Principal Investigator', organization: 'University Research Lab' },
    { name: 'Dr. Liam Scott', title: 'Research Program Director', organization: 'Water Science Institute' },
  ],
  College: [
    { name: 'Prof. Dana Wright', title: 'Faculty Lead', organization: 'College Environmental Program' },
    { name: 'Dr. Theo Price', title: 'Dean of Applied Sciences', organization: 'College of Science' },
  ],
  K12: [
    { name: 'Pat Taylor', title: 'STEM Coordinator', organization: 'K-12 District Office' },
    { name: 'Jamie Ellis', title: 'Science Curriculum Lead', organization: 'School District Programs' },
  ],
  Temp: [
    { name: 'Chris Lane', title: 'Pilot Coordinator', organization: 'Temporary Program Team' },
    { name: 'Robin Fox', title: 'Project Associate', organization: 'Field Pilot Operations' },
  ],
  Pearl: [
    { name: 'Doug', title: 'PIN Admin', organization: 'Project PEARL' },
    { name: 'Gwen', title: 'PIN Ops', organization: 'Project PEARL' },
  ],
};

function ctaByRole(role: UserRole): string {
  switch (role) {
    case 'MS4':
    case 'Local':
      return 'Could we set a 25-minute working session next week to map this directly to permit milestones and outfall priorities?';
    case 'State':
    case 'Federal':
      return 'Would you be open to a 25-minute interagency briefing next week so we can align this dataset with reporting and enforcement priorities?';
    case 'NGO':
      return 'Could we schedule a 25-minute strategy call next week to align your advocacy and project pipeline around these top-risk signals?';
    case 'Corporate':
    case 'Investor':
      return 'Would you be open to a 25-minute executive review next week to connect these water risk signals to ESG performance and capital decisions?';
    case 'Utility':
      return 'Could we set a 25-minute operations review next week to prioritize the highest-impact treatment and maintenance actions?';
    case 'Researcher':
    case 'College':
    case 'K12':
      return 'Would you be open to a 25-minute collaboration call next week to scope research, curriculum, or field-study opportunities from this dataset?';
    case 'Agriculture':
      return 'Could we set a 25-minute planning call next week to target the highest-impact runoff reduction opportunities from this snapshot?';
    case 'Lab':
      return 'Would you be open to a 25-minute QA/QC planning call next week so this dataset can drive urgent sampling priorities?';
    case 'Biotech':
      return 'Could we schedule a 25-minute technical meeting next week to map these signals to pilot deployments and measurable outcomes?';
    case 'Temp':
    case 'Pearl':
      return 'Can we lock a 25-minute planning session next week to convert these insights into a prioritized execution plan?';
    default:
      return 'Would you be open to a 25-minute meeting next week to review this together and align on next actions?';
  }
}

function scoreGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}

function scoreBar(score: number, width = 10): string {
  const clamped = Math.max(0, Math.min(100, score));
  const filled = Math.round((clamped / 100) * width);
  return `${'#'.repeat(filled)}${'-'.repeat(width - filled)}`;
}

function generateRoleInsights(role: UserRole, m: OutreachMetrics): OutreachInsight[] {
  const shared: OutreachInsight[] = [
    {
      title: 'KPI snapshot: water quality grade',
      metric: `Grade ${scoreGrade(m.nationalHealthScore)} | ${m.nationalHealthScore}/100 | [${scoreBar(m.nationalHealthScore)}]`,
      whyItMatters: 'This gives a quick visual status snapshot you can drop directly into stakeholder updates.',
      meetingHook: 'We can map your scope to the largest score movers first.',
    },
    {
      title: "Don't be the next Potomac spill",
      metric: `${m.infraFailureLikelihood}% infrastructure failure likelihood (${m.infraFailureConfidence} confidence)`,
      whyItMatters: 'This quantifies near-term failure pressure before it becomes a visible public incident.',
      meetingHook: 'We can build a prevention-first action list tied to your highest-consequence assets and outfalls.',
    },
    {
      title: 'Operational reliability signal',
      metric: `${m.activeUnits} active units at ${m.avgUptime.toFixed(1)}% avg uptime`,
      whyItMatters: 'Reliability is what turns pilots into defensible long-term programs.',
      meetingHook: 'We can review where reliability gains are strongest and where to scale next.',
    },
    {
      title: 'Verified treatment throughput',
      metric: `${formatNumber(m.gallonsTreated)} gallons treated`,
      whyItMatters: 'Throughput translates technical performance into real-world impact.',
      meetingHook: 'We can estimate equivalent impact in your target jurisdiction or program area.',
    },
    {
      title: 'Risk pressure snapshot',
      metric: `${m.criticalAlerts} critical and ${m.warningAlerts} warning signals`,
      whyItMatters: 'This identifies where delayed action could compound cost and exposure.',
      meetingHook: 'We can prioritize a short list of high-consequence interventions.',
    },
  ];

  if (role === 'MS4' || role === 'Local' || role === 'Utility') {
    shared[4] = {
      title: 'Compliance leverage point',
      metric: `TSS performance band ${m.tssRemoval}`,
      whyItMatters: 'This supports permit-facing outcomes while improving service reliability.',
      meetingHook: 'We can map this directly to annual reporting milestones.',
    };
  }

  if (role === 'State' || role === 'Federal') {
    shared[4] = {
      title: 'Oversight prioritization',
      metric: `${m.criticalAlerts + m.warningAlerts} total active risk signals`,
      whyItMatters: 'This helps allocate response capacity where impact is highest.',
      meetingHook: 'We can set a triage model by severity and watershed exposure.',
    };
  }

  if (role === 'NGO' || role === 'Researcher' || role === 'College' || role === 'K12') {
    shared[4] = {
      title: 'Program storytelling with evidence',
      metric: `${formatNumber(m.gallonsTreated)} gallons + ${m.tssRemoval} treatment performance`,
      whyItMatters: 'Evidence-backed impact strengthens grants, public trust, and partnerships.',
      meetingHook: 'We can tailor this into outreach, education, or proposal-ready messaging.',
    };
  }

  return shared;
}

function lerpHexColor(a: string, b: string, t: number) {
  const ah = a.replace('#', '');
  const bh = b.replace('#', '');
  const ar = parseInt(ah.slice(0, 2), 16), ag = parseInt(ah.slice(2, 4), 16), ab = parseInt(ah.slice(4, 6), 16);
  const br = parseInt(bh.slice(0, 2), 16), bg = parseInt(bh.slice(2, 4), 16), bb = parseInt(bh.slice(4, 6), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

function NationalHealthGauge({ score }: { score: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clamped = Math.max(0, Math.min(100, score));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = 280;
    const cssH = 160;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const cx = cssW / 2;
    const cy = cssH - 22;
    const r = 108;
    const lineWidth = 16;
    const startAngle = Math.PI;

    const steps = 120;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const a1 = startAngle + t * Math.PI;
      const a2 = startAngle + ((i + 1) / steps) * Math.PI;

      let color: string;
      if (t < 0.25) color = lerpHexColor('#ef4444', '#f59e0b', t / 0.25);
      else if (t < 0.45) color = lerpHexColor('#f59e0b', '#eab308', (t - 0.25) / 0.20);
      else if (t < 0.65) color = lerpHexColor('#eab308', '#84cc16', (t - 0.45) / 0.20);
      else if (t < 0.85) color = lerpHexColor('#84cc16', '#22c55e', (t - 0.65) / 0.20);
      else color = lerpHexColor('#22c55e', '#16a34a', (t - 0.85) / 0.15);

      ctx.beginPath();
      ctx.arc(cx, cy, r, a1, a2 + 0.02);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'butt';
      ctx.stroke();
    }

    const needleAngle = startAngle + (clamped / 100) * Math.PI;
    const needleLen = r - 8;
    const nx = cx + Math.cos(needleAngle) * needleLen;
    const ny = cy + Math.sin(needleAngle) * needleLen;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx + 1, ny + 1);
    ctx.strokeStyle = 'rgba(15,23,42,0.18)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('0', cx - r - 8, cy + 6);
    ctx.fillText('50', cx, cy - r - 8);
    ctx.fillText('100', cx + r + 8, cy + 6);
  }, [clamped]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  return <canvas ref={canvasRef} className="mx-auto block" />;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PEARLManagementCenter(props: Props) {
  const { onClose } = props;
  const { user, isAdmin, listPendingUsers } = useAuth();

  const [viewLens, setViewLens] = useLensParam<ViewLens>('operations');
  const { grants: pearlGrants, funders: pearlFunders, loading: pearlFundingLoading } = usePearlFunding();
  const [pendingUserCount, setPendingUserCount] = useState(0);
  const [investigationRisk, setInvestigationRisk] = useState<RiskPrediction | null>(null);
  const [riskForecast, setRiskForecast] = useState<RiskForecastResult | null>(null);
  const [riskLoading, setRiskLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin && (viewLens === 'users' || viewLens === 'alerts')) {
      setViewLens('operations');
    }
  }, [isAdmin, viewLens, setViewLens]);

  // Fetch pending count on mount for admin users
  useEffect(() => {
    if (isAdmin) {
      listPendingUsers().then(p => setPendingUserCount(p.length)).catch(() => {});
    }
  }, [isAdmin, listPendingUsers]);
  const [deployments] = useState<Deployment[]>(() => generateDeployments());
  const [prospects] = useState<Prospect[]>(() => generateProspects());
  const [expandedDeployment, setExpandedDeployment] = useState<string | null>('dep-milton-fl-001');
  const [expandedProspect, setExpandedProspect] = useState<string | null>(null);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [showGPMCalc, setShowGPMCalc] = useState(false);
  const [outreachRole, setOutreachRole] = useState<UserRole>('MS4');
  const [outreachContact, setOutreachContact] = useState('');
  const [outreachRecipient, setOutreachRecipient] = useState('');
  const [outreachOrg, setOutreachOrg] = useState('');
  const [outreachSeed, setOutreachSeed] = useState(() => Date.now());
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [grantAudience, setGrantAudience] = useState<UserRole>('State');
  const [grantStateAbbr, setGrantStateAbbr] = useState('MD');
  const [sourceHealth, setSourceHealth] = useState<SourceHealthEntry[]>([]);
  const [sourceHealthLoading, setSourceHealthLoading] = useState<boolean>(true);
  const [sourceHealthError, setSourceHealthError] = useState<string | null>(null);
  const [totalMonitoringPoints, setTotalMonitoringPoints] = useState<number>(0);

  // Fetch real risk predictions from site-intelligence API using the first active deployment
  useEffect(() => {
    const primary = deployments.find(d => d.status === 'active');
    if (!primary) { setRiskLoading(false); return; }
    fetch(`/api/site-intelligence?lat=${primary.lat}&lng=${primary.lon}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.riskForecast) setRiskForecast(data.riskForecast);
      })
      .catch(() => {})
      .finally(() => setRiskLoading(false));
  }, [deployments]);

  useEffect(() => {
    let cancelled = false;
    setSourceHealthLoading(true);
    fetch('/api/source-health', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.sources) ? data.sources : [];
        setSourceHealth(list);
        setSourceHealthError(null);
        if (typeof data?.datapoints?.totalMonitoringPoints === 'number') {
          setTotalMonitoringPoints(data.datapoints.totalMonitoringPoints);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setSourceHealth([]);
        setSourceHealthError(e instanceof Error ? e.message : 'Failed to load source health');
      })
      .finally(() => {
        if (!cancelled) setSourceHealthLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Demo Mode toggle (persisted in localStorage) ──
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('pearl-demo-mode');
    return stored === null ? true : stored === 'true';
  });

  const toggleDemoMode = useCallback(() => {
    setDemoMode(prev => {
      const next = !prev;
      localStorage.setItem('pearl-demo-mode', String(next));
      return next;
    });
  }, []);

  // GPM Calculator state
  const [gpmInputs, setGpmInputs] = useState<GPMCalcInputs>({
    drainageArea_acres: 50,
    imperviousPercent: 45,
    rainfallIntensity_inhr: 0.15,
    designCapturePercent: 85,
  });

  const gpmResult = useMemo(() => calculateGPM(gpmInputs), [gpmInputs]);
  const adminGrantStateOptions = useMemo(() => {
    const states = new Set<string>(['MD', 'FL', 'TX', 'LA', 'NY', 'OH', 'CA', 'WA']);
    deployments.forEach((d) => states.add(d.state));
    prospects.forEach((p) => states.add(p.state));
    return [...states].sort();
  }, [deployments, prospects]);
  const roleContacts = useMemo(() => OUTREACH_CONTACTS[outreachRole] ?? [], [outreachRole]);
  const selectedContactInfo = useMemo(
    () => roleContacts.find((c) => c.name === outreachContact) ?? null,
    [roleContacts, outreachContact]
  );

  useEffect(() => {
    const first = roleContacts[0];
    if (!first) return;
    setOutreachContact(first.name);
    setOutreachRecipient(first.name);
    setOutreachOrg(first.organization);
  }, [outreachRole, roleContacts]);

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
  const topOpenProspect = useMemo(
    () => prospects
      .filter(p => !['closed_won', 'closed_lost'].includes(p.stage))
      .sort((a, b) => b.estimatedACV - a.estimatedACV)[0] ?? null,
    [prospects]
  );

  // ── National Water Health Score ──
  // Baseline: national water quality is poor (~31/100 based on ATTAINS impairment rates)
  // Each active PIN deployment nudges it up. This is the number we're trying to move.
  const baselineHealth = 31; // ~69% of US waterbodies have some impairment (ATTAINS 2022)
  const pinBoostRaw = activeDeployments.length * 0.8 + (totalGallons / 1e8) * 2;
  const pinBoost = demoMode ? pinBoostRaw : 0;
  const nationalHealthScoreRaw = Math.min(100, Math.round(baselineHealth + pinBoostRaw));
  const nationalHealthScore = demoMode ? nationalHealthScoreRaw : baselineHealth + 1; // 32 in demo, 32 baseline in live (from ATTAINS)

  // ── Demo vs Live display values ──
  const displayActiveUnits = demoMode ? activeDeployments.length : 0;
  const displayTotalUnits = demoMode ? deployments.length : 0;
  const displayGPM = demoMode ? totalGPM : 0;
  const displayGallons = demoMode ? totalGallons : 0;
  const displayUptime = demoMode ? avgUptime : 0;
  const displayUptimeLabel = demoMode ? `${avgUptime.toFixed(1)}%` : 'N/A';
  const displayCritical = demoMode ? criticalAlerts.length : 0;
  const displayWarnings = demoMode ? warningAlerts.length : 0;
  const displayTSS = demoMode ? '88\u201395%' : 'No deployments';
  const displayTSSSub = demoMode ? 'Milton validated' : '88\u201395% (Milton pilot, Jan 2026)';
  const displayPipelineValue = demoMode ? pipelineValue : 0;
  const displayPipelineProspects = demoMode ? prospects.filter(p => !['closed_won','closed_lost'].includes(p.stage)).length : 0;
  const displayNextDeploy = demoMode ? 'Apr 15' : 'TBD';
  const displayNextDeploySub = demoMode ? 'AA County MD' : 'Pending';
  const totalSourceCount = sourceHealth.length;
  const onlineSourceCount = sourceHealth.filter((s) => s.status === 'online').length;
  const degradedSourceCount = sourceHealth.filter((s) => s.status === 'degraded').length;
  const offlineSourceCount = sourceHealth.filter((s) => s.status === 'offline').length;
  const unhealthySources = sourceHealth
    .filter((s) => s.status !== 'online')
    .sort((a, b) => (a.status === 'offline' ? -1 : 1) - (b.status === 'offline' ? -1 : 1));
  const outreachDatasetId = useMemo(() => {
    const t = new Date(outreachSeed);
    const y = t.getUTCFullYear();
    const m = String(t.getUTCMonth() + 1).padStart(2, '0');
    const d = String(t.getUTCDate()).padStart(2, '0');
    const h = String(t.getUTCHours()).padStart(2, '0');
    const min = String(t.getUTCMinutes()).padStart(2, '0');
    return `PIN-${y}${m}${d}-${h}${min}`;
  }, [outreachSeed]);

  const outreachMetrics = useMemo<OutreachMetrics>(() => ({
    // Prefer model-based infrastructure-failure risk from site-intelligence when available.
    // Fallback keeps the outreach builder deterministic even when API data is unavailable.
    infraFailureLikelihood: (() => {
      const infraPrediction = riskForecast?.predictions?.find(p => p.category === 'infrastructure-failure');
      if (infraPrediction) return Math.round(infraPrediction.probability);
      return Math.max(10, Math.min(95, 20 + (displayCritical * 12) + (displayWarnings * 4)));
    })(),
    infraFailureConfidence: (() => {
      const infraPrediction = riskForecast?.predictions?.find(p => p.category === 'infrastructure-failure');
      return infraPrediction?.confidence ?? 'MODELED';
    })(),
    nationalHealthScore,
    activeUnits: displayActiveUnits,
    gallonsTreated: displayGallons,
    avgUptime: displayUptime,
    criticalAlerts: displayCritical,
    warningAlerts: displayWarnings,
    pipelineValue: displayPipelineValue,
    topProspectName: topOpenProspect?.name ?? 'No active prospect',
    topProspectAcv: topOpenProspect?.estimatedACV ?? 0,
    tssRemoval: displayTSS,
  }), [
    riskForecast,
    nationalHealthScore,
    displayActiveUnits,
    displayGallons,
    displayUptime,
    displayCritical,
    displayWarnings,
    displayPipelineValue,
    topOpenProspect,
    displayTSS,
  ]);

  const outreachInsights = useMemo(
    () => generateRoleInsights(outreachRole, outreachMetrics),
    [outreachRole, outreachMetrics, outreachSeed]
  );

  const outreachSubject = useMemo(
    () => `${OUTREACH_ROLE_LABELS[outreachRole]} briefing | Fresh PIN dataset ${outreachDatasetId}`,
    [outreachRole, outreachDatasetId]
  );

  const outreachBody = useMemo(() => {
    const name = outreachRecipient.trim() || 'there';
    const org = outreachOrg.trim();
    const insightLines = outreachInsights.map((insight, idx) =>
      `${idx + 1}. ${insight.title}: ${insight.metric}. ${insight.whyItMatters} ${insight.meetingHook}`
    ).join('\n');
    return `Hi ${name},

Hope your week is going well. We just generated a fresh PIN dataset snapshot (${outreachDatasetId}) for ${OUTREACH_ROLE_LABELS[outreachRole]}${org ? ` at ${org}` : ''}, and these are the top 5 signals we think are most likely to impact your priorities right now:

${insightLines}

${ctaByRole(outreachRole)}

If helpful, we can also bring a one-page summary that is ready to forward internally.

Best,
Doug and the PIN team`;
  }, [outreachRecipient, outreachOrg, outreachInsights, outreachRole, outreachDatasetId]);

  const outreachFullText = useMemo(
    () => `Subject: ${outreachSubject}\n\n${outreachBody}`,
    [outreachSubject, outreachBody]
  );

  const copyOutreach = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(outreachFullText);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Copy failed');
    }
    window.setTimeout(() => setCopyStatus(null), 1400);
  }, [outreachFullText]);

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">

        {/* ── HERO BANNER ── */}
        <HeroBanner role="pearl" onDoubleClick={() => props.onToggleDevMode?.()} />

        {/* Data Source Health, National Health Gauge, KPI tiles moved into Operations lens */}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── OPERATIONS LENS ──────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'operations' && (
          <>
            {/* ── DATA SOURCE HEALTH MONITOR ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity size={16} className="text-slate-700" />
                    Data Source Health
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {sourceHealthLoading ? 'Checking...' : `${onlineSourceCount}/${totalSourceCount || 34} Online`}
                  </Badge>
                </div>
                <CardDescription>
                  {sourceHealthError
                    ? `Health monitor unavailable (${sourceHealthError}).`
                    : `${offlineSourceCount} offline, ${degradedSourceCount} degraded, ${onlineSourceCount} online.`}
                  {!sourceHealthLoading && !sourceHealthError && totalMonitoringPoints > 0 && (
                    <span className="block mt-1 text-xs font-semibold text-slate-700">
                      Ingesting from {totalMonitoringPoints.toLocaleString()} monitoring points across {onlineSourceCount} live sources
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {sourceHealthLoading ? (
                  <div className="text-sm text-slate-500">Loading data source checks...</div>
                ) : sourceHealthError ? (
                  <div className="text-sm text-red-600">Unable to load source health right now.</div>
                ) : unhealthySources.length === 0 ? (
                  <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                    All monitored sources are online.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-slate-600">
                        <tr className="text-left border-b">
                          <th className="px-3 py-2 font-medium">Source</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Latency</th>
                          <th className="px-3 py-2 font-medium">Checked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unhealthySources.map((s) => (
                          <tr key={s.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2 text-slate-800">{s.name}</td>
                            <td className="px-3 py-2">
                              <Badge className={s.status === 'offline' ? 'bg-red-100 text-red-800 hover:bg-red-100' : 'bg-amber-100 text-amber-800 hover:bg-amber-100'}>
                                {s.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {typeof s.responseTimeMs === 'number' ? `${Math.round(s.responseTimeMs)} ms` : 'n/a'}
                            </td>
                            <td className="px-3 py-2 text-slate-500">{new Date(s.checkedAt).toLocaleTimeString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── CRON & CACHE HEALTH DASHBOARD ── */}
            <Suspense fallback={<Card><CardContent className="p-6 text-center text-slate-500">Loading cron health...</CardContent></Card>}>
              <CronHealthDashboard />
            </Suspense>

            {/* ── NATIONAL WATER HEALTH GAUGE ── */}
            <Card className="overflow-hidden relative">
          {/* Demo Mode watermark */}
          {demoMode && (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 flex items-start justify-center overflow-hidden">
              <div className="mt-1 px-3 py-0.5 rounded-b-md text-2xs font-bold uppercase tracking-widest" style={{ background: 'rgba(254,243,199,0.85)', color: '#92400e', border: '1px solid #fde68a', borderTop: 'none' }}>
                Demo Data
              </div>
            </div>
          )}
          <CardContent className="p-4 md:p-6">
            {/* Demo/Live toggle — top-right corner */}
            <div className="flex justify-end mb-2">
              <button
                onClick={toggleDemoMode}
                className="inline-flex items-center gap-2 select-none focus:outline-none"
                aria-label={demoMode ? 'Switch to live data' : 'Switch to demo data'}
              >
                <span className={`text-xs font-semibold transition-colors ${demoMode ? 'text-amber-700' : 'text-slate-400'}`}>Demo</span>
                <div
                  className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
                  style={{ background: demoMode ? '#f59e0b' : '#22c55e' }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: demoMode ? '2px' : '18px' }}
                  />
                </div>
                <span className={`text-xs font-semibold transition-colors ${!demoMode ? 'text-green-700' : 'text-slate-400'}`}>Live</span>
                {demoMode ? (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold uppercase tracking-wider" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>Demo Mode</span>
                ) : (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold uppercase tracking-wider" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>Live Data</span>
                )}
              </button>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Gauge */}
              <div className="relative flex-shrink-0">
                <NationalHealthGauge score={nationalHealthScore} />
              </div>

              {/* Score context */}
              <div className="flex-1 text-center md:text-left">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">National Water Health Score</div>
                <div className="text-3xl font-bold text-slate-900 font-mono">{nationalHealthScore}<span className="text-lg text-slate-400">/100</span></div>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Based on EPA ATTAINS impairment data across {(116000).toLocaleString()} assessed waterbodies.
                  {demoMode && pinBoost > 0 && (
                    <span className="text-green-600 font-semibold"> PIN is contributing +{pinBoost.toFixed(1)} points from {activeDeployments.length} active deployment{activeDeployments.length !== 1 ? 's' : ''} treating {formatNumber(totalGallons)} gallons.</span>
                  )}
                  {!demoMode && (
                    <span className="text-slate-400"> No active PIN deployments contributing to score.</span>
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
                    <div key={label} className="flex items-center gap-1 text-2xs text-slate-500">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Active Units', value: displayActiveUnits, sub: `${displayTotalUnits} total`, icon: <Radio size={16} />, color: displayActiveUnits > 0 ? 'text-green-600' : 'text-slate-400', bgColor: displayActiveUnits > 0 ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200' },
            { label: 'Live GPM', value: displayGPM.toFixed(0), sub: demoMode ? 'current throughput' : 'no active units', icon: <Droplets size={16} />, color: displayGPM > 0 ? 'text-blue-600' : 'text-slate-400', bgColor: displayGPM > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200' },
            { label: 'Gallons Treated', value: displayGallons > 0 ? formatNumber(displayGallons) : '0', sub: 'lifetime', icon: <Activity size={16} />, color: displayGallons > 0 ? 'text-cyan-600' : 'text-slate-400', bgColor: displayGallons > 0 ? 'bg-cyan-50 border-cyan-200' : 'bg-slate-50 border-slate-200' },
            { label: 'Avg Uptime', value: displayUptimeLabel, sub: demoMode ? 'active fleet' : 'no units deployed', icon: <Gauge size={16} />, color: demoMode ? 'text-emerald-600' : 'text-slate-400', bgColor: demoMode ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200', pct: demoMode ? displayUptime : undefined },
            { label: 'Critical Alerts', value: displayCritical, sub: displayWarnings + ' warning' + (displayWarnings !== 1 ? 's' : ''), icon: <AlertTriangle size={16} />, color: displayCritical > 0 ? 'text-red-600' : 'text-slate-400', bgColor: displayCritical > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200' },
            { label: 'TSS Removal', value: displayTSS, sub: displayTSSSub, icon: <TrendingDown size={16} />, color: demoMode ? 'text-green-600' : 'text-slate-400', bgColor: demoMode ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200' },
            { label: 'Pipeline', value: displayPipelineValue > 0 ? `$${formatNumber(displayPipelineValue)}` : '$0', sub: `${displayPipelineProspects} prospect${displayPipelineProspects !== 1 ? 's' : ''}`, icon: <DollarSign size={16} />, color: displayPipelineValue > 0 ? 'text-purple-600' : 'text-slate-400', bgColor: displayPipelineValue > 0 ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200' },
            { label: 'Next Deploy', value: displayNextDeploy, sub: displayNextDeploySub, icon: <Truck size={16} />, color: demoMode ? 'text-indigo-600' : 'text-slate-400', bgColor: demoMode ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200' },
          ].map((tile) => (
            <Card key={tile.label} className={`p-4 border ${tile.bgColor}`}>
              <div className="flex items-start gap-2.5">
                <div className={`rounded-lg p-1.5 bg-white/70 ${tile.color}`}>{tile.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-2xs text-slate-500 font-medium uppercase tracking-wider">{tile.label}</div>
                  <div className="text-xl font-bold text-slate-900 font-mono leading-tight">{tile.value}</div>
                  <div className="text-2xs text-slate-400 mt-0.5">{tile.sub}</div>
                  {tile.pct !== undefined && (
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/60 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(tile.pct, 100)}%` }} />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* ── GPM CALCULATOR (collapsible) ── */}
        {showGPMCalc && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calculator size={18} /> PIN Unit Sizing Calculator
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
                      <div className="flex justify-between text-2xs text-slate-400 mt-0.5">
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
                        <div className="text-2xs text-slate-400">Est. Capital</div>
                        <div className="text-sm font-bold font-mono">${formatNumber(gpmResult.totalCost)}</div>
                      </div>
                      <div>
                        <div className="text-2xs text-slate-400">TSS Removal</div>
                        <div className="text-sm font-bold font-mono text-green-700">{gpmResult.estimatedTSSRemoval}%</div>
                      </div>
                      <div>
                        <div className="text-2xs text-slate-400">Annual Vol.</div>
                        <div className="text-sm font-bold font-mono">{formatNumber(gpmResult.estimatedAnnualGallons)} gal</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

            {/* ── SENSOR ALERTS ── */}
            {allAlerts.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity size={16} /> Deployment Sensor Alerts
                    <Badge variant="secondary" className="ml-2">{allAlerts.length} signal{allAlerts.length !== 1 ? 's' : ''}</Badge>
                    {criticalAlerts.length > 0 && (
                      <Badge className="bg-red-100 text-red-700 text-2xs">{criticalAlerts.length} critical</Badge>
                    )}
                    {warningAlerts.length > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 text-2xs">{warningAlerts.length} warning</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>Live sensor readings compared against installation baselines. Click any alert for full analysis.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {allAlerts.map((alert) => {
                    const isExpanded = expandedAlertId === alert.id;
                    const sevStyle = severityColor(alert.severity);

                    if (isExpanded) {
                      // Convert to DeepDiveAlert format for the shared component
                      const deepDive: DeepDiveAlert = {
                        id: alert.id,
                        deployment_id: (alert as any).deploymentId || '',
                        deploymentName: (alert as any).deploymentName || '',
                        parameter: alert.parameter,
                        value: alert.current,
                        baseline: alert.baseline,
                        delta: alert.delta,
                        unit: alert.unit,
                        severity: alert.severity === 'ok' ? 'info' : alert.severity,
                        status: 'open',
                        title: `${(alert as any).deploymentName}: ${alert.message}`,
                        diagnosis: alert.diagnosis,
                        recommendation: alert.recommendation,
                        created_at: alert.timestamp,
                      };
                      return (
                        <AlertDeepDive
                          key={alert.id}
                          alert={deepDive}
                          inlineTimeline={[]}
                          inlineAcknowledgments={[]}
                          onClose={() => setExpandedAlertId(null)}
                        />
                      );
                    }

                    return (
                      <button
                        key={alert.id}
                        onClick={() => setExpandedAlertId(alert.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-all hover:shadow-md cursor-pointer ${sevStyle}`}
                      >
                        <div className="flex items-start gap-2">
                          {severityIcon(alert.severity)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold">{(alert as any).deploymentName}</span>
                              <Badge className={`text-2xs ${alert.severity === 'critical' ? 'bg-red-200 text-red-900' : alert.severity === 'warning' ? 'bg-amber-200 text-amber-900' : 'bg-blue-200 text-blue-900'}`}>
                                {alert.severity}
                              </Badge>
                              <span className="text-xs font-semibold">{alert.parameter}</span>
                            </div>
                            <p className="text-xs mt-1 font-medium">{alert.message}</p>
                            <div className="flex gap-3 mt-1 text-2xs font-mono opacity-70">
                              <span>Baseline: {alert.baseline} {alert.unit}</span>
                              <span>Current: {alert.current} {alert.unit}</span>
                              <span>Δ {alert.delta > 0 ? '+' : ''}{alert.delta.toFixed(1)}{alert.unit === '%' ? '' : ''}</span>
                            </div>
                            <div className="mt-1.5 text-2xs text-slate-500 font-medium">
                              Click for deep dive &rarr;
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* ── FLEET PERFORMANCE TRENDS ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 size={16} className="text-blue-600" /> Treatment Performance<MockDataBadge />
                  </CardTitle>
                  <CardDescription>Simulated 30-day sensor trend — Milton FL Pilot</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={(() => {
                      // Generate 30-day mock trend
                      const data = [];
                      for (let i = 30; i >= 0; i--) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        data.push({
                          date: `${d.getMonth() + 1}/${d.getDate()}`,
                          tss: Math.round(5 + Math.random() * 8),
                          do: +(6.5 + Math.random() * 1.5).toFixed(1),
                          turbidity: +(2 + Math.random() * 5).toFixed(1),
                        });
                      }
                      return data;
                    })()} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tssGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="doGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={4} />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={30} />
                      <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Area type="monotone" dataKey="tss" stroke="#3b82f6" strokeWidth={2} fill="url(#tssGrad)" name="TSS (mg/L)" />
                      <Area type="monotone" dataKey="do" stroke="#10b981" strokeWidth={2} fill="url(#doGrad)" name="DO (mg/L)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Gauge size={16} className="text-emerald-600" /> Removal Efficiency
                  </CardTitle>
                  <CardDescription>Contaminant reduction rates across fleet</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={[
                      { param: 'TSS', value: 90, target: 80 },
                      { param: 'Turbidity', value: 77, target: 70 },
                      { param: 'Nutrients', value: 45, target: 50 },
                      { param: 'Metals', value: 62, target: 60 },
                      { param: 'Pathogens', value: 55, target: 50 },
                      { param: 'Organics', value: 38, target: 40 },
                    ]} outerRadius={75}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="param" tick={{ fontSize: 10, fill: '#475569' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: '#94a3b8' }} tickCount={4} />
                      <Radar name="Actual %" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2} />
                      <Radar name="Target %" dataKey="target" stroke="#94a3b8" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* (Source Health Panel moved to below hero) */}

            {/* ── DEPLOYMENT CARDS ── */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Radio size={14} /> Deployed Fleet ({deployments.length} units)<MockDataBadge />
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
                              <div className="text-2xs text-slate-400 uppercase">{label}</div>
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
                                  <span className="text-2xs font-bold uppercase">{status}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Baseline vs Current — Visual Bar Comparison */}
                          {lr && bl.timestamp && (
                            <div>
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Baseline vs Current</h4>
                              <ResponsiveContainer width="100%" height={200}>
                                <BarChart
                                  data={[
                                    { name: 'DO', baseline: bl.do_mgl, current: lr.do_mgl, unit: 'mg/L' },
                                    { name: 'TSS', baseline: bl.tss_mgl, current: lr.tss_mgl, unit: 'mg/L' },
                                    { name: 'Turb', baseline: bl.turbidity_ntu, current: lr.turbidity_ntu, unit: 'NTU' },
                                    { name: 'pH', baseline: bl.ph, current: lr.ph, unit: '' },
                                  ]}
                                  layout="vertical"
                                  margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                                  barGap={2}
                                >
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={40} />
                                  <RTooltip
                                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number, name: string) => [value, name === 'baseline' ? 'Baseline' : 'Current']}
                                  />
                                  <Bar dataKey="baseline" fill="#cbd5e1" radius={[0, 4, 4, 0]} name="baseline" barSize={12} />
                                  <Bar dataKey="current" fill="#3b82f6" radius={[0, 4, 4, 0]} name="current" barSize={12} />
                                </BarChart>
                              </ResponsiveContainer>
                              <div className="flex justify-center gap-4 mt-1">
                                <div className="flex items-center gap-1.5 text-2xs text-slate-500"><span className="w-3 h-2 rounded-sm bg-slate-300" />Baseline</div>
                                <div className="flex items-center gap-1.5 text-2xs text-blue-600 font-medium"><span className="w-3 h-2 rounded-sm bg-blue-500" />Current</div>
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
                              <div className="flex justify-between"><span className="text-slate-500">Coordinates</span><span className="font-mono text-2xs">{dep.lat.toFixed(4)}, {dep.lon.toFixed(4)}</span></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* ── Ask PIN Universal ── */}
            <AskPinUniversalCard role="Pearl" />

          </>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── RESTORATION LENS ─────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'restoration' && (
          (() => {
            const activeDep = expandedDeployment ? deployments.find(d => d.id === expandedDeployment) : null;
            const lr = activeDep?.lastReading;
            const depWaterData: Record<string, { value: number; unit?: string }> | null = lr ? {
              ...(lr.do_mgl != null ? { DO: { value: lr.do_mgl, unit: 'mg/L' } } : {}),
              ...(lr.tss_mgl != null ? { TSS: { value: lr.tss_mgl, unit: 'mg/L' } } : {}),
              ...(lr.turbidity_ntu != null ? { Turbidity: { value: lr.turbidity_ntu, unit: 'NTU' } } : {}),
              ...(lr.ph != null ? { pH: { value: lr.ph, unit: '' } } : {}),
            } : null;
            return (
              <RestorationPlanner
                regionId={activeDep?.id || null}
                regionName={activeDep?.name}
                stateAbbr={activeDep?.state || 'US'}
                waterData={depWaterData}
                defaultAllStates
              />
            );
          })()
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── OPPORTUNITIES LENS ────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'opportunities' && (
          (() => {
            const now = new Date();
            const highFitGrants = pearlGrants.filter(g => g.fit >= 0.9);
            const activePursuitGrants = pearlGrants.filter(g => g.eligible === 'Yes' || g.eligible === 'Co-Sponsor');
            const activePursuitFunders = pearlFunders.filter(f => f.prospect === 'Yes');
            const upcomingGrants = pearlGrants
              .filter(g => g.closes && new Date(g.closes) > now)
              .sort((a, b) => new Date(a.closes!).getTime() - new Date(b.closes!).getTime());
            const nearestDeadline = upcomingGrants[0];
            const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
            const urgentGrants = upcomingGrants.filter(g => new Date(g.closes!) <= sixtyDaysOut);

            // Potential sources: not yet pursued, high fit
            const potentialFunders = pearlFunders.filter(f => f.prospect !== 'Yes' && f.fit >= 0.7);
            const potentialGrants = pearlGrants.filter(g => g.eligible !== 'Yes' && g.eligible !== 'Co-Sponsor' && g.fit >= 0.7)
              .sort((a, b) => b.fit - a.fit);

            const fitBadge = (fit: number) => {
              if (fit >= 0.9) return <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-green-100 text-green-800 border border-green-200">High</span>;
              if (fit >= 0.7) return <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-blue-100 text-blue-800 border border-blue-200">Good</span>;
              return <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Review</span>;
            };

            const isUrgent = (closes: string | null) => {
              if (!closes) return false;
              return new Date(closes) <= sixtyDaysOut;
            };

            if (pearlFundingLoading) {
              return <Card><CardContent className="py-12 text-center text-slate-500">Loading funding data...</CardContent></Card>;
            }

            return (
              <>
                {/* Pipeline Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target size={16} className="text-purple-600" /> Pipeline Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3 border text-center">
                        <div className="text-2xl font-bold text-slate-900">{pearlGrants.length}</div>
                        <div className="text-xs text-slate-500 font-medium">Total Grants</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border text-center">
                        <div className="text-2xl font-bold text-slate-900">{pearlFunders.length}</div>
                        <div className="text-xs text-slate-500 font-medium">Total Funders</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                        <div className="text-2xl font-bold text-green-700">{highFitGrants.length}</div>
                        <div className="text-xs text-green-600 font-medium">High-Fit Grants</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-center">
                        <div className="text-2xl font-bold text-blue-700">{activePursuitGrants.length + activePursuitFunders.length}</div>
                        <div className="text-xs text-blue-600 font-medium">Active Pursuits</div>
                      </div>
                      <div className={`rounded-lg p-3 border text-center ${nearestDeadline ? 'bg-amber-50 border-amber-200' : 'bg-slate-50'}`}>
                        <div className="text-sm font-bold text-amber-700">
                          {nearestDeadline ? new Date(nearestDeadline.closes!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </div>
                        <div className="text-xs text-amber-600 font-medium">Nearest Deadline</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Active Pursuits */}
                <Card className="border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity size={16} className="text-blue-600" /> Active Pursuits
                      <Badge variant="secondary" className="ml-2">{activePursuitGrants.length + activePursuitFunders.length}</Badge>
                    </CardTitle>
                    <CardDescription>Grants and funders currently being pursued</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[500px] overflow-y-auto border rounded-md">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-slate-600">
                          <tr className="text-left border-b">
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium">Source</th>
                            <th className="px-3 py-2 font-medium">Fit</th>
                            <th className="px-3 py-2 font-medium">Status / Notes</th>
                            <th className="px-3 py-2 font-medium">Deadline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activePursuitFunders.map((f) => (
                            <tr key={`f-${f.name}`} className="border-b last:border-b-0 hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-800 font-medium">
                                {f.website ? <a href={f.website} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{f.name}</a> : f.name}
                              </td>
                              <td className="px-3 py-2 text-slate-500 text-xs">{f.source}</td>
                              <td className="px-3 py-2">{fitBadge(f.fit)}</td>
                              <td className="px-3 py-2 text-xs text-slate-600 max-w-xs truncate">{f.notes}</td>
                              <td className="px-3 py-2 text-xs text-slate-400">Funder</td>
                            </tr>
                          ))}
                          {activePursuitGrants.map((g) => (
                            <tr key={`g-${g.name}`} className={`border-b last:border-b-0 hover:bg-slate-50 ${isUrgent(g.closes) ? 'bg-amber-50/50' : ''}`}>
                              <td className="px-3 py-2 text-slate-800 font-medium">{g.name}</td>
                              <td className="px-3 py-2 text-slate-500 text-xs">{g.source}</td>
                              <td className="px-3 py-2">{fitBadge(g.fit)}</td>
                              <td className="px-3 py-2 text-xs text-slate-600 max-w-xs truncate">
                                {g.eligible === 'Co-Sponsor' && g.coSponsor && <Badge variant="outline" className="mr-1 text-2xs">Co-sponsor: {g.coSponsor}</Badge>}
                                {g.notes}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {g.closes ? (
                                  <span className={isUrgent(g.closes) ? 'font-bold text-amber-700' : 'text-slate-600'}>
                                    {new Date(g.closes).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {isUrgent(g.closes) && ' !'}
                                  </span>
                                ) : <span className="text-slate-400">Open</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {urgentGrants.length > 0 && (
                      <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                        {urgentGrants.length} grant{urgentGrants.length > 1 ? 's' : ''} with deadline within 60 days
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Potential Sources */}
                <Card className="border-emerald-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Search size={16} className="text-emerald-600" /> Potential Sources
                      <Badge variant="secondary" className="ml-2">{potentialFunders.length + Math.min(potentialGrants.length, 50)}</Badge>
                    </CardTitle>
                    <CardDescription>High-fit funders and grants not yet pursued (fit &ge; 0.7)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {potentialFunders.length > 0 && (
                      <>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Funders ({potentialFunders.length})</div>
                        <div className="max-h-[300px] overflow-y-auto border rounded-md mb-4">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50 text-slate-600">
                              <tr className="text-left border-b">
                                <th className="px-3 py-2 font-medium">Name</th>
                                <th className="px-3 py-2 font-medium">Source</th>
                                <th className="px-3 py-2 font-medium">Fit</th>
                                <th className="px-3 py-2 font-medium">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {potentialFunders.sort((a, b) => b.fit - a.fit).map((f) => (
                                <tr key={f.name} className="border-b last:border-b-0 hover:bg-slate-50">
                                  <td className="px-3 py-2 text-slate-800 font-medium">
                                    {f.website ? <a href={f.website} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{f.name}</a> : f.name}
                                  </td>
                                  <td className="px-3 py-2 text-slate-500 text-xs">{f.source}</td>
                                  <td className="px-3 py-2">{fitBadge(f.fit)}</td>
                                  <td className="px-3 py-2 text-xs text-slate-600 max-w-xs truncate">{f.notes}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Grants ({potentialGrants.length})</div>
                    <div className="max-h-[400px] overflow-y-auto border rounded-md">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-slate-600">
                          <tr className="text-left border-b">
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium">Source</th>
                            <th className="px-3 py-2 font-medium">Fit</th>
                            <th className="px-3 py-2 font-medium">Notes</th>
                            <th className="px-3 py-2 font-medium">Deadline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {potentialGrants.slice(0, 50).map((g) => (
                            <tr key={g.name} className="border-b last:border-b-0 hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-800 font-medium">{g.name}</td>
                              <td className="px-3 py-2 text-slate-500 text-xs">{g.source}</td>
                              <td className="px-3 py-2">{fitBadge(g.fit)}</td>
                              <td className="px-3 py-2 text-xs text-slate-600 max-w-xs truncate">{g.notes}</td>
                              <td className="px-3 py-2 text-xs">
                                {g.closes ? (
                                  <span className="text-slate-600">{new Date(g.closes).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                ) : <span className="text-slate-400">Open</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {potentialGrants.length > 50 && (
                        <div className="px-3 py-2 text-xs text-slate-400 bg-slate-50 border-t">
                          Showing 50 of {potentialGrants.length} grants
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })()
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── PROPOSALS LENS ───────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── GRANTS LENS ────────────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'grants' && (
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-cyan-50/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign size={16} className="text-emerald-600" /> Grant Matching
              </CardTitle>
              <CardDescription>
                Agency-facing grant availability by role and state. No product positioning, just programs and fit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role</label>
                  <select
                    value={grantAudience}
                    onChange={(e) => setGrantAudience(e.target.value as UserRole)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
                  >
                    {(['Federal', 'State', 'Local', 'NGO'] as UserRole[]).map((role) => (
                      <option key={role} value={role}>{OUTREACH_ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">State</label>
                  <select
                    value={grantStateAbbr}
                    onChange={(e) => setGrantStateAbbr(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
                  >
                    {adminGrantStateOptions.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>

              <GrantOpportunityMatcher
                regionId={`admin_${grantStateAbbr.toLowerCase()}_grant_matching`}
                removalEfficiencies={{}}
                alertsCount={criticalAlerts.length}
                userRole={grantAudience}
                stateAbbr={grantStateAbbr}
              />
            </CardContent>
          </Card>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── PROPOSALS LENS ───────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'proposals' && (
          <>
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send size={16} className="text-indigo-600" /> Proposal Email Content Creator
                </CardTitle>
                <CardDescription>
                  Build role-specific proposal outreach copy with a fresh dataset and top impact signals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Audience</label>
                    <select value={outreachRole} onChange={(e) => setOutreachRole(e.target.value as UserRole)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm">
                      {OUTREACH_ROLE_ORDER.map((role) => (<option key={role} value={role}>{OUTREACH_ROLE_LABELS[role]}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recipient</label>
                    <select value={outreachContact} onChange={(e) => { const name = e.target.value; const selected = roleContacts.find((c) => c.name === name); setOutreachContact(name); setOutreachRecipient(name); if (selected) setOutreachOrg(selected.organization); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm">
                      {roleContacts.map((contact) => (<option key={contact.name} value={contact.name}>{contact.name} - {contact.title}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Organization</label>
                    <input value={outreachOrg} onChange={(e) => setOutreachOrg(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm" />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={() => setOutreachSeed(Date.now())} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"><RefreshCw size={14} className="mr-1.5" /> Fresh Dataset</Button>
                    <Button variant="outline" onClick={copyOutreach}><FileText size={14} className="mr-1.5" /> Copy</Button>
                  </div>
                </div>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2 text-xs text-indigo-800 flex items-center justify-between">
                  <span>Dataset: <strong>{outreachDatasetId}</strong> | Generated {new Date(outreachSeed).toLocaleString()}</span>
                  {copyStatus && <span className="font-semibold">{copyStatus}</span>}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Email Subject</p>
                  <p className="text-sm font-medium text-slate-800">{outreachSubject}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-3 mb-2">Email Body</p>
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans max-h-64 overflow-y-auto">{outreachBody}</pre>
                </div>
              </CardContent>
            </Card>
            {/* Pipeline Summary — Visual Funnel + Cards */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target size={16} className="text-purple-600" /> Sales Pipeline
                </CardTitle>
                <CardDescription>
                  Total pipeline: <span className="font-bold text-slate-900">${formatNumber(pipelineValue)}</span> ACV across {prospects.filter(p => !['closed_won','closed_lost'].includes(p.stage)).length} prospects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Funnel visualization */}
                  <div className="space-y-2">
                    {(['lead', 'contacted', 'demo_scheduled', 'proposal_sent', 'negotiating'] as Prospect['stage'][]).map((stage, i) => {
                      const count = prospects.filter(p => p.stage === stage).length;
                      const value = prospects.filter(p => p.stage === stage).reduce((s, p) => s + p.estimatedACV, 0);
                      const maxWidth = 100;
                      const width = maxWidth - (i * 14);
                      const colors = ['bg-slate-200', 'bg-blue-200', 'bg-indigo-300', 'bg-purple-400', 'bg-amber-400'];
                      const textColors = ['text-slate-700', 'text-blue-700', 'text-indigo-700', 'text-purple-800', 'text-amber-800'];
                      return (
                        <div key={stage} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div
                              className={`${colors[i]} rounded-lg py-2.5 px-4 flex items-center justify-between transition-all`}
                              style={{ width: `${width}%`, marginLeft: `${(100 - width) / 2}%` }}
                            >
                              <span className={`text-xs font-semibold ${textColors[i]}`}>{stageLabel(stage)}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${textColors[i]}`}>{count}</span>
                                {value > 0 && <span className="text-2xs opacity-70">${formatNumber(value)}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pipeline by ACV — bar chart */}
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={prospects
                        .filter(p => p.estimatedACV > 0 && !['closed_won','closed_lost'].includes(p.stage))
                        .sort((a, b) => b.estimatedACV - a.estimatedACV)
                        .map(p => ({ name: p.name.length > 18 ? p.name.slice(0, 16) + '...' : p.name, acv: p.estimatedACV / 1000, stage: p.stage }))}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}K`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={100} />
                      <RTooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        formatter={(value: number) => [`$${value}K`, 'Annual Value']}
                      />
                      <Bar dataKey="acv" radius={[0, 6, 6, 0]} barSize={16}>
                        {prospects
                          .filter(p => p.estimatedACV > 0 && !['closed_won','closed_lost'].includes(p.stage))
                          .sort((a, b) => b.estimatedACV - a.estimatedACV)
                          .map((_, i) => (
                            <Cell key={i} fill={['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe'][i % 5]} />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Prospect Cards */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Target size={14} /> Active Pipeline ({prospects.length})
              </h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
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
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── SCENARIOS LENS ─────────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'scenarios' && (
          <WhatIfSimulator />
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── PREDICTIONS LENS ────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'predictions' && (
          <PredictiveRiskEngine
            predictions={riskForecast?.predictions ?? null}
            dataCompleteness={riskForecast?.dataCompleteness}
            loading={riskLoading}
            onInvestigate={(risk) => {
              setInvestigationRisk(risk);
              setViewLens('investigation');
            }}
          />
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── SCENARIO PLANNER LENS ─────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'scenario-planner' && (
          <ScenarioPlannerPanel />
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── BUDGET PLANNER LENS ─────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'budget-planner' && (
          <BudgetPlannerPanel />
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── INVESTIGATION LENS ──────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'investigation' && (
          <RiskInvestigationFlow
            preSelectedRisk={investigationRisk}
            predictions={riskForecast?.predictions ?? null}
            onBackToForecast={() => {
              setInvestigationRisk(null);
              setViewLens('predictions');
            }}
          />
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── USERS LENS (admin only) ───────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'users' && isAdmin && (
          <UserManagementPanel onRefreshPendingCount={setPendingUserCount} />
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── ALERTS LENS (admin only) ───────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}

        {viewLens === 'alerts' && isAdmin && (
          <AlertsManagementPanel />
        )}

        {viewLens === 'quiz' && (
          <Suspense fallback={<div className="text-sm text-slate-400 py-8 text-center">Loading quiz...</div>}>
            <PINQuiz />
          </Suspense>
        )}

        {viewLens === 'training' && (
          <RoleTrainingGuide rolePath="/dashboard/pearl" />
        )}

        {/* ── FOOTER ── */}
        <div className="border-t border-slate-200 pt-3 mt-6">
          <div className="flex items-center justify-between text-2xs text-slate-400">
            <span className="font-mono">PIN — Operations Management Center v1.0 · Internal Use Only · Local Seafood Projects Inc.</span>
            <span className="font-mono">Session {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}



