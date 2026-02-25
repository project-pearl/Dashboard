'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link2, AlertTriangle, MapPin, Shield, Package, TrendingUp } from 'lucide-react';

// -- Props -------------------------------------------------------------------

interface SupplyChainRiskPanelProps {
  stateAbbr: string;
}

// -- Mock supply chain risk data ---------------------------------------------

interface SupplierRisk {
  name: string;
  region: string;
  riskScore: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  waterStress: string;
  facilityCount: number;
  mitigationStatus: 'Active' | 'Planned' | 'None';
}

interface DisruptionScenario {
  scenario: string;
  probability: 'High' | 'Medium' | 'Low';
  impactSeverity: 'Critical' | 'Major' | 'Moderate' | 'Minor';
  affectedSuppliers: number;
  estimatedCost: string;
}

interface MitigationAction {
  action: string;
  owner: string;
  status: 'Complete' | 'In Progress' | 'Planned' | 'Overdue';
  dueDate: string;
  riskReduction: string;
}

interface CommodityWaterprint {
  commodity: string;
  waterFootprint: number;
  unit: string;
  pctOfTotal: number;
  trend: 'Increasing' | 'Stable' | 'Decreasing';
}

const SUPPLY_CHAIN_DATA: Record<string, {
  regionRiskMap: Array<{ region: string; supplierCount: number; avgRiskScore: number; riskLevel: 'High' | 'Medium' | 'Low' }>;
  topSuppliers: SupplierRisk[];
  disruptions: DisruptionScenario[];
  mitigations: MitigationAction[];
  commodities: CommodityWaterprint[];
}> = {
  MD: {
    regionRiskMap: [
      { region: 'Southeast Asia', supplierCount: 14, avgRiskScore: 78, riskLevel: 'High' },
      { region: 'Central America', supplierCount: 8, avgRiskScore: 65, riskLevel: 'Medium' },
      { region: 'Northeast US', supplierCount: 22, avgRiskScore: 32, riskLevel: 'Low' },
      { region: 'Western Europe', supplierCount: 11, avgRiskScore: 28, riskLevel: 'Low' },
      { region: 'South Asia', supplierCount: 6, avgRiskScore: 82, riskLevel: 'High' },
      { region: 'Mid-Atlantic US', supplierCount: 18, avgRiskScore: 38, riskLevel: 'Low' },
    ],
    topSuppliers: [
      { name: 'Guangzhou Chemical Co.', region: 'Southeast Asia', riskScore: 88, riskLevel: 'High', waterStress: 'Extremely High', facilityCount: 3, mitigationStatus: 'Active' },
      { name: 'Delhi Polymers Ltd.', region: 'South Asia', riskScore: 84, riskLevel: 'High', waterStress: 'Extremely High', facilityCount: 2, mitigationStatus: 'Planned' },
      { name: 'Monterrey Materials SA', region: 'Central America', riskScore: 71, riskLevel: 'Medium', waterStress: 'High', facilityCount: 1, mitigationStatus: 'None' },
      { name: 'Thailand Fiber Group', region: 'Southeast Asia', riskScore: 68, riskLevel: 'Medium', waterStress: 'High', facilityCount: 4, mitigationStatus: 'Active' },
      { name: 'Pennsylvania Steel Corp.', region: 'Northeast US', riskScore: 35, riskLevel: 'Low', waterStress: 'Low-Medium', facilityCount: 2, mitigationStatus: 'Active' },
    ],
    disruptions: [
      { scenario: 'Monsoon-driven flooding in South/SE Asia', probability: 'High', impactSeverity: 'Critical', affectedSuppliers: 12, estimatedCost: '$4.2M - $6.8M' },
      { scenario: 'Prolonged drought in Central America', probability: 'Medium', impactSeverity: 'Major', affectedSuppliers: 5, estimatedCost: '$1.5M - $2.3M' },
      { scenario: 'Regulatory water allocation restrictions', probability: 'Medium', impactSeverity: 'Moderate', affectedSuppliers: 8, estimatedCost: '$800K - $1.4M' },
      { scenario: 'Industrial contamination event', probability: 'Low', impactSeverity: 'Major', affectedSuppliers: 2, estimatedCost: '$2.0M - $3.5M' },
    ],
    mitigations: [
      { action: 'Dual-source qualification for high-risk Asian suppliers', owner: 'Procurement', status: 'In Progress', dueDate: '2026-06-30', riskReduction: '-22% exposure' },
      { action: 'Supplier water stewardship audit program', owner: 'ESG/Sustainability', status: 'Complete', dueDate: '2026-01-31', riskReduction: '-15% blind spots' },
      { action: 'Emergency buffer stock for water-intensive inputs', owner: 'Supply Chain Ops', status: 'In Progress', dueDate: '2026-04-15', riskReduction: '30-day continuity' },
      { action: 'Climate adaptation roadmap for Central America tier', owner: 'Risk Management', status: 'Planned', dueDate: '2026-09-30', riskReduction: '-18% disruption prob' },
      { action: 'Real-time water stress monitoring integration', owner: 'Data/Technology', status: 'Overdue', dueDate: '2026-02-15', riskReduction: 'Early warning +14 days' },
    ],
    commodities: [
      { commodity: 'Raw Chemicals', waterFootprint: 1240, unit: 'gal/ton', pctOfTotal: 34, trend: 'Stable' },
      { commodity: 'Polymer Resins', waterFootprint: 980, unit: 'gal/ton', pctOfTotal: 27, trend: 'Increasing' },
      { commodity: 'Steel & Metals', waterFootprint: 620, unit: 'gal/ton', pctOfTotal: 17, trend: 'Decreasing' },
      { commodity: 'Textiles/Fibers', waterFootprint: 510, unit: 'gal/ton', pctOfTotal: 14, trend: 'Stable' },
      { commodity: 'Paper/Packaging', waterFootprint: 290, unit: 'gal/ton', pctOfTotal: 8, trend: 'Decreasing' },
    ],
  },
};

