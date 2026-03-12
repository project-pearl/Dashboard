/* ------------------------------------------------------------------ */
/*  SentinelAlertLayer — Map overlay for CRITICAL/WATCH/ADVISORY      */
/*  Renders inside MapboxMapShell as a child                          */
/* ------------------------------------------------------------------ */

'use client';

import React, { useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/mapbox';
import type { ScoredHucClient } from '@/lib/sentinel/types';

/* Mapbox tileset ID for HUC-8 boundaries — update after uploading   */
const HUC8_TILESET_ID = 'mapbox://mapbox.mapbox-terrain-v2'; // placeholder
const HUC8_SOURCE_LAYER = 'landcover'; // placeholder — update with actual layer

interface SentinelAlertLayerProps {
  anomalyHucs?: ScoredHucClient[];
  criticalHucs: ScoredHucClient[];
  watchHucs: ScoredHucClient[];
  advisoryHucs: ScoredHucClient[];
  centroids: Record<string, { lat: number; lng: number }>;
  hucNames: Record<string, string>;
  onHucClick?: (huc8: string, level: string) => void;
  reducedMotion: boolean;
  selectedHuc?: string | null;
}

const MAX_ANIMATED_MARKERS = 10;

export function SentinelAlertLayer({
  anomalyHucs = [],
  criticalHucs,
  watchHucs,
  advisoryHucs,
  centroids,
  hucNames,
  onHucClick,
  reducedMotion,
  selectedHuc,
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

      {/* ── ANOMALY score badges + pulse markers (purple) ── */}
      {anomalyHucs.slice(0, MAX_ANIMATED_MARKERS).map(h => {
        const c = centroids[h.huc8];
        if (!c) return null;
        return (
          <Marker
            key={`sentinel-anomaly-${h.huc8}`}
            longitude={c.lng}
            latitude={c.lat}
            anchor="center"
            onClick={e => {
              e.originalEvent.stopPropagation();
              onHucClick?.(h.huc8, 'ANOMALY');
            }}
          >
            <div className="relative flex items-center justify-center">
              <div
                className={`absolute w-14 h-14 rounded-full bg-purple-700 ${
                  reducedMotion ? 'opacity-25' : 'sentinel-pulse'
                }`}
              />
              <div
                className="sentinel-score-badge relative z-10"
                data-level="ANOMALY"
                title={`${hucNames[h.huc8] ?? h.huc8} — Score: ${h.score}`}
              >
                {Math.round(h.score)}
              </div>
            </div>
          </Marker>
        );
      })}

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

      {/* ── Selected HUC pin marker ── */}
      {selectedHuc && centroids[selectedHuc] && (
        <Marker
          key={`sentinel-selected-${selectedHuc}`}
          longitude={centroids[selectedHuc].lng}
          latitude={centroids[selectedHuc].lat}
          anchor="bottom"
        >
          <div className="flex flex-col items-center" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
            <div className="px-2 py-1 rounded-md text-2xs font-bold text-white mb-0.5"
              style={{ background: '#0d9488', whiteSpace: 'nowrap' }}>
              {hucNames[selectedHuc] ?? selectedHuc}
            </div>
            <svg width="20" height="28" viewBox="0 0 20 28">
              <path d="M10 0C4.5 0 0 4.5 0 10c0 7.5 10 18 10 18s10-10.5 10-18C20 4.5 15.5 0 10 0z" fill="#0d9488" />
              <circle cx="10" cy="10" r="4" fill="white" />
            </svg>
          </div>
        </Marker>
      )}
    </>
  );
}
