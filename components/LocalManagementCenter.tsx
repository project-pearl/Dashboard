'use client';

import React, { useMemo } from 'react';
import { useLensParam } from '@/lib/useLensParam';
import HeroBanner from './HeroBanner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Shield, AlertTriangle, CheckCircle, Droplets, TrendingUp,
  BarChart3, Info, Waves, Sparkles, Trophy, FileText, Banknote, DollarSign, Target, PieChart,
  Megaphone, CloudRain, Users, Activity, MapPin, Wrench, Clock,
  ShieldCheck, Heart, Scale, Gauge, Zap, AlertCircle, ChevronDown,
  Minus,
} from 'lucide-react';
import { DashboardSection } from './DashboardSection';
import { StatusCard } from './StatusCard';
import { PlatformDisclaimer } from './PlatformDisclaimer';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';
import { NwisGwPanel } from '@/components/NwisGwPanel';
import { GrantOpportunityMatcher } from '@/components/GrantOpportunityMatcher';

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewLens = 'overview' | 'briefing' | 'political-briefing' | 'water-quality'
  | 'infrastructure' | 'compliance' | 'stormwater' | 'public-health'
  | 'funding' | 'ej-equity' | 'emergency' | 'scorecard' | 'reports';

type Props = {
  jurisdictionId: string;
  stateAbbr: string;
  onSelectRegion?: (regionId: string) => void;
  onToggleDevMode?: () => void;
};

// ─── Lens Config ─────────────────────────────────────────────────────────────

const LENS_CONFIG: Record<ViewLens, {
  label: string;
  description: string;
  sections: Set<string>;
}> = {
  overview: {
    label: 'Overview',
    description: 'Jurisdiction dashboard — morning check for elected officials',
    sections: new Set([
      'local-identity', 'local-kpi-strip', 'warr-metrics', 'warr-analyze', 'warr-respond', 'warr-resolve',
      'map-grid', 'local-situation', 'local-quick-actions', 'disclaimer',
    ]),
  },
  briefing: {
    label: 'AI Briefing',
    description: 'AI-generated overnight summary and action items',
    sections: new Set([
      'insights', 'briefing-actions', 'briefing-changes', 'briefing-pulse',
      'briefing-stakeholder', 'local-constituent-tldr', 'disclaimer',
    ]),
  },
  'political-briefing': {
    label: 'Political Briefing',
    description: 'Talking points, funding optics, EJ exposure, and council agenda suggestions',
    sections: new Set([
      'pol-talking-points', 'pol-constituent-concerns', 'pol-funding-wins', 'pol-funding-risks',
      'pol-regulatory-deadlines', 'pol-ej-exposure', 'pol-media-ready-grades',
      'pol-peer-comparison', 'pol-council-agenda', 'disclaimer',
    ]),
  },
  'water-quality': {
    label: 'Water Quality',
    description: 'Local water quality grades, impairments, and trends',
    sections: new Set([
      'local-wq-grade', 'detail', 'top10', 'local-impairment-summary',
      'local-wq-trends', 'groundwater', 'disclaimer',
    ]),
  },
  infrastructure: {
    label: 'Infrastructure',
    description: 'Asset condition, CSO/SSO events, and capital planning',
    sections: new Set([
      'local-infra-condition', 'local-cso-sso', 'infra-capital', 'infra-construction',
      'infra-green', 'local-asset-age', 'disclaimer',
    ]),
  },
  compliance: {
    label: 'Compliance',
    description: 'Permits, violations, and enforcement actions',
    sections: new Set([
      'icis', 'sdwis', 'local-permit-status', 'local-violation-timeline',
      'local-enforcement-actions', 'fineavoidance', 'disclaimer',
    ]),
  },
  stormwater: {
    label: 'Stormwater / MS4',
    description: 'MS4 permit management, BMPs, MCMs, and receiving waters',
    sections: new Set([
      'local-ms4-identity', 'bmp-inventory', 'bmp-analytics', 'bmp-maintenance',
      'mcm-dashboard', 'rw-profiles', 'rw-impairment', 'nutrientcredits', 'disclaimer',
    ]),
  },
  'public-health': {
    label: 'Public Health',
    description: 'Drinking water systems, contaminants, and advisories',
    sections: new Set([
      'sdwis', 'ph-contaminants', 'local-dw-systems', 'local-pfas-proximity',
      'ph-advisories', 'disclaimer',
    ]),
  },
  funding: {
    label: 'Funding & Grants',
    description: 'Grant opportunities, USASpending, and funding timeline',
    sections: new Set([
      'grants', 'local-usaspending', 'fund-active', 'fund-srf',
      'local-match-requirements', 'grant-outcomes', 'local-funding-timeline', 'disclaimer',
    ]),
  },
  'ej-equity': {
    label: 'EJ & Equity',
    description: 'Environmental justice demographics, disparities, and Justice40',
    sections: new Set([
      'local-ej-summary', 'local-ej-demographics', 'local-ej-burden-map',
      'local-ej-water-disparities', 'local-j40-tracker', 'local-ej-recommendations', 'disclaimer',
    ]),
  },
  emergency: {
    label: 'Emergency',
    description: 'Active incidents, weather alerts, and response planning',
    sections: new Set([
      'alertfeed', 'disaster-active', 'local-nws-alerts', 'local-sentinel-events',
      'disaster-response', 'disaster-prep', 'resolution-planner', 'disclaimer',
    ]),
  },
  scorecard: {
    label: 'Scorecard',
    description: 'Overall score, category breakdown, and peer comparison',
    sections: new Set([
      'local-sc-overall', 'local-sc-categories', 'local-sc-trends',
      'local-sc-peer', 'local-sc-sla', 'disclaimer',
    ]),
  },
  reports: {
    label: 'Reports',
    description: 'Council reports, state filings, and public disclosures',
    sections: new Set([
      'exporthub', 'local-rpt-council', 'local-rpt-state-filing',
      'local-rpt-public-disclosure', 'local-rpt-annual', 'disclaimer',
    ]),
  },
};

