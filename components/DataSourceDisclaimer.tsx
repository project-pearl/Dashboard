'use client';

interface DataSourceDisclaimerProps {
  dataSource?: string;
  hasPearlData?: boolean;
  regionName?: string;
}

export function DataSourceDisclaimer({ dataSource, hasPearlData, regionName }: DataSourceDisclaimerProps) {
  if (!dataSource) return null;

  const isPearl = hasPearlData || dataSource.toLowerCase().includes('pearl');

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${
      isPearl
        ? 'bg-green-50 border-green-200 text-green-800'
        : 'bg-yellow-50 border-yellow-200 text-yellow-800'
    }`}>
      <span className="mt-0.5 flex-shrink-0">{isPearl ? '🟢' : '🟡'}</span>
      <span>
        <span className={`font-semibold ${isPearl ? 'text-green-700' : 'text-yellow-700'}`}>
          {isPearl ? 'PIN sensors — ' : 'Ambient monitoring — '}
        </span>
        {regionName && <span className="font-medium">{regionName}</span>}
        {dataSource && !isPearl && (
          <span className="opacity-80"> · {dataSource}</span>
        )}
      </span>
    </div>
  );
}
