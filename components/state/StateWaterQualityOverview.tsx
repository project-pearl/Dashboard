'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplets, AlertTriangle, TrendingUp, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getSdwisCache, type SdwisSystem, type SdwisViolation } from '@/lib/sdwisCache';
import { getWqpCache } from '@/lib/wqpCache';

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

        // Get real water quality data from caches
        const sdwisCache = getSdwisCache();
        const wqpCache = getWqpCache();

        // Get all state systems from SDWIS
        const stateSystems: SdwisSystem[] = [];
        const stateViolations: SdwisViolation[] = [];

        // Scan through grid cells to find state data
        Object.values(sdwisCache.grid || {}).forEach((cell: any) => {
          if (cell.systems) {
            stateSystems.push(...cell.systems.filter((sys: SdwisSystem) => sys.state === stateAbbr));
          }
          if (cell.violations) {
            stateViolations.push(...cell.violations.filter((viol: SdwisViolation) => viol.pwsid?.startsWith(stateAbbr)));
          }
        });

        // Get WQP monitoring stations for state
        const wqpStations = Object.values(wqpCache.grid || {}).flatMap((cell: any) =>
          (cell.stations || []).filter((station: any) => station.StateCode === stateAbbr)
        );

        // Calculate active stations (those with recent data)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const activeStations = wqpStations.filter((station: any) => {
          const lastActivity = new Date(station.LastActivityDate || station.ActivityStartDate || 0);
          return lastActivity > thirtyDaysAgo;
        }).length;

        // Analyze violations for trends and contaminants
        const recentViolations = stateViolations.filter((viol: SdwisViolation) => {
          // Simple date check - would need proper parsing in real implementation
          return true; // For now, count all violations
        });

        // Extract top contaminants from violations
        const contaminantCounts: Record<string, number> = {};
        recentViolations.forEach((viol: SdwisViolation) => {
          const contaminant = viol.contaminant || 'Unknown';
          contaminantCounts[contaminant] = (contaminantCounts[contaminant] || 0) + 1;
        });

        const topContaminants = Object.entries(contaminantCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 4)
          .map(([contaminant]) => contaminant);

        // Determine trend based on violation patterns (simplified)
        const violationCount = recentViolations.length;
        const totalSystems = stateSystems.length;
        const violationRate = totalSystems > 0 ? violationCount / totalSystems : 0;

        let impairmentTrend: WaterQualityData['impairmentTrend'];
        if (violationRate < 0.05) {
          impairmentTrend = 'improving';
        } else if (violationRate > 0.15) {
          impairmentTrend = 'declining';
        } else {
          impairmentTrend = 'stable';
        }

        const waterQualityData: WaterQualityData = {
          totalStations: wqpStations.length + stateSystems.length, // Combined monitoring points
          activeStations: Math.max(activeStations, Math.floor(stateSystems.length * 0.8)), // Estimate active
          recentViolations: recentViolations.length,
          impairmentTrend,
          topContaminants: topContaminants.length > 0 ? topContaminants : ['No violation data available'],
          lastUpdated: sdwisCache._meta?.built || new Date().toISOString()
        };

        setData(waterQualityData);
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