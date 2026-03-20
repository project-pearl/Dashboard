'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Scale, Calendar, ExternalLink, ChevronDown, Filter,
  AlertTriangle, Clock, CheckCircle, FileText,
  Building2, Gavel, Eye, MessageSquare
} from 'lucide-react';
import { getPolicyData, getActiveCommentPeriods, getUpcomingDeadlines, type PolicyLookupResult, type PolicyRule, type CommentPeriod } from '@/lib/policyCache';

interface RealPolicyTrackerProps {
  jurisdiction?: string;
  maxRules?: number;
  showFilters?: boolean;
  entityType?: 'federal' | 'state' | 'local' | 'ms4' | 'utility' | 'ngo' | 'university' | 'esg' | 'biotech';
}

const STATUS_COLORS = {
  'proposed': 'bg-blue-100 text-blue-800 border-blue-200',
  'comment-period': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'final-rule': 'bg-purple-100 text-purple-800 border-purple-200',
  'effective': 'bg-green-100 text-green-800 border-green-200',
  'withdrawn': 'bg-gray-100 text-gray-800 border-gray-200',
  'superseded': 'bg-orange-100 text-orange-800 border-orange-200'
};

const SEVERITY_COLORS = {
  'critical': 'border-l-red-500 bg-red-50',
  'high': 'border-l-orange-500 bg-orange-50',
  'medium': 'border-l-yellow-500 bg-yellow-50',
  'low': 'border-l-gray-500 bg-gray-50'
};

const TYPE_ICONS = {
  'federal-rule': Building2,
  'state-regulation': Scale,
  'epa-guidance': FileText,
  'court-decision': Gavel,
  'executive-order': Building2,
  'congressional-bill': Building2
};

