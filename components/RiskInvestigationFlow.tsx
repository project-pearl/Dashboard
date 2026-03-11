'use client';

import React, { useState, useMemo } from 'react';
import {
  Search, ChevronRight, ChevronDown, ChevronUp, ArrowLeft, ArrowRight,
  AlertTriangle, Shield, DollarSign, Zap, Wrench, TrendingUp, TrendingDown,
  Minus, BarChart3, FileText, Copy, Share2, Check, Info, Target,
  Users, Clock, Building2, Scale, Layers, CheckCircle2, Circle,
  Waves, Gauge, GitBranch, HeartPulse, MessageSquareText, UserCheck, Package,
  CreditCard, CalendarClock, ExternalLink, FilePlus2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbSeparator, BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { MockDataBadge } from './MockDataBadge';
import type { RiskPrediction } from '@/lib/siteIntelTypes';
import { getScenarioById } from '@/lib/scenarioPlanner/scenarios';
import { computeScenarioCost } from '@/lib/scenarioPlanner/costEngine';
import type { ScenarioResult } from '@/lib/scenarioPlanner/types';

// ─── Types ──────────────────────────────────────────────────────────────────

type InvestigationStep = 'select' | 'briefing' | 'scenario' | 'response' | 'prevention' | 'report';

const STEP_LABELS: Record<InvestigationStep, string> = {
  select: 'Risk Selection',
  briefing: 'Risk Briefing',
  scenario: 'Cost Analysis',
  response: 'Response Plan',
  prevention: 'Prevention Plan',
  report: 'Report',
};

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Wrench, Waves, Scale, Gauge, GitBranch, Clock, HeartPulse, TrendingUp,
};

// ─── Risk-to-Scenario Mapping ────────────────────────────────────────────────
// Maps each of the 8 risk prediction categories to a scenario planner scenario
// ID and default parameter overrides for the cost engine.

const RISK_TO_SCENARIO: Record<string, { scenarioId: string; params: Record<string, string | number> }> = {
  'infrastructure-failure': {
    scenarioId: 'water-main-break',
    params: { 'pipe-diameter': 16, 'duration-hours': 24, 'location-type': 'residential' },
  },
  'impairment-breach': {
    scenarioId: 'sso-overflow',
    params: { 'volume-gallons': 100000, 'receiving-water': 'stream', 'cause': 'blockage' },
  },
  'enforcement-probability': {
    scenarioId: 'permit-limit-tightening',
    params: { 'parameter': 'nitrogen', 'current-limit': 'moderate', 'new-limit': 'low' },
  },
  'capacity-exceedance': {
    scenarioId: 'sso-overflow',
    params: { 'volume-gallons': 1000000, 'receiving-water': 'river', 'cause': 'capacity' },
  },
  'cascading-impact': {
    scenarioId: 'hurricane-storm-surge',
    params: { 'storm-category': 2, 'surge-height': 6, 'coastal-distance': 'near-coastal' },
  },
  'recovery-timeline': {
    scenarioId: 'drought',
    params: { 'severity': 'severe', 'duration-months': 6, 'source-type': 'mixed' },
  },
  'public-health-exposure': {
    scenarioId: 'pfas-detection',
    params: { 'concentration': 10, 'media': 'drinking-water', 'population-served': 25000 },
  },
  'intervention-roi': {
    scenarioId: 'new-tmdl',
    params: { 'parameter': 'nitrogen', 'reduction-percent': 40, 'compliance-timeline': 5 },
  },
};

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_PEER_COMPARISONS: Record<string, { percentile: number; peerGroup: string; state: string }> = {
  'infrastructure-failure': { percentile: 82, peerGroup: 'Phase II MS4s', state: 'Maryland' },
  'impairment-breach': { percentile: 76, peerGroup: 'Phase II MS4s', state: 'Maryland' },
  'enforcement-probability': { percentile: 68, peerGroup: 'NPDES permittees', state: 'Maryland' },
  'capacity-exceedance': { percentile: 91, peerGroup: 'WWTPs under 10 MGD', state: 'Maryland' },
  'cascading-impact': { percentile: 55, peerGroup: 'Interceptor systems', state: 'Mid-Atlantic' },
  'recovery-timeline': { percentile: 63, peerGroup: 'impaired watersheds', state: 'Chesapeake Bay' },
  'public-health-exposure': { percentile: 72, peerGroup: 'drinking water systems', state: 'Maryland' },
  'intervention-roi': { percentile: 35, peerGroup: 'BMP implementers', state: 'Maryland' },
};

const MOCK_HISTORY: Record<string, { date: string; event: string; cost: string }> = {
  'infrastructure-failure': { date: 'March 2024', event: 'SSO at Oak Creek — 47,000 gallons discharged', cost: '$285K' },
  'impairment-breach': { date: 'August 2023', event: 'Mill Creek DO dropped to 2.1 mg/L for 18 days', cost: '$95K monitoring' },
  'enforcement-probability': { date: 'January 2024', event: 'NOV issued for benchmark exceedance (TSS)', cost: '$42K response' },
  'capacity-exceedance': { date: 'September 2023', event: 'Bypass event during 2-yr storm', cost: '$180K' },
  'cascading-impact': { date: 'June 2023', event: 'Upstream release impacted 12 downstream AUs', cost: '$420K regional' },
  'recovery-timeline': { date: 'November 2023', event: 'TMDL implementation delayed 6 months', cost: '$150K extended monitoring' },
  'public-health-exposure': { date: 'May 2024', event: 'PFAS detection at intake — advisory issued', cost: '$320K treatment' },
  'intervention-roi': { date: 'April 2023', event: 'Bioretention installed at Site 7 — 22% score improvement', cost: '$85K invested' },
};

const MOCK_DATA_SOURCES: string[] = [
  'EPA ECHO/ICIS — permit compliance & enforcement (updated weekly)',
  'USGS NWIS — real-time flow & groundwater (updated daily)',
  'EPA ATTAINS — impairment assessments (updated annually)',
  'EPA SDWIS — drinking water violations (updated monthly)',
  'NOAA Climate — precipitation & temperature projections',
  'Census ACS — population & demographic exposure data',
  'State MDE — permit conditions & inspection reports',
  'WQP — ambient water quality monitoring results',
];

// Cost tier display config for mapping CostTierOutput to styled cards
const TIER_DISPLAY: Record<string, { color: string; borderColor: string; textColor: string; icon: React.ComponentType<any> }> = {
  direct:     { color: 'bg-red-50',    borderColor: 'border-red-200',    textColor: 'text-red-700',    icon: Wrench },
  regulatory: { color: 'bg-amber-50',  borderColor: 'border-amber-200',  textColor: 'text-amber-700',  icon: Scale },
  economic:   { color: 'bg-purple-50', borderColor: 'border-purple-200', textColor: 'text-purple-700', icon: Building2 },
  timeline:   { color: 'bg-blue-50',   borderColor: 'border-blue-200',   textColor: 'text-blue-700',   icon: Clock },
};

const RISK_CASCADE: Record<string, { assessmentUnits: number; drinkingWaterIntakes: number; ms4Jurisdictions: number; populationExposed: number }> = {
  'infrastructure-failure': { assessmentUnits: 12, drinkingWaterIntakes: 1, ms4Jurisdictions: 3, populationExposed: 85000 },
  'impairment-breach':      { assessmentUnits: 18, drinkingWaterIntakes: 2, ms4Jurisdictions: 5, populationExposed: 145000 },
  'enforcement-probability': { assessmentUnits: 8, drinkingWaterIntakes: 1, ms4Jurisdictions: 2, populationExposed: 62000 },
  'capacity-exceedance':    { assessmentUnits: 22, drinkingWaterIntakes: 3, ms4Jurisdictions: 8, populationExposed: 280000 },
  'cascading-impact':       { assessmentUnits: 47, drinkingWaterIntakes: 5, ms4Jurisdictions: 12, populationExposed: 340000 },
  'recovery-timeline':      { assessmentUnits: 15, drinkingWaterIntakes: 2, ms4Jurisdictions: 4, populationExposed: 120000 },
  'public-health-exposure': { assessmentUnits: 5, drinkingWaterIntakes: 4, ms4Jurisdictions: 2, populationExposed: 42000 },
  'intervention-roi':       { assessmentUnits: 10, drinkingWaterIntakes: 1, ms4Jurisdictions: 3, populationExposed: 95000 },
};

interface ActionPhase {
  phase: string;
  timeframe: string;
  color: string;
  borderColor: string;
  textColor: string;
  tasks: string[];
}

