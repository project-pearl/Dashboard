'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TreePine,
  Fish,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Leaf,
  Bug,
  ShieldAlert,
  Waves,
  BarChart3,
  Info,
} from 'lucide-react';
import { getEcoData, getAllEcoData, ecoScoreLabel } from '@/lib/ecologicalSensitivity';
import type { EcoStateData } from '@/lib/ecologicalSensitivity';

// ── Props ───────────────────────────────────────────────────────────────────

interface HabitatEcologyPanelProps {
  stateRollup: Array<{
    abbr: string;
    score: number;
    assessed: number;
    waterbodies: number;
    totalImpaired?: number;
    cat5?: number;
    cat4a?: number;
    cat4b?: number;
    cat4c?: number;
  }>;
  selectedState: string;
  attainsData: Record<
    string,
    Array<{
      name: string;
      category: string;
      alertLevel: string;
      causes: string[];
      cycle: string;
    }>
  >;
}

// ── Constants ───────────────────────────────────────────────────────────────

const HABITAT_CAUSE_TERMS = [
  'Habitat Alterations',
  'Hydrologic Alteration',
  'Flow Alteration',
  'Siltation',
  'Filling/Draining of Wetlands',
  'Habitat Assessment',
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function pct(n: number, d: number): string {
  if (d === 0) return '0.0';
  return ((n / d) * 100).toFixed(1);
}

function ecoScoreColor(score: number): string {
  if (score >= 80) return 'text-red-700 bg-red-50 border-red-200';
  if (score >= 60) return 'text-orange-700 bg-orange-50 border-orange-200';
  if (score >= 40) return 'text-amber-700 bg-amber-50 border-amber-200';
  if (score >= 20) return 'text-blue-700 bg-blue-50 border-blue-200';
  return 'text-slate-600 bg-slate-50 border-slate-200';
}

function ecoScoreBadgeVariant(score: number): string {
  if (score >= 80) return 'bg-red-100 text-red-700';
  if (score >= 60) return 'bg-orange-100 text-orange-700';
  if (score >= 40) return 'bg-amber-100 text-amber-700';
  if (score >= 20) return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}

function attainmentColor(rate: number): string {
  if (rate >= 80) return 'text-emerald-700';
  if (rate >= 60) return 'text-amber-700';
  if (rate >= 40) return 'text-orange-700';
  return 'text-red-700';
}

function attainmentBg(rate: number): string {
  if (rate >= 80) return 'bg-emerald-500';
  if (rate >= 60) return 'bg-amber-500';
  if (rate >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

type SortField = 'abbr' | 'assessed' | 'impaired' | 'rate' | 'ecoScore';
type SortDir = 'asc' | 'desc';

// ── Component ───────────────────────────────────────────────────────────────

export function HabitatEcologyPanel({
  stateRollup,
  selectedState,
  attainsData,
}: HabitatEcologyPanelProps) {
  const [tableSortField, setTableSortField] = useState<SortField>('rate');
  const [tableSortDir, setTableSortDir] = useState<SortDir>('asc');
  const [showAllStates, setShowAllStates] = useState(false);
  const [expandedSpeciesState, setExpandedSpeciesState] = useState<string | null>(null);

  // ── Scope-filtered rollup ──────────────────────────────────────────────
  const scopedRollup = useMemo(() => {
    if (!selectedState) return stateRollup;
    return stateRollup.filter(s => s.abbr === selectedState);
  }, [stateRollup, selectedState]);

  // ── Hero stat: % of assessed waterbodies meeting aquatic life use ───────
  const heroStats = useMemo(() => {
    const totalAssessed = scopedRollup.reduce((sum, s) => sum + s.waterbodies, 0);
    const meeting = scopedRollup.reduce(
      (sum, s) => sum + (s.score >= 3 ? s.waterbodies : 0),
      0
    );
    const meetingPct = totalAssessed > 0 ? (meeting / totalAssessed) * 100 : 0;
    const totalStates = scopedRollup.length;
    const impairedStates = scopedRollup.filter((s) => s.score < 3).length;
    return { totalAssessed, meeting, meetingPct, totalStates, impairedStates };
  }, [scopedRollup]);

  // ── State-by-state table data with eco scores ──────────────────────────
  const tableData = useMemo(() => {
    return stateRollup.map((s) => {
      // Use real ATTAINS impaired count when available, fall back to score-based estimate
      const impaired = s.totalImpaired ?? (s.score < 3 ? s.waterbodies : 0);
      // assessed should be at least as large as impaired (impairment = result of assessment)
      const assessed = Math.max(s.assessed, impaired);
      const attainmentRate =
        assessed > 0
          ? ((assessed - impaired) / assessed) * 100
          : 0;
      const eco = getEcoData(s.abbr);
      return {
        abbr: s.abbr,
        assessed,
        impaired,
        waterbodies: s.waterbodies,
        attainmentRate,
        ecoScore: eco?.score ?? 0,
        ecoLabel: eco ? ecoScoreLabel(eco.score) : 'N/A',
      };
    });
  }, [stateRollup]);

  const sortedTableData = useMemo(() => {
    const sorted = [...tableData].sort((a, b) => {
      let cmp = 0;
      switch (tableSortField) {
        case 'abbr':
          cmp = a.abbr.localeCompare(b.abbr);
          break;
        case 'assessed':
          cmp = a.assessed - b.assessed;
          break;
        case 'impaired':
          cmp = a.impaired - b.impaired;
          break;
        case 'rate':
          cmp = a.attainmentRate - b.attainmentRate;
          break;
        case 'ecoScore':
          cmp = a.ecoScore - b.ecoScore;
          break;
      }
      return tableSortDir === 'asc' ? cmp : -cmp;
    });
    return showAllStates ? sorted : sorted.slice(0, 15);
  }, [tableData, tableSortField, tableSortDir, showAllStates]);

  // ── Habitat-related impairment causes aggregation ─────────────────────
  const habitatCauseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const term of HABITAT_CAUSE_TERMS) {
      counts[term] = 0;
    }

    const stateKeys = selectedState
      ? [selectedState]
      : Object.keys(attainsData);

    for (const stateKey of stateKeys) {
      const waterbodies = attainsData[stateKey];
      if (!waterbodies) continue;
      for (const wb of waterbodies) {
        for (const cause of wb.causes) {
          for (const term of HABITAT_CAUSE_TERMS) {
            if (cause.toLowerCase().includes(term.toLowerCase())) {
              counts[term]++;
            }
          }
        }
      }
    }

    return Object.entries(counts)
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count);
  }, [attainsData, selectedState]);

  const maxCauseCount = useMemo(
    () => Math.max(1, ...habitatCauseCounts.map((c) => c.count)),
    [habitatCauseCounts]
  );

  const totalHabitatImpairments = useMemo(
    () => habitatCauseCounts.reduce((sum, c) => sum + c.count, 0),
    [habitatCauseCounts]
  );

  // ── T&E species data per state ────────────────────────────────────────
  const speciesData = useMemo(() => {
    const allEco = getAllEcoData();
    const stateAbbrs = selectedState
      ? [selectedState]
      : stateRollup.map((s) => s.abbr);

    return stateAbbrs
      .map((abbr) => allEco[abbr.toUpperCase()])
      .filter((d): d is EcoStateData => d !== undefined && d !== null)
      .sort((a, b) => b.score - a.score);
  }, [stateRollup, selectedState]);

  // ── Sort handler ──────────────────────────────────────────────────────
  function handleSort(field: SortField) {
    if (tableSortField === field) {
      setTableSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setTableSortField(field);
      setTableSortDir(field === 'abbr' ? 'asc' : 'desc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (tableSortField !== field) {
      return <ArrowUpDown size={12} className="text-slate-300 ml-1" />;
    }
    return tableSortDir === 'asc' ? (
      <ChevronUp size={12} className="text-slate-600 ml-1" />
    ) : (
      <ChevronDown size={12} className="text-slate-600 ml-1" />
    );
  }

  // ── Cause bar color ───────────────────────────────────────────────────
  function causeBarColor(cause: string): string {
    switch (cause) {
      case 'Habitat Alterations':
        return 'bg-red-500';
      case 'Siltation':
        return 'bg-amber-500';
      case 'Hydrologic Alteration':
        return 'bg-orange-500';
      case 'Flow Alteration':
        return 'bg-blue-500';
      case 'Filling/Draining of Wetlands':
        return 'bg-teal-500';
      case 'Habitat Assessment':
        return 'bg-purple-500';
      default:
        return 'bg-slate-400';
    }
  }

  function causeIcon(cause: string) {
    switch (cause) {
      case 'Habitat Alterations':
        return <TreePine size={14} className="text-red-600 shrink-0" />;
      case 'Siltation':
        return <Waves size={14} className="text-amber-600 shrink-0" />;
      case 'Hydrologic Alteration':
      case 'Flow Alteration':
        return <Waves size={14} className="text-blue-600 shrink-0" />;
      case 'Filling/Draining of Wetlands':
        return <Leaf size={14} className="text-teal-600 shrink-0" />;
      case 'Habitat Assessment':
        return <BarChart3 size={14} className="text-purple-600 shrink-0" />;
      default:
        return <AlertTriangle size={14} className="text-slate-500 shrink-0" />;
    }
  }

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <TreePine className="w-3.5 h-3.5" />
        <span>
          EPA ATTAINS + USFWS ECOS — Habitat &amp; Ecological Sensitivity
          {selectedState ? ` (${selectedState})` : ' (National)'}
        </span>
      </div>

      {/* ── Section 1: Hero Stat Card ──────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Main stat */}
            <div className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Fish size={28} className="text-emerald-600" />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${attainmentColor(heroStats.meetingPct)}`}>
                    {heroStats.meetingPct.toFixed(1)}%
                  </span>
                  <span className="text-sm text-slate-500">
                    of assessed waterbodies
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">
                  Meeting aquatic life use standards
                </p>
              </div>
            </div>

            {/* Supporting stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">
                  {heroStats.meeting.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Meeting
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">
                  {heroStats.totalAssessed.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Assessed
                </p>
              </div>
              {!selectedState && (
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800">
                    {heroStats.totalStates}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                    States
                  </p>
                </div>
              )}
              {heroStats.impairedStates > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-red-600">
                    {heroStats.impairedStates}
                  </p>
                  <p className="text-[10px] text-red-500 uppercase tracking-wide">
                    Below Threshold
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: State-by-State Aquatic Life Attainment Table ────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Fish size={16} className="text-emerald-600" />
            Aquatic Life Attainment by State
          </CardTitle>
          <CardDescription>
            Waterbody assessment status and ecological sensitivity scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th
                    className="pb-2 font-semibold cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleSort('abbr')}
                  >
                    <span className="inline-flex items-center">
                      State <SortIcon field="abbr" />
                    </span>
                  </th>
                  <th
                    className="pb-2 font-semibold text-right cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleSort('assessed')}
                  >
                    <span className="inline-flex items-center justify-end">
                      Assessed <SortIcon field="assessed" />
                    </span>
                  </th>
                  <th
                    className="pb-2 font-semibold text-right cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleSort('impaired')}
                  >
                    <span className="inline-flex items-center justify-end">
                      Impaired <SortIcon field="impaired" />
                    </span>
                  </th>
                  <th
                    className="pb-2 font-semibold text-right cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleSort('rate')}
                  >
                    <span className="inline-flex items-center justify-end">
                      Attainment Rate <SortIcon field="rate" />
                    </span>
                  </th>
                  <th
                    className="pb-2 font-semibold text-right cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleSort('ecoScore')}
                  >
                    <span className="inline-flex items-center justify-end">
                      Eco Score <SortIcon field="ecoScore" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTableData.map((row) => (
                  <tr
                    key={row.abbr}
                    className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                      selectedState && row.abbr === selectedState
                        ? 'bg-blue-50'
                        : ''
                    }`}
                  >
                    <td className="py-2 font-semibold text-slate-700">
                      {row.abbr}
                    </td>
                    <td className="py-2 text-right text-slate-600">
                      {row.assessed.toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={
                          row.impaired > 0
                            ? 'text-red-600 font-semibold'
                            : 'text-slate-500'
                        }
                      >
                        {row.impaired.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${attainmentBg(row.attainmentRate)}`}
                            style={{
                              width: `${Math.min(100, row.attainmentRate)}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`font-semibold ${attainmentColor(row.attainmentRate)}`}
                        >
                          {row.attainmentRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <Badge
                        className={`text-[10px] ${ecoScoreBadgeVariant(row.ecoScore)}`}
                      >
                        {row.ecoScore} - {row.ecoLabel}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Show more / less toggle */}
          {tableData.length > 15 && (
            <button
              onClick={() => setShowAllStates((p) => !p)}
              className="mt-3 w-full text-center text-xs text-blue-600 hover:text-blue-800 font-medium py-1.5 rounded-md hover:bg-blue-50 transition-colors"
            >
              {showAllStates
                ? `Show fewer states`
                : `Show all ${tableData.length} states`}
              {showAllStates ? (
                <ChevronUp size={12} className="inline ml-1" />
              ) : (
                <ChevronDown size={12} className="inline ml-1" />
              )}
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Habitat-Related Impairment Causes Bar Chart ─────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle size={16} className="text-amber-600" />
            Habitat-Related Impairment Causes
            {totalHabitatImpairments > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {totalHabitatImpairments.toLocaleString()} waterbodies
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Waterbodies impaired by habitat-related causes
            {selectedState ? ` in ${selectedState}` : ' nationally'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalHabitatImpairments === 0 ? (
            <div className="flex items-center gap-3 py-6">
              <Info size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500">
                No habitat-related impairment causes found in the current
                ATTAINS data{selectedState ? ` for ${selectedState}` : ''}.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {habitatCauseCounts.map(({ cause, count }) => {
                const widthPct =
                  maxCauseCount > 0 ? (count / maxCauseCount) * 100 : 0;
                return (
                  <div key={cause} className="group">
                    <div className="flex items-center gap-2 mb-1">
                      {causeIcon(cause)}
                      <span className="text-xs font-medium text-slate-700 flex-1">
                        {cause}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 tabular-nums">
                        {count.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-5 bg-slate-100 rounded-md overflow-hidden relative">
                      <div
                        className={`h-full rounded-md ${causeBarColor(cause)} transition-all duration-500 ease-out group-hover:opacity-90`}
                        style={{ width: `${Math.max(widthPct, count > 0 ? 2 : 0)}%` }}
                      />
                      {count > 0 && widthPct >= 12 && (
                        <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-semibold text-white">
                          {pct(count, totalHabitatImpairments)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Legend note */}
              <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                <Info size={10} />
                A single waterbody may have multiple habitat-related causes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4: T&E Species Indicator Cards ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bug size={16} className="text-rose-600" />
            Threatened &amp; Endangered Species
            <Badge variant="secondary" className="ml-1 text-[10px]">
              USFWS ECOS
            </Badge>
          </CardTitle>
          <CardDescription>
            ESA-listed species counts and ecological sensitivity
            {selectedState ? ` for ${selectedState}` : ' across priority states'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {speciesData.length === 0 ? (
            <div className="flex items-center gap-3 py-6">
              <Info size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500">
                No T&amp;E species data available for the selected area.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {speciesData.map((eco) => {
                const isExpanded = expandedSpeciesState === eco.abbr;
                const aquaticPct =
                  eco.totalTE > 0
                    ? ((eco.aquaticTE / eco.totalTE) * 100).toFixed(0)
                    : '0';
                const critPct =
                  eco.totalTE > 0
                    ? ((eco.criticalHabitat / eco.totalTE) * 100).toFixed(0)
                    : '0';

                return (
                  <div
                    key={eco.abbr}
                    className={`rounded-lg border p-3 transition-colors cursor-pointer hover:shadow-sm ${ecoScoreColor(eco.score)}`}
                    onClick={() =>
                      setExpandedSpeciesState(isExpanded ? null : eco.abbr)
                    }
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{eco.abbr}</span>
                        <Badge
                          className={`text-[9px] ${ecoScoreBadgeVariant(eco.score)}`}
                        >
                          {ecoScoreLabel(eco.score)}
                        </Badge>
                      </div>
                      <span className="text-lg font-bold">{eco.score}</span>
                    </div>

                    {/* Quick stats row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-sm font-bold">{eco.totalTE}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                          Total T&amp;E
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-700">
                          {eco.aquaticTE}
                        </p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                          Aquatic
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-rose-700">
                          {eco.criticalHabitat}
                        </p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                          Crit. Habitat
                        </p>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-current/10 space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="flex items-center gap-1">
                              <Fish size={10} />
                              Aquatic species ratio
                            </span>
                            <span className="font-semibold">{aquaticPct}%</span>
                          </div>
                          <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${aquaticPct}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="flex items-center gap-1">
                              <ShieldAlert size={10} />
                              Critical habitat coverage
                            </span>
                            <span className="font-semibold">{critPct}%</span>
                          </div>
                          <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-rose-500"
                              style={{ width: `${critPct}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-[10px] opacity-70 mt-1">
                          Eco Score is a 0-100 composite: 50% aquatic T&amp;E density,
                          25% total T&amp;E presence, 25% critical habitat density.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Attribution */}
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
            <Info size={10} />
            Source: USFWS ECOS — ESA-listed species by state (2024-2025).
            Higher eco scores indicate greater ecological sensitivity.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
