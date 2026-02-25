'use client';

import React, { useRef, useCallback } from 'react';
import Map, { NavigationControl, type MapRef } from 'react-map-gl';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export interface MapboxMapShellProps {
  /** Center as [lat, lng] — consumers keep existing Leaflet convention; internally flipped for Mapbox. */
  center: [number, number];
  zoom: number;
  height?: string;
  darkMode?: boolean;
  children?: React.ReactNode;
  interactiveLayerIds?: string[];
  onMapRef?: (map: MapRef) => void;
  onClick?: (e: mapboxgl.MapLayerMouseEvent) => void;
  onMouseMove?: (e: mapboxgl.MapLayerMouseEvent) => void;
  onMouseLeave?: (e: mapboxgl.MapLayerMouseEvent) => void;
  className?: string;
  mapKey?: string | number;
}

export function MapboxMapShell({
  center,
  zoom,
  height = '100%',
  darkMode = false,
  children,
  interactiveLayerIds,
  onMapRef,
  onClick,
  onMouseMove,
  onMouseLeave,
  className = '',
  mapKey,
}: MapboxMapShellProps) {
  const mapRef = useRef<MapRef>(null);

  const handleLoad = useCallback(() => {
    if (mapRef.current && onMapRef) {
      onMapRef(mapRef.current);
    }
  }, [onMapRef]);

  // Flip [lat, lng] → [lng, lat] for Mapbox
  const longitude = center[1];
  const latitude = center[0];

  return (
    <Map
      key={mapKey}
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{
        longitude,
        latitude,
        zoom,
      }}
      style={{ width: '100%', height }}
      mapStyle={darkMode
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/light-v11'
      }
      interactiveLayerIds={interactiveLayerIds}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onLoad={handleLoad}
      className={className}
    >
      <NavigationControl position="top-right" showCompass={false} />
      {children}
    </Map>
  );
}
