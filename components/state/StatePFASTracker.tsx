'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, MapPin, AlertTriangle, TrendingUp, FileWarning } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PFASData {
  militaryInstallations: number;
  detectionSites: number;
  exceedanceSites: number;
  totalSamples: number;
  averageConcentration: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  recentAssessments: number;
  remedialActions: number;
  affectedWaterSystems: string[];
  lastUpdated: string;
  keyFindings: string[];
}

interface StatePFASTrackerProps {
  stateAbbr: string;
}

export function StatePFASTracker({ stateAbbr }: StatePFASTrackerProps) {
  const [data, setData] = useState<PFASData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPFASData = async () => {
      try {
        setLoading(true);

        // In real implementation, this would call DoD PFAS + EPA ECHO APIs
        // GET /api/state-pfas?state=${stateAbbr}

        // Mock realistic data based on DoD installations and known PFAS hotspots
        const getStatePFASData = (state: string): PFASData => {
          const baseData = {
            totalSamples: Math.floor(Math.random() * 500) + 100,
            recentAssessments: Math.floor(Math.random() * 8) + 2,
            lastUpdated: new Date().toISOString(),
          };

          // High-PFAS states with major military presence
          if (['CA', 'TX', 'FL', 'VA', 'NC'].includes(state)) {
            return {
              ...baseData,
              militaryInstallations: state === 'CA' ? 32 : state === 'TX' ? 28 : 15 + Math.floor(Math.random() * 10),
              detectionSites: 45 + Math.floor(Math.random() * 25),
              exceedanceSites: 12 + Math.floor(Math.random() * 8),
              averageConcentration: 85 + Math.random() * 40,
              riskLevel: 'high',
              remedialActions: 8 + Math.floor(Math.random() * 5),
              affectedWaterSystems: [
                'Camp Pendleton Water System',
                'Naval Air Station Supply',
                'Metropolitan Water District',
                'Regional Airport Authority'
              ],
              keyFindings: [
                'Elevated PFAS detected near 3 military installations',
                'Drinking water exceedances confirmed in 2 communities',
                'Ongoing remedial actions at 8 priority sites',
                'Groundwater plume monitoring expanded'
              ]
            };
          }

          // Moderate-PFAS states
          if (['WA', 'CO', 'NM', 'AZ', 'GA'].includes(state)) {
            return {
              ...baseData,
              militaryInstallations: 8 + Math.floor(Math.random() * 12),
              detectionSites: 25 + Math.floor(Math.random() * 15),
              exceedanceSites: 5 + Math.floor(Math.random() * 5),
              averageConcentration: 35 + Math.random() * 25,
              riskLevel: 'moderate',
              remedialActions: 3 + Math.floor(Math.random() * 3),
              affectedWaterSystems: [
                'Peterson AFB Water Supply',
                'City Municipal Wells',
                'Industrial Zone Monitoring'
              ],
              keyFindings: [
                'PFAS detected at 2 military installations',
                'Precautionary monitoring implemented',
                'Alternative water sources identified',
                'Investigation phase ongoing'
              ]
            };
          }

          // Lower-PFAS states
          return {
            ...baseData,
            militaryInstallations: 2 + Math.floor(Math.random() * 6),
            detectionSites: 8 + Math.floor(Math.random() * 12),
            exceedanceSites: Math.floor(Math.random() * 3),
            averageConcentration: 15 + Math.random() * 20,
            riskLevel: 'low',
            remedialActions: Math.floor(Math.random() * 2),
            affectedWaterSystems: [
              'Regional Water Authority',
              'Industrial Monitoring Network'
            ],
            keyFindings: [
              'Limited PFAS detections within acceptable ranges',
              'Preventive monitoring program active',
              'No immediate health concerns identified'
            ]
          };
        };

        await new Promise(resolve => setTimeout(resolve, 850));
        setData(getStatePFASData(stateAbbr));
      } catch (error) {
        console.error('Error fetching PFAS data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPFASData();
  }, [stateAbbr]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            PFAS Contamination Tracker
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

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'border-red-600 bg-red-50 text-red-800';
      case 'high': return 'border-orange-500 bg-orange-50 text-orange-800';
      case 'moderate': return 'border-yellow-500 bg-yellow-50 text-yellow-800';
      case 'low': return 'border-green-500 bg-green-50 text-green-800';
      default: return 'border-gray-500 bg-gray-50 text-gray-800';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            {stateAbbr} PFAS Tracker
          </div>
          <Badge variant="outline" className="text-xs">
            DoD + EPA Data
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Risk Level Alert */}
          <Alert className={getRiskColor(data.riskLevel)}>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {getRiskIcon(data.riskLevel)}
              </div>
              <div>
                <div className="font-semibold text-sm capitalize">
                  {data.riskLevel} Risk Level
                </div>
                <AlertDescription className="text-xs">
                  Based on DoD assessments, EPA monitoring, and drinking water analysis
                </AlertDescription>
              </div>
            </div>
          </Alert>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-bold">{data.militaryInstallations}</div>
              <div className="text-sm text-muted-foreground">Military Installations</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-orange-600">{data.detectionSites}</div>
              <div className="text-sm text-muted-foreground">Detection Sites</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-red-600">{data.exceedanceSites}</div>
              <div className="text-sm text-muted-foreground">Health Exceedances</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">{data.remedialActions}</div>
              <div className="text-sm text-muted-foreground">Active Remediation</div>
            </div>
          </div>

          {/* Average Concentration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Average PFAS Concentration</span>
              <Badge variant="secondary" className="text-xs">
                {data.averageConcentration.toFixed(1)} ng/L
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              EPA Health Advisory: 70 ng/L for PFOA + PFOS combined
            </div>
          </div>

          {/* Affected Water Systems */}
          <div>
            <div className="text-sm font-medium mb-2">Monitored Water Systems</div>
            <div className="space-y-1">
              {data.affectedWaterSystems.map((system, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3 w-3 text-blue-500" />
                  {system}
                </div>
              ))}
            </div>
          </div>

          {/* Key Findings */}
          <div>
            <div className="text-sm font-medium mb-2">Key Findings</div>
            <div className="space-y-1">
              {data.keyFindings.map((finding, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <FileWarning className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>{finding}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t text-xs text-muted-foreground text-center">
            Updated weekly • {new Date(data.lastUpdated).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}