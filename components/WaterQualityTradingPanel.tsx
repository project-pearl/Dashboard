'use client';

import React, { useState, useMemo } from 'react';
import {
  Leaf, Droplets, Wheat, Home, Shell, ArrowRightLeft, TrendingUp,
  DollarSign, ExternalLink, Info, Filter, Search, Building2, ChevronDown,
  ChevronUp, Download, ShieldCheck, BarChart3, CircleDollarSign,
} from 'lucide-react';
import { MockDataBadge } from './MockDataBadge';
import { DashboardSection } from './DashboardSection';
import { NUTRIENT_TRADING_STATES, WQT_PROGRAM_INFO } from '@/lib/constants';

// ── Types ────────────────────────────────────────────────────────────────────

type CreditSector = 'wastewater' | 'stormwater' | 'agriculture' | 'septic' | 'aquaculture';

interface SectorSummary {
  sector: CreditSector;
  label: string;
  icon: React.ElementType;
  description: string;
  tnCredits: number;
  tpCredits: number;
  sedimentCredits: number;
  facilities: number;
  tradedThisYear: number;
  avgPrice: { tn: number; tp: number };
  iconBg: string;
  iconTx: string;
  borderColor: string;
}

interface MarketListing {
  id: string;
  seller: string;
  sector: CreditSector;
  nutrient: 'TN' | 'TP' | 'Sediment';
  credits: number;
  pricePerCredit: number;
  location: string;
  bmpType: string;
  verified: boolean;
}

