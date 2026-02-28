'use client';

import React, { useState } from 'react';
import HeroBanner from '@/components/HeroBanner';
import { KPIStrip, KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { StatusCard } from '@/components/StatusCard';
import {
  Shield,
  AlertTriangle,
  DollarSign,
  Building2,
  FileText,
  MapPin,
  TrendingUp,
  Droplets,
  Scale,
  BarChart3,
  Waves,
  Ban,
} from 'lucide-react';
import { NwisGwPanel } from '@/components/NwisGwPanel';
import WaterfrontExposurePanel from '@/components/WaterfrontExposurePanel';

const MOCK_PROPERTIES = [
  { address: '1420 Waterfront Dr, Annapolis MD', floodZone: 'AE', riskScore: 82, contamination: 'Low', value: '$425K', claims: 0 },
  { address: '300 Bay Ridge Ave, Baltimore MD', floodZone: 'VE', riskScore: 94, contamination: 'Medium', value: '$310K', claims: 2 },
  { address: '55 Harbor Point Rd, Cambridge MD', floodZone: 'X', riskScore: 31, contamination: 'Low', value: '$575K', claims: 0 },
  { address: '890 Chesapeake Blvd, Norfolk VA', floodZone: 'AE', riskScore: 78, contamination: 'High', value: '$290K', claims: 3 },
  { address: '1200 Colonial Ave, Richmond VA', floodZone: 'X500', riskScore: 45, contamination: 'Low', value: '$680K', claims: 0 },
];

const REGULATORY_TIMELINE = [
  { regulation: 'PFAS MCL (4 ppt)', effective: '2026-Q2', impact: 'High', sector: 'Water Utilities' },
  { regulation: 'Lead & Copper Rule Revisions', effective: '2025-Q4', impact: 'High', sector: 'Water Utilities' },
  { regulation: 'Updated Flood Maps (FEMA)', effective: '2026-Q1', impact: 'Medium', sector: 'Property/Casualty' },
  { regulation: 'Stormwater Industrial Permit Update', effective: '2026-Q3', impact: 'Medium', sector: 'Commercial' },
  { regulation: 'CERCLA PFAS Liability', effective: '2025-Q3', impact: 'Critical', sector: 'Environmental' },
];

const CLAIM_PATTERNS = [
  { region: 'Chesapeake Bay', claimType: 'Flood', frequency: 'High', avgPayout: '$45K', trend: 'Rising' },
  { region: 'Mid-Atlantic Coast', claimType: 'Storm Surge', frequency: 'Medium', avgPayout: '$78K', trend: 'Rising' },
  { region: 'Delaware Valley', claimType: 'Contamination', frequency: 'Low', avgPayout: '$120K', trend: 'Stable' },
  { region: 'Tidewater VA', claimType: 'Flood', frequency: 'High', avgPayout: '$52K', trend: 'Rising' },
];

export default function InsurancePage() {
  const kpiCards: KPICard[] = [
    { label: 'Flood Risk Score', value: '68', icon: Waves, delta: 5, status: 'warning' },
    { label: 'Contamination Proximity', value: '2.4', unit: 'mi', icon: AlertTriangle, status: 'warning' },
    { label: 'Avg Property Impact', value: '$42K', icon: DollarSign, delta: 12, status: 'critical' },
    { label: 'Portfolio Count', value: '1,247', icon: Building2, delta: 8, status: 'good' },
    { label: 'Claims Risk', value: 'Medium', icon: Shield, status: 'warning' },
    { label: 'Regulatory Exposure', value: '3', unit: 'pending', icon: Scale, status: 'warning' },
  ];

  return (
    <div className="min-h-full">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <HeroBanner role="insurance" />
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
        <KPIStrip cards={kpiCards} />

        {/* Flood Risk Assessment */}
        <DashboardSection title="Flood Risk Assessment" subtitle="FEMA flood zones overlaid with real-time water level data">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatusCard title="Zone AE — High Risk" description="12 properties in 100-year floodplain. Average premium: $2,400/yr." status="critical" />
            <StatusCard title="Zone VE — Coastal" description="3 properties in coastal high-hazard area. Storm surge risk." status="critical" />
            <StatusCard title="Zone X500 — Moderate" description="28 properties in 500-year floodplain. Flood insurance recommended." status="warning" />
            <StatusCard title="Zone X — Minimal" description="204 properties outside flood zones. Standard coverage adequate." status="good" />
          </div>
          <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <MapPin className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
            <p className="text-xs text-white/50">Interactive FEMA flood zone map with NOAA water level overlay — connect to CO-OPS API</p>
          </div>
        </DashboardSection>

        {/* Contamination Analysis */}
        <DashboardSection title="Contamination Analysis" subtitle="Proximity to impaired waterbodies, NPDES facilities, and Superfund sites">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Droplets className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-semibold text-white">Impaired Waterbodies</h4>
              </div>
              <div className="text-3xl font-bold text-amber-400">23</div>
              <p className="text-xs text-white/40 mt-1">Within 5-mile radius of portfolio. Primary impairments: bacteria, nutrients, PCBs.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-red-400" />
                <h4 className="text-sm font-semibold text-white">NPDES Facilities</h4>
              </div>
              <div className="text-3xl font-bold text-red-400">8</div>
              <p className="text-xs text-white/40 mt-1">Active discharge permits nearby. 2 with significant noncompliance.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Ban className="w-4 h-4 text-red-500" />
                <h4 className="text-sm font-semibold text-white">Superfund Sites</h4>
              </div>
              <div className="text-3xl font-bold text-red-500">1</div>
              <p className="text-xs text-white/40 mt-1">NPL site within 3 miles. Active remediation phase. Groundwater plume monitored.</p>
            </div>
          </div>
        </DashboardSection>

        {/* Portfolio Due Diligence */}
        <DashboardSection title="Portfolio Due Diligence" subtitle="Batch property risk assessment">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Address</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Flood Zone</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Risk Score</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Contamination</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Value</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Claims</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PROPERTIES.map((p) => (
                  <tr key={p.address} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 text-white">{p.address}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                        p.floodZone.startsWith('V') ? 'bg-red-500/10 text-red-400' :
                        p.floodZone === 'AE' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-green-500/10 text-green-400'
                      }`}>{p.floodZone}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${
                            p.riskScore > 80 ? 'bg-red-500' : p.riskScore > 50 ? 'bg-amber-500' : 'bg-green-500'
                          }`} style={{ width: `${p.riskScore}%` }} />
                        </div>
                        <span className="text-xs text-white/60">{p.riskScore}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs ${
                        p.contamination === 'High' ? 'text-red-400' :
                        p.contamination === 'Medium' ? 'text-amber-400' : 'text-green-400'
                      }`}>{p.contamination}</span>
                    </td>
                    <td className="py-2.5 px-3 text-white/70">{p.value}</td>
                    <td className="py-2.5 px-3 text-white/50">{p.claims}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        {/* Waterfront Value Exposure */}
        <DashboardSection title="Waterfront Value Exposure" subtitle="Hedonic model — waterfront property value at risk from WQ degradation">
          <WaterfrontExposurePanel selectedState="MD" />
        </DashboardSection>

        {/* Regulatory Exposure */}
        <DashboardSection title="Regulatory Exposure" subtitle="Upcoming regulations affecting property values and coverage">
          <div className="space-y-2">
            {REGULATORY_TIMELINE.map((r) => (
              <div key={r.regulation} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-medium truncate">{r.regulation}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{r.sector}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-xs text-white/50">{r.effective}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.impact === 'Critical' ? 'bg-red-500/10 text-red-400' :
                    r.impact === 'High' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-white/5 text-white/40'
                  }`}>{r.impact}</span>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>

        {/* Claims Intelligence */}
        <DashboardSection title="Claims Intelligence" subtitle="Historical claim patterns by region and type">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Region</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Claim Type</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Frequency</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Avg Payout</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Trend</th>
                </tr>
              </thead>
              <tbody>
                {CLAIM_PATTERNS.map((c) => (
                  <tr key={`${c.region}-${c.claimType}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 text-white">{c.region}</td>
                    <td className="py-2.5 px-3 text-white/70">{c.claimType}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.frequency === 'High' ? 'bg-red-500/10 text-red-400' :
                        c.frequency === 'Medium' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-green-500/10 text-green-400'
                      }`}>{c.frequency}</span>
                    </td>
                    <td className="py-2.5 px-3 text-white/70">{c.avgPayout}</td>
                    <td className="py-2.5 px-3">
                      <span className={`flex items-center gap-1 text-xs ${
                        c.trend === 'Rising' ? 'text-red-400' : 'text-white/40'
                      }`}>
                        {c.trend === 'Rising' && <TrendingUp className="w-3 h-3" />}
                        {c.trend}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        {/* Groundwater & Subsidence Risk */}
        <NwisGwPanel compactMode={true} />
      </div>
    </div>
  );
}
