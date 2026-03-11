/* ------------------------------------------------------------------ */
/*  WeatherDrivenBadge — shown when a sentinel event is suppressed    */
/*  due to active severe weather.                                     */
/* ------------------------------------------------------------------ */

'use client';

import React from 'react';
import { CloudLightning } from 'lucide-react';

interface WeatherDrivenBadgeProps {
  weatherContext: string | null;
}

export function WeatherDrivenBadge({ weatherContext }: WeatherDrivenBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
      title={
        weatherContext
          ? `Anomaly suppressed: concurrent ${weatherContext} — likely weather-driven`
          : 'Anomaly suppressed: concurrent severe weather warning'
      }
    >
      <CloudLightning size={11} />
      Weather-Driven
    </span>
  );
}
