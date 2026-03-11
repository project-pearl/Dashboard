'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkline } from './Sparkline';

interface InstRisk {
  id: string;
  name: string;
  branch: string;
  region: string;
  burnPitHistory: boolean;
  fireScore: number;
  aqiScore: number;
  burnPitScore: number;
  windScore: number;
  droughtScore: number;
  seismicScore: number;
  damScore: number;
  composite: number;
  nearestFireDist: number | null;
  nearestFireFrp: number | null;
  aqiValue: number | null;
  windContext: string | null;
  droughtLevel: string | null;
  nearestQuakeDist: number | null;
  nearestQuakeMag: number | null;
  nearestDamDist: number | null;
  nearestDamName: string | null;
}

type SortField = 'composite' | 'fireScore' | 'aqiScore' | 'burnPitScore' | 'windScore' | 'droughtScore' | 'seismicScore' | 'damScore' | 'name';

function riskColor(score: number): string {
  if (score >= 75) return 'bg-red-100 text-red-800';
  if (score >= 50) return 'bg-amber-100 text-amber-800';
  if (score >= 25) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}

function rowBorder(score: number): string {
  if (score >= 75) return 'border-l-4 border-l-red-400';
  if (score >= 50) return 'border-l-4 border-l-amber-400';
  if (score >= 25) return 'border-l-4 border-l-yellow-400';
  return 'border-l-4 border-l-green-400';
}

const REGION_LABELS: Record<string, string> = {
  'middle-east': 'CENTCOM',
  'conus': 'CONUS',
  'indo-pacific': 'INDOPACOM',
  'europe': 'EUCOM',
  'africa': 'AFRICOM',
};

export function InstallationRiskScorecard() {
  const [data, setData] = useState<InstRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('composite');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/fire-aq/installation-risk')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!cancelled && json?.installations) setData(json.installations);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      const av = sortField === 'name' ? a.name : a[sortField];
      const bv = sortField === 'name' ? b.name : b[sortField];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [data, sortField, sortAsc]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  function SortHeader({ field, label, className }: { field: SortField; label: string; className?: string }) {
    return (
      <th
        className={`px-2 py-1.5 font-medium cursor-pointer hover:bg-slate-100 select-none ${className || ''}`}
        onClick={() => handleSort(field)}
      >
        {label}
        {sortField === field && (
          <span className="ml-1 text-2xs">{sortAsc ? '\u25B2' : '\u25BC'}</span>
        )}
      </th>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-5 h-5 text-indigo-600" />
          Installation Risk Scorecard
        </CardTitle>
        <CardDescription className="text-xs">
          Composite risk ranking across fire, AQI, burn pit, wind, drought, seismic, and dam proximity. Click rows for detail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-xs text-slate-500">Loading installation scores...</div>}
        {!loading && data.length === 0 && (
          <div className="text-xs text-slate-500">No installation data available.</div>
        )}
        {!loading && data.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500">
                  <th className="px-2 py-1.5 font-medium w-8">#</th>
                  <SortHeader field="name" label="Installation" />
                  <th className="px-2 py-1.5 font-medium">Branch</th>
                  <th className="px-2 py-1.5 font-medium">Region</th>
                  <SortHeader field="fireScore" label="Fire (0-40)" className="text-center" />
                  <SortHeader field="aqiScore" label="AQI (0-30)" className="text-center" />
                  <SortHeader field="burnPitScore" label="BP (0-15)" className="text-center" />
                  <SortHeader field="windScore" label="Wind (0-15)" className="text-center" />
                  <SortHeader field="droughtScore" label="Drought (0-10)" className="text-center" />
                  <SortHeader field="seismicScore" label="Seismic (0-15)" className="text-center" />
                  <SortHeader field="damScore" label="Dam (0-10)" className="text-center" />
                  <SortHeader field="composite" label="Composite" className="text-center" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((inst, i) => (
                  <React.Fragment key={inst.id}>
                    <tr
                      className={`hover:bg-slate-50 cursor-pointer ${rowBorder(inst.composite)}`}
                      onClick={() => setExpandedId(expandedId === inst.id ? null : inst.id)}
                    >
                      <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                      <td className="px-2 py-1.5 font-medium text-slate-700">
                        <span className="flex items-center gap-1">
                          {expandedId === inst.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          {inst.name}
                          {inst.burnPitHistory && <Badge variant="outline" className="ml-1 text-2xs bg-red-50 text-red-600 border-red-200">BP</Badge>}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">{inst.branch}</td>
                      <td className="px-2 py-1.5">{REGION_LABELS[inst.region] || inst.region}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{inst.fireScore}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{inst.aqiScore}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{inst.burnPitScore}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{inst.windScore}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{inst.droughtScore}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{inst.seismicScore}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{inst.damScore}</td>
                      <td className="px-2 py-1.5 text-center">
                        <Badge variant="outline" className={`font-mono ${riskColor(inst.composite)}`}>
                          {inst.composite}
                        </Badge>
                      </td>
                    </tr>
                    {expandedId === inst.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={12} className="px-4 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="font-semibold text-slate-600">Nearest Fire:</span>{' '}
                              {inst.nearestFireDist != null
                                ? `${inst.nearestFireDist} mi (FRP: ${inst.nearestFireFrp} MW)`
                                : 'None detected'}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-600">AQI:</span>{' '}
                              {inst.aqiValue != null ? inst.aqiValue : 'No data'}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-600">Wind:</span>{' '}
                              {inst.windContext || 'No NDBC data'}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-600">PACT Act:</span>{' '}
                              {inst.burnPitHistory
                                ? <span className="text-red-600">Documented burn pit history — exposure documentation warranted</span>
                                : 'No burn pit history'}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-600">Drought:</span>{' '}
                              {inst.droughtLevel || 'No drought data'}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-600">Nearest Quake:</span>{' '}
                              {inst.nearestQuakeDist != null
                                ? `M${inst.nearestQuakeMag} at ${inst.nearestQuakeDist} mi`
                                : 'None recent'}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-600">Nearest Dam:</span>{' '}
                              {inst.nearestDamDist != null
                                ? `${inst.nearestDamName} (${inst.nearestDamDist} mi)`
                                : 'No high-hazard dams nearby'}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
