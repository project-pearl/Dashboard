'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wind, AlertTriangle, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AirQualityData {
  currentAQI: number;
  aqiCategory: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
  primaryPollutant: string;
  monitoringSites: number;
  activeSites: number;
  recentExceedances: number;
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: string;
  topPollutants: { name: string; concentration: number; unit: string }[];
}

interface StateAirQualityMonitoringProps {
  stateAbbr: string;
}

export function StateAirQualityMonitoring({ stateAbbr }: StateAirQualityMonitoringProps) {
  const [data, setData] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAirQualityData = async () => {
      try {
        setLoading(true);

        // In real implementation, this would call EPA AirNow + AQS APIs
        // GET /api/state-air-quality?state=${stateAbbr}

        // Mock realistic data based on state characteristics
        const getStateAirData = (state: string): AirQualityData => {
          const baseData = {
            monitoringSites: Math.floor(Math.random() * 200) + 50,
            activeSites: Math.floor(Math.random() * 50) + 30,
            recentExceedances: Math.floor(Math.random() * 15) + 2,
            trend: ['improving', 'stable', 'declining'][Math.floor(Math.random() * 3)] as any,
            lastUpdated: new Date().toISOString(),
          };

          // State-specific AQI patterns
          if (state === 'CA') {
            return {
              ...baseData,
              currentAQI: 85 + Math.floor(Math.random() * 30),
              aqiCategory: 'Moderate',
              primaryPollutant: 'PM2.5',
              monitoringSites: 340,
              topPollutants: [
                { name: 'PM2.5', concentration: 28.4, unit: 'μg/m³' },
                { name: 'Ozone', concentration: 0.085, unit: 'ppm' },
                { name: 'NO2', concentration: 0.042, unit: 'ppm' }
              ]
            };
          }

          if (state === 'TX') {
            return {
              ...baseData,
              currentAQI: 75 + Math.floor(Math.random() * 40),
              aqiCategory: 'Moderate',
              primaryPollutant: 'Ozone',
              monitoringSites: 280,
              topPollutants: [
                { name: 'Ozone', concentration: 0.092, unit: 'ppm' },
                { name: 'PM2.5', concentration: 22.1, unit: 'μg/m³' },
                { name: 'SO2', concentration: 0.008, unit: 'ppm' }
              ]
            };
          }

          if (state === 'UT') {
            return {
              ...baseData,
              currentAQI: 90 + Math.floor(Math.random() * 35),
              aqiCategory: 'Unhealthy for Sensitive Groups',
              primaryPollutant: 'PM2.5',
              monitoringSites: 45,
              topPollutants: [
                { name: 'PM2.5', concentration: 35.2, unit: 'μg/m³' },
                { name: 'PM10', concentration: 58.7, unit: 'μg/m³' },
                { name: 'Ozone', concentration: 0.078, unit: 'ppm' }
              ]
            };
          }

          // Default for other states
          return {
            ...baseData,
            currentAQI: 45 + Math.floor(Math.random() * 30),
            aqiCategory: 'Good',
            primaryPollutant: 'PM2.5',
            topPollutants: [
              { name: 'PM2.5', concentration: 18.5, unit: 'μg/m³' },
              { name: 'Ozone', concentration: 0.065, unit: 'ppm' },
              { name: 'NO2', concentration: 0.025, unit: 'ppm' }
            ]
          };
        };

        await new Promise(resolve => setTimeout(resolve, 700));
        setData(getStateAirData(stateAbbr));
      } catch (error) {
        console.error('Error fetching air quality data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAirQualityData();
    const interval = setInterval(fetchAirQualityData, 10 * 60 * 1000); // Refresh every 10 minutes
    return () => clearInterval(interval);
  }, [stateAbbr]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wind className="h-5 w-5 text-blue-600" />
            Air Quality Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-slate-200 rounded w-1/2"></div>
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const getAQIColor = (aqi: number) => {
    if (aqi <= 50) return 'text-green-600 bg-green-50';
    if (aqi <= 100) return 'text-yellow-600 bg-yellow-50';
    if (aqi <= 150) return 'text-orange-600 bg-orange-50';
    if (aqi <= 200) return 'text-red-600 bg-red-50';
    if (aqi <= 300) return 'text-purple-600 bg-purple-50';
    return 'text-red-800 bg-red-100';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wind className="h-5 w-5 text-blue-600" />
            {stateAbbr} Air Quality
          </div>
          <Badge variant="outline" className="text-xs">
            Real-time
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current AQI */}
          <div className="text-center">
            <div className={`text-4xl font-bold rounded-lg p-3 ${getAQIColor(data.currentAQI)}`}>
              {data.currentAQI}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {data.aqiCategory} • Primary: {data.primaryPollutant}
            </div>
          </div>

          {/* Monitoring Network */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-bold">{data.monitoringSites.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Sites</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">{data.activeSites}</div>
              <div className="text-sm text-muted-foreground">Active Today</div>
            </div>
          </div>

          {/* Status Metrics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Recent Exceedances</span>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="font-semibold">{data.recentExceedances}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Air Quality Trend</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(data.trend)}
                <span className="font-semibold capitalize">{data.trend}</span>
              </div>
            </div>
          </div>

          {/* Top Pollutants */}
          <div>
            <div className="text-sm font-medium mb-2">Key Pollutant Levels</div>
            <div className="space-y-2">
              {data.topPollutants.map((pollutant, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{pollutant.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {pollutant.concentration} {pollutant.unit}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t text-xs text-muted-foreground text-center">
            Updates every 10 minutes • {new Date(data.lastUpdated).toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}