interface WaterQualityTradingPanelProps {
  stateAbbr: string;
  mode?: 'state' | 'ms4' | 'local' | 'utility';
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

const SECTOR_META: Record<CreditSector, { label: string; icon: React.ElementType; iconBg: string; iconTx: string; borderColor: string; description: string }> = {
  wastewater:  { label: 'Wastewater Treatment',  icon: Building2,  iconBg: 'bg-indigo-100', iconTx: 'text-indigo-600', borderColor: 'border-indigo-200', description: 'Point source treatment plants exceeding permit limits' },
  stormwater:  { label: 'Stormwater / MS4',       icon: Droplets,   iconBg: 'bg-blue-100',   iconTx: 'text-blue-600',   borderColor: 'border-blue-200',   description: 'Urban BMPs — bioretention, green infrastructure' },
  agriculture: { label: 'Agricultural',            icon: Wheat,      iconBg: 'bg-amber-100',  iconTx: 'text-amber-600',  borderColor: 'border-amber-200',  description: 'Cover crops, riparian buffers, nutrient management' },
  septic:      { label: 'Septic / On-Site',        icon: Home,       iconBg: 'bg-emerald-100',iconTx: 'text-emerald-600',borderColor: 'border-emerald-200',description: 'Septic system upgrades, BAT connections' },
  aquaculture: { label: 'Aquaculture / Restoration', icon: Shell,    iconBg: 'bg-cyan-100',   iconTx: 'text-cyan-600',   borderColor: 'border-cyan-200',   description: 'Oyster aquaculture, stream restoration, wetlands' },
};

// ── Mock Data Generator ──────────────────────────────────────────────────────

function generateSectorData(stateAbbr: string): SectorSummary[] {
  const info = WQT_PROGRAM_INFO[stateAbbr];
  if (!info) return [];
  return info.sectors.map(sector => {
    const meta = SECTOR_META[sector];
    // Seed-based mock data per state+sector for consistency
    const seed = (stateAbbr.charCodeAt(0) * 31 + stateAbbr.charCodeAt(1)) * (sector.charCodeAt(0) + 1);
    const tn = info.nutrients.includes('nitrogen') ? Math.round((seed % 4000) + 200) : 0;
    const tp = info.nutrients.includes('phosphorus') ? Math.round((seed % 2000) + 100) : 0;
    const sed = info.nutrients.includes('sediment') ? Math.round((seed % 8000) + 500) : 0;
    return {
      sector,
      label: meta.label,
      icon: meta.icon,
      description: meta.description,
      tnCredits: tn,
      tpCredits: tp,
      sedimentCredits: sed,
      facilities: Math.round((seed % 80) + 5),
      tradedThisYear: Math.round((tn + tp) * 0.3),
      avgPrice: { tn: Math.round(40 + (seed % 30)), tp: Math.round(60 + (seed % 40)) },
      iconBg: meta.iconBg,
      iconTx: meta.iconTx,
      borderColor: meta.borderColor,
    };
  });
}

function generateMarketListings(stateAbbr: string): MarketListing[] {
  const info = WQT_PROGRAM_INFO[stateAbbr];
  if (!info) return [];

  const listings: MarketListing[] = [];
  const sellers: Record<string, { names: string[]; bmps: string[] }> = {
    wastewater: { names: ['Regional WWTP Authority', 'Municipal Water Reclamation', 'County Wastewater District'], bmps: ['Advanced Treatment Upgrade', 'Biological Nutrient Removal', 'Enhanced Nutrient Recovery'] },
    agriculture: { names: ['Agricultural Co-op', 'Farm Bureau Conservation', 'Soil & Water District', 'Family Farms Alliance'], bmps: ['Cover Crops + No-Till', 'Riparian Buffer Network', 'Precision Nutrient Management', 'Grass Waterways'] },
    stormwater: { names: ['County Stormwater Program', 'City Green Infrastructure', 'Urban Watershed Alliance'], bmps: ['Bioretention Network', 'Constructed Wetland', 'Permeable Pavement System'] },
    septic: { names: ['Bay Restoration Fund', 'Septic Upgrade Initiative'], bmps: ['BAT System Upgrade', 'Sewer Connection Program'] },
    aquaculture: { names: ['Oyster Recovery Partnership', 'Watershed Conservation Trust', 'River Restoration Council'], bmps: ['Oyster Reef Restoration', 'Stream Restoration', 'Wetland Creation'] },
  };

  let id = 0;
  for (const sector of info.sectors) {
    const s = sellers[sector];
    if (!s) continue;
    for (let i = 0; i < Math.min(s.names.length, 2); i++) {
      const nutrient = i % 2 === 0 && info.nutrients.includes('nitrogen') ? 'TN' : 'TP';
      const price = nutrient === 'TN' ? 40 + (id * 7 % 25) : 60 + (id * 11 % 30);
      const credits = 200 + (id * 137 % 2800);
      listings.push({
        id: `listing-${id++}`,
        seller: s.names[i],
        sector: sector as CreditSector,
        nutrient: nutrient as 'TN' | 'TP',
        credits,
        pricePerCredit: price,
        location: `${info.watershed || stateAbbr} Region`,
        bmpType: s.bmps[i % s.bmps.length],
        verified: id % 3 !== 0,
      });
    }
  }
  return listings;
}

// ── Component ────────────────────────────────────────────────────────────────

export function WaterQualityTradingPanel({
  stateAbbr,
  mode = 'state',
  className = '',
}: WaterQualityTradingPanelProps) {
  const [sectorFilter, setSectorFilter] = useState<CreditSector | 'all'>('all');
  const [nutrientFilter, setNutrientFilter] = useState<'all' | 'TN' | 'TP' | 'Sediment'>('all');
  const [marketSearch, setMarketSearch] = useState('');
  const [expandedSector, setExpandedSector] = useState<CreditSector | null>(null);

  const info = WQT_PROGRAM_INFO[stateAbbr];
  const hasProgram = NUTRIENT_TRADING_STATES.has(stateAbbr);

  const sectors = useMemo(() => generateSectorData(stateAbbr), [stateAbbr]);
  const listings = useMemo(() => generateMarketListings(stateAbbr), [stateAbbr]);

  const filteredListings = useMemo(() => {
    let list = [...listings];
    if (sectorFilter !== 'all') list = list.filter(l => l.sector === sectorFilter);
    if (nutrientFilter !== 'all') list = list.filter(l => l.nutrient === nutrientFilter);
    if (marketSearch) {
      const q = marketSearch.toLowerCase();
      list = list.filter(l =>
        l.seller.toLowerCase().includes(q) ||
        l.bmpType.toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q)
      );
    }
    return list;
  }, [listings, sectorFilter, nutrientFilter, marketSearch]);

