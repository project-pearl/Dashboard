'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, Satellite } from 'lucide-react';

interface DataSourceDisclaimerProps {
  hasPearlData: boolean;
  dataSource: string;
  regionName: string;
}

export function DataSourceDisclaimer({ hasPearlData, dataSource, regionName }: DataSourceDisclaimerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Alert className="bg-slate-50 border-slate-200 border-2 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 bg-slate-300 rounded"></div>
          <AlertDescription className="m-0">
            <div className="h-4 bg-slate-300 rounded w-3/4"></div>
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  if (hasPearlData) {
    return (
      <Alert className="bg-green-50 border-green-300 border-2">
        <div className="flex items-center gap-3">
          <Satellite className="h-5 w-5 text-green-700" />
          <AlertDescription className="text-green-900 font-medium m-0">
            <span className="font-bold">Live Project Pearl Data:</span> Real-time sensor data from deployed Pearl units in {regionName}
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  return (
    <Alert className="bg-amber-50 border-amber-400 border-2">
      <div className="flex items-center gap-3">
        <Database className="h-5 w-5 text-amber-700" />
        <AlertDescription className="text-amber-900 font-medium m-0">
          <span className="font-bold">⚠️ Ambient Monitoring Data:</span> Data shown is from ambient monitoring sources (USGS, state agencies, public databases) and NOT from Project Pearl sensors. Deploy a Pearl to access real-time, high-frequency water quality data for {regionName}.
        </AlertDescription>
      </div>
    </Alert>
  );
}
