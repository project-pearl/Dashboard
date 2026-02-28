'use client';

import React, { Suspense, useState } from 'react';
import { DashboardSection } from '@/components/DashboardSection';
import { useLensParam } from '@/lib/useLensParam';
import {
  MapPin,
  Search,
  AlertTriangle,
  FileCheck,
  Shield,
  TrendingUp,
  TrendingDown,
  Droplets,
  Scale,
  Waves,
  Activity,
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
  overview:              { risk: 'Waterbody Risk Profile',      regulatory: 'Regulatory Exposure',        ej: 'EJ Vulnerability Screen',     trends: 'Trend Overlay',                permits: 'Permit Constraints'           },
  developer:             { risk: 'Site Water Risk',             regulatory: 'Development Regulatory Risk',ej: 'EJ Screening for Permits',    trends: 'Water Quality Trends',         permits: 'Stormwater Permit Rules'      },
  'real-estate':         { risk: 'Property Water Risk',         regulatory: 'Disclosure Obligations',     ej: 'Environmental Justice Flags',  trends: 'Neighborhood Trends',          permits: 'Discharge Restrictions'       },
  insurance:             { risk: 'Underwriting Risk Profile',   regulatory: 'Regulatory Exposure',        ej: 'EJ Loss Exposure',             trends: 'Claims Trend Indicators',      permits: 'Permit-Driven Exclusions'     },
  legal:                 { risk: 'Litigation Risk Profile',     regulatory: 'Regulatory History',         ej: 'EJ Liability Factors',         trends: 'Impairment Trend Evidence',    permits: 'Permit Violations & Orders'   },
  consultant:            { risk: 'Site Assessment Profile',     regulatory: 'Regulatory Landscape',       ej: 'EJ Screening Summary',         trends: 'Historical Trends',            permits: 'Applicable Permits'           },
  lender:                { risk: 'Collateral Risk Profile',     regulatory: 'Regulatory Encumbrances',    ej: 'EJ Community Risk',            trends: 'Value Impact Trends',          permits: 'Permit Compliance Status'     },
  appraiser:             { risk: 'Environmental Risk Factor',   regulatory: 'Regulatory Overlay',         ej: 'EJ Proximity Flags',           trends: 'Condition Trends',             permits: 'Active Permits & Limits'      },
  'title-company':       { risk: 'Environmental Encumbrances',  regulatory: 'Regulatory Liens & Orders',  ej: 'EJ Area Designation',          trends: 'Status Change History',        permits: 'Permit Attachments'           },
  construction:          { risk: 'Site Water Conditions',       regulatory: 'Construction Permits',       ej: 'EJ Compliance Requirements',   trends: 'Seasonal Water Patterns',      permits: 'Stormwater & Erosion Permits' },
  'ma-due-diligence':    { risk: 'Target Water Risk',           regulatory: 'Regulatory Liabilities',     ej: 'EJ Portfolio Exposure',        trends: 'Risk Trajectory',              permits: 'Permit Transfer Issues'       },
  'energy-utilities':    { risk: 'Water Supply Risk',           regulatory: 'Water Use Regulations',      ej: 'EJ Community Obligations',     trends: 'Water Availability Trends',    permits: 'Withdrawal & Discharge Permits'},
  'private-equity':      { risk: 'Portfolio Water Risk',        regulatory: 'Regulatory Compliance Risk', ej: 'EJ Investment Screening',      trends: 'Asset Value Trends',           permits: 'Permit Compliance Summary'    },
  'corporate-facilities':{ risk: 'Facility Water Risk',         regulatory: 'Operational Regulations',    ej: 'EJ Community Relations',       trends: 'Facility Condition Trends',    permits: 'Operating Permits'            },
  'municipal-econ-dev':  { risk: 'Site Suitability Risk',       regulatory: 'Development Regulations',    ej: 'EJ Community Impact',          trends: 'Area Improvement Trends',      permits: 'Zoning & Water Permits'       },
  brownfield:            { risk: 'Contamination Risk Profile',  regulatory: 'Cleanup Obligations',        ej: 'EJ Brownfield Screening',      trends: 'Remediation Progress',         permits: 'Cleanup & Reuse Permits'      },
  mining:                { risk: 'Mine Drainage Risk',          regulatory: 'Mining Regulations',         ej: 'EJ Mining Community Impact',   trends: 'Water Quality Trajectory',     permits: 'Mining & Discharge Permits'   },
};

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_IMPAIRMENTS = [
  { cause: 'Pathogens (E. coli)', severity: 'high', category: '5' },
  { cause: 'Nutrients (Total Phosphorus)', severity: 'moderate', category: '4a' },
  { cause: 'Sediment / Siltation', severity: 'low', category: '2' },
];

const MOCK_TMDLS = [
  { pollutant: 'E. coli', status: 'Approved', year: 2019, wla: '126 CFU/100mL' },
  { pollutant: 'Total Phosphorus', status: 'In Development', year: null, wla: 'TBD' },
];

const MOCK_PERMITS = [
  { type: 'NPDES General', id: 'MDG01-1234', status: 'Active', expiry: '2027-03-15' },
  { type: 'MS4 Phase II', id: 'MDR10-0043', status: 'Active', expiry: '2026-12-01' },
  { type: 'Construction General', id: 'MDR10-9921', status: 'Expired', expiry: '2025-06-30' },
];

const MOCK_TRENDS = [
  { parameter: 'Dissolved Oxygen', direction: 'improving' as const, change: 8.2, period: '5-year' },
  { parameter: 'E. coli', direction: 'degrading' as const, change: -15.4, period: '5-year' },
  { parameter: 'Total Nitrogen', direction: 'stable' as const, change: 1.1, period: '5-year' },
  { parameter: 'Turbidity', direction: 'improving' as const, change: 12.0, period: '5-year' },
];

