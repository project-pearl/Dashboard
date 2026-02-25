'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sprout, Droplets, AlertTriangle, BarChart3 } from 'lucide-react';

// ── Props ───────────────────────────────────────────────────────────────────

interface AgriculturalNPSPanelProps {
  stateRollup: Array<{
    abbr: string;
    name: string;
    high: number;
    medium: number;
    low: number;
    none: number;
    totalImpaired: number;
    assessed: number;
    waterbodies: number;
    topCauses: Array<{ cause: string; count: number }>;
    cat5: number;
    cat4a: number;
    cat4b: number;
    cat4c: number;
    canGradeState: boolean;
  }>;
  attainsBulk: Record<string, Array<{
    name: string;
    category: string;
    alertLevel: 'high' | 'medium' | 'low' | 'none';
    causes: string[];
    cycle: string;
  }>>;
  selectedState: string;
}

// ── Ag-related cause terms ──────────────────────────────────────────────────

const NUTRIENT_TERMS = [
  'nutrient', 'nitrogen', 'phosphorus', 'total phosphorus', 'nitrate', 'ammonia',
] as const;

const SEDIMENT_TERMS = [
  'sediment', 'siltation', 'sedimentation', 'turbidity', 'total suspended solids',
] as const;

const PESTICIDE_OTHER_TERMS = [
  'pesticide', 'herbicide', 'organic enrichment',
  'algal growth', 'noxious aquatic plants',
  'e. coli', 'fecal coliform', 'enterococcus',
] as const;