const RISK_ACTION_PHASES: Record<string, ActionPhase[]> = {
  'infrastructure-failure': [
    {
      phase: 'Immediate Response', timeframe: '0 — 24 hours', color: 'bg-red-50', borderColor: 'border-red-300', textColor: 'text-red-700',
      tasks: [
        'Deploy emergency bypass pumping to prevent additional discharge',
        'Notify MDE Emergency Response within 2 hours (per permit)',
        'Post public notification at affected access points',
        'Activate contractor for emergency excavation & pipe assessment',
        'Install temporary flow monitoring at outfall',
        'Document discharge volume, duration, receiving water conditions',
      ],
    },
    {
      phase: 'Stabilization', timeframe: '24 — 72 hours', color: 'bg-amber-50', borderColor: 'border-amber-300', textColor: 'text-amber-700',
      tasks: [
        'Complete pipe failure assessment — scope permanent repair',
        'Begin receiving water quality monitoring (DO, TSS, bacteria)',
        'Submit 5-day written SSO report to MDE',
        'Coordinate with DOT on road closure & detour plan',
        'Assess downstream impact on private property drainage',
        'Brief elected officials on timeline & cost estimates',
      ],
    },
    {
      phase: 'Recovery', timeframe: '72 hours — 30 days', color: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-700',
      tasks: [
        'Execute permanent pipe repair (HDPE or CIPP)',
        'Restore road surface and traffic flow',
        'Complete 90-day receiving water monitoring plan',
        'Submit corrective action plan to MDE',
        'Update annual MS4 report with incident documentation',
        'Evaluate system-wide condition to prevent recurrence',
      ],
    },
  ],
  'impairment-breach': [
    {
      phase: 'Detection & Confirmation', timeframe: '0 — 48 hours', color: 'bg-red-50', borderColor: 'border-red-300', textColor: 'text-red-700',
      tasks: [
        'Confirm impairment through grab samples and continuous monitoring',
        'Identify discharge source(s) through upstream reconnaissance',
        'Notify MDE Water Quality Division of exceedance',
        'Deploy additional monitoring at upstream/downstream stations',
        'Document baseline conditions and impairment extent',
        'Alert downstream water users and jurisdictions',
      ],
    },
    {
      phase: 'Source Control', timeframe: '48 hours — 2 weeks', color: 'bg-amber-50', borderColor: 'border-amber-300', textColor: 'text-amber-700',
      tasks: [
        'Implement emergency BMPs at identified source locations',
        'Coordinate with upstream dischargers on load reduction',
        'Begin intensive receiving water monitoring program',
        'Submit impairment notification to EPA ATTAINS coordinator',
        'Assess extent of biological and habitat impact',
        'Brief regulatory staff on corrective action timeline',
      ],
    },
    {
      phase: 'Restoration', timeframe: '2 weeks — 6 months', color: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-700',
      tasks: [
        'Install permanent source control BMPs (constructed wetland, bioretention)',
        'Implement load reduction strategy per TMDL requirements',
        'Continue monthly receiving water monitoring',
        'Submit restoration progress report to MDE',
        'Update TMDL implementation plan with revised milestones',
        'Evaluate effectiveness of interventions through trend analysis',
      ],
    },
  ],
  'enforcement-probability': [
    {
      phase: 'Compliance Audit', timeframe: '0 — 2 weeks', color: 'bg-red-50', borderColor: 'border-red-300', textColor: 'text-red-700',
      tasks: [
        'Conduct internal compliance audit against permit conditions',
        'Review DMR submissions for accuracy and completeness',
        'Identify all current and potential limit exceedances',
        'Engage environmental compliance counsel',
        'Compile historical enforcement actions and responses',
        'Document all existing BMPs and treatment performance',
      ],
    },
    {
      phase: 'Corrective Action', timeframe: '2 weeks — 3 months', color: 'bg-amber-50', borderColor: 'border-amber-300', textColor: 'text-amber-700',
      tasks: [
        'Develop corrective action plan addressing all deficiencies',
        'Optimize existing treatment processes for better performance',
        'Install additional monitoring to demonstrate compliance trajectory',
        'Submit compliance schedule proposal to permitting authority',
        'Initiate engineering evaluation for treatment upgrades',
        'Brief leadership on compliance timeline and cost implications',
      ],
    },
    {
      phase: 'Compliance Demonstration', timeframe: '3 — 12 months', color: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-700',
      tasks: [
        'Implement treatment upgrades per engineering evaluation',
        'Conduct performance testing and optimization',
        'Submit monthly compliance progress reports',
        'Complete all corrective action plan milestones',
        'Update annual report with compliance documentation',
        'Request compliance schedule modification if needed',
      ],
    },
  ],
  'capacity-exceedance': [
    {
      phase: 'Flow Diversion', timeframe: '0 — 24 hours', color: 'bg-red-50', borderColor: 'border-red-300', textColor: 'text-red-700',
      tasks: [
        'Activate emergency flow equalization basins',
        'Deploy portable pumping to reduce system pressure',
        'Notify MDE of potential SSO from capacity exceedance',
        'Implement temporary flow diversion to reduce peak loads',
        'Monitor all overflow points and outfalls',
        'Document flow rates, rainfall data, and system response',
      ],
    },
    {
      phase: 'Capacity Assessment', timeframe: '1 — 4 weeks', color: 'bg-amber-50', borderColor: 'border-amber-300', textColor: 'text-amber-700',
      tasks: [
        'Complete hydraulic model calibration with event data',
        'Identify I&I hotspots through flow isolation testing',
        'Assess wet-weather capacity vs. design capacity',
        'Evaluate downstream receiving capacity constraints',
        'Develop interim capacity management plan',
        'Brief elected officials on capital improvement needs',
      ],
    },
    {
      phase: 'Long-Term Expansion', timeframe: '1 — 24 months', color: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-700',
      tasks: [
        'Design plant expansion or parallel treatment train',
        'Implement priority I&I rehabilitation projects',
        'Install permanent flow equalization facilities',
        'Submit capacity improvement plan to MDE',
        'Update capital improvement program with expansion projects',
        'Monitor system performance and verify capacity improvements',
      ],
    },
  ],
  'cascading-impact': [
    {
      phase: 'System Isolation', timeframe: '0 — 12 hours', color: 'bg-red-50', borderColor: 'border-red-300', textColor: 'text-red-700',
      tasks: [
        'Activate emergency operations center and incident command',
        'Isolate affected system segments to prevent cascade propagation',
        'Deploy emergency generators to critical pump stations',
        'Notify all downstream jurisdictions and utilities',
        'Activate mutual aid agreements with neighboring systems',
        'Document initial damage assessment and cascade extent',
      ],
    },
    {
      phase: 'Downstream Notification', timeframe: '12 — 72 hours', color: 'bg-amber-50', borderColor: 'border-amber-300', textColor: 'text-amber-700',
      tasks: [
        'Conduct comprehensive damage assessment across all affected areas',
        'Coordinate regional response with state emergency management',
        'Establish temporary water supply for affected populations',
        'Begin environmental sampling across all affected waterways',
        'Submit regional incident report to MDE and EPA',
        'Brief regional elected officials on scope and response timeline',
      ],
    },
    {
      phase: 'Regional Recovery', timeframe: '3 days — 6 months', color: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-700',
      tasks: [
        'Execute phased infrastructure repair across affected systems',
        'Coordinate FEMA reimbursement applications regionally',
        'Implement resilience upgrades at critical interconnection points',
        'Complete environmental restoration at impacted waterways',
        'Develop regional resilience plan to prevent future cascades',
        'Conduct after-action review with all participating agencies',
      ],
    },
  ],
  'recovery-timeline': [
    {
      phase: 'Baseline Assessment', timeframe: '0 — 4 weeks', color: 'bg-red-50', borderColor: 'border-red-300', textColor: 'text-red-700',
      tasks: [
        'Conduct comprehensive water quality baseline sampling',
        'Assess current habitat and biological conditions',
        'Review historical monitoring data for trend analysis',
        'Identify priority restoration sites and limiting factors',
        'Engage stakeholders and downstream water users',
        'Document current impairment status and recovery targets',
      ],
    },
    {
      phase: 'Active Restoration', timeframe: '1 — 12 months', color: 'bg-amber-50', borderColor: 'border-amber-300', textColor: 'text-amber-700',
      tasks: [
        'Implement targeted BMP installations at priority sites',
        'Begin riparian buffer restoration and streambank stabilization',
        'Install additional monitoring stations for progress tracking',
        'Coordinate with agricultural operators on nutrient management',
        'Submit quarterly progress reports to regulatory agencies',
        'Adjust restoration strategy based on monitoring results',
      ],
    },
    {
      phase: 'Monitoring & Verification', timeframe: '12 — 36 months', color: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-700',
      tasks: [
        'Continue monthly water quality monitoring at all stations',
        'Conduct biological assessments to verify ecosystem recovery',
        'Evaluate BMP performance and maintenance needs',
        'Submit delisting petition when recovery targets are met',
        'Update TMDL implementation milestones based on progress',
        'Transition to long-term maintenance monitoring program',
      ],
    },
  ],
  'public-health-exposure': [
    {
      phase: 'Health Advisory', timeframe: '0 — 48 hours', color: 'bg-red-50', borderColor: 'border-red-300', textColor: 'text-red-700',
      tasks: [
        'Issue public health advisory through all notification channels',
        'Confirm detection through independent laboratory analysis',
        'Notify state health department and EPA drinking water division',
        'Deploy point-of-use filters to affected residences',
        'Establish alternative water supply distribution points',
        'Document exposure pathway and affected population',
      ],
    },
    {
      phase: 'Interim Treatment', timeframe: '48 hours — 6 months', color: 'bg-amber-50', borderColor: 'border-amber-300', textColor: 'text-amber-700',
      tasks: [
        'Install interim blending or point-of-entry treatment systems',
        'Conduct source investigation to identify contamination origin',
        'Begin weekly monitoring at all distribution system points',
        'Coordinate with health department on exposure assessment',
        'Evaluate permanent treatment alternatives (GAC, IX, RO)',
        'Brief elected officials on treatment timeline and costs',
      ],
    },
    {
      phase: 'Permanent Solution', timeframe: '6 — 36 months', color: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-700',
      tasks: [
        'Design and construct permanent treatment system',
        'Pursue cost recovery from responsible parties if identified',
        'Complete health risk communication and community outreach',
        'Submit compliance documentation to state drinking water program',
        'Transition to routine compliance monitoring',
        'Evaluate source water protection measures to prevent recurrence',
      ],
    },
  ],
  'intervention-roi': [
    {
      phase: 'Site Assessment', timeframe: '0 — 4 weeks', color: 'bg-red-50', borderColor: 'border-red-300', textColor: 'text-red-700',
      tasks: [
        'Conduct site characterization and drainage area delineation',
        'Evaluate soil conditions, infiltration rates, and groundwater depth',
        'Model pollutant load reduction potential for candidate BMPs',
        'Identify regulatory credit eligibility for each intervention',
        'Develop cost-benefit analysis for 3 intervention alternatives',
        'Document baseline pollutant loading and receiving water conditions',
      ],
    },
    {
      phase: 'Design & Permitting', timeframe: '1 — 6 months', color: 'bg-amber-50', borderColor: 'border-amber-300', textColor: 'text-amber-700',
      tasks: [
        'Complete engineering design for selected BMP network',
        'Submit permit applications and environmental review documents',
        'Secure construction funding through grants or capital budget',
        'Coordinate with property owners for easements if needed',
        'Finalize construction bid documents and contractor selection',
        'Submit grant applications with cost-benefit documentation',
      ],
    },
    {
      phase: 'Construction & Verification', timeframe: '6 — 18 months', color: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-700',
      tasks: [
        'Construct BMP network per approved design plans',
        'Install monitoring equipment for performance verification',
        'Complete as-built documentation and regulatory reporting',
        'Conduct first-year performance monitoring and maintenance',
        'Calculate actual ROI and pollutant load reduction achieved',
        'Submit performance report for TMDL implementation credit',
      ],
    },
  ],
};

interface Intervention {
  id: string;
  name: string;
  costLow: number;
  costHigh: number;
  probReduction: string;
  scoreImprovement: number;
  roiLow: number;
  roiHigh: number;
  timeline: string;
  description: string;
}

