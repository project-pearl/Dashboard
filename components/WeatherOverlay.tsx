'use client';

import { Card } from '@/components/ui/card';
import { CloudRain, Waves, Thermometer, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function WeatherOverlay() {
  const mockWeather = {
    rainfall: 0.8,
    tide: 1.2,
    temperature: 52
  };

  return (
    <Card className="border-2 border-sky-200 bg-white/95 backdrop-blur-sm shadow-lg">
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-700">Live Conditions</h4>
          <Badge variant="secondary" className="text-xs bg-sky-100 text-sky-800">
            Real-time
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CloudRain className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-slate-600">Rainfall Today</div>
              <div className="text-sm font-bold text-slate-900">{mockWeather.rainfall} in</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-cyan-600 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-slate-600">Tide Level</div>
              <div className="text-sm font-bold text-slate-900">+{mockWeather.tide} ft</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-orange-600 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-slate-600">Temperature</div>
              <div className="text-sm font-bold text-slate-900">{mockWeather.temperature}°F</div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-blue-50 rounded p-2 border border-blue-200 mt-3">
          <Info className="h-3 w-3 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Real API integration (NOAA) coming soon
          </p>
        </div>
      </div>
    </Card>
  );
}
