'use client';

import { WaterQualityAlert } from '@/lib/alertDetection';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface AlertsBannerProps {
  alerts: WaterQualityAlert[];
  dismissedAlerts: Set<string>;
  onDismiss: (id: string) => void;
}

export function AlertsBanner({ alerts, dismissedAlerts, onDismiss }: AlertsBannerProps) {
  const visible = alerts.filter(a => !dismissedAlerts.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map(alert => {
        const isSevere = alert.severity === 'severe';
        const isCaution = alert.severity === 'caution';
        const bg = isSevere ? 'bg-red-50 border-red-300' : isCaution ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-300';
        const textColor = isSevere ? 'text-red-800' : isCaution ? 'text-amber-800' : 'text-blue-800';
        const Icon = isSevere ? AlertTriangle : isCaution ? AlertCircle : Info;
        const iconColor = isSevere ? 'text-red-500' : isCaution ? 'text-amber-500' : 'text-blue-500';

        return (
          <div key={alert.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 ${bg}`}>
            <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm ${textColor}`}>{alert.title}</div>
              <div className={`text-xs mt-0.5 ${textColor} opacity-90`}>{alert.message}</div>
              {alert.recommendations && alert.recommendations.length > 0 && (
                <ul className={`mt-1.5 text-xs ${textColor} opacity-80 space-y-0.5`}>
                  {alert.recommendations.slice(0, 2).map((r, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="mt-0.5 flex-shrink-0">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => onDismiss(alert.id)}
              className={`flex-shrink-0 p-0.5 rounded hover:bg-black/10 ${textColor}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
