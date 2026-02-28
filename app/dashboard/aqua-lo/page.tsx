'use client';

import React, { Suspense } from 'react';
import HeroBanner from '@/components/HeroBanner';
import { KPIStrip, KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { useLensParam } from '@/lib/useLensParam';
import {
  FlaskConical,
  CheckCircle,
  AlertTriangle,
  Timer,
  TrendingUp,
  FileText,
  Network,
  ScrollText,
  ClipboardList,
  Activity,
  XCircle,
  BarChart3,
} from 'lucide-react';

type AquaLoLens =
  | 'overview'
  | 'push'
  | 'qaqc'
  | 'audit'
  | 'reports';

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_SUBMISSIONS = [
  { id: 'BATCH-2026-0089', submitted: '2026-02-27', records: 142, status: 'Published', source: 'Lab A — Baltimore' },
  { id: 'BATCH-2026-0088', submitted: '2026-02-26', records: 98, status: 'Validating', source: 'Lab A — Baltimore' },
  { id: 'BATCH-2026-0087', submitted: '2026-02-25', records: 215, status: 'Published', source: 'Lab B — Annapolis' },
  { id: 'BATCH-2026-0086', submitted: '2026-02-24', records: 63, status: 'Rejected', source: 'Lab A — Baltimore' },
  { id: 'BATCH-2026-0085', submitted: '2026-02-23', records: 180, status: 'Published', source: 'Lab C — Frederick' },
];

const MOCK_VALIDATION_QUEUE = [
  { id: 'BATCH-2026-0088', records: 98, flagged: 4, method: 'EPA 524.2', age: '1 day' },
  { id: 'BATCH-2026-0090', records: 55, flagged: 0, method: 'EPA 200.8', age: '< 1 hour' },
  { id: 'BATCH-2026-0091', records: 120, flagged: 12, method: 'SM 9223B', age: '3 hours' },
];

const MOCK_REJECTIONS = [
  { reason: 'Hold time exceeded', count: 8, pct: 38 },
  { reason: 'QA/QC blank failure', count: 5, pct: 24 },
  { reason: 'Missing chain of custody', count: 4, pct: 19 },
  { reason: 'Out-of-range values', count: 3, pct: 14 },
  { reason: 'Duplicate submission', count: 1, pct: 5 },
];

const MOCK_PUB_HISTORY = [
  { month: 'Sep', count: 820 },
  { month: 'Oct', count: 950 },
  { month: 'Nov', count: 1100 },
  { month: 'Dec', count: 880 },
  { month: 'Jan', count: 1250 },
  { month: 'Feb', count: 698 },
];

const MOCK_AUDIT = [
  { time: '2026-02-27 14:32', action: 'Batch BATCH-2026-0089 published to PIN', user: 'J. Chen', type: 'publish' },
  { time: '2026-02-27 11:15', action: 'QA/QC override: blank failure accepted with note', user: 'M. Rivera', type: 'override' },
  { time: '2026-02-26 16:45', action: 'Batch BATCH-2026-0086 rejected — hold time violation', user: 'System', type: 'reject' },
  { time: '2026-02-26 09:20', action: 'Batch BATCH-2026-0088 submitted for validation', user: 'K. Patel', type: 'submit' },
  { time: '2026-02-25 17:10', action: 'Batch BATCH-2026-0087 published to PIN', user: 'J. Chen', type: 'publish' },
];

const statusColor = (status: string) => {
  switch (status) {
    case 'Published': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'Validating': return 'bg-sky-50 text-sky-700 border border-sky-200';
    case 'Rejected': return 'bg-red-50 text-red-700 border border-red-200';
    default: return 'bg-slate-50 text-slate-600 border border-slate-200';
  }
};

const auditIcon = (type: string) => {
  switch (type) {
    case 'publish': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    case 'override': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'reject': return <XCircle className="w-4 h-4 text-red-500" />;
    case 'submit': return <FlaskConical className="w-4 h-4 text-blue-500" />;
    default: return <Activity className="w-4 h-4 text-slate-400" />;
  }
};

// ─── Component ───────────────────────────────────────────────────────────────

function AquaLoContent() {
  const [lens] = useLensParam<AquaLoLens>('overview');
  const show = (target: AquaLoLens) => lens === 'overview' || lens === target;

  const kpiCards: KPICard[] = [
    { label: 'Submissions to PIN', value: '5,698', icon: FlaskConical, delta: 12, status: 'good' },
    { label: 'Pending Validation', value: '3', icon: ClipboardList, delta: -20, status: 'good' },
    { label: 'QA/QC Pass Rate', value: '96.8', unit: '%', icon: CheckCircle, delta: 1.2, status: 'good' },
    { label: 'Rejection Rate', value: '3.2', unit: '%', icon: AlertTriangle, delta: -0.8, status: 'good' },
    { label: 'Data Freshness', value: '1.4', unit: 'days', icon: Timer, delta: -15, status: 'good' },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <HeroBanner role="aqua-lo" />
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
        <KPIStrip cards={kpiCards} />

        {/* ── Recent Submissions ── */}
        {show('overview') && (
          <DashboardSection title="Recent Submissions" subtitle="Last 5 batches submitted to PIN">
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Batch ID</th>
                    <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Source</th>
                    <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Submitted</th>
                    <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Records</th>
                    <th className="text-left py-2.5 px-4 text-slate-500 font-medium text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_SUBMISSIONS.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 text-teal-700 font-mono text-xs font-semibold">{s.id}</td>
                      <td className="py-2.5 px-4 text-slate-700">{s.source}</td>
                      <td className="py-2.5 px-4 text-slate-500 text-xs">{s.submitted}</td>
                      <td className="py-2.5 px-4 text-slate-700">{s.records}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardSection>
        )}

        {/* ── Validation Queue ── */}
        {show('qaqc') && (
          <DashboardSection title="Validation Queue" subtitle="Batches pending QA/QC review">
            <div className="space-y-2">
              {MOCK_VALIDATION_QUEUE.map((v) => (
                <div key={v.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-4 h-4 text-teal-600" />
                    <div>
                      <div className="text-sm font-medium text-slate-800">{v.id}</div>
                      <div className="text-[10px] text-slate-400">{v.method} · {v.records} records · {v.age} ago</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {v.flagged > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                        {v.flagged} flagged
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                        Clean
                      </span>
                    )}
                    <button className="px-3 py-1.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 text-xs font-medium hover:bg-teal-100 transition-colors">
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </DashboardSection>
        )}

        {/* ── Rejection / Flag Summary ── */}
        {show('overview') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DashboardSection title="Rejection Summary" subtitle="Top failure reasons (last 30 days)">
              <div className="space-y-2">
                {MOCK_REJECTIONS.map((r) => (
                  <div key={r.reason} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-700">{r.reason}</span>
                        <span className="text-xs text-slate-500">{r.count} ({r.pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${r.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardSection>

            {/* ── Publication History ── */}
            <DashboardSection title="Publication History" subtitle="Records published to PIN per month">
              <div className="flex items-end gap-2 h-32">
                {MOCK_PUB_HISTORY.map((m) => {
                  const maxCount = Math.max(...MOCK_PUB_HISTORY.map(h => h.count));
                  const heightPct = (m.count / maxCount) * 100;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-500 font-medium">{m.count}</span>
                      <div className="w-full bg-slate-100 rounded-t-md overflow-hidden" style={{ height: '100px' }}>
                        <div
                          className="w-full bg-teal-400 rounded-t-md mt-auto"
                          style={{ height: `${heightPct}%`, marginTop: `${100 - heightPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </DashboardSection>
          </div>
        )}

        {/* ── PIN Network Status ── */}
        {show('overview') && (
          <DashboardSection title="PIN Network Status" subtitle="Confirmation that submitted data is live on the PIN network">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <Network className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                <div className="text-lg font-bold text-emerald-700">Online</div>
                <div className="text-[10px] text-emerald-600 mt-1">PIN Network Status</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                <TrendingUp className="w-6 h-6 text-teal-600 mx-auto mb-2" />
                <div className="text-lg font-bold text-slate-800">5,698</div>
                <div className="text-[10px] text-slate-500 mt-1">Total Records Published</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                <Timer className="w-6 h-6 text-sky-600 mx-auto mb-2" />
                <div className="text-lg font-bold text-slate-800">18 min</div>
                <div className="text-[10px] text-slate-500 mt-1">Avg. Publish Latency</div>
              </div>
            </div>
          </DashboardSection>
        )}

        {/* ── Submit Data (Push to PIN) ── */}
        {show('push') && lens !== 'overview' && (
          <DashboardSection title="Submit Data to PIN" subtitle="Select validated batches and publish to the Public Interest Network">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <Network className="w-8 h-8 text-teal-600 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-slate-800 mb-1">Submit Data</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Select validated batches and publish finalized results to the Public Interest Network for downstream consumers.
              </p>
            </div>
          </DashboardSection>
        )}

        {/* ── QA/QC (standalone lens view) ── */}
        {lens === 'qaqc' && (
          <DashboardSection title="QA/QC Metrics" subtitle="Method quality control performance">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Blank Pass Rate', value: '99.1%', status: 'good' as const },
                { label: 'Duplicate RPD', value: '96.2%', status: 'good' as const },
                { label: 'Spike Recovery', value: '94.5%', status: 'good' as const },
                { label: 'Overall QA/QC', value: '96.8%', status: 'good' as const },
              ].map((m) => (
                <div key={m.label} className={`rounded-lg border p-4 text-center ${
                  m.status === 'good' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className={`text-xl font-bold ${m.status === 'good' ? 'text-emerald-700' : 'text-amber-700'}`}>{m.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </DashboardSection>
        )}

        {/* ── Audit Trail ── */}
        {show('audit') && lens !== 'overview' && (
          <DashboardSection title="Audit Trail" subtitle="Immutable log of lab actions and changes">
            <div className="space-y-2">
              {MOCK_AUDIT.map((a, i) => (
                <div key={i} className="flex items-start gap-3 bg-white border border-slate-100 rounded-lg px-4 py-3">
                  {auditIcon(a.type)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-800">{a.action}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{a.user} · {a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardSection>
        )}

        {/* ── Reports ── */}
        {show('reports') && lens !== 'overview' && (
          <DashboardSection title="Reports" subtitle="Generate lab reports and export data">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <FileText className="w-8 h-8 text-teal-600 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-slate-800 mb-1">Lab Report Generator</h4>
              <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                Generate branded lab reports per sample or batch with QA/QC data, chain of custody, and certifications.
              </p>
              <div className="flex justify-center gap-3">
                <button className="px-4 py-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 text-sm font-medium hover:bg-teal-100 transition-colors">
                  Single Sample
                </button>
                <button className="px-4 py-2 rounded-lg bg-white text-slate-600 border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors">
                  Batch Report
                </button>
              </div>
            </div>
          </DashboardSection>
        )}
      </div>
    </div>
  );
}

export default function AquaLoPage() {
  return (
    <Suspense fallback={null}>
      <AquaLoContent />
    </Suspense>
  );
}
