'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrandedPrintBtn } from '@/lib/brandedPrint';
import {
  Droplets, CloudRain, FlaskConical, Factory, Mountain,
  ChevronDown, Bell, Scale, AlertTriangle, FileText,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium';

type Pillar = 'Surface Water' | 'Stormwater' | 'Drinking Water' | 'Wastewater' | 'Groundwater';

interface KeyNumber {
  label: string;
  value: string;
}

interface Rule {
  id: number;
  title: string;
  agency: string;
  status: string;
  statusColor: string;
  date: string;
  deadline: string | null;
  pillars: Pillar[];
  summary: string;
  impact: string;
  pinConnection: string;
  assessmentUnits: number;
  statesAffected: number;
  severity: Severity;
  keyNumbers: KeyNumber[];
  commentPeriod: boolean;
}

interface PillarStyle {
  bg: string;
  text: string;
  border: string;
  icon: React.ReactNode;
}

interface SeverityStyle {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const rules: Rule[] = [
  {
    id: 1,
    title: 'PFAS National Primary Drinking Water Regulation',
    agency: 'EPA',
    status: 'Final Rule',
    statusColor: '#2E7D32',
    date: 'Effective 2024',
    deadline: null,
    pillars: ['Drinking Water', 'Groundwater'],
    summary:
      'Sets enforceable Maximum Contaminant Levels for 6 PFAS compounds. First-ever federal drinking water limits for PFAS.',
    impact:
      'Affects 66,000+ public water systems. Utilities must monitor, treat, and report. Compliance deadline: 2029.',
    pinConnection:
      'PIN tracks PFAS detections across 12,400+ monitoring stations. Utility command center auto-flags systems exceeding new MCLs.',
    assessmentUnits: 8420,
    statesAffected: 50,
    severity: 'critical',
    keyNumbers: [
      { label: 'MCL (PFOA/PFOS)', value: '4 ppt' },
      { label: 'Systems affected', value: '66,000+' },
      { label: 'Compliance deadline', value: '2029' },
    ],
    commentPeriod: false,
  },
  {
    id: 2,
    title: 'Revised Definition of WOTUS',
    agency: 'EPA / Army Corps',
    status: 'Proposed Rule',
    statusColor: '#E65100',
    date: '2024\u20132025',
    deadline: 'Comment period open',
    pillars: ['Surface Water', 'Stormwater', 'Groundwater'],
    summary:
      'Redefines jurisdictional waters under the Clean Water Act following Sackett v. EPA. Narrows federal authority over wetlands and ephemeral streams.',
    impact:
      'Affects CWA Section 404 permits, wetland delineation, and MS4 jurisdiction boundaries nationwide. Could remove federal protections from millions of acres of wetlands.',
    pinConnection:
      'PIN maps every ATTAINS assessment unit to its jurisdictional status. WOTUS changes will reclassify thousands of units \u2014 PIN tracks the before/after.',
    assessmentUnits: 142000,
    statesAffected: 50,
    severity: 'critical',
    keyNumbers: [
      { label: 'Wetland acres at risk', value: '~51M' },
      { label: 'Assessment units affected', value: '142K' },
      { label: 'Status', value: 'In flux' },
    ],
    commentPeriod: true,
  },
  {
    id: 3,
    title: 'Lead and Copper Rule Improvements (LCRI)',
    agency: 'EPA',
    status: 'Final Rule',
    statusColor: '#2E7D32',
    date: '2024',
    deadline: null,
    pillars: ['Drinking Water'],
    summary:
      'Requires complete lead service line replacement within 10 years. Action level lowered from 15 ppb to 10 ppb.',
    impact:
      'Approximately 9.2 million lead service lines nationwide. Utilities must inventory, notify customers, and replace all lead lines.',
    pinConnection:
      "PIN's utility command center tracks lead/copper monitoring data and flags exceedances against the new 10 ppb action level.",
    assessmentUnits: 3200,
    statesAffected: 50,
    severity: 'high',
    keyNumbers: [
      { label: 'New action level', value: '10 ppb' },
      { label: 'Lead lines to replace', value: '9.2M' },
      { label: 'Timeline', value: '10 years' },
    ],
    commentPeriod: false,
  },
  {
    id: 4,
    title: 'CWA Section 401 Certification Rule',
    agency: 'EPA',
    status: 'Final Rule',
    statusColor: '#2E7D32',
    date: '2023',
    deadline: null,
    pillars: ['Surface Water', 'Stormwater'],
    summary:
      'Restores state and tribal authority over water quality certifications for federal permits, reversing 2020 narrowing.',
    impact:
      'States can now condition or deny federal permits (dredge/fill, NPDES, hydropower) based on water quality concerns. Significant for pipeline and infrastructure projects.',
    pinConnection:
      "PIN's state command center tracks 401 certifications alongside 303(d) impairments \u2014 showing where state authority intersects with listed waterbodies.",
    assessmentUnits: 56000,
    statesAffected: 50,
    severity: 'medium',
    keyNumbers: [
      { label: 'Authority restored', value: 'States + Tribes' },
      { label: 'Permit types affected', value: '404, NPDES' },
      { label: 'Effective', value: '2023' },
    ],
    commentPeriod: false,
  },
  {
    id: 5,
    title: 'Nutrient Pollution Numeric Criteria',
    agency: 'EPA',
    status: 'Guidance',
    statusColor: '#2E5984',
    date: 'Ongoing',
    deadline: null,
    pillars: ['Surface Water', 'Drinking Water', 'Groundwater'],
    summary:
      'EPA recommending states adopt numeric nutrient criteria (nitrogen and phosphorus) instead of narrative standards. Currently 22 states have adopted.',
    impact:
      "Numeric criteria make impairment determinations objective \u2014 a waterbody either meets the number or it doesn't. Dramatically affects 303(d) listing and TMDL development.",
    pinConnection:
      "PIN's grading engine already applies parameter-specific thresholds. As states adopt numeric criteria, PIN updates grades automatically \u2014 no manual reconfiguration.",
    assessmentUnits: 280000,
    statesAffected: 28,
    severity: 'high',
    keyNumbers: [
      { label: 'States adopted', value: '22 of 50' },
      { label: 'Key params', value: 'N & P' },
      { label: 'Impact', value: '303(d) listings' },
    ],
    commentPeriod: false,
  },
  {
    id: 6,
    title: 'Stormwater General Permit (MSGP) Reissuance',
    agency: 'EPA',
    status: 'Draft',
    statusColor: '#9E9E9E',
    date: '2025 expected',
    deadline: 'Draft expected Q2 2025',
    pillars: ['Stormwater'],
    summary:
      'Updates Multi-Sector General Permit for industrial stormwater. New benchmark monitoring requirements and technology-based limits expected.',
    impact:
      'Affects ~100,000 industrial facilities with stormwater discharge. New monitoring benchmarks could trigger corrective action requirements.',
    pinConnection:
      "PIN's MS4 command center tracks industrial stormwater alongside municipal permits \u2014 showing cumulative pollutant loading from all sources in a jurisdiction.",
    assessmentUnits: 18000,
    statesAffected: 50,
    severity: 'medium',
    keyNumbers: [
      { label: 'Facilities affected', value: '~100K' },
      { label: 'New benchmarks', value: 'Pending' },
      { label: 'Expected', value: 'Q2 2025' },
    ],
    commentPeriod: false,
  },
  {
    id: 7,
    title: 'Chesapeake Bay TMDL 2025 Milestone Assessment',
    agency: 'EPA Region 3',
    status: 'Assessment',
    statusColor: '#E65100',
    date: '2025\u20132026',
    deadline: 'Final assessment 2026',
    pillars: ['Surface Water', 'Stormwater', 'Wastewater'],
    summary:
      'EPA evaluating whether 7 Bay jurisdictions met 2025 pollution reduction targets. Backstop federal actions possible for non-compliant states.',
    impact:
      '59% of nitrogen goal met, 92% phosphorus, 100% sediment as of 2024. States that miss targets face expanded permit coverage and redirected grants.',
    pinConnection:
      "PIN tracks all 92 Chesapeake Bay tidal segments, models pollutant loads by jurisdiction, and forecasts compliance gaps before EPA's assessment deadline.",
    assessmentUnits: 92,
    statesAffected: 7,
    severity: 'critical',
    keyNumbers: [
      { label: 'N goal met', value: '59%' },
      { label: 'P goal met', value: '92%' },
      { label: 'Jurisdictions', value: '7' },
    ],
    commentPeriod: false,
  },
];

const PILLAR_STYLES: Record<Pillar, PillarStyle> = {
  'Surface Water': {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: <Droplets className="w-3 h-3" />,
  },
  Stormwater: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    icon: <CloudRain className="w-3 h-3" />,
  },
  'Drinking Water': {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    icon: <FlaskConical className="w-3 h-3" />,
  },
  Wastewater: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: <Factory className="w-3 h-3" />,
  },
  Groundwater: {
    bg: 'bg-stone-100',
    text: 'text-stone-700',
    border: 'border-stone-300',
    icon: <Mountain className="w-3 h-3" />,
  },
};

