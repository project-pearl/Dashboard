'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Wind, Users, MapPin, Clock, Shield } from 'lucide-react';

interface BurnPitRiskAssessment {
  installationId: string;
  installationName: string;
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';
  particulateDispersionRadius: number;
  personnelAtRisk: number;
  windAlignment: 'favorable' | 'concerning' | 'dangerous';
  atmosphericStability: 'dispersive' | 'neutral' | 'accumulative';
  recommendations: string[];
  nextUpdate: Date;
}

interface BurnPitAlert {
  installationId: string;
  installationName: string;
  severity: 'low' | 'moderate' | 'high' | 'extreme';
  alertType: 'wind_direction' | 'atmospheric_stability' | 'particulate_risk' | 'evacuation_required';
  message: string;
  recommendations: string[];
  estimatedExposureRadius: number;
  timestamp: Date;
}

interface MonitoringDashboard {
  timestamp: Date;
  totalInstallations: number;
  assessments: BurnPitRiskAssessment[];
  alerts: BurnPitAlert[];
  summary: {
    riskDistribution: {
      minimal: number;
      low: number;
      moderate: number;
      high: number;
      extreme: number;
    };
    totalPersonnelAtRisk: number;
    installationsRequiringSuspension: number;
    highestRiskInstallation: string;
  };
}

function getRiskColor(level: string) {
  switch (level) {
    case 'minimal': return 'bg-green-100 text-green-800';
    case 'low': return 'bg-yellow-100 text-yellow-800';
    case 'moderate': return 'bg-orange-100 text-orange-800';
    case 'high': return 'bg-red-100 text-red-800';
    case 'extreme': return 'bg-red-500 text-white';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'extreme':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'high':
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    case 'moderate':
      return <Wind className="w-4 h-4 text-yellow-500" />;
    default:
      return <Shield className="w-4 h-4 text-blue-500" />;
  }
}

export default function BurnPitMonitoringCard() {
  const [dashboard, setDashboard] = useState<MonitoringDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<string | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [showAllInstallations, setShowAllInstallations] = useState(false);

  useEffect(() => {
    fetchDashboard();
    // Refresh every 15 minutes
    const interval = setInterval(fetchDashboard, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = async () => {
    try {
      setError(null);
      const response = await fetch('/api/burn-pit/monitoring');
      if (!response.ok) throw new Error('Failed to fetch monitoring data');

      const data = await response.json();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Burn Pit Atmospheric Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <div className="text-sm text-gray-500">Loading monitoring data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Burn Pit Atmospheric Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-600 p-4">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <div className="text-sm">Failed to load monitoring data: {error}</div>
            <button
              onClick={fetchDashboard}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!dashboard) return null;

  const criticalAlerts = dashboard.alerts.filter(a => a.severity === 'extreme' || a.severity === 'high');
  const lastUpdate = new Date(dashboard.timestamp).toLocaleTimeString();
  const visibleAlerts = showAllAlerts ? criticalAlerts : criticalAlerts.slice(0, 5);
  const sortedAssessments = [...dashboard.assessments].sort((a, b) => {
    const riskOrder = { minimal: 0, low: 1, moderate: 2, high: 3, extreme: 4 };
    return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
  });
  const visibleAssessments = showAllInstallations ? sortedAssessments : sortedAssessments.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Burn Pit Atmospheric Monitoring
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            Updated: {lastUpdate}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 font-medium text-red-800 mb-2">
              <AlertTriangle className="w-4 h-4" />
              CRITICAL ALERTS ({criticalAlerts.length})
            </div>
            <div className="space-y-2">
              {visibleAlerts.map((alert, i) => (
                <div key={i} className="text-sm">
                  <div className="font-medium text-red-900">{alert.installationName}</div>
                  <div className="text-red-700">{alert.message}</div>
                  <div className="text-red-600 text-xs mt-1">
                    Exposure radius: {alert.estimatedExposureRadius}km
                  </div>
                </div>
              ))}
              {criticalAlerts.length > 5 && (
                <button
                  onClick={() => setShowAllAlerts(p => !p)}
                  className="w-full text-center text-xs text-red-600 hover:text-red-800 font-medium py-1 rounded hover:bg-red-100 transition-colors"
                >
                  {showAllAlerts ? 'Show fewer' : `Show all ${criticalAlerts.length} alerts`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{dashboard.totalInstallations}</div>
            <div className="text-sm text-gray-600">Monitored Installations</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{dashboard.summary.installationsRequiringSuspension}</div>
            <div className="text-sm text-gray-600">Requiring Suspension</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{dashboard.summary.totalPersonnelAtRisk.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Personnel at Risk</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{dashboard.alerts.length}</div>
            <div className="text-sm text-gray-600">Active Alerts</div>
          </div>
        </div>

        {/* Risk Distribution */}
        <div>
          <h4 className="font-medium mb-2">Risk Level Distribution</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(dashboard.summary.riskDistribution).map(([level, count]) => (
              <Badge key={level} className={`${getRiskColor(level)} capitalize`}>
                {level}: {count}
              </Badge>
            ))}
          </div>
        </div>

        {/* Installation Assessments */}
        <div>
          <h4 className="font-medium mb-2">Installation Status</h4>
          <div className="space-y-2">
            {visibleAssessments.map((assessment) => (
              <div
                key={assessment.installationId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                onClick={() => setSelectedInstallation(
                  selectedInstallation === assessment.installationId ? null : assessment.installationId
                )}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="font-medium text-sm">{assessment.installationName}</div>
                    <div className="text-xs text-gray-600">
                      {assessment.personnelAtRisk.toLocaleString()} personnel at risk
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getRiskColor(assessment.riskLevel)}>
                    {assessment.riskLevel}
                  </Badge>
                  <div className="text-xs text-gray-500">
                    {assessment.particulateDispersionRadius}km
                  </div>
                </div>
              </div>
            ))}
            {sortedAssessments.length > 5 && (
              <button
                onClick={() => setShowAllInstallations(p => !p)}
                className="w-full text-center text-xs text-blue-600 hover:text-blue-800 font-medium py-1.5 rounded-md hover:bg-blue-50 transition-colors"
              >
                {showAllInstallations ? 'Show fewer' : `Show all ${sortedAssessments.length} installations`}
              </button>
            )}
          </div>
        </div>

        {/* Detailed Assessment */}
        {selectedInstallation && dashboard.assessments.find(a => a.installationId === selectedInstallation) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            {(() => {
              const assessment = dashboard.assessments.find(a => a.installationId === selectedInstallation)!;
              return (
                <>
                  <div className="font-medium text-blue-900 mb-2">
                    {assessment.installationName} - Detailed Assessment
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-blue-700 font-medium">Wind Alignment: </span>
                      <span className={`capitalize ${
                        assessment.windAlignment === 'dangerous' ? 'text-red-600 font-medium' :
                        assessment.windAlignment === 'concerning' ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {assessment.windAlignment}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Atmospheric Stability: </span>
                      <span className={`capitalize ${
                        assessment.atmosphericStability === 'accumulative' ? 'text-red-600 font-medium' : 'text-blue-600'
                      }`}>
                        {assessment.atmosphericStability}
                      </span>
                    </div>
                  </div>
                  <div className="text-blue-800 font-medium mb-2">Recommendations:</div>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {assessment.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-blue-600 mt-3">
                    Next update: {new Date(assessment.nextUpdate).toLocaleTimeString()}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Refresh Button */}
        <div className="text-center pt-2">
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </CardContent>
    </Card>
  );
}