  // ── Totals ──────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let tn = 0, tp = 0, sed = 0, facilities = 0, traded = 0, value = 0;
    for (const s of sectors) {
      tn += s.tnCredits;
      tp += s.tpCredits;
      sed += s.sedimentCredits;
      facilities += s.facilities;
      traded += s.tradedThisYear;
      value += s.tnCredits * s.avgPrice.tn + s.tpCredits * s.avgPrice.tp;
    }
    return { tn, tp, sed, facilities, traded, value };
  }, [sectors]);

  if (!hasProgram) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-400">
            {stateAbbr} does not currently have an active water quality trading program.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <ArrowRightLeft className="w-3.5 h-3.5" />
        <span>{info.name}</span>
        <MockDataBadge />
      </div>

      {/* ── Hero Program Card ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-green-50 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-emerald-600" />
              {info.name}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {info.agency} ({info.agencyAbbr})
              {info.watershed && <span className="ml-1">&#x2022; {info.watershed} Watershed</span>}
              <span className="ml-1">&#x2022;</span>
              <span className={`ml-1 font-semibold ${info.maturity === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {info.maturity === 'active' ? 'Active Program' : 'Emerging Program'}
              </span>
            </p>
          </div>
          <a
            href={info.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-medium bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-200 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            {info.agencyAbbr} Portal
          </a>
        </div>

        {/* Hero KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'TN Credits', value: formatNumber(totals.tn), sub: 'Total Nitrogen', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { label: 'TP Credits', value: formatNumber(totals.tp), sub: 'Total Phosphorus', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
            { label: 'Sediment', value: formatNumber(totals.sed), sub: 'TSS Credits', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Facilities', value: formatNumber(totals.facilities), sub: 'Registered', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
            { label: 'Traded YTD', value: formatNumber(totals.traded), sub: 'Credits moved', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
            { label: 'Market Value', value: formatCurrency(totals.value), sub: 'Est. portfolio', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          ].map(kpi => (
            <div key={kpi.label} className={`rounded-lg border p-3 ${kpi.bg}`}>
              <div className={`text-lg font-bold ${kpi.color} tabular-nums`}>{kpi.value}</div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{kpi.label}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Nutrient chips */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-slate-500 font-medium">Traded nutrients:</span>
          {info.nutrients.map(n => (
            <span key={n} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 capitalize">
              {n}
            </span>
          ))}
          <span className="text-[10px] text-slate-500 font-medium ml-2">Sectors:</span>
          {info.sectors.map(s => {
            const meta = SECTOR_META[s];
            return (
              <span key={s} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.iconBg} ${meta.iconTx}`}>
                {meta.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Credit Sectors Breakdown ───────────────────────────────────── */}
      <DashboardSection
        title="Credit Sectors"
        subtitle={`${sectors.length} active sectors generating credits`}
        accent="green"
        icon={<BarChart3 className="w-4 h-4" />}
        defaultExpanded
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {sectors.map(s => {
            const Icon = s.icon;
            const isExpanded = expandedSector === s.sector;
            return (
              <div
                key={s.sector}
                className={`rounded-lg border ${s.borderColor} bg-white hover:shadow-sm transition-all cursor-pointer`}
                onClick={() => setExpandedSector(isExpanded ? null : s.sector)}
              >
                <div className="p-3">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${s.iconTx}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800">{s.label}</div>
                      <div className="text-[10px] text-slate-400">{s.facilities} registered facilities</div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                      : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    }
                  </div>

                  {/* Credit bars */}
                  <div className="space-y-1.5">
                    {s.tnCredits > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-slate-500">TN</span>
                          <span className="font-semibold text-green-700">{formatNumber(s.tnCredits)} credits</span>
                        </div>
                        <div className="h-1.5 bg-green-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min((s.tnCredits / Math.max(totals.tn, 1)) * 100, 100)}%` }} />
                        </div>
                      </div>
                    )}
                    {s.tpCredits > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-slate-500">TP</span>
                          <span className="font-semibold text-blue-700">{formatNumber(s.tpCredits)} credits</span>
                        </div>
                        <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((s.tpCredits / Math.max(totals.tp, 1)) * 100, 100)}%` }} />
                        </div>
                      </div>
                    )}
                    {s.sedimentCredits > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-slate-500">Sediment</span>
                          <span className="font-semibold text-amber-700">{formatNumber(s.sedimentCredits)} credits</span>
                        </div>
                        <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min((s.sedimentCredits / Math.max(totals.sed, 1)) * 100, 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-3 bg-slate-50/50 space-y-2">
                    <p className="text-[10px] text-slate-500">{s.description}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-[10px]">
                        <span className="text-slate-400">Avg TN Price</span>
                        <div className="font-semibold text-slate-700">${s.avgPrice.tn}/credit</div>
                      </div>
                      <div className="text-[10px]">
                        <span className="text-slate-400">Avg TP Price</span>
                        <div className="font-semibold text-slate-700">${s.avgPrice.tp}/credit</div>
                      </div>
                      <div className="text-[10px]">
                        <span className="text-slate-400">Traded This Year</span>
                        <div className="font-semibold text-indigo-700">{formatNumber(s.tradedThisYear)} credits</div>
                      </div>
                      <div className="text-[10px]">
                        <span className="text-slate-400">Est. Sector Value</span>
                        <div className="font-semibold text-emerald-700">{formatCurrency(s.tnCredits * s.avgPrice.tn + s.tpCredits * s.avgPrice.tp)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DashboardSection>

      {/* ── Trading Marketplace ────────────────────────────────────────── */}
      <DashboardSection
        title="Trading Marketplace"
        subtitle={`${filteredListings.length}${filteredListings.length !== listings.length ? ' filtered' : ''} of ${listings.length} active listings`}
        accent="indigo"
        icon={<CircleDollarSign className="w-4 h-4" />}
        defaultExpanded
      >
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 mt-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <select
            value={sectorFilter}
            onChange={e => setSectorFilter(e.target.value as CreditSector | 'all')}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300"
          >
            <option value="all">All Sectors</option>
            {sectors.map(s => (
              <option key={s.sector} value={s.sector}>{s.label}</option>
            ))}
          </select>
          <select
            value={nutrientFilter}
            onChange={e => setNutrientFilter(e.target.value as 'all' | 'TN' | 'TP' | 'Sediment')}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300"
          >
            <option value="all">All Nutrients</option>
            <option value="TN">Nitrogen (TN)</option>
            <option value="TP">Phosphorus (TP)</option>
            <option value="Sediment">Sediment</option>
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search seller or BMP..."
              value={marketSearch}
              onChange={e => setMarketSearch(e.target.value)}
              className="text-xs border border-slate-200 rounded-md pl-7 pr-2 py-1.5 w-48 bg-white text-slate-700 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300"
            />
          </div>
        </div>

        {/* Listings table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-2.5 py-2">Seller</th>
                <th className="px-2.5 py-2">Sector</th>
                <th className="px-2.5 py-2">Nutrient</th>
                <th className="px-2.5 py-2 text-right">Credits</th>
                <th className="px-2.5 py-2 text-right">$/Credit</th>
                <th className="px-2.5 py-2 text-right">Total</th>
                <th className="px-2.5 py-2">BMP Type</th>
                <th className="px-2.5 py-2 text-center">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredListings.map(l => {
                const meta = SECTOR_META[l.sector];
                return (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-2.5 py-2">
                      <div className="font-medium text-slate-700">{l.seller}</div>
                      <div className="text-[10px] text-slate-400">{l.location}</div>
                    </td>
                    <td className="px-2.5 py-2">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${meta.iconBg} ${meta.iconTx}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        l.nutrient === 'TN' ? 'bg-green-100 text-green-700' :
                        l.nutrient === 'TP' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {l.nutrient}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-right font-semibold text-slate-700 tabular-nums">
                      {l.credits.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-right text-slate-600 tabular-nums">
                      ${l.pricePerCredit}
                    </td>
                    <td className="px-2.5 py-2 text-right font-semibold text-emerald-700 tabular-nums">
                      {formatCurrency(l.credits * l.pricePerCredit)}
                    </td>
                    <td className="px-2.5 py-2 text-slate-500 max-w-[150px] truncate">{l.bmpType}</td>
                    <td className="px-2.5 py-2 text-center">
                      {l.verified ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-[9px] text-slate-400">Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredListings.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2.5 py-6 text-center text-slate-400 text-xs">
                    No listings match current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      {/* ── PIN Integration Note (MS4/Local mode) ─────────────────────── */}
      {(mode === 'ms4' || mode === 'local') && (
        <DashboardSection
          title="PIN Credit Certification Status"
          subtitle="Pathway to generating tradeable credits"
          accent="cyan"
          icon={<ShieldCheck className="w-4 h-4" />}
          defaultExpanded={false}
        >
          <div className="mt-3 space-y-2">
            {[
              { step: 1, label: 'BMP Registration', status: 'in-progress', detail: 'PIN filed as nature-based BMP with provisional patent documentation' },
              { step: 2, label: 'Approved Monitoring Plan', status: 'in-progress', detail: 'QAPP submitted; exceeds minimum monitoring requirements' },
              { step: 3, label: 'Verified BMP Efficiency', status: 'pending', detail: 'Requires 12+ months validated deployment data' },
              { step: 4, label: 'Third-Party Credit Verification', status: 'pending', detail: 'Independent verifier confirms credit quantities' },
              { step: 5, label: `${info.agencyAbbr} Certification`, status: 'pending', detail: `${info.agencyAbbr} issues tradeable credit certificate` },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-100 bg-white">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  s.status === 'in-progress' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                  'bg-slate-100 text-slate-400 border border-slate-200'
                }`}>
                  {s.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">{s.label}</span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                      s.status === 'in-progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {s.status === 'in-progress' ? 'In Progress' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
            <Info className="w-3 h-3 shrink-0" />
            No PIN nutrient credits are currently certified, banked, or tradeable. Values shown are projected estimates for planning.
          </p>
        </DashboardSection>
      )}

      {/* ── Program Info Footer ────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <div className="text-[10px] text-slate-500 space-y-1">
            <p>
              <span className="font-semibold text-slate-600">Regulatory basis:</span> Certified credits can be used to meet NPDES permit requirements.
              {stateAbbr === 'MD' && ' Governed by COMAR 26.08.11 Trading Regulations.'}
              {stateAbbr === 'MD' && ' Agricultural credits certified by MDA via mdnutrienttrading.com; all other sectors certified by MDE.'}
            </p>
            <p>
              All data shown is for demonstration purposes. Actual trading requires registration with{' '}
              <a href={info.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline hover:text-indigo-800 font-medium">
                {info.name}
              </a>,
              third-party BMP verification, and compliance with watershed-specific trading ratios.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