const DEFAULT_DATA = {
  regionRiskMap: [
    { region: 'Asia-Pacific', supplierCount: 18, avgRiskScore: 72, riskLevel: 'High' as const },
    { region: 'Americas', supplierCount: 25, avgRiskScore: 38, riskLevel: 'Low' as const },
    { region: 'Europe', supplierCount: 12, avgRiskScore: 30, riskLevel: 'Low' as const },
  ],
  topSuppliers: [
    { name: 'Supplier A (Asia)', region: 'Asia-Pacific', riskScore: 82, riskLevel: 'High' as const, waterStress: 'High', facilityCount: 2, mitigationStatus: 'Active' as const },
    { name: 'Supplier B (Americas)', region: 'Americas', riskScore: 41, riskLevel: 'Medium' as const, waterStress: 'Medium', facilityCount: 3, mitigationStatus: 'None' as const },
  ],
  disruptions: [
    { scenario: 'Regional water scarcity event', probability: 'Medium' as const, impactSeverity: 'Major' as const, affectedSuppliers: 6, estimatedCost: '$2M - $4M' },
  ],
  mitigations: [
    { action: 'Supplier diversification program', owner: 'Procurement', status: 'In Progress' as const, dueDate: '2026-06-30', riskReduction: '-20% concentration' },
  ],
  commodities: [
    { commodity: 'Primary Materials', waterFootprint: 1100, unit: 'gal/ton', pctOfTotal: 45, trend: 'Stable' as const },
    { commodity: 'Secondary Materials', waterFootprint: 680, unit: 'gal/ton', pctOfTotal: 28, trend: 'Decreasing' as const },
  ],
};

// -- Helpers -----------------------------------------------------------------

function riskLevelColor(level: string): string {
  switch (level) {
    case 'High': return 'bg-red-100 text-red-800 border-red-200';
    case 'Medium': return 'bg-amber-100 text-amber-800 border-amber-200';
    default: return 'bg-green-100 text-green-800 border-green-200';
  }
}

function probabilityColor(prob: string): string {
  switch (prob) {
    case 'High': return 'bg-red-100 text-red-700';
    case 'Medium': return 'bg-amber-100 text-amber-700';
    default: return 'bg-green-100 text-green-700';
  }
}

function severityColor(sev: string): string {
  switch (sev) {
    case 'Critical': return 'bg-red-100 text-red-800';
    case 'Major': return 'bg-orange-100 text-orange-800';
    case 'Moderate': return 'bg-amber-100 text-amber-800';
    default: return 'bg-blue-100 text-blue-800';
  }
}