// ─── Component ───────────────────────────────────────────────────────────────

function SiteIntelligenceContent() {
  const [lens] = useLensParam<ViewLens>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const labels = LENS_LABELS[lens] || LENS_LABELS.overview;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) setHasSearched(true);
  };

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
              <h1 className="text-lg font-bold text-slate-900">Site & Property Intelligence</h1>
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
              className="px-5 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              Assess Site
            </button>
          </form>
        </div>

        {!hasSearched ? (
          /* ── Empty state ── */
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Search for a location to begin</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Enter any US address, ZIP code, or lat/lng coordinates above. PIN will pull waterbody assessments,
              regulatory data, EJ screening, and permit information for that location.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['Baltimore Inner Harbor', '21201', '39.2904, -76.6122', 'Chesapeake Bay Bridge'].map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setSearchQuery(ex); setHasSearched(true); }}
                  className="px-3 py-1.5 rounded-full border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Results ── */
          <>
            {/* Location summary strip */}
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-sm font-semibold text-slate-800">{searchQuery}</span>
                  <span className="text-xs text-slate-400 ml-2">HUC-8: 02060003 · Patapsco River Watershed</span>
                </div>
              </div>
              <button
                onClick={() => { setHasSearched(false); setSearchQuery(''); }}
                className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                Clear
              </button>
            </div>

            {/* ── Card 1: Risk Profile ── */}
            <DashboardSection title={labels.risk} subtitle="Impairment status, causes, and severity for nearby waterbodies">
              <div className="space-y-3">
                {MOCK_IMPAIRMENTS.map((imp) => (
                  <div key={imp.cause} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Droplets className={`w-4 h-4 ${
                        imp.severity === 'high' ? 'text-red-500' : imp.severity === 'moderate' ? 'text-amber-500' : 'text-green-500'
                      }`} />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{imp.cause}</div>
                        <div className="text-[10px] text-slate-400">EPA Category {imp.category}</div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      imp.severity === 'high' ? 'bg-red-50 text-red-700 border border-red-200'
                      : imp.severity === 'moderate' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-green-50 text-green-700 border border-green-200'
                    }`}>
                      {imp.severity}
                    </span>
                  </div>
                ))}
              </div>
            </DashboardSection>

            {/* ── Card 2: Regulatory Exposure ── */}
            <DashboardSection title={labels.regulatory} subtitle="TMDLs, Category 5 status, and MS4 permits affecting this location">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Active TMDLs</div>
                  <div className="space-y-2">
                    {MOCK_TMDLS.map((t) => (
                      <div key={t.pollutant} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Scale className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="text-sm font-medium text-slate-800">{t.pollutant}</div>
                            <div className="text-[10px] text-slate-400">WLA: {t.wla}</div>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          t.status === 'Approved' ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {t.status}{t.year ? ` (${t.year})` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">MS4 Phase II Jurisdiction</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">This location falls within a regulated MS4 boundary. Stormwater management requirements apply to new development and redevelopment.</p>
                </div>
              </div>
            </DashboardSection>

            {/* ── Card 3: EJ Vulnerability Screen ── */}
            <DashboardSection title={labels.ej} subtitle="Environmental justice indicators for surrounding census tracts">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'EJ Index', value: '72nd', unit: 'percentile', flagged: true },
                  { label: 'Low Income', value: '68', unit: '%', flagged: true },
                  { label: 'Minority', value: '81', unit: '%', flagged: true },
                  { label: 'Linguistic Isolation', value: '24', unit: '%', flagged: false },
                ].map((m) => (
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
                Source: EPA EJScreen. Percentiles above 80th are flagged. EJ-designated areas may require enhanced public notice and community engagement for permit actions.
              </p>
            </DashboardSection>

            {/* ── Card 4: Trend Overlay ── */}
            <DashboardSection title={labels.trends} subtitle="Improving or degrading water quality parameters at this location">
              <div className="space-y-2">
                {MOCK_TRENDS.map((t) => (
                  <div key={t.parameter} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Activity className={`w-4 h-4 ${
                        t.direction === 'improving' ? 'text-green-500' : t.direction === 'degrading' ? 'text-red-500' : 'text-slate-400'
                      }`} />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{t.parameter}</div>
                        <div className="text-[10px] text-slate-400">{t.period} trend</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.direction === 'improving' ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : t.direction === 'degrading' ? (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      ) : (
                        <Waves className="w-4 h-4 text-slate-400" />
                      )}
                      <span className={`text-sm font-semibold ${
                        t.direction === 'improving' ? 'text-green-600' : t.direction === 'degrading' ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        {t.change > 0 ? '+' : ''}{t.change}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardSection>

            {/* ── Card 5: Permit Constraint Snapshot ── */}
            <DashboardSection title={labels.permits} subtitle="Stormwater and discharge rules governing this location">
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Type</th>
                      <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Permit ID</th>
                      <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Status</th>
                      <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_PERMITS.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 text-slate-800 font-medium">{p.type}</td>
                        <td className="py-2.5 px-4 text-blue-600 font-mono text-xs">{p.id}</td>
                        <td className="py-2.5 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            p.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 text-xs">{p.expiry}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-600">
                    <span className="font-medium">Note:</span> New construction or land disturbance &gt;1 acre requires a Construction General Permit (CGP).
                    Contact your state environmental agency for current thresholds.
                  </span>
                </div>
              </div>
            </DashboardSection>
          </>
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
