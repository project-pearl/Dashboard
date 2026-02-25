'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Beaker,
  ClipboardList,
  Award,
  TrendingUp,
  Download,
  Star,
  ChevronDown,
  ChevronUp,
  Info,
  ThermometerSun,
  Droplets,
} from 'lucide-react';

// ── Props ───────────────────────────────────────────────────────────────────

interface StudentMonitoringPanelProps {
  stateAbbr: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const RECENT_READINGS = [
  { id: 1, student: 'Team River Hawks', date: '2025-12-10', site: 'Mill Creek - Site A', ph: 7.2, dissolvedOxygen: 8.4, temperature: 14.5, turbidity: 12, grade: 'A' },
  { id: 2, student: 'Team Watershed Warriors', date: '2025-12-10', site: 'Mill Creek - Site B', ph: 6.8, dissolvedOxygen: 7.1, temperature: 15.2, turbidity: 25, grade: 'B' },
  { id: 3, student: 'Team Blue Herons', date: '2025-12-09', site: 'Lakeside Point', ph: 7.5, dissolvedOxygen: 9.2, temperature: 12.8, turbidity: 5, grade: 'A+' },
  { id: 4, student: 'Team Stream Scouts', date: '2025-12-09', site: 'Elm Street Storm Drain', ph: 6.1, dissolvedOxygen: 4.3, temperature: 18.1, turbidity: 68, grade: 'C' },
  { id: 5, student: 'Team Aqua Detectives', date: '2025-12-08', site: 'Park Pond Outlet', ph: 7.8, dissolvedOxygen: 6.5, temperature: 13.0, turbidity: 30, grade: 'B' },
  { id: 6, student: 'Team River Hawks', date: '2025-12-08', site: 'Mill Creek - Site A', ph: 7.0, dissolvedOxygen: 8.1, temperature: 14.8, turbidity: 15, grade: 'A' },
];

const PARAMETER_INFO = [
  { name: 'pH', icon: '🧪', range: '6.5 – 8.5', unit: '', description: 'Measures how acidic or basic the water is. Most aquatic life thrives in water with a pH between 6.5 and 8.5. Think of it like a scale from sour lemon juice (acidic) to soapy water (basic)!', color: 'border-purple-200 bg-purple-50' },
  { name: 'Dissolved Oxygen', icon: '💨', range: '> 5.0', unit: 'mg/L', description: 'The amount of oxygen dissolved in water that fish and other creatures breathe. Healthy streams usually have more than 5 mg/L. Cold, fast-moving water holds more oxygen!', color: 'border-blue-200 bg-blue-50' },
  { name: 'Temperature', icon: '🌡️', range: 'Varies', unit: '°C', description: 'Water temperature affects everything in a stream! Warmer water holds less oxygen and can stress cold-water species like trout. Track changes across seasons.', color: 'border-orange-200 bg-orange-50' },
  { name: 'Turbidity', icon: '🔍', range: '< 25', unit: 'NTU', description: 'How cloudy or murky the water looks. High turbidity means lots of tiny particles floating around, which can block sunlight and clog fish gills. Clear water is usually healthier!', color: 'border-amber-200 bg-amber-50' },
];

const LEADERBOARD = [
  { rank: 1, team: 'Team Blue Herons', points: 485, badges: ['Top Collector', 'Data Star', 'Perfect pH'], readings: 24 },
  { rank: 2, team: 'Team River Hawks', points: 420, badges: ['Streak Master', 'Early Bird'], readings: 21 },
  { rank: 3, team: 'Team Aqua Detectives', points: 380, badges: ['Most Improved', 'Field Expert'], readings: 18 },
  { rank: 4, team: 'Team Watershed Warriors', points: 345, badges: ['Team Player'], readings: 16 },
  { rank: 5, team: 'Team Stream Scouts', points: 290, badges: ['First Sample'], readings: 12 },
];

const EXPORT_OPTIONS = [
  { name: 'Science Fair Report (PDF)', format: 'PDF', description: 'Formatted report with charts, data tables, and analysis sections' },
  { name: 'Raw Data Spreadsheet (CSV)', format: 'CSV', description: 'All readings in spreadsheet format for custom analysis' },
  { name: 'Presentation Slides', format: 'PPTX', description: 'Auto-generated presentation with key findings and visuals' },
  { name: 'Lab Notebook Pages', format: 'PDF', description: 'Printable lab notebook pages with your data pre-filled' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'bg-emerald-100 text-emerald-700';
  if (grade === 'B') return 'bg-blue-100 text-blue-700';
  if (grade === 'C') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function rankBadge(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function phColor(ph: number): string {
  if (ph >= 6.5 && ph <= 8.5) return 'text-emerald-700';
  return 'text-red-600 font-bold';
}

function doColor(dO: number): string {
  if (dO >= 5.0) return 'text-emerald-700';
  if (dO >= 3.0) return 'text-amber-600';
  return 'text-red-600 font-bold';
}

function turbidityColor(t: number): string {
  if (t < 25) return 'text-emerald-700';
  if (t < 50) return 'text-amber-600';
  return 'text-red-600 font-bold';
}

// ── Component ───────────────────────────────────────────────────────────────

export function StudentMonitoringPanel({ stateAbbr }: StudentMonitoringPanelProps) {
  const [showAllReadings, setShowAllReadings] = useState(false);
  const [expandedParam, setExpandedParam] = useState<string | null>(null);

  const totalReadings = useMemo(
    () => LEADERBOARD.reduce((sum, t) => sum + t.readings, 0),
    [],
  );

  const visibleReadings = showAllReadings ? RECENT_READINGS : RECENT_READINGS.slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Beaker className="w-3.5 h-3.5" />
        <span>
          Student Water Quality Monitoring — {stateAbbr || 'All States'}
        </span>
      </div>

      {/* ── Section 1: Data Entry Placeholder ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList size={16} className="text-indigo-600" />
            Record New Reading
          </CardTitle>
          <CardDescription>
            Enter your water quality measurements from the field
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'pH', placeholder: '6.5 – 8.5', icon: Droplets, color: 'border-purple-200' },
              { label: 'Dissolved Oxygen (mg/L)', placeholder: '> 5.0', icon: TrendingUp, color: 'border-blue-200' },
              { label: 'Temperature (°C)', placeholder: '10 – 20', icon: ThermometerSun, color: 'border-orange-200' },
              { label: 'Turbidity (NTU)', placeholder: '< 25', icon: Beaker, color: 'border-amber-200' },
            ].map((field) => (
              <div key={field.label} className={`rounded-lg border-2 ${field.color} p-3`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <field.icon size={14} className="text-slate-500" />
                  <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{field.label}</span>
                </div>
                <div className="h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center px-2">
                  <span className="text-xs text-slate-400">Ideal: {field.placeholder}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-9 rounded-md bg-indigo-600 flex items-center justify-center cursor-not-allowed opacity-60">
              <span className="text-xs font-semibold text-white">Submit Reading</span>
            </div>
            <p className="text-[10px] text-slate-400 italic">Data entry coming soon</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Recent Readings Comparison ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp size={16} className="text-emerald-600" />
            Recent Readings
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {RECENT_READINGS.length} entries
            </Badge>
          </CardTitle>
          <CardDescription>
            Compare your team&apos;s results with other groups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Team</th>
                  <th className="pb-2 font-semibold">Site</th>
                  <th className="pb-2 font-semibold text-right">pH</th>
                  <th className="pb-2 font-semibold text-right">DO (mg/L)</th>
                  <th className="pb-2 font-semibold text-right">Temp (°C)</th>
                  <th className="pb-2 font-semibold text-right">Turbidity</th>
                  <th className="pb-2 font-semibold text-right">Grade</th>
                </tr>
              </thead>
              <tbody>
                {visibleReadings.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 font-semibold text-slate-700">{row.student}</td>
                    <td className="py-2 text-slate-600">{row.site}</td>
                    <td className={`py-2 text-right font-semibold ${phColor(row.ph)}`}>{row.ph.toFixed(1)}</td>
                    <td className={`py-2 text-right font-semibold ${doColor(row.dissolvedOxygen)}`}>{row.dissolvedOxygen.toFixed(1)}</td>
                    <td className="py-2 text-right text-slate-700">{row.temperature.toFixed(1)}</td>
                    <td className={`py-2 text-right font-semibold ${turbidityColor(row.turbidity)}`}>{row.turbidity}</td>
                    <td className="py-2 text-right">
                      <Badge className={`text-[9px] ${gradeColor(row.grade)}`}>{row.grade}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {RECENT_READINGS.length > 4 && (
            <button
              onClick={() => setShowAllReadings((p) => !p)}
              className="mt-3 w-full text-center text-xs text-blue-600 hover:text-blue-800 font-medium py-1.5 rounded-md hover:bg-blue-50 transition-colors"
            >
              {showAllReadings ? 'Show fewer readings' : `Show all ${RECENT_READINGS.length} readings`}
              {showAllReadings ? <ChevronUp size={12} className="inline ml-1" /> : <ChevronDown size={12} className="inline ml-1" />}
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Parameter Explanations ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Beaker size={16} className="text-purple-600" />
            What Are We Measuring?
          </CardTitle>
          <CardDescription>
            Tap a parameter to learn what it means and why it matters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {PARAMETER_INFO.map((param) => {
              const isExpanded = expandedParam === param.name;
              return (
                <div
                  key={param.name}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${param.color}`}
                  onClick={() => setExpandedParam(isExpanded ? null : param.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{param.icon}</span>
                      <span className="text-xs font-semibold text-slate-800">{param.name}</span>
                      <Badge variant="secondary" className="text-[9px]">
                        Ideal: {param.range} {param.unit}
                      </Badge>
                    </div>
                    {isExpanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                  </div>
                  {isExpanded && (
                    <p className="text-xs text-slate-700 mt-2 leading-relaxed">{param.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Class Leaderboard ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award size={16} className="text-amber-500" />
            Class Leaderboard
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {totalReadings} total readings
            </Badge>
          </CardTitle>
          <CardDescription>
            Earn points by collecting accurate data, maintaining streaks, and completing challenges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {LEADERBOARD.map((team) => (
              <div
                key={team.team}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  team.rank === 1 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="text-lg font-bold w-8 text-center">{rankBadge(team.rank)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800">{team.team}</span>
                    <span className="text-[10px] text-slate-500">{team.readings} readings</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {team.badges.map((badge) => (
                      <Badge key={badge} variant="outline" className="text-[8px] py-0 px-1.5">
                        <Star size={8} className="text-amber-500 mr-0.5" />
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-indigo-700">{team.points}</p>
                  <p className="text-[9px] text-slate-500 uppercase">points</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Export Options ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Download size={16} className="text-slate-600" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download your team&apos;s data for science fair projects, reports, or further analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXPORT_OPTIONS.map((opt) => (
              <div
                key={opt.name}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                  <Download size={16} className="text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-slate-700">{opt.name}</p>
                    <Badge variant="secondary" className="text-[8px]">{opt.format}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{opt.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
            <Info size={10} />
            All exports include metadata, collection dates, and quality control flags for scientific accuracy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
