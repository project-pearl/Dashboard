'use client';

import { WaterQualityAlert } from '@/lib/alertDetection';
import { AlertTriangle, AlertCircle, Info, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface WaterQualityAlertsProps {
  alerts: WaterQualityAlert[];
  dismissedAlerts: Set<string>;
  onDismiss: (id: string) => void;
  compact?: boolean;
}

function AlertItem({ alert, onDismiss }: { alert: WaterQualityAlert; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const styles = {
    severe:  { bg: 'bg-red-50',   border: 'border-red-300',   title: 'text-red-900',   body: 'text-red-700',   badge: 'bg-red-600 text-white',   icon: 'text-red-500'   },
    caution: { bg: 'bg-amber-50', border: 'border-amber-300', title: 'text-amber-900', body: 'text-amber-700', badge: 'bg-amber-500 text-white', icon: 'text-amber-500' },
    info:    { bg: 'bg-blue-50',  border: 'border-blue-300',  title: 'text-blue-900',  body: 'text-blue-700',  badge: 'bg-blue-600 text-white',  icon: 'text-blue-500'  },
  };
  const s = styles[alert.severity] || styles.info;
  const Icon = alert.severity === 'severe' ? AlertTriangle : alert.severity === 'caution' ? AlertCircle : Info;

  return (
    <div className={`rounded-xl border-2 ${s.bg} ${s.border} overflow-hidden`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${s.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-bold ${s.title}`}>{alert.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${s.badge}`}>
              {alert.severity}
            </span>
            {alert.isEJArea && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-600 text-white">
                EJ Area
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 leading-relaxed ${s.body}`}>{alert.message}</p>
          <div className={`text-xs mt-1 ${s.body} opacity-70`}>
            {alert.parameter} · {alert.threshold} · {alert.timestamp.toLocaleTimeString()}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {alert.recommendations && alert.recommendations.length > 0 && (
            <button onClick={() => setExpanded(!expanded)} className={`p-1 rounded hover:bg-black/5 ${s.title}`}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <button onClick={onDismiss} className={`p-1 rounded hover:bg-black/5 ${s.title}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && alert.recommendations && alert.recommendations.length > 0 && (
        <div className={`border-t ${s.border} px-4 py-3`}>
          <div className={`text-xs font-bold ${s.title} mb-2 uppercase tracking-wide`}>Recommendations</div>
          <ul className="space-y-1">
            {alert.recommendations.map((rec, i) => (
              <li key={i} className={`flex items-start gap-2 text-xs ${s.body}`}>
                <span className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-current opacity-60" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function WaterQualityAlerts({ alerts, dismissedAlerts, onDismiss, compact }: WaterQualityAlertsProps) {
  const visible = alerts.filter(a => !dismissedAlerts.has(a.id));

  if (visible.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border-2 border-green-200 text-green-700">
        <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
        <span className="text-sm font-medium">All parameters within acceptable ranges — no active alerts</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.map(alert => (
        <AlertItem key={alert.id} alert={alert} onDismiss={() => onDismiss(alert.id)} />
      ))}
    </div>
  );
}
