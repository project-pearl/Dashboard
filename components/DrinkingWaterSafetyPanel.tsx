'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  GlassWater,
  AlertTriangle,
  Shield,
  CheckCircle,
  Droplets,
  Building2,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

// ── Props ───────────────────────────────────────────────────────────────────

interface DrinkingWaterSafetyPanelProps {
  stateAbbr: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const SCHOOL_BUILDINGS = [
  { id: 1, name: 'Lincoln Elementary', building: 'Main Building', leadPpb: 3.2, copperPpm: 0.8, testDate: '2025-11-15', status: 'pass' as const },
  { id: 2, name: 'Lincoln Elementary', building: 'Gymnasium Wing', leadPpb: 1.1, copperPpm: 0.3, testDate: '2025-11-15', status: 'pass' as const },
  { id: 3, name: 'Washington Middle School', building: 'Building A', leadPpb: 12.8, copperPpm: 1.1, testDate: '2025-10-22', status: 'warning' as const },
  { id: 4, name: 'Washington Middle School', building: 'Building B', leadPpb: 22.4, copperPpm: 1.5, testDate: '2025-10-22', status: 'exceedance' as const },
  { id: 5, name: 'Jefferson High School', building: 'Science Wing', leadPpb: 0.8, copperPpm: 0.2, testDate: '2025-12-01', status: 'pass' as const },
  { id: 6, name: 'Jefferson High School', building: 'Cafeteria', leadPpb: 6.5, copperPpm: 0.9, testDate: '2025-12-01', status: 'pass' as const },
  { id: 7, name: 'Roosevelt Elementary', building: 'Main Building', leadPpb: 18.1, copperPpm: 1.4, testDate: '2025-09-30', status: 'exceedance' as const },
  { id: 8, name: 'Adams Pre-K Center', building: 'All Floors', leadPpb: 2.0, copperPpm: 0.4, testDate: '2025-11-08', status: 'pass' as const },
];

const FOUNTAIN_STATUS = [
  { location: 'Main Hallway - 1st Floor', status: 'active', lastTested: '2025-12-10', filterAge: 45 },
  { location: 'Main Hallway - 2nd Floor', status: 'active', lastTested: '2025-12-10', filterAge: 45 },
  { location: 'Gymnasium Lobby', status: 'active', lastTested: '2025-12-08', filterAge: 90 },
  { location: 'Cafeteria East', status: 'offline', lastTested: '2025-11-20', filterAge: 120 },
  { location: 'Cafeteria West', status: 'active', lastTested: '2025-12-10', filterAge: 30 },
  { location: 'Science Wing', status: 'active', lastTested: '2025-12-05', filterAge: 60 },
  { location: 'Library', status: 'maintenance', lastTested: '2025-12-01', filterAge: 95 },
  { location: 'Playground Area', status: 'active', lastTested: '2025-12-10', filterAge: 15 },
];

const FILTER_SCHEDULE = [
  { location: 'Cafeteria East', dueDate: '2025-12-15', priority: 'overdue' as const },
  { location: 'Library', dueDate: '2025-12-20', priority: 'upcoming' as const },
  { location: 'Gymnasium Lobby', dueDate: '2026-01-05', priority: 'upcoming' as const },
  { location: 'Science Wing', dueDate: '2026-01-15', priority: 'scheduled' as const },
  { location: 'Main Hallway - 1st Floor', dueDate: '2026-02-10', priority: 'scheduled' as const },
];

// ── Constants ───────────────────────────────────────────────────────────────

const LEAD_ACTION_LEVEL_PPB = 15; // EPA action level
const COPPER_ACTION_LEVEL_PPM = 1.3;

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  if (status === 'pass') return 'bg-emerald-100 text-emerald-700';
  if (status === 'warning') return 'bg-amber-100 text-amber-700';
  if (status === 'exceedance') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
}

function statusLabel(status: string): string {
  if (status === 'pass') return 'Pass';
  if (status === 'warning') return 'Near Limit';
  if (status === 'exceedance') return 'Exceedance';
  return status;
}

function fountainStatusColor(status: string): string {
  if (status === 'active') return 'bg-emerald-500';
  if (status === 'offline') return 'bg-red-500';
  if (status === 'maintenance') return 'bg-amber-500';
  return 'bg-slate-400';
}