function mitigationStatusColor(status: string): string {
  switch (status) {
    case 'Complete': return 'bg-green-100 text-green-700';
    case 'In Progress': return 'bg-blue-100 text-blue-700';
    case 'Planned': return 'bg-slate-100 text-slate-600';
    default: return 'bg-red-100 text-red-700';
  }
}

function trendColor(trend: string): string {
  switch (trend) {
    case 'Decreasing': return 'text-emerald-600';
    case 'Increasing': return 'text-red-600';
    default: return 'text-slate-500';
  }
}

// -- Component ---------------------------------------------------------------

export function SupplyChainRiskPanel({ stateAbbr }: SupplyChainRiskPanelProps) {
  const data = useMemo(() => SUPPLY_CHAIN_DATA[stateAbbr?.toUpperCase()] ?? DEFAULT_DATA, [stateAbbr]);

  const highRiskRegions = useMemo(() => data.regionRiskMap.filter((r) => r.riskLevel === 'High').length, [data]);
  const totalSuppliers = useMemo(() => data.regionRiskMap.reduce((sum, r) => sum + r.supplierCount, 0), [data]);
  const overdueActions = useMemo(() => data.mitigations.filter((m) => m.status === 'Overdue').length, [data]);

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link2 className="w-3.5 h-3.5" />
        <span>Supply Chain Water Risk — WRI Aqueduct + Internal Supplier Data ({stateAbbr || 'National'})</span>
      </div>

      {/* Section 1: Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Total Suppliers', value: `${totalSuppliers}`, iconBg: 'bg-indigo-50 border-indigo-200', iconColor: 'text-indigo-600', Icon: Link2 },
          { label: 'High-Risk Regions', value: `${highRiskRegions}`, iconBg: 'bg-red-50 border-red-200', iconColor: 'text-red-600', Icon: AlertTriangle },
          { label: 'Disruption Scenarios', value: `${data.disruptions.length}`, iconBg: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-600', Icon: Shield },
          { label: 'Overdue Mitigations', value: `${overdueActions}`, iconBg: overdueActions > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200', iconColor: overdueActions > 0 ? 'text-red-600' : 'text-green-600', Icon: Package },
        ] as const).map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${stat.iconBg}`}>
                  <stat.Icon size={20} className={stat.iconColor} />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section 2: Supplier Water Risk by Region */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin size={16} className="text-red-600" />
            Supplier Water Risk by Region
            <Badge variant="secondary" className="ml-1 text-[10px]">{data.regionRiskMap.length} regions</Badge>
          </CardTitle>
          <CardDescription>
            Geographic distribution of supplier base with aggregated water risk scores (WRI Aqueduct methodology)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.regionRiskMap
              .sort((a, b) => b.avgRiskScore - a.avgRiskScore)
              .map((region) => {
                const barWidth = Math.max(4, region.avgRiskScore);
                return (
                  <div key={region.region}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-700">{region.region}</span>
                        <Badge className={`text-[9px] ${riskLevelColor(region.riskLevel)}`}>{region.riskLevel}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400">{region.supplierCount} suppliers</span>
                        <span className="text-xs font-semibold text-slate-800 tabular-nums w-8 text-right">{region.avgRiskScore}</span>
                      </div>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-md overflow-hidden">
                      <div
                        className={`h-full rounded-md transition-all duration-500 ${
                          region.riskLevel === 'High' ? 'bg-red-400' :
                          region.riskLevel === 'Medium' ? 'bg-amber-400' :
                          'bg-emerald-400'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            <p className="text-[10px] text-slate-400 mt-2">
              Risk scores range 0-100 (higher = greater water risk). Based on WRI Aqueduct baseline water stress indicators.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Top Supplier Risk Scores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle size={16} className="text-amber-600" />
            Top Supplier Risk Scores
          </CardTitle>
          <CardDescription>
            Individual suppliers ranked by composite water risk score with mitigation status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Supplier</th>
                  <th className="pb-2 font-semibold">Region</th>
                  <th className="pb-2 font-semibold text-center">Risk Score</th>
                  <th className="pb-2 font-semibold text-center">Water Stress</th>
                  <th className="pb-2 font-semibold text-right">Facilities</th>
                  <th className="pb-2 font-semibold text-center">Mitigation</th>
                </tr>
              </thead>
              <tbody>
                {data.topSuppliers.map((s) => (
                  <tr key={s.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 font-medium text-slate-700 max-w-[180px] truncate" title={s.name}>{s.name}</td>
                    <td className="py-2 text-slate-600">{s.region}</td>
                    <td className="py-2 text-center">
                      <Badge className={`text-[9px] ${riskLevelColor(s.riskLevel)}`}>{s.riskScore}</Badge>
                    </td>
                    <td className="py-2 text-center text-slate-600">{s.waterStress}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600">{s.facilityCount}</td>
                    <td className="py-2 text-center">
                      <Badge className={`text-[9px] ${mitigationStatusColor(s.mitigationStatus)}`}>{s.mitigationStatus}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Supply Chain Disruption Scenarios */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield size={16} className="text-purple-600" />
            Supply Chain Disruption Scenarios
          </CardTitle>
          <CardDescription>
            Modeled water-related disruption scenarios with probability, impact severity, and cost estimates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.disruptions.map((d) => (
              <div key={d.scenario} className={`rounded-lg border p-3 ${
                d.probability === 'High' ? 'border-red-200 bg-red-50/50' :
                d.probability === 'Medium' ? 'border-amber-200 bg-amber-50/50' :
                'border-slate-200'
              }`}>
                <div className="flex items-start justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-800 flex-1 mr-2">{d.scenario}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className={`text-[9px] ${probabilityColor(d.probability)}`}>P: {d.probability}</Badge>
                    <Badge className={`text-[9px] ${severityColor(d.impactSeverity)}`}>{d.impactSeverity}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span>Affected suppliers: <span className="font-semibold text-slate-700">{d.affectedSuppliers}</span></span>
                  <span>Estimated cost: <span className="font-semibold text-slate-700">{d.estimatedCost}</span></span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Mitigation Action Tracker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp size={16} className="text-emerald-600" />
            Mitigation Action Tracker
            {overdueActions > 0 && (
              <Badge className="ml-1 text-[10px] bg-red-100 text-red-700">{overdueActions} overdue</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Active risk mitigation initiatives to reduce supply chain water vulnerability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Action</th>
                  <th className="pb-2 font-semibold">Owner</th>
                  <th className="pb-2 font-semibold text-center">Status</th>
                  <th className="pb-2 font-semibold">Due Date</th>
                  <th className="pb-2 font-semibold text-right">Risk Reduction</th>
                </tr>
              </thead>
              <tbody>
                {data.mitigations.map((m) => (
                  <tr key={m.action} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                    m.status === 'Overdue' ? 'bg-red-50/30' : ''
                  }`}>
                    <td className="py-2 font-medium text-slate-700 max-w-[220px]">{m.action}</td>
                    <td className="py-2 text-slate-600">{m.owner}</td>
                    <td className="py-2 text-center">
                      <Badge className={`text-[9px] ${mitigationStatusColor(m.status)}`}>{m.status}</Badge>
                    </td>
                    <td className="py-2 text-slate-600">{m.dueDate}</td>
                    <td className="py-2 text-right font-semibold text-slate-700">{m.riskReduction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Commodity-Level Water Footprint */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package size={16} className="text-blue-600" />
            Commodity-Level Water Footprint
          </CardTitle>
          <CardDescription>
            Embedded water intensity by commodity category with contribution to total supply chain water footprint
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.commodities.map((c) => (
              <div key={c.commodity}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700">{c.commodity}</span>
                    <span className={`text-[10px] font-semibold ${trendColor(c.trend)}`}>{c.trend}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{c.waterFootprint.toLocaleString()} {c.unit}</span>
                    <span className="text-xs font-bold text-slate-800 tabular-nums">{c.pctOfTotal}%</span>
                  </div>
                </div>
                <div className="h-4 bg-slate-100 rounded-md overflow-hidden relative">
                  <div
                    className="h-full rounded-md bg-blue-400 transition-all duration-500"
                    style={{ width: `${c.pctOfTotal}%` }}
                  />
                  {c.pctOfTotal >= 15 && (
                    <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-semibold text-white">
                      {c.pctOfTotal}%
                    </span>
                  )}
                </div>
              </div>
            ))}
            <p className="text-[10px] text-slate-400 mt-2">
              Water footprint calculated using Water Footprint Network methodology. Trends reflect year-over-year change in embedded water intensity.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
