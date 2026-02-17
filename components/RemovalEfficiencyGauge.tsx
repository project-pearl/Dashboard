'use client';

import { useMemo } from 'react';

interface RemovalEfficiencyGaugeProps {
  parameterName: string;
  parameterKey?: string;
  influentValue: number;
  effluentValue: number;
  efficiency: number;
  unit: string;
  effluentParameter?: any;
}

export function RemovalEfficiencyGauge({
  parameterName,
  parameterKey,
  influentValue: rawInfluent,
  effluentValue: rawEffluent,
  efficiency: rawEfficiency,
  unit,
}: RemovalEfficiencyGaugeProps) {
  // Guard against undefined/NaN from missing mock data
  const efficiency = rawEfficiency ?? 0;
  const influentValue = rawInfluent ?? 0;
  const effluentValue = rawEffluent ?? 0;

  const isDO = parameterKey === 'DO';

  const { color, bgColor, borderColor, label } = useMemo(() => {
    if (isDO) {
      // DO: improvement is positive
      if (efficiency >= 10) return { color: '#16a34a', bgColor: 'bg-green-50', borderColor: 'border-green-200', label: 'Improved' };
      if (efficiency >= 0)  return { color: '#ca8a04', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', label: 'Stable' };
      return { color: '#dc2626', bgColor: 'bg-red-50', borderColor: 'border-red-200', label: 'Reduced' };
    }
    // Pollutants: high removal = good
    if (efficiency >= 80) return { color: '#16a34a', bgColor: 'bg-green-50', borderColor: 'border-green-200', label: 'Excellent' };
    if (efficiency >= 60) return { color: '#ca8a04', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', label: 'Good' };
    if (efficiency >= 40) return { color: '#ea580c', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', label: 'Fair' };
    return { color: '#dc2626', bgColor: 'bg-red-50', borderColor: 'border-red-200', label: 'Poor' };
  }, [efficiency, isDO]);

  const pct = Math.max(0, Math.min(100, Math.abs(efficiency)));

  return (
    <div className={`rounded-xl border-2 p-4 flex flex-col gap-3 ${bgColor} ${borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">{parameterName}</div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
          {label}
        </span>
      </div>

      {/* Efficiency bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500 font-medium">{isDO ? 'Improvement' : 'Removal'}</span>
          <span className="text-lg font-bold" style={{ color }}>
            {isDO && efficiency > 0 ? '+' : ''}{efficiency.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        {!isDO && (
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>0%</span>
            <span className="text-slate-500 font-medium">Target: 80%</span>
            <span>100%</span>
          </div>
        )}
      </div>

      {/* In/Out values */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/60 rounded-lg px-3 py-2 text-center">
          <div className="text-xs font-medium text-slate-500 mb-0.5">Influent</div>
          <div className="text-sm font-bold text-slate-700">{influentValue.toFixed(2)}</div>
          <div className="text-xs text-slate-400">{unit}</div>
        </div>
        <div className="bg-white/60 rounded-lg px-3 py-2 text-center">
          <div className="text-xs font-medium text-slate-500 mb-0.5">Effluent</div>
          <div className="text-sm font-bold" style={{ color }}>{effluentValue.toFixed(2)}</div>
          <div className="text-xs text-slate-400">{unit}</div>
        </div>
      </div>

      {/* MS4 compliance note */}
      {!isDO && parameterKey !== 'salinity' && (
        <div className="text-xs text-slate-500 text-center">
          {efficiency >= 80
            ? '✓ Meets MS4 target (≥80%)'
            : efficiency >= 60
            ? '~ Marginal for MS4 reporting'
            : '✗ Below MS4 target — review BMP'}
        </div>
      )}
    </div>
  );
}
