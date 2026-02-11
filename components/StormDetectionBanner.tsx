'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CloudRain, X, AlertTriangle, Info } from 'lucide-react';
import { DetectedStormEvent } from '@/lib/stormDetection';

interface StormDetectionBannerProps {
  detectedEvent: DetectedStormEvent;
  onDismiss: () => void;
}

export function StormDetectionBanner({ detectedEvent, onDismiss }: StormDetectionBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (isDismissed) return null;

  if (!mounted) {
    return (
      <Alert className="border-2 border-slate-300 bg-slate-50 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="h-5 w-5 bg-slate-300 rounded mt-0.5"></div>
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-slate-300 rounded w-1/3"></div>
            <div className="h-4 bg-slate-300 rounded w-3/4"></div>
          </div>
        </div>
      </Alert>
    );
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss();
  };

  const getSeverityColor = () => {
    if (detectedEvent.severity === 'high') return 'bg-red-100 border-red-400';
    if (detectedEvent.severity === 'moderate') return 'bg-orange-100 border-orange-400';
    return 'bg-yellow-100 border-yellow-400';
  };

  const getSeverityBadgeColor = () => {
    if (detectedEvent.severity === 'high') return 'bg-red-600 text-white';
    if (detectedEvent.severity === 'moderate') return 'bg-orange-600 text-white';
    return 'bg-yellow-600 text-white';
  };

  const getSeverityIcon = () => {
    if (detectedEvent.severity === 'high') return <AlertTriangle className="h-6 w-6 text-red-700" />;
    if (detectedEvent.severity === 'moderate') return <CloudRain className="h-6 w-6 text-orange-700" />;
    return <Info className="h-6 w-6 text-yellow-700" />;
  };

  return (
    <Alert className={`${getSeverityColor()} border-2 relative animate-in slide-in-from-top-5 duration-500`}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex items-start gap-4 pr-8">
        <div className="flex-shrink-0 mt-1">
          {getSeverityIcon()}
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <AlertTitle className="text-lg font-bold m-0">
              Stormwater Event Detected
            </AlertTitle>
            <Badge className={`${getSeverityBadgeColor()} text-xs font-bold`}>
              {detectedEvent.severity.toUpperCase()} SEVERITY
            </Badge>
            <Badge variant="outline" className="text-xs">
              {detectedEvent.triggerType.toUpperCase()} TRIGGER
            </Badge>
            <span className="text-sm text-gray-600 ml-auto">
              {detectedEvent.timestamp.toLocaleString()}
            </span>
          </div>

          <AlertDescription className="space-y-3">
            <p className="font-semibold text-base">
              {detectedEvent.description}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {detectedEvent.triggers.tss && (
                <div className="bg-white rounded-lg p-3 border border-red-200">
                  <div className="text-xs font-medium text-gray-600 mb-1">TSS SPIKE</div>
                  <div className="text-lg font-bold text-red-700">
                    +{detectedEvent.triggers.tss.increase.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-600">
                    (+{detectedEvent.triggers.tss.absolute.toFixed(0)} mg/L)
                  </div>
                </div>
              )}
              {detectedEvent.triggers.turbidity && (
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <div className="text-xs font-medium text-gray-600 mb-1">TURBIDITY INCREASE</div>
                  <div className="text-lg font-bold text-orange-700">
                    +{detectedEvent.triggers.turbidity.increase.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-600">{detectedEvent.triggers.turbidity.threshold}</div>
                </div>
              )}
              {detectedEvent.triggers.tn && (
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="text-xs font-medium text-gray-600 mb-1">TN INCREASE</div>
                  <div className="text-lg font-bold text-blue-700">
                    +{detectedEvent.triggers.tn.increase.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-600">{detectedEvent.triggers.tn.threshold}</div>
                </div>
              )}
              {detectedEvent.triggers.tp && (
                <div className="bg-white rounded-lg p-3 border border-purple-200">
                  <div className="text-xs font-medium text-gray-600 mb-1">TP INCREASE</div>
                  <div className="text-lg font-bold text-purple-700">
                    +{detectedEvent.triggers.tp.increase.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-600">{detectedEvent.triggers.tp.threshold}</div>
                </div>
              )}
              {detectedEvent.triggers.do && (
                <div className="bg-white rounded-lg p-3 border border-cyan-200">
                  <div className="text-xs font-medium text-gray-600 mb-1">DO DROP</div>
                  <div className="text-lg font-bold text-cyan-700">
                    -{detectedEvent.triggers.do.decrease.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-600">{detectedEvent.triggers.do.threshold}</div>
                </div>
              )}
            </div>

            {detectedEvent.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="font-semibold text-sm text-blue-900 mb-2">
                  Recommended Actions:
                </div>
                <ul className="space-y-1 text-sm text-blue-800">
                  {detectedEvent.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-3">
              <p className="text-sm text-cyan-900">
                <span className="font-semibold">MS4/TMDL Documentation:</span> This event documents BMP performance for permit compliance during high-flow stormwater conditions. Influent vs effluent data and % removal efficiency are critical for annual reporting.
              </p>
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
