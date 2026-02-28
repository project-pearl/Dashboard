'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandedPrintBtn } from '@/lib/brandedPrint';
import {
  X, AlertTriangle, Shield, Beaker, ChevronDown, TrendingUp, TrendingDown,
  Calendar, CheckCircle, Clock, ArrowRight, Expand, Filter, FlaskConical,
  Droplets, Activity, Waves, FileText, BarChart3,
} from 'lucide-react';
import {
  AreaChart, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Bar, Area, Cell,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────

interface ThreatData {
  id: string;
  name: string;
  subtitle: string;
  level: string;
  icon: string;
  mcl: string;
  deadline: string;
  monitorBy: string;
  summary: string;
  keyFacts: { label: string; value: string; desc: string }[];
  topStates: { state: string; units: number }[];
  stateData: {
    state: string;
    units: number;
    systems: number;
    rank: number;
    stricterThanFed: boolean;
    stateStandard: string;
    trend: string;
  };
  ms4Data: {
    jurisdiction: string;
    sites: number;
    runoffRisk: string;
    bmpsNeeded: number;
  };
  waterbodies: { name: string; type: string; status: string; level: string }[];
  trend: { yr: string; v: number }[];
  treatmentAvailable: boolean;
  treatmentMethod: string;
  treatmentRemoval: number;
  treatmentStages: string;
  treatmentEvidence: string;
  nationalCount: number;
  yoy: number;
}

interface RegEvent {
  date: string;
  title: string;
  type: string;
  contaminant: string;
  status: 'complete' | 'active' | 'upcoming';
  impact: string;
}

interface StateComparison {
  state: string;
  pfas: string;
  micro: string;
  cyano: string;
  sixppd: string;
  lead: string;
  overall: string;
  score: number;
}

type TabId = 'threats' | 'calendar' | 'states' | 'treatment';

// ── Style constants ──────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<string, { badge: string; text: string; bg: string; border: string }> = {
  REGULATED: { badge: 'bg-red-100 text-red-800 border-red-200', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  'PRE-REGULATORY': { badge: 'bg-amber-100 text-amber-800 border-amber-200', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  ADVISORY: { badge: 'bg-green-100 text-green-800 border-green-200', text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  EMERGING: { badge: 'bg-purple-100 text-purple-800 border-purple-200', text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  MONITORING: { badge: 'bg-cyan-100 text-cyan-800 border-cyan-200', text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  'REVISED RULE': { badge: 'bg-pink-100 text-pink-800 border-pink-200', text: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' },
};

const LEVEL_COLORS: Record<string, string> = {
  REGULATED: '#ef4444',
  'PRE-REGULATORY': '#f59e0b',
  ADVISORY: '#22c55e',
  EMERGING: '#a855f7',
  MONITORING: '#06b6d4',
  'REVISED RULE': '#ec4899',
};

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 11,
  color: '#1e293b',
};

// ── Threat Data ──────────────────────────────────────────────────────────────

const threats: ThreatData[] = [
  {
    id: 'pfas',
    name: 'PFAS',
    subtitle: 'Per- & Polyfluoroalkyl Substances',
    level: 'REGULATED',
    icon: '\u2B21',
    mcl: '4 ppt (PFOA/PFOS)',
    deadline: '2031',
    monitorBy: '2027',
    summary: 'First enforceable MCLs. Deadline extended 2029\u21922031. Four additional PFAS MCLs under reconsideration by Trump EPA.',
    keyFacts: [
      { label: 'MCL', value: '4 ppt', desc: 'PFOA & PFOS' },
      { label: 'Monitor By', value: '2027', desc: 'Initial sampling' },
      { label: 'Comply By', value: '2031', desc: 'Extended' },
      { label: 'Funding', value: '$1B', desc: 'IIJA allocated' },
    ],
    topStates: [
      { state: 'NJ', units: 847 },
      { state: 'MI', units: 623 },
      { state: 'MA', units: 512 },
      { state: 'NH', units: 389 },
      { state: 'NY', units: 734 },
    ],
    stateData: { state: 'MD', units: 287, systems: 94, rank: 12, stricterThanFed: false, stateStandard: 'Follows EPA', trend: 'Rising' },
    ms4Data: { jurisdiction: 'Anne Arundel County', sites: 12, runoffRisk: 'Moderate', bmpsNeeded: 3 },
    waterbodies: [
      { name: 'Merrimack River, MA', type: 'River', status: 'Impaired', level: '12 ppt' },
      { name: 'Huron River, MI', type: 'River', status: 'Impaired', level: '18 ppt' },
      { name: 'Cape Fear River, NC', type: 'River', status: 'Impaired', level: '42 ppt' },
      { name: 'Back River WWTP, MD', type: 'Discharge', status: 'Detected', level: '8 ppt' },
      { name: 'Patapsco River, MD', type: 'River', status: 'Advisory', level: '6 ppt' },
    ],
    trend: [
      { yr: '20', v: 580 },
      { yr: '21', v: 890 },
      { yr: '22', v: 1240 },
      { yr: '23', v: 1890 },
      { yr: '24', v: 2340 },
      { yr: '25', v: 2810 },
    ],
    treatmentAvailable: true,
    treatmentMethod: 'Multi-stage resin adsorption + ozone',
    treatmentRemoval: 92,
    treatmentStages: 'Stages 18-34 (GAC/IX resin) + Stage 45 (ozone)',
    treatmentEvidence: 'Bench-scale confirmed. Milton FL pilot pending PFAS-specific trial.',
    nationalCount: 9823,
    yoy: 20,
  },
  {
    id: 'microplastics',
    name: 'Microplastics',
    subtitle: 'Micro & Nanoplastic Particles',
    level: 'PRE-REGULATORY',
    icon: '\u25C8',
    mcl: 'None',
    deadline: 'TBD',
    monitorBy: 'TBD',
    summary: '7 governors petitioned EPA. UCMR 6 petition filed. No federal standard. Concentrations predicted to double by 2040.',
    keyFacts: [
      { label: 'Per Liter', value: '240K', desc: 'Particles (bottled)' },
      { label: 'Governors', value: '7', desc: 'Petitioned Nov 2025' },
      { label: 'Size', value: '<5mm', desc: 'Incl. nanoplastics' },
      { label: 'UCMR', value: 'Petitioned', desc: 'Seeking UCMR 6' },
    ],
    topStates: [
      { state: 'CA', units: 1240 },
      { state: 'TX', units: 890 },
      { state: 'FL', units: 780 },
      { state: 'NY', units: 620 },
      { state: 'OH', units: 510 },
    ],
    stateData: { state: 'MD', units: 198, systems: 0, rank: 18, stricterThanFed: false, stateStandard: 'No standard', trend: 'Rising rapidly' },
    ms4Data: { jurisdiction: 'Anne Arundel County', sites: 34, runoffRisk: 'High', bmpsNeeded: 8 },
    waterbodies: [
      { name: 'Great Lakes (all 5)', type: 'Lake System', status: 'Detected', level: 'High' },
      { name: 'Chesapeake Bay, MD/VA', type: 'Estuary', status: 'Detected', level: 'Moderate' },
      { name: 'Los Angeles River, CA', type: 'River', status: 'Detected', level: 'Very High' },
      { name: 'Severn River, MD', type: 'River', status: 'Detected', level: 'Moderate' },
      { name: 'Baltimore Harbor, MD', type: 'Harbor', status: 'Detected', level: 'High' },
    ],
    trend: [
      { yr: '20', v: 120 },
      { yr: '21', v: 310 },
      { yr: '22', v: 580 },
      { yr: '23', v: 890 },
      { yr: '24', v: 1450 },
      { yr: '25', v: 2100 },
    ],
    treatmentAvailable: true,
    treatmentMethod: 'Mechanical filtration (up to 75-stage)',
    treatmentRemoval: 95,
    treatmentStages: 'Stages 1-12 (graduated mesh screens 5mm\u219250\u03BCm)',
    treatmentEvidence: 'Milton FL pilot: 88-95% TSS removal includes microplastic fraction.',
    nationalCount: 4890,
    yoy: 45,
  },
  {
    id: 'cyanotoxins',
    name: 'Cyanotoxins',
    subtitle: 'Harmful Algal Bloom Toxins',
    level: 'ADVISORY',
    icon: '\u25C9',
    mcl: 'Health Advisory',
    deadline: 'N/A',
    monitorBy: 'N/A',
    summary: 'On CCL 5. Five states have guidance. EPA finalized recreational criteria. HABs increasing with warming and nutrient loading.',
    keyFacts: [
      { label: 'CCL', value: 'CCL 5', desc: 'Group listing' },
      { label: 'States', value: '5', desc: 'With rules' },
      { label: 'Advisory', value: 'Active', desc: 'Recreational' },
      { label: 'Toxins', value: '2', desc: 'Microcystin/cylindro' },
    ],
    topStates: [
      { state: 'OH', units: 1890 },
      { state: 'FL', units: 1620 },
      { state: 'CA', units: 1340 },
      { state: 'NY', units: 980 },
      { state: 'WI', units: 870 },
    ],
    stateData: { state: 'MD', units: 412, systems: 8, rank: 9, stricterThanFed: true, stateStandard: 'Advisory + monitoring', trend: 'Seasonal peaks' },
    ms4Data: { jurisdiction: 'Anne Arundel County', sites: 6, runoffRisk: 'Moderate-High', bmpsNeeded: 4 },
    waterbodies: [
      { name: 'Grand Lake St. Marys, OH', type: 'Lake', status: 'Chronic', level: 'Critical' },
      { name: 'Lake Erie Western Basin', type: 'Lake', status: 'Annual HABs', level: 'Critical' },
      { name: 'Lake Okeechobee, FL', type: 'Lake', status: 'Recurring', level: 'High' },
      { name: 'Chesapeake Bay tribs, MD', type: 'Estuary', status: 'Seasonal', level: 'Moderate' },
      { name: 'Lake Champlain, VT/NY', type: 'Lake', status: 'Seasonal', level: 'Moderate' },
    ],
    trend: [
      { yr: '20', v: 1480 },
      { yr: '21', v: 1890 },
      { yr: '22', v: 2150 },
      { yr: '23', v: 2680 },
      { yr: '24', v: 3100 },
      { yr: '25', v: 3540 },
    ],
    treatmentAvailable: true,
    treatmentMethod: 'Activated carbon + oyster biofiltration',
    treatmentRemoval: 88,
    treatmentStages: 'Stages 38-42 (GAC) + Stages 1-6 (biofiltration nutrient uptake)',
    treatmentEvidence: 'Biofiltration reduces nutrient loading that fuels HABs. Indirect prevention + direct toxin removal.',
    nationalCount: 12450,
    yoy: 14,
  },
  {
    id: '6ppd',
    name: '6PPD-Quinone',
    subtitle: 'Tire-Wear Toxicant',
    level: 'EMERGING',
    icon: '\u25C6',
    mcl: 'None',
    deadline: 'TBD',
    monitorBy: 'TBD',
    summary: "Among the most acutely toxic aquatic contaminants known. Coho salmon die-offs. Enters waterways via stormwater \u2014 MS4's problem.",
    keyFacts: [
      { label: 'Toxicity', value: 'Extreme', desc: 'Sub-ppb lethal' },
      { label: 'Source', value: 'Tires', desc: '6PPD + ozone' },
      { label: 'Pathway', value: 'Runoff', desc: 'MS4 stormwater' },
      { label: 'Lead State', value: 'WA', desc: 'Regulatory effort' },
    ],
    topStates: [
      { state: 'WA', units: 340 },
      { state: 'CA', units: 420 },
      { state: 'OR', units: 280 },
      { state: 'AK', units: 190 },
      { state: 'ID', units: 120 },
    ],
    stateData: { state: 'MD', units: 67, systems: 0, rank: 22, stricterThanFed: false, stateStandard: 'No standard', trend: 'Newly monitored' },
    ms4Data: { jurisdiction: 'Anne Arundel County', sites: 48, runoffRisk: 'High', bmpsNeeded: 12 },
    waterbodies: [
      { name: 'Longfellow Creek, WA', type: 'Creek', status: 'Fish kills', level: 'Lethal' },
      { name: 'Puget Sound tribs', type: 'Multiple', status: 'Detected', level: 'High' },
      { name: 'Willamette tribs, OR', type: 'Creek', status: 'Detected', level: 'Moderate' },
      { name: 'Stoney Run, MD', type: 'Creek', status: 'Unknown', level: 'Not tested' },
      { name: 'Ketchikan Creek, AK', type: 'Creek', status: 'Fish kills', level: 'Lethal' },
    ],
    trend: [
      { yr: '20', v: 12 },
      { yr: '21', v: 45 },
      { yr: '22', v: 120 },
      { yr: '23', v: 280 },
      { yr: '24', v: 480 },
      { yr: '25', v: 710 },
    ],
    treatmentAvailable: true,
    treatmentMethod: 'Biochar media + mechanical pre-filtration',
    treatmentRemoval: 78,
    treatmentStages: 'Stages 8-14 (biochar adsorption media)',
    treatmentEvidence: 'Biochar shown effective in UW studies. Treatment adaptation in design phase.',
    nationalCount: 1870,
    yoy: 48,
  },
  {
    id: 'pharma',
    name: 'Pharmaceuticals',
    subtitle: 'PPCPs & Endocrine Disruptors',
    level: 'MONITORING',
    icon: '\u25C7',
    mcl: 'None',
    deadline: 'TBD',
    monitorBy: 'TBD',
    summary: '100+ compounds detected in US waters. ~50% of prescriptions enter waste streams. Antibiotic resistance growing concern.',
    keyFacts: [
      { label: 'Discarded', value: '~50%', desc: 'Enter waste stream' },
      { label: 'Compounds', value: '100+', desc: 'In US waters' },
      { label: 'AMR Risk', value: 'Growing', desc: 'Resistance' },
      { label: 'Federal Reg', value: 'None', desc: 'CCL 5 listed' },
    ],
    topStates: [
      { state: 'CA', units: 380 },
      { state: 'TX', units: 290 },
      { state: 'FL', units: 260 },
      { state: 'PA', units: 210 },
      { state: 'IL', units: 180 },
    ],
    stateData: { state: 'MD', units: 124, systems: 0, rank: 15, stricterThanFed: false, stateStandard: 'No standard', trend: 'Stable' },
    ms4Data: { jurisdiction: 'Anne Arundel County', sites: 4, runoffRisk: 'Low', bmpsNeeded: 1 },
    waterbodies: [
      { name: 'Potomac River, DC/MD/VA', type: 'River', status: 'Detected', level: 'Moderate' },
      { name: 'South Platte River, CO', type: 'River', status: 'Detected', level: 'Moderate' },
      { name: 'Back River, MD', type: 'River', status: 'Detected', level: 'Low' },
      { name: 'Trinity River, TX', type: 'River', status: 'Detected', level: 'High' },
      { name: 'Chicago Sanitary Canal', type: 'Canal', status: 'Detected', level: 'Moderate' },
    ],
    trend: [
      { yr: '20', v: 1020 },
      { yr: '21', v: 1180 },
      { yr: '22', v: 1350 },
      { yr: '23', v: 1540 },
      { yr: '24', v: 1780 },
      { yr: '25', v: 1950 },
    ],
    treatmentAvailable: true,
    treatmentMethod: 'Activated carbon + advanced oxidation',
    treatmentRemoval: 85,
    treatmentStages: 'Stages 38-42 (GAC) + Stage 45 (ozone/AOP)',
    treatmentEvidence: 'GAC + ozone industry standard for PPCPs. Combined treatment approach.',
    nationalCount: 3240,
    yoy: 10,
  },
  {
    id: 'lead',
    name: 'Lead & Copper',
    subtitle: 'LCRR / LCRI Compliance',
    level: 'REVISED RULE',
    icon: '\u25CE',
    mcl: '15 ppb (AL)',
    deadline: '2027',
    monitorBy: 'Oct 2024',
    summary: 'Service line inventories due. Action trigger tightening to 10 ppb. 9.2M lead service lines estimated nationally. EJ impact.',
    keyFacts: [
      { label: 'Action Level', value: '15 ppb', desc: 'Trigger \u2192 10 ppb' },
      { label: 'Inventory', value: 'Due Now', desc: 'Service lines' },
      { label: 'Lead Lines', value: '9.2M', desc: 'Estimated US' },
      { label: 'Replace', value: '10 yr', desc: 'Full timeline' },
    ],
    topStates: [
      { state: 'IL', units: 2100 },
      { state: 'OH', units: 1890 },
      { state: 'MI', units: 1670 },
      { state: 'PA', units: 1450 },
      { state: 'NJ', units: 1280 },
    ],
    stateData: { state: 'MD', units: 890, systems: 210, rank: 8, stricterThanFed: true, stateStandard: 'MDE enhanced monitoring', trend: 'Improving' },
    ms4Data: { jurisdiction: 'Anne Arundel County', sites: 0, runoffRisk: 'N/A (distribution)', bmpsNeeded: 0 },
    waterbodies: [
      { name: 'Chicago water system', type: 'Distribution', status: 'Action Level', level: 'Critical' },
      { name: 'Baltimore water system', type: 'Distribution', status: 'Monitoring', level: 'Moderate' },
      { name: 'Newark water system, NJ', type: 'Distribution', status: 'Replacing', level: 'Improving' },
      { name: 'Flint water system, MI', type: 'Distribution', status: 'Recovering', level: 'Moderate' },
      { name: 'Pittsburgh system, PA', type: 'Distribution', status: 'Action Level', level: 'High' },
    ],
    trend: [
      { yr: '20', v: 4200 },
      { yr: '21', v: 3800 },
      { yr: '22', v: 3400 },
      { yr: '23', v: 3100 },
      { yr: '24', v: 2800 },
      { yr: '25', v: 2500 },
    ],
    treatmentAvailable: false,
    treatmentMethod: 'Infrastructure replacement required',
    treatmentRemoval: 0,
    treatmentStages: 'N/A \u2014 source is pipe material, not water quality',
    treatmentEvidence: 'Not a filtration-addressable contaminant. PIN tracks compliance status.',
    nationalCount: 18900,
    yoy: -11,
  },
];

// ── Regulatory Calendar Data ─────────────────────────────────────────────────

const regEvents: RegEvent[] = [
  { date: '2025-05-14', title: 'EPA retains PFOA/PFOS MCLs', type: 'Final Action', contaminant: 'pfas', status: 'complete', impact: 'MCLs confirmed at 4 ppt. 4 other PFAS MCLs under rescission.' },
  { date: '2025-09-11', title: 'EPA asks D.C. Circuit to vacate 4 PFAS MCLs', type: 'Legal', contaminant: 'pfas', status: 'complete', impact: 'Seeks to drop PFHxS, PFNA, GenX, PFBS standards.' },
  { date: '2025-10-07', title: 'PFHxS-Na added to TRI', type: 'Rule Change', contaminant: 'pfas', status: 'complete', impact: '206 total PFAS now on Toxics Release Inventory.' },
  { date: '2025-11-01', title: 'NPDES PFAS monitoring proposed', type: 'Proposed Rule', contaminant: 'pfas', status: 'complete', impact: 'Permit applications to include PFAS discharge data.' },
  { date: '2025-11-26', title: '7 governors petition EPA on microplastics', type: 'Petition', contaminant: 'microplastics', status: 'complete', impact: 'Urge definition, analytical methods, monitoring data.' },
  { date: '2026-01-12', title: 'D.C. Circuit denies summary vacatur', type: 'Legal', contaminant: 'pfas', status: 'complete', impact: 'Court refuses to immediately drop 4 PFAS MCLs.' },
  { date: '2026-01-26', title: 'PFAS ELG rulemaking proposed', type: 'Proposed Rule', contaminant: 'pfas', status: 'active', impact: 'Effluent limits for plastics/chemical/synthetic fiber sectors.' },
  { date: '2026-02-28', title: 'TRI PFAS additions finalized', type: 'Final Rule', contaminant: 'pfas', status: 'upcoming', impact: 'Criteria for automatic PFAS additions to TRI.' },
  { date: '2026-04-01', title: 'PFAS NPDWR revision finalized', type: 'Final Rule', contaminant: 'pfas', status: 'upcoming', impact: 'Compliance extended to 2031. 4 PFAS MCLs rescinded.' },
  { date: '2026-04-15', title: '9 PFAS designated hazardous (RCRA)', type: 'Final Rule', contaminant: 'pfas', status: 'upcoming', impact: 'Hazardous waste handling requirements triggered.' },
  { date: '2026-06-01', title: 'UCMR 6 development begins', type: 'Rulemaking', contaminant: 'microplastics', status: 'upcoming', impact: 'Microplastics likely included in monitoring rule.' },
  { date: '2027-01-01', title: 'PFAS initial monitoring deadline', type: 'Compliance', contaminant: 'pfas', status: 'upcoming', impact: 'All public water systems must complete PFAS sampling.' },
  { date: '2027-06-01', title: 'LCRR compliance deadline', type: 'Compliance', contaminant: 'lead', status: 'upcoming', impact: 'Service line inventories and enhanced monitoring.' },
  { date: '2028-01-01', title: 'CCL 5 regulatory determinations', type: 'Determination', contaminant: 'cyanotoxins', status: 'upcoming', impact: 'Possible MCL pathway for cyanotoxins.' },
  { date: '2031-01-01', title: 'PFAS MCL full compliance', type: 'Compliance', contaminant: 'pfas', status: 'upcoming', impact: 'Treatment systems operational. No exceedances allowed.' },
];

// ── State Comparison Data ────────────────────────────────────────────────────

const stateComparisons: StateComparison[] = [
  { state: 'NJ', pfas: '13 ppt \u2192 adopted 4 ppt', micro: 'No std', cyano: 'Advisory', sixppd: 'No std', lead: 'Stricter', overall: 'Leader', score: 92 },
  { state: 'MA', pfas: '20 ppt (6 PFAS)', micro: 'No std', cyano: 'Advisory', sixppd: 'No std', lead: 'Federal', overall: 'Leader', score: 85 },
  { state: 'MI', pfas: '8 ppt (7 PFAS)', micro: 'No std', cyano: 'Advisory', sixppd: 'No std', lead: 'Stricter', overall: 'Leader', score: 88 },
  { state: 'NH', pfas: '12 ppt (4 PFAS)', micro: 'No std', cyano: 'No std', sixppd: 'No std', lead: 'Federal', overall: 'Active', score: 78 },
  { state: 'VT', pfas: '20 ppt (5 PFAS)', micro: 'No std', cyano: 'Advisory', sixppd: 'No std', lead: 'Federal', overall: 'Active', score: 72 },
  { state: 'NY', pfas: '10 ppt (2 PFAS)', micro: 'Monitoring', cyano: 'Advisory', sixppd: 'No std', lead: 'Stricter', overall: 'Active', score: 80 },
  { state: 'WA', pfas: '10-15 ppt (5 PFAS)', micro: 'No std', cyano: 'Advisory', sixppd: 'Regulatory', lead: 'Federal', overall: 'Leader', score: 86 },
  { state: 'CA', pfas: 'Notification levels', micro: 'State law', cyano: 'Advisory', sixppd: 'Monitoring', lead: 'Stricter', overall: 'Leader', score: 90 },
  { state: 'MD', pfas: 'Follows EPA', micro: 'No std', cyano: 'Advisory+', sixppd: 'No std', lead: 'Enhanced', overall: 'Moderate', score: 55 },
  { state: 'WI', pfas: '20 ppt (2 PFAS)', micro: 'No std', cyano: 'Advisory', sixppd: 'No std', lead: 'Federal', overall: 'Active', score: 68 },
  { state: 'PA', pfas: 'Follows EPA', micro: 'No std', cyano: 'No std', sixppd: 'No std', lead: 'Federal', overall: 'Lagging', score: 35 },
  { state: 'OH', pfas: 'Follows EPA', micro: 'No std', cyano: 'Advisory', sixppd: 'No std', lead: 'Federal', overall: 'Moderate', score: 45 },
  { state: 'FL', pfas: 'Follows EPA', micro: 'No std', cyano: 'Advisory', sixppd: 'No std', lead: 'Federal', overall: 'Moderate', score: 40 },
  { state: 'TX', pfas: 'Follows EPA', micro: 'No std', cyano: 'No std', sixppd: 'No std', lead: 'Federal', overall: 'Lagging', score: 25 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function scoreColor(s: number): string {
  if (s >= 80) return 'text-green-600';
  if (s >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBarColor(s: number): string {
  if (s >= 80) return 'bg-green-500';
  if (s >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreHex(s: number): string {
  if (s >= 80) return '#22c55e';
  if (s >= 50) return '#f59e0b';
  return '#ef4444';
}

function cellTextColor(v: string): string {
  if (
    v.includes('Stricter') || v.includes('Leader') || v.includes('Regulatory') ||
    v.includes('State law') || v.includes('Enhanced')
  ) return 'text-green-600';
  if (
    v.includes('Advisory') || v.includes('Active') || v.includes('Moderate') ||
    v.includes('Monitoring') || v.includes('Notification')
  ) return 'text-amber-600';
  if (
    v.includes('No std') || v.includes('Follows') || v.includes('Federal') ||
    v.includes('Lagging')
  ) return 'text-slate-400';
  return 'text-slate-700';
}

function waterbodyStatusBadge(status: string): string {
  if (
    status.includes('Impaired') || status.includes('Lethal') ||
    status.includes('Critical') || status.includes('Chronic') || status.includes('Exceeded')
  ) return 'bg-red-100 text-red-700 border-red-200';
  if (
    status.includes('High') || status.includes('Recurring') ||
    status.includes('Action') || status.includes('Annual')
  ) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-green-100 text-green-700 border-green-200';
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ label, value, desc, className }: { label: string; value: string; desc: string; className?: string }) {
  return (
    <div className={`bg-slate-50 rounded-lg p-3 border border-slate-200 flex-1 min-w-0 ${className ?? ''}`}>
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-lg font-extrabold text-slate-800 font-mono">{value}</div>
      {desc && <div className="text-[10px] text-slate-500 mt-0.5">{desc}</div>}
    </div>
  );
}

function MiniBar({ pct, colorClass }: { pct: number; colorClass: string }) {
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ── Tab 1: Threat Dashboard ──────────────────────────────────────────────────

function ThreatDashboard({
  role,
  selected,
  setSelected,
  setExpanded,
}: {
  role: string;
  selected: string | null;
  setSelected: (id: string | null) => void;
  setExpanded: (id: string | null) => void;
}) {
  const active = threats.find(t => t.id === selected) ?? null;
  const levelStyle = active ? LEVEL_STYLES[active.level] : null;
  const levelColor = active ? LEVEL_COLORS[active.level] : '#64748b';
  const gradientId = active ? `trend-grad-${active.id}` : 'trend-grad-default';

  // ── Detail view (threat selected) ──
  if (active && levelStyle) {
    return (
      <div className="space-y-3">
        {/* Back button */}
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5 rotate-90" />
          Back to all contaminants
        </button>

        {/* Header */}
        <div className={`rounded-lg p-4 border ${levelStyle.bg} ${levelStyle.border}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xl ${levelStyle.text}`}>{active.icon}</span>
            <span className="text-base font-extrabold text-slate-800">{active.name}</span>
            <Badge className={`${levelStyle.badge} text-[10px]`}>{active.level}</Badge>
            {role !== 'federal' && (
              <span className="text-xs text-slate-500 ml-auto">
                {role === 'state'
                  ? `${active.stateData.state}: ${active.stateData.units} units (Rank #${active.stateData.rank})`
                  : role === 'ms4'
                    ? `${active.ms4Data.jurisdiction}: ${active.ms4Data.sites} affected sites`
                    : `${active.stateData.state}: ${active.stateData.systems} systems`}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{active.summary}</p>
        </div>

        {/* Key facts */}
        <div className="grid grid-cols-4 gap-2">
          {active.keyFacts.map((f, i) => (
            <div key={i} className="bg-white rounded-lg p-2.5 border border-slate-200">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider">{f.label}</div>
              <div className={`text-sm font-extrabold font-mono ${levelStyle.text}`}>{f.value}</div>
              <div className="text-[9px] text-slate-500">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Detection Trend</div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer>
                <AreaChart data={active.trend} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={levelColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={levelColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="yr" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="v" stroke={levelColor} strokeWidth={2} fill={`url(#${gradientId})`} name="Detections" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Top 5 States</div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={active.topStates} layout="vertical" margin={{ left: 2, right: 8, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="state" width={24} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="units" fill={levelColor} radius={[0, 3, 3, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Waterbodies table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Key Waterbodies</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2 text-left text-[9px] text-slate-400 uppercase tracking-wider font-bold">Waterbody</th>
                <th className="px-3 py-2 text-left text-[9px] text-slate-400 uppercase tracking-wider font-bold">Type</th>
                <th className="px-3 py-2 text-left text-[9px] text-slate-400 uppercase tracking-wider font-bold">Status</th>
                <th className="px-3 py-2 text-left text-[9px] text-slate-400 uppercase tracking-wider font-bold">Level</th>
              </tr>
            </thead>
            <tbody>
              {active.waterbodies.map((w, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 font-semibold text-slate-700">{w.name}</td>
                  <td className="px-3 py-2 text-slate-500">{w.type}</td>
                  <td className="px-3 py-2">
                    <Badge className={`text-[9px] px-1.5 py-0 border ${waterbodyStatusBadge(w.status)}`}>{w.status}</Badge>
                  </td>
                  <td className={`px-3 py-2 font-semibold ${levelStyle.text}`}>{w.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* State-specific data */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">State Data: {active.stateData.state}</div>
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div><span className="text-slate-400 block text-[9px]">Units</span><span className="font-bold text-slate-700">{active.stateData.units}</span></div>
            <div><span className="text-slate-400 block text-[9px]">Systems</span><span className="font-bold text-slate-700">{active.stateData.systems}</span></div>
            <div><span className="text-slate-400 block text-[9px]">Rank</span><span className="font-bold text-slate-700">#{active.stateData.rank}</span></div>
            <div><span className="text-slate-400 block text-[9px]">Standard</span><span className="font-bold text-slate-700">{active.stateData.stateStandard}</span></div>
            <div><span className="text-slate-400 block text-[9px]">Trend</span><span className="font-bold text-slate-700">{active.stateData.trend}</span></div>
          </div>
        </div>

        {/* MS4 context */}
        {(role === 'ms4' || role === 'ms4_admin') && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="text-[10px] text-blue-400 uppercase tracking-wider font-bold mb-2">MS4 Context: {active.ms4Data.jurisdiction}</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-blue-400 block text-[9px]">Sites</span><span className="font-bold text-blue-700">{active.ms4Data.sites}</span></div>
              <div><span className="text-blue-400 block text-[9px]">Runoff Risk</span><span className="font-bold text-blue-700">{active.ms4Data.runoffRisk}</span></div>
              <div><span className="text-blue-400 block text-[9px]">BMPs Needed</span><span className="font-bold text-blue-700">{active.ms4Data.bmpsNeeded}</span></div>
            </div>
          </div>
        )}

        {/* Expand button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => setExpanded(active.id)}
        >
          <Expand className="w-3 h-3 mr-1.5" />
          Expand Full Detail
        </Button>
      </div>
    );
  }

  // ── Card grid (no selection) — matches Treatment Effectiveness layout ──
  return (
    <div className="grid grid-cols-2 gap-3">
      {threats.map(t => {
        const ls = LEVEL_STYLES[t.level];
        const count = role === 'federal' ? t.nationalCount : t.stateData.units;
        return (
          <div
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={`bg-white rounded-lg p-3.5 border cursor-pointer transition-all hover:shadow-md ${ls.border}`}
          >
            <div className="flex justify-between items-start mb-2.5">
              <div className="flex gap-2 items-center">
                <span className={`text-lg ${ls.text}`}>{t.icon}</span>
                <div>
                  <div className="text-sm font-extrabold text-slate-800">{t.name}</div>
                  <Badge className={`text-[9px] px-1.5 py-0 ${ls.badge} border`}>{t.level}</Badge>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-black font-mono ${ls.text}`}>{count.toLocaleString()}</div>
                <div className="text-[9px] text-slate-400">{role === 'federal' ? 'national' : `in ${t.stateData.state}`}</div>
              </div>
            </div>

            <div className="mb-2">
              <MiniBar pct={Math.min((count / 12000) * 100, 100)} colorClass={
                t.level === 'REGULATED' ? 'bg-red-500'
                : t.level === 'PRE-REGULATORY' ? 'bg-amber-500'
                : t.level === 'ADVISORY' ? 'bg-green-500'
                : t.level === 'EMERGING' ? 'bg-purple-500'
                : t.level === 'MONITORING' ? 'bg-cyan-500'
                : 'bg-pink-500'
              } />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-slate-50 rounded p-2 border border-slate-200">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">MCL</div>
                <div className="text-[10px] text-slate-700 mt-0.5 font-semibold">{t.mcl}</div>
              </div>
              <div className="bg-slate-50 rounded p-2 border border-slate-200">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">YoY Change</div>
                <div className={`text-[10px] mt-0.5 font-bold ${t.yoy > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {t.yoy > 0 ? '\u25B2' : '\u25BC'} {Math.abs(t.yoy)}%
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">
              {t.summary}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab 2: Regulatory Calendar ───────────────────────────────────────────────

function RegCalendar({ role }: { role: string }) {
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? regEvents : regEvents.filter(e => e.contaminant === filter);

  const statusDot = (s: string) =>
    s === 'complete' ? 'bg-green-500' : s === 'active' ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <div className="space-y-3">
      {/* Countdown tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <div className="text-[9px] text-red-500 uppercase tracking-wider font-bold">PFAS Monitoring Deadline</div>
          <div className="text-3xl font-black text-red-500 font-mono">{daysUntil('2027-01-01')}</div>
          <div className="text-[10px] text-slate-400">days remaining &middot; Jan 2027</div>
        </div>
        <div className="bg-white rounded-lg border border-amber-200 p-4">
          <div className="text-[9px] text-amber-500 uppercase tracking-wider font-bold">PFAS Compliance Deadline</div>
          <div className="text-3xl font-black text-amber-500 font-mono">{daysUntil('2031-01-01')}</div>
          <div className="text-[10px] text-slate-400">days remaining &middot; Jan 2031</div>
        </div>
        <div className="bg-white rounded-lg border border-pink-200 p-4">
          <div className="text-[9px] text-pink-500 uppercase tracking-wider font-bold">LCRR Compliance</div>
          <div className="text-3xl font-black text-pink-500 font-mono">{daysUntil('2027-06-01')}</div>
          <div className="text-[10px] text-slate-400">days remaining &middot; Jun 2027</div>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { id: 'all', label: 'All' },
          ...threats.map(t => ({ id: t.id, label: t.name })),
        ].map(f => (
          <Button
            key={f.id}
            variant={filter === f.id ? 'default' : 'outline'}
            size="sm"
            className={`text-[10px] h-7 px-2.5 ${
              filter === f.id ? '' : 'text-slate-500'
            }`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {filtered.map((ev, i) => {
          const t = threats.find(x => x.id === ev.contaminant);
          const ls = t ? LEVEL_STYLES[t.level] : null;
          return (
            <div
              key={i}
              className={`grid gap-3 px-4 py-3 border-b border-slate-100 last:border-0 ${
                ev.status === 'complete' ? 'opacity-60' : ''
              } ${ev.status === 'active' ? 'bg-amber-50/50' : ''}`}
              style={{ gridTemplateColumns: '90px 28px 1fr' }}
            >
              {/* Date */}
              <div>
                <div className={`text-xs font-bold font-mono ${
                  ev.status === 'complete' ? 'text-green-600' : ev.status === 'active' ? 'text-amber-600' : 'text-blue-600'
                }`}>
                  {ev.date.slice(0, 7)}
                </div>
                <div className="text-[9px] text-slate-400">{ev.type}</div>
              </div>
              {/* Dot + line */}
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot(ev.status)}`} />
                {i < filtered.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
              </div>
              {/* Content */}
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-bold text-slate-700">{ev.title}</span>
                  {t && ls && <span className={`text-xs ${ls.text}`}>{t.icon}</span>}
                </div>
                <div className="text-[10px] text-slate-500 leading-relaxed">{ev.impact}</div>
                {role !== 'federal' && ev.contaminant === 'pfas' && ev.status === 'upcoming' && (
                  <div className="text-[9px] text-blue-500 mt-1 italic">
                    {'\u2192'} MD impact: {threats.find(x => x.id === 'pfas')!.stateData.systems} systems must prepare
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab 3: State vs Federal ──────────────────────────────────────────────────

function StateVsFederal() {
  const [sortBy, setSortBy] = useState<'score' | 'state'>('score');
  const sorted = useMemo(
    () =>
      [...stateComparisons].sort((a, b) =>
        sortBy === 'score' ? b.score - a.score : a.state.localeCompare(b.state)
      ),
    [sortBy]
  );

  return (
    <div className="space-y-3">
      {/* Score bar chart */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">
          State Regulatory Strictness Score (0-100)
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer>
            <BarChart data={sorted} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <XAxis dataKey="state" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="score" radius={[3, 3, 0, 0]} barSize={20}>
                {sorted.map((s, i) => (
                  <Cell key={i} fill={s.state === 'MD' ? '#3b82f6' : scoreHex(s.score)} opacity={s.state === 'MD' ? 1 : 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              {[
                { key: 'state', label: 'State' },
                { key: 'score', label: 'Score' },
                { key: null, label: 'PFAS' },
                { key: null, label: 'Microplastics' },
                { key: null, label: 'Cyanotoxins' },
                { key: null, label: '6PPD-Q' },
                { key: null, label: 'Lead' },
                { key: null, label: 'Overall' },
              ].map(h => (
                <th
                  key={h.label}
                  className={`px-2.5 py-2 text-left text-[9px] text-slate-400 uppercase tracking-wider font-bold ${
                    h.key ? 'cursor-pointer hover:text-slate-600' : ''
                  }`}
                  onClick={() => {
                    if (h.key === 'score') setSortBy('score');
                    else if (h.key === 'state') setSortBy('state');
                  }}
                >
                  {h.label}
                  {h.key === sortBy && <ChevronDown className="w-2.5 h-2.5 inline ml-0.5" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => (
              <tr key={s.state} className={`border-b border-slate-50 last:border-0 ${s.state === 'MD' ? 'bg-blue-50/50' : ''}`}>
                <td className={`px-2.5 py-2 font-bold ${s.state === 'MD' ? 'text-blue-600' : 'text-slate-700'}`}>{s.state}</td>
                <td className="px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-12">
                      <MiniBar pct={s.score} colorClass={scoreBarColor(s.score)} />
                    </div>
                    <span className={`text-[10px] font-bold font-mono ${scoreColor(s.score)}`}>{s.score}</span>
                  </div>
                </td>
                <td className={`px-2.5 py-2 text-[10px] ${cellTextColor(s.pfas)}`}>{s.pfas}</td>
                <td className={`px-2.5 py-2 text-[10px] ${cellTextColor(s.micro)}`}>{s.micro}</td>
                <td className={`px-2.5 py-2 text-[10px] ${cellTextColor(s.cyano)}`}>{s.cyano}</td>
                <td className={`px-2.5 py-2 text-[10px] ${cellTextColor(s.sixppd)}`}>{s.sixppd}</td>
                <td className={`px-2.5 py-2 text-[10px] ${cellTextColor(s.lead)}`}>{s.lead}</td>
                <td className="px-2.5 py-2">
                  <Badge className={`text-[9px] px-1.5 py-0 border ${
                    s.score >= 80
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : s.score >= 50
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-red-100 text-red-700 border-red-200'
                  }`}>
                    {s.overall}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab 4: Treatment Effectiveness ────────────────────────────────────────────

function TreatmentEffectiveness({ role }: { role: string }) {
  const treatable = threats.filter(t => t.treatmentAvailable);

  const chartData = threats.map(t => ({
    name: t.name,
    removal: t.treatmentRemoval,
    capable: t.treatmentAvailable,
  }));

  return (
    <div className="space-y-3">
      {/* Capability overview */}
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="Treatable Threats" value={`${treatable.length}/${threats.length}`} desc="Contaminant classes" />
        <StatTile label="Max Removal" value="95%" desc="Microplastics (mechanical)" />
        <StatTile label="Filtration Stages" value="Up to 75" desc="Configurable per threat" />
        <StatTile label="Pilot Data" value="Milton, FL" desc="88-95% TSS \u00B7 94% bacteria" />
      </div>

      {/* Removal chart */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">
          Treatment Removal Effectiveness by Contaminant
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="removal" radius={[4, 4, 0, 0]} barSize={36} name="Removal %">
                {threats.map((t, i) => (
                  <Cell key={i} fill={t.treatmentAvailable ? LEVEL_COLORS[t.level] : '#cbd5e1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Threat cards with treatment detail */}
      <div className="grid grid-cols-2 gap-3">
        {threats.map(t => {
          const ls = LEVEL_STYLES[t.level];
          return (
            <div
              key={t.id}
              className={`bg-white rounded-lg p-3.5 border ${
                t.treatmentAvailable ? 'border-blue-200' : 'border-slate-200 opacity-50'
              }`}
            >
              <div className="flex justify-between items-start mb-2.5">
                <div className="flex gap-2 items-center">
                  <span className={`text-lg ${ls.text}`}>{t.icon}</span>
                  <div>
                    <div className="text-sm font-extrabold text-slate-800">{t.name}</div>
                    <Badge className={`text-[9px] px-1.5 py-0 ${
                      t.treatmentAvailable
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    } border`}>
                      {t.treatmentAvailable ? 'Treatment Available' : 'No Treatment Available'}
                    </Badge>
                  </div>
                </div>
                {t.treatmentAvailable && (
                  <div className="text-right">
                    <div className="text-2xl font-black text-blue-600 font-mono">{t.treatmentRemoval}%</div>
                    <div className="text-[9px] text-slate-400">removal rate</div>
                  </div>
                )}
              </div>

              {t.treatmentAvailable ? (
                <>
                  <div className="mb-2">
                    <MiniBar pct={t.treatmentRemoval} colorClass="bg-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-slate-50 rounded p-2 border border-slate-200">
                      <div className="text-[9px] text-slate-400 uppercase tracking-wider">Method</div>
                      <div className="text-[10px] text-slate-700 mt-0.5">{t.treatmentMethod}</div>
                    </div>
                    <div className="bg-slate-50 rounded p-2 border border-slate-200">
                      <div className="text-[9px] text-slate-400 uppercase tracking-wider">Stages</div>
                      <div className="text-[10px] text-slate-700 mt-0.5">{t.treatmentStages}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 p-2 bg-slate-50 rounded border-l-2 border-blue-400">
                    {t.treatmentEvidence}
                  </div>
                  {role !== 'federal' && (
                    <div className="text-[9px] text-blue-500 mt-2 italic">
                      {role === 'ms4'
                        ? `${t.ms4Data.sites} sites in Anne Arundel could benefit from treatment deployment`
                        : `${t.stateData.units} MD assessment units with ${t.name} detections`}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[10px] text-slate-500 mt-1">{t.treatmentEvidence}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Closed-loop diagram */}
      <div className="bg-white rounded-lg border border-blue-100 p-4">
        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-4">
          PIN Closed-Loop: Detect {'\u2192'} Treat {'\u2192'} Verify
        </div>
        <div className="grid grid-cols-4 gap-0 items-center">
          {([
            { step: '1', label: 'PIN Detects', desc: 'ATTAINS data identifies contaminant in waterbody', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', iconEl: <Activity className="w-5 h-5 text-blue-600" /> },
            { step: '2', label: 'Treatment Applied', desc: 'Configurable filtration targets specific contaminant', color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200', iconEl: <FlaskConical className="w-5 h-5 text-cyan-600" /> },
            { step: '3', label: 'Lab Validates', desc: 'Lab results confirm removal effectiveness', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', iconEl: <Beaker className="w-5 h-5 text-green-600" /> },
            { step: '4', label: 'PIN Documents', desc: 'Compliance record updated, resolution tracked', color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', iconEl: <FileText className="w-5 h-5 text-purple-600" /> },
          ] as const).map((s, i) => (
            <div key={i} className="text-center relative">
              <div className={`w-10 h-10 rounded-full mx-auto mb-2 ${s.bgColor} border-2 ${s.borderColor} flex items-center justify-center`}>
                {s.iconEl}
              </div>
              <div className={`text-xs font-bold ${s.color}`}>{s.label}</div>
              <div className="text-[9px] text-slate-400 mt-0.5 leading-snug px-2">{s.desc}</div>
              {i < 3 && (
                <div className="absolute right-0 top-4 w-4 flex items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Expanded Overlay ─────────────────────────────────────────────────────────

function ExpandedOverlay({
  threat,
  role,
  onClose,
}: {
  threat: ThreatData;
  role: string;
  onClose: () => void;
}) {
  const [view, setView] = useState<'states' | 'waterbodies'>('states');
  const ls = LEVEL_STYLES[threat.level];
  const levelColor = LEVEL_COLORS[threat.level];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-[880px] max-h-[88vh] overflow-auto border shadow-2xl"
        style={{ borderColor: `${levelColor}40` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b border-slate-200 flex justify-between items-start ${ls.bg}`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xl ${ls.text}`}>{threat.icon}</span>
              <span className="text-lg font-black text-slate-800">{threat.name}</span>
              <Badge className={`${ls.badge} text-[10px]`}>{threat.level}</Badge>
            </div>
            <div className="text-xs text-slate-500 max-w-[560px]">{threat.summary}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Key facts */}
        <div className="px-5 py-3 flex gap-2">
          {threat.keyFacts.map((f, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 flex-1 min-w-0">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider">{f.label}</div>
              <div className={`text-sm font-extrabold font-mono ${ls.text}`}>{f.value}</div>
              <div className="text-[9px] text-slate-500">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="px-5 pb-3 grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Detection Trend</div>
            <div style={{ height: 150 }}>
              <ResponsiveContainer>
                <AreaChart data={threat.trend} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="exp-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={levelColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={levelColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="yr" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="v" stroke={levelColor} strokeWidth={2} fill="url(#exp-grad)" name="Detections" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Top 5 States</div>
            <div style={{ height: 150 }}>
              <ResponsiveContainer>
                <BarChart data={threat.topStates} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="state" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="units" fill={levelColor} radius={[3, 3, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Toggle table */}
        <div className="px-5 pb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex gap-0.5 bg-slate-100 rounded-md p-0.5">
              {(['states', 'waterbodies'] as const).map(v => (
                <Button
                  key={v}
                  variant={view === v ? 'default' : 'ghost'}
                  size="sm"
                  className={`text-[10px] h-6 px-3 ${view !== v ? 'text-slate-400' : ''}`}
                  onClick={() => setView(v)}
                >
                  {v === 'states' ? 'States' : 'Waterbodies'}
                </Button>
              ))}
            </div>
            {threat.treatmentAvailable && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] border">
                Treatment: {threat.treatmentRemoval}% removal
              </Badge>
            )}
          </div>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {(view === 'states'
                    ? ['#', 'State', 'Units', 'MCL']
                    : ['Waterbody', 'Type', 'Status', 'Level']
                  ).map(h => (
                    <th key={h} className="px-2.5 py-2 text-left text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view === 'states'
                  ? threat.topStates.map((s, i) => (
                      <tr key={s.state} className="border-b border-slate-50 last:border-0">
                        <td className="px-2.5 py-2 text-slate-400 font-mono">#{i + 1}</td>
                        <td className="px-2.5 py-2 font-bold text-slate-700">{s.state}</td>
                        <td className={`px-2.5 py-2 font-bold font-mono ${ls.text}`}>{s.units.toLocaleString()}</td>
                        <td className="px-2.5 py-2 text-slate-500">{threat.mcl}</td>
                      </tr>
                    ))
                  : threat.waterbodies.map((w, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-2.5 py-2 font-semibold text-slate-700">{w.name}</td>
                        <td className="px-2.5 py-2 text-slate-500">{w.type}</td>
                        <td className="px-2.5 py-2">
                          <Badge className={`text-[9px] px-1.5 py-0 border ${waterbodyStatusBadge(w.status)}`}>
                            {w.status}
                          </Badge>
                        </td>
                        <td className={`px-2.5 py-2 font-semibold ${ls.text}`}>{w.level}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function EmergingContaminantsTracker({
  role = 'federal',
  selectedState,
}: {
  role?: string;
  selectedState?: string;
}) {
  const [tab, setTab] = useState<TabId>('threats');
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'threats', label: 'Threat Dashboard', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { id: 'calendar', label: 'Regulatory Calendar', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'states', label: 'State vs Federal', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'treatment', label: 'Treatment Effectiveness', icon: <FlaskConical className="w-3.5 h-3.5" /> },
  ];

  return (
    <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white">
      <CardHeader id="section-emerging-contaminants" className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <CardTitle className="text-base font-extrabold text-slate-800">
              Emerging Contaminants Intelligence
            </CardTitle>
            <Waves className="w-4 h-4 text-violet-400" />
          </div>
          <BrandedPrintBtn
            sectionId="emerging-contaminants"
            title="Emerging Contaminants Intelligence"
            subtitle="Threat tracking, regulatory calendar, and treatment matching"
          />
        </div>
        <CardDescription className="text-xs text-slate-500">
          Real-time tracking of 6 contaminant classes across federal, state, and local dimensions.
          {selectedState && <span className="ml-1 font-semibold text-violet-600">Viewing: {selectedState}</span>}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">PFAS Detections</div>
            <div className="text-lg font-extrabold text-red-600 font-mono">2,847</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">States Affected</div>
            <div className="text-lg font-extrabold text-amber-600 font-mono">49</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Systems At Risk</div>
            <div className="text-lg font-extrabold text-purple-600 font-mono">1,203</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">New This Quarter</div>
            <div className="text-lg font-extrabold text-cyan-600 font-mono">+156</div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b border-slate-200">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all border-b-2 ${
                tab === t.id
                  ? 'border-violet-500 text-violet-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="pt-1">
          {tab === 'threats' && (
            <ThreatDashboard
              role={role}
              selected={selected}
              setSelected={setSelected}
              setExpanded={setExpanded}
            />
          )}
          {tab === 'calendar' && <RegCalendar role={role} />}
          {tab === 'states' && <StateVsFederal />}
          {tab === 'treatment' && <TreatmentEffectiveness role={role} />}
        </div>
      </CardContent>

      {/* Expanded overlay */}
      {expanded && (
        <ExpandedOverlay
          threat={threats.find(t => t.id === expanded)!}
          role={role}
          onClose={() => setExpanded(null)}
        />
      )}
    </Card>
  );
}
