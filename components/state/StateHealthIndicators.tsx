'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, TrendingUp, TrendingDown, Activity, AlertCircle, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HealthIndicator {
  metric: string;
  current: number;
  trend: 'improving' | 'stable' | 'worsening';
  unit: string;
  riskLevel: 'low' | 'moderate' | 'high';
}

interface WaterborneOutbreak {
  cases: number;
  type: string;
  reportedAt: string;
}

interface HealthIndicatorsData {
  populationAtRisk: number;
  waterborneIllness: {
    totalCases: number;
    activeOutbreaks: number;
    recentOutbreaks: WaterborneOutbreak[];
  };
  environmentalHealth: {
    airQualityDays: number;
    drinkingWaterViolations: number;
    exposureRisk: 'low' | 'moderate' | 'high';
  };
  keyIndicators: HealthIndicator[];
  hospitalCapacity: {
    total: number;
    available: number;
    utilizationRate: number;
  };
  lastUpdated: string;
}

interface StateHealthIndicatorsProps {
  stateAbbr: string;
}

export function StateHealthIndicators({ stateAbbr }: StateHealthIndicatorsProps) {
  const [data, setData] = useState<HealthIndicatorsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        setLoading(true);

        // In real implementation, this would call CDC + HHS APIs
        // GET /api/state-health-indicators?state=${stateAbbr}

        // Mock realistic health data based on state characteristics
        const getStateHealthData = (state: string): HealthIndicatorsData => {
          const statePopulations: Record<string, number> = {
            CA: 39500000, TX: 30000000, FL: 22600000, NY: 19200000,
            PA: 12800000, IL: 12600000, OH: 11800000, GA: 10900000,
            NC: 10700000, MI: 10000000
          };

          const population = statePopulations[state] || 6000000;
          const riskPopulation = Math.floor(population * (0.15 + Math.random() * 0.1));

          const baseIndicators: HealthIndicator[] = [
            {
              metric: 'Respiratory Disease Rate',
              current: 45 + Math.random() * 20,
              trend: Math.random() > 0.6 ? 'improving' : Math.random() > 0.3 ? 'stable' : 'worsening',
              unit: 'per 100k',
              riskLevel: 'moderate'
            },
            {
              metric: 'Waterborne Illness Rate',
              current: 2.5 + Math.random() * 1.5,
              trend: Math.random() > 0.5 ? 'improving' : 'stable',
              unit: 'per 100k',
              riskLevel: 'low'
            },
            {
              metric: 'Environmental Health Score',
              current: 75 + Math.random() * 15,
              trend: Math.random() > 0.4 ? 'improving' : 'stable',
              unit: 'index',
              riskLevel: 'moderate'
            }
          ];

          // State-specific health patterns
          if (['CA', 'TX', 'AZ', 'NV'].includes(state)) {
            baseIndicators[0].current += 15; // Higher respiratory issues in dry/polluted states
            baseIndicators[0].riskLevel = 'high';
          }

          if (['FL', 'LA', 'TX', 'AL'].includes(state)) {
            baseIndicators[1].current += 1; // Higher waterborne illness in hot/humid states
          }

          const recentOutbreaks: WaterborneOutbreak[] = [];
          const outbreakCount = Math.floor(Math.random() * 4);
          const outbreakTypes = ['Cryptosporidium', 'E. coli', 'Norovirus', 'Giardia', 'Legionella'];

          for (let i = 0; i < outbreakCount; i++) {
            recentOutbreaks.push({
              cases: Math.floor(Math.random() * 50) + 5,
              type: outbreakTypes[Math.floor(Math.random() * outbreakTypes.length)],
              reportedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
            });
          }

          return {
            populationAtRisk: riskPopulation,
            waterborneIllness: {
              totalCases: Math.floor(Math.random() * 200) + 50,
              activeOutbreaks: Math.floor(Math.random() * 3),
              recentOutbreaks
            },
            environmentalHealth: {
              airQualityDays: Math.floor(Math.random() * 50) + 200,
              drinkingWaterViolations: Math.floor(Math.random() * 30) + 5,
              exposureRisk: ['low', 'moderate', 'high'][Math.floor(Math.random() * 3)] as any
            },
            keyIndicators: baseIndicators,
            hospitalCapacity: {
              total: Math.floor(population / 2000),
              available: Math.floor(population / 2000) * 0.25,
              utilizationRate: 75 + Math.random() * 15
            },
            lastUpdated: new Date().toISOString()
          };
        };

        await new Promise(resolve => setTimeout(resolve, 900));
        setData(getStateHealthData(stateAbbr));
      } catch (error) {
        console.error('Error fetching health indicators:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHealthData();
  }, [stateAbbr]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-600" />
            Public Health Indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-16 bg-slate-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'worsening': return <TrendingDown className="h-3 w-3 text-red-600" />;
      default: return <Activity className="h-3 w-3 text-yellow-600" />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'moderate': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-600" />
            {stateAbbr} Health Indicators
          </div>
          <Badge variant="outline" className="text-xs">
            CDC + HHS Data
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Population at Risk */}
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-800">
              {(data.populationAtRisk / 1000000).toFixed(1)}M
            </div>
            <div className="text-sm text-blue-600">Population at Environmental Risk</div>
          </div>

          {/* Waterborne Illness */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Waterborne Illness Surveillance</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-lg font-bold">{data.waterborneIllness.totalCases}</div>
                <div className="text-xs text-muted-foreground">Total Cases (30 days)</div>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-bold text-orange-600">
                  {data.waterborneIllness.activeOutbreaks}
                </div>
                <div className="text-xs text-muted-foreground">Active Outbreaks</div>
              </div>
            </div>

            {data.waterborneIllness.recentOutbreaks.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium">Recent Outbreaks</div>
                {data.waterborneIllness.recentOutbreaks.slice(0, 3).map((outbreak, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span>{outbreak.type}</span>
                    <Badge variant="secondary" className="text-xs">
                      {outbreak.cases} cases
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Key Health Indicators */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Key Health Metrics</div>
            {data.keyIndicators.map((indicator, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm">{indicator.metric}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {getTrendIcon(indicator.trend)}
                    <span>{indicator.trend}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold px-2 py-1 rounded ${getRiskColor(indicator.riskLevel)}`}>
                    {indicator.current.toFixed(1)} {indicator.unit}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Environmental Health */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Environmental Health Status</div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-medium">{data.environmentalHealth.airQualityDays}</div>
                <div className="text-muted-foreground">Good Air Days</div>
              </div>
              <div>
                <div className="font-medium text-orange-600">
                  {data.environmentalHealth.drinkingWaterViolations}
                </div>
                <div className="text-muted-foreground">Water Violations</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Exposure Risk:</span>
              <Badge variant="secondary" className={`text-xs ${getRiskColor(data.environmentalHealth.exposureRisk)}`}>
                {data.environmentalHealth.exposureRisk}
              </Badge>
            </div>
          </div>

          {/* Hospital Capacity */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Hospital System Capacity</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="font-medium">{data.hospitalCapacity.total.toLocaleString()}</div>
                <div className="text-muted-foreground">Total Beds</div>
              </div>
              <div>
                <div className="font-medium text-green-600">{data.hospitalCapacity.available.toLocaleString()}</div>
                <div className="text-muted-foreground">Available</div>
              </div>
              <div>
                <div className="font-medium">{data.hospitalCapacity.utilizationRate.toFixed(1)}%</div>
                <div className="text-muted-foreground">Utilization</div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t text-xs text-muted-foreground text-center">
            Updated daily • {new Date(data.lastUpdated).toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}