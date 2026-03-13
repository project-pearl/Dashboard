'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Zap, Wind, AlertTriangle, Heart, HelpCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Detection {
  lat: number;
  lng: number;
  frp: number;
  confidence: 'nominal' | 'high';
  region: string;
  nearestInstallation: string | null;
  distanceToInstallationMi: number | null;
}

interface Installation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  burnPitHistory: boolean;
}

interface WindArrow {
  fireLat: number;
  fireLng: number;
  windDir: number;
  windSpeedKt: number;
}

interface MapData {
  detections: Detection[];
  installations: Installation[];
  stateAqi: Record<string, number | null>;
  windArrows: WindArrow[];
}

type InsightType = 'fire-proximity' | 'wind-smoke' | 'aqi-correlation' | 'burn-pit';

interface Insight {
  type: InsightType;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
}

const TYPE_ICONS: Record<InsightType, React.ReactNode> = {
  'fire-proximity': <AlertTriangle className="w-4 h-4 text-orange-500" />,
  'wind-smoke': <Wind className="w-4 h-4 text-blue-500" />,
  'aqi-correlation': <Zap className="w-4 h-4 text-amber-500" />,
  'burn-pit': <Heart className="w-4 h-4 text-rose-500" />,
};

const SEVERITY_STYLES: Record<string, string> = {
  info: 'border-blue-200 bg-blue-50',
  warning: 'border-amber-200 bg-amber-50',
  critical: 'border-red-200 bg-red-50',
};

