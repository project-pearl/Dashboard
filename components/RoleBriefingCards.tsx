'use client';

import { useState } from 'react';
import { Activity, AlertCircle, ChevronDown, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Priority = 'High' | 'Medium' | 'Low';

export type BriefingActionItem = {
  id: string;
  priority: Priority;
  item: string;
  detail: string;
  color: string;
};

export type BriefingPulseMetric = {
  id: string;
  label: string;
  value: string;
  trend: string;
  color: string;
  bg: string;
  dest: string;
};

export type BriefingSummaryStat = {
  label: string;
  value: string;
  style: string;
};

type BriefingActionsCardProps = {
  title: string;
  description: string;
  dataAsOf: string;
  summary: BriefingSummaryStat[];
  spotlightTitle: string;
  spotlightBody: string;
  spotlightBadge?: string;
  actions: BriefingActionItem[];
  sourceNote?: string;
};

export function RoleBriefingActionsCard({
  title,
  description,
  dataAsOf,
  summary,
  spotlightTitle,
  spotlightBody,
  spotlightBadge,
  actions,
  sourceNote,
}: BriefingActionsCardProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-slate-600">{dataAsOf}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summary.map((kpi) => (
            <div key={kpi.label} className={`rounded-xl border px-4 py-3 ${kpi.style}`}>
              <p className="text-[10px] uppercase tracking-wide font-semibold">{kpi.label}</p>
              <p className="text-sm font-semibold mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-red-800">{spotlightTitle}</p>
            {spotlightBadge && <Badge className="bg-red-100 text-red-800 border-red-200">{spotlightBadge}</Badge>}
          </div>
          <p className="text-xs text-slate-700 mt-2">{spotlightBody}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Action Required</p>
          <div className="space-y-2">
            {actions.map((a) => (
              <div key={a.id}>
                <div
                  className={`rounded-lg border p-3 cursor-pointer hover:ring-1 hover:ring-blue-300 transition-all ${a.color}`}
                  onClick={() => setOpenId(openId === a.id ? null : a.id)}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{a.priority}</Badge>
                    <span className="text-xs flex-1">{a.item}</span>
                    <ChevronDown size={14} className={`flex-shrink-0 text-slate-400 transition-transform ${openId === a.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {openId === a.id && (
                  <div className="ml-4 mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                    <p className="text-xs text-slate-700">{a.detail}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {sourceNote && <p className="text-xs text-slate-400 italic">{sourceNote}</p>}
      </CardContent>
    </Card>
  );
}

type BriefingPulseCardProps = {
  title: string;
  description: string;
  metrics: BriefingPulseMetric[];
  sourceNote?: string;
  refreshNote?: string;
};

export function RoleBriefingPulseCard({
  title,
  description,
  metrics,
  sourceNote,
  refreshNote,
}: BriefingPulseCardProps) {
  const [openMetricId, setOpenMetricId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <div key={m.id}>
              <div
                className={`rounded-xl border p-4 cursor-pointer hover:ring-1 hover:ring-blue-300 transition-all ${m.bg}`}
                onClick={() => setOpenMetricId(openMetricId === m.id ? null : m.id)}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.label}</div>
                <div className={`text-2xl font-bold ${m.color} mt-1`}>{m.value}</div>
                <div className="text-[10px] text-slate-500 mt-1">{m.trend}</div>
              </div>
              {openMetricId === m.id && (
                <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-2">
                  <p className="text-[10px] text-blue-600 font-medium">{m.dest}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        {sourceNote && <p className="text-xs text-slate-400 mt-4 italic">{sourceNote}</p>}
        {refreshNote && <p className="text-[10px] text-slate-400 mt-2 italic">{refreshNote}</p>}
      </CardContent>
    </Card>
  );
}

