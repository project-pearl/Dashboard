'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { WaterQualityAlert, getAlertColor, getAlertBadgeColor, getAlertIcon } from '@/lib/alertDetection';

interface WaterQualityAlertsProps {
  alerts: WaterQualityAlert[];
  onDismiss: (alertId: string) => void;
  dismissedAlerts: Set<string>;
}

export function WaterQualityAlerts({ alerts, onDismiss, dismissedAlerts }: WaterQualityAlertsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeAlerts = alerts.filter(alert => !dismissedAlerts.has(alert.id));

  if (activeAlerts.length === 0) {
    return null;
  }

  if (!mounted) {
    return (
      <Alert className="border-2 border-slate-300 bg-slate-50 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="h-5 w-5 bg-slate-300 rounded mt-0.5"></div>
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-slate-300 rounded w-1/4"></div>
            <div className="h-4 bg-slate-300 rounded w-3/4"></div>
          </div>
        </div>
      </Alert>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'severe':
        return <AlertTriangle className={`h-5 w-5 ${getAlertIcon(severity as any)}`} />;
      case 'caution':
        return <AlertCircle className={`h-5 w-5 ${getAlertIcon(severity as any)}`} />;
      case 'info':
        return <Info className={`h-5 w-5 ${getAlertIcon(severity as any)}`} />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-3">
      {activeAlerts.map((alert) => (
        <Alert
          key={alert.id}
          className={`${getAlertColor(alert.severity)} border-2 relative animate-in slide-in-from-top-5 duration-300`}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={() => onDismiss(alert.id)}
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="flex items-start gap-3 pr-8">
            <div className="flex-shrink-0 mt-0.5">
              {getSeverityIcon(alert.severity)}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <AlertTitle className="text-base font-bold m-0">
                  {alert.title}
                </AlertTitle>
                <Badge className={`${getAlertBadgeColor(alert.severity)} text-xs font-bold`}>
                  {alert.severity.toUpperCase()}
                </Badge>
                {alert.isEJArea && (
                  <Badge className="bg-blue-600 text-white text-xs font-bold">
                    EJ AREA
                  </Badge>
                )}
                <span className="text-xs opacity-75 ml-auto">
                  {alert.timestamp.toLocaleTimeString()}
                </span>
              </div>

              <AlertDescription className="space-y-2">
                <p className="font-medium">
                  {alert.message}
                </p>

                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="font-semibold">{alert.parameter}:</span> {alert.value.toFixed(2)} {alert.type === 'poor-bmp' ? '%' : ''}
                  </div>
                  <div className="opacity-75">
                    Threshold: {alert.threshold}
                  </div>
                </div>

                {alert.recommendations && alert.recommendations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-current/20">
                    <div className="text-xs font-semibold mb-1">Recommended Actions:</div>
                    <ul className="space-y-0.5 text-xs">
                      {alert.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="mt-0.5">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      ))}
    </div>
  );
}
