'use client';

import React, { useMemo } from 'react';
import { Source, Layer, Popup } from 'react-map-gl';
import type { CircleLayer } from 'mapbox-gl';

export interface MarkerDatum {
  id: string | number;
  lat: number;
  lon: number;
  color?: string;
  name?: string;
  /** Extra properties forwarded into GeoJSON feature properties. */
  [key: string]: any;
}

export interface MapboxMarkersProps {
  data: MarkerDatum[];
  /** Layer ID — must be unique per markers layer and added to interactiveLayerIds on MapboxMapShell. */
  layerId?: string;
  /** Circle radius in px (default 5). */
  radius?: number;
  /** Default color when marker has no `color` property. */
  defaultColor?: string;
  /** Hovered feature (from onMouseMove) — rendered as a Popup. */
  hoveredFeature?: mapboxgl.MapboxGeoJSONFeature | null;
}

export function MapboxMarkers({
  data,
  layerId = 'markers-circle',
  radius = 5,
  defaultColor = '#3b82f6',
  hoveredFeature,
}: MapboxMarkersProps) {
  const geojson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: data
      .filter((d) => d.lat != null && d.lon != null && isFinite(d.lat) && isFinite(d.lon))
      .map((d) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [d.lon, d.lat],
        },
        properties: {
          id: d.id,
          name: d.name || '',
          color: d.color || defaultColor,
          ...Object.fromEntries(
            Object.entries(d).filter(([k]) => !['lat', 'lon', 'id', 'name', 'color'].includes(k))
          ),
        },
      })),
  }), [data, defaultColor]);

  const circleLayer: CircleLayer = {
    id: layerId,
    type: 'circle',
    paint: {
      'circle-radius': radius,
      'circle-color': ['get', 'color'] as any,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1,
      'circle-opacity': 0.85,
    },
  };

  return (
    <>
      <Source id={`${layerId}-src`} type="geojson" data={geojson}>
        <Layer {...circleLayer} />
      </Source>
      {hoveredFeature && hoveredFeature.geometry.type === 'Point' && (
        <Popup
          longitude={(hoveredFeature.geometry as GeoJSON.Point).coordinates[0]}
          latitude={(hoveredFeature.geometry as GeoJSON.Point).coordinates[1]}
          closeButton={false}
          closeOnClick={false}
          offset={[0, -8]}
        >
          <span className="text-xs font-medium text-slate-800">
            {hoveredFeature.properties?.name || hoveredFeature.properties?.id}
          </span>
        </Popup>
      )}
    </>
  );
}