const ALL_AG_TERMS = [
  ...NUTRIENT_TERMS,
  ...SEDIMENT_TERMS,
  ...PESTICIDE_OTHER_TERMS,
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function matchesTerm(cause: string, term: string): boolean {
  return cause.toLowerCase().includes(term);
}

function isAgCause(cause: string): boolean {
  return ALL_AG_TERMS.some((term) => matchesTerm(cause, term));
}

function classifyCause(cause: string): 'nutrient' | 'sediment' | 'pesticide_other' | null {
  const lower = cause.toLowerCase();
  if (NUTRIENT_TERMS.some((t) => lower.includes(t))) return 'nutrient';
  if (SEDIMENT_TERMS.some((t) => lower.includes(t))) return 'sediment';
  if (PESTICIDE_OTHER_TERMS.some((t) => lower.includes(t))) return 'pesticide_other';
  return null;
}

function pct(n: number, d: number): string {
  if (d === 0) return '0.0';
  return ((n / d) * 100).toFixed(1);
}

function pctNum(n: number, d: number): number {
  if (d === 0) return 0;
  return (n / d) * 100;
}

// ── Component ───────────────────────────────────────────────────────────────

export function AgriculturalNPSPanel({
  stateRollup,
  attainsBulk,
  selectedState,
}: AgriculturalNPSPanelProps) {

  // ── Core computation: ag-related impairments from attainsBulk ───────────
  const agData = useMemo(() => {
    const stateKeys = selectedState
      ? [selectedState]
      : Object.keys(attainsBulk);

    let totalAgWaterbodies = 0;
    let nutrientCount = 0;
    let sedimentCount = 0;
    let pesticideOtherCount = 0;
    const causeCountMap: Record<string, number> = {};
    const stateAgCounts: Record<string, { agCount: number; totalImpaired: number; stateName: string }> = {};

    for (const stateKey of stateKeys) {
      const waterbodies = attainsBulk[stateKey];
      if (!waterbodies) continue;

      let stateAgCount = 0;

      for (const wb of waterbodies) {
        let hasAgCause = false;
        const seenCategories = new Set<string>();

        for (const cause of wb.causes) {
          if (isAgCause(cause)) {
            hasAgCause = true;
            // Count individual cause occurrences
            const normalized = cause.trim();
            causeCountMap[normalized] = (causeCountMap[normalized] || 0) + 1;

            // Classify into category (count each waterbody once per category)
            const cat = classifyCause(cause);
            if (cat && !seenCategories.has(cat)) {
              seenCategories.add(cat);
              if (cat === 'nutrient') nutrientCount++;
              else if (cat === 'sediment') sedimentCount++;
              else if (cat === 'pesticide_other') pesticideOtherCount++;
            }
          }
        }

        if (hasAgCause) {
          totalAgWaterbodies++;
          stateAgCount++;
        }
      }

      if (stateAgCount > 0) {
        const rollupEntry = stateRollup.find((s) => s.abbr === stateKey);
        stateAgCounts[stateKey] = {
          agCount: stateAgCount,
          totalImpaired: rollupEntry?.totalImpaired ?? waterbodies.length,
          stateName: rollupEntry?.name ?? stateKey,
        };
      }
    }

    // Build sorted cause list
    const topCauses = Object.entries(causeCountMap)
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count);

    // Build sorted state rankings
    const stateRankings = Object.entries(stateAgCounts)
      .map(([abbr, data]) => ({
        abbr,
        agCount: data.agCount,
        totalImpaired: data.totalImpaired,
        stateName: data.stateName,
        agPct: pctNum(data.agCount, data.totalImpaired),
      }))
      .sort((a, b) => b.agCount - a.agCount);

    const statesAffected = stateRankings.length;
    const totalAgCauses = nutrientCount + sedimentCount + pesticideOtherCount;

    return {
      totalAgWaterbodies,
      statesAffected,
      nutrientCount,
      sedimentCount,
      pesticideOtherCount,
      totalAgCauses,
      topCauses,
      stateRankings,
    };
  }, [attainsBulk, selectedState, stateRollup]);

  // ── Selected state detail ──────────────────────────────────────────────
  const selectedStateDetail = useMemo(() => {
    if (!selectedState || !attainsBulk[selectedState]) return null;

    const waterbodies = attainsBulk[selectedState];
    let agCount = 0;
    let nutrientCount = 0;
    let sedimentCount = 0;
    let pesticideOtherCount = 0;
    const causeMap: Record<string, number> = {};

    for (const wb of waterbodies) {
      let hasAg = false;
      const seenCategories = new Set<string>();

      for (const cause of wb.causes) {
        if (isAgCause(cause)) {
          hasAg = true;
          const normalized = cause.trim();
          causeMap[normalized] = (causeMap[normalized] || 0) + 1;

          const cat = classifyCause(cause);
          if (cat && !seenCategories.has(cat)) {
            seenCategories.add(cat);
            if (cat === 'nutrient') nutrientCount++;
            else if (cat === 'sediment') sedimentCount++;
            else if (cat === 'pesticide_other') pesticideOtherCount++;
          }
        }
      }
      if (hasAg) agCount++;
    }

    const rollupEntry = stateRollup.find((s) => s.abbr === selectedState);
    const totalImpaired = rollupEntry?.totalImpaired ?? waterbodies.length;

    const topCauses = Object.entries(causeMap)
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      abbr: selectedState,
      stateName: rollupEntry?.name ?? selectedState,
      agCount,
      totalImpaired,
      agPct: pctNum(agCount, totalImpaired),
      nutrientCount,
      sedimentCount,
      pesticideOtherCount,
      topCauses,
    };
  }, [attainsBulk, selectedState, stateRollup]);

  // ── Derived values for bars ────────────────────────────────────────────
  const categoryBarMax = useMemo(
    () => Math.max(1, agData.nutrientCount, agData.sedimentCount, agData.pesticideOtherCount),
    [agData]
  );

  const topCausesForTable = useMemo(
    () => agData.topCauses.slice(0, 15),
    [agData]
  );

  const topCauseMax = useMemo(
    () => Math.max(1, ...topCausesForTable.map((c) => c.count)),
    [topCausesForTable]
  );

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Sprout className="w-3.5 h-3.5" />
        <span>
          EPA ATTAINS — Agricultural &amp; Nonpoint Source Impairments
          {selectedState ? ` (${selectedState})` : ' (National)'}
        </span>
      </div>

      {/* ── Section 1: Hero Stats Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Ag-Related Impairments', value: agData.totalAgWaterbodies, iconBg: 'bg-green-50 border-green-200', iconColor: 'text-green-600', valueColor: 'text-slate-800', Icon: Sprout },
          { label: 'States Affected', value: agData.statesAffected, iconBg: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-600', valueColor: 'text-slate-800', Icon: BarChart3 },
          { label: 'Nutrient Impairments', value: agData.nutrientCount, iconBg: 'bg-indigo-50 border-indigo-200', iconColor: 'text-indigo-600', valueColor: 'text-indigo-700', Icon: Droplets },
          { label: 'Sediment Impairments', value: agData.sedimentCount, iconBg: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-600', valueColor: 'text-amber-700', Icon: AlertTriangle },
        ] as const).map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${stat.iconBg}`}>
                  <stat.Icon size={20} className={stat.iconColor} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${stat.valueColor}`}>
                    {stat.value.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                    {stat.label}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Section 2: Cause Category Breakdown ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 size={16} className="text-slate-600" />
            Cause Category Breakdown
            {agData.totalAgCauses > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {agData.totalAgCauses.toLocaleString()} total
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Agricultural impairments grouped by cause type
            {selectedState ? ` in ${selectedState}` : ' nationally'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agData.totalAgCauses === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              No agricultural-related impairment causes found in current ATTAINS data.
            </p>
          ) : (
            <div className="space-y-4">
              {([
                { label: 'Nutrients', count: agData.nutrientCount, bar: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700', icon: <Droplets size={14} className="text-blue-600 shrink-0" /> },
                { label: 'Sediment', count: agData.sedimentCount, bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700', icon: <AlertTriangle size={14} className="text-amber-600 shrink-0" /> },
                { label: 'Pesticides & Other', count: agData.pesticideOtherCount, bar: 'bg-green-500', badge: 'bg-green-100 text-green-700', icon: <Sprout size={14} className="text-green-600 shrink-0" /> },
              ] as const).map((cat) => {
                const widthPct = (cat.count / categoryBarMax) * 100;
                return (
                  <div key={cat.label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {cat.icon}
                        <span className="text-xs font-medium text-slate-700">{cat.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800 tabular-nums">
                          {cat.count.toLocaleString()}
                        </span>
                        <Badge className={`text-[9px] ${cat.badge}`}>
                          {pct(cat.count, agData.totalAgCauses)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="h-5 bg-slate-100 rounded-md overflow-hidden relative">
                      <div
                        className={`h-full rounded-md ${cat.bar} transition-all duration-500 ease-out`}
                        style={{ width: `${widthPct}%` }}
                      />
                      {cat.count > 0 && widthPct >= 15 && (
                        <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-semibold text-white">
                          {pct(cat.count, agData.totalAgCauses)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-slate-400 mt-1">
                Categories counted per waterbody — a waterbody with multiple nutrient causes counts once for Nutrients.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Top Ag Causes Detail Table ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sprout size={16} className="text-green-600" />
            Top Agricultural Causes
            {topCausesForTable.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                Top {topCausesForTable.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Individual ag-related causes ranked by waterbody count
            {selectedState ? ` in ${selectedState}` : ' across all states'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topCausesForTable.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              No agricultural-related causes found in current data.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="pb-2 font-semibold">#</th>
                    <th className="pb-2 font-semibold">Cause Name</th>
                    <th className="pb-2 font-semibold text-right">Waterbodies</th>
                    <th className="pb-2 font-semibold text-right">% of Ag Total</th>
                    <th className="pb-2 font-semibold w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {topCausesForTable.map((row, idx) => {
                    const barWidth = (row.count / topCauseMax) * 100;
                    const cat = classifyCause(row.cause);
                    const barColor =
                      cat === 'nutrient' ? 'bg-blue-400' :
                      cat === 'sediment' ? 'bg-amber-400' :
                      'bg-green-400';

                    return (
                      <tr
                        key={row.cause}
                        className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-2 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 font-medium text-slate-700">{row.cause}</td>
                        <td className="py-2 text-right font-semibold text-slate-800 tabular-nums">
                          {row.count.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-slate-600 tabular-nums">
                          {pct(row.count, agData.totalAgWaterbodies)}%
                        </td>
                        <td className="py-2 pl-3">
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor} transition-all duration-300`}
                              style={{ width: `${Math.max(barWidth, row.count > 0 ? 3 : 0)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4: State Rankings ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 size={16} className="text-blue-600" />
            State Rankings by Ag Impairments
          </CardTitle>
          <CardDescription>
            States ranked by number of agricultural-related impaired waterbodies
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agData.stateRankings.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              No states with agricultural-related impairments found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="pb-2 font-semibold">#</th>
                    <th className="pb-2 font-semibold">State</th>
                    <th className="pb-2 font-semibold text-right">Ag Impairments</th>
                    <th className="pb-2 font-semibold text-right">Total Impairments</th>
                    <th className="pb-2 font-semibold text-right">Ag % of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {agData.stateRankings.map((row, idx) => {
                    const isSelected = selectedState && row.abbr === selectedState;
                    return (
                      <tr
                        key={row.abbr}
                        className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-blue-50 border-blue-100' : ''
                        }`}
                      >
                        <td className="py-2 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-700">{row.abbr}</span>
                            <span className="text-slate-400">{row.stateName}</span>
                            {isSelected && (
                              <Badge className="text-[9px] bg-blue-100 text-blue-700 ml-1">
                                Selected
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-right font-semibold text-green-700 tabular-nums">
                          {row.agCount.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-slate-600 tabular-nums">
                          {row.totalImpaired.toLocaleString()}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-green-500"
                                style={{ width: `${Math.min(100, row.agPct)}%` }}
                              />
                            </div>
                            <span className="font-semibold text-slate-700 tabular-nums">
                              {row.agPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 5: Selected State Detail ─────────────────────────────────── */}
      {selectedStateDetail && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sprout size={16} className="text-green-600" />
              {selectedStateDetail.stateName} ({selectedStateDetail.abbr}) — Ag Detail
            </CardTitle>
            <CardDescription>
              Agricultural impairment breakdown for {selectedStateDetail.stateName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: 'Ag Impairments', value: selectedStateDetail.agCount.toLocaleString(), color: 'text-slate-800' },
                { label: 'Total Impairments', value: selectedStateDetail.totalImpaired.toLocaleString(), color: 'text-slate-800' },
                { label: 'Ag % of Total', value: `${selectedStateDetail.agPct.toFixed(1)}%`, color: 'text-green-700' },
              ] as const).map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 p-3 text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
            {/* Category split */}
            <div>
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Category Split</h4>
              {(() => {
                const catTotal = selectedStateDetail.nutrientCount + selectedStateDetail.sedimentCount + selectedStateDetail.pesticideOtherCount;
                const catMax = Math.max(1, selectedStateDetail.nutrientCount, selectedStateDetail.sedimentCount, selectedStateDetail.pesticideOtherCount);
                return [
                  { label: 'Nutrients', count: selectedStateDetail.nutrientCount, color: 'bg-blue-500', text: 'text-blue-700' },
                  { label: 'Sediment', count: selectedStateDetail.sedimentCount, color: 'bg-amber-500', text: 'text-amber-700' },
                  { label: 'Pesticides & Other', count: selectedStateDetail.pesticideOtherCount, color: 'bg-green-500', text: 'text-green-700' },
                ].map((cat) => (
                  <div key={cat.label} className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700">{cat.label}</span>
                      <span className={`text-xs font-semibold ${cat.text} tabular-nums`}>
                        {cat.count.toLocaleString()} ({pct(cat.count, catTotal)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cat.color}`} style={{ width: `${(cat.count / catMax) * 100}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
            {/* Top 10 causes */}
            <div>
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                Top 10 Ag Causes in {selectedStateDetail.abbr}
              </h4>
              {selectedStateDetail.topCauses.length === 0 ? (
                <p className="text-sm text-slate-500">No ag-related causes found.</p>
              ) : (
                <div className="space-y-2">
                  {selectedStateDetail.topCauses.map((row) => {
                    const stateMax = Math.max(1, selectedStateDetail.topCauses[0]?.count ?? 1);
                    const cat = classifyCause(row.cause);
                    const barColor = cat === 'nutrient' ? 'bg-blue-400' : cat === 'sediment' ? 'bg-amber-400' : 'bg-green-400';
                    return (
                      <div key={row.cause}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-slate-700 truncate flex-1 mr-2">{row.cause}</span>
                          <span className="text-xs font-semibold text-slate-800 tabular-nums shrink-0">{row.count.toLocaleString()}</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(row.count / stateMax) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
