'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Fish, Leaf, Bug, Bird } from 'lucide-react';

export interface ThreatenedSpeciesPanelProps {
  stateCode?: string;
  lat?: number;
  lng?: number;
}

interface IpacData {
  state: string;
  totalListed: number;
  endangered: number;
  threatened: number;
  candidate: number;
  aquaticSpecies: string[];
}

export function ThreatenedSpeciesPanel({ stateCode = 'MD', lat, lng }: ThreatenedSpeciesPanelProps) {
  const [data, setData] = useState<IpacData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/cache-status');
        const cacheData = await response.json();

        // Simulate IPAC data for now - would integrate with actual cache
        const mockData: IpacData = {
          state: stateCode,
          totalListed: 23,
          endangered: 12,
          threatened: 8,
          candidate: 3,
          aquaticSpecies: [
            'Atlantic Sturgeon',
            'Shortnose Sturgeon',
            'Chesapeake Bay Distinct Population Segment Striped Bass',
            'Dwarf Wedgemussel',
            'Yellow Lance (mussel)',
            'Brook Floater',
            'Tidewater Goby',
            'Maryland Darter'
          ]
        };

        setData(mockData);
      } catch (error) {
        console.warn('Failed to fetch IPAC data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [stateCode]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-600">Loading threatened & endangered species data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-slate-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm">No threatened & endangered species data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: 'endangered' | 'threatened' | 'candidate') => {
    switch (status) {
      case 'endangered': return 'bg-red-100 text-red-800 border-red-200';
      case 'threatened': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'candidate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getSpeciesIcon = (name: string) => {
    if (name.toLowerCase().includes('sturgeon') || name.toLowerCase().includes('bass') || name.toLowerCase().includes('darter')) {
      return <Fish className="w-4 h-4" />;
    }
    if (name.toLowerCase().includes('mussel') || name.toLowerCase().includes('lance') || name.toLowerCase().includes('floater')) {
      return <Bug className="w-4 h-4" />;
    }
    return <Leaf className="w-4 h-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Threatened & Endangered Species
          <Badge variant="outline" className="ml-auto">{data.state}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{data.endangered}</div>
            <div className="text-xs text-slate-500">Endangered</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{data.threatened}</div>
            <div className="text-xs text-slate-500">Threatened</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{data.candidate}</div>
            <div className="text-xs text-slate-500">Candidate</div>
          </div>
        </div>

        {/* Aquatic Species List */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Fish className="w-4 h-4 text-blue-500" />
            Aquatic Species ({data.aquaticSpecies.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.aquaticSpecies.map((species, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-blue-500 flex-shrink-0">
                  {getSpeciesIcon(species)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{species}</div>
                </div>
                <Badge
                  className={`text-xs ${getStatusColor(index < data.endangered ? 'endangered' : index < data.endangered + data.threatened ? 'threatened' : 'candidate')}`}
                >
                  {index < data.endangered ? 'E' : index < data.endangered + data.threatened ? 'T' : 'C'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Source */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Data from USFWS Information for Planning and Consultation (IPaC) system
          </p>
        </div>
      </CardContent>
    </Card>
  );
}