function filterPriorityClass(priority: string): string {
  if (priority === 'overdue') return 'bg-red-100 text-red-700 border-red-200';
  if (priority === 'upcoming') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

// ── Component ───────────────────────────────────────────────────────────────

export function DrinkingWaterSafetyPanel({ stateAbbr }: DrinkingWaterSafetyPanelProps) {
  const [showAllResults, setShowAllResults] = useState(false);

  const heroStats = useMemo(() => {
    const total = SCHOOL_BUILDINGS.length;
    const passing = SCHOOL_BUILDINGS.filter((b) => b.status === 'pass').length;
    const exceedances = SCHOOL_BUILDINGS.filter((b) => b.status === 'exceedance').length;
    const warnings = SCHOOL_BUILDINGS.filter((b) => b.status === 'warning').length;
    const activeFountains = FOUNTAIN_STATUS.filter((f) => f.status === 'active').length;
    return { total, passing, exceedances, warnings, activeFountains };
  }, []);

  const visibleResults = showAllResults ? SCHOOL_BUILDINGS : SCHOOL_BUILDINGS.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <GlassWater className="w-3.5 h-3.5" />
        <span>
          School Drinking Water Safety — {stateAbbr || 'All States'} — EPA Lead &amp; Copper Rule
        </span>
      </div>

      {/* ── Section 1: Hero Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                <Building2 size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{heroStats.total}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Buildings Tested</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{heroStats.passing}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Passing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700">{heroStats.exceedances}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Exceedances</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
                <Droplets size={20} className="text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-sky-700">{heroStats.activeFountains}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Fountains Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 2: Lead & Copper Testing Results ──────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield size={16} className="text-blue-600" />
            Lead &amp; Copper Testing Results
            {heroStats.exceedances > 0 && (
              <Badge className="ml-1 text-[10px] bg-red-100 text-red-700">
                {heroStats.exceedances} exceedance{heroStats.exceedances > 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            EPA action levels: Lead &gt; {LEAD_ACTION_LEVEL_PPB} ppb, Copper &gt; {COPPER_ACTION_LEVEL_PPM} ppm
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">School</th>
                  <th className="pb-2 font-semibold">Building</th>
                  <th className="pb-2 font-semibold text-right">Lead (ppb)</th>
                  <th className="pb-2 font-semibold text-right">Copper (ppm)</th>
                  <th className="pb-2 font-semibold text-right">Test Date</th>
                  <th className="pb-2 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                      row.status === 'exceedance' ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="py-2 font-semibold text-slate-700">{row.name}</td>
                    <td className="py-2 text-slate-600">{row.building}</td>
                    <td className="py-2 text-right">
                      <span className={row.leadPpb > LEAD_ACTION_LEVEL_PPB ? 'text-red-600 font-bold' : 'text-slate-700'}>
                        {row.leadPpb.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={row.copperPpm > COPPER_ACTION_LEVEL_PPM ? 'text-red-600 font-bold' : 'text-slate-700'}>
                        {row.copperPpm.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-500">
                      {new Date(row.testDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-2 text-right">
                      <Badge className={`text-[9px] ${statusBadgeClass(row.status)}`}>{statusLabel(row.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {SCHOOL_BUILDINGS.length > 5 && (
            <button
              onClick={() => setShowAllResults((p) => !p)}
              className="mt-3 w-full text-center text-xs text-blue-600 hover:text-blue-800 font-medium py-1.5 rounded-md hover:bg-blue-50 transition-colors"
            >
              {showAllResults ? 'Show fewer results' : `Show all ${SCHOOL_BUILDINGS.length} results`}
              {showAllResults ? <ChevronUp size={12} className="inline ml-1" /> : <ChevronDown size={12} className="inline ml-1" />}
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Water Fountain Status Grid ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Droplets size={16} className="text-sky-600" />
            Water Fountain Status
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {FOUNTAIN_STATUS.filter((f) => f.status === 'active').length}/{FOUNTAIN_STATUS.length} active
            </Badge>
          </CardTitle>
          <CardDescription>
            Real-time status of water fountains and bottle-fill stations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {FOUNTAIN_STATUS.map((fountain) => (
              <div key={fountain.location} className="rounded-lg border border-slate-200 p-2.5 text-center hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${fountainStatusColor(fountain.status)}`} />
                  <span className="text-[10px] font-semibold text-slate-700 capitalize">{fountain.status}</span>
                </div>
                <p className="text-[10px] text-slate-600 truncate" title={fountain.location}>{fountain.location}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Filter: {fountain.filterAge} days</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Filter Replacement Schedule ────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GlassWater size={16} className="text-indigo-600" />
            Filter Replacement Schedule
          </CardTitle>
          <CardDescription>
            Upcoming and overdue filter replacements across all fountain locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {FILTER_SCHEDULE.map((item) => (
              <div key={item.location} className={`flex items-center justify-between rounded-lg border p-2.5 ${filterPriorityClass(item.priority)}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {item.priority === 'overdue' && <AlertTriangle size={14} className="text-red-600 shrink-0" />}
                  {item.priority === 'upcoming' && <Info size={14} className="text-amber-600 shrink-0" />}
                  {item.priority === 'scheduled' && <CheckCircle size={14} className="text-slate-500 shrink-0" />}
                  <span className="text-xs font-medium truncate">{item.location}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold">
                    {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <Badge className={`text-[9px] ${filterPriorityClass(item.priority)}`}>
                    {item.priority === 'overdue' ? 'Overdue' : item.priority === 'upcoming' ? 'Soon' : 'Scheduled'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
            <Info size={10} />
            Compliance with EPA&apos;s Lead and Copper Rule (LCR) requires regular testing and filter maintenance.
            Schools should test all drinking water outlets used for consumption.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
