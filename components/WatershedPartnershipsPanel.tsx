'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Handshake,
  Users,
  MapPin,
  Share2,
  FileText,
  BarChart3,
} from 'lucide-react';

// ── Props ───────────────────────────────────────────────────────────────────

interface WatershedPartnershipsPanelProps {
  stateAbbr: string;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface PartnerOrg {
  name: string;
  type: string;
  watershed: string;
  since: number;
  status: 'Active' | 'Pending' | 'Inactive';
  contactCount: number;
}

interface ResearchProject {
  title: string;
  partners: string[];
  status: 'In Progress' | 'Completed' | 'Proposed';
  startDate: string;
  endDate: string;
  fundingK: number;
}

interface DataAgreement {
  partner: string;
  agreementType: string;
  status: 'Signed' | 'Under Review' | 'Expired';
  parameters: string[];
  lastUpdated: string;
}

interface MonitoringStation {
  id: string;
  name: string;
  watershed: string;
  sharedWith: string[];
  parametersMonitored: number;
  lastSample: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

function getPartnerOrgs(stateAbbr: string): PartnerOrg[] {
  return [
    { name: `${stateAbbr} River Conservancy`, type: 'Non-profit', watershed: 'Upper Mill Creek', since: 2018, status: 'Active', contactCount: 4 },
    { name: 'Regional Water Authority', type: 'Government', watershed: 'Cedar River Basin', since: 2020, status: 'Active', contactCount: 3 },
    { name: 'Tri-County Soil & Water District', type: 'Government', watershed: 'Mill Creek', since: 2019, status: 'Active', contactCount: 5 },
    { name: 'Blue Ridge Watershed Alliance', type: 'Non-profit', watershed: 'Cedar River Basin', since: 2021, status: 'Active', contactCount: 2 },
    { name: 'AgriStar Farms Cooperative', type: 'Private', watershed: 'Lower Mill Creek', since: 2023, status: 'Pending', contactCount: 1 },
  ];
}

function getResearchProjects(): ResearchProject[] {
  return [
    { title: 'Nutrient Loading Dynamics in Urban-Rural Transition Zones', partners: ['River Conservancy', 'Tri-County SWCD'], status: 'In Progress', startDate: '2024-09-01', endDate: '2026-08-31', fundingK: 245 },
    { title: 'Riparian Buffer Effectiveness on Sediment Reduction', partners: ['Blue Ridge Alliance'], status: 'In Progress', startDate: '2025-01-15', endDate: '2027-01-14', fundingK: 180 },
    { title: 'Bacterial Source Tracking in Mixed-Use Watersheds', partners: ['Regional Water Authority', 'River Conservancy'], status: 'Completed', startDate: '2022-06-01', endDate: '2024-12-15', fundingK: 312 },
    { title: 'Climate Resilience of Campus Green Infrastructure', partners: ['Blue Ridge Alliance', 'Tri-County SWCD'], status: 'Proposed', startDate: '2026-09-01', endDate: '2028-08-31', fundingK: 195 },
  ];
}

function getDataAgreements(): DataAgreement[] {
  return [
    { partner: 'Regional Water Authority', agreementType: 'Bi-directional', status: 'Signed', parameters: ['Nutrients', 'Bacteria', 'Flow'], lastUpdated: '2025-03-10' },
    { partner: 'River Conservancy', agreementType: 'Bi-directional', status: 'Signed', parameters: ['Water Quality', 'Habitat', 'Macroinvertebrates'], lastUpdated: '2024-11-22' },
    { partner: 'Tri-County SWCD', agreementType: 'University provides', status: 'Signed', parameters: ['Sediment', 'Nutrients', 'Metals'], lastUpdated: '2025-01-05' },
    { partner: 'Blue Ridge Alliance', agreementType: 'Partner provides', status: 'Under Review', parameters: ['Stream Flow', 'Temperature'], lastUpdated: '2025-08-18' },
    { partner: 'AgriStar Farms Cooperative', agreementType: 'Bi-directional', status: 'Expired', parameters: ['Nutrients', 'Pesticides'], lastUpdated: '2023-06-30' },
  ];
}

function getSharedStations(): MonitoringStation[] {
  return [
    { id: 'MC-001', name: 'Mill Creek at Campus Bridge', watershed: 'Mill Creek', sharedWith: ['River Conservancy', 'Tri-County SWCD'], parametersMonitored: 14, lastSample: '2026-02-12' },
    { id: 'CR-003', name: 'Cedar River — Confluence Park', watershed: 'Cedar River Basin', sharedWith: ['Regional Water Authority', 'Blue Ridge Alliance'], parametersMonitored: 18, lastSample: '2026-02-18' },
    { id: 'MC-007', name: 'Mill Creek — Agricultural Reach', watershed: 'Lower Mill Creek', sharedWith: ['Tri-County SWCD'], parametersMonitored: 10, lastSample: '2026-01-28' },
    { id: 'CR-010', name: 'Cedar River — Upstream Reference', watershed: 'Cedar River Basin', sharedWith: ['Blue Ridge Alliance'], parametersMonitored: 12, lastSample: '2026-02-05' },
  ];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function partnerStatusColor(status: PartnerOrg['status']): string {
  if (status === 'Active') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Pending') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function projectStatusColor(status: ResearchProject['status']): string {
  if (status === 'In Progress') return 'bg-blue-100 text-blue-700';
  if (status === 'Completed') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

function agreementStatusColor(status: DataAgreement['status']): string {
  if (status === 'Signed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Under Review') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

// ── Component ───────────────────────────────────────────────────────────────

export function WatershedPartnershipsPanel({ stateAbbr }: WatershedPartnershipsPanelProps) {
  const partners = useMemo(() => getPartnerOrgs(stateAbbr), [stateAbbr]);
  const projects = useMemo(() => getResearchProjects(), []);
  const agreements = useMemo(() => getDataAgreements(), []);
  const stations = useMemo(() => getSharedStations(), []);

  const activePartners = useMemo(() => partners.filter((p) => p.status === 'Active').length, [partners]);
  const totalFundingK = useMemo(() => projects.reduce((sum, p) => sum + p.fundingK, 0), [projects]);
  const signedAgreements = useMemo(() => agreements.filter((a) => a.status === 'Signed').length, [agreements]);

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Handshake className="w-3.5 h-3.5" />
        <span>Watershed Partnerships — {stateAbbr}</span>
      </div>

      {/* ── Section 1: Hero Stats ──────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
                <Handshake size={28} className="text-teal-600" />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-teal-700">{activePartners}</span>
                  <span className="text-sm text-slate-500">active partnerships</span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">
                  Collaborating across {new Set(partners.map((p) => p.watershed)).size} watershed areas
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">{projects.length}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Joint Projects</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-700">${totalFundingK}K</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total Funding</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">{stations.length}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Shared Stations</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Active Partnerships ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users size={16} className="text-teal-600" />
            Partner Organizations
            <Badge variant="secondary" className="ml-1 text-[10px]">{partners.length} partners</Badge>
          </CardTitle>
          <CardDescription>Organizations collaborating on watershed research and monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {partners.map((p) => (
              <div key={p.name} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center">
                    <Users size={14} className="text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      <MapPin size={10} className="inline mr-1" />{p.watershed} — Since {p.since} — {p.contactCount} contacts
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${partnerStatusColor(p.status)}`}>{p.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Joint Research Projects ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 size={16} className="text-blue-600" />
            Joint Research Projects
          </CardTitle>
          <CardDescription>Collaborative research with partner organizations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projects.map((proj) => (
              <div key={proj.title} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{proj.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {proj.startDate} to {proj.endDate} — ${proj.fundingK}K funding
                    </p>
                  </div>
                  <Badge className={`text-[10px] ml-2 shrink-0 ${projectStatusColor(proj.status)}`}>{proj.status}</Badge>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {proj.partners.map((partner) => (
                    <Badge key={partner} variant="outline" className="text-[10px] text-slate-600">
                      {partner}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Data Sharing Agreements ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 size={16} className="text-indigo-600" />
            Data Sharing Agreements
            <Badge variant="secondary" className="ml-1 text-[10px]">{signedAgreements} of {agreements.length} active</Badge>
          </CardTitle>
          <CardDescription>Status of data exchange agreements with partner organizations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Partner</th>
                  <th className="pb-2 font-semibold">Type</th>
                  <th className="pb-2 font-semibold">Parameters</th>
                  <th className="pb-2 font-semibold text-right">Updated</th>
                  <th className="pb-2 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {agreements.map((a) => (
                  <tr key={a.partner} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 font-semibold text-slate-700">{a.partner}</td>
                    <td className="py-2 text-slate-600">{a.agreementType}</td>
                    <td className="py-2 text-slate-600">
                      <div className="flex gap-1 flex-wrap">
                        {a.parameters.map((param) => (
                          <Badge key={param} variant="outline" className="text-[9px] text-slate-500">{param}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-right text-slate-500">{a.lastUpdated}</td>
                    <td className="py-2 text-right">
                      <Badge className={`text-[10px] ${agreementStatusColor(a.status)}`}>{a.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Community Engagement Metrics ────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText size={16} className="text-purple-600" />
            Community Engagement Metrics
          </CardTitle>
          <CardDescription>Outreach and engagement activity summary for the current academic year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-center">
              <p className="text-2xl font-bold text-purple-700">12</p>
              <p className="text-xs text-purple-600 mt-1">Workshops Held</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">347</p>
              <p className="text-xs text-blue-600 mt-1">Community Attendees</p>
            </div>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-center">
              <p className="text-2xl font-bold text-teal-700">8</p>
              <p className="text-xs text-teal-600 mt-1">Citizen Science Events</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">56</p>
              <p className="text-xs text-amber-600 mt-1">Student Volunteers</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3">
            Academic year 2025-2026. Includes watershed cleanup days, water quality sampling training, and public lecture series.
          </p>
        </CardContent>
      </Card>

      {/* ── Section 6: Shared Monitoring Stations ──────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin size={16} className="text-rose-600" />
            Shared Monitoring Stations
            <Badge variant="secondary" className="ml-1 text-[10px]">{stations.length} stations</Badge>
          </CardTitle>
          <CardDescription>Monitoring stations jointly operated with partner organizations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stations.map((s) => (
              <div key={s.id} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      <span className="text-xs font-mono text-slate-400 mr-2">{s.id}</span>
                      {s.name}
                    </p>
                    <p className="text-xs text-slate-500">{s.watershed} — {s.parametersMonitored} parameters — Last sampled {s.lastSample}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 mr-1">Shared with:</span>
                  {s.sharedWith.map((partner) => (
                    <Badge key={partner} variant="outline" className="text-[10px] text-slate-600">{partner}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
