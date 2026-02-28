'use client';

import React from 'react';
import { useLensParam } from '@/lib/useLensParam';
import HeroBanner from './HeroBanner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Activity, AlertCircle, AlertTriangle, Banknote, BarChart3, CheckCircle,
  ClipboardList, Clock, Droplets, FileCheck, FileText, FlaskConical,
  Gauge, HardHat, Heart, Landmark, Leaf, Microscope, Scale, Shield,
  ShieldCheck, Sparkles, TrendingUp, Trophy, Waves, Wrench, Zap,
  ThermometerSun, Beaker, Factory, Settings, Users,
} from 'lucide-react';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';
import LocationReportCard from '@/components/LocationReportCard';
import ResolutionPlanner from '@/components/ResolutionPlanner';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';
import { WARRZones } from './WARRZones';
import type { WARRMetric } from './WARRZones';

// ─── View Lens ──────────────────────────────────────────────────────────────

type ViewLens = 'overview' | 'briefing' | 'trends' | 'policy'
  | 'compliance' | 'water-quality' | 'public-health' | 'source-receiving'
  | 'treatment-process' | 'infrastructure' | 'laboratory' | 'disaster'
  | 'permit-limits' | 'scorecard' | 'reports' | 'asset-management' | 'funding' | 'warr';

const LENS_CONFIG: Record<ViewLens, {
  label: string;
  description: string;
  sections: Set<string>;
}> = {
  overview: {
    label: 'Overview',
    description: 'Utility control room dashboard — real-time plant status, compliance, and alerts',
    sections: new Set(['system-status', 'warr-metrics', 'warr-analyze', 'warr-respond', 'warr-resolve', 'operational-stats', 'compliance-calendar', 'weather-source', 'alerts-notifications', 'quick-access', 'disclaimer']),
  },
  briefing: {
    label: 'AI Briefing',
    description: 'Operator shift report and compliance officer morning update',
    sections: new Set(['briefing-plant', 'briefing-compliance', 'briefing-system', 'briefing-business', 'disclaimer']),
  },
  trends: {
    label: 'Trends & Projections',
    description: 'Treatment performance, capacity, water loss, collection system, and financial trends',
    sections: new Set(['trends-treatment', 'trends-flow', 'trends-water-loss', 'trends-collection', 'trends-financial', 'disclaimer']),
  },
  policy: {
    label: 'Policy Tracker',
    description: 'Regulations affecting utility operations, permits, and funding rules',
    sections: new Set(['policy-operations', 'policy-permits', 'policy-funding-rules', 'disclaimer']),
  },
  compliance: {
    label: 'Compliance',
    description: 'Permit-driven continuous compliance — DMR submissions, daily monitoring, process adjustment',
    sections: new Set(['comp-dashboard', 'comp-effluent', 'comp-drinking-water', 'comp-dmr', 'comp-violations', 'comp-pretreatment', 'disclaimer']),
  },
  'water-quality': {
    label: 'Water Quality',
    description: 'Source water, treatment process, finished water, and special monitoring data',
    sections: new Set(['wq-source', 'wq-process', 'wq-finished', 'wq-special', 'wq-aqualo', 'disclaimer']),
  },
  'public-health': {
    label: 'Public Health & Contaminants',
    description: 'MCL compliance, lead & copper, PFAS, pathogen control, and effluent health impact',
    sections: new Set(['ph-dw-health', 'ph-lead-copper', 'ph-pfas', 'ph-pathogen', 'ph-effluent-impact', 'disclaimer']),
  },
  'source-receiving': {
    label: 'Source & Receiving Waters',
    description: 'Source water protection and receiving water discharge impact analysis',
    sections: new Set(['sr-source-status', 'sr-protection', 'sr-threats', 'sr-monitoring', 'sr-receiving-status', 'sr-discharge-impact', 'sr-regulatory-nexus', 'disclaimer']),
  },
  'treatment-process': {
    label: 'Treatment & Process',
    description: 'Plant operations center — process monitoring, chemical management, energy optimization',
    sections: new Set(['tp-dw-process-flow', 'tp-dw-performance', 'tp-dw-chemical', 'tp-dw-filter', 'tp-ww-process-flow', 'tp-ww-performance', 'tp-ww-solids', 'tp-ww-chemical', 'tp-energy', 'tp-optimization', 'disclaimer']),
  },
  infrastructure: {
    label: 'Infrastructure',
    description: 'Treatment plants, distribution/collection systems, pump stations, and storage',
    sections: new Set(['infra-system-map', 'infra-plant', 'infra-distribution', 'infra-pump-stations', 'infra-storage', 'disclaimer']),
  },
  laboratory: {
    label: 'Laboratory & Sampling',
    description: 'Aqua-Lo LIMS integration, sample tracking, QA/QC, and lab management',
    sections: new Set(['lab-tracking', 'lab-results', 'lab-qaqc', 'lab-regulatory', 'lab-management', 'lab-aqualo', 'disclaimer']),
  },
  disaster: {
    label: 'Disaster & Emergency',
    description: 'Infrastructure failures, contamination events, vulnerability, and climate resilience',
    sections: new Set(['disaster-active', 'disaster-response', 'disaster-vulnerability', 'disaster-recovery', 'disaster-resilience', 'resolution-planner', 'disclaimer']),
  },
  'permit-limits': {
    label: 'Permit Limits & Compliance',
    description: 'Effluent limits, MCLs, special conditions, and permit renewal preparation',
    sections: new Set(['pl-effluent-limits', 'pl-dw-standards', 'pl-special-conditions', 'pl-renewal', 'pl-derivation', 'disclaimer']),
  },
  scorecard: {
    label: 'Scorecard',
    description: 'Regulatory, operational, infrastructure, financial, and customer service scores',
    sections: new Set(['sc-regulatory', 'sc-operational', 'sc-infrastructure', 'sc-financial', 'sc-customer', 'sc-benchmarking', 'disclaimer']),
  },
  reports: {
    label: 'Reports',
    description: 'DMR generation, CCR, operational reports, regulatory filings, and financial reports',
    sections: new Set(['rpt-dmr', 'rpt-ccr', 'rpt-operational', 'rpt-regulatory', 'rpt-financial', 'disclaimer']),
  },
  'asset-management': {
    label: 'Asset Management',
    description: 'Enterprise asset management — inventory, condition, maintenance, risk, and capital planning',
    sections: new Set(['am-inventory', 'am-condition', 'am-maintenance', 'am-risk', 'am-capital', 'am-lifecycle', 'disclaimer']),
  },
  funding: {
    label: 'Funding & Grants',
    description: 'SRF loans, federal funding, revenue planning, debt management, and capital strategy',
    sections: new Set(['fund-srf', 'fund-federal', 'fund-revenue', 'fund-debt', 'fund-capital-strategy', 'disclaimer']),
  },
  warr: {
    label: 'WARR Room',
    description: 'Water Alert & Response Readiness — real-time situation awareness',
    sections: new Set(['warr-metrics', 'warr-analyze', 'warr-respond', 'warr-resolve', 'disclaimer']),
  },
};

// ─── Placeholder section helper ─────────────────────────────────────────────

type KPI = { label: string; value: string; bg: string };

