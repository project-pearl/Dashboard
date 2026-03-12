'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Users, MapPin, Clock, Bomb, Zap, Factory, Flame, Skull, HelpCircle } from 'lucide-react';

interface ThreatScenario {
  type: 'explosion' | 'chemical_release' | 'industrial_accident' | 'radiological' | 'biological' | 'burn_pit';
  severity: 'minor' | 'moderate' | 'major' | 'catastrophic';
  sourceDescription: string;
  particulateType: string;
}

interface InstallationThreatAssessment {
  installationId: string;
  installationName: string;
  branch: string;
  region: string;
  personnelCount: number;
  currentRiskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';
  threats: Array<{
    scenario: ThreatScenario;
    probability: number;
    impactRadius: number;
    estimatedCasualties: number;
    windAlignment: 'favorable' | 'concerning' | 'dangerous';
    recommendations: string[];
  }>;
  atmosphericConditions: {
    windSpeed: number;
    windDirection: number;
    stability: string;
    temperature: number;
  };
  protectiveActions: {
    recommendedFPCON: string;
    shelterInPlace: boolean;
    respiratoryProtection: string;
  };
}

interface ThreatDashboard {
  timestamp: Date;
  totalInstallations: number;
  assessments: InstallationThreatAssessment[];
  alerts: any[];
  summary: {
    totalPersonnel: number;
    installationsAtRisk: number;
    riskDistribution: {
      minimal: number;
      low: number;
      moderate: number;
      high: number;
      extreme: number;
    };
    criticalAlerts: number;
  };
}

