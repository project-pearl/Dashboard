'use client';

import { DetectedStormEvent } from '@/lib/stormDetection';
import { CloudRain, X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface StormDetectionBannerProps {
  event: DetectedStormEvent;
  onDismiss: () => void;
}

export function StormDetectionBanner({ event, onDismiss }: StormDetectionBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const severityStyles = {
    high:     { bg: 'bg-red-950',    border: 'border-red-500',    badge: 'bg-red-600',    text: 'text-red-100',    icon: 'text-red-400'    },
    moderate: { bg: 'bg-amber-950',  border: 'border-amber-500',  badge: 'bg-amber-600',  text: 'text-amber-100',  icon: 'text-amber-400'  },
    low:      { bg: 'bg-blue-950',   border: 'border-blue-500',   badge: 'bg-blue-600',   text: 'text-blue-100',   icon: 'text-blue-400'   },
  };
  const s = severityStyles[event.severity];

  return (
    <div className={`rounded-xl border-2 ${s.bg} ${s.border} overflow-hidden`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CloudRain className={`h-5 w-5 flex-shrink-0 ${s.icon}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold ${s.text}`}>Storm Event Detected</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${s.badge} text-white`}>
                {event.severity}
              </span>
              <span className={`text-xs ${s.text} opacity-70`}>
                {event.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${s.text} opacity-80 leading-relaxed`}>
              {event.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-1 rounded hover:bg-white/10 ${s.text}`}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={onDismiss}
            className={`p-1 rounded hover:bg-white/10 ${s.text}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && event.recommendations.length > 0 && (
        <div className={`border-t ${s.border} px-4 py-3`}>
          <div className={`text-xs font-bold ${s.text} mb-2 uppercase tracking-wide`}>
            Recommended Actions
          </div>
          <ul className="space-y-1">
            {event.recommendations.map((rec, i) => (
              <li key={i} className={`flex items-start gap-2 text-xs ${s.text} opacity-80`}>
                <AlertTriangle className={`h-3 w-3 mt-0.5 flex-shrink-0 ${s.icon}`} />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
