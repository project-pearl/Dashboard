'use client';

import React from 'react';
import { Source, Layer } from 'react-map-gl';
import type { FillLayer, LineLayer, Expression } from 'mapbox-gl';

export interface MapboxChoroplethProps {
  /** GeoJSON FeatureCollection for state boundaries. */
  geoData: GeoJSON.FeatureCollection;
  /** Mapbox expression for the fill color (e.g. match on feature property). */
  fillColorExpression: Expression | string;
  /** Currently selected state abbreviation — highlighted with a thicker outline. */
  selectedState?: string;
  /** Click handler receives the state abbreviation from feature properties.abbr. */
  onStateClick?: (abbr: string) => void;
  /** Fill opacity — a fixed number or a Mapbox expression (default 0.6). */
  fillOpacity?: number | Expression;
  /** Source ID prefix to avoid collisions when multiple choropleths exist. */
  sourceId?: string;
}

export function MapboxChoropleth({
  geoData,
  fillColorExpression,
  selectedState,
  fillOpacity = 0.6,
  sourceId = 'states-choropleth',
}: MapboxChoroplethProps) {
  const fillLayerId = `${sourceId}-fill`;
  const lineLayerId = `${sourceId}-line`;
  const highlightLayerId = `${sourceId}-highlight`;

  const fillLayer: FillLayer = {
    id: fillLayerId,
    type: 'fill',
    paint: {
      'fill-color': fillColorExpression as any,
      'fill-opacity': fillOpacity as any,
    },
  };

  const lineLayer: LineLayer = {
    id: lineLayerId,
    type: 'line',
    paint: {
      'line-color': '#94a3b8',
      'line-width': 0.8,
    },
  };

  const highlightLayer: LineLayer = {
    id: highlightLayerId,
    type: 'line',
    paint: {
      'line-color': '#3b82f6',
      'line-width': 2.5,
    },
    filter: selectedState
      ? ['==', ['get', 'abbr'], selectedState]
      : ['==', ['get', 'abbr'], ''],
  };

  return (
    <Source id={sourceId} type="geojson" data={geoData}>
      <Layer {...fillLayer} />
      <Layer {...lineLayer} />
      <Layer {...highlightLayer} />
    </Source>
  );
}
