'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Fish, Info } from 'lucide-react';

export function WildlifeImpactDisclaimer() {
  return (
    <Card className="border-2 border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-teal-600 flex items-center justify-center">
            <Fish className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-bold text-sm text-teal-900 flex items-center gap-2">
              Wildlife Impact Indicators
              <Info className="h-4 w-4 text-teal-700" />
            </h3>
            <p className="text-xs text-teal-800 leading-relaxed">
              Each water quality parameter now includes wildlife impact indicators showing potential effects on aquatic ecosystems.
              These assessments are based on EPA Chesapeake Bay Program criteria and Maryland water quality standards for aquatic
              life use. Indicators use conservative language ("may affect," "potential risk," "supports habitat") and are
              tied directly to scientifically established thresholds. They do not predict specific outcomes but reflect
              evidence-based relationships between water quality and ecological health.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="flex items-center gap-1.5 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                <Fish className="h-3 w-3" />
                <span className="font-medium">Supportive</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                <Fish className="h-3 w-3" />
                <span className="font-medium">Caution</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                <Fish className="h-3 w-3" />
                <span className="font-medium">Risk</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
