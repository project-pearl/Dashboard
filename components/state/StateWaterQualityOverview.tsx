'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplets, AlertTriangle, TrendingUp, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

interface WaterQualityData {
  totalStations: number;
  activeStations: number;
  recentViolations: number;
  impairmentTrend: 'improving' | 'stable' | 'declining';
  topContaminants: string[];
  lastUpdated: string;
}

interface StateWaterQualityOverviewProps {
  stateAbbr: string;
}

export function StateWaterQualityOverview({ stateAbbr }: StateWaterQualityOverviewProps) {
  const [data, setData] = useState<WaterQualityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching real USGS + EPA data for the state
    const fetchData = async () => {
      try {
        setLoading(true);
        // In real implementation, this would call actual APIs
        // GET /api/state-water-quality?state=${stateAbbr}

        // Mock data based on realistic state scenarios
        const mockData: WaterQualityData = {
          totalStations: stateAbbr === 'CA' ? 1247 : stateAbbr === 'TX' ? 892 : Math.floor(Math.random() * 800) + 200,
          activeStations: Math.floor(Math.random() * 50) + 150,
          recentViolations: Math.floor(Math.random() * 30) + 5,
          impairmentTrend: ['improving', 'stable', 'declining'][Math.floor(Math.random() * 3)] as any,
          topContaminants: ['Nitrogen', 'E. coli', 'Sediment', 'Phosphorus'].slice(0, Math.floor(Math.random() * 3) + 2),
          lastUpdated: new Date().toISOString(),
        };

        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API call
        setData(mockData);
      } catch (error) {
        console.error('Error fetching water quality data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stateAbbr]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-600" />
            Water Quality Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const trendColor = data.impairmentTrend === 'improving' ? 'text-green-600' :
                    data.impairmentTrend === 'declining' ? 'text-red-600' : 'text-yellow-600';

  const trendIcon = data.impairmentTrend === 'improving' ? '↗️' :
                   data.impairmentTrend === 'declining' ? '↘️' : '→';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-blue-600" />
          {stateAbbr} Water Quality Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <div className="text-2xl font-bold">{data.totalStations.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Monitoring Stations</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-green-600">{data.activeStations}</div>
            <div className="text-sm text-muted-foreground">Active This Week</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Recent Violations</span>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="font-semibold">{data.recentViolations}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Impairment Trend</span>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${trendColor}`}>
                {trendIcon} {data.impairmentTrend}
              </span>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Top Contaminants</div>
            <div className="flex flex-wrap gap-1">
              {data.topContaminants.map((contaminant, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {contaminant}
                </Badge>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t text-xs text-muted-foreground">
            Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}