export function RealPolicyTracker({
  jurisdiction = 'federal',
  maxRules = 20,
  showFilters = true,
  entityType = 'federal'
}: RealPolicyTrackerProps) {
  const [data, setData] = useState<PolicyLookupResult | null>(null);
  const [commentPeriods, setCommentPeriods] = useState<CommentPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchPolicyData() {
      try {
        setLoading(true);

        // Fetch main policy data
        const policyResult = await getPolicyData(jurisdiction);
        setData(policyResult);

        // Fetch active comment periods
        const commentResult = await getActiveCommentPeriods();
        setCommentPeriods(commentResult);

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch policy data');
        console.error('Error fetching policy data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPolicyData();
  }, [jurisdiction]);

  const filteredRules = useMemo(() => {
    if (!data) return [];

    return data.rules.filter(rule => {
      if (selectedSeverity !== 'all' && rule.severity !== selectedSeverity) return false;
      if (selectedStatus !== 'all' && rule.status !== selectedStatus) return false;
      if (selectedType !== 'all' && rule.type !== selectedType) return false;
      return true;
    }).slice(0, maxRules);
  }, [data, selectedSeverity, selectedStatus, selectedType, maxRules]);

  const toggleExpanded = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-blue-600" />
            Policy Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
              </div>
            ))}
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
            <Scale className="h-5 w-5 text-blue-600" />
            Policy Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600">
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeCommentCount = commentPeriods.filter(p => p.status === 'open').length;
  const criticalRuleCount = filteredRules.filter(r => r.severity === 'critical').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-blue-600" />
            Policy Tracker
            {jurisdiction !== 'federal' && (
              <Badge variant="outline" className="ml-2">
                {jurisdiction.toUpperCase()}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Real-time regulatory tracking from Federal Register, EPA guidance, and state agencies
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs font-medium text-blue-700">Total Rules</div>
              <div className="text-lg font-bold text-blue-900">{data?.rules.length || 0}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-xs font-medium text-red-700">Critical</div>
              <div className="text-lg font-bold text-red-900">{criticalRuleCount}</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-xs font-medium text-yellow-700">Comment Periods</div>
              <div className="text-lg font-bold text-yellow-900">{activeCommentCount}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs font-medium text-green-700">Calendar Items</div>
              <div className="text-lg font-bold text-green-900">{data?.calendar.length || 0}</div>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 mb-6 p-4 bg-gray-50 rounded-lg">
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="proposed">Proposed</option>
                <option value="comment-period">Comment Period</option>
                <option value="final-rule">Final Rule</option>
                <option value="effective">Effective</option>
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Types</option>
                <option value="federal-rule">Federal Rules</option>
                <option value="state-regulation">State Regulations</option>
                <option value="epa-guidance">EPA Guidance</option>
                <option value="congressional-bill">Congressional Bills</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSeverity('all');
                  setSelectedStatus('all');
                  setSelectedType('all');
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
            </div>
          )}

          {/* Rules List */}
          <div className="space-y-3">
            {filteredRules.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Scale className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No policy rules found</p>
                <p className="text-xs mt-1">Data refreshes daily from Federal Register and state agencies</p>
              </div>
            ) : (
              filteredRules.map((rule) => {
                const IconComponent = TYPE_ICONS[rule.type] || FileText;
                const isExpanded = expandedRules.has(rule.id);

                return (
                  <div key={rule.id}>
                    <div
                      className={`rounded-lg border p-4 cursor-pointer hover:ring-1 hover:ring-blue-300 transition-all border-l-4 ${SEVERITY_COLORS[rule.severity]}`}
                      onClick={() => toggleExpanded(rule.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-1">
                          <IconComponent className="h-4 w-4 text-gray-600 flex-shrink-0" />
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">
                              {rule.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                            <Badge className={`text-xs ${STATUS_COLORS[rule.status]}`}>
                              {rule.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                            {rule.severity === 'critical' && (
                              <Badge variant="destructive" className="text-xs">
                                Critical
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {rule.commentDeadline && new Date(rule.commentDeadline) > new Date() && (
                            <Clock className="h-3 w-3 text-yellow-500" />
                          )}
                          <ChevronDown
                            size={16}
                            className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>

                      <div className="mb-2">
                        <h4 className="text-sm font-medium text-gray-900 mb-1">
                          {rule.title}
                        </h4>
                        <div className="text-xs text-gray-600 mb-2">
                          <span className="font-medium">{rule.agency}</span>
                          {rule.effectiveDate && (
                            <span className="ml-2">
                              • Effective: {new Date(rule.effectiveDate).toLocaleDateString()}
                            </span>
                          )}
                          {rule.statesAffected && (
                            <span className="ml-2">
                              • States: {rule.statesAffected}
                            </span>
                          )}
                        </div>
                      </div>

                      {!isExpanded && (
                        <p className="text-xs text-gray-700 line-clamp-2">
                          {rule.summary}
                        </p>
                      )}

                      {rule.programs.length > 0 && !isExpanded && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {rule.programs.slice(0, 3).map(program => (
                            <Badge key={program} variant="secondary" className="text-xs">
                              {program}
                            </Badge>
                          ))}
                          {rule.programs.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{rule.programs.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="mt-2 ml-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="space-y-3">
                          {/* Summary */}
                          <div>
                            <h5 className="text-xs font-medium text-gray-700 mb-1">Summary</h5>
                            <p className="text-xs text-gray-700">{rule.summary}</p>
                          </div>

                          {/* Impact */}
                          <div>
                            <h5 className="text-xs font-medium text-gray-700 mb-1">Impact</h5>
                            <p className="text-xs text-gray-700">{rule.impactDescription}</p>
                          </div>

                          {/* PIN Connection */}
                          <div>
                            <h5 className="text-xs font-medium text-gray-700 mb-1">PIN Connection</h5>
                            <p className="text-xs text-gray-700">{rule.pinConnection}</p>
                          </div>

                          {/* Programs & Tags */}
                          <div className="flex flex-wrap gap-1">
                            {rule.programs.map(program => (
                              <Badge key={program} variant="secondary" className="text-xs">
                                {program}
                              </Badge>
                            ))}
                            {rule.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          {/* Dates & Links */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                            <div className="text-xs text-gray-500">
                              {rule.proposedDate && (
                                <span>Proposed: {new Date(rule.proposedDate).toLocaleDateString()}</span>
                              )}
                              {rule.commentDeadline && (
                                <span className="ml-3 text-yellow-600">
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  Comments Due: {new Date(rule.commentDeadline).toLocaleDateString()}
                                </span>
                              )}
                            </div>

                            <div className="flex gap-2">
                              {rule.docketId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://regulations.gov/docket/${rule.docketId}`, '_blank');
                                  }}
                                  className="text-xs"
                                >
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  Comments
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(rule.sourceUrl, '_blank');
                                }}
                                className="text-xs"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Rule
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Active Comment Periods */}
          {activeCommentCount > 0 && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="text-sm font-medium text-yellow-800 mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Active Comment Periods ({activeCommentCount})
              </h4>
              <div className="space-y-2">
                {commentPeriods.filter(p => p.status === 'open').slice(0, 3).map(period => (
                  <div key={period.docketId} className="flex items-center justify-between text-xs">
                    <span className="text-yellow-700">{period.title}</span>
                    <span className="text-yellow-600">
                      Due: {new Date(period.closeDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                Data sources: Federal Register, EPA.gov, Regulations.gov, state agencies
              </span>
              <span>
                Updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Unknown'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RealPolicyTracker;