const PILLAR_INLINE_COLORS: Record<Pillar, { bg: string; text: string; border: string }> = {
  'Surface Water': { bg: '#E3F2FD', text: '#1565C0', border: '#90CAF9' },
  Stormwater: { bg: '#FFF3E0', text: '#E65100', border: '#FFCC02' },
  'Drinking Water': { bg: '#E8F5E9', text: '#2E7D32', border: '#A5D6A7' },
  Wastewater: { bg: '#F3E5F5', text: '#7B1FA2', border: '#CE93D8' },
  Groundwater: { bg: '#EFEBE9', text: '#5D4037', border: '#BCAAA4' },
};

const SEVERITY_STYLES: Record<Severity, SeverityStyle> = {
  critical: { label: 'Critical Impact', bg: '#FDE8E8', text: '#C62828', dot: '#C62828' },
  high: { label: 'High Impact', bg: '#FFF3E0', text: '#E65100', dot: '#E65100' },
  medium: { label: 'Moderate', bg: '#E3F2FD', text: '#1565C0', dot: '#1565C0' },
};

const ALL_PILLARS: Pillar[] = ['Surface Water', 'Stormwater', 'Drinking Water', 'Wastewater', 'Groundwater'];
const STATUS_OPTIONS = ['Final Rule', 'Proposed Rule', 'Draft', 'Guidance', 'Assessment'] as const;

// ── Sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const c = SEVERITY_STYLES[severity];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

function PillarTag({ name }: { name: Pillar }) {
  const style = PILLAR_STYLES[name];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}
    >
      {style.icon}
      {name}
    </span>
  );
}

function StatCard({
  value,
  label,
  sub,
  accent,
}: {
  value: string | number;
  label: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
      <div className="text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
        {label}
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

function RuleCard({
  rule,
  isExpanded,
  onToggle,
}: {
  rule: Rule;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${
        rule.commentPeriod
          ? 'border-amber-300 bg-amber-50/30'
          : 'border-slate-200 bg-white'
      } ${isExpanded ? 'shadow-lg' : 'hover:shadow-md'}`}
    >
      <button onClick={onToggle} className="w-full text-left p-5 focus:outline-none">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white"
                style={{ backgroundColor: rule.statusColor }}
              >
                {rule.status}
              </span>
              <span className="text-xs text-slate-400 font-medium">{rule.agency}</span>
              <span className="text-xs text-slate-400">&middot;</span>
              <span className="text-xs text-slate-400">{rule.date}</span>
              {rule.commentPeriod && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Comment Period Open
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">{rule.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{rule.summary}</p>
            <div className="flex gap-1.5 flex-wrap mt-3">
              {rule.pillars.map((p) => (
                <PillarTag key={p} name={p} />
              ))}
              <SeverityBadge severity={rule.severity} />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex gap-3 mb-2">
              {rule.keyNumbers.slice(0, 2).map((kn, i) => (
                <div key={i} className="text-right">
                  <div className="text-sm font-bold text-slate-900">{kn.value}</div>
                  <div className="text-xs text-slate-400">{kn.label}</div>
                </div>
              ))}
            </div>
            <ChevronDown
              className={`w-5 h-5 mx-auto text-slate-300 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 px-5 pb-5">
          {/* Key numbers grid */}
          <div className="grid grid-cols-3 gap-3 mt-4 mb-4">
            {rule.keyNumbers.map((kn, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-slate-900">{kn.value}</div>
                <div className="text-xs text-slate-500">{kn.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {/* Operational Impact */}
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Operational Impact
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{rule.impact}</p>
            </div>

            {/* PIN Connection */}
            <div
              className="rounded-lg p-4"
              style={{
                backgroundColor: '#EBF5FB',
                borderLeft: '3px solid #2E5984',
              }}
            >
              <div
                className="text-xs font-bold uppercase tracking-wide mb-1"
                style={{ color: '#1B3A5C' }}
              >
                How PIN Tracks This
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#2E5984' }}>
                {rule.pinConnection}
              </p>
            </div>

            {/* Assessment Units + States footer */}
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-slate-400">Assessment Units</div>
                  <div className="text-sm font-bold text-slate-900">
                    {rule.assessmentUnits.toLocaleString()}
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <div className="text-xs text-slate-400">States Affected</div>
                  <div className="text-sm font-bold text-slate-900">{rule.statesAffected}</div>
                </div>
              </div>
              <button
                className="px-3 py-1.5 rounded text-xs font-semibold text-white transition-colors"
                style={{ backgroundColor: '#1B3A5C' }}
              >
                View in PIN Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function PolicyTracker() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pillarFilter, setPillarFilter] = useState<Pillar | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(
    () =>
      rules.filter((r) => {
        if (pillarFilter !== 'all' && !r.pillars.includes(pillarFilter)) return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        return true;
      }),
    [pillarFilter, statusFilter],
  );

  const commentOpen = rules.filter((r) => r.commentPeriod).length;
  const criticalCount = rules.filter((r) => r.severity === 'critical').length;
  const totalAU = rules.reduce((s, r) => s + r.assessmentUnits, 0);

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white">
      <CardHeader id="section-policy-tracker" className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <CardTitle className="text-base font-extrabold text-slate-800">
              Policy &amp; Regulatory Tracker
            </CardTitle>
            <Scale className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            {commentOpen > 0 && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-bold animate-pulse"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />
                {commentOpen} Comment Period{commentOpen > 1 ? 's' : ''} Open
              </Badge>
            )}
            <BrandedPrintBtn
              sectionId="policy-tracker"
              title="Policy & Regulatory Tracker"
              subtitle="Active and proposed federal rules affecting water quality programs"
            />
          </div>
        </div>
        <CardDescription className="text-xs text-slate-500 mt-1">
          Active and proposed federal rules affecting water quality programs across all five pillars
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── KPI Strip ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            value={rules.length}
            label="Active Rules Tracked"
            sub="Federal level"
            accent="#4A90D9"
          />
          <StatCard
            value={criticalCount}
            label="Critical Impact"
            sub="Immediate action needed"
            accent="#EF5350"
          />
          <StatCard
            value={totalAU.toLocaleString()}
            label="Assessment Units Affected"
            sub="Across tracked rules"
            accent="#66BB6A"
          />
          <StatCard value="5" label="Pillars Impacted" sub="All water domains" accent="#FFA726" />
        </div>

        {/* ── Filter Bar ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Filter:</span>

          {/* Pillar filters */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setPillarFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                pillarFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Pillars
            </button>
            {ALL_PILLARS.map((p) => {
              const c = PILLAR_INLINE_COLORS[p];
              const active = pillarFilter === p;
              return (
                <button
                  key={p}
                  onClick={() => setPillarFilter(active ? 'all' : p)}
                  className="px-2.5 py-1 rounded text-xs font-medium transition-colors border"
                  style={{
                    backgroundColor: active ? c.text : c.bg,
                    color: active ? 'white' : c.text,
                    borderColor: active ? c.text : c.border,
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Status filters */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Status
            </button>
            {STATUS_OPTIONS.map((s) => {
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(active ? 'all' : s)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    active
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Rules List ───────────────────────────────────────────────── */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              No rules match the current filters.
            </div>
          )}
          {filtered.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              isExpanded={expandedId === rule.id}
              onToggle={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
            />
          ))}

          {/* ── Regulatory Change Alert CTA ──────────────────────────── */}
          <div
            className="rounded-lg p-4 mt-4"
            style={{ background: 'linear-gradient(135deg, #1B3A5C, #2E5984)' }}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">Regulatory Change Alerts</div>
                <p className="text-xs text-blue-200">
                  Get notified when rules change status, comment periods open, or new regulations
                  affect your permits. PIN monitors the Federal Register daily.
                </p>
              </div>
              <button
                className="shrink-0 px-4 py-2 bg-white text-sm font-bold rounded transition-colors"
                style={{ color: '#1B3A5C' }}
              >
                Enable Alerts
              </button>
            </div>
          </div>

          {/* ── Source Footer ─────────────────────────────────────────── */}
          <div className="pt-3 text-xs text-slate-400 space-y-1">
            <p>
              <span className="font-semibold text-slate-500">Data Sources:</span> Federal Register
              &middot; EPA.gov &middot; USGS &middot; Congress.gov &middot; Chesapeake Bay Program
            </p>
            <p>
              Regulatory tracking is informational only. Always verify with primary agency sources
              for compliance decisions. Rule status reflects last known update as of the date shown.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
