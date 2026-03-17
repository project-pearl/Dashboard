'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';

export interface StatTile {
  value: string | number;
  label: string;
  color: string; // e.g. 'text-blue-600'
  /** Optional formatter — 'locale' calls .toLocaleString(), 'fixed1' calls .toFixed(1) */
  format?: 'locale' | 'fixed1';
}

export interface DataStatCardProps {
  /** 3 metric tiles to display */
  tiles: StatTile[];
  /** Data source badge (tile 4) */
  source: { name: string };
  /** Whether the underlying cache has loaded */
  loaded: boolean;
  /** Whether summaries are still loading from API */
  loading: boolean;
  /** Pending message shown when data hasn't loaded yet */
  pendingLabel: string;
  /** Top-states breakdown for detail expansion — { state: string; count: number }[] */
  topStates?: { state: string; count: number }[];
  /** Custom detail rows for non-state breakdowns (e.g. Congress bills) */
  detailRows?: { label: string; value: string | number }[];
  /** Label for the detail count column */
  detailCountLabel?: string;
  /** Called on first detail open to lazy-fetch detail data */
  onDetailOpen?: () => void;
  /** Navigate to related lens on click */
  onNavigate?: () => void;
}

function formatValue(tile: StatTile, loading: boolean, loaded: boolean): string {
  if (loading) return '...';
  if (!loaded) return '\u2014';
  const v = tile.value;
  if (tile.format === 'locale' && typeof v === 'number') return v.toLocaleString();
  if (tile.format === 'fixed1' && typeof v === 'number') return v.toFixed(1);
  if (typeof v === 'number') return v.toLocaleString();
  return String(v);
}

export function DataStatCard({
  tiles,
  source,
  loaded,
  loading,
  pendingLabel,
  topStates,
  detailRows,
  detailCountLabel = 'Count',
  onDetailOpen,
  onNavigate,
}: DataStatCardProps) {
  const [expandedTile, setExpandedTile] = useState<number | null>(null);
  const [detailRequested, setDetailRequested] = useState(false);

  const handleTileClick = useCallback((idx: number) => {
    if (!loaded) return;
    if (!detailRequested && onDetailOpen) {
      setDetailRequested(true);
      onDetailOpen();
    }
    setExpandedTile(prev => (prev === idx ? null : idx));
  }, [loaded, detailRequested, onDetailOpen]);

  // Collapse detail when data reloads
  useEffect(() => { setExpandedTile(null); }, [loaded]);

  const hasDetail = (topStates && topStates.length > 0) || (detailRows && detailRows.length > 0);
  const isClickable = loaded;

  return (
    <div className={`space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3 ${loaded && onNavigate ? 'pin-card-interactive group' : ''}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric tiles 1-3 */}
        {tiles.slice(0, 3).map((tile, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-4 ${
              isClickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors' : ''
            } ${expandedTile === idx ? 'ring-2 ring-blue-400 dark:ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
            onClick={() => isClickable && handleTileClick(idx)}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTileClick(idx); } } : undefined}
          >
            <div className={`text-2xl font-bold ${tile.color}`}>
              {formatValue(tile, loading, loaded)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{tile.label}</div>
          </div>
        ))}

        {/* Source badge tile (always position 4) */}
        <div
          className={`bg-slate-50 dark:bg-gray-800 rounded-lg p-4 border border-slate-200 dark:border-gray-700 flex flex-col items-center justify-center ${loaded && onNavigate ? 'cursor-pointer' : ''}`}
          onClick={loaded && onNavigate ? onNavigate : undefined}
          role={loaded && onNavigate ? 'button' : undefined}
          tabIndex={loaded && onNavigate ? 0 : undefined}
          onKeyDown={loaded && onNavigate ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(); } } : undefined}
        >
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 text-center leading-tight">
            {loaded ? source.name : '\u2014'}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Source</div>
          {loaded && onNavigate && (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>

      {/* Detail expansion row */}
      {expandedTile !== null && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 animate-in slide-in-from-top-1 duration-200">
          {hasDetail ? (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left pb-1.5 font-medium">{detailRows ? 'Item' : 'State'}</th>
                    <th className="text-right pb-1.5 font-medium">{detailCountLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {topStates && topStates.slice(0, 8).map((row) => (
                    <tr key={row.state} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                      <td className="py-1.5 font-medium text-gray-700 dark:text-gray-300">{row.state}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
                  {detailRows && detailRows.slice(0, 8).map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                      <td className="py-1.5 font-medium text-gray-700 dark:text-gray-300">{row.label}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{typeof row.value === 'number' ? row.value.toLocaleString() : row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {onNavigate && (
                <button
                  onClick={onNavigate}
                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  View full details <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </>
          ) : (
            <div className="text-xs text-gray-400 py-2 text-center">Loading detail...</div>
          )}
        </div>
      )}

      {/* Pending banner */}
      {!loading && !loaded && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>&#9203;</span>
          <span>{pendingLabel}</span>
          <Badge variant="outline" className="text-2xs bg-amber-50 text-amber-700 border-amber-200">Data Pending</Badge>
        </div>
      )}
    </div>
  );
}
