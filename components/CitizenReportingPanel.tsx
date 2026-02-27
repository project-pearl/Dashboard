'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react';
import { WaterSampleUploadForm } from '@/components/uploads/WaterSampleUploadForm';
import { CSVUploadDropzone } from '@/components/uploads/CSVUploadDropzone';
import { useAuth } from '@/lib/authContext';

interface CitizenReportingPanelProps {
  stateAbbr: string;
}

interface Sample {
  id: string;
  parameter: string;
  value: number;
  unit: string;
  sample_date: string;
  location_name: string | null;
  status: string;
  volunteer_id: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; cls: string }> = {
  PENDING: { label: 'Pending', icon: Clock, cls: 'bg-amber-100 text-amber-700' },
  ACTIVE: { label: 'Approved', icon: CheckCircle, cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', icon: XCircle, cls: 'bg-red-100 text-red-700' },
};

function fmtDate(d: string): string {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

export function CitizenReportingPanel({ stateAbbr }: CitizenReportingPanelProps) {
  const { user } = useAuth();
  const userId = user?.uid || 'anonymous';

  const [recentSamples, setRecentSamples] = useState<Sample[]>([]);
  const [pendingSamples, setPendingSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    try {
      const [recentRes, pendingRes] = await Promise.all([
        fetch(`/api/uploads/samples?stateAbbr=${stateAbbr}`),
        fetch(`/api/uploads/pending?stateAbbr=${stateAbbr}&userRole=NGO`),
      ]);
      const recentData = await recentRes.json();
      const pendingData = await pendingRes.json();
      setRecentSamples(recentData.samples || []);
      setPendingSamples(pendingData.samples || []);
    } catch {
      // Silently fail — panels still render with empty state
    } finally {
      setLoading(false);
    }
  }, [stateAbbr]);

  useEffect(() => { fetchSamples(); }, [fetchSamples]);

  async function handleApprove(sampleIds: string[]) {
    try {
      await fetch('/api/uploads/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample_ids: sampleIds, approved_by: userId }),
      });
      fetchSamples();
    } catch { /* ignore */ }
  }

  async function handleReject(sampleIds: string[]) {
    try {
      await fetch('/api/uploads/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample_ids: sampleIds, approved_by: userId, action: 'reject' }),
      });
      fetchSamples();
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Users className="w-3.5 h-3.5" />
        <span>Citizen Reporting — Community Science Data Submission{stateAbbr ? ` (${stateAbbr})` : ''}</span>
      </div>

      {/* Manual entry form */}
      <WaterSampleUploadForm
        mode="citizen"
        userId={userId}
        stateAbbr={stateAbbr}
        onSubmitted={fetchSamples}
      />

      {/* CSV bulk upload */}
      <CSVUploadDropzone
        mode="citizen"
        userId={userId}
        stateAbbr={stateAbbr}
        onUploaded={fetchSamples}
      />

      {/* Recent approved submissions */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle size={16} className="text-emerald-600" />
              Recent Approved Submissions
              <Badge variant="secondary" className="ml-1 text-[10px]">{recentSamples.length}</Badge>
            </CardTitle>
            <button onClick={fetchSamples} className="p-1 hover:bg-slate-100 rounded" title="Refresh">
              <RefreshCw size={14} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <CardDescription>Approved citizen science submissions from your program</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSamples.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">No approved submissions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="pb-2 font-semibold">Parameter</th>
                    <th className="pb-2 font-semibold text-right">Value</th>
                    <th className="pb-2 font-semibold">Site</th>
                    <th className="pb-2 font-semibold">Date</th>
                    <th className="pb-2 font-semibold">Volunteer</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSamples.slice(0, 10).map(s => (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-700">{s.parameter}</td>
                      <td className="py-2 text-right font-semibold text-slate-800">{s.value} <span className="text-slate-400 font-normal">{s.unit}</span></td>
                      <td className="py-2 text-slate-600">{s.location_name || '—'}</td>
                      <td className="py-2 text-slate-600">{fmtDate(s.sample_date)}</td>
                      <td className="py-2 text-slate-600">{s.volunteer_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending approval queue */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock size={16} className="text-amber-600" />
            Pending Approval Queue
            <Badge variant="secondary" className="ml-1 text-[10px]">{pendingSamples.length} pending</Badge>
          </CardTitle>
          <CardDescription>Review and approve volunteer-submitted readings</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingSamples.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">No pending submissions</p>
          ) : (
            <div className="space-y-2">
              {pendingSamples.slice(0, 15).map(s => {
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.PENDING;
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge className={`text-[9px] ${cfg.cls}`}>{cfg.label}</Badge>
                      <span className="text-xs font-semibold text-slate-700">{s.parameter}</span>
                      <span className="text-xs text-slate-800 font-bold">{s.value} {s.unit}</span>
                      <span className="text-[10px] text-slate-500 truncate">{s.location_name || '—'}</span>
                      <span className="text-[10px] text-slate-400">{fmtDate(s.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => handleApprove([s.id])}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] text-red-700 border-red-300 hover:bg-red-50"
                        onClick={() => handleReject([s.id])}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
