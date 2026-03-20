'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Fish, Dna, Waves, Shield, TrendingUp, MapPin, Calendar } from 'lucide-react';

import { ThreatenedSpeciesPanel } from './ThreatenedSpeciesPanel';
import { eDNADetectionPanel } from './eDNADetectionPanel';
import { HypoxiaMonitoringPanel } from './HypoxiaMonitoringPanel';

export interface AquaticWildlifePanelProps {
  lat?: number;
  lng?: number;
  stateCode?: string;
  huc12?: string;
  compact?: boolean;
  defaultTab?: 'overview' | 'threatened' | 'edna' | 'hypoxia';
}

export function AquaticWildlifePanel({
  lat = 38.93,
  lng = -76.38,
  stateCode = 'MD',
  huc12,
  compact = false,
  defaultTab = 'overview'
}: AquaticWildlifePanelProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Overview summary data (would come from actual caches)
  const overviewData = {
    threatenedSpecies: 23,
    recentDetections: 47,
    hypoxicStations: 18,
    totalStations: 42,
    biodiversityIndex: 72,
    lastUpdated: '2024-03-15T09:15:00Z'
  };

  if (compact) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fish className="w-5 h-5 text-blue-600" />
            Aquatic Wildlife Summary
            <Badge variant="outline" className="ml-auto">{stateCode}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{overviewData.threatenedSpecies}</div>
              <div className="text-xs text-slate-500">T&E Species</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{overviewData.recentDetections}</div>
              <div className="text-xs text-slate-500">eDNA Detections</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${overviewData.hypoxicStations > 15 ? 'text-red-600' : 'text-green-600'}`}>
                {Math.round((overviewData.hypoxicStations / overviewData.totalStations) * 100)}%
              </div>
              <div className="text-xs text-slate-500">Hypoxic Zones</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${overviewData.biodiversityIndex >= 70 ? 'text-green-600' : overviewData.biodiversityIndex >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {overviewData.biodiversityIndex}
              </div>
              <div className="text-xs text-slate-500">Diversity Index</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Last updated: {new Date(overviewData.lastUpdated).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fish className="w-5 h-5 text-blue-600" />
          Aquatic Wildlife Intelligence
          <Badge variant="outline" className="ml-auto">{stateCode}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="text-xs">
              <TrendingUp className="w-4 h-4 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="threatened" className="text-xs">
              <Shield className="w-4 h-4 mr-1" />
              T&E Species
            </TabsTrigger>
            <TabsTrigger value="edna" className="text-xs">
              <Dna className="w-4 h-4 mr-1" />
              eDNA Detection
            </TabsTrigger>
            <TabsTrigger value="hypoxia" className="text-xs">
              <Waves className="w-4 h-4 mr-1" />
              Hypoxia Zones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                <Shield className="w-8 h-8 mx-auto mb-2 text-red-600" />
                <div className="text-2xl font-bold text-red-600">{overviewData.threatenedSpecies}</div>
                <div className="text-sm text-slate-700 font-medium">T&E Species</div>
                <div className="text-xs text-slate-500 mt-1">USFWS Listed</div>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                <Dna className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-600">{overviewData.recentDetections}</div>
                <div className="text-sm text-slate-700 font-medium">eDNA Detections</div>
                <div className="text-xs text-slate-500 mt-1">Last 30 days</div>
              </div>

              <div className={`text-center p-4 rounded-lg border ${overviewData.hypoxicStations > 15 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <Waves className={`w-8 h-8 mx-auto mb-2 ${overviewData.hypoxicStations > 15 ? 'text-red-600' : 'text-green-600'}`} />
                <div className={`text-2xl font-bold ${overviewData.hypoxicStations > 15 ? 'text-red-600' : 'text-green-600'}`}>
                  {Math.round((overviewData.hypoxicStations / overviewData.totalStations) * 100)}%
                </div>
                <div className="text-sm text-slate-700 font-medium">Hypoxic Zones</div>
                <div className="text-xs text-slate-500 mt-1">{overviewData.hypoxicStations}/{overviewData.totalStations} stations</div>
              </div>

              <div className={`text-center p-4 rounded-lg border ${
                overviewData.biodiversityIndex >= 70 ? 'bg-green-50 border-green-200' :
                overviewData.biodiversityIndex >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
              }`}>
                <Fish className={`w-8 h-8 mx-auto mb-2 ${
                  overviewData.biodiversityIndex >= 70 ? 'text-green-600' :
                  overviewData.biodiversityIndex >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`} />
                <div className={`text-2xl font-bold ${
                  overviewData.biodiversityIndex >= 70 ? 'text-green-600' :
                  overviewData.biodiversityIndex >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {overviewData.biodiversityIndex}
                </div>
                <div className="text-sm text-slate-700 font-medium">Diversity Index</div>
                <div className="text-xs text-slate-500 mt-1">Species richness</div>
              </div>
            </div>

            {/* Key Insights */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700">Key Insights</h4>

              {overviewData.hypoxicStations > 15 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-sm text-red-800 font-medium">Hypoxia Alert</div>
                  <div className="text-xs text-red-700 mt-1">
                    High percentage of monitoring stations experiencing hypoxic conditions. This threatens aquatic life survival.
                  </div>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800 font-medium">Chesapeake Bay Focus</div>
                <div className="text-xs text-blue-700 mt-1">
                  Maryland's aquatic ecosystems are primarily influenced by Chesapeake Bay watershed dynamics, SAV coverage, and nutrient loading patterns.
                </div>
              </div>

              {overviewData.biodiversityIndex < 50 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-sm text-yellow-800 font-medium">Biodiversity Concern</div>
                  <div className="text-xs text-yellow-700 mt-1">
                    Species diversity index is below optimal levels. Consider habitat restoration and pollution reduction efforts.
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3 h-3" />
              Last updated: {new Date(overviewData.lastUpdated).toLocaleString()}
            </div>
          </TabsContent>

          <TabsContent value="threatened" className="mt-6">
            <ThreatenedSpeciesPanel stateCode={stateCode} lat={lat} lng={lng} />
          </TabsContent>

          <TabsContent value="edna" className="mt-6">
            <eDNADetectionPanel lat={lat} lng={lng} huc12={huc12} />
          </TabsContent>

          <TabsContent value="hypoxia" className="mt-6">
            <HypoxiaMonitoringPanel lat={lat} lng={lng} state={stateCode} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}