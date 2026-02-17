'use client';

import { Leaf, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WildlifeImpactDisclaimerProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function WildlifeImpactDisclaimer({ enabled, onToggle }: WildlifeImpactDisclaimerProps) {
  return (
    <div className={`rounded-xl border-2 transition-all ${
      enabled 
        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' 
        : 'bg-slate-50 border-slate-200'
    }`}>
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex-shrink-0 ${enabled ? 'text-green-600' : 'text-slate-400'}`}>
            <Leaf className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-semibold ${enabled ? 'text-green-900' : 'text-slate-700'}`}>
                Wildlife Impact View
              </span>
              {enabled && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-600 text-white font-bold">
                  ON
                </span>
              )}
            </div>
            <p className={`text-xs leading-relaxed ${enabled ? 'text-green-700' : 'text-slate-600'}`}>
              {enabled 
                ? '🐟 Showing how water quality affects fish, shellfish, and aquatic vegetation. Each parameter includes ecological context.'
                : 'Toggle to see how each parameter impacts aquatic life — from a fish\'s perspective!'
              }
            </p>
          </div>
          <Button
            size="sm"
            variant={enabled ? 'default' : 'outline'}
            onClick={() => onToggle(!enabled)}
            className={enabled ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {enabled ? 'Hide' : 'Show'} Wildlife
          </Button>
        </div>

        {enabled && (
          <div className="mt-3 pt-3 border-t border-green-200 flex items-start gap-2">
            <Info className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-green-700 leading-relaxed">
              <span className="font-semibold">Educational View:</span> Wildlife interpretations are based on established water quality standards and ecological research. Parameter-specific impacts reference DO stress thresholds, SAV light requirements, and nutrient-driven algal bloom risks to aquatic ecosystems.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
