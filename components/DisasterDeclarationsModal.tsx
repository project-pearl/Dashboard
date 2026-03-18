'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Landmark, Search, MapPin, Calendar, AlertTriangle, Info, Flame, Waves, Wind, Snowflake, Zap, Mountain } from 'lucide-react';

interface FemaDeclaration {
  disasterNumber: number;
  state: string;
  declarationDate: string;
  incidentType: string;
  declarationTitle: string;
  declarationType: string;
  designatedArea: string;
  fipsStateCode: string;
  fipsCountyCode: string;
}

interface DisasterDeclarationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Disaster severity ranking and detailed information
const DISASTER_SEVERITY: Record<string, {
  level: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  color: string;
  bgColor: string;
  icon: any;
  description: string;
  impacts: string[];
}> = {
  'Hurricane': {
    level: 1,
    severity: 'critical',
    color: 'text-red-800',
    bgColor: 'bg-red-100 border-red-200',
    icon: Wind,
    description: 'Major tropical cyclone with sustained winds, storm surge, and widespread flooding potential',
    impacts: ['Life-threatening storm surge', 'Catastrophic wind damage', 'Widespread power outages', 'Flooding from rainfall', 'Water infrastructure damage']
  },
  'Major Disaster': {
    level: 2,
    severity: 'critical',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
    icon: AlertTriangle,
    description: 'Large-scale emergency requiring federal assistance for life safety and property protection',
    impacts: ['Life safety threats', 'Critical infrastructure damage', 'Mass evacuations', 'Long-term recovery needed']
  },
  'Fire': {
    level: 3,
    severity: 'high',
    color: 'text-orange-800',
    bgColor: 'bg-orange-100 border-orange-200',
    icon: Flame,
    description: 'Wildfire or structural fire threatening communities and natural resources',
    impacts: ['Air quality degradation', 'Water supply contamination', 'Ecosystem destruction', 'Infrastructure damage']
  },
  'Tornado': {
    level: 4,
    severity: 'high',
    color: 'text-purple-800',
    bgColor: 'bg-purple-100 border-purple-200',
    icon: Wind,
    description: 'Violent rotating column of air causing localized but severe destruction',
    impacts: ['Concentrated severe damage', 'Debris contamination', 'Utility disruptions', 'Emergency shelter needs']
  },
  'Flooding': {
    level: 5,
    severity: 'high',
    color: 'text-blue-800',
    bgColor: 'bg-blue-100 border-blue-200',
    icon: Waves,
    description: 'Water overflow causing damage to communities and water infrastructure',
    impacts: ['Drinking water contamination', 'Wastewater system damage', 'Transportation disruption', 'Agricultural losses']
  },
  'Severe Storm(s)': {
    level: 6,
    severity: 'medium',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100 border-slate-200',
    icon: Zap,
    description: 'Intense weather systems with high winds, hail, and/or heavy precipitation',
    impacts: ['Power grid damage', 'Stormwater system overflow', 'Transportation delays', 'Agricultural damage']
  },
  'Earthquake': {
    level: 7,
    severity: 'high',
    color: 'text-amber-800',
    bgColor: 'bg-amber-100 border-amber-200',
    icon: Mountain,
    description: 'Ground shaking causing structural damage and infrastructure failure',
    impacts: ['Water main breaks', 'Building structural damage', 'Liquefaction risks', 'Aftershock hazards']
  },
  'Drought': {
    level: 8,
    severity: 'medium',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100 border-yellow-200',
    icon: AlertTriangle,
    description: 'Extended period of water shortage affecting agriculture and municipal supplies',
    impacts: ['Water supply depletion', 'Agricultural crop failure', 'Increased wildfire risk', 'Economic losses']
  },
  'Winter Storm': {
    level: 9,
    severity: 'low',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-100 border-cyan-200',
    icon: Snowflake,
    description: 'Severe winter weather including snow, ice, and freezing temperatures',
    impacts: ['Transportation disruption', 'Power outages from ice', 'Pipe freezing/bursting', 'Heating emergencies']
  },
  'Other': {
    level: 10,
    severity: 'low',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100 border-gray-200',
    icon: Info,
    description: 'Other disaster types requiring federal emergency assistance',
    impacts: ['Variable impacts', 'Community-specific needs', 'Infrastructure support required']
  }
};

