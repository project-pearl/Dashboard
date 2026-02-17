'use client';

interface DataSourceFooterProps {
  dataSource?: string;
  timestamp?: Date;
  regionName?: string;
}

export function DataSourceFooter({ dataSource, timestamp, regionName }: DataSourceFooterProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2 bg-slate-50 border-t border-slate-200 rounded-b-xl text-xs text-slate-500">
      <div className="flex items-center gap-2">
        <span className="font-medium">Data source:</span>
        <span>{dataSource || 'Project PEARL / Ambient monitoring network'}</span>
      </div>
      {timestamp && (
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>Last updated: {timestamp.toLocaleString()}</span>
        </div>
      )}
      <div className="text-slate-400 italic">
        For research and planning purposes · Not for regulatory compliance without verification
      </div>
    </div>
  );
}
