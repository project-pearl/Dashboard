'use client';

import React from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { CARTO_TILE_URL, CARTO_DARK_TILE_URL, CARTO_ATTRIBUTION } from '@/lib/leafletMapUtils';

// ─── Zoom Controls ──────────────────────────────────────────────────────────
function ZoomControls({ homeCenter, homeZoom, darkMode }: {
  homeCenter: [number, number];
  homeZoom: number;
  darkMode?: boolean;
}) {
  const map = useMap();
  const base = darkMode
    ? 'w-7 h-7 rounded bg-slate-800/80 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-slate-700 text-sm font-bold'
    : 'w-7 h-7 rounded bg-white border border-slate-300 shadow-sm flex items-center justify-center hover:bg-slate-50 text-sm font-bold';
  const textColor = darkMode ? 'text-white' : 'text-slate-600';
  const homeColor = darkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1">
      <button onClick={() => map.zoomIn()} className={`${base} ${textColor}`}>+</button>
      <button onClick={() => map.zoomOut()} className={`${base} ${textColor}`}>{'\u2212'}</button>
      <button
        onClick={() => map.setView(homeCenter, homeZoom)}
        className={`${base} ${homeColor} !text-[10px] !font-medium`}
      >
        {'\u2302'}
      </button>
    </div>
  );
}

// ─── LeafletMapShell ────────────────────────────────────────────────────────
export interface LeafletMapShellProps {
  center: [number, number];
  zoom: number;
  maxZoom?: number;
  minZoom?: number;
  height?: string;
  children?: React.ReactNode;
  darkMode?: boolean;
  className?: string;
  showZoomControls?: boolean;
  mapKey?: string | number;
}

export function LeafletMapShell({
  center,
  zoom,
  maxZoom = 12,
  minZoom = 3,
  height = '100%',
  children,
  darkMode = false,
  className = '',
  showZoomControls = true,
  mapKey,
}: LeafletMapShellProps) {
  const tileUrl = darkMode ? CARTO_DARK_TILE_URL : CARTO_TILE_URL;

  return (
    <MapContainer
      key={mapKey}
      center={center}
      zoom={zoom}
      maxZoom={maxZoom}
      minZoom={minZoom}
      style={{ height, width: '100%' }}
      className={className}
      scrollWheelZoom={true}
      zoomControl={false}
    >
      <TileLayer url={tileUrl} attribution={CARTO_ATTRIBUTION} />
      {showZoomControls && (
        <ZoomControls homeCenter={center} homeZoom={zoom} darkMode={darkMode} />
      )}
      {children}
    </MapContainer>
  );
}

// ─── FlyTo helper — imperatively fly the map to new coords ──────────────────
export function FlyToLocation({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [map, center[0], center[1], zoom]);
  return null;
}
