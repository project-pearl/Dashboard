/* ------------------------------------------------------------------ */
/*  SentinelAlertLayer — Map overlay for CRITICAL/WATCH/ADVISORY      */
/*  Renders inside MapboxMapShell as a child                          */
/* ------------------------------------------------------------------ */

'use client';

import React, { useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl';
import type { ScoredHucClient } from '@/lib/sentinel/types';

/* Mapbox tileset ID for HUC-8 boundaries — update after uploading   */
const HUC8_TILESET_ID = 'mapbox://mapbox.mapbox-terrain-v2'; // placeholder
const HUC8_SOURCE_LAYER = 'landcover'; // placeholder — update with actual layer

interface SentinelAlertLayerProps {
  criticalHucs: ScoredHucClient[];
  watchHucs: ScoredHucClient[];
  advisoryHucs: ScoredHucClient[];
  centroids: Record<string, { lat: number; lng: number }>;
  hucNames: Record<string, string>;
  onHucClick?: (huc8: string, level: string) => void;
  reducedMotion: boolean;
}

const MAX_ANIMATED_MARKERS = 10;

export function SentinelAlertLayer({
  criticalHucs,
  watchHucs,
  advisoryHucs,
  centroids,
  hucNames,
  onHucClick,
  reducedMotion,
}: SentinelAlertLayerProps) {
  // Top 10 CRITICAL by score for animated markers
  const animatedCritical = useMemo(
    () => criticalHucs.slice(0, MAX_ANIMATED_MARKERS),
    [criticalHucs]
  );

  // ADVISORY as GeoJSON points at centroids
  const advisoryGeoJson = useMemo(() => {
    const features = advisoryHucs
      .map(h => {
        const c = centroids[h.huc8];
        if (!c) return null;
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
          properties: { huc8: h.huc8, score: h.score },
        };
      })
      .filter(Boolean);
    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [advisoryHucs, centroids]);

  return (
    <>
      {/* ── ADVISORY dots (visible at zoom ≥ 5) ── */}
      <Source id="sentinel-advisory" type="geojson" data={advisoryGeoJson as any}>
        <Layer
          id="sentinel-advisory-circles"
          type="circle"
          minzoom={5}
          paint={{
            'circle-radius': 6,
            'circle-color': '#FDD835',
            'circle-opacity': 0.8,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#F9A825',
          }}
        />
      </Source>

      {/* ── CRITICAL score badges + pulse markers (HTML overlay) ── */}
      {animatedCritical.map(h => {
        const c = centroids[h.huc8];
        if (!c) return null;
        return (
          <Marker
            key={`sentinel-critical-${h.huc8}`}
            longitude={c.lng}
            latitude={c.lat}
            anchor="center"
            onClick={e => {
              e.originalEvent.stopPropagation();
              onHucClick?.(h.huc8, 'CRITICAL');
            }}
          >
            <div className="relative flex items-center justify-center">
              {/* Pulse ring */}
              <div
                className={`absolute w-12 h-12 rounded-full bg-red-600 ${
                  reducedMotion ? 'opacity-25' : 'sentinel-pulse'
                }`}
              />
              {/* Score badge */}
              <div
                className="sentinel-score-badge relative z-10"
                data-level="CRITICAL"
                title={`${hucNames[h.huc8] ?? h.huc8} — Score: ${h.score}`}
              >
                {Math.round(h.score)}
              </div>
            </div>
          </Marker>
        );
      })}

      {/* ── WATCH score badges (no pulse, no boundary) ── */}
      {watchHucs.map(h => {
        const c = centroids[h.huc8];
        if (!c) return null;
        return (
          <Marker
            key={`sentinel-watch-${h.huc8}`}
            longitude={c.lng}
            latitude={c.lat}
            anchor="center"
            onClick={e => {
              e.originalEvent.stopPropagation();
              onHucClick?.(h.huc8, 'WATCH');
            }}
          >
            <div
              className="sentinel-score-badge"
              data-level="WATCH"
              title={`${hucNames[h.huc8] ?? h.huc8} — Score: ${h.score}`}
            >
              {Math.round(h.score)}
            </div>
          </Marker>
        );
      })}
    </>
  );
}