function PlaceholderSection({ icon: Icon, iconColor, title, description, kpis, source }: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  description: string;
  kpis: KPI[];
  source: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map(k => (
            <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
              <div className="text-lg font-bold text-slate-800 mt-1">{k.value}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4 italic">Data source: {source}</p>
      </CardContent>
    </Card>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

type Props = { systemId: string };

export default function UtilityManagementCenter({ systemId }: Props) {
  const [activeLens, setActiveLens] = useLensParam<ViewLens>('overview');
  const lens = LENS_CONFIG[activeLens] ?? LENS_CONFIG['overview'];

  return (
    <div className="min-h-full">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <HeroBanner role="utility" />
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto">

        <LayoutEditor ccKey="Utility">
        {({ sections, isEditMode, onToggleVisibility }) => (
          <div className={`space-y-6 ${isEditMode ? 'pl-12' : ''}`}>

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

            // ══════════════════════════════════════════════════════════════
            // VIEW 1: OVERVIEW
            // ══════════════════════════════════════════════════════════════

            case 'system-status': return DS(
              <PlaceholderSection icon={Activity} iconColor="text-green-600" title="System Status"
                description="Plant status, flow utilization, compliance status, and last quality check"
                kpis={[
                  { label: 'Plant Status', value: 'NORMAL', bg: 'bg-green-50 border-green-200' },
                  { label: 'Flow Utilization', value: '72%', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Compliance', value: 'IN COMPLIANCE', bg: 'bg-green-50 border-green-200' },
                  { label: 'Days Since Violation', value: '187', bg: 'bg-green-50 border-green-200' },
                ]}
                source="SCADA (Phase 2), EPA ECHO, SDWIS, utility operational data"
              />
            );

            case 'operational-stats': return DS(
              <PlaceholderSection icon={Gauge} iconColor="text-sky-600" title="Operational Quick Stats"
                description="Real-time operational metrics for drinking water and wastewater systems"
                kpis={[
                  { label: 'Current Production', value: '32.1 MGD', bg: 'bg-sky-50 border-sky-200' },
                  { label: 'System Pressure', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                  { label: 'Tank Levels', value: '78%', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Cl₂ Residual', value: '1.8 mg/L', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility operational data, SCADA integration (Phase 2+)"
              />
            );

            case 'compliance-calendar': return DS(
              <PlaceholderSection icon={Clock} iconColor="text-amber-600" title="Compliance Calendar"
                description="Upcoming DMR due dates, sampling events, and report deadlines"
                kpis={[
                  { label: 'DMR Due', value: 'Mar 15', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Sampling Events', value: '4 this week', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Reports Due', value: '2 pending', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Overdue Items', value: '0', bg: 'bg-green-50 border-green-200' },
                ]}
                source="NPDES permit schedule, SDWA monitoring requirements"
              />
            );

            case 'weather-source': return DS(
              <PlaceholderSection icon={ThermometerSun} iconColor="text-orange-600" title="Weather & Source Conditions"
                description="Current weather, source water conditions, and rain/drought risk"
                kpis={[
                  { label: 'Temperature', value: '52°F', bg: 'bg-orange-50 border-orange-200' },
                  { label: 'Rain Forecast', value: '0.3 in', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Source Flow', value: '1,240 cfs', bg: 'bg-cyan-50 border-cyan-200' },
                  { label: 'Drought Index', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                ]}
                source="NOAA weather, USGS WDFN flow data"
              />
            );

            case 'alerts-notifications': return DS(
              <PlaceholderSection icon={AlertTriangle} iconColor="text-red-600" title="Alerts & Notifications"
                description="Active alarms, regulatory notifications, and customer complaints"
                kpis={[
                  { label: 'Active Alarms', value: '1', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Regulatory Notices', value: '0', bg: 'bg-green-50 border-green-200' },
                  { label: 'Complaints Today', value: '3', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'Maint. Scheduled', value: '2 items', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility alarm system, state regulatory portal, CRM"
              />
            );

            case 'quick-access': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-600" />
                    Quick Access Grid
                  </CardTitle>
                  <CardDescription>Jump to frequently used tools and reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Log a Reading', icon: ClipboardList },
                      { label: 'DMR Workspace', icon: FileText },
                      { label: 'Sample Schedule', icon: Beaker },
                      { label: 'Work Order', icon: Wrench },
                      { label: 'Alarm History', icon: AlertTriangle },
                      { label: 'Compliance Check', icon: ShieldCheck },
                      { label: 'Chemical Order', icon: FlaskConical },
                      { label: 'Shift Report', icon: FileCheck },
                    ].map(item => {
                      const Icon = item.icon;
                      return (
                        <button key={item.label} className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 p-3 text-left transition-colors flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-400" />
                          <span className="text-xs font-medium text-slate-700">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 2: AI BRIEFING
            // ══════════════════════════════════════════════════════════════

            case 'briefing-plant': return DS(
              <PlaceholderSection icon={Activity} iconColor="text-green-600" title="Plant Status"
                description="Overnight events, current conditions, sampling required today, and weather impacts"
                kpis={[
                  { label: 'Overnight Events', value: '0', bg: 'bg-green-50 border-green-200' },
                  { label: 'Out of Range', value: '0 params', bg: 'bg-green-50 border-green-200' },
                  { label: 'Samples Today', value: '6', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Maint. Today', value: '2 tasks', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="SCADA historian, Aqua-Lo sampling schedule, maintenance system"
              />
            );

            case 'briefing-compliance': return DS(
              <PlaceholderSection icon={ShieldCheck} iconColor="text-blue-600" title="Compliance Status"
                description="DMR deadlines, parameters trending toward limits, and regulatory submissions"
                kpis={[
                  { label: 'DMR Due In', value: '18 days', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Trending to Limit', value: '1 param', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Violation Risk', value: 'Low', bg: 'bg-green-50 border-green-200' },
                  { label: 'Submissions Due', value: '0', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility compliance data, EPA ECHO, SDWIS"
              />
            );

            case 'briefing-system': return DS(
              <PlaceholderSection icon={Waves} iconColor="text-cyan-600" title="System Watch"
                description="Distribution/collection issues, customer complaints, and source water conditions"
                kpis={[
                  { label: 'Main Breaks', value: '0', bg: 'bg-green-50 border-green-200' },
                  { label: 'Complaints O/N', value: '1', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'Construction', value: '1 active', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Source WQ', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility CRM, GIS/work order system, USGS"
              />
            );

            case 'briefing-business': return DS(
              <PlaceholderSection icon={Banknote} iconColor="text-emerald-600" title="Business & Planning"
                description="Revenue vs. budget, capital project status, staffing, and regulatory pipeline"
                kpis={[
                  { label: 'Revenue MTD', value: '94% of budget', bg: 'bg-green-50 border-green-200' },
                  { label: 'CIP Active', value: '4 projects', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Vacancies', value: '2 open', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Cert. Expiring', value: '1 in 60d', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="Utility financial system, HR records, state certification database"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 3: RESOLUTION PLANNER
            // ══════════════════════════════════════════════════════════════

            case 'resolution-planner': return DS(<ResolutionPlanner userRole="ms4_utility" scopeContext={{ scope: 'national', data: { totalStates: 50, totalWaterbodies: 0, totalImpaired: 0, averageScore: 0, highAlertStates: 0, topCauses: [], worstStates: [] } }} />);

            // ══════════════════════════════════════════════════════════════
            // VIEW 4: TRENDS & PROJECTIONS
            // ══════════════════════════════════════════════════════════════

            case 'trends-treatment': return DS(
              <PlaceholderSection icon={TrendingUp} iconColor="text-blue-600" title="Treatment Performance Trends"
                description="Effluent quality trends vs. permit limits, removal efficiency, chemical and energy usage"
                kpis={[
                  { label: 'BOD Removal', value: '97.2%', bg: 'bg-green-50 border-green-200' },
                  { label: 'TSS Removal', value: '98.1%', bg: 'bg-green-50 border-green-200' },
                  { label: 'NH₃-N Trend', value: '↓ Improving', bg: 'bg-green-50 border-green-200' },
                  { label: 'Energy/MG', value: '1,820 kWh', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility process data, Aqua-Lo lab results"
              />
            );

            case 'trends-flow': return DS(
              <PlaceholderSection icon={Gauge} iconColor="text-sky-600" title="Flow & Capacity Trends"
                description="Average daily flow, peak flow, seasonal patterns, and capacity projection"
                kpis={[
                  { label: 'Avg Daily Flow', value: '32.1 MGD', bg: 'bg-sky-50 border-sky-200' },
                  { label: 'Design Capacity', value: '45.0 MGD', bg: 'bg-slate-50 border-slate-200' },
                  { label: '% Utilization', value: '71%', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Expansion Need', value: '~2038', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility flow data, capacity planning model"
              />
            );

            case 'trends-water-loss': return DS(
              <PlaceholderSection icon={Droplets} iconColor="text-cyan-600" title="Water Loss & System Efficiency"
                description="Non-revenue water, real vs. apparent losses, ILI tracking, main break rate"
                kpis={[
                  { label: 'Non-Revenue Water', value: '14.2%', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Real Losses', value: '8.7 gal/conn/day', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Main Break Rate', value: '12/100mi/yr', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'ILI', value: '2.4', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="AWWA water audit, utility distribution system data"
              />
            );

            case 'trends-collection': return DS(
              <PlaceholderSection icon={Waves} iconColor="text-indigo-600" title="Collection System Trends"
                description="SSO frequency, I&I trend, pump station performance, pipe failure rates"
                kpis={[
                  { label: 'SSOs YTD', value: '2', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Wet/Dry Ratio', value: '2.8:1', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Pump Station Uptime', value: '99.4%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Blockages/mo', value: '4.2 avg', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="Utility collection system data, SCADA"
              />
            );

            case 'trends-financial': return DS(
              <PlaceholderSection icon={Banknote} iconColor="text-emerald-600" title="Financial Trends"
                description="Revenue/expense trends, rate adequacy, O&M cost per MG, debt service coverage"
                kpis={[
                  { label: 'O&M Cost/MG', value: '$2,840', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'Rate Adequacy', value: '102%', bg: 'bg-green-50 border-green-200' },
                  { label: 'DSCR', value: '1.42x', bg: 'bg-green-50 border-green-200' },
                  { label: 'Reserve Fund', value: '87% target', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility financial system, annual budget"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 5: POLICY TRACKER
            // ══════════════════════════════════════════════════════════════

            case 'policy-operations': return DS(
              <PlaceholderSection icon={Scale} iconColor="text-purple-600" title="Regulations Affecting Operations"
                description="Rules in pipeline that would change utility requirements, with cost and timeline impact"
                kpis={[
                  { label: 'Active Rules', value: '3 tracked', bg: 'bg-purple-50 border-purple-200' },
                  { label: 'Highest Impact', value: 'PFAS MCL', bg: 'bg-red-50 border-red-200' },
                  { label: 'Est. Compliance Cost', value: '$12.4M', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Next Deadline', value: '2027-Q2', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Federal Register, state regulatory portal, EPA rulemaking tracker"
              />
            );

            case 'policy-permits': return DS(
              <PlaceholderSection icon={FileCheck} iconColor="text-blue-600" title="Permit & Standard Changes"
                description="Upcoming permit renewal changes, WQS updates, new MCLs, and nutrient limits"
                kpis={[
                  { label: 'Permit Renewal', value: 'Jan 2028', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Expected Changes', value: '3 limits', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'New MCLs', value: '6 PFAS', bg: 'bg-red-50 border-red-200' },
                  { label: 'Nutrient Limits', value: 'Under review', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="State permitting authority, EPA standards development"
              />
            );

            case 'policy-funding-rules': return DS(
              <PlaceholderSection icon={Landmark} iconColor="text-slate-600" title="Funding & Program Rule Changes"
                description="SRF modifications, WIFIA updates, BIL guidance, and state-specific changes"
                kpis={[
                  { label: 'SRF Updates', value: '1 new', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'WIFIA Status', value: 'Eligible', bg: 'bg-green-50 border-green-200' },
                  { label: 'BIL Allocation', value: '$4.2M avail.', bg: 'bg-green-50 border-green-200' },
                  { label: 'BABA Compliance', value: 'Required', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="EPA funding program guidance, state SRF program"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 6: COMPLIANCE
            // ══════════════════════════════════════════════════════════════

            case 'comp-dashboard': return DS(
              <PlaceholderSection icon={ShieldCheck} iconColor="text-green-600" title="Compliance Dashboard"
                description="SDWA and NPDES compliance status, active violations, and consent decree milestones"
                kpis={[
                  { label: 'SDWA Status', value: 'Compliant', bg: 'bg-green-50 border-green-200' },
                  { label: 'NPDES Rate', value: '98.4%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Active Violations', value: '1', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Days Since Violation', value: '12', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="EPA ECHO, SDWIS, utility compliance records"
              />
            );

            case 'comp-effluent': return DS(
              <PlaceholderSection icon={Waves} iconColor="text-blue-600" title="Effluent Compliance (WW)"
                description="Every permit parameter: current value vs. limit, exceedance frequency, and early warnings"
                kpis={[
                  { label: 'BOD Monthly Avg', value: '8.2/30 mg/L', bg: 'bg-green-50 border-green-200' },
                  { label: 'TSS Monthly Avg', value: '6.1/30 mg/L', bg: 'bg-green-50 border-green-200' },
                  { label: 'NH₃-N', value: '1.8/4.0 mg/L', bg: 'bg-green-50 border-green-200' },
                  { label: 'TP', value: '0.8/1.0 mg/L', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="Utility lab data (Aqua-Lo), NPDES permit limits"
              />
            );

            case 'comp-drinking-water': return DS(
              <PlaceholderSection icon={Droplets} iconColor="text-sky-600" title="Drinking Water Compliance"
                description="MCL compliance by contaminant group, treatment techniques, and monitoring compliance"
                kpis={[
                  { label: 'Microbiological', value: 'Pass', bg: 'bg-green-50 border-green-200' },
                  { label: 'DBPs', value: 'Pass', bg: 'bg-green-50 border-green-200' },
                  { label: 'Lead 90th %ile', value: '3.2 ppb', bg: 'bg-green-50 border-green-200' },
                  { label: 'PFAS Total', value: '5.9 ppt', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="EPA SDWIS, utility monitoring data"
              />
            );

            case 'comp-dmr': return DS(
              <PlaceholderSection icon={FileText} iconColor="text-indigo-600" title="DMR & Reporting"
                description="DMR preparation workspace with QA/QC review, submission deadline, and history"
                kpis={[
                  { label: 'Current Month', value: 'Feb 2026', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'QA/QC Status', value: 'In Review', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Submission Due', value: '18 days', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Last Submitted', value: 'Jan 2026', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility DMR records, Aqua-Lo lab data, NetDMR"
              />
            );

            case 'comp-violations': return DS(
              <PlaceholderSection icon={AlertCircle} iconColor="text-red-600" title="Violation Management"
                description="Active violations, return-to-compliance tracking, corrective actions, and penalty tracking"
                kpis={[
                  { label: 'Active', value: '1 monitoring', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Corrective Action', value: 'In Progress', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Resolved YTD', value: '2', bg: 'bg-green-50 border-green-200' },
                  { label: 'Penalties', value: '$0', bg: 'bg-green-50 border-green-200' },
                ]}
                source="EPA ECHO, state enforcement records"
              />
            );

            case 'comp-pretreatment': return DS(
              <PlaceholderSection icon={Factory} iconColor="text-slate-600" title="Pretreatment Program"
                description="SIU inventory, permit compliance, local limits, and enforcement actions"
                kpis={[
                  { label: 'SIU Count', value: '12', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'SIU Compliance', value: '92%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Local Limits', value: 'Current', bg: 'bg-green-50 border-green-200' },
                  { label: 'Enforcement', value: '1 NOV issued', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="Utility pretreatment program records"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 7: WATER QUALITY
            // ══════════════════════════════════════════════════════════════

            case 'wq-source': return DS(
              <PlaceholderSection icon={Droplets} iconColor="text-cyan-600" title="Source Water Quality"
                description="Raw water quality at intakes/wellheads, parameter trends, and algal bloom tracking"
                kpis={[
                  { label: 'Raw Turbidity', value: '4.2 NTU', bg: 'bg-cyan-50 border-cyan-200' },
                  { label: 'TOC', value: '3.8 mg/L', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Algae Risk', value: 'Low', bg: 'bg-green-50 border-green-200' },
                  { label: 'Reservoir Level', value: '89%', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility source water monitoring, USGS, NOAA HAB forecast"
              />
            );

            case 'wq-process': return DS(
              <PlaceholderSection icon={FlaskConical} iconColor="text-purple-600" title="Treatment Process Water Quality"
                description="Parameter values at each process stage, removal efficiency, and process control"
                kpis={[
                  { label: 'Settled Turbidity', value: '1.1 NTU', bg: 'bg-green-50 border-green-200' },
                  { label: 'Filtered', value: '0.04 NTU', bg: 'bg-green-50 border-green-200' },
                  { label: 'CT Ratio', value: '1.8x req.', bg: 'bg-green-50 border-green-200' },
                  { label: 'pH', value: '7.4', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility process monitoring, Aqua-Lo LIMS"
              />
            );

            case 'wq-finished': return DS(
              <PlaceholderSection icon={CheckCircle} iconColor="text-green-600" title="Finished Water / Effluent Quality"
                description="Finished water vs. MCLs, effluent vs. permit limits, and distribution system WQ"
                kpis={[
                  { label: 'Cl₂ Residual', value: '1.8 mg/L', bg: 'bg-green-50 border-green-200' },
                  { label: 'THMs', value: '62 ppb / 80', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'HAA5', value: '41 ppb / 60', bg: 'bg-green-50 border-green-200' },
                  { label: 'Lead (90th)', value: '3.2 ppb', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility distribution system monitoring, compliance data"
              />
            );

            case 'wq-special': return DS(
              <PlaceholderSection icon={Microscope} iconColor="text-purple-600" title="Special Monitoring"
                description="UCMR data, PFAS sampling, microplastics, cyanotoxins, and pilot study results"
                kpis={[
                  { label: 'PFOA', value: '2.8 ppt / 4.0', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'PFOS', value: '3.1 ppt / 4.0', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'UCMR Cycle', value: 'UCMR 5', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Cyanotoxins', value: 'Not detected', bg: 'bg-green-50 border-green-200' },
                ]}
                source="UCMR data, utility special monitoring program"
              />
            );

            case 'wq-aqualo': return DS(
              <PlaceholderSection icon={Beaker} iconColor="text-teal-600" title="Aqua-Lo Integration Dashboard"
                description="All lab results from Aqua-Lo LIMS — sample tracking, QA/QC, method compliance, and data flow"
                kpis={[
                  { label: 'Samples In Process', value: '14', bg: 'bg-teal-50 border-teal-200' },
                  { label: 'Results Pending', value: '8', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'QA/QC Flags', value: '0', bg: 'bg-green-50 border-green-200' },
                  { label: 'Avg Turnaround', value: '2.1 days', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Aqua-Lo LIMS integration"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 8: PUBLIC HEALTH & CONTAMINANTS
            // ══════════════════════════════════════════════════════════════

            case 'ph-dw-health': return DS(
              <PlaceholderSection icon={Heart} iconColor="text-red-600" title="Drinking Water Health Compliance"
                description="Health-based MCL compliance, treatment techniques, and public notification status"
                kpis={[
                  { label: 'Acute Violations', value: '0', bg: 'bg-green-50 border-green-200' },
                  { label: 'Treatment Tech', value: 'Compliant', bg: 'bg-green-50 border-green-200' },
                  { label: 'Public Notices', value: 'None required', bg: 'bg-green-50 border-green-200' },
                  { label: 'Boil Water', value: 'No active', bg: 'bg-green-50 border-green-200' },
                ]}
                source="EPA SDWIS, utility notification records"
              />
            );

            case 'ph-lead-copper': return DS(
              <PlaceholderSection icon={Shield} iconColor="text-orange-600" title="Lead & Copper Program"
                description="LCRR compliance, LSL inventory and replacement progress, corrosion control optimization"
                kpis={[
                  { label: 'Lead (90th)', value: '3.2 ppb / 15', bg: 'bg-green-50 border-green-200' },
                  { label: 'LSL Remaining', value: '1,240', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'LSL Replaced', value: '62%', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'LCRR Status', value: 'On Track', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility LSL inventory, compliance tap sampling, SDWIS"
              />
            );

            case 'ph-pfas': return DS(
              <PlaceholderSection icon={AlertTriangle} iconColor="text-red-600" title="PFAS & Emerging Contaminants"
                description="PFAS monitoring results, MCL compliance, treatment assessment, and capital cost estimate"
                kpis={[
                  { label: 'PFOA', value: '2.8 / 4.0 ppt', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'PFOS', value: '3.1 / 4.0 ppt', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Treatment Tech', value: 'GAC evaluated', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Est. Capital', value: '$12.4M', bg: 'bg-red-50 border-red-200' },
                ]}
                source="Utility PFAS monitoring, EPA PFAS MCL compliance"
              />
            );

            case 'ph-pathogen': return DS(
              <PlaceholderSection icon={ShieldCheck} iconColor="text-green-600" title="Pathogen Control"
                description="CT calculations, turbidity compliance, coliform results, and disinfection performance"
                kpis={[
                  { label: 'CT Ratio', value: '1.8x required', bg: 'bg-green-50 border-green-200' },
                  { label: 'Turbidity', value: '0.04 NTU', bg: 'bg-green-50 border-green-200' },
                  { label: 'Total Coliform', value: '0% positive', bg: 'bg-green-50 border-green-200' },
                  { label: 'E. coli', value: 'Absent', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility disinfection monitoring, microbiological sampling"
              />
            );

            case 'ph-effluent-impact': return DS(
              <PlaceholderSection icon={Waves} iconColor="text-indigo-600" title="Effluent Public Health Impact"
                description="Receiving water recreation status, pathogen indicators, and downstream intake proximity"
                kpis={[
                  { label: 'Receiving Water', value: 'Impaired-Rec', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Fecal Coliform', value: '<200 CFU/100mL', bg: 'bg-green-50 border-green-200' },
                  { label: 'DW Intake Prox.', value: '12.4 mi', bg: 'bg-green-50 border-green-200' },
                  { label: 'Reuse Program', value: 'Not active', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="Utility effluent data, ATTAINS receiving water data"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 9: SOURCE & RECEIVING WATERS (utility-exclusive)
            // ══════════════════════════════════════════════════════════════

            case 'sr-source-status': return DS(
              <PlaceholderSection icon={Droplets} iconColor="text-cyan-600" title="Source Water Status"
                description="Source identification, current conditions, USGS gage data, and reservoir status"
                kpis={[
                  { label: 'Source Type', value: 'Surface Water', bg: 'bg-cyan-50 border-cyan-200' },
                  { label: 'Current Flow', value: '1,240 cfs', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Turbidity', value: '4.2 NTU', bg: 'bg-cyan-50 border-cyan-200' },
                  { label: 'Temperature', value: '8.4°C', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="USGS WDFN, utility intake monitoring"
              />
            );

            case 'sr-protection': return DS(
              <PlaceholderSection icon={Shield} iconColor="text-green-600" title="Source Water Protection"
                description="Protection area delineation, potential contaminant sources, and protection plan status"
                kpis={[
                  { label: 'Protection Area', value: 'Delineated', bg: 'bg-green-50 border-green-200' },
                  { label: 'Contaminant Sources', value: '14 identified', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Plan Status', value: 'Current', bg: 'bg-green-50 border-green-200' },
                  { label: 'High-Risk Sources', value: '3', bg: 'bg-red-50 border-red-200' },
                ]}
                source="State source water assessment, utility protection plan"
              />
            );

            case 'sr-threats': return DS(
              <PlaceholderSection icon={AlertTriangle} iconColor="text-amber-600" title="Source Water Threats"
                description="Upstream dischargers, land use trends, impairments, HAB risk, and climate impact"
                kpis={[
                  { label: 'Upstream NPDES', value: '8 permits', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Upstream Impaired', value: '2 segments', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'HAB Risk', value: 'Low', bg: 'bg-green-50 border-green-200' },
                  { label: 'Drought Risk', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                ]}
                source="EPA ECHO, ATTAINS, NOAA HAB forecast, USGS projections"
              />
            );

            case 'sr-monitoring': return DS(
              <PlaceholderSection icon={Activity} iconColor="text-blue-600" title="Source Water Monitoring"
                description="Utility source water monitoring results, trends, event detection, and early warnings"
                kpis={[
                  { label: 'Stations', value: '4 active', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Trend', value: 'Stable', bg: 'bg-green-50 border-green-200' },
                  { label: 'Events Detected', value: '0', bg: 'bg-green-50 border-green-200' },
                  { label: 'Taste & Odor', value: 'None reported', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility source water monitoring program"
              />
            );

            case 'sr-receiving-status': return DS(
              <PlaceholderSection icon={Waves} iconColor="text-indigo-600" title="Receiving Water Status"
                description="Receiving waterbody conditions, impairment status, TMDLs, and other dischargers"
                kpis={[
                  { label: 'Receiving Water', value: 'Patapsco River', bg: 'bg-indigo-50 border-indigo-200' },
                  { label: 'Impairment', value: 'Nutrients, Sediment', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Active TMDLs', value: '2', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Other Dischargers', value: '5', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="EPA ATTAINS, NPDES permit records"
              />
            );

            case 'sr-discharge-impact': return DS(
              <PlaceholderSection icon={BarChart3} iconColor="text-blue-600" title="Discharge Impact Analysis"
                description="Utility contribution vs. total load, mixing zone, and effluent-dominated stream analysis"
                kpis={[
                  { label: 'Load Contribution', value: '18% of N', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Mixing Zone', value: 'Approved', bg: 'bg-green-50 border-green-200' },
                  { label: '7Q10 Flow', value: '42 cfs', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'Effluent Dominant', value: 'No', bg: 'bg-green-50 border-green-200' },
                ]}
                source="NPDES fact sheet, receiving water modeling"
              />
            );

            case 'sr-regulatory-nexus': return DS(
              <PlaceholderSection icon={Scale} iconColor="text-purple-600" title="Regulatory Nexus"
                description="How receiving water status affects permit limits, upcoming TMDLs, and WQS changes"
                kpis={[
                  { label: 'WQS Impact', value: '1 pending', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'TMDL Pending', value: '1 in dev.', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Anti-degradation', value: 'Tier 2', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Limit Basis', value: 'WQ-based', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="State WQS, TMDL program, anti-degradation analysis"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 10: TREATMENT & PROCESS (utility-exclusive)
            // ══════════════════════════════════════════════════════════════

            case 'tp-dw-process-flow': return DS(
              <PlaceholderSection icon={Gauge} iconColor="text-sky-600" title="DW Process Flow Diagram"
                description="Interactive process schematic: intake → rapid mix → floc → sed → filter → disinfection → clearwell → distribution"
                kpis={[
                  { label: 'Intake', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                  { label: 'Filtration', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                  { label: 'Disinfection', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                  { label: 'Distribution', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                ]}
                source="SCADA integration (Phase 2+), utility operational data"
              />
            );

            case 'tp-dw-performance': return DS(
              <PlaceholderSection icon={TrendingUp} iconColor="text-blue-600" title="DW Process Performance"
                description="Turbidity chain, disinfection CT, coagulation, filtration, and corrosion control"
                kpis={[
                  { label: 'Raw → Finished', value: '4.2 → 0.04 NTU', bg: 'bg-green-50 border-green-200' },
                  { label: 'CT Ratio', value: '1.8x', bg: 'bg-green-50 border-green-200' },
                  { label: 'Filter Run Time', value: '68 hrs avg', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'LSI', value: '-0.2', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility process monitoring, Aqua-Lo"
              />
            );

            case 'tp-dw-chemical': return DS(
              <PlaceholderSection icon={FlaskConical} iconColor="text-purple-600" title="DW Chemical Management"
                description="Chemical inventory, dosing rates, delivery schedule, and cost tracking"
                kpis={[
                  { label: 'Alum Stock', value: '14 days', bg: 'bg-green-50 border-green-200' },
                  { label: 'Chlorine', value: '21 days', bg: 'bg-green-50 border-green-200' },
                  { label: 'Fluoride', value: '30 days', bg: 'bg-green-50 border-green-200' },
                  { label: 'Monthly Cost', value: '$42K', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="Utility chemical inventory and procurement system"
              />
            );

            case 'tp-dw-filter': return DS(
              <PlaceholderSection icon={Settings} iconColor="text-slate-600" title="DW Filter Management"
                description="Individual filter performance, backwash schedule, media condition, and comparison"
                kpis={[
                  { label: 'Filters Online', value: '6 of 8', bg: 'bg-green-50 border-green-200' },
                  { label: 'Avg Eff. Turb.', value: '0.04 NTU', bg: 'bg-green-50 border-green-200' },
                  { label: 'Avg Run Time', value: '68 hrs', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Next Backwash', value: 'F3 in 4 hrs', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility filter monitoring system"
              />
            );

            case 'tp-ww-process-flow': return DS(
              <PlaceholderSection icon={Gauge} iconColor="text-indigo-600" title="WW Process Flow Diagram"
                description="Interactive process schematic: headworks → primary → secondary → tertiary → disinfection → discharge"
                kpis={[
                  { label: 'Headworks', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                  { label: 'Aeration', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                  { label: 'Clarifiers', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                  { label: 'UV Disinfection', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                ]}
                source="SCADA integration (Phase 2+), utility operational data"
              />
            );

            case 'tp-ww-performance': return DS(
              <PlaceholderSection icon={TrendingUp} iconColor="text-indigo-600" title="WW Process Performance"
                description="Influent characterization, activated sludge, nitrification, secondary clarifier, and disinfection"
                kpis={[
                  { label: 'MLSS', value: '3,200 mg/L', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'SRT', value: '12 days', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'DO', value: '2.1 mg/L', bg: 'bg-green-50 border-green-200' },
                  { label: 'SVI', value: '120 mL/g', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility process monitoring, Aqua-Lo"
              />
            );

            case 'tp-ww-solids': return DS(
              <PlaceholderSection icon={Leaf} iconColor="text-amber-600" title="WW Solids Management"
                description="Sludge production, dewatering, digester performance, biosolids quality, and disposal"
                kpis={[
                  { label: 'Sludge Prod.', value: '8.2 dry tons/d', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Cake Solids', value: '22%', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'VS Reduction', value: '58%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Disposal', value: 'Land application', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility solids handling data, biosolids management records"
              />
            );

            case 'tp-ww-chemical': return DS(
              <PlaceholderSection icon={FlaskConical} iconColor="text-indigo-600" title="WW Chemical Management"
                description="Chemical inventory, polymer dosing, alkalinity supplementation, and odor control"
                kpis={[
                  { label: 'Polymer Stock', value: '18 days', bg: 'bg-green-50 border-green-200' },
                  { label: 'NaOH Stock', value: '12 days', bg: 'bg-green-50 border-green-200' },
                  { label: 'Odor Control', value: 'Normal', bg: 'bg-green-50 border-green-200' },
                  { label: 'Monthly Cost', value: '$28K', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="Utility chemical inventory and procurement system"
              />
            );

            case 'tp-energy': return DS(
              <PlaceholderSection icon={Zap} iconColor="text-yellow-600" title="Energy Management"
                description="Total consumption, energy per MG treated, peak demand, and renewable energy"
                kpis={[
                  { label: 'Total kWh', value: '58,400/day', bg: 'bg-yellow-50 border-yellow-200' },
                  { label: 'kWh/MG', value: '1,820', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Peak Demand', value: '2,840 kW', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Solar Gen.', value: '420 kWh/d', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility energy metering, electric utility billing"
              />
            );

            case 'tp-optimization': return DS(
              <PlaceholderSection icon={Sparkles} iconColor="text-violet-600" title="Process Optimization"
                description="AI-assisted recommendations for chemical dose, setpoints, energy, and PIN integration (Phase 2)"
                kpis={[
                  { label: 'AI Status', value: 'Phase 2', bg: 'bg-violet-50 border-violet-200' },
                  { label: 'Chemical Savings', value: 'Est. 8-12%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Energy Savings', value: 'Est. 5-10%', bg: 'bg-green-50 border-green-200' },
                  { label: 'PIN', value: 'Evaluated', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="AI optimization engine (Phase 2), PIN performance data"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 11: INFRASTRUCTURE
            // ══════════════════════════════════════════════════════════════

            case 'infra-system-map': return DS(
              <PlaceholderSection icon={Landmark} iconColor="text-slate-600" title="System Overview Map"
                description="Treatment plants, mains/sewers, pump stations, tanks, pressure zones, and service area"
                kpis={[
                  { label: 'Treatment Plants', value: '2', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'Pipe Miles', value: '482 mi', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Pump Stations', value: '24', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Storage Tanks', value: '8', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility GIS, asset management system"
              />
            );

            case 'infra-plant': return DS(
              <PlaceholderSection icon={Factory} iconColor="text-slate-600" title="Treatment Plant Infrastructure"
                description="Major process units condition, capacity utilization, equipment inventory, and redundancy"
                kpis={[
                  { label: 'Avg Condition', value: '3.2 / 5', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Capacity Used', value: '71%', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Equipment', value: '342 assets', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'Planned Upgrades', value: '3', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility asset management system, capital improvement plan"
              />
            );

            case 'infra-distribution': return DS(
              <PlaceholderSection icon={Waves} iconColor="text-sky-600" title="Distribution / Collection System"
                description="Pipe inventory, break history, CCTV inspection, I&I assessment, and water loss program"
                kpis={[
                  { label: 'Avg Pipe Age', value: '42 years', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Breaks/yr', value: '58', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'CCTV Inspected', value: '34%', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Water Loss', value: '14.2%', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="Utility GIS, maintenance records, AWWA water audit"
              />
            );

            case 'infra-pump-stations': return DS(
              <PlaceholderSection icon={Wrench} iconColor="text-blue-600" title="Pump Stations"
                description="Pump station inventory, runtime metrics, alarm history, SCADA status, and emergency power"
                kpis={[
                  { label: 'Total Stations', value: '24', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Avg Uptime', value: '99.2%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Alarms (30d)', value: '7', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Gen. Tested', value: '22 of 24', bg: 'bg-green-50 border-green-200' },
                ]}
                source="SCADA, utility maintenance records"
              />
            );

            case 'infra-storage': return DS(
              <PlaceholderSection icon={HardHat} iconColor="text-slate-600" title="Storage"
                description="Tank/reservoir inventory, current levels, turnover rate, and inspection schedule"
                kpis={[
                  { label: 'Total Capacity', value: '12.4 MG', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Current Level', value: '78%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Turnover', value: '1.2 days avg', bg: 'bg-green-50 border-green-200' },
                  { label: 'Next Inspection', value: 'Tank 3 - Jun', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility SCADA, tank inspection records"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 12: LABORATORY & SAMPLING (utility-exclusive)
            // ══════════════════════════════════════════════════════════════

            case 'lab-tracking': return DS(
              <PlaceholderSection icon={Beaker} iconColor="text-teal-600" title="Sample Tracking"
                description="Active sample lifecycle, schedule, chain of custody, and hold time compliance"
                kpis={[
                  { label: 'In Process', value: '14 samples', bg: 'bg-teal-50 border-teal-200' },
                  { label: 'Due Today', value: '6 samples', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Hold Time Risk', value: '0', bg: 'bg-green-50 border-green-200' },
                  { label: 'Collection Points', value: '38', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="Aqua-Lo LIMS, utility sampling schedule"
              />
            );

            case 'lab-results': return DS(
              <PlaceholderSection icon={CheckCircle} iconColor="text-green-600" title="Results Management"
                description="Results review queue, QA/QC flags, approved results flow, and historical database"
                kpis={[
                  { label: 'Pending Review', value: '8', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'QA/QC Flags', value: '0', bg: 'bg-green-50 border-green-200' },
                  { label: 'Approved Today', value: '12', bg: 'bg-green-50 border-green-200' },
                  { label: 'Total Records', value: '24,890', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="Aqua-Lo LIMS, utility lab database"
              />
            );

            case 'lab-qaqc': return DS(
              <PlaceholderSection icon={ShieldCheck} iconColor="text-blue-600" title="QA/QC Program"
                description="Control charts, method blanks, duplicate precision, spike recovery, and PT results"
                kpis={[
                  { label: 'Control Charts', value: 'All in range', bg: 'bg-green-50 border-green-200' },
                  { label: 'Method Blanks', value: 'Clean', bg: 'bg-green-50 border-green-200' },
                  { label: 'PT Results', value: 'Acceptable', bg: 'bg-green-50 border-green-200' },
                  { label: 'Next MDL Study', value: 'Mar 2026', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Aqua-Lo LIMS QA/QC module, PT provider"
              />
            );

            case 'lab-regulatory': return DS(
              <PlaceholderSection icon={FileCheck} iconColor="text-indigo-600" title="Regulatory Monitoring Compliance"
                description="Monitoring schedule by regulation, compliance status, and reduced monitoring eligibility"
                kpis={[
                  { label: 'SDWA Compliance', value: '100%', bg: 'bg-green-50 border-green-200' },
                  { label: 'NPDES Compliance', value: '100%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Next 30 Days', value: '18 samples', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Reduced Mon.', value: '3 waivers', bg: 'bg-green-50 border-green-200' },
                ]}
                source="SDWA/NPDES monitoring requirements, Aqua-Lo schedule"
              />
            );

            case 'lab-management': return DS(
              <PlaceholderSection icon={Microscope} iconColor="text-purple-600" title="Lab Management"
                description="Lab certification, methods, equipment, staffing, contract labs, and capacity analysis"
                kpis={[
                  { label: 'Certification', value: 'Current', bg: 'bg-green-50 border-green-200' },
                  { label: 'Methods', value: '42 certified', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Equipment', value: '18 instruments', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'Capacity', value: '82% utilized', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="State lab certification, utility lab management records"
              />
            );

            case 'lab-aqualo': return DS(
              <PlaceholderSection icon={Sparkles} iconColor="text-teal-600" title="Aqua-Lo LIMS Dashboard"
                description="Connection status, data flow health, error log, and configuration management"
                kpis={[
                  { label: 'Sync Status', value: 'Connected', bg: 'bg-green-50 border-green-200' },
                  { label: 'Records Synced', value: '24,890', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Sync Errors', value: '0', bg: 'bg-green-50 border-green-200' },
                  { label: 'Last Sync', value: '2 min ago', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Aqua-Lo LIMS API integration"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 13: DISASTER & EMERGENCY
            // ══════════════════════════════════════════════════════════════

            case 'disaster-active': return DS(
              <PlaceholderSection icon={AlertTriangle} iconColor="text-red-600" title="Active Emergencies"
                description="Main breaks, sewer overflows, plant upsets, source water contamination, and power outages"
                kpis={[
                  { label: 'Main Breaks', value: '0 active', bg: 'bg-green-50 border-green-200' },
                  { label: 'SSO/CSO Events', value: '0 active', bg: 'bg-green-50 border-green-200' },
                  { label: 'Plant Bypass', value: 'None', bg: 'bg-green-50 border-green-200' },
                  { label: 'Power Outages', value: '0', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility alarm system, SCADA, state notification records"
              />
            );

            case 'disaster-response': return DS(
              <PlaceholderSection icon={Shield} iconColor="text-red-600" title="Emergency Response Operations"
                description="ERP activation, notification checklist, boil water advisories, and mutual aid"
                kpis={[
                  { label: 'ERP Status', value: 'Standby', bg: 'bg-green-50 border-green-200' },
                  { label: 'Notifications', value: 'None pending', bg: 'bg-green-50 border-green-200' },
                  { label: 'Boil Water', value: 'No active', bg: 'bg-green-50 border-green-200' },
                  { label: 'Mutual Aid', value: 'Available', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility ERP records, state notification system"
              />
            );

            case 'disaster-vulnerability': return DS(
              <PlaceholderSection icon={ShieldCheck} iconColor="text-amber-600" title="Vulnerability Assessment"
                description="AWIA compliance, risk & resilience assessment, single points of failure, and cybersecurity"
                kpis={[
                  { label: 'AWIA Status', value: 'Compliant', bg: 'bg-green-50 border-green-200' },
                  { label: 'R&R Assessment', value: 'Current', bg: 'bg-green-50 border-green-200' },
                  { label: 'Single Failures', value: '3 identified', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Backup Power', value: '100% coverage', bg: 'bg-green-50 border-green-200' },
                ]}
                source="AWIA risk & resilience assessment, cybersecurity audit"
              />
            );

            case 'disaster-recovery': return DS(
              <PlaceholderSection icon={Wrench} iconColor="text-blue-600" title="Event Recovery"
                description="Repair tracking, insurance claims, FEMA assistance, and after-action reviews"
                kpis={[
                  { label: 'Open Repairs', value: '0', bg: 'bg-green-50 border-green-200' },
                  { label: 'Insurance Claims', value: '0 active', bg: 'bg-green-50 border-green-200' },
                  { label: 'FEMA Apps', value: 'None', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'AARs Pending', value: '0', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility maintenance records, insurance claims, FEMA PA"
              />
            );

            case 'disaster-resilience': return DS(
              <PlaceholderSection icon={ThermometerSun} iconColor="text-orange-600" title="Climate Resilience"
                description="Flood risk, sea level rise, extreme heat impact, drought contingency, and resilience investment"
                kpis={[
                  { label: 'Flood Risk', value: 'Moderate', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Drought Plan', value: 'Current', bg: 'bg-green-50 border-green-200' },
                  { label: 'Heat Impact', value: 'Low-Moderate', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Resilience CIP', value: '$3.2M planned', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility climate resilience assessment, FEMA flood maps"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 14: PERMIT LIMITS & COMPLIANCE (utility-exclusive)
            // ══════════════════════════════════════════════════════════════

            case 'pl-effluent-limits': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-blue-600" />
                    Effluent Limits Table
                  </CardTitle>
                  <CardDescription>Complete NPDES permit limits with current performance and proximity tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Parameter</th>
                          <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Limit Type</th>
                          <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Limit</th>
                          <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Current</th>
                          <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">% Used</th>
                          <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { param: 'BOD₅', type: 'Monthly Avg', limit: '30 mg/L', current: '8.2 mg/L', pct: 27, status: 'safe' },
                          { param: 'TSS', type: 'Monthly Avg', limit: '30 mg/L', current: '6.1 mg/L', pct: 20, status: 'safe' },
                          { param: 'NH₃-N', type: 'Monthly Avg', limit: '4.0 mg/L', current: '1.8 mg/L', pct: 45, status: 'safe' },
                          { param: 'TP', type: 'Monthly Avg', limit: '1.0 mg/L', current: '0.8 mg/L', pct: 80, status: 'caution' },
                          { param: 'E. coli', type: 'Daily Max', limit: '410 CFU', current: '42 CFU', pct: 10, status: 'safe' },
                          { param: 'DO', type: 'Daily Min', limit: '5.0 mg/L', current: '7.2 mg/L', pct: 0, status: 'safe' },
                        ].map(row => (
                          <tr key={row.param} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium text-slate-700">{row.param}</td>
                            <td className="py-2 px-3 text-slate-500">{row.type}</td>
                            <td className="py-2 px-3 text-slate-700">{row.limit}</td>
                            <td className="py-2 px-3 text-slate-700">{row.current}</td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${row.status === 'safe' ? 'bg-green-500' : row.status === 'caution' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${row.pct}%` }} />
                                </div>
                                <span className="text-xs text-slate-500">{row.pct}%</span>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${row.status === 'safe' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>{row.status === 'safe' ? 'Safe' : 'Caution'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: NPDES permit, utility lab data (Aqua-Lo)</p>
                </CardContent>
              </Card>
            );

            case 'pl-dw-standards': return DS(
              <PlaceholderSection icon={Droplets} iconColor="text-sky-600" title="Drinking Water Standards Table"
                description="Complete MCL/MCLG table with monitoring frequency, latest results, and compliance status"
                kpis={[
                  { label: 'MCLs Monitored', value: '82', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'All Passing', value: 'Yes', bg: 'bg-green-50 border-green-200' },
                  { label: 'Reduced Mon.', value: '3 waivers', bg: 'bg-green-50 border-green-200' },
                  { label: 'Action Levels', value: 'Below AL', bg: 'bg-green-50 border-green-200' },
                ]}
                source="EPA SDWIS, utility monitoring data"
              />
            );

            case 'pl-special-conditions': return DS(
              <PlaceholderSection icon={Scale} iconColor="text-purple-600" title="Special Conditions"
                description="Permit special conditions, compliance schedule, WET testing, mixing zone, and variance status"
                kpis={[
                  { label: 'Special Conditions', value: '6 active', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Compliance Sched.', value: 'On Track', bg: 'bg-green-50 border-green-200' },
                  { label: 'WET Test', value: 'Pass (Q4)', bg: 'bg-green-50 border-green-200' },
                  { label: 'Variance', value: 'None', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="NPDES permit special conditions, compliance schedule"
              />
            );

            case 'pl-renewal': return DS(
              <PlaceholderSection icon={Clock} iconColor="text-amber-600" title="Permit Renewal Preparation"
                description="Permit expiration countdown, expected changes, application checklist, and cost impact"
                kpis={[
                  { label: 'Permit Expires', value: 'Jan 2028', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Days Remaining', value: '693', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'New Limits Expected', value: '2 params', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Est. Cost Impact', value: '$4.1M', bg: 'bg-red-50 border-red-200' },
                ]}
                source="State permitting authority, permit renewal analysis"
              />
            );

            case 'pl-derivation': return DS(
              <PlaceholderSection icon={BarChart3} iconColor="text-indigo-600" title="Limit Derivation Understanding"
                description="How each limit was derived, TMDL-based limits, reasonable potential analysis, and variance basis"
                kpis={[
                  { label: 'Tech-Based', value: '3 params', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'WQ-Based', value: '4 params', bg: 'bg-indigo-50 border-indigo-200' },
                  { label: 'TMDL-Based', value: '2 params', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'RPA Triggers', value: '1 param', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="NPDES fact sheet, TMDL waste load allocations"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 15: SCORECARD
            // ══════════════════════════════════════════════════════════════

            case 'sc-regulatory': return DS(
              <PlaceholderSection icon={ShieldCheck} iconColor="text-green-600" title="Regulatory Compliance Score"
                description="SDWA grade, NPDES grade, monitoring/reporting compliance, and violation-free streak"
                kpis={[
                  { label: 'SDWA Grade', value: 'A', bg: 'bg-green-50 border-green-200' },
                  { label: 'NPDES Grade', value: 'A-', bg: 'bg-green-50 border-green-200' },
                  { label: 'Monitoring', value: '100%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Violation-Free', value: '187 days', bg: 'bg-green-50 border-green-200' },
                ]}
                source="EPA ECHO, SDWIS, utility compliance records"
              />
            );

            case 'sc-operational': return DS(
              <PlaceholderSection icon={Gauge} iconColor="text-blue-600" title="Operational Performance Score"
                description="Treatment effectiveness, capacity utilization, energy efficiency, and system reliability"
                kpis={[
                  { label: 'Treatment', value: '97.2% removal', bg: 'bg-green-50 border-green-200' },
                  { label: 'Capacity', value: '71% utilized', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Energy Eff.', value: '1,820 kWh/MG', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Uptime', value: '99.8%', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility process and operational data"
              />
            );

            case 'sc-infrastructure': return DS(
              <PlaceholderSection icon={HardHat} iconColor="text-slate-600" title="Infrastructure Health Score"
                description="Asset condition, replacement rate, break frequency, water loss, and CIP progress"
                kpis={[
                  { label: 'Condition Index', value: '3.2 / 5', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Replace Rate', value: '1.8% / yr', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Water Loss', value: '14.2%', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'CIP Progress', value: '72% on track', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility asset management system"
              />
            );

            case 'sc-financial': return DS(
              <PlaceholderSection icon={Banknote} iconColor="text-emerald-600" title="Financial Health Score"
                description="Rate adequacy, debt service coverage, operating ratio, and affordability index"
                kpis={[
                  { label: 'Rate Adequacy', value: '102%', bg: 'bg-green-50 border-green-200' },
                  { label: 'DSCR', value: '1.42x', bg: 'bg-green-50 border-green-200' },
                  { label: 'Operating Ratio', value: '0.94', bg: 'bg-green-50 border-green-200' },
                  { label: 'Affordability', value: '1.2% MHI', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility financial system, rate study"
              />
            );

            case 'sc-customer': return DS(
              <PlaceholderSection icon={Users} iconColor="text-sky-600" title="Customer Service Score"
                description="Service interruptions, complaint rate, resolution time, and CCR delivery"
                kpis={[
                  { label: 'Interruptions', value: '2 / 1000 conn', bg: 'bg-green-50 border-green-200' },
                  { label: 'Complaints/mo', value: '12 avg', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Resolution', value: '2.1 days avg', bg: 'bg-green-50 border-green-200' },
                  { label: 'CCR Delivered', value: '100%', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility CRM, customer service records"
              />
            );

            case 'sc-benchmarking': return DS(
              <PlaceholderSection icon={Trophy} iconColor="text-amber-600" title="Peer Benchmarking"
                description="Compare to similar utilities by size, source type, and state — AWWA metrics and quartile ranking"
                kpis={[
                  { label: 'Peer Group', value: 'Med. Surface', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Overall Quartile', value: '2nd (Good)', bg: 'bg-green-50 border-green-200' },
                  { label: 'Best In Class', value: 'Energy Eff.', bg: 'bg-green-50 border-green-200' },
                  { label: 'Needs Improve', value: 'Water Loss', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="AWWA benchmarking data, peer utility comparison"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 16: REPORTS
            // ══════════════════════════════════════════════════════════════

            case 'rpt-dmr': return DS(
              <PlaceholderSection icon={FileText} iconColor="text-indigo-600" title="DMR Generation"
                description="Monthly DMR workspace with auto-population from Aqua-Lo, QA/QC review, and NetDMR submission"
                kpis={[
                  { label: 'Current Month', value: 'Feb 2026', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Data Status', value: 'Auto-populated', bg: 'bg-green-50 border-green-200' },
                  { label: 'QA/QC', value: 'In Review', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Due Date', value: 'Mar 15', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Aqua-Lo LIMS, NetDMR, NPDES permit"
              />
            );

            case 'rpt-ccr': return DS(
              <PlaceholderSection icon={FileCheck} iconColor="text-sky-600" title="Consumer Confidence Report"
                description="Annual CCR workspace with auto-populated contaminant tables and distribution tracking"
                kpis={[
                  { label: 'Report Year', value: '2025', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Data Complete', value: '100%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Distribution', value: 'Jul 1 deadline', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Method', value: 'Mail + Online', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="Utility monitoring data, SDWA CCR requirements"
              />
            );

            case 'rpt-operational': return DS(
              <PlaceholderSection icon={ClipboardList} iconColor="text-slate-600" title="Operational Reports"
                description="Daily operations, monthly reports, board meeting reports, and custom report builder"
                kpis={[
                  { label: 'Daily Report', value: 'Generated', bg: 'bg-green-50 border-green-200' },
                  { label: 'Monthly Report', value: 'Due Mar 5', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Board Report', value: 'Next: Mar 12', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Annual Report', value: 'FY2025 draft', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="Utility operational records, shift logs"
              />
            );

            case 'rpt-regulatory': return DS(
              <PlaceholderSection icon={Landmark} iconColor="text-purple-600" title="Regulatory Reports"
                description="State-required reports, sanitary survey prep, biosolids annual, and overflow reporting"
                kpis={[
                  { label: 'State Reports', value: '1 due Q1', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Sanitary Survey', value: 'Next: Nov 2026', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Biosolids Annual', value: 'Submitted', bg: 'bg-green-50 border-green-200' },
                  { label: 'SSO Reports', value: '0 pending', bg: 'bg-green-50 border-green-200' },
                ]}
                source="State regulatory reporting requirements"
              />
            );

            case 'rpt-financial': return DS(
              <PlaceholderSection icon={Banknote} iconColor="text-emerald-600" title="Financial Reports"
                description="Rate study support, budget vs. actual, capital project financial, and SRF loan compliance"
                kpis={[
                  { label: 'Budget vs. Actual', value: '96% on track', bg: 'bg-green-50 border-green-200' },
                  { label: 'CIP Spending', value: '$8.2M YTD', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'SRF Reporting', value: 'Current', bg: 'bg-green-50 border-green-200' },
                  { label: 'Rate Study', value: 'Due 2027', bg: 'bg-slate-50 border-slate-200' },
                ]}
                source="Utility financial system, SRF loan records"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 17: ASSET MANAGEMENT (utility-exclusive)
            // ══════════════════════════════════════════════════════════════

            case 'am-inventory': return DS(
              <PlaceholderSection icon={Wrench} iconColor="text-slate-600" title="Asset Inventory"
                description="Complete asset registry — treatment, linear, vertical, mechanical, electrical, and fleet"
                kpis={[
                  { label: 'Total Assets', value: '4,820', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'Replacement Value', value: '$342M', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Past Useful Life', value: '18%', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'GIS Mapped', value: '92%', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility asset management system, GIS"
              />
            );

            case 'am-condition': return DS(
              <PlaceholderSection icon={BarChart3} iconColor="text-blue-600" title="Condition Assessment"
                description="Condition rating distribution, assessment schedule, deterioration curves, and remaining useful life"
                kpis={[
                  { label: 'Avg Condition', value: '3.2 / 5', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Assessed', value: '68%', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Critical (1-2)', value: '12%', bg: 'bg-red-50 border-red-200' },
                  { label: 'Good (4-5)', value: '45%', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility condition assessment program, CCTV data"
              />
            );

            case 'am-maintenance': return DS(
              <PlaceholderSection icon={Settings} iconColor="text-blue-600" title="Maintenance Management"
                description="PM schedules, work orders, maintenance history, PM compliance rate, and spare parts"
                kpis={[
                  { label: 'Open Work Orders', value: '34', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'PM Compliance', value: '91%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Corrective WOs', value: '8 active', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Avg Close Time', value: '3.2 days', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility CMMS / maintenance management system"
              />
            );

            case 'am-risk': return DS(
              <PlaceholderSection icon={AlertTriangle} iconColor="text-red-600" title="Risk-Based Prioritization"
                description="Risk matrix (PoF × CoF), highest-risk assets, business risk exposure, and predictive analytics"
                kpis={[
                  { label: 'Very High Risk', value: '8 assets', bg: 'bg-red-50 border-red-200' },
                  { label: 'High Risk', value: '24 assets', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Risk Exposure', value: '$14.2M', bg: 'bg-red-50 border-red-200' },
                  { label: 'Mitigated YTD', value: '4 assets', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility risk assessment, asset management framework"
              />
            );

            case 'am-capital': return DS(
              <PlaceholderSection icon={HardHat} iconColor="text-indigo-600" title="Capital Planning"
                description="CIP project list, priority ranking, timeline tracking, and 5/10/20 year projection"
                kpis={[
                  { label: 'CIP Projects', value: '12 active', bg: 'bg-blue-50 border-blue-200' },
                  { label: '5-Year CIP', value: '$48M', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'On Schedule', value: '9 of 12', bg: 'bg-green-50 border-green-200' },
                  { label: 'Funding Gap', value: '$4.2M', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="Utility capital improvement plan, financial projections"
              />
            );

            case 'am-lifecycle': return DS(
              <PlaceholderSection icon={TrendingUp} iconColor="text-emerald-600" title="Lifecycle Cost Analysis"
                description="Total cost of ownership, repair vs. replace decisions, and PIN lifecycle cost"
                kpis={[
                  { label: 'Avg TCO', value: '$1.2M / asset', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'Replace Decisions', value: '3 pending', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Energy Savings', value: '$420K/yr est.', bg: 'bg-green-50 border-green-200' },
                  { label: 'PIN', value: 'Evaluated', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility financial records, engineering assessments"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // VIEW 18: FUNDING & GRANTS
            // ══════════════════════════════════════════════════════════════

            case 'fund-srf': return DS(
              <PlaceholderSection icon={Landmark} iconColor="text-blue-600" title="SRF Loan Portfolio"
                description="Active SRF loans, new application status, priority list ranking, and covenant compliance"
                kpis={[
                  { label: 'Active Loans', value: '2', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Outstanding', value: '$18.4M', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Interest Rate', value: '1.2% avg', bg: 'bg-green-50 border-green-200' },
                  { label: 'Priority Rank', value: '#14', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="State SRF program, utility debt records"
              />
            );

            case 'fund-federal': return DS(
              <PlaceholderSection icon={Banknote} iconColor="text-green-600" title="Federal Funding Programs"
                description="BIL allocation, WIFIA eligibility, USDA RUS, FEMA mitigation, and grant matching"
                kpis={[
                  { label: 'BIL Eligible', value: '$4.2M', bg: 'bg-green-50 border-green-200' },
                  { label: 'WIFIA Status', value: 'Pre-application', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Active Grants', value: '1', bg: 'bg-green-50 border-green-200' },
                  { label: 'Match Required', value: '$840K', bg: 'bg-amber-50 border-amber-200' },
                ]}
                source="EPA funding programs, USDA RUS, FEMA HMA"
              />
            );

            case 'fund-revenue': return DS(
              <PlaceholderSection icon={BarChart3} iconColor="text-emerald-600" title="Revenue & Rate Planning"
                description="Rate structure, revenue projections, affordability analysis, and rate comparison"
                kpis={[
                  { label: 'Avg Bill', value: '$62/mo', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Rate Adequacy', value: '102%', bg: 'bg-green-50 border-green-200' },
                  { label: '% of MHI', value: '1.2%', bg: 'bg-green-50 border-green-200' },
                  { label: 'Next Increase', value: 'FY2027', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility rate study, financial projections"
              />
            );

            case 'fund-debt': return DS(
              <PlaceholderSection icon={Scale} iconColor="text-slate-600" title="Debt Management"
                description="Outstanding debt portfolio, debt service schedule, coverage ratios, and refinancing"
                kpis={[
                  { label: 'Total Debt', value: '$28.6M', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Annual DS', value: '$2.4M', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'DSCR', value: '1.42x', bg: 'bg-green-50 border-green-200' },
                  { label: 'New Capacity', value: '$8.2M', bg: 'bg-green-50 border-green-200' },
                ]}
                source="Utility financial records, bond documents"
              />
            );

            case 'fund-capital-strategy': return DS(
              <PlaceholderSection icon={Trophy} iconColor="text-indigo-600" title="Capital Funding Strategy"
                description="CIP funding plan, grant pipeline, funding gap analysis, and multi-year financial plan"
                kpis={[
                  { label: '5-Year CIP', value: '$48M', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Funded', value: '$38M (79%)', bg: 'bg-green-50 border-green-200' },
                  { label: 'Gap', value: '$10M', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Apps Pending', value: '2', bg: 'bg-blue-50 border-blue-200' },
                ]}
                source="Utility CIP, financial plan, grant applications"
              />
            );

            // ══════════════════════════════════════════════════════════════
            // WARR ZONES
            // ══════════════════════════════════════════════════════════════

            case 'warr-metrics': {
              const warrM: WARRMetric[] = [
                { label: 'Plant Uptime', value: '—', icon: Gauge, iconColor: 'var(--status-healthy)', subtitle: 'Treatment facility status' },
                { label: 'Effluent Compliance', value: '—', icon: Shield, iconColor: 'var(--accent-teal)', subtitle: 'Permit limit compliance' },
                { label: 'Service Alerts', value: '—', icon: AlertTriangle, iconColor: 'var(--status-warning)', subtitle: 'Active service notifications' },
              ];
              return DS(<WARRZones zone="warr-metrics" role="Utility" stateAbbr={systemId} metrics={warrM} events={[]} activeResolutionCount={0} />);
            }
            case 'warr-analyze': return DS(
              <WARRZones zone="warr-analyze" role="Utility" stateAbbr={systemId} metrics={[]} events={[]} activeResolutionCount={0} />
            );
            case 'warr-respond': return DS(
              <WARRZones zone="warr-respond" role="Utility" stateAbbr={systemId} metrics={[]} events={[]} activeResolutionCount={0} />
            );
            case 'warr-resolve': return DS(
              <WARRZones zone="warr-resolve" role="Utility" stateAbbr={systemId} metrics={[]} events={[]} activeResolutionCount={0} onOpenPlanner={() => setActiveLens('disaster')} />
            );

            // ══════════════════════════════════════════════════════════════
            // DISCLAIMER (always visible)
            // ══════════════════════════════════════════════════════════════

            case 'location-report': return DS(<LocationReportCard />);

            case 'disclaimer': return DS(
              <PlatformDisclaimer />
            );

            default: return null;
            }
          })}

          </div>
        )}
        </LayoutEditor>

      </div>
    </div>
  );
}
