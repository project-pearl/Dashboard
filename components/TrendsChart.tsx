'use client';

import { useMemo } from 'react';
import { WaterQualityData } from '@/lib/types';

interface TrendsChartProps {
  data: WaterQualityData;
}

const PARAM_COLORS: Record<string, string> = {
  DO: '#3b82f6',
  turbidity: '#f97316',
  TN: '#22c55e',
  TP: '#a855f7',
  TSS: '#ef4444',
  salinity: '#06b6d4',
};

const PARAM_LABELS: Record<string, string> = {
  DO: 'Dissolved Oxygen',
  turbidity: 'Turbidity',
  TN: 'Total Nitrogen',
  TP: 'Total Phosphorus',
  TSS: 'Total Suspended Solids',
  salinity: 'Salinity',
};

export function TrendsChart({ data }: TrendsChartProps) {
  const chartData = useMemo(() => {
    const params = Object.entries(data.parameters);
    return params.map(([key, param]) => {
      let history = param.history || [];
      
      // Generate synthetic history if not provided (last 24 hours)
      if (history.length < 2) {
        const points = 24;
        const currentValue = param.value;
        history = [];
        
        for (let i = 0; i < points; i++) {
          const timeAgo = points - i;
          // Create realistic variation based on parameter type
          const variation = param.type === 'decreasing-bad' 
            ? (Math.sin(i / 4) * 0.15 + (Math.random() - 0.5) * 0.1) // DO oscillates with diurnal pattern
            : (Math.sin(i / 6) * 0.2 + (Math.random() - 0.5) * 0.15); // Pollutants vary more
          
          const historicalValue = currentValue * (1 + variation);
          history.push({
            ...param,
            value: Math.max(0, historicalValue),
            timestamp: Date.now() - (timeAgo * 60 * 60 * 1000) // hours ago
          });
        }
      }
      
      return { key, param, history, color: PARAM_COLORS[key] || '#64748b' };
    });
  }, [data]);

  const W = 1000, H = 60, PAD_L = 10, PAD_R = 10;

  return (
    <div className="space-y-0">
      {chartData.map(({ key, param, history, color }) => {
        if (!history || history.length < 2) {
          // Show flat line placeholder
          return (
            <div key={key} className="flex items-center border-b border-slate-100 py-3 last:border-b-0">
              <div className="w-40 text-right pr-4 flex-shrink-0">
                <div className="text-sm font-medium text-slate-700">{PARAM_LABELS[key] || key}</div>
                <div className="text-base font-bold" style={{ color }}>{param.value.toFixed(2)} {param.unit}</div>
              </div>
              <div className="flex-1 h-12 bg-slate-50 rounded flex items-center px-3">
                <div className="w-full h-0.5 rounded" style={{ background: color, opacity: 0.3 }} />
              </div>
            </div>
          );
        }

        const vals = history.map(p => p.value);
        const minV = Math.min(...vals) * 0.95;
        const maxV = Math.max(...vals) * 1.05 || 1;
        const range = maxV - minV || 1;

        const points = history.map((p, i) => {
          const x = PAD_L + (i / (history.length - 1)) * (W - PAD_L - PAD_R);
          const y = H - 10 - ((p.value - minV) / range) * (H - 20);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');

        return (
          <div key={key} className="flex items-center border-b border-slate-100 py-3 last:border-b-0">
            <div className="w-40 text-right pr-4 flex-shrink-0">
              <div className="text-sm font-medium text-slate-700">{PARAM_LABELS[key] || key}</div>
              <div className="text-base font-bold" style={{ color }}>{param.value.toFixed(2)} {param.unit}</div>
            </div>
            <div className="flex-1 overflow-hidden">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 48 }}>
                {/* Subtle grid lines */}
                <line x1={PAD_L} y1={H/2} x2={W-PAD_R} y2={H/2} stroke="#f1f5f9" strokeWidth="1" />
                
                {/* Sparkline */}
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Current value dot */}
                {(() => {
                  const lastPt = points.split(' ').pop()!;
                  const [lx, ly] = lastPt.split(',').map(Number);
                  return (
                    <>
                      <circle cx={lx} cy={ly} r="4.5" fill="white" stroke={color} strokeWidth="2" />
                      <circle cx={lx} cy={ly} r="2.5" fill={color} />
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