// ─── Placeholder Card ────────────────────────────────────────────────────────
// Reusable mock-data section wrapper for scaffold

function PlaceholderSection({ title, subtitle, icon, accent = 'purple', children }: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardSection title={title} subtitle={subtitle} icon={icon} accent={accent}>
      <div className="space-y-3 pt-3">
        {children}
      </div>
    </DashboardSection>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LocalManagementCenter({ jurisdictionId, stateAbbr, onSelectRegion, onToggleDevMode }: Props) {
  const jurisdictionLabel = jurisdictionId === 'default' ? `${stateAbbr} Local Government` : jurisdictionId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // ── View Lens ──
  const [viewLens, setViewLens] = useLensParam<ViewLens>('overview');
  const lens = LENS_CONFIG[viewLens] ?? LENS_CONFIG['overview'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <div className="max-w-[1600px] mx-auto p-4 space-y-4">

      {/* ── HERO BANNER ── */}
      <HeroBanner role="local" onDoubleClick={() => onToggleDevMode?.()} />

      <LayoutEditor ccKey="Local">
      {({ sections, isEditMode, onToggleVisibility, onToggleCollapse, collapsedSections }) => {
        return (<>
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

          // ═══════════════════════════════════════════════════════════════════
          // OVERVIEW SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-identity': return DS(
            <PlaceholderSection title={`${jurisdictionLabel} — Jurisdiction Profile`} icon={<Building2 size={15} />} accent="purple">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatusCard title="Population" description="~185,000 residents" status="good" />
                <StatusCard title="Water Systems" description="3 public water systems" status="good" />
                <StatusCard title="MS4 Permit" description="Phase II — Active" status="good" />
                <StatusCard title="State Agency" description={`${stateAbbr} DEP/DEQ`} status="good" />
              </div>
            </PlaceholderSection>
          );

          case 'local-kpi-strip': return DS(
            <PlaceholderSection title="Key Performance Indicators" icon={<BarChart3 size={15} />} accent="purple">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Water Quality Grade', value: 'B+', color: 'text-emerald-700' },
                  { label: 'Compliance Rate', value: '94%', color: 'text-emerald-700' },
                  { label: 'Active Violations', value: '2', color: 'text-amber-700' },
                  { label: 'Grant Funding', value: '$4.2M', color: 'text-blue-700' },
                  { label: 'EJ Communities', value: '3 tracts', color: 'text-purple-700' },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                    <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{kpi.label}</p>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-situation': return DS(
            <PlaceholderSection title="Situation Summary" subtitle="What you need to know today" icon={<Info size={15} />} accent="purple">
              <StatusCard title="No Active Emergencies" description="All systems operating normally. Last incident resolved 12 days ago." status="good" />
              <StatusCard title="Permit Renewal Due" description="MS4 Phase II permit renewal due in 45 days — draft submitted to state." status="warning" />
              <StatusCard title="Boil Water Advisory" description="Lifted 3 days ago for Elm Street corridor. System cleared all tests." status="good" />
            </PlaceholderSection>
          );

          case 'local-quick-actions': return DS(
            <PlaceholderSection title="Quick Actions" icon={<Zap size={15} />} accent="purple">
              <div className="flex flex-wrap gap-2">
                {['Generate Council Briefing', 'Export Compliance Report', 'View Grant Deadlines', 'Check EJ Exposure', 'Run Scorecard'].map(action => (
                  <Badge key={action} variant="outline" className="px-3 py-1.5 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-colors">
                    {action}
                  </Badge>
                ))}
              </div>
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // BRIEFING SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-constituent-tldr': return DS(
            <PlaceholderSection title="Constituent TL;DR" subtitle="What residents are asking about" icon={<Users size={15} />} accent="purple">
              <StatusCard title="Lead Pipe Replacement" description="12 calls this week about lead service line inventory. EPA deadline is Oct 2027." status="warning" />
              <StatusCard title="Taste & Odor" description="Seasonal algal bloom reports from Lake district. Treatment plant adjusting activated carbon dose." status="warning" />
              <StatusCard title="Billing Questions" description="Rate increase FAQ published. 87% of callers satisfied after explanation." status="good" />
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // POLITICAL BRIEFING SECTIONS (the killer feature)
          // ═══════════════════════════════════════════════════════════════════

          case 'pol-talking-points': return DS(
            <PlaceholderSection title="Talking Points" subtitle="Auto-generated for council meetings" icon={<Megaphone size={15} />} accent="purple">
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-4 space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-purple-100 text-purple-800 shrink-0">Lead</Badge>
                    <p>&ldquo;Our jurisdiction has replaced 340 of 1,200 identified lead service lines — 28% complete, ahead of the national average of 18%.&rdquo;</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 shrink-0">Grant</Badge>
                    <p>&ldquo;We secured $2.1M in DWSRF funding this quarter for water main rehabilitation, leveraging a 20% local match.&rdquo;</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-blue-100 text-blue-800 shrink-0">Quality</Badge>
                    <p>&ldquo;Water quality testing shows zero MCL exceedances for the 8th consecutive quarter across all 3 public water systems.&rdquo;</p>
                  </div>
                </CardContent>
              </Card>
            </PlaceholderSection>
          );

          case 'pol-constituent-concerns': return DS(
            <PlaceholderSection title="Constituent Concerns" subtitle="Top issues by volume" icon={<Users size={15} />} accent="purple">
              <div className="space-y-2">
                {[
                  { issue: 'Lead service line replacement timeline', calls: 47, trend: '↑ 23%' },
                  { issue: 'Water rate increase explanation', calls: 31, trend: '↓ 8%' },
                  { issue: 'Stormwater flooding on Oak Ave', calls: 18, trend: '↑ 45%' },
                  { issue: 'PFAS in drinking water', calls: 12, trend: '— stable' },
                ].map(c => (
                  <div key={c.issue} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                    <span className="text-sm text-slate-700">{c.issue}</span>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{c.calls} contacts</Badge>
                      <span className="text-xs text-slate-500">{c.trend}</span>
                    </div>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'pol-funding-wins': return DS(
            <PlaceholderSection title="Funding Wins" subtitle="Recent awards and approvals" icon={<Banknote size={15} />} accent="emerald">
              <StatusCard title="$2.1M DWSRF Award" description="Drinking Water State Revolving Fund — water main rehabilitation project approved Jan 2026." status="good" />
              <StatusCard title="$850K EPA WIIN Grant" description="Water Infrastructure Improvements for the Nation — lead service line inventory and replacement." status="good" />
              <StatusCard title="$340K State 319 Grant" description="Nonpoint source pollution control for Deer Creek watershed — BMP installation." status="good" />
            </PlaceholderSection>
          );

          case 'pol-funding-risks': return DS(
            <PlaceholderSection title="Funding Risks" subtitle="Expiring or at-risk funding" icon={<AlertTriangle size={15} />} accent="amber">
              <StatusCard title="ARPA Funds Expiring" description="$1.2M remaining ARPA allocation must be obligated by Dec 2026. Currently $480K unobligated." status="warning" />
              <StatusCard title="SRF Match Shortfall" description="FY2027 SRF application requires $600K local match. Current reserve: $410K — $190K gap." status="critical" />
            </PlaceholderSection>
          );

          case 'pol-regulatory-deadlines': return DS(
            <PlaceholderSection title="Regulatory Deadlines" subtitle="Upcoming compliance milestones" icon={<Clock size={15} />} accent="amber">
              <div className="space-y-2">
                {[
                  { deadline: 'Mar 15, 2026', item: 'MS4 Annual Report due to state', daysLeft: 15, status: 'warning' as const },
                  { deadline: 'Jun 30, 2026', item: 'Lead Service Line Inventory submission', daysLeft: 122, status: 'good' as const },
                  { deadline: 'Oct 1, 2026', item: 'PFAS monitoring results due to EPA', daysLeft: 215, status: 'good' as const },
                  { deadline: 'Dec 31, 2026', item: 'ARPA fund obligation deadline', daysLeft: 306, status: 'warning' as const },
                ].map(d => (
                  <StatusCard key={d.item} title={`${d.deadline} — ${d.daysLeft} days`} description={d.item} status={d.status} />
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'pol-ej-exposure': return DS(
            <PlaceholderSection title="Environmental Justice Exposure" subtitle="Politically sensitive EJ indicators" icon={<Heart size={15} />} accent="purple">
              <StatusCard title="3 EJ Census Tracts" description="Tracts 240101, 240105, 240112 exceed 80th percentile on EJScreen composite index. Combined population: 14,200." status="warning" />
              <StatusCard title="Disproportionate Impact" description="Lead service lines are 3.2x more concentrated in EJ tracts vs. non-EJ areas. Prioritize replacement schedule." status="critical" />
              <StatusCard title="Justice40 Eligible" description="2 of 3 EJ tracts qualify for Justice40 benefits. $1.8M in additional funding potentially available." status="good" />
            </PlaceholderSection>
          );

          case 'pol-media-ready-grades': return DS(
            <PlaceholderSection title="Media-Ready Grades" subtitle="Simplified report card for press releases" icon={<Trophy size={15} />} accent="purple">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { category: 'Water Quality', grade: 'B+', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                  { category: 'Infrastructure', grade: 'C+', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
                  { category: 'Compliance', grade: 'A-', color: 'text-green-700 bg-green-50 border-green-200' },
                  { category: 'Equity', grade: 'B-', color: 'text-teal-700 bg-teal-50 border-teal-200' },
                ].map(g => (
                  <div key={g.category} className={`border rounded-xl p-4 text-center ${g.color}`}>
                    <p className="text-3xl font-bold">{g.grade}</p>
                    <p className="text-xs mt-1 font-medium">{g.category}</p>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'pol-peer-comparison': return DS(
            <PlaceholderSection title="Peer Comparison" subtitle="How you compare to similar jurisdictions" icon={<BarChart3 size={15} />} accent="purple">
              <div className="space-y-2">
                {[
                  { metric: 'Water Quality Score', you: 87, peer: 82, unit: '/100' },
                  { metric: 'Compliance Rate', you: 94, peer: 89, unit: '%' },
                  { metric: 'Infrastructure Grade', you: 77, peer: 74, unit: '/100' },
                  { metric: 'Grant $ Per Capita', you: 22.7, peer: 18.3, unit: '' },
                ].map(m => (
                  <div key={m.metric} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                    <span className="text-sm text-slate-700">{m.metric}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-purple-700">You: {m.you}{m.unit}</span>
                      <span className="text-sm text-slate-500">Peers: {m.peer}{m.unit}</span>
                      {m.you > m.peer ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Above</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800">Below</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'pol-council-agenda': return DS(
            <PlaceholderSection title="Council Agenda Suggestions" subtitle="Data-driven items for next meeting" icon={<Scale size={15} />} accent="purple">
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-4 space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-red-100 text-red-800 shrink-0">Urgent</Badge>
                    <p><strong>ARPA Fund Reallocation:</strong> $480K unobligated — propose allocation to lead service line replacement before Dec 2026 deadline.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-amber-100 text-amber-800 shrink-0">Action</Badge>
                    <p><strong>SRF Match Funding:</strong> Authorize $190K from capital reserve to close FY2027 SRF local match gap.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-blue-100 text-blue-800 shrink-0">Info</Badge>
                    <p><strong>Quarterly Water Quality Update:</strong> 8th consecutive quarter with zero MCL exceedances — recognition opportunity.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-purple-100 text-purple-800 shrink-0">Equity</Badge>
                    <p><strong>EJ Tract Prioritization:</strong> Present updated lead line replacement schedule prioritizing 3 EJ census tracts.</p>
                  </div>
                </CardContent>
              </Card>
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // WATER QUALITY SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-wq-grade': return DS(
            <PlaceholderSection title="Water Quality Grade" icon={<Waves size={15} />} accent="blue">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center">
                    <span className="text-3xl font-bold text-emerald-700">B+</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Overall Grade</p>
                </div>
                <div className="space-y-2 flex-1">
                  <StatusCard title="Surface Water" description="14 of 18 assessed waterbodies meeting standards (78%)" status="good" />
                  <StatusCard title="Groundwater" description="All 3 aquifer monitoring wells within normal parameters" status="good" />
                  <StatusCard title="Impairments" description="4 waterbodies on 303(d) list — bacteria (2), nutrients (1), sediment (1)" status="warning" />
                </div>
              </div>
            </PlaceholderSection>
          );

          case 'local-impairment-summary': return DS(
            <PlaceholderSection title="Impairment Summary" icon={<AlertCircle size={15} />} accent="amber">
              <div className="space-y-2">
                {[
                  { waterbody: 'Deer Creek', cause: 'E. coli bacteria', source: 'Agricultural runoff', status: 'TMDL in development' },
                  { waterbody: 'Mill Run', cause: 'E. coli bacteria', source: 'Aging sewer infrastructure', status: 'TMDL approved 2024' },
                  { waterbody: 'Lake Pleasant', cause: 'Total phosphorus', source: 'Urban stormwater', status: 'Under assessment' },
                  { waterbody: 'Elm Branch', cause: 'Total suspended solids', source: 'Construction activity', status: 'BMP installed 2025' },
                ].map(w => (
                  <div key={w.waterbody} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">{w.waterbody}</span>
                      <Badge variant="outline">{w.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{w.cause} — {w.source}</p>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-wq-trends': return DS(
            <PlaceholderSection title="Water Quality Trends" subtitle="5-year trajectory" icon={<TrendingUp size={15} />} accent="blue">
              <StatusCard title="Improving" description="Overall water quality index improved 4.2 points over 5 years (74.8 → 79.0). Bacteria levels declining in 3 of 4 impaired waterbodies." status="good" />
              <StatusCard title="Watch: Nutrients" description="Total phosphorus trending upward in Lake Pleasant (+0.8 mg/L/yr). Stormwater BMP effectiveness may need reassessment." status="warning" />
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // INFRASTRUCTURE SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-infra-condition': return DS(
            <PlaceholderSection title="Infrastructure Condition" icon={<Wrench size={15} />} accent="slate">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatusCard title="Water Mains" description="142 mi — 23% beyond useful life" status="warning" />
                <StatusCard title="Sewer Lines" description="98 mi — 15% needing rehab" status="warning" />
                <StatusCard title="Treatment Plant" description="12 MGD capacity — operating at 74%" status="good" />
                <StatusCard title="Storage Tanks" description="3 tanks — all inspected 2025" status="good" />
              </div>
            </PlaceholderSection>
          );

          case 'local-cso-sso': return DS(
            <PlaceholderSection title="CSO / SSO Events" subtitle="Combined & sanitary sewer overflows" icon={<AlertTriangle size={15} />} accent="amber">
              <StatusCard title="2 SSO Events (YTD)" description="Jan 15: 12,000 gal at Pump Station #7 (power failure). Feb 3: 800 gal at manhole MH-2201 (grease blockage)." status="warning" />
              <StatusCard title="0 CSO Events (YTD)" description="No combined sewer overflow events this year. Separation project 68% complete." status="good" />
            </PlaceholderSection>
          );

          case 'local-asset-age': return DS(
            <PlaceholderSection title="Asset Age Distribution" icon={<Clock size={15} />} accent="slate">
              <div className="space-y-2">
                {[
                  { range: '0–20 years', pct: 22, color: 'bg-emerald-500' },
                  { range: '20–40 years', pct: 35, color: 'bg-blue-500' },
                  { range: '40–60 years', pct: 28, color: 'bg-amber-500' },
                  { range: '60+ years', pct: 15, color: 'bg-red-500' },
                ].map(a => (
                  <div key={a.range} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-24">{a.range}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div className={`h-full ${a.color} rounded-full`} style={{ width: `${a.pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-10 text-right">{a.pct}%</span>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // COMPLIANCE SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-permit-status': return DS(
            <PlaceholderSection title="Permit Status" icon={<ShieldCheck size={15} />} accent="blue">
              <div className="space-y-2">
                {[
                  { permit: 'NPDES — Wastewater Discharge', id: 'MD0012345', status: 'Active', expiry: 'Sep 2027' },
                  { permit: 'MS4 Phase II', id: 'MDR100123', status: 'Renewal Pending', expiry: 'Apr 2026' },
                  { permit: 'Stormwater Construction General', id: 'MDR10-GP', status: 'Active', expiry: 'Dec 2027' },
                ].map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.permit}</p>
                      <p className="text-xs text-slate-500">{p.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === 'Active' ? 'default' : 'outline'} className={p.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 border-amber-200'}>
                        {p.status}
                      </Badge>
                      <span className="text-xs text-slate-500">Exp: {p.expiry}</span>
                    </div>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-violation-timeline': return DS(
            <PlaceholderSection title="Violation Timeline" icon={<AlertTriangle size={15} />} accent="amber">
              <div className="space-y-2">
                {[
                  { date: 'Feb 2026', type: 'Monitoring', desc: 'Late DMR submission — February report filed 3 days past due', severity: 'Minor' },
                  { date: 'Nov 2025', type: 'Effluent', desc: 'TSS exceedance — 42 mg/L vs 30 mg/L limit during storm event', severity: 'Moderate' },
                ].map(v => (
                  <StatusCard key={v.date + v.type} title={`${v.date} — ${v.type} (${v.severity})`} description={v.desc} status={v.severity === 'Minor' ? 'warning' : 'critical'} />
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-enforcement-actions': return DS(
            <PlaceholderSection title="Enforcement Actions" icon={<Shield size={15} />} accent="red">
              <StatusCard title="No Active Enforcement" description="No consent orders, penalties, or formal enforcement actions currently active. Last formal action closed Aug 2024." status="good" />
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // STORMWATER / MS4 SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-ms4-identity': return DS(
            <PlaceholderSection title="MS4 Permit Identity" icon={<CloudRain size={15} />} accent="amber">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatusCard title="Permit Type" description="Phase II Small MS4" status="good" />
                <StatusCard title="Urbanized Area" description="42.3 sq mi" status="good" />
                <StatusCard title="Outfalls" description="187 mapped outfalls" status="good" />
                <StatusCard title="MCM Status" description="6/6 programs active" status="good" />
              </div>
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // PUBLIC HEALTH SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-dw-systems': return DS(
            <PlaceholderSection title="Drinking Water Systems" icon={<Droplets size={15} />} accent="blue">
              <div className="space-y-2">
                {[
                  { name: 'Main Water District', pop: '145,000', source: 'Surface water', violations: 0 },
                  { name: 'North County Water', pop: '28,000', source: 'Groundwater', violations: 0 },
                  { name: 'Industrial Park WS', pop: '12,000', source: 'Purchased surface', violations: 1 },
                ].map(s => (
                  <div key={s.name} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.source} — Pop: {s.pop}</p>
                    </div>
                    <Badge className={s.violations === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                      {s.violations === 0 ? 'No violations' : `${s.violations} violation`}
                    </Badge>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-pfas-proximity': return DS(
            <PlaceholderSection title="PFAS Proximity" subtitle="Known or suspected PFAS sources near water supply" icon={<AlertCircle size={15} />} accent="red">
              <StatusCard title="2 Known Sources Within 3 mi" description="Former fire training facility (1.2 mi from Well #3) and industrial discharge site (2.8 mi from intake)." status="warning" />
              <StatusCard title="Monitoring Status" description="Quarterly PFAS sampling active since Q1 2025. All results below EPA MCLs (4 ppt PFOS, 4 ppt PFOA)." status="good" />
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // FUNDING SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-usaspending': return DS(
            <PlaceholderSection title="USASpending Awards" subtitle="Federal awards to jurisdiction" icon={<Banknote size={15} />} accent="emerald">
              <div className="space-y-2">
                {[
                  { program: 'DWSRF', amount: '$2.1M', year: '2026', agency: 'EPA' },
                  { program: 'WIIN Act', amount: '$850K', year: '2025', agency: 'EPA' },
                  { program: 'ARPA — Water', amount: '$3.4M', year: '2022', agency: 'Treasury' },
                  { program: 'FEMA BRIC', amount: '$420K', year: '2025', agency: 'FEMA' },
                ].map(a => (
                  <div key={a.program} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.program}</p>
                      <p className="text-xs text-slate-500">{a.agency} — {a.year}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-700">{a.amount}</span>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-match-requirements': return DS(
            <PlaceholderSection title="Match Requirements" subtitle="Local cost-share obligations" icon={<Banknote size={15} />} accent="amber">
              <StatusCard title="Total Match Required: $840K" description="DWSRF ($420K at 20%), WIIN ($170K at 20%), 319 Grant ($68K at 20%), FEMA BRIC ($182K at 25%)." status="warning" />
              <StatusCard title="Capital Reserve: $650K" description="Current reserve covers 77% of total match obligation. $190K gap for FY2027." status="warning" />
            </PlaceholderSection>
          );

          case 'grant-outcomes': return DS(
            <PlaceholderSection title="Grant Outcomes" subtitle="Performance on active grants" icon={<CheckCircle size={15} />} accent="emerald">
              <StatusCard title="On Track" description="DWSRF project: 340 of 1,200 lead lines replaced (28%). Milestone 2 complete. Expenditure rate: 62%." status="good" />
              <StatusCard title="Behind Schedule" description="319 Grant: BMP installation 45% complete vs 65% target. Contractor delay — revised timeline submitted." status="warning" />
            </PlaceholderSection>
          );

          case 'local-funding-timeline': return DS(
            <PlaceholderSection title="Funding Timeline" subtitle="Key dates for grants and budgets" icon={<Clock size={15} />} accent="blue">
              <div className="space-y-2">
                {[
                  { date: 'Mar 2026', event: 'DWSRF reimbursement request #4 due' },
                  { date: 'May 2026', event: 'FY2027 CWSRF application window opens' },
                  { date: 'Jul 2026', event: '319 Grant mid-term progress report' },
                  { date: 'Sep 2026', event: 'FEMA BRIC project closeout deadline' },
                  { date: 'Dec 2026', event: 'ARPA fund obligation deadline' },
                ].map(t => (
                  <div key={t.date} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                    <Badge variant="outline" className="shrink-0">{t.date}</Badge>
                    <span className="text-sm text-slate-700">{t.event}</span>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // EJ & EQUITY SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-ej-summary': return DS(
            <PlaceholderSection title="Environmental Justice Summary" icon={<Heart size={15} />} accent="purple">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatusCard title="EJ Tracts" description="3 of 28 census tracts (11%)" status="warning" />
                <StatusCard title="Affected Population" description="14,200 residents in EJ areas" status="warning" />
                <StatusCard title="Justice40 Eligible" description="2 tracts qualify for J40" status="good" />
              </div>
            </PlaceholderSection>
          );

          case 'local-ej-demographics': return DS(
            <PlaceholderSection title="EJ Demographics" subtitle="Demographic breakdown of EJ census tracts" icon={<Users size={15} />} accent="purple">
              <div className="space-y-2">
                {[
                  { tract: '240101', pop: '5,200', minority: '72%', poverty: '28%', linguistic: '15%' },
                  { tract: '240105', pop: '4,800', minority: '65%', poverty: '24%', linguistic: '12%' },
                  { tract: '240112', pop: '4,200', minority: '58%', poverty: '31%', linguistic: '8%' },
                ].map(t => (
                  <div key={t.tract} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">Tract {t.tract} — Pop: {t.pop}</p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs text-slate-500">Minority: {t.minority}</span>
                      <span className="text-xs text-slate-500">Poverty: {t.poverty}</span>
                      <span className="text-xs text-slate-500">Linguistic isolation: {t.linguistic}</span>
                    </div>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-ej-burden-map': return DS(
            <PlaceholderSection title="Environmental Burden Map" icon={<MapPin size={15} />} accent="purple">
              <div className="bg-slate-100 border border-slate-200 rounded-xl h-48 flex items-center justify-center">
                <p className="text-sm text-slate-500">EJScreen burden map — placeholder for interactive map integration</p>
              </div>
            </PlaceholderSection>
          );

          case 'local-ej-water-disparities': return DS(
            <PlaceholderSection title="Water Quality Disparities" subtitle="EJ tracts vs jurisdiction average" icon={<Waves size={15} />} accent="purple">
              <StatusCard title="Lead Service Lines" description="EJ tracts have 3.2x higher concentration of lead service lines than non-EJ areas." status="critical" />
              <StatusCard title="Water Main Breaks" description="1.8x more frequent in EJ tracts due to older infrastructure (avg age: 62 years vs 38 years)." status="warning" />
              <StatusCard title="Response Time" description="Average emergency response 12 min in EJ tracts vs 8 min jurisdiction-wide." status="warning" />
            </PlaceholderSection>
          );

          case 'local-j40-tracker': return DS(
            <PlaceholderSection title="Justice40 Tracker" subtitle="Covered federal programs" icon={<Scale size={15} />} accent="purple">
              <StatusCard title="$1.8M Potentially Available" description="2 qualifying tracts eligible under DWSRF, CWSRF, and weatherization programs. Application status: 1 submitted, 1 in draft." status="good" />
            </PlaceholderSection>
          );

          case 'local-ej-recommendations': return DS(
            <PlaceholderSection title="EJ Recommendations" icon={<Sparkles size={15} />} accent="purple">
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-4 space-y-2 text-sm">
                  <p><strong>1.</strong> Prioritize lead service line replacement in tracts 240101 and 240105 (highest burden scores).</p>
                  <p><strong>2.</strong> Apply for Justice40-designated DWSRF supplemental funding for tract 240112.</p>
                  <p><strong>3.</strong> Establish community advisory board with EJ tract representation for capital project prioritization.</p>
                  <p><strong>4.</strong> Publish bilingual water quality reports (Spanish/English) for tracts with &gt;10% linguistic isolation.</p>
                </CardContent>
              </Card>
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // EMERGENCY SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-nws-alerts': return DS(
            <PlaceholderSection title="NWS Weather Alerts" icon={<CloudRain size={15} />} accent="amber">
              <StatusCard title="No Active Alerts" description="No NWS weather warnings, watches, or advisories for jurisdiction area." status="good" />
            </PlaceholderSection>
          );

          case 'local-sentinel-events': return DS(
            <PlaceholderSection title="Sentinel Events" subtitle="Early warning indicators" icon={<Activity size={15} />} accent="amber">
              <StatusCard title="Turbidity Spike" description="Intake monitor detected 8.2 NTU spike at 03:00 AM — returned to 1.4 NTU by 05:30. Auto-logged, no action required." status="warning" />
              <StatusCard title="Pressure Drop" description="Zone 3 pressure dropped below 30 PSI for 4 minutes during peak demand (6:45 PM). Normal range restored." status="warning" />
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // SCORECARD SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-sc-overall': return DS(
            <PlaceholderSection title="Overall Score" icon={<Trophy size={15} />} accent="purple">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center">
                    <span className="text-3xl font-bold text-emerald-700">82</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">out of 100</p>
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  <p>Ranking: <strong className="text-purple-700">14th of 62</strong> similar jurisdictions</p>
                  <p>Trend: <strong className="text-emerald-700">↑ 3.5 pts</strong> over 12 months</p>
                  <p>National percentile: <strong>77th</strong></p>
                </div>
              </div>
            </PlaceholderSection>
          );

          case 'local-sc-categories': return DS(
            <PlaceholderSection title="Category Breakdown" icon={<BarChart3 size={15} />} accent="purple">
              <div className="space-y-2">
                {[
                  { cat: 'Water Quality', score: 87, max: 100, color: 'bg-emerald-500' },
                  { cat: 'Compliance', score: 91, max: 100, color: 'bg-green-500' },
                  { cat: 'Infrastructure', score: 72, max: 100, color: 'bg-amber-500' },
                  { cat: 'Public Health', score: 88, max: 100, color: 'bg-blue-500' },
                  { cat: 'Environmental Justice', score: 68, max: 100, color: 'bg-purple-500' },
                  { cat: 'Emergency Preparedness', score: 85, max: 100, color: 'bg-teal-500' },
                ].map(c => (
                  <div key={c.cat} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-40">{c.cat}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.score}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-10 text-right">{c.score}</span>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-sc-trends': return DS(
            <PlaceholderSection title="Scorecard Trends" subtitle="12-month trajectory" icon={<TrendingUp size={15} />} accent="purple">
              <StatusCard title="Improving Categories" description="Water Quality (+4.2), Compliance (+2.8), Public Health (+1.5)" status="good" />
              <StatusCard title="Declining Categories" description="Infrastructure (-1.2) — driven by aging asset backlog" status="warning" />
            </PlaceholderSection>
          );

          case 'local-sc-peer': return DS(
            <PlaceholderSection title="Peer Comparison" icon={<BarChart3 size={15} />} accent="purple">
              <StatusCard title="Above Peer Average" description="Your score (82) exceeds the peer group average (76) by 6 points. Strengths: compliance and public health." status="good" />
              <StatusCard title="Gap Area" description="Infrastructure score (72) is 5 points below peer average (77). Leading peer: Greenfield County (89)." status="warning" />
            </PlaceholderSection>
          );

          case 'local-sc-sla': return DS(
            <PlaceholderSection title="SLA Metrics" subtitle="Service level agreement performance" icon={<Gauge size={15} />} accent="purple">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { metric: 'Boil water advisory response', target: '<2 hrs', actual: '1.4 hrs', met: true },
                  { metric: 'Complaint resolution', target: '<48 hrs', actual: '36 hrs', met: true },
                  { metric: 'DMR submission', target: 'By 15th', actual: 'Avg: 12th', met: true },
                  { metric: 'Emergency notification', target: '<1 hr', actual: '0.8 hrs', met: true },
                  { metric: 'Permit renewal filing', target: '90 days early', actual: '45 days', met: false },
                  { metric: 'EJ community outreach', target: 'Quarterly', actual: 'Semi-annual', met: false },
                ].map(s => (
                  <div key={s.metric} className={`border rounded-lg p-3 ${s.met ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <p className="text-xs font-medium text-slate-700">{s.metric}</p>
                    <p className="text-sm font-bold mt-1">{s.actual} <span className="text-xs text-slate-500">/ {s.target}</span></p>
                    <Badge className={`mt-1 ${s.met ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {s.met ? 'Met' : 'Not Met'}
                    </Badge>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // REPORTS SECTIONS
          // ═══════════════════════════════════════════════════════════════════

          case 'local-rpt-council': return DS(
            <PlaceholderSection title="Council Report" subtitle="Auto-generated briefing for elected officials" icon={<FileText size={15} />} accent="purple">
              <Card className="border-purple-200">
                <CardContent className="pt-4 text-sm text-slate-600">
                  <p>One-page summary combining water quality grades, compliance status, funding wins, and EJ exposure for council presentation. Includes media-ready grades and recommended agenda items.</p>
                  <Badge variant="outline" className="mt-3 cursor-pointer hover:bg-purple-50">Generate Council Briefing PDF</Badge>
                </CardContent>
              </Card>
            </PlaceholderSection>
          );

          case 'local-rpt-state-filing': return DS(
            <PlaceholderSection title="State Filing Report" icon={<FileText size={15} />} accent="blue">
              <StatusCard title="MS4 Annual Report" description="Due Mar 15, 2026. Draft 85% complete — MCM narratives need final review." status="warning" />
              <StatusCard title="CCR" description="Consumer Confidence Report due Jul 1, 2026. Data compilation in progress." status="good" />
            </PlaceholderSection>
          );

          case 'local-rpt-public-disclosure': return DS(
            <PlaceholderSection title="Public Disclosure Report" icon={<FileText size={15} />} accent="blue">
              <StatusCard title="Water Quality Data" description="Public dashboard updated weekly. Last update: Feb 26, 2026." status="good" />
              <StatusCard title="Annual Performance" description="FY2025 annual report published Jan 15, 2026. 342 downloads." status="good" />
            </PlaceholderSection>
          );

          case 'local-rpt-annual': return DS(
            <PlaceholderSection title="Annual Report" icon={<FileText size={15} />} accent="blue">
              <Card className="border-slate-200">
                <CardContent className="pt-4 text-sm text-slate-600">
                  <p>Comprehensive annual report combining all lenses — water quality, compliance, infrastructure, funding, and equity — into a single document for public distribution and state filing.</p>
                  <Badge variant="outline" className="mt-3 cursor-pointer hover:bg-blue-50">Generate Annual Report</Badge>
                </CardContent>
              </Card>
            </PlaceholderSection>
          );

          // ═══════════════════════════════════════════════════════════════════
          // SHARED / REUSED SECTIONS (rendered as placeholders for scaffold)
          // ═══════════════════════════════════════════════════════════════════

          case 'warr-metrics':
          case 'warr-analyze':
          case 'warr-respond':
          case 'warr-resolve':
            return DS(
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                {section.label} — WARR zone placeholder (shared component)
              </div>
            );

          case 'map-grid': return DS(
            <div className="bg-slate-100 border border-slate-200 rounded-xl h-64 flex items-center justify-center">
              <p className="text-sm text-slate-500">Map & Waterbody List — placeholder for MapboxMapShell integration</p>
            </div>
          );

          case 'insights': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              AI Insights Engine — placeholder (shared component)
            </div>
          );

          case 'briefing-actions':
          case 'briefing-changes':
          case 'briefing-pulse':
          case 'briefing-stakeholder':
            return DS(
              <PlaceholderSection title={section.label} icon={<Sparkles size={15} />} accent="purple">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                  {section.label} — AI briefing placeholder
                </div>
              </PlaceholderSection>
            );

          case 'detail': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              Waterbody Detail — placeholder (shared component)
            </div>
          );

          case 'top10': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              Top 5 Worsening / Improving — placeholder (shared component)
            </div>
          );

          case 'groundwater': return DS(
            <div id="section-groundwater">
              <NwisGwPanel
                state={stateAbbr}
                compactMode={false}
              />
            </div>
          );

          case 'icis': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              NPDES Compliance & Enforcement (ICIS) — placeholder (shared component)
            </div>
          );

          case 'sdwis': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              Drinking Water (SDWIS) — placeholder (shared component)
            </div>
          );

          case 'fineavoidance': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              Fine Avoidance Calculator — placeholder (shared component)
            </div>
          );

          case 'infra-capital':
          case 'infra-construction':
          case 'infra-green':
            return DS(
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                {section.label} — placeholder (shared component)
              </div>
            );

          case 'bmp-inventory':
          case 'bmp-analytics':
          case 'bmp-maintenance':
          case 'mcm-dashboard':
          case 'rw-profiles':
          case 'rw-impairment':
          case 'nutrientcredits':
            return DS(
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                {section.label} — stormwater placeholder (shared with MS4)
              </div>
            );

          case 'ph-contaminants':
          case 'ph-advisories':
            return DS(
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                {section.label} — public health placeholder (shared component)
              </div>
            );

          case 'grants': return DS(
            <GrantOpportunityMatcher
              regionId={`${stateAbbr.toLowerCase()}_${jurisdictionId}`}
              removalEfficiencies={{ TSS: 85, TN: 40, TP: 50, bacteria: 80, DO: 25 }}
              alertsCount={0}
              userRole="Local"
              stateAbbr={stateAbbr}
            />
          );

          case 'fund-active': return DS(
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Active Grants & Funding
                </CardTitle>
                <CardDescription>Currently active grants and funding sources for municipal programs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { grant: 'EPA 319(h) NPS Grant', amount: '$450,000', period: '2023-2026', remaining: '$180,000', status: 'Active' },
                    { grant: 'State SRF Green Infrastructure Loan', amount: '$2.1M', period: '2024-2029', remaining: '$1.8M', status: 'Active' },
                    { grant: 'FEMA BRIC Stormwater Resilience', amount: '$800,000', period: '2024-2027', remaining: '$650,000', status: 'Active' },
                    { grant: 'State Chesapeake Bay Trust', amount: '$125,000', period: '2025-2026', remaining: '$125,000', status: 'New' },
                  ].map((g, i) => (
                    <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                      <span className="text-slate-700 font-medium">{g.grant}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">{g.amount}</span>
                        <span className="text-slate-400">{g.period}</span>
                        <span className="text-slate-500">Rem: {g.remaining}</span>
                        <Badge variant="outline" className={`text-[9px] ${g.status === 'New' ? 'border-blue-300 text-blue-700' : 'border-green-300 text-green-700'}`}>{g.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-3 italic">Data source: Grants management system, SAM.gov, state funding portals</p>
              </CardContent>
            </Card>
          );

          case 'fund-srf': return DS(
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-blue-600" />
                  SRF Program
                </CardTitle>
                <CardDescription>State Revolving Fund loans received, terms, and repayment status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Capitalization (State Level)</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'CWSRF Cap Grant', value: '$42M', bg: 'bg-blue-50 border-blue-200' },
                    { label: 'DWSRF Cap Grant', value: '$28M', bg: 'bg-sky-50 border-sky-200' },
                    { label: 'BIL Supplement', value: '$18M', bg: 'bg-green-50 border-green-200' },
                    { label: 'Loan Repayments', value: '$31M/yr', bg: 'bg-slate-50 border-slate-200' },
                  ].map(k => (
                    <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                      <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 mt-4">Municipal Pass-Through</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'SRF Loans Received', value: '3', bg: 'bg-green-50 border-green-200' },
                    { label: 'Outstanding Balance', value: '$8.2M', bg: 'bg-blue-50 border-blue-200' },
                    { label: 'Interest Rate', value: '1.5%', bg: 'bg-slate-50 border-slate-200' },
                    { label: 'Repayment Status', value: 'Current', bg: 'bg-emerald-50 border-emerald-200' },
                  ].map(k => (
                    <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                      <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2 italic">Data source: State SRF program, municipal loan records</p>
              </CardContent>
            </Card>
          );

          case 'alertfeed': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              Alert Feed — placeholder (shared component)
            </div>
          );

          case 'disaster-active':
          case 'disaster-response':
          case 'disaster-prep':
            return DS(
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                {section.label} — emergency placeholder (shared component)
              </div>
            );

          case 'resolution-planner': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              Resolution Plan Workspace — placeholder (shared component)
            </div>
          );

          case 'exporthub': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              Data Export Hub — placeholder (shared component)
            </div>
          );

          // ── Disclaimer ──
          case 'disclaimer': return DS(<PlatformDisclaimer />);

          default: return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              {section.label} — section placeholder
            </div>
          );
        }
      })}

      </div>
      </>);
      }}
      </LayoutEditor>

      </div>
    </div>
  );
}
