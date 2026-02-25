'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, ClipboardCheck, GraduationCap, Package, BarChart3 } from 'lucide-react';

// ── Props ───────────────────────────────────────────────────────────────────

interface VolunteerProgramPanelProps {
  stateAbbr: string;
}

// ── Types ───────────────────────────────────────────────────────────────────

type TrainingLevel = 'basic' | 'intermediate' | 'advanced' | 'certified';

interface MonitoringEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  volunteersNeeded: number;
  volunteersSignedUp: number;
  parameters: string[];
  status: 'upcoming' | 'in-progress' | 'completed';
}

interface QAMetric {
  parameter: string;
  samplesCollected: number;
  passRate: number;
  duplicateAgreement: number;
}

interface EquipmentItem {
  name: string;
  totalUnits: number;
  availableUnits: number;
  lastCalibration: string;
  condition: 'good' | 'fair' | 'needs-service';
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const VOLUNTEER_STATS = {
  totalRegistered: 342,
  activeThisQuarter: 187,
  trained: 264,
  certified: 98,
  hoursLogged: 4280,
  sitesMonitored: 63,
} as const;

const TRAINING_BREAKDOWN: { level: TrainingLevel; count: number; color: string; bg: string }[] = [
  { level: 'basic', count: 78, color: 'text-slate-700', bg: 'bg-slate-100' },
  { level: 'intermediate', count: 88, color: 'text-blue-700', bg: 'bg-blue-100' },
  { level: 'advanced', count: 68, color: 'text-purple-700', bg: 'bg-purple-100' },
  { level: 'certified', count: 98, color: 'text-emerald-700', bg: 'bg-emerald-100' },
];

const MONITORING_EVENTS: MonitoringEvent[] = [
  { id: 'E-001', name: 'Spring Creek Baseline Sampling', date: '2026-03-08', location: 'Spring Creek, Site A-12', volunteersNeeded: 8, volunteersSignedUp: 6, parameters: ['pH', 'DO', 'Temperature', 'Turbidity'], status: 'upcoming' },
  { id: 'E-002', name: 'Watershed-Wide Bacteria Survey', date: '2026-03-15', location: 'Multiple Sites (12)', volunteersNeeded: 24, volunteersSignedUp: 19, parameters: ['E. coli', 'Fecal Coliform', 'Temperature'], status: 'upcoming' },
  { id: 'E-003', name: 'Urban Stream Macroinvertebrate ID', date: '2026-03-22', location: 'Rock Creek, Reach B', volunteersNeeded: 6, volunteersSignedUp: 6, parameters: ['Macroinvertebrate Index', 'Habitat Assessment'], status: 'upcoming' },
  { id: 'E-004', name: 'Monthly DO/Nutrient Monitoring', date: '2026-02-22', location: 'River Main Stem (5 sites)', volunteersNeeded: 10, volunteersSignedUp: 10, parameters: ['DO', 'Nitrate', 'Phosphorus'], status: 'completed' },
  { id: 'E-005', name: 'Stormwater Runoff Event Sampling', date: '2026-02-25', location: 'Outfall Points 1-4', volunteersNeeded: 8, volunteersSignedUp: 5, parameters: ['TSS', 'pH', 'Conductivity', 'Flow'], status: 'in-progress' },
];

const QA_METRICS: QAMetric[] = [
  { parameter: 'pH', samplesCollected: 482, passRate: 96.3, duplicateAgreement: 98.1 },
  { parameter: 'Dissolved Oxygen', samplesCollected: 467, passRate: 93.8, duplicateAgreement: 95.4 },
  { parameter: 'Temperature', samplesCollected: 510, passRate: 99.2, duplicateAgreement: 99.7 },
  { parameter: 'Turbidity', samplesCollected: 324, passRate: 91.4, duplicateAgreement: 93.2 },
  { parameter: 'E. coli', samplesCollected: 198, passRate: 88.9, duplicateAgreement: 90.1 },
  { parameter: 'Nitrate', samplesCollected: 156, passRate: 90.4, duplicateAgreement: 92.8 },
];

const EQUIPMENT: EquipmentItem[] = [
  { name: 'YSI ProDSS Multiparameter', totalUnits: 8, availableUnits: 6, lastCalibration: '2026-02-15', condition: 'good' },
  { name: 'Hach 2100Q Turbidimeter', totalUnits: 5, availableUnits: 4, lastCalibration: '2026-02-10', condition: 'good' },
  { name: 'IDEXX Colilert Kits', totalUnits: 120, availableUnits: 72, lastCalibration: 'N/A', condition: 'good' },
  { name: 'Hanna pH Meters', totalUnits: 12, availableUnits: 9, lastCalibration: '2026-02-18', condition: 'fair' },
  { name: 'Flow Meters (Marsh-McBirney)', totalUnits: 4, availableUnits: 2, lastCalibration: '2026-01-20', condition: 'needs-service' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const EVENT_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  upcoming:      { label: 'Upcoming',    badge: 'bg-blue-100 text-blue-700' },
  'in-progress': { label: 'In Progress', badge: 'bg-amber-100 text-amber-700' },
  completed:     { label: 'Completed',   badge: 'bg-emerald-100 text-emerald-700' },
};

const CONDITION_CONFIG: Record<string, { label: string; badge: string }> = {
  good:           { label: 'Good',          badge: 'bg-emerald-100 text-emerald-700' },
  fair:           { label: 'Fair',          badge: 'bg-amber-100 text-amber-700' },
  'needs-service': { label: 'Needs Service', badge: 'bg-red-100 text-red-700' },
};

function fmtDate(d: string): string {
  if (!d || d === 'N/A') return 'N/A';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

function passRateColor(rate: number): string {
  if (rate >= 95) return 'text-emerald-700';
  if (rate >= 90) return 'text-blue-700';
  if (rate >= 85) return 'text-amber-700';
  return 'text-red-700';
}

function passRateBg(rate: number): string {
  if (rate >= 95) return 'bg-emerald-500';
  if (rate >= 90) return 'bg-blue-500';
  if (rate >= 85) return 'bg-amber-500';
  return 'bg-red-500';
}

// ── Component ───────────────────────────────────────────────────────────────

export function VolunteerProgramPanel({ stateAbbr }: VolunteerProgramPanelProps) {
  const [showAllEvents, setShowAllEvents] = useState(false);

  const visibleEvents = useMemo(
    () => (showAllEvents ? MONITORING_EVENTS : MONITORING_EVENTS.slice(0, 3)),
    [showAllEvents]
  );

  const totalTrainees = useMemo(
    () => TRAINING_BREAKDOWN.reduce((s, t) => s + t.count, 0),
    []
  );

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Users className="w-3.5 h-3.5" />
        <span>
          Volunteer Monitoring Program — Program Management
          {stateAbbr ? ` (${stateAbbr})` : ' (All Programs)'}
        </span>
      </div>

      {/* ── Section 1: Volunteer Roster Summary ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Active Volunteers', value: VOLUNTEER_STATS.activeThisQuarter, Icon: Users, iconBg: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-600', valueColor: 'text-blue-700' },
          { label: 'Certified Monitors', value: VOLUNTEER_STATS.certified, Icon: ClipboardCheck, iconBg: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-600', valueColor: 'text-emerald-700' },
          { label: 'Hours Logged', value: VOLUNTEER_STATS.hoursLogged.toLocaleString(), Icon: Calendar, iconBg: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-600', valueColor: 'text-amber-700' },
          { label: 'Sites Monitored', value: VOLUNTEER_STATS.sitesMonitored, Icon: BarChart3, iconBg: 'bg-purple-50 border-purple-200', iconColor: 'text-purple-600', valueColor: 'text-purple-700' },
        ] as const).map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${stat.iconBg}`}>
                  <stat.Icon size={20} className={stat.iconColor} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${stat.valueColor}`}>{stat.value}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Section 2: Training Progress Tracker ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap size={16} className="text-purple-600" />
            Training Progress
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {VOLUNTEER_STATS.totalRegistered} registered
            </Badge>
          </CardTitle>
          <CardDescription>
            Volunteer training levels and certification pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {TRAINING_BREAKDOWN.map((t) => {
              const widthPct = totalTrainees > 0 ? (t.count / totalTrainees) * 100 : 0;
              return (
                <div key={t.level}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <GraduationCap size={14} className={t.color} />
                      <span className="text-xs font-medium text-slate-700 capitalize">{t.level}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800 tabular-nums">{t.count}</span>
                      <Badge className={`text-[9px] ${t.bg} ${t.color}`}>
                        {widthPct.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-md overflow-hidden">
                    <div
                      className={`h-full rounded-md ${t.bg} transition-all duration-500 ease-out`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-slate-400 mt-1">
              {VOLUNTEER_STATS.totalRegistered - VOLUNTEER_STATS.trained} volunteers still awaiting initial training.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Monitoring Event Calendar ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar size={16} className="text-blue-600" />
            Monitoring Events
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {MONITORING_EVENTS.length} scheduled
            </Badge>
          </CardTitle>
          <CardDescription>
            Upcoming and recent volunteer monitoring events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {visibleEvents.map((e) => {
              const cfg = EVENT_STATUS_CONFIG[e.status];
              const fillPct = e.volunteersNeeded > 0 ? (e.volunteersSignedUp / e.volunteersNeeded) * 100 : 0;
              return (
                <div key={e.id} className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Calendar size={14} className="text-blue-500 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 truncate">{e.name}</span>
                    </div>
                    <Badge className={`text-[9px] ${cfg.badge}`}>{cfg.label}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-slate-500 ml-5 mb-2">
                    <span className="font-semibold text-slate-700">{fmtDate(e.date)}</span>
                    <span>{e.location}</span>
                  </div>
                  <div className="ml-5 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-slate-500">Volunteers</span>
                        <span className="font-semibold text-slate-700">{e.volunteersSignedUp}/{e.volunteersNeeded}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${fillPct >= 100 ? 'bg-emerald-500' : fillPct >= 75 ? 'bg-blue-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, fillPct)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {e.parameters.slice(0, 3).map((p) => (
                        <Badge key={p} variant="secondary" className="text-[8px]">{p}</Badge>
                      ))}
                      {e.parameters.length > 3 && (
                        <Badge variant="secondary" className="text-[8px]">+{e.parameters.length - 3}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {MONITORING_EVENTS.length > 3 && (
            <button
              onClick={() => setShowAllEvents((p) => !p)}
              className="mt-3 w-full text-center text-xs text-blue-600 hover:text-blue-800 font-medium py-1.5 rounded-md hover:bg-blue-50 transition-colors"
            >
              {showAllEvents ? 'Show fewer' : `Show all ${MONITORING_EVENTS.length} events`}
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4: Data Quality Assurance ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck size={16} className="text-emerald-600" />
            Data Quality Assurance
          </CardTitle>
          <CardDescription>
            QA/QC performance by parameter — pass rates and duplicate agreement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Parameter</th>
                  <th className="pb-2 font-semibold text-right">Samples</th>
                  <th className="pb-2 font-semibold text-right">Pass Rate</th>
                  <th className="pb-2 font-semibold text-right">Dup. Agreement</th>
                  <th className="pb-2 font-semibold w-24"></th>
                </tr>
              </thead>
              <tbody>
                {QA_METRICS.map((q) => (
                  <tr key={q.parameter} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 font-medium text-slate-700">{q.parameter}</td>
                    <td className="py-2 text-right text-slate-600 tabular-nums">{q.samplesCollected}</td>
                    <td className="py-2 text-right">
                      <span className={`font-semibold ${passRateColor(q.passRate)}`}>
                        {q.passRate}%
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={`font-semibold ${passRateColor(q.duplicateAgreement)}`}>
                        {q.duplicateAgreement}%
                      </span>
                    </td>
                    <td className="py-2 pl-3">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${passRateBg(q.passRate)}`}
                          style={{ width: `${q.passRate}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Equipment Inventory ───────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package size={16} className="text-slate-600" />
            Equipment Inventory
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {EQUIPMENT.length} items tracked
            </Badge>
          </CardTitle>
          <CardDescription>
            Monitoring equipment availability and calibration status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Equipment</th>
                  <th className="pb-2 font-semibold text-right">Available</th>
                  <th className="pb-2 font-semibold text-right">Total</th>
                  <th className="pb-2 font-semibold">Last Calibration</th>
                  <th className="pb-2 font-semibold">Condition</th>
                </tr>
              </thead>
              <tbody>
                {EQUIPMENT.map((eq) => {
                  const cond = CONDITION_CONFIG[eq.condition];
                  const availPct = eq.totalUnits > 0 ? (eq.availableUnits / eq.totalUnits) * 100 : 0;
                  return (
                    <tr key={eq.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-2 font-medium text-slate-700">{eq.name}</td>
                      <td className="py-2 text-right">
                        <span className={availPct < 50 ? 'text-red-600 font-semibold' : 'text-slate-800 font-semibold'}>
                          {eq.availableUnits}
                        </span>
                      </td>
                      <td className="py-2 text-right text-slate-600">{eq.totalUnits}</td>
                      <td className="py-2 text-slate-600">{fmtDate(eq.lastCalibration)}</td>
                      <td className="py-2">
                        <Badge className={`text-[9px] ${cond.badge}`}>{cond.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
            <BarChart3 size={10} />
            Equipment needing service should be returned to the program coordinator for calibration and repair.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
