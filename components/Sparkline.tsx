'use client';

import React from 'react';

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, color, width = 60, height = 20 }: SparklineProps) {
  if (!data || data.length < 2) return null;

  const PAD = 2;
  const min = Math.min(...data) - 2;
  const max = Math.max(...data) + 2;
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = PAD + (i / (data.length - 1)) * (width - PAD * 2);
      const y = height - PAD - ((v - min) / range) * (height - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const last = data[data.length - 1];
  const lx = width - PAD;
  const ly = height - PAD - ((last - min) / range) * (height - PAD * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0" style={{ width, height }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lx} cy={ly} r="2" fill={color} />
    </svg>
  );
}
