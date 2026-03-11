/* ------------------------------------------------------------------ */
/*  NWSWeatherAlertLayer — Map overlay for severe weather warnings    */
/*  Renders NWS warning polygons + centroid fallback markers.         */
/* ------------------------------------------------------------------ */

'use client';

import React, { useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/mapbox';
import type { NwsAlert } from '@/lib/nwsAlertCache';

/* ------------------------------------------------------------------ */
/*  Color Palette by Event Type                                        */
/* ------------------------------------------------------------------ */

function eventColor(event: string): string {
  const lower = event.toLowerCase();
  if (lower.includes('tornado')) return '#DC2626';           // red
  if (lower.includes('severe thunderstorm')) return '#F59E0B'; // amber
  if (lower.includes('flash flood')) return '#3B82F6';       // blue
  if (lower.includes('hurricane') || lower.includes('tropical')) return '#8B5CF6'; // violet
  return '#6B7280'; // gray fallback
}

function eventFillColor(event: string): string {
  const lower = event.toLowerCase();
  if (lower.includes('tornado')) return 'rgba(220, 38, 38, 0.2)';
  if (lower.includes('severe thunderstorm')) return 'rgba(245, 158, 11, 0.2)';
  if (lower.includes('flash flood')) return 'rgba(59, 130, 246, 0.2)';
  if (lower.includes('hurricane') || lower.includes('tropical')) return 'rgba(139, 92, 246, 0.2)';
  return 'rgba(107, 114, 128, 0.15)';
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface NWSWeatherAlertLayerProps {
  alerts: NwsAlert[];
  onAlertClick?: (alert: NwsAlert) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function NWSWeatherAlertLayer({ alerts, onAlertClick }: NWSWeatherAlertLayerProps) {
  // Separate alerts with polygon geometry from those needing centroid fallback
  const { polygonAlerts, centroidAlerts, geojson } = useMemo(() => {
    const withPolygon: NwsAlert[] = [];
    const withCentroid: NwsAlert[] = [];

    for (const a of alerts) {
      if (a.geometry?.type === 'Polygon') {
        withPolygon.push(a);
      } else if (a.centroidLat != null && a.centroidLng != null) {
        withCentroid.push(a);
      }
    }

    // Build GeoJSON FeatureCollection from polygon alerts
    const features = withPolygon.map(a => ({
      type: 'Feature' as const,
      id: a.id,
      properties: {
        id: a.id,
        event: a.event,
        severity: a.severity,
        headline: a.headline,
        fillColor: eventFillColor(a.event),
        strokeColor: eventColor(a.event),
      },
      geometry: a.geometry as GeoJSON.Geometry,
    }));

    const geojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

    return {
      polygonAlerts: withPolygon,
      centroidAlerts: withCentroid,
      geojson,
    };
  }, [alerts]);

  if (alerts.length === 0) return null;

  return (
    <>
      {/* Polygon fills + outlines */}
      {geojson.features.length > 0 && (
        <Source id="nws-weather-polygons" type="geojson" data={geojson}>
          <Layer
            id="nws-weather-fill"
            type="fill"
            paint={{
              'fill-color': ['get', 'fillColor'],
              'fill-opacity': 0.6,
            }}
          />
          <Layer
            id="nws-weather-outline"
            type="line"
            paint={{
              'line-color': ['get', 'strokeColor'],
              'line-width': 2,
              'line-dasharray': [4, 2],
            }}
          />
        </Source>
      )}

      {/* Centroid fallback markers for alerts without polygon geometry */}
      {centroidAlerts.map(alert => (
        <Marker
          key={alert.id}
          latitude={alert.centroidLat!}
          longitude={alert.centroidLng!}
          anchor="center"
          onClick={() => onAlertClick?.(alert)}
        >
          <div
            className="nws-weather-marker"
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: eventColor(alert.event),
              border: '2px solid white',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              cursor: 'pointer',
            }}
            title={`${alert.event}: ${alert.headline || alert.areaDesc}`}
          />
        </Marker>
      ))}
    </>
  );
}
