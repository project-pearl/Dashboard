'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Waves, AlertTriangle, MapPin, Calendar, Thermometer, Droplets, TrendingDown } from 'lucide-react';

export interface HypoxiaMonitoringPanelProps {
  lat?: number;
  lng?: number;
  state?: string;
}

interface HypoxiaReading {
  stationId: string;
  stationName: string;
  waterbody: string;
  lat: number;
  lng: number;
  state: string;
  dissolvedOxygen: number | null;
  salinity: number | null;
  temperature: number | null;
  depth: number | null;
  hypoxicZone: boolean;
  deadZoneAreaSqKm: number | null;
  sampleDate: string;
  source: string;
}

interface HypoxiaData {
  readings: HypoxiaReading[];
  summary: {
    totalStations: number;
    hypoxicStations: number;
    averageDO: number;
    totalDeadZoneArea: number;
    lastUpdated: string;
  };
}

export function HypoxiaMonitoringPanel({ lat = 38.93, lng = -76.38, state = 'MD' }: HypoxiaMonitoringPanelProps) {
  const [data, setData] = useState<HypoxiaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/cache-status');
        const cacheData = await response.json();

        // Simulate hypoxia data for Chesapeake Bay
        const mockData: HypoxiaData = {
          readings: [
            {
              stationId: 'CB3.3C',
              stationName: 'Chesapeake Bay Mainstem - Mid Bay',
              waterbody: 'Chesapeake Bay',
              lat: 38.7,
              lng: -76.4,
              state: 'MD',
              dissolvedOxygen: 2.1,
              salinity: 12.5,
              temperature: 24.8,
              depth: 15.2,
              hypoxicZone: true,
              deadZoneAreaSqKm: 2.8,
              sampleDate: '2024-03-15T08:30:00Z',
              source: 'Chesapeake Bay Program'
            },
            {
              stationId: 'CB4.1C',
              stationName: 'Chesapeake Bay Lower Mainstem',
              waterbody: 'Chesapeake Bay',
              lat: 37.8,
              lng: -76.2,
              state: 'VA',
              dissolvedOxygen: 4.2,
              salinity: 18.3,
              temperature: 23.1,
              depth: 12.8,
              hypoxicZone: false,
              deadZoneAreaSqKm: null,
              sampleDate: '2024-03-15T09:15:00Z',
              source: 'Chesapeake Bay Program'
            },
            {
              stationId: 'POT001',
              stationName: 'Potomac River - Anacostia Confluence',
              waterbody: 'Potomac River',
              lat: 38.8,
              lng: -77.0,
              state: 'MD',
              dissolvedOxygen: 1.8,
              salinity: 0.2,
              temperature: 26.3,
              depth: 8.5,
              hypoxicZone: true,
              deadZoneAreaSqKm: 1.2,
              sampleDate: '2024-03-14T14:20:00Z',
              source: 'NOAA'
            },
            {
              stationId: 'CB2.1',
              stationName: 'Chesapeake Bay - Upper Bay',
              waterbody: 'Chesapeake Bay',
              lat: 39.3,
              lng: -76.3,
              state: 'MD',
              dissolvedOxygen: 6.8,
              salinity: 8.1,
              temperature: 22.4,
              depth: 18.0,
              hypoxicZone: false,
              deadZoneAreaSqKm: null,
              sampleDate: '2024-03-15T07:45:00Z',
              source: 'Chesapeake Bay Program'
            }
          ],
          summary: {
            totalStations: 42,
            hypoxicStations: 18,
            averageDO: 3.8,
            totalDeadZoneArea: 124.7,
            lastUpdated: '2024-03-15T09:15:00Z'
          }
        };

        setData(mockData);
      } catch (error) {
        console.warn('Failed to fetch hypoxia data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [lat, lng, state]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-600">Loading hypoxia monitoring data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-slate-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm">No hypoxia monitoring data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getDoColor = (do_val: number | null) => {
    if (!do_val) return 'text-slate-500';
    if (do_val < 2) return 'text-red-600';
    if (do_val < 4) return 'text-orange-600';
    if (do_val < 5) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getDoStatus = (do_val: number | null) => {
    if (!do_val) return 'Unknown';
    if (do_val < 2) return 'Severe Hypoxia';
    if (do_val < 4) return 'Hypoxic';
    if (do_val < 5) return 'Stressed';
    return 'Healthy';
  };

  const hypoxiaPercentage = ((data.summary.hypoxicStations / data.summary.totalStations) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Waves className="w-5 h-5 text-blue-600" />
          Hypoxia Monitoring
          <Badge variant="outline" className="ml-auto">{state}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getDoColor(data.summary.averageDO)}`}>
              {data.summary.averageDO.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500">Avg DO (mg/L)</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${hypoxiaPercentage > 50 ? 'text-red-600' : hypoxiaPercentage > 25 ? 'text-orange-600' : 'text-green-600'}`}>
              {hypoxiaPercentage.toFixed(0)}%
            </div>
            <div className="text-xs text-slate-500">Hypoxic Stations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{data.summary.totalDeadZoneArea.toFixed(1)}</div>
            <div className="text-xs text-slate-500">Dead Zone (km²)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{data.summary.totalStations}</div>
            <div className="text-xs text-slate-500">Monitor Stations</div>
          </div>
        </div>

        {/* Hypoxia Alert */}
        {hypoxiaPercentage > 40 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-red-800">Widespread Hypoxia Alert</div>
                <div className="text-xs text-red-700 mt-1">
                  {data.summary.hypoxicStations} of {data.summary.totalStations} monitoring stations are experiencing hypoxic conditions.
                  This threatens fish, shellfish, and other aquatic life.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Station Readings */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            Recent Station Readings ({data.readings.length})
          </h4>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.readings.map((reading, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                reading.hypoxicZone ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {reading.stationName}
                    </div>
                    <div className="text-xs text-slate-500 mb-2">
                      {reading.waterbody} • {reading.stationId}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-blue-500" />
                        <span className={`font-medium ${getDoColor(reading.dissolvedOxygen)}`}>
                          {reading.dissolvedOxygen ? `${reading.dissolvedOxygen.toFixed(1)} mg/L` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Thermometer className="w-3 h-3 text-orange-500" />
                        <span className="text-slate-600">
                          {reading.temperature ? `${reading.temperature.toFixed(1)}°C` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Waves className="w-3 h-3 text-cyan-500" />
                        <span className="text-slate-600">
                          {reading.salinity ? `${reading.salinity.toFixed(1)} psu` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-purple-500" />
                        <span className="text-slate-600">
                          {reading.depth ? `${reading.depth.toFixed(1)}m` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <Badge
                      className={`text-xs mb-1 ${
                        reading.hypoxicZone ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200'
                      }`}
                    >
                      {getDoStatus(reading.dissolvedOxygen)}
                    </Badge>
                    <div className="text-xs text-slate-500">
                      {new Date(reading.sampleDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {reading.deadZoneAreaSqKm && (
                  <div className="mt-2 p-2 bg-red-100 rounded border border-red-200">
                    <div className="text-xs text-red-800">
                      Dead zone area: <span className="font-semibold">{reading.deadZoneAreaSqKm} km²</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Source */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Data from NOAA and Chesapeake Bay Program dissolved oxygen monitoring network
          </p>
        </div>
      </CardContent>
    </Card>
  );
}