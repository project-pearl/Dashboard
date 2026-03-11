'use client';

import React, { useMemo, useCallback, useRef } from 'react';
import Map, { Source, Layer, Marker, NavigationControl, type MapRef } from 'react-map-gl/mapbox';
import type { FillLayer, LineLayer, CircleLayer } from 'mapbox-gl';
import type { DemoGridData } from './DemoCommandCenter';
import { getStatesGeoJSONWithAbbr } from '@/lib/mapUtils';

/* ── Mapbox token ───────────────────────────────────────────────────── */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

/* ── CartoDB Dark Matter style spec for Mapbox GL ───────────────────── */

const CARTO_DARK_STYLE: mapboxgl.Style = {
  version: 8 as const,
  name: 'CartoDB Dark Matter',
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto-dark-tiles',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
  glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
};

/* ── Hardcoded anomaly markers ──────────────────────────────────────── */

const ANOMALY_MARKERS = [
  {
    id: 'back-river-md',
    label: 'Back River, MD',
    subtitle: 'Sewage discharge signature',
    lat: 39.2629,
    lng: -76.4744,
  },
  {
    id: 'anacostia-dc',
    label: 'Anacostia River, DC',
    subtitle: 'Urban runoff anomaly',
    lat: 38.8697,
    lng: -76.9456,
  },
];

/* ── Hardcoded DoD installation watershed polygons ──────────────────── */

const DOD_POLYGONS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Fort Meade — Patuxent Watershed' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-76.82, 39.12], [-76.72, 39.12], [-76.72, 39.18],
          [-76.82, 39.18], [-76.82, 39.12],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Joint Base Andrews — Western Branch' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-76.89, 38.79], [-76.82, 38.79], [-76.82, 38.84],
          [-76.89, 38.84], [-76.89, 38.79],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Naval Station Norfolk — Elizabeth River' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-76.35, 36.88], [-76.27, 36.88], [-76.27, 36.94],
          [-76.35, 36.94], [-76.35, 36.88],
        ]],
      },
    },
  ],
};

/* ── Entity → layer emphasis config ─────────────────────────────────── */

interface EntityOverlay {
  label: string;
  highlightLayers: string[];
  accentColor: string;
}

const ENTITY_OVERLAYS: Record<string, EntityOverlay> = {
  federal:    { label: 'Federal Oversight',       highlightLayers: ['impairment-fill', 'gauge-dots'], accentColor: '#3b82f6' },
  state:      { label: 'State Compliance',        highlightLayers: ['impairment-fill'],               accentColor: '#f59e0b' },
  dod:        { label: 'DoD Installations',       highlightLayers: ['dod-fill', 'dod-border'],        accentColor: '#60a5fa' },
  ms4:        { label: 'Stormwater Permits',      highlightLayers: ['impairment-fill', 'gauge-dots'], accentColor: '#06b6d4' },
  utility:    { label: 'Source Water Protection',  highlightLayers: ['gauge-dots'],                    accentColor: '#22c55e' },
  biopharma:  { label: 'Discharge Monitoring',     highlightLayers: ['gauge-dots'],                    accentColor: '#a855f7' },
  ngo:        { label: 'Watershed Restoration',    highlightLayers: ['impairment-fill'],               accentColor: '#10b981' },
  university: { label: 'Research Monitoring',      highlightLayers: ['gauge-dots'],                    accentColor: '#8b5cf6' },
  k12:        { label: 'Education & STEM',         highlightLayers: ['gauge-dots'],                    accentColor: '#f97316' },
  esg:        { label: 'Portfolio Water Risk',     highlightLayers: ['impairment-fill'],               accentColor: '#14b8a6' },
  investor:   { label: 'Infrastructure Risk',      highlightLayers: ['impairment-fill', 'gauge-dots'], accentColor: '#ec4899' },
  facility:   { label: 'Site Monitoring',          highlightLayers: ['gauge-dots'],                    accentColor: '#eab308' },
};

/* ── Props ──────────────────────────────────────────────────────────── */

interface IntelGridProps {
  gridData: DemoGridData;
  activeEntity: string | null;
  onAlertClick: (alertId: string) => void;
}

/* ── Component ──────────────────────────────────────────────────────── */

