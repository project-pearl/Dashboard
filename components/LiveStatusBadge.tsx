'use client';

import { useEffect, useState } from 'react';
import { CloudRain } from 'lucide-react';

interface LiveStatusBadgeProps {
  secondsSinceUpdate: number;
  isStormSpiking: boolean;
  stormIntensity: number;
}

export function LiveStatusBadge({ secondsSinceUpdate, isStormSpiking, stormIntensity }: LiveStatusBadgeProps) {
  const [pulse, setPulse] = useState(true);

  // Pulse every second
  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-end gap-1.5">
      {/* Live badge */}
      <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-md">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{
            backgroundColor: isStormSpiking ? '#f97316' : '#22c55e',
            boxShadow: pulse
              ? `0 0 0 3px ${isStormSpiking ? 'rgba(249,115,22,0.3)' : 'rgba(34,197,94,0.3)'}`
              : 'none',
            transition: 'box-shadow 0.5s ease',
          }}
        />
        <span>{isStormSpiking ? 'STORM DETECTED' : 'LIVE'}</span>
      </div>

      {/* Last updated */}
      <span className="text-xs text-muted-foreground tabular-nums">
        Updated {secondsSinceUpdate}s ago
      </span>

      {/* Storm intensity bar */}
      {isStormSpiking && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-300 rounded-lg px-3 py-1.5 text-xs text-orange-800 font-medium shadow-sm animate-pulse">
          <CloudRain className="h-3.5 w-3.5" />
          <span>Storm runoff spike — {Math.round(stormIntensity * 100)}% intensity</span>
          <div className="w-20 h-1.5 bg-orange-200 rounded-full overflow-hidden ml-1">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${stormIntensity * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