// Legacy color mapping for backward compatibility
const INCIDENT_TYPE_COLORS: Record<string, string> = {
  'Flooding': 'bg-blue-100 text-blue-700',
  'Severe Storm(s)': 'bg-slate-100 text-slate-700',
  'Hurricane': 'bg-red-100 text-red-700',
  'Tornado': 'bg-purple-100 text-purple-700',
  'Fire': 'bg-orange-100 text-orange-700',
  'Winter Storm': 'bg-cyan-100 text-cyan-700',
  'Drought': 'bg-yellow-100 text-yellow-700',
  'Other': 'bg-gray-100 text-gray-700',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function parseDetailedLocation(area: string, state: string): {
  counties: string[];
  specificAreas: string[];
  statewide: boolean;
  summary: string;
} {
  const cleaned = area.replace(/\(County\)/gi, '').trim();

  // Check if statewide
  const statewide = cleaned.toLowerCase().includes('statewide') ||
                   cleaned.toLowerCase().includes('all counties') ||
                   cleaned.toLowerCase().includes(`all of ${state.toLowerCase()}`);

  if (statewide) {
    return {
      counties: [],
      specificAreas: [],
      statewide: true,
      summary: `Statewide (${state})`
    };
  }

  // Parse counties
  const countyMatches = cleaned.match(/([^,;]+?)\s*County/gi) || [];
  const counties = countyMatches.map(match =>
    match.replace(/\s*County/i, '').trim()
  );

  // Parse other specific areas (cities, regions, etc.)
  let remaining = cleaned;
  countyMatches.forEach(match => {
    remaining = remaining.replace(match, '');
  });

  const specificAreas = remaining
    .split(/[,;]/)
    .map(area => area.trim())
    .filter(area => area.length > 0 && !area.toLowerCase().includes('county'));

  // Create summary
  let summary = '';
  if (counties.length > 0) {
    summary += counties.length === 1 ? `${counties[0]} County` : `${counties.length} counties`;
  }
  if (specificAreas.length > 0) {
    if (summary) summary += ', ';
    summary += specificAreas.slice(0, 2).join(', ');
    if (specificAreas.length > 2) summary += ` +${specificAreas.length - 2} more`;
  }
  if (!summary) summary = cleaned.substring(0, 50) + (cleaned.length > 50 ? '...' : '');

  return {
    counties,
    specificAreas,
    statewide: false,
    summary: summary || cleaned
  };
}

function getDisasterSeverityInfo(incidentType: string) {
  return DISASTER_SEVERITY[incidentType] || DISASTER_SEVERITY['Other'];
}

function formatArea(area: string): string {
  // Clean up designated area text
  return area.replace(/\(County\)/gi, '').replace(/,\s*$/, '').trim();
}

export default function DisasterDeclarationsModal({ isOpen, onClose }: DisasterDeclarationsModalProps) {
  const [declarations, setDeclarations] = useState<FemaDeclaration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Fetch disaster declarations when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);

    fetch('/api/fema-declarations')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        // The API already returns filtered and sorted declarations in topDeclarations
        // But we'll get all recent ones by filtering the last 90 days from all data
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);

        // Use topDeclarations from API but get more data if needed
        const declarations = data.topDeclarations || [];

        // Since the API only returns top 20, we'll work with those
        // Filter to recent ones (last 90 days)
        const recent = declarations.filter((d: FemaDeclaration) => {
          const declDate = new Date(d.declarationDate);
          return declDate >= cutoff;
        });

        setDeclarations(recent);
      })
      .catch(err => {
        console.error('Failed to fetch FEMA declarations:', err);
        setError('Failed to load disaster declarations');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen]);

  // Get unique incident types for filter
  const incidentTypes = useMemo(() => {
    const types = new Set(declarations.map(d => d.incidentType));
    return Array.from(types).sort();
  }, [declarations]);

  // Filter and sort declarations based on search, type filter, and severity
  const filteredDeclarations = useMemo(() => {
    const filtered = declarations.filter(d => {
      const matchesSearch = !searchQuery ||
        d.declarationTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.designatedArea.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.incidentType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedType === 'all' || d.incidentType === selectedType;

      return matchesSearch && matchesType;
    });

    // Sort by severity first (most severe at top), then by date (most recent first)
    return filtered.sort((a, b) => {
      const severityA = getDisasterSeverityInfo(a.incidentType);
      const severityB = getDisasterSeverityInfo(b.incidentType);

      // Primary sort: by severity level (lower level = more severe)
      if (severityA.level !== severityB.level) {
        return severityA.level - severityB.level;
      }

      // Secondary sort: by declaration date (more recent first)
      return new Date(b.declarationDate).getTime() - new Date(a.declarationDate).getTime();
    });
  }, [declarations, searchQuery, selectedType]);

  // Show top 5 initially, with option to show more
  const [showAll, setShowAll] = useState(false);
  const displayedDeclarations = showAll ? filteredDeclarations : filteredDeclarations.slice(0, 5);
  const hasMore = filteredDeclarations.length > 5;

  // Count by type and severity for summary
  const typeCount = useMemo(() => {
    const counts: Record<string, { count: number; severity: string }> = {};
    declarations.forEach(d => {
      const severityInfo = getDisasterSeverityInfo(d.incidentType);
      if (!counts[d.incidentType]) {
        counts[d.incidentType] = { count: 0, severity: severityInfo.severity };
      }
      counts[d.incidentType].count++;
    });
    return counts;
  }, [declarations]);

  // Group by severity level for better organization
  const severityGroups = useMemo(() => {
    const groups: Record<string, Array<{ type: string; count: number }>> = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    Object.entries(typeCount).forEach(([type, info]) => {
      groups[info.severity].push({ type, count: info.count });
    });

    // Sort each group by count (descending)
    Object.keys(groups).forEach(severity => {
      groups[severity].sort((a, b) => b.count - a.count);
    });

    return groups;
  }, [typeCount]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Landmark size={20} className="text-indigo-600" />
            Active FEMA Disaster Declarations
            {declarations.length > 0 && (
              <Badge variant="secondary">
                {declarations.length} active (last 90 days)
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-slate-500">Loading disaster declarations...</div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 py-4">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Summary badges grouped by severity */}
            {Object.keys(typeCount).length > 0 && (
              <div className="space-y-3">
                {(['critical', 'high', 'medium', 'low'] as const).map(severity => {
                  if (severityGroups[severity].length === 0) return null;

                  const severityConfig = {
                    critical: { label: 'CRITICAL', color: 'bg-red-600 text-white', icon: '🚨' },
                    high: { label: 'HIGH', color: 'bg-orange-600 text-white', icon: '⚠️' },
                    medium: { label: 'MEDIUM', color: 'bg-yellow-600 text-white', icon: '⚡' },
                    low: { label: 'LOW', color: 'bg-blue-600 text-white', icon: '📋' }
                  };

                  return (
                    <div key={severity} className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs font-semibold ${severityConfig[severity].color}`}>
                        {severityConfig[severity].icon} {severityConfig[severity].label} RISK
                      </Badge>
                      <div className="flex flex-wrap gap-1">
                        {severityGroups[severity].map(({ type, count }) => {
                          const severityInfo = getDisasterSeverityInfo(type);
                          return (
                            <Badge
                              key={type}
                              variant="outline"
                              className={`text-xs ${severityInfo.bgColor.replace('bg-', 'border-').replace('-100', '-200')} ${severityInfo.color}`}
                            >
                              {type}: {count}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              {incidentTypes.length > 1 && (
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Types</option>
                  {incidentTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              )}

              <div className="relative flex-1 min-w-[250px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by title, state, or area..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {(selectedType !== 'all' || searchQuery) && (
                <span className="text-sm text-slate-500">
                  {filteredDeclarations.length} of {declarations.length} declarations
                </span>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {filteredDeclarations.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <Info size={16} className="mr-2" />
                  No disaster declarations match your search.
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedDeclarations.map((declaration, index) => {
                    const severityInfo = getDisasterSeverityInfo(declaration.incidentType);
                    const locationInfo = parseDetailedLocation(declaration.designatedArea, declaration.state);
                    const IconComponent = severityInfo.icon;

                    return (
                      <div
                        key={`${declaration.disasterNumber}-${index}`}
                        className={`border-2 rounded-lg p-5 transition-all hover:shadow-md ${severityInfo.bgColor}`}
                      >
                        <div className="space-y-4">
                          {/* Header with severity indicator */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full bg-white shadow-sm ${severityInfo.color}`}>
                                <IconComponent size={20} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs font-semibold">
                                    DR-{declaration.disasterNumber}
                                  </Badge>
                                  <Badge
                                    className={`text-xs font-semibold ${
                                      severityInfo.severity === 'critical' ? 'bg-red-600 text-white' :
                                      severityInfo.severity === 'high' ? 'bg-orange-600 text-white' :
                                      severityInfo.severity === 'medium' ? 'bg-yellow-600 text-white' :
                                      'bg-blue-600 text-white'
                                    }`}
                                  >
                                    {severityInfo.severity.toUpperCase()} RISK
                                  </Badge>
                                </div>
                                <h4 className={`font-semibold text-lg ${severityInfo.color}`}>
                                  {declaration.incidentType}
                                </h4>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-500 mb-1">Declaration Date</div>
                              <div className="text-sm font-medium">{formatDate(declaration.declarationDate)}</div>
                            </div>
                          </div>

                          {/* Disaster description */}
                          <div className="bg-white/70 rounded-lg p-3">
                            <h5 className="font-medium text-slate-900 mb-1">{declaration.declarationTitle}</h5>
                            <p className="text-sm text-slate-700 mb-3">{severityInfo.description}</p>

                            {/* Location details */}
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <MapPin size={14} className="text-slate-500 mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-sm font-medium text-slate-900">
                                    {locationInfo.statewide ? locationInfo.summary : `${declaration.state} - ${locationInfo.summary}`}
                                  </div>
                                  {!locationInfo.statewide && locationInfo.counties.length > 0 && (
                                    <div className="text-xs text-slate-600 mt-1">
                                      <strong>Counties:</strong> {locationInfo.counties.join(', ')}
                                      {locationInfo.counties.length > 3 && locationInfo.counties.length > locationInfo.counties.slice(0, 3).length &&
                                        ` and ${locationInfo.counties.length - 3} more`}
                                    </div>
                                  )}
                                  {locationInfo.specificAreas.length > 0 && (
                                    <div className="text-xs text-slate-600 mt-1">
                                      <strong>Areas:</strong> {locationInfo.specificAreas.slice(0, 3).join(', ')}
                                      {locationInfo.specificAreas.length > 3 && ` +${locationInfo.specificAreas.length - 3} more`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Potential impacts */}
                          <div className="bg-white/50 rounded-lg p-3">
                            <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                              Potential Water & Infrastructure Impacts
                            </h6>
                            <ul className="space-y-1">
                              {severityInfo.impacts.slice(0, 3).map((impact, i) => (
                                <li key={i} className="flex items-center gap-2 text-xs">
                                  <div className="w-1 h-1 bg-slate-400 rounded-full shrink-0"></div>
                                  <span className="text-slate-700">{impact}</span>
                                </li>
                              ))}
                              {severityInfo.impacts.length > 3 && (
                                <li className="text-xs text-slate-500 ml-3">
                                  +{severityInfo.impacts.length - 3} additional impact categories
                                </li>
                              )}
                            </ul>
                          </div>

                          {/* Declaration type */}
                          {declaration.declarationType && (
                            <div className="text-xs text-slate-500">
                              <strong>Type:</strong> {declaration.declarationType}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {hasMore && !showAll && (
                    <div className="text-center py-4">
                      <button
                        onClick={() => setShowAll(true)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                      >
                        Show {filteredDeclarations.length - 5} more declarations
                      </button>
                    </div>
                  )}

                  {showAll && hasMore && (
                    <div className="text-center py-4">
                      <button
                        onClick={() => setShowAll(false)}
                        className="text-slate-600 hover:text-slate-800 font-medium text-sm"
                      >
                        Show less
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}