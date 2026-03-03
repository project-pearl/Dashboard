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
  jurisdictionName?: string;
  permitNumber?: string;
  permitType?: 'Phase I' | 'Phase II' | string;
  watersheds?: string[];
  className?: string;
}

type Nutrient = 'TN' | 'TP' | 'Sediment';

interface ObligationRow {
  nutrient: Nutrient;
  required: number;
  achieved: number;
  remaining: number;
  owned: number;
  needed: number;
  marketRate: number;
  buildRateLow: number;
  buildRateHigh: number;
}

interface PortfolioRow {
  source: string;
  sector: CreditSector;
  nutrient: Nutrient;
  credits: number;
  status: 'Active' | 'Pending Verification' | 'Expiring';
  expiration: string;
  notes: string;
}

interface LocalMarketRow extends MarketListing {
  watershed: string;
  distance: 'Same Watershed' | 'Adjacent' | 'Regional';
  relevance: number;
}

interface PriceHistoryPoint {
  month: string;
  TN: number;
  TP: number;
  Sediment: number;
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

function obligationStatus(required: number, achieved: number): 'green' | 'yellow' | 'red' {
  if (required <= 0 || achieved >= required) return 'green';
  const pct = achieved / required;
  if (pct >= 0.8) return 'yellow';
  return 'red';
}

function confidenceTier(required: number, achieved: number): 'High' | 'Moderate' | 'Low' {
  if (required > 0 && achieved > 0) return 'High';
  if (required > 0) return 'Moderate';
  return 'Low';
}

function shortWatershedName(raw: string): string {
  return raw
    .replace(/^maryland_/i, '')
    .replace(/^virginia_/i, '')
    .replace(/^dc_/i, '')
    .replace(/^pennsylvania_/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+River$/i, ' River');
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

function generateLocalObligations(): ObligationRow[] {
  return [
    {
      nutrient: 'TN',
      required: 2400,
      achieved: 1680,
      remaining: 720,
      owned: 520,
      needed: 200,
      marketRate: 49,
      buildRateLow: 45,
      buildRateHigh: 65,
    },
    {
      nutrient: 'TP',
      required: 340,
      achieved: 290,
      remaining: 50,
      owned: 28,
      needed: 22,
      marketRate: 74,
      buildRateLow: 65,
      buildRateHigh: 90,
    },
    {
      nutrient: 'Sediment',
      required: 4200,
      achieved: 3800,
      remaining: 400,
      owned: 230,
      needed: 170,
      marketRate: 26,
      buildRateLow: 22,
      buildRateHigh: 36,
    },
  ];
}

function generateLocalPortfolio(): PortfolioRow[] {
  return [
    {
      source: 'Magothy Run Stream Restoration',
      sector: 'stormwater',
      nutrient: 'TN',
      credits: 142,
      status: 'Active',
      expiration: '2028',
      notes: 'County CIP project',
    },
    {
      source: 'Lake Waterford BMP Retrofit',
      sector: 'stormwater',
      nutrient: 'TP',
      credits: 87,
      status: 'Active',
      expiration: '2029',
      notes: 'Grant-funded',
    },
    {
      source: 'Purchased: Regional WWTP Authority',
      sector: 'wastewater',
      nutrient: 'TN',
      credits: 200,
      status: 'Active',
      expiration: '2027',
      notes: 'Traded Q2 2025',
    },
    {
      source: 'Septic BAT Conversion Bundle',
      sector: 'septic',
      nutrient: 'TN',
      credits: 95,
      status: 'Pending Verification',
      expiration: '2028',
      notes: 'Verification package in review',
    },
    {
      source: 'South River Shoreline Wetland',
      sector: 'aquaculture',
      nutrient: 'Sediment',
      credits: 230,
      status: 'Active',
      expiration: '2030',
      notes: 'Joint project with local land trust',
    },
  ];
}

function generateLocalPriceHistory(): PriceHistoryPoint[] {
  return [
    { month: 'Apr', TN: 43, TP: 69, Sediment: 24 },
    { month: 'May', TN: 44, TP: 71, Sediment: 24 },
    { month: 'Jun', TN: 45, TP: 72, Sediment: 25 },
    { month: 'Jul', TN: 47, TP: 74, Sediment: 25 },
    { month: 'Aug', TN: 48, TP: 76, Sediment: 26 },
    { month: 'Sep', TN: 47, TP: 75, Sediment: 26 },
    { month: 'Oct', TN: 49, TP: 77, Sediment: 26 },
    { month: 'Nov', TN: 50, TP: 79, Sediment: 27 },
    { month: 'Dec', TN: 51, TP: 80, Sediment: 27 },
    { month: 'Jan', TN: 50, TP: 79, Sediment: 26 },
    { month: 'Feb', TN: 49, TP: 78, Sediment: 26 },
    { month: 'Mar', TN: 49, TP: 74, Sediment: 26 },
  ];
}

// ── Component ────────────────────────────────────────────────────────────────

export function WaterQualityTradingPanel({
  stateAbbr,
  mode = 'state',
  jurisdictionName,
  permitNumber,
  permitType,
  watersheds,
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

  const jurisdictionLabel = jurisdictionName || 'Anne Arundel County';
  const permitLabel = permitNumber || '20-DP-3310';
  const permitPhase = permitType || 'Phase I MS4';
  const localWatersheds = (watersheds && watersheds.length > 0
    ? watersheds.map(shortWatershedName)
    : ['Severn River', 'South River', 'Patuxent River']);

  const localObligations = useMemo(() => generateLocalObligations(), []);
  const localPortfolio = useMemo(() => generateLocalPortfolio(), []);
  const localPriceHistory = useMemo(() => generateLocalPriceHistory(), []);

  const localTotals = useMemo(() => {
    const byNutrient: Record<Nutrient, number> = { TN: 0, TP: 0, Sediment: 0 };
    for (const row of localPortfolio) byNutrient[row.nutrient] += row.credits;
    const marketGapCost = localObligations.reduce((sum, o) => sum + o.needed * o.marketRate, 0);
    return { byNutrient, marketGapCost };
  }, [localPortfolio, localObligations]);

  const localMarket = useMemo<LocalMarketRow[]>(() => {
    const seeded = generateMarketListings(stateAbbr).slice(0, 10);
    const watershedCycle = [...localWatersheds, 'Patapsco River', 'Chesapeake Bay Mainstem'];
    const neededNutrients = new Set(localObligations.filter(o => o.needed > 0).map(o => o.nutrient));
    const enriched = seeded.map((row, idx) => {
      const distance: LocalMarketRow['distance'] =
        idx % 3 === 0 ? 'Same Watershed' : idx % 3 === 1 ? 'Adjacent' : 'Regional';
      const relevance = (distance === 'Same Watershed' ? 90 : distance === 'Adjacent' ? 75 : 58)
        + (neededNutrients.has(row.nutrient) ? 8 : -12)
        + (row.verified ? 4 : -4);
      return {
        ...row,
        watershed: watershedCycle[idx % watershedCycle.length],
        distance,
        relevance: Math.max(40, Math.min(99, relevance)),
      };
    });
    return enriched
      .filter((row) => neededNutrients.has(row.nutrient))
      .filter((row) => row.distance !== 'Regional' || row.verified)
      .sort((a, b) => (b.relevance - a.relevance) || (a.pricePerCredit - b.pricePerCredit))
      .slice(0, 7);
  }, [stateAbbr, localWatersheds, localObligations]);

  const buildVsBuy = useMemo(() => {
    return localObligations
      .filter((o) => o.needed > 0)
      .map((o) => {
        const buildRateMid = (o.buildRateLow + o.buildRateHigh) / 2;
        const buildCost = o.needed * buildRateMid;
        const buyCost = o.needed * o.marketRate;
        const blendedCost = buildCost * 0.6 + buyCost * 0.4;
        const buildFiveYear = buildCost + (Math.max(0.06 * buildCost, 12000) * 5);
        const buyFiveYear = buyCost * 1.15;
        const blendedSavings = Math.round(Math.max(0, Math.min(buildFiveYear, buyFiveYear) - blendedCost));
        return {
          nutrient: o.nutrient,
          needed: o.needed,
          buildRateMid,
          buildCost,
          buyCost,
          blendedCost,
          blendedSavings,
        };
      });
  }, [localObligations]);

  const trendDirection = useMemo(() => {
    const head = localPriceHistory[0];
    const tail = localPriceHistory[localPriceHistory.length - 1];
    const avgDelta = ((tail.TN - head.TN) + (tail.TP - head.TP) + (tail.Sediment - head.Sediment)) / 3;
    if (avgDelta > 1.5) return 'up';
    if (avgDelta < -1.5) return 'down';
    return 'stable';
  }, [localPriceHistory]);

  if (mode !== 'state') {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>{info?.name || 'Water Quality Trading Program'}</span>
          <MockDataBadge />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">{jurisdictionLabel}</h3>
              <p className="text-xs text-slate-500 mt-1">
                Permit <span className="font-mono font-semibold text-slate-700">{permitLabel}</span>
                <span className="mx-1.5">|</span>
                <span className="inline-flex rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-semibold">{permitPhase}</span>
                <span className="mx-1.5">|</span>
                {localWatersheds.join(', ')}
              </p>
            </div>
            <a
              href={info?.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <ExternalLink className="w-3 h-3" />
              MDE Trading Program
            </a>
          </div>
        </div>

        <DashboardSection title="TMDL Obligation Summary" subtitle="Jurisdiction-specific reduction gap and planning costs" icon={<TrendingUp className="w-4 h-4" />} accent="blue" defaultExpanded>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-3">
            {[
              ...localObligations.map((o) => {
                const status = obligationStatus(o.required, o.achieved);
                const style = status === 'green'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : status === 'yellow'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-red-50 border-red-200 text-red-700';
                return {
                  key: o.nutrient,
                  label: `${o.nutrient} Required`,
                  value: `${formatNumber(o.remaining)} left`,
                  sub: `${formatNumber(o.achieved)} of ${formatNumber(o.required)} achieved`,
                  style,
                };
              }),
              {
                key: 'owned',
                label: 'Credits Owned',
                value: formatNumber(localTotals.byNutrient.TN + localTotals.byNutrient.TP + localTotals.byNutrient.Sediment),
                sub: `TN ${formatNumber(localTotals.byNutrient.TN)} | TP ${formatNumber(localTotals.byNutrient.TP)} | Sed ${formatNumber(localTotals.byNutrient.Sediment)}`,
                style: 'bg-slate-50 border-slate-200 text-slate-700',
              },
              {
                key: 'needed',
                label: 'Credits Needed',
                value: formatNumber(localObligations.reduce((s, o) => s + o.needed, 0)),
                sub: 'Gap between owned and required',
                style: 'bg-amber-50 border-amber-200 text-amber-700',
              },
              {
                key: 'cost',
                label: 'Est. Cost to Close Gap',
                value: formatCurrency(localTotals.marketGapCost),
                sub: 'At current market rates',
                style: 'bg-indigo-50 border-indigo-200 text-indigo-700',
              },
            ].map((card) => (
              <div key={card.key} className={`rounded-lg border p-3 ${card.style}`}>
                <div className="text-lg font-bold">{card.value}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide">{card.label}</div>
                <div className="text-[10px] mt-1 opacity-80">{card.sub}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px] text-slate-500">
            <Info className="w-3 h-3" />
            {localObligations.map((o) => (
              <span key={o.nutrient} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5">
                {o.nutrient} confidence: {confidenceTier(o.required, o.achieved)}
              </span>
            ))}
          </div>
        </DashboardSection>

        <DashboardSection title="Your Credit Portfolio" subtitle="Credits currently held or generated by jurisdiction projects" icon={<ShieldCheck className="w-4 h-4" />} accent="green" defaultExpanded>
          <div className="overflow-x-auto rounded-lg border border-slate-200 mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-2.5 py-2">Source</th>
                  <th className="px-2.5 py-2">Sector</th>
                  <th className="px-2.5 py-2">Nutrient</th>
                  <th className="px-2.5 py-2 text-right">Credits</th>
                  <th className="px-2.5 py-2">Status</th>
                  <th className="px-2.5 py-2">Expiration</th>
                  <th className="px-2.5 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localPortfolio.map((row, idx) => {
                  const sectorMeta = SECTOR_META[row.sector];
                  return (
                    <tr key={`${row.source}-${idx}`} className="hover:bg-slate-50">
                      <td className="px-2.5 py-2 font-medium text-slate-700">{row.source}</td>
                      <td className="px-2.5 py-2">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${sectorMeta.iconBg} ${sectorMeta.iconTx}`}>
                          {sectorMeta.label}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">{row.nutrient}</td>
                      <td className="px-2.5 py-2 text-right font-semibold">{row.credits.toLocaleString()}</td>
                      <td className="px-2.5 py-2">{row.status}</td>
                      <td className="px-2.5 py-2">{row.expiration}</td>
                      <td className="px-2.5 py-2 text-slate-500">{row.notes}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-semibold text-slate-700">
                  <td className="px-2.5 py-2" colSpan={3}>Portfolio Totals</td>
                  <td className="px-2.5 py-2 text-right">
                    TN {localTotals.byNutrient.TN.toLocaleString()} | TP {localTotals.byNutrient.TP.toLocaleString()} | Sed {localTotals.byNutrient.Sediment.toLocaleString()}
                  </td>
                  <td className="px-2.5 py-2" colSpan={3}>Planning intelligence only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </DashboardSection>

        <DashboardSection title="Build vs. Buy Comparison" subtitle="Close nutrient gaps using project delivery, market purchases, or blended strategy" icon={<DollarSign className="w-4 h-4" />} accent="indigo" defaultExpanded>
          <div className="space-y-3 mt-3">
            {buildVsBuy.map((row) => (
              <div key={row.nutrient} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800">{row.nutrient} Gap: {row.needed.toLocaleString()} credits</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Scenario Planner ready</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="text-xs font-semibold text-blue-700 mb-1">Build Your Own BMPs</div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div>Estimated cost per credit: ${row.buildRateMid.toFixed(0)} (${localObligations.find(o => o.nutrient === row.nutrient)?.buildRateLow}-${localObligations.find(o => o.nutrient === row.nutrient)?.buildRateHigh})</div>
                      <div>Timeline: 18-30 months (design, permitting, construction, certification)</div>
                      <div>Total cost to close gap: <span className="font-semibold">{formatCurrency(row.buildCost)}</span></div>
                      <div>Maintenance: {formatCurrency(Math.max(12000, row.buildCost * 0.06))}/yr</div>
                      <div>Co-benefits: flood reduction, habitat gains, property value resilience, permit margin</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs font-semibold text-emerald-700 mb-1">Buy Credits on Market</div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div>Current market rate per credit: ${row.buildCost > 0 ? (row.buyCost / row.needed).toFixed(0) : '0'}</div>
                      <div>Available credits: {localMarket.filter(m => m.nutrient === row.nutrient).reduce((s, m) => s + m.credits, 0).toLocaleString()} in eligible watersheds</div>
                      <div>Total cost to close gap: <span className="font-semibold">{formatCurrency(row.buyCost)}</span></div>
                      <div>Timeline: immediate once purchased and certified</div>
                      <div>Risks: availability, price volatility, credit expiration windows</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-[11px] text-slate-700">
                  <span className="font-semibold text-indigo-700">Blended strategy recommendation:</span> Build 60% / Buy 40% at an estimated {formatCurrency(row.blendedCost)} now, with potential 5-year savings of {formatCurrency(row.blendedSavings)} versus build-only.
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10px] text-amber-900">
            Export guardrail: Build vs. Buy values are planning-level intelligence and are excluded from PDF export. Use Controlled Export templates for grant or budget packets.
          </div>
        </DashboardSection>

        <DashboardSection title="Available Market (Jurisdiction-Relevant)" subtitle="Filtered to needed nutrients and trading-eligible watershed proximity" icon={<CircleDollarSign className="w-4 h-4" />} accent="teal" defaultExpanded>
          <div className="overflow-x-auto rounded-lg border border-slate-200 mt-3">
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
                  <th className="px-2.5 py-2">Watershed</th>
                  <th className="px-2.5 py-2">Distance</th>
                  <th className="px-2.5 py-2 text-right">Relevance</th>
                  <th className="px-2.5 py-2 text-center">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localMarket.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-2.5 py-2 font-medium text-slate-700">{row.seller}</td>
                    <td className="px-2.5 py-2">{SECTOR_META[row.sector].label}</td>
                    <td className="px-2.5 py-2">{row.nutrient}</td>
                    <td className="px-2.5 py-2 text-right">{row.credits.toLocaleString()}</td>
                    <td className="px-2.5 py-2 text-right">${row.pricePerCredit}</td>
                    <td className="px-2.5 py-2 text-right">{formatCurrency(row.credits * row.pricePerCredit)}</td>
                    <td className="px-2.5 py-2 text-slate-500">{row.bmpType}</td>
                    <td className="px-2.5 py-2 text-slate-500">{row.watershed}</td>
                    <td className="px-2.5 py-2">{row.distance}</td>
                    <td className="px-2.5 py-2 text-right font-semibold text-indigo-700">{row.relevance}</td>
                    <td className="px-2.5 py-2 text-center">{row.verified ? 'Yes' : 'Pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        <DashboardSection title="Compliance Timeline" subtitle="Permit milestones, credit expirations, and projected gap exposure" icon={<TrendingUp className="w-4 h-4" />} accent="purple" defaultExpanded>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <div className="relative h-10">
              <div className="absolute left-0 right-0 top-5 h-1 bg-slate-200 rounded-full" />
              <div className="absolute left-[8%] top-4.5 h-2 w-2 rounded-full bg-green-500" title="Permit year 1 start" />
              <div className="absolute left-[32%] top-4.5 h-2 w-2 rounded-full bg-blue-500" title="TMDL Milestone A" />
              <div className="absolute left-[56%] top-4.5 h-2 w-2 rounded-full bg-amber-500" title="Credit expiration cluster" />
              <div className="absolute left-[76%] top-4.5 h-2 w-2 rounded-full bg-indigo-500" title="Planned BMP online" />
              <div className="absolute left-[92%] top-4.5 h-2 w-2 rounded-full bg-red-500" title="Permit closeout milestone" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[10px] text-slate-600 mt-1">
              <div>2026 Q2 Permit Year 1</div>
              <div>2027 Q2 Mid-Term TMDL Check</div>
              <div>2028 Q1 Credit Expiration Risk</div>
              <div>2028 Q4 BMP On-line Milestone</div>
              <div>2030 Permit Closeout</div>
            </div>
            <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-[10px] text-red-800">
              Gap exposure window projected in 2028 if replacement TN credits are not secured before current purchased credits expire.
            </div>
          </div>
        </DashboardSection>

        <DashboardSection title="Cost History & Trends" subtitle="12-month market prices with jurisdiction purchase context" icon={<BarChart3 className="w-4 h-4" />} accent="cyan" defaultExpanded={false}>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] mb-3">
              <div className="rounded border border-green-200 bg-green-50 p-2">TN trend: {trendDirection === 'up' ? 'Up' : trendDirection === 'down' ? 'Down' : 'Stable'}</div>
              <div className="rounded border border-blue-200 bg-blue-50 p-2">TP latest: ${localPriceHistory[localPriceHistory.length - 1].TP}/credit</div>
              <div className="rounded border border-amber-200 bg-amber-50 p-2">Sediment latest: ${localPriceHistory[localPriceHistory.length - 1].Sediment}/credit</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left py-1">Month</th>
                    <th className="text-right py-1">TN</th>
                    <th className="text-right py-1">TP</th>
                    <th className="text-right py-1">Sediment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {localPriceHistory.map((p) => (
                    <tr key={p.month}>
                      <td className="py-1 text-slate-600">{p.month}</td>
                      <td className="py-1 text-right">{p.TN}</td>
                      <td className="py-1 text-right">{p.TP}</td>
                      <td className="py-1 text-right">{p.Sediment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DashboardSection>
      </div>
    );
  }

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
      {false && (
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
