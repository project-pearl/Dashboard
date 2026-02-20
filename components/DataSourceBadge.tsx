// components/DataSourceBadge.tsx
// Shows which real data sources are feeding the dashboard
'use client';

import { useState } from 'react';
import type { DataSourceId } from '@/lib/useWaterData';
import { DATA_SOURCES } from '@/lib/useWaterData';
import type { WaterDataResult } from '@/lib/useWaterData';

interface DataSourceBadgeProps {
  waterData: WaterDataResult | null;
  isLoading: boolean;
  compact?: boolean;
}

// Map source ID to dot color class
const SOURCE_DOT_COLORS: Record<string, string> = {
  USGS: 'bg-cyan-500',
  USGS_DV: 'bg-cyan-400',
  BWB: 'bg-emerald-500',
  CBP: 'bg-blue-500',
  WQP: 'bg-violet-500',
  ERDDAP: 'bg-teal-500',
  NOAA: 'bg-sky-500',
  MMW: 'bg-lime-500',
  EPA_EF: 'bg-orange-500',
  STATE: 'bg-rose-500',
  NASA_STREAM: 'bg-indigo-500',
  HYDROSHARE: 'bg-fuchsia-500',
  REFERENCE: 'bg-amber-500',
  MOCK: 'bg-gray-400',
};

function sourceDotColor(id: string): string {
  return SOURCE_DOT_COLORS[id] || 'bg-gray-400';
}

export function DataSourceBadge({ waterData, isLoading, compact = false }: DataSourceBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium animate-pulse">
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="24" strokeDashoffset="6" />
        </svg>
        Loading real data...
      </span>
    );
  }

  if (!waterData || waterData.activeSources.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Modeled Data
      </span>
    );
  }

  const primary = waterData.primarySource;
  const isLive = waterData.activeSources.some(s => s !== 'REFERENCE');
  const badgeLabel = isLive ? `Live Data — ${waterData.stationName}` : `Reference Data — ${waterData.stationName}`;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${primary.color} ${primary.textColor} text-xs font-medium`}>
        <span className={`w-1.5 h-1.5 rounded-full bg-current ${isLive ? 'animate-pulse' : ''}`} />
        {primary.name}
      </span>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${primary.color} ${primary.textColor} text-xs font-medium hover:opacity-80 transition-opacity cursor-pointer`}
      >
        <span className={`w-1.5 h-1.5 rounded-full bg-current ${isLive ? 'animate-pulse' : ''}`} />
        {badgeLabel}
        {waterData.activeSources.length > 1 && (
          <span className="ml-0.5 px-1 py-0 rounded bg-white/50 text-[10px]">
            +{waterData.activeSources.length - 1} source{waterData.activeSources.length > 2 ? 's' : ''}
          </span>
        )}
        <svg className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDetails && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-lg shadow-xl border z-50 p-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">Data Sources</div>
          {waterData.sourceDetails.map((detail, i) => (
            <div key={detail.source.id} className={`flex items-start gap-2 py-2 ${i > 0 ? 'border-t' : ''}`}>
              <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${sourceDotColor(detail.source.id)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`font-medium text-xs ${detail.source.textColor}`}>{detail.source.name}</span>
                  <span className="text-[10px] text-gray-400 px-1 py-0 rounded bg-gray-50">
                    {detail.parameterCount} param{detail.parameterCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 truncate">{detail.stationName}</div>
                {detail.lastSampled && (
                  <div className="text-[10px] text-gray-400">
                    Last sampled: {new Date(detail.lastSampled).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Per-parameter attribution */}
          <div className="mt-2 pt-2 border-t">
            <div className="text-[10px] font-medium text-gray-400 mb-1">PARAMETER SOURCES</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {Object.entries(waterData.parameters).map(([key, param]) => (
                <div key={key} className="flex items-center gap-1 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${sourceDotColor(param.source)}`} />
                  <span className="text-gray-600">{key}</span>
                  <span className="text-gray-400">→ {param.source}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t text-[10px] text-gray-400">
            Click any source name for documentation
          </div>
        </div>
      )}
    </div>
  );
}

// Simple inline badge for individual parameters
export function ParamSourceDot({ source }: { source: DataSourceId }) {
  const info = DATA_SOURCES[source];
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${sourceDotColor(source)}`}
      title={`Data from ${info.name}`}
    />
  );
}
