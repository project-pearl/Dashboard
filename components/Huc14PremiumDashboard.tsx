/**
 * HUC-14 Premium Tier Dashboard
 *
 * Displays PIN Precision+ sub-subwatershed intelligence for high-value regions.
 * Features facility-level analysis, enhanced risk assessment, and premium scoring.
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Factory,
  Target,
  Users,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  Zap,
  Star
} from 'lucide-react';

interface Huc14Data {
  huc14: string;
  huc12: string;
  regionType: 'metropolitan' | 'infrastructure' | 'superfund' | 'military';
  priority: 'critical' | 'high' | 'medium';
  premiumScore: number;
  premiumConfidence: number;
  facilityRiskIndex: { value: number; confidence: number };
  contaminantMobilityIndex: { value: number; confidence: number };
  monitoringAdequacyIndex: { value: number; confidence: number };
  emergencyResponseIndex: { value: number; confidence: number };
  stakeholderEngagementIndex: { value: number; confidence: number };
  dataQuality: number;
  spatialResolution: number;
  lastCalculated: string;
}

interface PremiumSummary {
  premiumTier: {
    available: boolean;
    statistics: {
      totalHuc14s: number;
      avgPremiumScore: number;
      avgConfidence: number;
      byType: Record<string, number>;
      byPriority: Record<string, number>;
    };
    capabilities: string[];
    pricing: {
      tierName: string;
      annualCost: string;
      totalMarketValue: number;
    };
  };
}

export default function Huc14PremiumDashboard() {
  const [summary, setSummary] = useState<PremiumSummary | null>(null);
  const [selectedHuc12, setSelectedHuc12] = useState<string>('');
  const [huc14Data, setHuc14Data] = useState<Huc14Data[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load premium tier summary on mount
  useEffect(() => {
    fetchPremiumSummary();
  }, []);

  const fetchPremiumSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/huc14-premium?summary=true');
      const data = await response.json();

      if (data.status === 'success') {
        setSummary(data);
      } else {
        setError(data.message || 'Failed to load premium summary');
      }
    } catch (err) {
      setError('Network error loading premium data');
    } finally {
      setLoading(false);
    }
  };

  const fetchHuc12Data = async (huc12: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/huc14-premium?huc12=${huc12}`);
      const data = await response.json();

      if (data.status === 'success') {
        setHuc14Data(data.huc14Indices || []);
      } else {
        setError(data.message || 'Failed to load HUC-14 data');
        setHuc14Data([]);
      }
    } catch (err) {
      setError('Network error loading HUC-14 data');
      setHuc14Data([]);
    } finally {
      setLoading(false);
    }
  };

  const handleHuc12Search = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedHuc12.length === 12) {
      fetchHuc12Data(selectedHuc12);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high': return <TrendingUp className="w-4 h-4 text-orange-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRegionTypeIcon = (type: string) => {
    switch (type) {
      case 'metropolitan': return <Users className="w-5 h-5 text-blue-500" />;
      case 'infrastructure': return <Factory className="w-5 h-5 text-gray-500" />;
      case 'superfund': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'military': return <Shield className="w-5 h-5 text-green-500" />;
      default: return <MapPin className="w-5 h-5 text-gray-400" />;
    }
  };

  if (loading && !summary) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-center space-x-2 text-red-600 mb-2">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Premium Tier Error</span>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Tier Overview */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Star className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">PIN Precision+</h2>
              <p className="text-sm text-gray-600">HUC-14 Sub-Subwatershed Intelligence</p>
            </div>
          </div>
          {summary?.premiumTier.available && (
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Active</span>
            </div>
          )}
        </div>

        {summary?.premiumTier.statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">
                {summary.premiumTier.statistics.totalHuc14s}
              </div>
              <div className="text-sm text-gray-600">Sub-Subwatersheds</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-blue-600">
                {summary.premiumTier.statistics.avgPremiumScore}
              </div>
              <div className="text-sm text-gray-600">Avg Premium Score</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-green-600">
                {summary.premiumTier.statistics.avgConfidence}%
              </div>
              <div className="text-sm text-gray-600">Avg Confidence</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-purple-600">
                ${(summary.premiumTier.pricing.totalMarketValue / 1_000_000).toFixed(1)}M
              </div>
              <div className="text-sm text-gray-600">Market Value</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="font-medium text-gray-900 mb-2">Region Types</h3>
            <div className="space-y-2">
              {summary?.premiumTier.statistics.byType && Object.entries(summary.premiumTier.statistics.byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getRegionTypeIcon(type)}
                    <span className="text-sm capitalize">{type}</span>
                  </div>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="font-medium text-gray-900 mb-2">Priority Distribution</h3>
            <div className="space-y-2">
              {summary?.premiumTier.statistics.byPriority && Object.entries(summary.premiumTier.statistics.byPriority).map(([priority, count]) => (
                <div key={priority} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getPriorityIcon(priority)}
                    <span className="text-sm capitalize">{priority}</span>
                  </div>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* HUC-12 Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Explore Premium Regions</h3>

        <form onSubmit={handleHuc12Search} className="mb-4">
          <div className="flex space-x-3">
            <input
              type="text"
              value={selectedHuc12}
              onChange={(e) => setSelectedHuc12(e.target.value)}
              placeholder="Enter HUC-12 code (e.g., 071200031201)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={12}
            />
            <button
              type="submit"
              disabled={selectedHuc12.length !== 12 || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
            >
              {loading ? 'Loading...' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* HUC-14 Results */}
        {huc14Data.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">
              HUC-14 Sub-Subwatersheds ({huc14Data.length})
            </h4>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {huc14Data.map((huc14) => (
                <div key={huc14.huc14} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {huc14.huc14}
                        </code>
                        {getPriorityIcon(huc14.priority)}
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        {getRegionTypeIcon(huc14.regionType)}
                        <span className="text-sm text-gray-600 capitalize">{huc14.regionType}</span>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium border ${getScoreColor(huc14.premiumScore)}`}>
                      {huc14.premiumScore}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Facility Risk:</span>
                      <span className="font-medium">{huc14.facilityRiskIndex.value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Contaminant Mobility:</span>
                      <span className="font-medium">{huc14.contaminantMobilityIndex.value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monitoring:</span>
                      <span className="font-medium">{huc14.monitoringAdequacyIndex.value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Emergency Response:</span>
                      <span className="font-medium">{huc14.emergencyResponseIndex.value}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1">
                        <Zap className="w-3 h-3 text-blue-500" />
                        <span className="text-gray-600">Resolution: {huc14.spatialResolution}m</span>
                      </div>
                      <span className="text-gray-500">{huc14.premiumConfidence}% confidence</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Capabilities Overview */}
      {summary?.premiumTier.capabilities && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Premium Capabilities</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.premiumTier.capabilities.map((capability, index) => (
              <div key={index} className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{capability}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}