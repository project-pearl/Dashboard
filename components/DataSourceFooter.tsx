'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Database, Satellite, Cloud, Clock } from 'lucide-react';

export function DataSourceFooter() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card className="border-2 border-slate-200 bg-slate-50">
        <CardContent className="pt-6">
          <div className="space-y-4 animate-pulse">
            <div className="h-6 bg-slate-300 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-32 bg-slate-300 rounded"></div>
              <div className="h-32 bg-slate-300 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Data Source Architecture
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-green-200">
              <Satellite className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-green-900 mb-1">Pearl Live Sensor Data</div>
                <p className="text-sm text-slate-700">
                  Real-time push from deployed Pearl sensors. Data updates every 15 minutes with sub-minute resolution during storm events. Direct WebSocket connection to backend for instant alerts.
                </p>
                <div className="mt-2 text-xs text-green-700 font-medium">
                  ✓ Available: Escambia Bay, Middle Branch Patapsco
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-amber-200">
              <Cloud className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-900 mb-1">Ambient Monitoring Data</div>
                <p className="text-sm text-slate-700">
                  Retrieved from public APIs (USGS, Eyes on the Bay, state agencies). Scheduled pulls every 1-4 hours to avoid rate limits. Historical data for trend analysis and baseline comparisons.
                </p>
                <div className="mt-2 text-xs text-amber-700 font-medium">
                  ✓ Available: All locations without Pearl sensors
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-slate-100 rounded-lg border border-slate-300">
            <Clock className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700">
              <span className="font-semibold">Future Architecture:</span> All data (Pearl sensors + ambient API pulls) stored in time-series database with source metadata and timestamp. Real-time Pearl data prioritized for alerts and control decisions. Ambient data used for validation, long-term trends, and locations without sensors. Automatic failover to ambient sources if Pearl sensors offline.
            </div>
          </div>

          <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-200">
            Data retention: 90 days high-resolution, 2 years aggregated hourly, 10 years daily averages
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