const RISK_INTERVENTIONS: Record<string, Intervention[]> = {
  'infrastructure-failure': [
    {
      id: 'A', name: 'Full Pipe Replacement (HDPE)',
      costLow: 220000, costHigh: 280000,
      probReduction: '68% → 5%', scoreImprovement: 40,
      roiLow: 1.1, roiHigh: 1.5, timeline: '4-6 months',
      description: 'Complete replacement of the deteriorated segment with HDPE. Eliminates root cause. 50-year design life.',
    },
    {
      id: 'B', name: 'CIPP Lining (Trenchless)',
      costLow: 110000, costHigh: 150000,
      probReduction: '68% → 18%', scoreImprovement: 25,
      roiLow: 2.1, roiHigh: 2.9, timeline: '2-3 months',
      description: 'Cured-in-place pipe lining restores structural integrity without excavation. Minimal road disruption. 25-year design life.',
    },
    {
      id: 'C', name: 'Targeted Repair + Monitoring',
      costLow: 45000, costHigh: 65000,
      probReduction: '68% → 42%', scoreImprovement: 15,
      roiLow: 3.8, roiHigh: 5.0, timeline: '2-4 weeks',
      description: 'Patch worst joint separations + install continuous flow monitoring. Buys time but doesn\'t eliminate root cause.',
    },
  ],
  'impairment-breach': [
    {
      id: 'A', name: 'Constructed Wetland Treatment',
      costLow: 280000, costHigh: 380000,
      probReduction: '74% → 12%', scoreImprovement: 38,
      roiLow: 1.2, roiHigh: 1.6, timeline: '8-12 months',
      description: 'Engineered wetland system treats stormwater runoff and reduces pollutant loading. 30+ year design life with maintenance.',
    },
    {
      id: 'B', name: 'BMP Retrofit Network',
      costLow: 120000, costHigh: 180000,
      probReduction: '74% → 28%', scoreImprovement: 28,
      roiLow: 2.0, roiHigh: 3.1, timeline: '3-6 months',
      description: 'Retrofit existing outfalls with bioretention, hydrodynamic separators, and enhanced swales. Moderate load reduction.',
    },
    {
      id: 'C', name: 'Source Controls + Enhanced Monitoring',
      costLow: 55000, costHigh: 85000,
      probReduction: '74% → 48%', scoreImprovement: 14,
      roiLow: 3.2, roiHigh: 4.5, timeline: '4-8 weeks',
      description: 'Implement pollution prevention at source + deploy continuous water quality sensors. Early detection, partial reduction.',
    },
  ],
  'enforcement-probability': [
    {
      id: 'A', name: 'Treatment Process Upgrade',
      costLow: 350000, costHigh: 520000,
      probReduction: '55% → 8%', scoreImprovement: 35,
      roiLow: 0.9, roiHigh: 1.4, timeline: '12-18 months',
      description: 'Upgrade treatment process to achieve consistent compliance with tightened limits. Eliminates exceedance risk.',
    },
    {
      id: 'B', name: 'Process Optimization + Monitoring',
      costLow: 85000, costHigh: 140000,
      probReduction: '55% → 22%', scoreImprovement: 22,
      roiLow: 2.4, roiHigh: 3.5, timeline: '2-4 months',
      description: 'Optimize existing treatment through chemical adjustment, operational changes, and enhanced monitoring.',
    },
    {
      id: 'C', name: 'Compliance Audit + Quick Fixes',
      costLow: 35000, costHigh: 55000,
      probReduction: '55% → 38%', scoreImprovement: 12,
      roiLow: 4.0, roiHigh: 5.5, timeline: '2-4 weeks',
      description: 'Comprehensive compliance audit with immediate corrective actions for low-hanging fruit deficiencies.',
    },
  ],
  'capacity-exceedance': [
    {
      id: 'A', name: 'Plant Expansion',
      costLow: 450000, costHigh: 680000,
      probReduction: '87% → 10%', scoreImprovement: 42,
      roiLow: 0.8, roiHigh: 1.2, timeline: '18-24 months',
      description: 'Expand treatment capacity with parallel process train. Eliminates capacity constraint for 20+ year planning horizon.',
    },
    {
      id: 'B', name: 'I&I Reduction Program',
      costLow: 180000, costHigh: 280000,
      probReduction: '87% → 35%', scoreImprovement: 30,
      roiLow: 1.8, roiHigh: 2.6, timeline: '6-12 months',
      description: 'Targeted infiltration and inflow reduction through sewer rehabilitation and manhole sealing. Reduces peak flows 30-50%.',
    },
    {
      id: 'C', name: 'Flow Equalization Basin',
      costLow: 95000, costHigh: 145000,
      probReduction: '87% → 55%', scoreImprovement: 18,
      roiLow: 3.0, roiHigh: 4.2, timeline: '3-6 months',
      description: 'Temporary flow equalization to buffer peak wet-weather flows. Buys time for permanent capacity solution.',
    },
  ],
  'cascading-impact': [
    {
      id: 'A', name: 'Resilience Network Infrastructure',
      costLow: 520000, costHigh: 750000,
      probReduction: '62% → 15%', scoreImprovement: 40,
      roiLow: 0.9, roiHigh: 1.3, timeline: '12-24 months',
      description: 'Build redundant interconnections, backup power, and isolation valves across the regional network.',
    },
    {
      id: 'B', name: 'Critical Asset Hardening',
      costLow: 200000, costHigh: 320000,
      probReduction: '62% → 30%', scoreImprovement: 25,
      roiLow: 1.6, roiHigh: 2.4, timeline: '6-12 months',
      description: 'Harden pump stations, elevate electrical systems, and install flood barriers at critical nodes.',
    },
    {
      id: 'C', name: 'Early Warning + Mutual Aid',
      costLow: 65000, costHigh: 95000,
      probReduction: '62% → 42%', scoreImprovement: 12,
      roiLow: 3.5, roiHigh: 5.0, timeline: '2-4 months',
      description: 'Deploy regional early warning system and formalize mutual aid agreements with neighboring utilities.',
    },
  ],
  'recovery-timeline': [
    {
      id: 'A', name: 'Accelerated Restoration Program',
      costLow: 240000, costHigh: 360000,
      probReduction: '58% → 12%', scoreImprovement: 35,
      roiLow: 1.1, roiHigh: 1.6, timeline: '12-18 months',
      description: 'Comprehensive multi-site restoration with riparian buffers, stream stabilization, and nutrient reduction BMPs.',
    },
    {
      id: 'B', name: 'Targeted BMP Installation',
      costLow: 95000, costHigh: 150000,
      probReduction: '58% → 28%', scoreImprovement: 22,
      roiLow: 2.2, roiHigh: 3.2, timeline: '4-8 months',
      description: 'Install BMPs at highest-impact sites identified through watershed modeling. Focus on cost-effective load reduction.',
    },
    {
      id: 'C', name: 'Adaptive Management + Monitoring',
      costLow: 40000, costHigh: 65000,
      probReduction: '58% → 40%', scoreImprovement: 10,
      roiLow: 3.8, roiHigh: 5.2, timeline: '1-3 months',
      description: 'Enhanced monitoring network with adaptive management triggers. Data-driven approach to prioritize future investments.',
    },
  ],
  'public-health-exposure': [
    {
      id: 'A', name: 'GAC Treatment System',
      costLow: 380000, costHigh: 550000,
      probReduction: '48% → 5%', scoreImprovement: 38,
      roiLow: 0.8, roiHigh: 1.2, timeline: '12-24 months',
      description: 'Granular activated carbon treatment system for full contaminant removal. Meets all current and anticipated MCLs.',
    },
    {
      id: 'B', name: 'Blending + POU Filters',
      costLow: 120000, costHigh: 185000,
      probReduction: '48% → 20%', scoreImprovement: 24,
      roiLow: 1.8, roiHigh: 2.8, timeline: '2-6 months',
      description: 'Source blending to dilute contamination + point-of-use filters for affected residences. Interim compliance path.',
    },
    {
      id: 'C', name: 'Source Investigation + Monitoring',
      costLow: 55000, costHigh: 80000,
      probReduction: '48% → 35%', scoreImprovement: 10,
      roiLow: 3.0, roiHigh: 4.5, timeline: '1-3 months',
      description: 'Investigate contamination source for cost recovery. Enhanced monitoring to track trends and trigger treatment if needed.',
    },
  ],
  'intervention-roi': [
    {
      id: 'A', name: 'Comprehensive BMP Network',
      costLow: 320000, costHigh: 480000,
      probReduction: '42% → 8%', scoreImprovement: 35,
      roiLow: 1.0, roiHigh: 1.5, timeline: '12-18 months',
      description: 'Full BMP network addressing all impairment causes. Bioretention, permeable pavement, constructed wetlands, and green infrastructure.',
    },
    {
      id: 'B', name: 'Targeted Bioretention',
      costLow: 130000, costHigh: 195000,
      probReduction: '42% → 18%', scoreImprovement: 22,
      roiLow: 2.0, roiHigh: 3.0, timeline: '4-8 months',
      description: 'Bioretention cells at high-priority outfalls. Cost-effective load reduction with regulatory credit eligibility.',
    },
    {
      id: 'C', name: 'Green Infrastructure Pilot',
      costLow: 45000, costHigh: 70000,
      probReduction: '42% → 30%', scoreImprovement: 10,
      roiLow: 3.5, roiHigh: 5.0, timeline: '2-4 months',
      description: 'Pilot green infrastructure project to demonstrate feasibility and build community support for larger investment.',
    },
  ],
};

interface PortfolioRisk {
  category: string;
  probability: number;
  estCostLow: number;
  estCostHigh: number;
  expectedLossLow: number;
  expectedLossHigh: number;
  preventionCostLow: number;
  preventionCostHigh: number;
}

const MOCK_AUDIENCES = [
  { id: 'council', label: 'Council / Board', sections: ['executive', 'risk', 'cost', 'recommendations'] },
  { id: 'legislature', label: 'State Legislature', sections: ['executive', 'risk', 'cost', 'recommendations', 'data'] },
  { id: 'technical', label: 'Technical Staff', sections: ['executive', 'risk', 'cost', 'response', 'prevention', 'recommendations', 'data'] },
  { id: 'grant', label: 'Grant Application', sections: ['executive', 'risk', 'cost', 'prevention', 'recommendations', 'data'] },
  { id: 'insurance', label: 'Insurance', sections: ['executive', 'risk', 'cost', 'response', 'data'] },
  { id: 'internal', label: 'Internal Planning', sections: ['executive', 'risk', 'cost', 'response', 'prevention', 'recommendations', 'data'] },
  { id: 'public', label: 'Public Comms', sections: ['executive', 'risk', 'recommendations'] },
  { id: 'after-action', label: 'After-Action', sections: ['executive', 'risk', 'cost', 'response', 'prevention', 'recommendations', 'data'] },
];

const REPORT_SECTIONS = [
  { id: 'executive', label: 'Executive Summary', requiredStep: null },
  { id: 'risk', label: 'Risk Assessment', requiredStep: null },
  { id: 'cost', label: 'Cost Analysis', requiredStep: 'scenario' as InvestigationStep },
  { id: 'response', label: 'Response Plan', requiredStep: 'response' as InvestigationStep },
  { id: 'prevention', label: 'Prevention / Recovery Plan', requiredStep: 'prevention' as InvestigationStep },
  { id: 'recommendations', label: 'Recommendations', requiredStep: null },
  { id: 'data', label: 'Data Sources & Methodology', requiredStep: null },
];

// ─── Compliance Account Summary ─────────────────────────────────────────────
// Credit-account-style header showing who you are, what IDs apply, and what's due.

type AccountScope = 'National' | 'State' | 'Local Government' | 'Utility' | 'Facility';

