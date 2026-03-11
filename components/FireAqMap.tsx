'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

const MapboxMapShell = dynamic(
  () => import('@/components/MapboxMapShell').then(m => m.MapboxMapShell),
  { ssr: false, loading: () => <div className="w-full h-[400px] rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse flex items-center justify-center"><span className="text-xs text-slate-400">Loading map…</span></div> }
);

interface Detection {
  lat: number;
  lng: number;
  frp: number;
  confidence: 'nominal' | 'high';
  acq_date: string;
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

// Wind speed color: <5kt blue, 5-15kt yellow, >15kt red
function windColor(kt: number): string {
  if (kt > 15) return '#ef4444';
  if (kt >= 5) return '#eab308';
  return '#3b82f6';
}

// Wind arrow SVG marker (rotated to show downwind direction)
function WindArrowMarker({ dir, speedKt }: { dir: number; speedKt: number }) {
  const downwind = (dir + 180) % 360;
  const color = windColor(speedKt);
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" style={{ transform: `rotate(${downwind}deg)` }}>
      <path d="M10 2 L14 14 L10 11 L6 14 Z" fill={color} stroke="white" strokeWidth="0.5" opacity="0.85" />
    </svg>
  );
}

export function FireAqMap({ data }: { data: MapData | null }) {
  const [selected, setSelected] = useState<Detection | null>(null);

  const fireGeoJson = useMemo(() => {
    if (!data) return { type: 'FeatureCollection' as const, features: [] };
    return {
      type: 'FeatureCollection' as const,
      features: data.detections.map((d, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [d.lng, d.lat] },
        properties: {
          idx: i,
          frp: d.frp,
          confidence: d.confidence,
          acq_date: d.acq_date,
          region: d.region,
          nearestInstallation: d.nearestInstallation || '',
          distMi: d.distanceToInstallationMi ?? 999,
        },
      })),
    };
  }, [data]);

  // react-map-gl components loaded at module level via next/dynamic
  const [RMG, setRMG] = useState<any>(null);
  React.useEffect(() => {
    import('react-map-gl/mapbox').then(mod => setRMG(mod)).catch(() => {});
  }, []);

  if (!data) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-xs text-slate-500">Loading map data...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="w-5 h-5 text-red-500" />
          Fire & Air Quality Situational Map
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden rounded-b-lg" style={{ height: 400 }}>
        <MapboxMapShell
          center={[30, 10]}
          zoom={1.5}
          height="100%"
          interactiveLayerIds={['fire-dots']}
          onClick={(e: any) => {
            const feature = e.features?.[0];
            if (feature?.properties) {
              const idx = feature.properties.idx;
              if (typeof idx === 'number' && data.detections[idx]) {
                setSelected(data.detections[idx]);
              }
            }
          }}
        >
          {RMG && (
            <>
              {/* Fire detections layer */}
              <RMG.Source id="fire-detections" type="geojson" data={fireGeoJson}>
                <RMG.Layer
                  id="fire-dots"
                  type="circle"
                  paint={{
                    'circle-radius': [
                      'interpolate', ['linear'], ['get', 'frp'],
                      0, 4,
                      50, 10,
                      200, 16,
                    ],
                    'circle-color': [
                      'match', ['get', 'confidence'],
                      'high', '#ef4444',
                      '#f97316',
                    ],
                    'circle-opacity': 0.8,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': 'rgba(255,255,255,0.5)',
                  }}
                />
              </RMG.Source>

              {/* Installation markers */}
              {data.installations.map(inst => (
                <RMG.Marker key={inst.id} latitude={inst.lat} longitude={inst.lng} anchor="center">
                  <div
                    className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center text-2xs font-bold ${
                      inst.burnPitHistory
                        ? 'bg-red-100 border-red-500 text-red-700'
                        : 'bg-blue-100 border-blue-500 text-blue-700'
                    }`}
                    title={`${inst.name} (${inst.branch})${inst.burnPitHistory ? ' — Burn Pit History' : ''}`}
                  >
                    {inst.branch[0]}
                  </div>
                </RMG.Marker>
              ))}

              {/* Wind arrows */}
              {data.windArrows.map((w, i) => (
                <RMG.Marker key={`wind-${i}`} latitude={w.fireLat} longitude={w.fireLng} anchor="center">
                  <WindArrowMarker dir={w.windDir} speedKt={w.windSpeedKt} />
                </RMG.Marker>
              ))}
            </>
          )}
        </MapboxMapShell>

        {/* Selection tooltip */}
        {selected && (
          <div className="absolute bottom-2 left-2 bg-white/95 border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-20 max-w-xs">
            <button
              className="absolute top-1 right-2 text-slate-400 hover:text-slate-600"
              onClick={() => setSelected(null)}
            >
              x
            </button>
            <div className="font-semibold text-slate-700 mb-1">Fire Detection</div>
            <div>FRP: <span className="font-mono">{selected.frp.toFixed(1)} MW</span></div>
            <div>Confidence: <span className={selected.confidence === 'high' ? 'text-red-600 font-semibold' : 'text-orange-600'}>{selected.confidence}</span></div>
            <div>Date: {selected.acq_date}</div>
            <div>Region: {selected.region}</div>
            {selected.nearestInstallation && (
              <div>Nearest base: {selected.nearestInstallation} ({selected.distanceToInstallationMi?.toFixed(1)} mi)</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
