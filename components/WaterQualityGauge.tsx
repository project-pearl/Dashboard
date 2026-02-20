'use client';

import { useMemo } from 'react';
import { WaterQualityParameter } from '@/lib/types';
import { getWildlifeImpact } from '@/lib/wildlifeImpact';
import type { RemovalDisplayInfo } from '@/lib/removalCalculations';

export interface WaterQualityGaugeProps {
  parameter: WaterQualityParameter;
  dataSource?: string;
  showWildlife?: boolean;
  compact?: boolean;
  removalInfo?: RemovalDisplayInfo;
  wildlifePerspective?: boolean;
}

function getStatusColor(parameter: WaterQualityParameter): { 
  fill: string; 
  text: string; 
  bg: string; 
  border: string; 
  label: string;
  ringColor: string;
} {
  const v = parameter.value;
  const t = parameter.thresholds;

  const inRange = (v: number, range: { min?: number; max?: number }) => {
    const lo = range.min ?? -Infinity;
    const hi = range.max ?? Infinity;
    return v >= lo && v <= hi;
  };

  if (inRange(v, t.green)) {
    return { 
      fill: '#16a34a', 
      text: 'text-green-700', 
      bg: 'bg-green-50', 
      border: 'border-green-200', 
      label: 'Healthy',
      ringColor: '#22c55e'
    };
  }
  if (t.orange && inRange(v, t.orange)) {
    return { 
      fill: '#ea580c', 
      text: 'text-orange-700', 
      bg: 'bg-orange-50', 
      border: 'border-orange-200', 
      label: 'Elevated',
      ringColor: '#f97316'
    };
  }
  if (inRange(v, t.yellow)) {
    return { 
      fill: '#ca8a04', 
      text: 'text-yellow-700', 
      bg: 'bg-yellow-50', 
      border: 'border-yellow-200', 
      label: 'Caution',
      ringColor: '#eab308'
    };
  }
  return { 
    fill: '#dc2626', 
    text: 'text-red-700', 
    bg: 'bg-red-50', 
    border: 'border-red-200', 
    label: 'Critical',
    ringColor: '#ef4444'
  };
}

function getGaugeAngle(parameter: WaterQualityParameter): number {
  const { value, min, max } = parameter;
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  
  // Map to 270 degree arc (from -135° to +135°)
  // For decreasing-bad (DO): high values = right side (good)
  // For increasing-bad: low values = left side (good), high = right (bad)
  if (parameter.type === 'decreasing-bad') {
    return -135 + pct * 270;
  }
  return -135 + pct * 270;
}

export function WaterQualityGauge({ parameter, dataSource, showWildlife, compact }: WaterQualityGaugeProps) {
  const status = useMemo(() => getStatusColor(parameter), [parameter]);
  const angle = useMemo(() => getGaugeAngle(parameter), [parameter]);

  if (compact) {
    return (
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${status.bg} ${status.border}`}>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0`} style={{ background: status.fill }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-700 truncate">{parameter.name}</div>
          <div className={`text-sm font-bold ${status.text}`}>{parameter.value.toFixed(2)} {parameter.unit}</div>
        </div>
        <div className={`text-xs font-bold ${status.text}`}>{status.label}</div>
      </div>
    );
  }

  const cx = 100, cy = 100, radius = 70;
  const startAngle = -135;
  const endAngle = 135;
  
  // Convert angles to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  // Calculate arc path
  const startRad = toRad(startAngle);
  const endRad = toRad(endAngle);
  const needleRad = toRad(angle);
  
  const startX = cx + radius * Math.cos(startRad);
  const startY = cy + radius * Math.sin(startRad);
  const endX = cx + radius * Math.cos(endRad);
  const endY = cy + radius * Math.sin(endRad);
  
  const arcPath = `M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${endX} ${endY}`;
  
  // Needle tip position
  const needleLength = radius - 10;
  const needleTipX = cx + needleLength * Math.cos(needleRad);
  const needleTipY = cy + needleLength * Math.sin(needleRad);

  // Determine decimal places
  const decimals = parameter.name.includes('Phosphorus') || parameter.name.includes('TP') ? 3 : 
                   parameter.name.includes('Nitrogen') || parameter.name.includes('TN') ? 2 : 1;

  return (
    <div className="flex flex-col items-center">
      {/* Large Gauge SVG */}
      <div className="relative w-full max-w-[280px] aspect-square">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Background arc (light gray) */}
          <path
            d={arcPath}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="24"
            strokeLinecap="round"
          />
          
          {/* Colored status arc */}
          <path
            d={arcPath}
            fill="none"
            stroke={status.ringColor}
            strokeWidth="24"
            strokeLinecap="round"
            strokeDasharray={`${((angle - startAngle) / 270) * 330} 330`}
          />
          
          {/* Small red segment on right for critical zone (for increasing-bad params) */}
          {parameter.type !== 'decreasing-bad' && (
            <path
              d={arcPath}
              fill="none"
              stroke="#fee2e2"
              strokeWidth="24"
              strokeLinecap="round"
              strokeDasharray={`${270 * 0.85 * 330 / 270} 330`}
              strokeDashoffset={`-${270 * 0.85 * 330 / 270}`}
              opacity="0.5"
            />
          )}
          
          {/* Needle */}
          <line
            x1={cx}
            y1={cy}
            x2={needleTipX}
            y2={needleTipY}
            stroke="#1e293b"
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          {/* Center circle */}
          <circle cx={cx} cy={cy} r="6" fill="#1e293b" />
          <circle cx={cx} cy={cy} r="3" fill="white" />
          
          {/* Value text */}
          <text
            x={cx}
            y={cy + 35}
            textAnchor="middle"
            fontSize="26"
            fontWeight="700"
            fill={status.fill}
          >
            {parameter.value.toFixed(decimals)}
          </text>
          <text
            x={cx}
            y={cy + 48}
            textAnchor="middle"
            fontSize="11"
            fill="#64748b"
          >
            {parameter.unit}
          </text>
        </svg>
      </div>

      {/* Label and Status Badge */}
      <div className="text-center mt-3 w-full">
        <div className="text-base font-semibold text-slate-700 mb-1.5">{parameter.name}</div>
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${status.bg} ${status.text} border ${status.border}`}>
          {status.label}
        </div>
      </div>

      {/* Wildlife Impact (if enabled) */}
      {showWildlife && (() => {
        const impact = getWildlifeImpact(parameter);
        const wildlifeBg = impact.status === 'supportive' ? 'bg-green-50 border-green-200' :
                          impact.status === 'caution' ? 'bg-yellow-50 border-yellow-200' :
                          'bg-red-50 border-red-200';
        const wildlifeText = impact.status === 'supportive' ? 'text-green-700' :
                            impact.status === 'caution' ? 'text-yellow-700' :
                            'text-red-700';
        const emoji = impact.status === 'supportive' ? '🐟' : impact.status === 'caution' ? '⚠️' : '🚨';
        
        return (
          <div className={`mt-2 px-3 py-2 rounded-lg border text-xs ${wildlifeBg} ${wildlifeText} text-center max-w-[240px]`}>
            <span className="mr-1">{emoji}</span>
            {impact.text}
          </div>
        );
      })()}

      {dataSource && (
        <div className="text-xs text-slate-400 text-center mt-1.5">{dataSource}</div>
      )}
    </div>
  );
}
