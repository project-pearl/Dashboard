'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Zap, Droplets, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface InfrastructureSystem {
  name: string;
  facilities: number;
  operational: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  lastInspection: string;
  violations: number;
}

interface InfrastructureData {
  totalFacilities: number;
  criticalInfrastructure: number;
  operationalRate: number;
  recentInspections: number;
  complianceRate: number;
  systems: InfrastructureSystem[];
  riskAssessment: {
    overall: 'low' | 'moderate' | 'high' | 'critical';
    cybersecurity: number;
    physical: number;
    environmental: number;
  };
  recentAlerts: Array<{
    type: string;
    facility: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: string;
  }>;
  lastUpdated: string;
}

interface StateInfrastructureStatusProps {
  stateAbbr: string;
}

export function StateInfrastructureStatus({ stateAbbr }: StateInfrastructureStatusProps) {
  const [data, setData] = useState<InfrastructureData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfrastructureData = async () => {
      try {
        setLoading(true);

        // In real implementation, this would call EPA ECHO + FRS + DHS CISA APIs
        // GET /api/state-infrastructure?state=${stateAbbr}

        // Mock realistic infrastructure data based on state characteristics
        const getStateInfrastructureData = (state: string): InfrastructureData => {
          const largeDiverseStates = ['CA', 'TX', 'FL', 'NY', 'PA'];
          const isLargeState = largeDiverseStates.includes(state);

          const baseMultiplier = isLargeState ? 1.5 : 1;

          const systems: InfrastructureSystem[] = [
            {
              name: 'Water Treatment Plants',
              facilities: Math.floor((120 + Math.random() * 80) * baseMultiplier),
              operational: Math.floor((110 + Math.random() * 70) * baseMultiplier),
              condition: ['good', 'fair'][Math.floor(Math.random() * 2)] as any,
              lastInspection: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
              violations: Math.floor(Math.random() * 15) + 2
            },
            {
              name: 'Wastewater Treatment',
              facilities: Math.floor((85 + Math.random() * 60) * baseMultiplier),
              operational: Math.floor((80 + Math.random() * 55) * baseMultiplier),
              condition: ['good', 'fair', 'poor'][Math.floor(Math.random() * 3)] as any,
              lastInspection: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
              violations: Math.floor(Math.random() * 20) + 5
            },
            {
              name: 'Power Generation',
              facilities: Math.floor((25 + Math.random() * 35) * baseMultiplier),
              operational: Math.floor((22 + Math.random() * 30) * baseMultiplier),
              condition: state === 'TX' ? 'fair' : ['good', 'excellent'][Math.floor(Math.random() * 2)] as any,
              lastInspection: new Date(Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000).toISOString(),
              violations: Math.floor(Math.random() * 8) + 1
            },
            {
              name: 'Chemical Facilities',
              facilities: Math.floor((180 + Math.random() * 120) * baseMultiplier),
              operational: Math.floor((170 + Math.random() * 110) * baseMultiplier),
              condition: ['good', 'fair'][Math.floor(Math.random() * 2)] as any,
              lastInspection: new Date(Date.now() - Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString(),
              violations: Math.floor(Math.random() * 25) + 8
            }
          ];

          const totalFacilities = systems.reduce((sum, sys) => sum + sys.facilities, 0);
          const totalOperational = systems.reduce((sum, sys) => sum + sys.operational, 0);

          const recentAlerts = [
            {
              type: 'Compliance Violation',
              facility: 'Metro Water Treatment Plant #3',
              severity: 'medium' as const,
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            },
            {
              type: 'Maintenance Required',
              facility: 'Regional Wastewater Facility',
              severity: 'low' as const,
              timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
            },
            {
              type: 'Security Alert',
              facility: 'Chemical Storage Complex',
              severity: 'high' as const,
              timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
            }
          ];

          return {
            totalFacilities,
            criticalInfrastructure: Math.floor(totalFacilities * 0.15),
            operationalRate: (totalOperational / totalFacilities) * 100,
            recentInspections: Math.floor(Math.random() * 50) + 20,
            complianceRate: 85 + Math.random() * 12,
            systems,
            riskAssessment: {
              overall: ['moderate', 'low'][Math.floor(Math.random() * 2)] as any,
              cybersecurity: 75 + Math.random() * 15,
              physical: 80 + Math.random() * 15,
              environmental: 70 + Math.random() * 20
            },
            recentAlerts: recentAlerts.slice(0, Math.floor(Math.random() * 3) + 1),
            lastUpdated: new Date().toISOString()
          };
        };

        await new Promise(resolve => setTimeout(resolve, 950));
        setData(getStateInfrastructureData(stateAbbr));
      } catch (error) {
        console.error('Error fetching infrastructure data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInfrastructureData();
  }, [stateAbbr]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Infrastructure Status
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

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'text-green-700 bg-green-100';
      case 'good': return 'text-green-600 bg-green-50';
      case 'fair': return 'text-yellow-600 bg-yellow-50';
      case 'poor': return 'text-orange-600 bg-orange-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSystemIcon = (name: string) => {
    if (name.includes('Water')) return <Droplets className="h-4 w-4 text-blue-600" />;
    if (name.includes('Power')) return <Zap className="h-4 w-4 text-yellow-600" />;
    if (name.includes('Chemical')) return <Shield className="h-4 w-4 text-purple-600" />;
    return <Building2 className="h-4 w-4 text-gray-600" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            {stateAbbr} Infrastructure
          </div>
          <Badge variant="outline" className="text-xs">
            EPA + DHS CISA
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overview Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-bold">{data.totalFacilities.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Facilities</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-red-600">{data.criticalInfrastructure}</div>
              <div className="text-sm text-muted-foreground">Critical Infrastructure</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-lg font-bold text-green-600">{data.operationalRate.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Operational Rate</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-blue-600">{data.complianceRate.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Compliance Rate</div>
            </div>
          </div>

          {/* Infrastructure Systems */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Infrastructure Systems</div>
            {data.systems.map((system, i) => (
              <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getSystemIcon(system.name)}
                  <div>
                    <div className="text-sm font-medium">{system.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {system.operational}/{system.facilities} operational
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={`text-xs ${getConditionColor(system.condition)}`}>
                    {system.condition}
                  </Badge>
                  {system.violations > 0 && (
                    <div className="text-xs text-orange-600 mt-1">
                      {system.violations} violations
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Risk Assessment */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Risk Assessment</div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="text-center">
                <div className="font-medium">{data.riskAssessment.cybersecurity.toFixed(0)}</div>
                <div className="text-muted-foreground">Cyber Security</div>
              </div>
              <div className="text-center">
                <div className="font-medium">{data.riskAssessment.physical.toFixed(0)}</div>
                <div className="text-muted-foreground">Physical Security</div>
              </div>
              <div className="text-center">
                <div className="font-medium">{data.riskAssessment.environmental.toFixed(0)}</div>
                <div className="text-muted-foreground">Environmental</div>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <Badge variant="secondary" className={`text-xs ${data.riskAssessment.overall === 'low' ? 'text-green-600' : 'text-yellow-600'}`}>
                Overall Risk: {data.riskAssessment.overall}
              </Badge>
            </div>
          </div>

          {/* Recent Alerts */}
          {data.recentAlerts.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Recent Alerts</div>
              {data.recentAlerts.map((alert, i) => (
                <div key={i} className={`p-2 border rounded text-xs ${getSeverityColor(alert.severity)}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{alert.type}</div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {alert.severity}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-1">{alert.facility}</div>
                  <div className="text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t text-xs text-muted-foreground text-center">
            Inspections: {data.recentInspections} (last 30 days) • {new Date(data.lastUpdated).toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}