function getRiskColor(level: string) {
  switch (level) {
    case 'minimal': return 'bg-green-100 text-green-800 border-green-200';
    case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'extreme': return 'bg-red-500 text-white border-red-600';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getThreatIcon(type: string) {
  switch (type) {
    case 'explosion': return <Bomb className="w-4 h-4" />;
    case 'chemical_release': return <Skull className="w-4 h-4" />;
    case 'industrial_accident': return <Factory className="w-4 h-4" />;
    case 'burn_pit': return <Flame className="w-4 h-4" />;
    case 'radiological': return <Zap className="w-4 h-4" />;
    case 'biological': return <AlertTriangle className="w-4 h-4" />;
    default: return <Shield className="w-4 h-4" />;
  }
}

function getBranchColor(branch: string) {
  switch (branch) {
    case 'Army': return 'bg-green-50 text-green-700 border-green-200';
    case 'Navy': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Air Force': return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'Marines': return 'bg-red-50 text-red-700 border-red-200';
    case 'Space Force': return 'bg-purple-50 text-purple-700 border-purple-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export default function InstallationThreatMonitoringCard() {
  const [dashboard, setDashboard] = useState<ThreatDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<string | null>(null);
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  useEffect(() => {
    fetchDashboard();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = async () => {
    try {
      setError(null);
      const response = await fetch('/api/installation-threats');
      if (!response.ok) throw new Error('Failed to fetch threat monitoring data');

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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Installation Atmospheric Threat Monitoring
            </CardTitle>
            <button className="p-1 rounded-md border border-slate-200 bg-white/90 shadow-sm hover:bg-slate-50 transition-colors" title="Multi-threat monitoring dashboard for military installation environmental hazards.">
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex justify-center items-center h-40">
            <div className="text-xs text-slate-500">Loading threat assessments...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Installation Atmospheric Threat Monitoring
            </CardTitle>
            <button className="p-1 rounded-md border border-slate-200 bg-white/90 shadow-sm hover:bg-slate-50 transition-colors" title="Multi-threat monitoring dashboard for military installation environmental hazards.">
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center text-red-600 p-4">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <div className="text-xs text-red-600">Failed to load threat data: {error}</div>
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

  // Filter assessments
  let filteredAssessments = dashboard.assessments;
  if (filterRegion !== 'all') {
    filteredAssessments = filteredAssessments.filter(a => a.region === filterRegion);
  }
  if (filterRisk !== 'all') {
    filteredAssessments = filteredAssessments.filter(a => a.currentRiskLevel === filterRisk);
  }

  const criticalInstallations = filteredAssessments.filter(a =>
    a.currentRiskLevel === 'extreme' || a.currentRiskLevel === 'high'
  );
  const lastUpdate = new Date(dashboard.timestamp).toLocaleTimeString();

  // Get unique regions for filter
  const regions = [...new Set(dashboard.assessments.map(a => a.region))];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Installation Atmospheric Threat Monitoring
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-4 h-4" />
              Updated: {lastUpdate}
            </span>
            <button className="p-1 rounded-md border border-slate-200 bg-white/90 shadow-sm hover:bg-slate-50 transition-colors" title="Multi-threat monitoring dashboard for military installation environmental hazards.">
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Critical Alerts */}
        {criticalInstallations.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 font-medium text-red-800 mb-2">
              <AlertTriangle className="w-4 h-4" />
              CRITICAL THREATS ({criticalInstallations.length})
            </div>
            <div className="space-y-2">
              {criticalInstallations.slice(0, 3).map((assessment, i) => (
                <div key={i} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className={getBranchColor(assessment.branch)}>
                      {assessment.branch}
                    </Badge>
                    <span className="font-medium text-red-900">{assessment.installationName}</span>
                    <Badge className={getRiskColor(assessment.currentRiskLevel)}>
                      {assessment.currentRiskLevel}
                    </Badge>
                  </div>
                  <div className="text-red-700 mt-1">
                    {assessment.threats.filter(t => t.probability > 0.3)[0]?.scenario.sourceDescription || 'Multiple threat vectors'}
                  </div>
                  <div className="text-red-600 text-xs">
                    {assessment.personnelCount.toLocaleString()} personnel • FPCON {assessment.protectiveActions.recommendedFPCON}
                  </div>
                </div>
              ))}
              {criticalInstallations.length > 3 && (
                <div className="text-xs text-red-600">
                  +{criticalInstallations.length - 3} more critical installations
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-slate-800">{dashboard.totalInstallations}</div>
            <div className="text-2xs font-medium text-slate-500 uppercase tracking-wide">Total Installations</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-red-600">{dashboard.summary.installationsAtRisk}</div>
            <div className="text-2xs font-medium text-slate-500 uppercase tracking-wide">At Risk</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-blue-600">{dashboard.summary.totalPersonnel.toLocaleString()}</div>
            <div className="text-2xs font-medium text-slate-500 uppercase tracking-wide">Personnel Protected</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-orange-600">{dashboard.alerts.length}</div>
            <div className="text-2xs font-medium text-slate-500 uppercase tracking-wide">Active Alerts</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="px-3 py-1 text-sm border rounded-md"
          >
            <option value="all">All Regions</option>
            {regions.map(region => (
              <option key={region} value={region}>
                {region.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="px-3 py-1 text-sm border rounded-md"
          >
            <option value="all">All Risk Levels</option>
            <option value="extreme">Extreme</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="low">Low</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>

        {/* Risk Level Distribution */}
        <div>
          <h4 className="font-medium mb-2">Risk Distribution ({filteredAssessments.length} installations)</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(dashboard.summary.riskDistribution).map(([level, count]) => (
              <Badge key={level} className={`${getRiskColor(level)} capitalize`}>
                {level}: {count}
              </Badge>
            ))}
          </div>
        </div>

        {/* Installation List */}
        <div>
          <h4 className="font-medium mb-2">Installation Status</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredAssessments
              .sort((a, b) => {
                const riskOrder = { minimal: 0, low: 1, moderate: 2, high: 3, extreme: 4 };
                return riskOrder[b.currentRiskLevel] - riskOrder[a.currentRiskLevel];
              })
              .map((assessment) => (
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
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{assessment.installationName}</span>
                        <Badge className={getBranchColor(assessment.branch)}>
                          {assessment.branch}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600">
                        {assessment.personnelCount.toLocaleString()} personnel • {assessment.region}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getRiskColor(assessment.currentRiskLevel)}>
                      {assessment.currentRiskLevel}
                    </Badge>
                    <div className="flex gap-1">
                      {assessment.threats
                        .filter(t => t.probability > 0.3)
                        .slice(0, 3)
                        .map((threat, i) => (
                          <div key={i} className="text-gray-400">
                            {getThreatIcon(threat.scenario.type)}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Detailed Assessment */}
        {selectedInstallation && (() => {
          const assessment = filteredAssessments.find(a => a.installationId === selectedInstallation);
          if (!assessment) return null;

          return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="font-medium text-blue-900 mb-3">
                {assessment.installationName} - Threat Assessment
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Atmospheric Conditions:</span>
                  <div className="text-blue-600">
                    Wind: {assessment.atmosphericConditions.windSpeed.toFixed(1)} m/s @ {assessment.atmosphericConditions.windDirection}°
                  </div>
                  <div className="text-blue-600">
                    Stability: {assessment.atmosphericConditions.stability}
                  </div>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Protective Measures:</span>
                  <div className="text-blue-600">
                    FPCON: {assessment.protectiveActions.recommendedFPCON}
                  </div>
                  <div className="text-blue-600">
                    Shelter: {assessment.protectiveActions.shelterInPlace ? 'Required' : 'Normal'}
                  </div>
                </div>
              </div>

              <div className="text-blue-800 font-medium mb-2">Active Threat Scenarios:</div>
              <div className="space-y-2">
                {assessment.threats
                  .filter(t => t.probability > 0.2)
                  .sort((a, b) => b.probability - a.probability)
                  .slice(0, 3)
                  .map((threat, i) => (
                    <div key={i} className="bg-blue-100 rounded p-2">
                      <div className="flex items-center gap-2 mb-1">
                        {getThreatIcon(threat.scenario.type)}
                        <span className="font-medium text-blue-900 capitalize">
                          {threat.scenario.type.replace('_', ' ')}
                        </span>
                        <Badge variant="outline" className="text-2xs">
                          {(threat.probability * 100).toFixed(0)}% probability
                        </Badge>
                      </div>
                      <div className="text-sm text-blue-700 mb-1">
                        {threat.scenario.sourceDescription}
                      </div>
                      <div className="text-xs text-blue-600">
                        Impact: {threat.impactRadius.toFixed(1)}km radius •
                        Est. casualties: {threat.estimatedCasualties} •
                        Wind: {threat.windAlignment}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })()}

        {/* Refresh Button */}
        <div className="text-center pt-2">
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
          >
            Refresh Assessment
          </button>
        </div>
      </CardContent>
    </Card>
  );
}