export function IntelGrid({ gridData, activeEntity, onAlertClick }: IntelGridProps) {
  const mapRef = useRef<MapRef>(null);

  /* Build impairment choropleth color expression from ATTAINS data */
  const statesGeo = useMemo(() => getStatesGeoJSONWithAbbr(), []);

  const impairmentFillExpr = useMemo((): any[] => {
    const stops: any[] = ['match', ['get', 'abbr']];
    for (const [st, pct] of Object.entries(gridData.impairmentByState)) {
      stops.push(st);
      if (pct >= 60) stops.push('rgba(220, 38, 38, 0.35)');       // red
      else if (pct >= 40) stops.push('rgba(245, 158, 11, 0.3)');   // amber
      else if (pct >= 20) stops.push('rgba(234, 179, 8, 0.2)');    // yellow
      else stops.push('rgba(34, 197, 94, 0.15)');                  // green
    }
    stops.push('rgba(100, 116, 139, 0.08)'); // default
    return stops;
  }, [gridData.impairmentByState]);

  /* Active entity accent */
  const overlay = activeEntity ? ENTITY_OVERLAYS[activeEntity] : null;
  const accentColor = overlay?.accentColor ?? '#06b6d4';

  /* Format timestamp */
  const lastUpdated = useMemo(() => {
    if (!gridData.lastUpdated) return '';
    try {
      return new Date(gridData.lastUpdated).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch { return gridData.lastUpdated; }
  }, [gridData.lastUpdated]);

  const handleMarkerClick = useCallback((id: string) => {
    onAlertClick(id);
  }, [onAlertClick]);

  /* ── Layer definitions ──────────────────────────────────────────────── */

  const impairmentFillLayer: FillLayer = {
    id: 'impairment-fill',
    source: 'states-demo',
    type: 'fill',
    paint: {
      'fill-color': impairmentFillExpr as any,
      'fill-opacity': activeEntity && !overlay?.highlightLayers.includes('impairment-fill') ? 0.05 : 0.6,
    },
  };

  const stateBorderLayer: LineLayer = {
    id: 'state-borders',
    source: 'states-demo',
    type: 'line',
    paint: {
      'line-color': 'rgba(148, 163, 184, 0.4)',
      'line-width': 0.6,
    },
  };

  const gaugeDotLayer: CircleLayer = {
    id: 'gauge-dots',
    source: 'gauge-sites',
    type: 'circle',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2.5, 10, 4] as any,
      'circle-color': accentColor,
      'circle-opacity': activeEntity && !overlay?.highlightLayers.includes('gauge-dots') ? 0.1 : 0.7,
      'circle-stroke-width': 0,
    },
  };

  const dodFillLayer: FillLayer = {
    id: 'dod-fill',
    source: 'dod-polygons',
    type: 'fill',
    paint: {
      'fill-color': 'rgba(96, 165, 250, 0.15)',
      'fill-opacity': activeEntity === 'dod' ? 0.4 : 0.15,
    },
  };

  const dodBorderLayer: LineLayer = {
    id: 'dod-border',
    source: 'dod-polygons',
    type: 'line',
    paint: {
      'line-color': '#60a5fa',
      'line-width': 2,
      'line-dasharray': [4, 3],
      'line-opacity': activeEntity === 'dod' ? 1 : 0.5,
    },
  };

  return (
    <div className="relative h-screen w-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: -98.5,
          latitude: 39.8,
          zoom: 4,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={CARTO_DARK_STYLE}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Layer 2 — State boundaries + impairment choropleth */}
        <Source id="states-demo" type="geojson" data={statesGeo}>
          <Layer {...impairmentFillLayer} />
          <Layer {...stateBorderLayer} />
        </Source>

        {/* Layer 4 — USGS IV gauge dots */}
        <Source id="gauge-sites" type="geojson" data={gridData.sites}>
          <Layer {...gaugeDotLayer} />
        </Source>

        {/* Layer 5 — DoD installation polygons */}
        <Source id="dod-polygons" type="geojson" data={DOD_POLYGONS}>
          <Layer {...dodFillLayer} />
          <Layer {...dodBorderLayer} />
        </Source>

        {/* Layer 6 — Pulsing anomaly markers */}
        {ANOMALY_MARKERS.map((m) => (
          <Marker
            key={m.id}
            longitude={m.lng}
            latitude={m.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(m.id);
            }}
          >
            <div className="relative flex items-center justify-center cursor-pointer">
              <div className="absolute w-14 h-14 rounded-full bg-red-600 sentinel-pulse" />
              <div className="relative z-10 w-5 h-5 rounded-full bg-red-600 border-2 border-red-300" />
            </div>
          </Marker>
        ))}
      </Map>

      {/* ── Overlays ────────────────────────────────────────────────────── */}

      {/* Top-left: Branding */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-wide text-white drop-shadow-lg">
            PIN
          </span>
          <span className="text-2xs font-semibold tracking-[0.25em] uppercase text-slate-300 drop-shadow">
            National Water Intelligence Grid
          </span>
        </div>
      </div>

      {/* Top-right: Live ticker */}
      <div className="absolute top-6 right-16 z-10">
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-lg px-4 py-2.5 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-slate-200 font-mono">
            {gridData.totalMonitoringPoints.toLocaleString()} active monitoring points
          </span>
          {lastUpdated && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-xs text-slate-400">
                Last updated: {lastUpdated}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Entity overlay label */}
      {overlay && (
        <div className="absolute top-20 left-6 z-10">
          <div
            className="px-3 py-1.5 rounded-md text-xs font-semibold tracking-wider uppercase"
            style={{ background: `${overlay.accentColor}20`, color: overlay.accentColor, border: `1px solid ${overlay.accentColor}40` }}
          >
            {overlay.label}
          </div>
        </div>
      )}

      {/* Bottom-center: Scroll chevron */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 opacity-60">
        <span className="text-xs text-slate-400 tracking-wider uppercase">Scroll</span>
        <svg
          className="w-5 h-5 text-slate-400 animate-bounce"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