// Haversine distance in miles
function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Compass direction from degrees
function compassDir(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// State abbreviation lookup by region — simplified mapping
const REGION_STATES: Record<string, string[]> = {
  'conus': ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'],
};

export function FireAqCorrelationCard() {
  const [data, setData] = useState<MapData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/fire-aq/map-data')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const insights = useMemo<Insight[]>(() => {
    if (!data) return [];
    const result: Insight[] = [];

    // 1. Fire-near-installation
    for (const inst of data.installations) {
      const nearby = data.detections.filter(d => {
        const dist = haversineMi(inst.lat, inst.lng, d.lat, d.lng);
        return dist <= 25;
      });
      const highConf = nearby.filter(d => d.confidence === 'high');
      if (nearby.length > 0) {
        const maxFrp = Math.max(...nearby.map(d => d.frp));
        result.push({
          type: 'fire-proximity',
          title: `Fires near ${inst.name}`,
          detail: `${nearby.length} fire detection${nearby.length > 1 ? 's' : ''} (${highConf.length} high-confidence) within 25mi. Max FRP: ${maxFrp.toFixed(1)} MW.${inst.burnPitHistory ? ' Installation has documented burn pit history.' : ''}`,
          severity: highConf.length >= 3 ? 'critical' : nearby.length >= 3 ? 'warning' : 'info',
        });
      }
    }

    // 2. Wind-smoke transport
    for (const w of data.windArrows) {
      // Find installations downwind
      const downwindDir = (w.windDir + 180) % 360;
      for (const inst of data.installations) {
        const dist = haversineMi(w.fireLat, w.fireLng, inst.lat, inst.lng);
        if (dist > 100 || dist < 1) continue;
        // Check if installation is roughly downwind
        const bearing = Math.atan2(inst.lng - w.fireLng, inst.lat - w.fireLat) * 180 / Math.PI;
        const normalizedBearing = ((bearing % 360) + 360) % 360;
        const angleDiff = Math.abs(normalizedBearing - downwindDir);
        const adjustedDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
        if (adjustedDiff <= 45) {
          result.push({
            type: 'wind-smoke',
            title: `Smoke transport toward ${inst.name}`,
            detail: `Winds from ${compassDir(w.windDir)} at ${w.windSpeedKt.toFixed(0)} kt suggest smoke transport toward ${inst.name} (${dist.toFixed(0)} mi downwind).`,
            severity: w.windSpeedKt > 15 ? 'warning' : 'info',
          });
        }
      }
    }

    // 3. AQI-fire correlation
    for (const [state, aqi] of Object.entries(data.stateAqi)) {
      if (aqi == null || aqi < 100) continue;
      // Check for fires in CONUS states
      const conusStates = REGION_STATES['conus'] || [];
      if (!conusStates.includes(state)) continue;
      const regionalFires = data.detections.filter(d => d.region === 'conus');
      if (regionalFires.length > 0) {
        result.push({
          type: 'aqi-correlation',
          title: `Elevated AQI in ${state}`,
          detail: `AQI of ${aqi} in ${state} correlated with ${regionalFires.length} active fire${regionalFires.length > 1 ? 's' : ''} in CONUS region.`,
          severity: aqi >= 151 ? 'critical' : 'warning',
        });
      }
    }

    // 4. Burn pit advisory
    for (const inst of data.installations) {
      if (!inst.burnPitHistory) continue;
      const nearbyFires = data.detections.filter(d => {
        return haversineMi(inst.lat, inst.lng, d.lat, d.lng) <= 50;
      });
      if (nearbyFires.length > 0) {
        result.push({
          type: 'burn-pit',
          title: `PACT Act advisory — ${inst.name}`,
          detail: `${nearbyFires.length} active fire${nearbyFires.length > 1 ? 's' : ''} within 50mi of ${inst.name} which has documented burn pit history. Exposure documentation warranted per PACT Act presumptive conditions.`,
          severity: 'critical',
        });
      }
    }

    // Deduplicate by title and sort by severity
    const seen = new Set<string>();
    const deduped = result.filter(r => {
      if (seen.has(r.title)) return false;
      seen.add(r.title);
      return true;
    });

    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    deduped.sort((a, b) => order[a.severity] - order[b.severity]);

    return deduped.slice(0, 20);
  }, [data]);

  const criticalInsights = insights.filter(i => i.severity === 'critical');
  const warningInsights = insights.filter(i => i.severity === 'warning');
  const infoInsights = insights.filter(i => i.severity === 'info');

  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set(['critical']));
  const toggleTier = (tier: string) =>
    setExpandedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier); else next.add(tier);
      return next;
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Fire-AQ Correlation Intelligence
          </CardTitle>
          <button className="p-1 rounded-md border border-slate-200 bg-white/90 shadow-sm hover:bg-slate-50 transition-colors" title="Correlation analysis between fire detections and air quality degradation near installations.">
            <HelpCircle className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <CardDescription className="text-xs">
          Cross-source narratives correlating fire detections, air quality, wind patterns, and installation proximity.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {!data && <div className="text-xs text-slate-500">Loading correlation data...</div>}
        {data && insights.length === 0 && (
          <div className="text-xs text-slate-500 bg-green-50 border border-green-200 rounded-lg p-3">
            No significant fire-AQ correlations detected. All installations clear.
          </div>
        )}
        {data && insights.length > 0 && (
          <>
            {/* Critical tier */}
            {criticalInsights.length > 0 && (
              <div>
                <button type="button" onClick={() => toggleTier('critical')} className="w-full flex items-center gap-2 text-sm font-semibold py-1 px-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-red-700">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Critical ({criticalInsights.length})
                  <span className="ml-auto">{expandedTiers.has('critical') ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
                </button>
                {expandedTiers.has('critical') && (
                  <div className={`space-y-2 mt-1 ${criticalInsights.length > 3 ? 'max-h-[240px] overflow-y-auto' : ''}`}>
                    {criticalInsights.map((insight, i) => (
                      <div key={i} className={`border rounded-lg p-3 ${SEVERITY_STYLES[insight.severity]}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {TYPE_ICONS[insight.type]}
                          <span className="text-sm font-semibold text-slate-700">{insight.title}</span>
                        </div>
                        <p className="text-xs text-slate-600">{insight.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Warning tier */}
            {warningInsights.length > 0 && (
              <div>
                <button type="button" onClick={() => toggleTier('warning')} className="w-full flex items-center gap-2 text-sm font-semibold py-1 px-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Warning ({warningInsights.length})
                  <span className="ml-auto">{expandedTiers.has('warning') ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
                </button>
                {expandedTiers.has('warning') && (
                  <div className={`space-y-2 mt-1 ${warningInsights.length > 3 ? 'max-h-[240px] overflow-y-auto' : ''}`}>
                    {warningInsights.map((insight, i) => (
                      <div key={i} className={`border rounded-lg p-3 ${SEVERITY_STYLES[insight.severity]}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {TYPE_ICONS[insight.type]}
                          <span className="text-sm font-semibold text-slate-700">{insight.title}</span>
                        </div>
                        <p className="text-xs text-slate-600">{insight.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Info tier */}
            {infoInsights.length > 0 && (
              <div>
                <button type="button" onClick={() => toggleTier('info')} className="w-full flex items-center gap-2 text-sm font-semibold py-1 px-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-blue-700">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Info ({infoInsights.length})
                  <span className="ml-auto">{expandedTiers.has('info') ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
                </button>
                {expandedTiers.has('info') && (
                  <div className={`space-y-2 mt-1 ${infoInsights.length > 3 ? 'max-h-[240px] overflow-y-auto' : ''}`}>
                    {infoInsights.map((insight, i) => (
                      <div key={i} className={`border rounded-lg p-3 ${SEVERITY_STYLES[insight.severity]}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {TYPE_ICONS[insight.type]}
                          <span className="text-sm font-semibold text-slate-700">{insight.title}</span>
                        </div>
                        <p className="text-xs text-slate-600">{insight.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