interface ComplianceObligation {
  label: string;
  dueDate: string | null;      // ISO date or null if conditional
  status: 'on-track' | 'approaching' | 'overdue' | 'conditional' | 'n/a';
  amount?: string;              // financial if applicable, otherwise undefined
  conditionalOn?: string;       // e.g. "Only if SSO event occurs"
  docType: string;              // what document gets created
}

interface ComplianceAccount {
  accountName: string;
  accountId: string;            // Permit ID, PWSID, or "N/A"
  accountIdType: string;        // "NPDES Permit", "PWSID", "MS4 Permit", etc.
  scope: AccountScope;
  scopeDetail: string;          // e.g. "Anne Arundel County, MD"
  permitCycle: string;          // e.g. "2024-2029"
  obligations: ComplianceObligation[];
  financialOutstanding: string; // "$0" or "$42K penalty pending"
}

const MOCK_COMPLIANCE_ACCOUNT: ComplianceAccount = {
  accountName: 'City of Oak Creek',
  accountId: 'MD0068276',
  accountIdType: 'NPDES MS4 Phase II Permit',
  scope: 'Local Government',
  scopeDetail: 'Anne Arundel County, MD',
  permitCycle: '2024–2029',
  obligations: [
    {
      label: 'MS4 Annual Report',
      dueDate: '2026-10-15',
      status: 'on-track',
      docType: 'MS4 Annual Report',
    },
    {
      label: 'TMDL Progress Report',
      dueDate: '2026-12-01',
      status: 'on-track',
      docType: 'TMDL Implementation Progress',
    },
    {
      label: 'Stormwater Management Plan Update',
      dueDate: '2026-07-01',
      status: 'approaching',
      docType: 'SWMP Update',
    },
    {
      label: 'SSO Incident Report (5-Day)',
      dueDate: null,
      status: 'conditional',
      conditionalOn: 'Only if SSO event occurs',
      docType: 'SSO 5-Day Written Report',
    },
    {
      label: 'Corrective Action Plan',
      dueDate: null,
      status: 'conditional',
      conditionalOn: 'Only if NOV is issued',
      docType: 'Corrective Action Plan',
    },
    {
      label: 'SRF Grant Application',
      dueDate: '2026-04-15',
      status: 'approaching',
      amount: 'Up to $280K eligible',
      docType: 'SRF Loan/Grant Application',
    },
  ],
  financialOutstanding: '$0 outstanding',
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function obligationStatusStyle(status: ComplianceObligation['status']): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'on-track': return { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' };
    case 'approaching': return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
    case 'overdue': return { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' };
    case 'conditional': return { bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-400' };
    case 'n/a': return { bg: 'bg-slate-50', text: 'text-slate-400', dot: 'bg-slate-300' };
  }
}

// ─── Oversight Talking Points ────────────────────────────────────────────────
// Each investigation step gets a "babified" card so an oversight person knows
// exactly: (1) what this means, (2) who to take it to, (3) what to ask for.

interface TalkingPointContact {
  role: string;          // e.g. "Public Works Director"
  name?: string;         // optional placeholder name
  why: string;           // why this person
}

interface TalkingPoint {
  thePoint: string;       // plain-English summary a non-engineer can read aloud
  presentTo: TalkingPointContact[];
  askFor: string[];       // concrete deliverables / receivables
  urgency: 'routine' | 'elevated' | 'urgent' | 'critical';
  talkTrack?: string;     // optional one-liner to open the conversation
}

interface TalkingPointVars {
  costLow: string;
  costHigh: string;
  preventLow: string;
  preventHigh: string;
  optBCostLow: string;
  optBCostHigh: string;
  optBReduction: string;
  optCCostLow: string;
  cascadeAUs: number;
  population: string;
}

function buildTalkingPoints(v: TalkingPointVars): Record<Exclude<InvestigationStep, 'select'>, TalkingPoint> {
  return {
    briefing: {
      thePoint: 'Our system has a high probability of a serious failure in the near future. This is not a hypothetical — the data shows real, measurable warning signs right now. If we do nothing, the question is when, not if.',
      presentTo: [
        { role: 'City/County Manager', why: 'Needs to know this is coming so it doesn\'t blindside them politically' },
        { role: 'Public Works Director', name: 'Your DPW lead', why: 'Owns the infrastructure and needs to start scoping a response' },
        { role: 'Finance Director / CFO', why: 'Needs lead time to identify funding if we decide to act proactively' },
      ],
      askFor: [
        'Acknowledgment that this risk is on the leadership radar',
        'A 30-minute follow-up meeting within 2 weeks to review cost analysis',
        'Direction on whether to brief elected officials now or after cost numbers are ready',
        'Authorization to proceed with engineering assessment (if not already done)',
      ],
      urgency: 'elevated',
      talkTrack: '"I need 5 minutes of your time. Our data is showing a high probability of [risk type] in the next [timeframe]. I have the numbers. I need your direction on next steps before this becomes a crisis."',
    },
    scenario: {
      thePoint: `If this failure happens, it will cost us between ${v.costLow} and ${v.costHigh} in direct repairs, regulatory fines, and economic fallout. That's not a guess — it's based on what similar failures have cost other jurisdictions our size. Every month we wait, the probability goes up.`,
      presentTo: [
        { role: 'Finance Director / CFO', why: 'Controls the budget — needs to see the numbers to unlock funding' },
        { role: 'City/County Manager', why: 'Needs cost context before briefing elected officials' },
        { role: 'Risk Manager / Insurance Liaison', why: 'Should evaluate whether current coverage addresses this exposure' },
      ],
      askFor: [
        `Confirmation that emergency reserve or capital budget can cover ${v.preventLow}–${v.preventHigh} for prevention`,
        'Written authorization to proceed with one of the three intervention options',
        'A budget line item or CIP amendment if this requires next-cycle funding',
        'Insurance coverage review — does our policy cover this type of event?',
        `Decision: Do we fund prevention now (${v.preventLow}–${v.preventHigh}) or risk paying ${v.costLow}–${v.costHigh} after failure?`,
      ],
      urgency: 'urgent',
      talkTrack: `"We modeled what this failure would cost us. The answer is ${v.costLow} to ${v.costHigh}. I have three prevention options that cost less than the failure. I need a funding decision."`,
    },
    response: {
      thePoint: `If this happens tomorrow, here is exactly what we do in the first 24 hours, the first 72 hours, and the first 30 days. Everyone needs to know their role before the phone rings. A failure here cascades to ${v.cascadeAUs} downstream areas and affects ${v.population} people.`,
      presentTo: [
        { role: 'Public Works Director', name: 'Your DPW lead', why: 'Runs the response — needs to pre-position contractors and equipment' },
        { role: 'Emergency Management Coordinator', why: 'Needs this in the emergency operations plan' },
        { role: 'Communications / PIO', why: 'Will be writing press releases — needs talking points drafted in advance' },
        { role: 'Legal / County Attorney', why: 'Regulatory notifications have legal deadlines (2 hrs, 5 days) — they need to know' },
      ],
      askFor: [
        'Sign-off on the response plan — who is responsible for each phase?',
        'Emergency contractor on retainer (or confirmation existing contract covers this)',
        'Pre-drafted public notification templates (reviewed by legal)',
        'MDE emergency contact information verified and on speed dial',
        'Tabletop exercise scheduled within 60 days to walk through this scenario',
        'Confirmation that downstream jurisdictions have been informally notified of the risk',
      ],
      urgency: 'critical',
      talkTrack: `"If this fails, we have 2 hours to notify the state and 5 days to file a written report. ${v.population} people downstream are affected. I need everyone to know their role before it happens, not after."`,
    },
    prevention: {
      thePoint: `We have three options to prevent this failure. The cheapest buys us time but doesn't fix the problem. The middle option is the best bang for the buck — it costs ${v.optBCostLow}–${v.optBCostHigh} and cuts our risk ${v.optBReduction}. The most expensive option eliminates the risk entirely. All three cost less than the failure.`,
      presentTo: [
        { role: 'City/County Manager', why: 'Makes the final recommendation to elected body' },
        { role: 'City Council / County Board', why: 'Approves the expenditure — needs the "prevention costs less than failure" comparison' },
        { role: 'Grants Coordinator / Finance', why: 'SRF and EPA grant deadlines are approaching — needs to start applications now' },
        { role: 'Engineering / Capital Projects', why: 'Scopes and manages the actual construction work' },
      ],
      askFor: [
        'Council/Board vote to authorize one of the three intervention options',
        'A specific dollar amount approved in the capital budget or via emergency appropriation',
        'Grant application submitted to EPA Clean Water SRF by the April 15 deadline',
        'Engineering RFP or sole-source justification issued within 30 days of approval',
        'Project timeline with milestones — when does construction start and end?',
        'Post-construction monitoring plan to verify the fix actually worked',
      ],
      urgency: 'elevated',
      talkTrack: `"I have three options. They range from ${v.optCCostLow} to ${v.preventHigh}. All three cost less than the ${v.costLow}–${v.costHigh} failure. I recommend Option B. I need Council authorization and a grant application filed by April 15."`,
    },
    report: {
      thePoint: 'This report packages everything we\'ve found into a document tailored for whoever needs to see it. Pick the audience — Council gets the summary, technical staff gets the details, a grant application gets the cost-benefit framing. One investigation, multiple outputs.',
      presentTo: [
        { role: 'City/County Manager', why: 'Reviews the Council version before it goes to elected officials' },
        { role: 'Grants Coordinator', why: 'Takes the grant-formatted version and attaches it to the SRF application' },
        { role: 'Your direct supervisor', why: 'Should see the internal planning version before any external distribution' },
      ],
      askFor: [
        'Approval to distribute the Council version at the next work session or committee meeting',
        'Feedback on the executive summary — does it say what leadership needs it to say?',
        'Confirmation that the grant version can be attached to the SRF application',
        'Decision on whether the public communications version should be released proactively',
        'Filing instructions — where does the official copy of this investigation live?',
      ],
      urgency: 'routine',
      talkTrack: '"The investigation is complete. I have the report in [audience] format. I need your sign-off before I distribute it."',
    },
  };
}

const URGENCY_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  routine: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', label: 'Routine' },
  elevated: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Elevated' },
  urgent: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', label: 'Urgent' },
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Critical' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface RiskInvestigationFlowProps {
  preSelectedRisk?: RiskPrediction | null;
  predictions?: RiskPrediction[] | null;
  onBackToForecast?: () => void;
}

// ─── Talking Points Card ────────────────────────────────────────────────────

function TalkingPointsCard({ step, talkingPoints }: { step: Exclude<InvestigationStep, 'select'>; talkingPoints: Record<Exclude<InvestigationStep, 'select'>, TalkingPoint> }) {
  const [expanded, setExpanded] = useState(true);
  const tp = talkingPoints[step];
  const urgencyStyle = URGENCY_STYLES[tp.urgency];

  return (
    <Card className={`border-2 ${urgencyStyle.border} overflow-hidden`}>
      <div
        className={`px-4 py-3 ${urgencyStyle.bg} cursor-pointer hover:opacity-90 transition-opacity`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareText className={`h-4 w-4 ${urgencyStyle.text}`} />
            <span className={`text-xs font-bold uppercase tracking-wider ${urgencyStyle.text}`}>
              Oversight Talking Points
            </span>
            <Badge className={`text-2xs ${urgencyStyle.bg} ${urgencyStyle.text} border ${urgencyStyle.border}`}>
              {urgencyStyle.label}
            </Badge>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <CardContent className="p-4 space-y-4">

          {/* THE POINT */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Target className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">The Point</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed pl-8">
              {tp.thePoint}
            </p>
          </div>

          {/* TALK TRACK */}
          {tp.talkTrack && (
            <div className="pl-8">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-2xs font-bold text-blue-500 uppercase tracking-wider mb-1">Open with this</div>
                <p className="text-xs text-blue-800 leading-relaxed italic">
                  {tp.talkTrack}
                </p>
              </div>
            </div>
          )}

          {/* PRESENT TO */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <UserCheck className="h-3.5 w-3.5 text-purple-600" />
              </div>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Present To</span>
            </div>
            <div className="pl-8 space-y-2">
              {tp.presentTo.map((contact, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800">{contact.role}</span>
                      {contact.name && (
                        <span className="text-2xs text-slate-400 italic">({contact.name})</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{contact.why}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ASK FOR (Receivables) */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Package className="h-3.5 w-3.5 text-green-600" />
              </div>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ask For — Walk Away With</span>
            </div>
            <div className="pl-8 space-y-1.5">
              {tp.askFor.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <div className="w-5 h-5 rounded bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-2xs font-bold text-green-600">{i + 1}</span>
                  </div>
                  <span className="text-slate-700 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Compliance Account Summary Card ────────────────────────────────────────

function ComplianceAccountSummary({ completedSteps }: { completedSteps: Set<InvestigationStep> }) {
  const acct = MOCK_COMPLIANCE_ACCOUNT;

  // Determine which conditional obligations to "activate"
  const activeObligations = acct.obligations.map(ob => {
    if (ob.label === 'SSO Incident Report (5-Day)' && completedSteps.has('response')) {
      return { ...ob, status: 'approaching' as const, dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) };
    }
    if (ob.label === 'Corrective Action Plan' && completedSteps.has('response')) {
      return { ...ob, status: 'approaching' as const, dueDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10) };
    }
    return ob;
  });

  return (
    <Card className="border-2 border-slate-300 bg-white overflow-hidden">
      {/* Account Header — dark banner like a credit card statement */}
      <div className="bg-slate-800 px-4 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{acct.accountName}</div>
              <div className="text-2xs text-slate-400">
                {acct.scope} &middot; {acct.scopeDetail}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xs text-slate-500 uppercase tracking-wider">Account ID</div>
              <div className="text-xs font-mono font-bold text-slate-200">{acct.accountId}</div>
              <div className="text-2xs text-slate-500">{acct.accountIdType}</div>
            </div>
            <div className="text-right">
              <div className="text-2xs text-slate-500 uppercase tracking-wider">Permit Cycle</div>
              <div className="text-xs font-mono font-bold text-slate-200">{acct.permitCycle}</div>
            </div>
            <div className="text-right">
              <div className="text-2xs text-slate-500 uppercase tracking-wider">Financial</div>
              <div className="text-xs font-mono font-bold text-green-400">{acct.financialOutstanding}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Obligations Table */}
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {activeObligations.map((ob, i) => {
            const style = obligationStatusStyle(ob.status);
            const days = ob.dueDate ? daysUntil(ob.dueDate) : null;
            const isConditional = ob.status === 'conditional';

            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />

                {/* Obligation name + conditional note */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700">{ob.label}</div>
                  {isConditional && ob.conditionalOn && (
                    <div className="text-2xs text-slate-400 italic">{ob.conditionalOn}</div>
                  )}
                  {ob.amount && (
                    <div className="text-2xs text-emerald-600 font-medium">{ob.amount}</div>
                  )}
                </div>

                {/* Due date + countdown */}
                <div className="text-right flex-shrink-0 w-32">
                  {ob.dueDate ? (
                    <>
                      <div className="text-2xs font-mono text-slate-600">
                        {new Date(ob.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className={`text-2xs font-bold ${
                        days! < 0 ? 'text-red-600' : days! < 30 ? 'text-amber-600' : days! < 90 ? 'text-amber-500' : 'text-slate-400'
                      }`}>
                        {days! < 0 ? `${Math.abs(days!)} days overdue` : `${days} days`}
                      </div>
                    </>
                  ) : (
                    <div className="text-2xs text-slate-400">If triggered</div>
                  )}
                </div>

                {/* Status badge */}
                <Badge className={`text-2xs flex-shrink-0 ${style.bg} ${style.text} border border-current/20`}>
                  {ob.status === 'on-track' ? 'On Track' :
                   ob.status === 'approaching' ? 'Approaching' :
                   ob.status === 'overdue' ? 'Overdue' :
                   ob.status === 'conditional' ? 'If Triggered' : 'N/A'}
                </Badge>

                {/* Create Filing button */}
                <button
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-2xs font-semibold transition-colors flex-shrink-0 ${
                    isConditional
                      ? 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  title={`Create: ${ob.docType}`}
                >
                  <FilePlus2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Prepare Filing</span>
                </button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function RiskInvestigationFlow({ preSelectedRisk, predictions: predictionsProp, onBackToForecast }: RiskInvestigationFlowProps) {
  const predictions = predictionsProp ?? [];
  const [selectedRisk, setSelectedRisk] = useState<RiskPrediction | null>(preSelectedRisk ?? null);
  const [currentStep, setCurrentStep] = useState<InvestigationStep>(preSelectedRisk ? 'briefing' : 'select');
  const [completedSteps, setCompletedSteps] = useState<Set<InvestigationStep>>(new Set());
  const [isFullInvestigation, setIsFullInvestigation] = useState(false);
  const [fullInvestigationPhase, setFullInvestigationPhase] = useState<number>(0); // 0=scenario, 1=response, 2=prevention
  const [reportAudience, setReportAudience] = useState('technical');
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState<Set<number>>(new Set([0]));
  const [copiedLink, setCopiedLink] = useState(false);

  // Navigate to a step
  function goToStep(step: InvestigationStep) {
    if (currentStep !== 'select' && currentStep !== step) {
      setCompletedSteps(prev => new Set(prev).add(currentStep));
    }
    setCurrentStep(step);
  }

  // Select a risk and go to briefing
  function selectRisk(risk: RiskPrediction) {
    setSelectedRisk(risk);
    setCompletedSteps(new Set());
    setIsFullInvestigation(false);
    setFullInvestigationPhase(0);
    goToStep('briefing');
  }

  // Start full investigation
  function startFullInvestigation() {
    setIsFullInvestigation(true);
    setFullInvestigationPhase(0);
    setCompletedSteps(prev => new Set(prev).add('briefing'));
    setCurrentStep('scenario');
  }

  // Continue in full investigation mode
  function continueFullInvestigation() {
    if (fullInvestigationPhase === 0) {
      setCompletedSteps(prev => new Set(prev).add('scenario'));
      setFullInvestigationPhase(1);
      setCurrentStep('response');
    } else if (fullInvestigationPhase === 1) {
      setCompletedSteps(prev => new Set(prev).add('response'));
      setFullInvestigationPhase(2);
      setCurrentStep('prevention');
    } else {
      setCompletedSteps(prev => new Set(prev).add('prevention'));
      setCurrentStep('report');
    }
  }

  function handleCopyLink() {
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // Computed values
  const peer = selectedRisk ? MOCK_PEER_COMPARISONS[selectedRisk.category] : null;
  const history = selectedRisk ? MOCK_HISTORY[selectedRisk.category] : null;
  const cascade = selectedRisk ? RISK_CASCADE[selectedRisk.category] ?? RISK_CASCADE['infrastructure-failure'] : RISK_CASCADE['infrastructure-failure'];
  const interventions = selectedRisk ? RISK_INTERVENTIONS[selectedRisk.category] ?? RISK_INTERVENTIONS['infrastructure-failure'] : RISK_INTERVENTIONS['infrastructure-failure'];
  const actionPhases = selectedRisk ? RISK_ACTION_PHASES[selectedRisk.category] ?? RISK_ACTION_PHASES['infrastructure-failure'] : RISK_ACTION_PHASES['infrastructure-failure'];

  // Compute scenario cost from the real cost engine
  const scenarioResult: ScenarioResult | null = useMemo(() => {
    if (!selectedRisk) return null;
    const mapping = RISK_TO_SCENARIO[selectedRisk.category];
    if (!mapping) return null;
    const scenario = getScenarioById(mapping.scenarioId);
    if (!scenario) return null;
    return computeScenarioCost(scenario, mapping.params, 'ms4-manager', 'Maryland');
  }, [selectedRisk]);

  // Map cost engine tiers to display format
  const displayCostTiers = useMemo(() => {
    if (!scenarioResult) return [];
    return scenarioResult.costTiers.map(ct => {
      const display = TIER_DISPLAY[ct.tier] ?? TIER_DISPLAY.direct;
      return { ...ct, ...display };
    });
  }, [scenarioResult]);

  const totalCostLow = scenarioResult?.totalCostLow ?? 0;
  const totalCostHigh = scenarioResult?.totalCostHigh ?? 0;
  const expectedLossLow = selectedRisk ? Math.round(totalCostLow * (selectedRisk.probability / 100)) : 0;
  const expectedLossHigh = selectedRisk ? Math.round(totalCostHigh * (selectedRisk.probability / 100)) : 0;
  const scoreImpact = scenarioResult?.scoreImpact ?? { before: 65, after: 55, delta: -10 };

  // Dynamic portfolio: run cost engine for every prediction category
  const dynamicPortfolio: PortfolioRisk[] = useMemo(() => {
    return predictions.map(pred => {
      const mapping = RISK_TO_SCENARIO[pred.category];
      if (!mapping) return null;
      const scenario = getScenarioById(mapping.scenarioId);
      if (!scenario) return null;
      const result = computeScenarioCost(scenario, mapping.params, 'ms4-manager', 'Maryland');
      const intvs = RISK_INTERVENTIONS[pred.category];
      const bestOption = intvs?.[1]; // Option B = best ROI
      return {
        category: pred.label,
        probability: pred.probability,
        estCostLow: result.totalCostLow,
        estCostHigh: result.totalCostHigh,
        expectedLossLow: Math.round(result.totalCostLow * (pred.probability / 100)),
        expectedLossHigh: Math.round(result.totalCostHigh * (pred.probability / 100)),
        preventionCostLow: bestOption?.costLow ?? 0,
        preventionCostHigh: bestOption?.costHigh ?? 0,
      };
    }).filter((r): r is PortfolioRisk => r !== null);
  }, [predictions]);

  const portfolioTotals = useMemo(() => {
    const t = dynamicPortfolio.reduce((acc, r) => ({
      estCostLow: acc.estCostLow + r.estCostLow,
      estCostHigh: acc.estCostHigh + r.estCostHigh,
      expectedLossLow: acc.expectedLossLow + r.expectedLossLow,
      expectedLossHigh: acc.expectedLossHigh + r.expectedLossHigh,
      preventionCostLow: acc.preventionCostLow + r.preventionCostLow,
      preventionCostHigh: acc.preventionCostHigh + r.preventionCostHigh,
    }), { estCostLow: 0, estCostHigh: 0, expectedLossLow: 0, expectedLossHigh: 0, preventionCostLow: 0, preventionCostHigh: 0 });
    return t;
  }, [dynamicPortfolio]);

  // Build talking points with interpolated values
  const talkingPoints = useMemo(() => {
    const bestOption = interventions[1];
    return buildTalkingPoints({
      costLow: formatCurrency(totalCostLow),
      costHigh: formatCurrency(totalCostHigh),
      preventLow: formatCurrency(interventions[0]?.costLow ?? 0),
      preventHigh: formatCurrency(interventions[0]?.costHigh ?? 0),
      optBCostLow: formatCurrency(bestOption?.costLow ?? 0),
      optBCostHigh: formatCurrency(bestOption?.costHigh ?? 0),
      optBReduction: bestOption?.probReduction ?? '',
      optCCostLow: formatCurrency(interventions[2]?.costLow ?? 0),
      cascadeAUs: cascade.assessmentUnits,
      population: formatNumber(cascade.populationExposed),
    });
  }, [totalCostLow, totalCostHigh, interventions, cascade]);

  const selectedAudience = MOCK_AUDIENCES.find(a => a.id === reportAudience);

  const IconComponent = selectedRisk ? (ICON_MAP[selectedRisk.icon] || AlertTriangle) : AlertTriangle;

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ═══ BREADCRUMB NAVIGATION ═══ */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="cursor-pointer text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => {
                      if (onBackToForecast) onBackToForecast();
                      else { setSelectedRisk(null); setCurrentStep('select'); }
                    }}
                  >
                    Risk Forecast
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {selectedRisk && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {currentStep === 'briefing' ? (
                        <BreadcrumbPage className="text-xs">{selectedRisk.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          className="cursor-pointer text-xs text-blue-600 hover:text-blue-800"
                          onClick={() => goToStep('briefing')}
                        >
                          {selectedRisk.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {currentStep !== 'select' && currentStep !== 'briefing' && (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage className="text-xs">{STEP_LABELS[currentStep]}</BreadcrumbPage>
                        </BreadcrumbItem>
                      </>
                    )}
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
            <MockDataBadge />
          </div>
        </CardContent>
      </Card>

      {/* ═══ FULL INVESTIGATION PROGRESS BAR ═══ */}
      {isFullInvestigation && currentStep !== 'select' && currentStep !== 'briefing' && currentStep !== 'report' && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-blue-600" />
              <span className="text-xs font-semibold text-slate-700">Full Investigation Progress</span>
            </div>
            <div className="flex items-center gap-1">
              {(['scenario', 'response', 'prevention'] as InvestigationStep[]).map((step, i) => {
                const isComplete = completedSteps.has(step);
                const isCurrent = currentStep === step;
                return (
                  <React.Fragment key={step}>
                    <button
                      onClick={() => { if (isComplete || isCurrent) goToStep(step); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-2xs font-semibold transition-all ${
                        isComplete ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200' :
                        isCurrent ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' :
                        'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="h-3 w-3" /> : isCurrent ? <Circle className="h-3 w-3 fill-blue-400" /> : <Circle className="h-3 w-3" />}
                      {STEP_LABELS[step]}
                    </button>
                    {i < 2 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ COMPLIANCE ACCOUNT SUMMARY ═══ */}
      {currentStep !== 'select' && selectedRisk && (
        <ComplianceAccountSummary completedSteps={completedSteps} />
      )}

      {/* ═══ PORTFOLIO VIEW (toggle) ═══ */}
      <div>
        <button
          onClick={() => setShowPortfolio(!showPortfolio)}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors mb-2"
        >
          {showPortfolio ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <Layers className="h-3.5 w-3.5" />
          Portfolio Risk Summary
        </button>

        {showPortfolio && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" />
                Risk Portfolio — Aggregate Exposure
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 font-semibold text-slate-600">Category</th>
                    <th className="text-center py-2 px-2 font-semibold text-slate-600">Prob.</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Est. Cost</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Expected Loss</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Prevention Cost</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Net Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {dynamicPortfolio.map((r) => {
                    const savingsLow = r.expectedLossLow - r.preventionCostHigh;
                    const savingsHigh = r.expectedLossHigh - r.preventionCostLow;
                    return (
                      <tr key={r.category} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-1.5 px-2 font-medium text-slate-700">{r.category}</td>
                        <td className="text-center py-1.5 px-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold ${
                            r.probability >= 70 ? 'bg-red-100 text-red-700' : r.probability >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>{r.probability}%</span>
                        </td>
                        <td className="text-right py-1.5 px-2 font-mono">{formatCurrency(r.estCostLow)}–{formatCurrency(r.estCostHigh)}</td>
                        <td className="text-right py-1.5 px-2 font-mono text-red-600">{formatCurrency(r.expectedLossLow)}–{formatCurrency(r.expectedLossHigh)}</td>
                        <td className="text-right py-1.5 px-2 font-mono">{formatCurrency(r.preventionCostLow)}–{formatCurrency(r.preventionCostHigh)}</td>
                        <td className="text-right py-1.5 px-2 font-mono text-green-600">
                          {savingsLow > 0 ? `${formatCurrency(savingsLow)}–${formatCurrency(savingsHigh)}` : 'Varies'}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                    <td className="py-2 px-2 text-slate-800">TOTAL</td>
                    <td className="text-center py-2 px-2 text-slate-500">—</td>
                    <td className="text-right py-2 px-2 font-mono">{formatCurrency(portfolioTotals.estCostLow)}–{formatCurrency(portfolioTotals.estCostHigh)}</td>
                    <td className="text-right py-2 px-2 font-mono text-red-700">{formatCurrency(portfolioTotals.expectedLossLow)}–{formatCurrency(portfolioTotals.expectedLossHigh)}</td>
                    <td className="text-right py-2 px-2 font-mono">{formatCurrency(portfolioTotals.preventionCostLow)}–{formatCurrency(portfolioTotals.preventionCostHigh)}</td>
                    <td className="text-right py-2 px-2 font-mono text-green-700">
                      {formatCurrency(portfolioTotals.expectedLossLow - portfolioTotals.preventionCostHigh)}–{formatCurrency(portfolioTotals.expectedLossHigh - portfolioTotals.preventionCostLow)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg p-2 border border-green-200">
                <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
                Year-over-year comparison: Risk position improved 42% due to actions taken in the past 12 months.
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP: RISK SELECTION */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {currentStep === 'select' && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Search size={14} /> Select a Risk to Investigate
          </h3>
          {predictions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">Insufficient Data</p>
              <p className="text-xs text-slate-400 mt-1">Risk predictions require site intelligence data. Select a deployment location to generate forecasts.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {predictions.map((pred) => {
                const PredIcon = ICON_MAP[pred.icon] || AlertTriangle;
                const riskColors: Record<string, { bg: string; text: string; bar: string }> = {
                  green: { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-green-500' },
                  amber: { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' },
                  red: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500' },
                  gray: { bg: 'bg-slate-50', text: 'text-slate-500', bar: 'bg-slate-400' },
                };
                const colors = riskColors[pred.riskLevel] || riskColors.gray;
                return (
                  <div key={pred.category} className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <PredIcon className={`h-4 w-4 flex-shrink-0 ${colors.text}`} />
                        <span className="text-xs font-semibold text-slate-800 leading-tight">{pred.label}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${pred.probability}%` }} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold ${colors.text}`}>{pred.probability}%</span>
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold">{pred.timeframe}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{pred.summary}</p>
                      <button
                        onClick={() => selectRisk(pred)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-2xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        <Search className="h-3 w-3" />
                        Investigate This Risk
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 1: RISK BRIEFING */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {currentStep === 'briefing' && selectedRisk && (
        <div className="space-y-4">

          {/* Expanded Risk Card */}
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-4">
                <div className={`rounded-xl p-3 ${
                  selectedRisk.riskLevel === 'red' ? 'bg-red-100' : selectedRisk.riskLevel === 'amber' ? 'bg-amber-100' : 'bg-green-100'
                }`}>
                  <IconComponent className={`h-6 w-6 ${
                    selectedRisk.riskLevel === 'red' ? 'text-red-600' : selectedRisk.riskLevel === 'amber' ? 'text-amber-600' : 'text-green-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-slate-900">{selectedRisk.label}</h2>
                  <p className="text-sm text-slate-600 mt-1">{selectedRisk.summary}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-600">Probability</span>
                        <span className={`font-bold ${
                          selectedRisk.riskLevel === 'red' ? 'text-red-600' : selectedRisk.riskLevel === 'amber' ? 'text-amber-600' : 'text-green-600'
                        }`}>{selectedRisk.probability}%</span>
                      </div>
                      <Progress value={selectedRisk.probability} className="h-2" />
                    </div>
                    <Badge className={`text-2xs ${
                      selectedRisk.confidence === 'HIGH' ? 'bg-green-100 text-green-700' :
                      selectedRisk.confidence === 'MODERATE' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>{selectedRisk.confidence} confidence</Badge>
                    <Badge className="text-2xs bg-slate-100 text-slate-500">{selectedRisk.timeframe}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Oversight Talking Points */}
          <TalkingPointsCard step="briefing" talkingPoints={talkingPoints} />

          {/* Contributing Indices */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 size={14} className="text-indigo-600" />
                Contributing Indices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {selectedRisk.factors.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="w-44 text-slate-600 truncate">{f.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${
                        f.direction === 'negative' ? 'bg-red-400' : f.direction === 'positive' ? 'bg-green-400' : 'bg-slate-300'
                      }`} style={{ width: `${f.value}%` }} />
                    </div>
                    <span className="w-8 text-right font-mono font-bold text-slate-700">{f.value}</span>
                    <span className="w-4">
                      {f.direction === 'negative' ? <TrendingDown className="h-3 w-3 text-red-500" /> :
                       f.direction === 'positive' ? <TrendingUp className="h-3 w-3 text-green-500" /> :
                       <Minus className="h-3 w-3 text-slate-400" />}
                    </span>
                    <span className="w-10 text-right text-2xs text-slate-400 font-mono">{(f.weight * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Peer Comparison + History + Data Sources */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Peer Comparison */}
            {peer && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} className="text-indigo-600" />
                    <span className="text-xs font-semibold text-slate-700">Peer Comparison</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Your failure probability is higher than <strong className="text-indigo-700">{peer.percentile}%</strong> of {peer.peerGroup} in {peer.state}.
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${peer.percentile}%` }} />
                  </div>
                  <div className="flex justify-between text-2xs text-slate-400 mt-1">
                    <span>Better than peers</span>
                    <span>Worse</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* History */}
            {history && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={14} className="text-amber-600" />
                    <span className="text-xs font-semibold text-slate-700">Previous Occurrence</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>{history.date}</strong> — {history.event}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <DollarSign className="h-3 w-3 text-red-500" />
                    <span className="text-xs font-bold text-red-600">Cost: {history.cost}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Data Sources */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-slate-600" />
                  <span className="text-xs font-semibold text-slate-700">Data Sources</span>
                </div>
                <div className="space-y-1">
                  {MOCK_DATA_SOURCES.slice(0, 5).map((src, i) => (
                    <div key={i} className="text-2xs text-slate-500 flex items-start gap-1.5">
                      <Check className="h-2.5 w-2.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{src}</span>
                    </div>
                  ))}
                  <div className="text-2xs text-slate-400 mt-1">+ {MOCK_DATA_SOURCES.length - 5} more sources</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">What do you want to investigate?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  onClick={() => goToStep('scenario')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-center"
                >
                  <DollarSign className="h-6 w-6 text-red-600" />
                  <span className="text-xs font-bold text-red-700">What does this cost?</span>
                  <span className="text-2xs text-red-500">4-tier cost analysis</span>
                </button>
                <button
                  onClick={() => goToStep('response')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-center"
                >
                  <Zap className="h-6 w-6 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">This is happening now</span>
                  <span className="text-2xs text-amber-500">Response plan + cascade</span>
                </button>
                <button
                  onClick={() => goToStep('prevention')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-colors text-center"
                >
                  <Shield className="h-6 w-6 text-green-600" />
                  <span className="text-xs font-bold text-green-700">How do I prevent this?</span>
                  <span className="text-2xs text-green-500">3 intervention options</span>
                </button>
                <button
                  onClick={startFullInvestigation}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-center"
                >
                  <Target className="h-6 w-6 text-blue-600" />
                  <span className="text-xs font-bold text-blue-700">Full Investigation</span>
                  <span className="text-2xs text-blue-500">All 3 analyses + report</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 2A: SCENARIO / COST ANALYSIS */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {currentStep === 'scenario' && selectedRisk && (
        <div className="space-y-4">

          {/* Expected Loss Banner */}
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1">Expected Loss Calculation</div>
                  <div className="text-2xl font-bold text-red-700 font-mono">
                    {formatCurrency(expectedLossLow)} — {formatCurrency(expectedLossHigh)}
                  </div>
                  <div className="text-xs text-red-500 mt-1">
                    Probability ({selectedRisk.probability}%) x Total Cost ({formatCurrency(totalCostLow)}–{formatCurrency(totalCostHigh)}) = Expected Loss
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-red-200">
                  <div className="text-center">
                    <div className="text-2xs text-slate-400">Score Before</div>
                    <div className="text-lg font-bold text-slate-700 font-mono">{scoreImpact.before}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-red-400" />
                  <div className="text-center">
                    <div className="text-2xs text-slate-400">Score After</div>
                    <div className="text-lg font-bold text-red-600 font-mono">{scoreImpact.after}</div>
                  </div>
                  <div className="text-xs font-bold text-red-600 ml-2">{scoreImpact.delta} pts</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Oversight Talking Points */}
          <TalkingPointsCard step="scenario" talkingPoints={talkingPoints} />

          {/* Cost Tiers */}
          {displayCostTiers.map((tier, ti) => {
            const TierIcon = tier.icon;
            const isExpanded = expandedTiers.has(ti);
            const isTimeline = tier.tier === 'timeline';
            return (
              <Card key={tier.tier} className={`border ${tier.borderColor}`}>
                <div
                  className={`p-4 cursor-pointer ${tier.color} hover:opacity-90 transition-opacity`}
                  onClick={() => {
                    const next = new Set(expandedTiers);
                    if (next.has(ti)) next.delete(ti); else next.add(ti);
                    setExpandedTiers(next);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TierIcon className={`h-4 w-4 ${tier.textColor}`} />
                      <span className={`text-sm font-bold ${tier.textColor}`}>{tier.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isTimeline && (
                        <span className={`text-sm font-bold font-mono ${tier.textColor}`}>
                          {formatCurrency(tier.totalLow)} — {formatCurrency(tier.totalHigh)}
                        </span>
                      )}
                      {isTimeline && (
                        <span className={`text-sm font-bold ${tier.textColor}`}>See timeline</span>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <CardContent className="pt-0 pb-4">
                    <div className="space-y-2 mt-3">
                      {tier.items.map((item, ii) => (
                        <div key={ii} className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5">
                          <span className="text-slate-600">{item.label}</span>
                          {isTimeline ? (
                            <span className="font-mono text-slate-500">
                              {item.notes ?? '—'}
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-slate-700">
                              {formatCurrency(item.lowEstimate)} — {formatCurrency(item.highEstimate)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {/* Continue Buttons */}
          <div className="flex flex-wrap gap-3">
            {isFullInvestigation ? (
              <button
                onClick={continueFullInvestigation}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                Continue to Response Plan <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button onClick={() => goToStep('response')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors">
                  <Zap className="h-3.5 w-3.5" /> Response Plan
                </button>
                <button onClick={() => goToStep('prevention')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors">
                  <Shield className="h-3.5 w-3.5" /> Prevention Plan
                </button>
                <button onClick={() => goToStep('report')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 transition-colors">
                  <FileText className="h-3.5 w-3.5" /> Generate Report
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 2B: RESPONSE PLAN */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {currentStep === 'response' && selectedRisk && (
        <div className="space-y-4">

          {/* Cascade Model Banner */}
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-bold text-amber-700">Cascade Impact Model</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Assessment Units', value: cascade.assessmentUnits, icon: Layers },
                  { label: 'DW Intakes', value: cascade.drinkingWaterIntakes, icon: Waves },
                  { label: 'MS4 Jurisdictions', value: cascade.ms4Jurisdictions, icon: Building2 },
                  { label: 'Population Exposed', value: formatNumber(cascade.populationExposed), icon: Users },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="text-center">
                    <Icon className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                    <div className="text-xl font-bold text-amber-800 font-mono">{value}</div>
                    <div className="text-2xs text-amber-600">{label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Oversight Talking Points */}
          <TalkingPointsCard step="response" talkingPoints={talkingPoints} />

          {/* Action Phases */}
          {actionPhases.map((phase) => (
            <Card key={phase.phase} className={`border ${phase.borderColor}`}>
              <CardHeader className={`pb-2 ${phase.color}`}>
                <CardTitle className={`text-sm flex items-center gap-2 ${phase.textColor}`}>
                  <Clock size={14} />
                  {phase.phase}
                  <Badge className={`text-2xs ${phase.color} ${phase.textColor} border ${phase.borderColor}`}>
                    {phase.timeframe}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-1.5">
                  {phase.tasks.map((task, ti) => (
                    <div key={ti} className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="h-3.5 w-3.5 text-slate-300 mt-0.5 flex-shrink-0" />
                      <span>{task}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Resource Allocation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users size={14} className="text-slate-600" />
                Resource Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { role: 'Emergency Crew', count: '4-6 personnel', hours: '0-72h', cost: '$45K' },
                  { role: 'Engineering / Assessment', count: '2 engineers', hours: '24h-30d', cost: '$28K' },
                  { role: 'Environmental Monitoring', count: '1 team + lab', hours: '24h-90d', cost: '$25K' },
                ].map((r) => (
                  <div key={r.role} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-bold text-slate-700">{r.role}</div>
                    <div className="mt-1 space-y-1 text-2xs text-slate-500">
                      <div className="flex justify-between"><span>Personnel</span><span className="font-mono">{r.count}</span></div>
                      <div className="flex justify-between"><span>Duration</span><span className="font-mono">{r.hours}</span></div>
                      <div className="flex justify-between"><span>Est. Cost</span><span className="font-mono font-bold text-slate-700">{r.cost}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notification Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock size={14} className="text-blue-600" />
                Notification Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { time: '0-2 hours', who: 'MDE Emergency Response', method: 'Phone + email (permit requirement)' },
                  { time: '0-4 hours', who: 'Public Works Director', method: 'Direct call' },
                  { time: '0-6 hours', who: 'Elected officials (Council)', method: 'Email briefing' },
                  { time: '0-12 hours', who: 'Downstream jurisdictions', method: 'Regional notification system' },
                  { time: '0-24 hours', who: 'General public (if exposure)', method: 'Press release + signage' },
                  { time: '5 days', who: 'MDE (written report)', method: 'Formal 5-day SSO report' },
                ].map((n, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs border-b border-slate-100 pb-1.5">
                    <span className="w-20 text-2xs font-mono font-bold text-blue-600">{n.time}</span>
                    <span className="w-44 font-medium text-slate-700">{n.who}</span>
                    <span className="text-slate-500 flex-1">{n.method}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Continue Buttons */}
          <div className="flex flex-wrap gap-3">
            {isFullInvestigation ? (
              <button
                onClick={continueFullInvestigation}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                Continue to Prevention Plan <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button onClick={() => goToStep('scenario')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors">
                  <DollarSign className="h-3.5 w-3.5" /> Quantify Impact
                </button>
                <button onClick={() => goToStep('prevention')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors">
                  <Shield className="h-3.5 w-3.5" /> Plan Recovery
                </button>
                <button onClick={() => goToStep('report')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 transition-colors">
                  <FileText className="h-3.5 w-3.5" /> Generate Report
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 2C: PREVENTION PLAN */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {currentStep === 'prevention' && selectedRisk && (
        <div className="space-y-4">

          {/* Intervention Options */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield size={16} className="text-green-600" />
                Intervention Options Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 font-semibold text-slate-600">Option</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Cost</th>
                    <th className="text-center py-2 px-2 font-semibold text-slate-600">Risk Reduction</th>
                    <th className="text-center py-2 px-2 font-semibold text-slate-600">Score +</th>
                    <th className="text-center py-2 px-2 font-semibold text-slate-600">ROI</th>
                    <th className="text-center py-2 px-2 font-semibold text-slate-600">Timeline</th>
                  </tr>
                </thead>
                <tbody>
                  {interventions.map((intv) => (
                    <tr key={intv.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-2">
                        <div className="font-bold text-slate-700">Option {intv.id}: {intv.name}</div>
                        <div className="text-2xs text-slate-500 mt-0.5">{intv.description}</div>
                      </td>
                      <td className="text-right py-2 px-2 font-mono font-bold">{formatCurrency(intv.costLow)}–{formatCurrency(intv.costHigh)}</td>
                      <td className="text-center py-2 px-2 font-mono font-bold text-green-600">{intv.probReduction}</td>
                      <td className="text-center py-2 px-2 font-mono font-bold text-blue-600">+{intv.scoreImprovement}</td>
                      <td className="text-center py-2 px-2 font-mono font-bold text-purple-600">{intv.roiLow}x–{intv.roiHigh}x</td>
                      <td className="text-center py-2 px-2 text-slate-500">{intv.timeline}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Oversight Talking Points */}
          <TalkingPointsCard step="prevention" talkingPoints={talkingPoints} />

          {/* Score Improvement Simulation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp size={14} className="text-green-600" />
                Score Improvement Simulation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {interventions.map((intv) => {
                  const currentScore = scoreImpact.before;
                  const newScore = currentScore + intv.scoreImprovement;
                  return (
                    <div key={intv.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">Option {intv.id}: {intv.name}</span>
                        <span className="font-mono font-bold text-green-600">{currentScore} → {newScore} (+{intv.scoreImprovement})</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden relative">
                        <div className="absolute inset-y-0 left-0 bg-slate-300 rounded-full" style={{ width: `${(currentScore / 800) * 100}%` }} />
                        <div className="absolute inset-y-0 left-0 bg-green-500 rounded-full" style={{ width: `${(newScore / 800) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Prevention vs Occurrence */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Scale size={14} className="text-indigo-600" />
                Prevention vs. Occurrence Cost Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
                  <div className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">If Failure Occurs</div>
                  <div className="text-2xl font-bold text-red-700 font-mono">{formatCurrency(totalCostLow)} — {formatCurrency(totalCostHigh)}</div>
                  <div className="text-2xs text-red-500 mt-1">Direct + regulatory + economic costs</div>
                  <div className="mt-2 text-xs text-red-600">
                    Plus: recovery period, score drop of {Math.abs(scoreImpact.delta)} points, NOV risk, public trust impact
                  </div>
                </div>
                <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4">
                  <div className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Best Prevention Option (B): {interventions[1]?.name}</div>
                  <div className="text-2xl font-bold text-green-700 font-mono">{formatCurrency(interventions[1]?.costLow ?? 0)} — {formatCurrency(interventions[1]?.costHigh ?? 0)}</div>
                  <div className="text-2xs text-green-500 mt-1">{interventions[1]?.probReduction} risk, +{interventions[1]?.scoreImprovement} score</div>
                  <div className="mt-2 text-xs text-green-600">
                    Savings: {formatCurrency(totalCostLow - (interventions[1]?.costHigh ?? 0))} — {formatCurrency(totalCostHigh - (interventions[1]?.costLow ?? 0))} avoided cost, {interventions[1]?.roiLow}x–{interventions[1]?.roiHigh}x ROI
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grant Eligibility */}
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-emerald-700">Grant Eligibility: EPA Clean Water State Revolving Fund (SRF)</div>
                  <p className="text-xs text-emerald-600 mt-1 leading-relaxed">
                    This project may qualify for subsidized SRF financing at 1.5-2.0% interest (vs. 4.5% municipal bond rate).
                    Infrastructure condition assessment + cost-benefit documentation required.
                    Maryland SRF program accepts applications quarterly — next deadline: April 15, 2026.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className="text-2xs bg-emerald-100 text-emerald-700 border border-emerald-300">Potential savings: $15-40K in interest</Badge>
                    <Badge className="text-2xs bg-emerald-100 text-emerald-700 border border-emerald-300">Application deadline: Apr 15</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Continue Buttons */}
          <div className="flex flex-wrap gap-3">
            {isFullInvestigation ? (
              <button
                onClick={continueFullInvestigation}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                Generate Report <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button onClick={() => goToStep('scenario')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors">
                  <DollarSign className="h-3.5 w-3.5" /> Full Cost Analysis
                </button>
                <button onClick={() => goToStep('response')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors">
                  <Zap className="h-3.5 w-3.5" /> Worst Case Response
                </button>
                <button onClick={() => goToStep('report')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 transition-colors">
                  <FileText className="h-3.5 w-3.5" /> Generate Report
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP: REPORT */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {currentStep === 'report' && selectedRisk && (
        <div className="space-y-4">

          {/* Audience Selector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText size={16} className="text-slate-700" />
                Investigation Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Select Audience</div>
                <div className="flex flex-wrap gap-2">
                  {MOCK_AUDIENCES.map((aud) => (
                    <button
                      key={aud.id}
                      onClick={() => setReportAudience(aud.id)}
                      className={`px-3 py-1.5 rounded-full text-2xs font-semibold transition-colors ${
                        reportAudience === aud.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Report Structure */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Report Sections</div>
                <div className="space-y-1.5">
                  {REPORT_SECTIONS.map((section) => {
                    const isIncluded = selectedAudience?.sections.includes(section.id) ?? false;
                    const isDataAvailable = section.requiredStep === null || completedSteps.has(section.requiredStep);
                    const willRender = isIncluded && isDataAvailable;
                    return (
                      <div key={section.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                        willRender ? 'bg-green-50 border-green-200 text-green-700' :
                        isIncluded && !isDataAvailable ? 'bg-amber-50 border-amber-200 text-amber-600' :
                        'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        {willRender ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> :
                         isIncluded && !isDataAvailable ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> :
                         <Circle className="h-3.5 w-3.5 text-slate-300" />}
                        <span className="font-medium flex-1">{section.label}</span>
                        {isIncluded && !isDataAvailable && (
                          <span className="text-2xs">Complete {STEP_LABELS[section.requiredStep!]} to include</span>
                        )}
                        {willRender && <span className="text-2xs">Included</span>}
                        {!isIncluded && <span className="text-2xs">Not for this audience</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Oversight Talking Points */}
          <TalkingPointsCard step="report" talkingPoints={talkingPoints} />

          {/* Executive Summary Preview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText size={14} className="text-blue-600" />
                Executive Summary Preview
                <Badge className="text-2xs bg-blue-100 text-blue-600">Auto-generated</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 text-xs text-slate-700 leading-relaxed space-y-2">
                <p>
                  <strong>Risk Assessment — {selectedRisk.label}</strong>
                </p>
                <p>
                  {reportAudience === 'council' && (
                    <>This briefing summarizes a {selectedRisk.probability}% probability event that could cost the jurisdiction {formatCurrency(totalCostLow)}–{formatCurrency(totalCostHigh)} in direct, regulatory, and economic impacts. The expected loss (probability-weighted) is {formatCurrency(expectedLossLow)}–{formatCurrency(expectedLossHigh)}. Prevention options range from {formatCurrency(interventions[2]?.costLow ?? 0)} ({interventions[2]?.name}) to {formatCurrency(interventions[0]?.costHigh ?? 0)} ({interventions[0]?.name}), with ROI between {interventions[0]?.roiLow}x and {interventions[2]?.roiHigh}x. Staff recommends Option B ({interventions[1]?.name}) as the best balance of cost reduction and risk mitigation.</>
                  )}
                  {reportAudience === 'technical' && (
                    <>Analysis of {selectedRisk.factors.length} contributing indices indicates a {selectedRisk.confidence} confidence {selectedRisk.probability}% probability within {selectedRisk.timeframe}. Primary drivers include infrastructure condition scoring, climate vulnerability, and load velocity trends. The 4-tier cost model projects {formatCurrency(totalCostLow)}–{formatCurrency(totalCostHigh)} total impact. Three intervention options were evaluated: {interventions[0]?.name}, {interventions[1]?.name}, and {interventions[2]?.name}. Option B offers optimal ROI at {interventions[1]?.roiLow}–{interventions[1]?.roiHigh}x with risk reduction of {interventions[1]?.probReduction}.</>
                  )}
                  {reportAudience === 'grant' && (
                    <>This application documents a critical risk ({selectedRisk.label.toLowerCase()}) with {selectedRisk.probability}% failure probability within {selectedRisk.timeframe}. The system serves {formatNumber(cascade.populationExposed)} residents across {cascade.ms4Jurisdictions} jurisdictions. Without intervention, expected losses total {formatCurrency(expectedLossLow)}–{formatCurrency(expectedLossHigh)}. The proposed {interventions[1]?.name} project ({formatCurrency(interventions[1]?.costLow ?? 0)}–{formatCurrency(interventions[1]?.costHigh ?? 0)}) would reduce risk ({interventions[1]?.probReduction}), improve the watershed score by {interventions[1]?.scoreImprovement} points, and deliver a {interventions[1]?.roiLow}–{interventions[1]?.roiHigh}x return on investment.</>
                  )}
                  {reportAudience === 'insurance' && (
                    <>Risk assessment for {selectedRisk.label.toLowerCase()} event with {selectedRisk.probability}% probability within {selectedRisk.timeframe}. Total exposure: {formatCurrency(totalCostLow)}–{formatCurrency(totalCostHigh)}. Current controls: routine inspection (annual). Recommended additional controls: {interventions[1]?.name} to reduce risk ({interventions[1]?.probReduction}). Cascade impact would affect {cascade.assessmentUnits} assessment units and {formatNumber(cascade.populationExposed)} population. Historical precedent: {history?.date} event cost {history?.cost}.</>
                  )}
                  {reportAudience === 'public' && (
                    <>The City has identified a potential {selectedRisk.label.toLowerCase()} concern and is taking proactive steps to address it. Engineering assessments are underway, and the City is evaluating options to prevent service disruptions. Residents will be notified of any scheduled work that may affect their area. The City remains committed to maintaining safe and reliable water infrastructure for all residents.</>
                  )}
                  {(reportAudience === 'legislature' || reportAudience === 'internal' || reportAudience === 'after-action') && (
                    <>Analysis identified a {selectedRisk.probability}% probability {selectedRisk.label.toLowerCase()} event within {selectedRisk.timeframe}. Based on {selectedRisk.confidence} confidence data from {MOCK_DATA_SOURCES.length} sources, the expected loss is {formatCurrency(expectedLossLow)}–{formatCurrency(expectedLossHigh)}. Three intervention options were evaluated with ROI ranging from {interventions[0]?.roiLow}x to {interventions[2]?.roiHigh}x. The recommended path forward is {interventions[1]?.name} ({formatCurrency(interventions[1]?.costLow ?? 0)}–{formatCurrency(interventions[1]?.costHigh ?? 0)}) which achieves risk reduction of {interventions[1]?.probReduction} and improves the system score by {interventions[1]?.scoreImprovement} points.</>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Report Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors border border-slate-200"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
              <Share2 className="h-3.5 w-3.5" /> Share Report
            </button>
            <button
              onClick={() => goToStep('briefing')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors border border-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Briefing
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
