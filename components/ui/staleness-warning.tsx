import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface StalenessWarningProps {
  fetchedAt?: string | null;
  thresholdHours?: number;
  children: React.ReactNode;
  className?: string;
}

/** Wraps children with a subtle warning banner when data exceeds the staleness threshold. */
export function StalenessWarning({
  fetchedAt,
  thresholdHours = 24,
  children,
  className = '',
}: StalenessWarningProps) {
  if (!fetchedAt) return <>{children}</>;

  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < thresholdHours) return <>{children}</>;

  const ageLabel = ageHours >= 48
    ? `${Math.round(ageHours / 24)}d ago`
    : `${Math.round(ageHours)}h ago`;

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-2xs rounded-t-lg">
        <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        <span>Data may be stale — last updated {ageLabel}</span>
      </div>
      {children}
    </div>
  );
}
