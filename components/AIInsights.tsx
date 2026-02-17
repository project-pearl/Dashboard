'use client';

import { useMemo } from 'react';
import { WaterQualityData, DataMode } from '@/lib/types';

interface AIInsightsProps {
  data: WaterQualityData;
  dataMode: DataMode;
  regionName?: string;
}

interface Insight {
  type: 'positive' | 'warning' | 'critical' | 'info';
  title: string;
  detail: string;
  metric?: string;
}

function generateInsights(data: WaterQualityData, regionName?: string): Insight[] {
  const insights: Insight[] = [];
  const p = data.parameters;

  // DO analysis
  if (p.DO.value < 4) {
    insights.push({ type: 'critical', title: 'Critical Hypoxia Risk', metric: `${p.DO.value.toFixed(2)} mg/L`, detail: 'Dissolved oxygen is critically low. Immediate fish kill risk — recommend emergency response.' });
  } else if (p.DO.value < 5) {
    insights.push({ type: 'warning', title: 'Low Dissolved Oxygen', metric: `${p.DO.value.toFixed(2)} mg/L`, detail: 'DO below 5 mg/L threshold. Aquatic life stress likely. Monitor hourly.' });
  } else if (p.DO.value >= 7) {
    insights.push({ type: 'positive', title: 'Excellent DO Levels', metric: `${p.DO.value.toFixed(2)} mg/L`, detail: 'Dissolved oxygen supports diverse aquatic life and healthy ecosystem function.' });
  }

  // Nutrient analysis
  if (p.TN.value > 1.0 || p.TP.value > 0.1) {
    const risk = p.TN.value > 1.5 || p.TP.value > 0.5 ? 'critical' : 'warning';
    insights.push({
      type: risk, title: risk === 'critical' ? 'Severe Nutrient Loading' : 'Elevated Nutrients',
      metric: `TN: ${p.TN.value.toFixed(2)}, TP: ${p.TP.value.toFixed(3)}`,
      detail: `Nutrient levels suggest algal bloom risk. TN at ${p.TN.value.toFixed(2)} mg/L, TP at ${p.TP.value.toFixed(3)} mg/L. TMDL compliance review recommended.`
    });
  }

  // TSS / turbidity
  if (p.TSS.value > 30 || p.turbidity.value > 25) {
    insights.push({
      type: 'warning', title: 'Elevated Sediment Load',
      metric: `TSS: ${p.TSS.value.toFixed(0)} mg/L`,
      detail: `High suspended solids may indicate a recent runoff event or BMP performance issue. Check upstream conditions.`
    });
  }

  // Trend prediction
  if (insights.filter(i => i.type === 'critical').length >= 2) {
    insights.push({ type: 'critical', title: '48-hr Forecast: Deterioration Likely', metric: 'High risk', detail: 'Multiple critical parameters suggest compounding stress. Conditions may worsen without intervention.' });
  } else if (insights.filter(i => i.type === 'warning').length === 0 && insights.filter(i => i.type === 'critical').length === 0) {
    insights.push({ type: 'positive', title: 'All Parameters Within Range', metric: 'Healthy', detail: `${regionName || 'This waterbody'} is currently meeting water quality standards across all monitored parameters.` });
  }

  // TMDL compliance hint
  if (p.TN.value > 0.8 || p.TP.value > 0.04) {
    insights.push({ type: 'info', title: 'TMDL Proximity Alert', metric: 'Review recommended', detail: 'Nutrient levels approaching TMDL load limits. Document current readings for MS4 annual report.' });
  }

  return insights.slice(0, 5);
}

export function AIInsights({ data, dataMode, regionName }: AIInsightsProps) {
  const insights = useMemo(() => generateInsights(data, regionName), [data, regionName]);

  const colors = {
    positive: { bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500', title: 'text-green-800', detail: 'text-green-700', badge: 'bg-green-100 text-green-700' },
    warning:  { bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-500',  title: 'text-amber-800',  detail: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700'  },
    critical: { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    title: 'text-red-800',    detail: 'text-red-700',    badge: 'bg-red-100 text-red-700'    },
    info:     { bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500',   title: 'text-blue-800',   detail: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700'  },
  };

  return (
    <div className="space-y-3">
      {insights.map((insight, i) => {
        const c = colors[insight.type];
        return (
          <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${c.bg} ${c.border}`}>
            <div className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-semibold text-sm ${c.title}`}>{insight.title}</span>
                {insight.metric && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${c.badge}`}>{insight.metric}</span>
                )}
              </div>
              <p className={`text-xs mt-0.5 leading-relaxed ${c.detail}`}>{insight.detail}</p>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-slate-400 text-right pt-1">
        AI analysis based on current sensor readings · Not a substitute for professional assessment
      </p>
    </div>
  );
}
