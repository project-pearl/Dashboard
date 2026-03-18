'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Landmark, Search, MapPin, Calendar, AlertTriangle, Info } from 'lucide-react';

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

// Incident type colors from DisasterEmergencyPanel
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

  // Filter declarations based on search and type filter
  const filteredDeclarations = useMemo(() => {
    return declarations.filter(d => {
      const matchesSearch = !searchQuery ||
        d.declarationTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.designatedArea.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.incidentType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedType === 'all' || d.incidentType === selectedType;

      return matchesSearch && matchesType;
    });
  }, [declarations, searchQuery, selectedType]);

  // Show top 5 initially, with option to show more
  const [showAll, setShowAll] = useState(false);
  const displayedDeclarations = showAll ? filteredDeclarations : filteredDeclarations.slice(0, 5);
  const hasMore = filteredDeclarations.length > 5;

  // Count by type for summary
  const typeCount = useMemo(() => {
    const counts: Record<string, number> = {};
    declarations.forEach(d => {
      counts[d.incidentType] = (counts[d.incidentType] || 0) + 1;
    });
    return counts;
  }, [declarations]);

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
            {/* Summary badges */}
            {Object.keys(typeCount).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(typeCount)
                  .sort(([,a], [,b]) => b - a)
                  .map(([type, count]) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className={`text-xs ${INCIDENT_TYPE_COLORS[type] || 'bg-slate-100 text-slate-600'}`}
                    >
                      {type}: {count}
                    </Badge>
                  ))}
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
                  {displayedDeclarations.map((declaration, index) => (
                    <div
                      key={`${declaration.disasterNumber}-${index}`}
                      className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              DR-{declaration.disasterNumber}
                            </Badge>
                            <Badge
                              className={`text-xs ${INCIDENT_TYPE_COLORS[declaration.incidentType] || 'bg-slate-100 text-slate-600'}`}
                            >
                              {declaration.incidentType}
                            </Badge>
                          </div>

                          <h4 className="font-medium text-slate-900 mb-2">
                            {declaration.declarationTitle}
                          </h4>

                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <MapPin size={14} />
                              <span>{declaration.state}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar size={14} />
                              <span>{formatDate(declaration.declarationDate)}</span>
                            </div>
                          </div>

                          {declaration.designatedArea && (
                            <div className="mt-2 text-sm text-slate-600">
                              <strong>Area:</strong> {formatArea(declaration.designatedArea)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

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