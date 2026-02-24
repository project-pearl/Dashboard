'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WaterQualityData } from '@/lib/types';

interface ForecastChartProps {
  data: WaterQualityData;
  removalEfficiencies: Record<string, number>;
  userRole: string;
}

const PARAM_COLORS: Record<string, { ambient: string; treated: string }> = {
  DO: { ambient: '#ef4444', treated: '#22c55e' },
  turbidity: { ambient: '#f97316', treated: '#3b82f6' },
  TN: { ambient: '#a855f7', treated: '#22c55e' },
  TP: { ambient: '#ec4899', treated: '#14b8a6' },
  TSS: { ambient: '#dc2626', treated: '#10b981' },
  salinity: { ambient: '#06b6d4', treated: '#0ea5e9' },
};

const PARAM_LABELS: Record<string, string> = {
  DO: 'Dissolved Oxygen',
  turbidity: 'Turbidity',
  TN: 'Total Nitrogen',
  TP: 'Total Phosphorus',
  TSS: 'Total Suspended Solids',
  salinity: 'Salinity',
};

function generate24HourForecast(
  currentValue: number,
  efficiency: number, // 0-1 (e.g., 0.88 for 88% removal)
  paramType: 'increasing-bad' | 'decreasing-bad' | 'range-based'
): { hour: number; ambient: number; treated: number }[] {
  const points: { hour: number; ambient: number; treated: number }[] = [];
  
  for (let hour = 0; hour <= 24; hour++) {
    const timeOfDay = hour / 24;
    
    // Diurnal pattern (higher during day for DO, varies for others)
    const diurnalEffect = Math.sin(timeOfDay * Math.PI * 2 - Math.PI / 2) * 0.15;
    
    // Random noise
    const noise = (Math.random() - 0.5) * 0.08;
    
    // Without ALIA (ambient conditions)
    let ambient: number;
    if (paramType === 'decreasing-bad') {
      // DO drops lower without treatment
      ambient = currentValue * (0.85 + diurnalEffect * 0.4 + noise);
    } else {
      // Pollutants rise higher without treatment
      ambient = currentValue * (1.4 + diurnalEffect * 0.3 + noise);
    }
    
    // With ALIA treatment
    let treated: number;
    if (paramType === 'decreasing-bad') {
      // DO maintained higher with ALIA
      treated = currentValue * (1.0 + diurnalEffect * 0.2 + noise * 0.5);
    } else {
      // Pollutants reduced by efficiency
      const reductionFactor = 1 - efficiency;
      treated = ambient * reductionFactor;
    }
    
    points.push({
      hour,
      ambient: Math.max(0, ambient),
      treated: Math.max(0, treated)
    });
  }
  
  return points;
}

export function ForecastChart({ data, removalEfficiencies, userRole }: ForecastChartProps) {
  const forecastData = useMemo(() => {
    return Object.entries(data.parameters).map(([key, param]) => {
      const efficiency = (removalEfficiencies[key] || 0) / 100; // Convert to 0-1
      const forecast = generate24HourForecast(param.value, efficiency, param.type);
      return { key, param, forecast };
    });
  }, [data, removalEfficiencies]);

  const W = 1000, H = 100;
  const PAD_L = 50, PAD_R = 20, PAD_T = 10, PAD_B = 30;

  return (
    <Card className="border-2 border-cyan-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">24-Hour Water Quality Forecast</CardTitle>
        <CardDescription>
          Predicted conditions with and without ALIA treatment — Left to right: next 24 hours
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {forecastData.map(({ key, param, forecast }) => {
          const colors = PARAM_COLORS[key] || { ambient: '#94a3b8', treated: '#22c55e' };
          
          const values = forecast.map(p => [p.ambient, p.treated]).flat();
          const minV = Math.min(...values) * 0.9;
          const maxV = Math.max(...values) * 1.1;
          const range = maxV - minV || 1;

          const toPath = (dataPoints: { hour: number; value: number }[], type: 'ambient' | 'treated') => {
            return dataPoints.map((p, i) => {
              const x = PAD_L + (p.hour / 24) * (W - PAD_L - PAD_R);
              const y = PAD_T + (1 - (p.value - minV) / range) * (H - PAD_T - PAD_B);
              return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
            }).join(' ');
          };

          const ambientPath = toPath(
            forecast.map(p => ({ hour: p.hour, value: p.ambient })),
            'ambient'
          );
          const treatedPath = toPath(
            forecast.map(p => ({ hour: p.hour, value: p.treated })),
            'treated'
          );

          const decimals = key.includes('P') ? 3 : key.includes('N') ? 2 : 1;

          return (
            <div key={key} className="border border-slate-200 rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-slate-700">
                  {PARAM_LABELS[key] || key}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 rounded" style={{ background: colors.ambient }} />
                    <span className="text-slate-600">Without ALIA</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 rounded" style={{ background: colors.treated }} />
                    <span className="text-slate-600">With ALIA</span>
                  </div>
                </div>
              </div>

              <div className="relative">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
                  {/* Grid lines */}
                  <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H-PAD_B} stroke="#e2e8f0" strokeWidth="1" />
                  <line x1={PAD_L} y1={H-PAD_B} x2={W-PAD_R} y2={H-PAD_B} stroke="#e2e8f0" strokeWidth="1" />
                  
                  {/* Hour markers */}
                  {[0, 6, 12, 18, 24].map(hour => {
                    const x = PAD_L + (hour / 24) * (W - PAD_L - PAD_R);
                    return (
                      <g key={hour}>
                        <line x1={x} y1={H-PAD_B} x2={x} y2={H-PAD_B+5} stroke="#94a3b8" strokeWidth="1" />
                        <text x={x} y={H-PAD_B+18} textAnchor="middle" fontSize="10" fill="#64748b">
                          {hour}h
                        </text>
                      </g>
                    );
                  })}

                  {/* Y-axis labels */}
                  <text x={PAD_L-5} y={PAD_T} textAnchor="end" fontSize="10" fill="#64748b">
                    {maxV.toFixed(decimals)}
                  </text>
                  <text x={PAD_L-5} y={H-PAD_B} textAnchor="end" fontSize="10" fill="#64748b">
                    {minV.toFixed(decimals)}
                  </text>
                  <text x={10} y={H/2} textAnchor="middle" fontSize="9" fill="#94a3b8" transform={`rotate(-90 10 ${H/2})`}>
                    {param.unit}
                  </text>

                  {/* Ambient line (WITHOUT PEARL) - Dashed */}
                  <path
                    d={ambientPath}
                    fill="none"
                    stroke={colors.ambient}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="5,5"
                    opacity="0.7"
                  />

                  {/* Treated line (WITH PEARL) - Solid */}
                  <path
                    d={treatedPath}
                    fill="none"
                    stroke={colors.treated}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="mt-2 text-xs text-slate-500 text-center">
                Current: {param.value.toFixed(decimals)} {param.unit} • 
                Forecast shows expected range over next 24 hours with natural variation
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
