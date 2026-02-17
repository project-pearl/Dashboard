'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TreePine, Users, TrendingUp, MapPin, Calendar, Target,
  CheckCircle, AlertCircle, Clock, ExternalLink
} from 'lucide-react';

interface NGOProjectsProps {
  regionName: string;
  data: any;
  removalEfficiencies: Record<string, number>;
}

const ACTIVE_PROJECTS = [
  {
    id: 1,
    name: "Oyster Reef Restoration - Patapsco River",
    organization: "Chesapeake Bay Foundation",
    status: "active",
    startDate: "2024-03",
    targetMetric: "Plant 100,000 oysters",
    progress: 68,
    waterQualityGoal: "Reduce TSS by 30%, increase DO by 1.5 mg/L",
    currentImpact: "42,000 oysters filtering ~2.1M gallons/day",
    fundingSource: "NOAA Restoration Grant",
    pearlData: "Using PEARL data to track filtration effectiveness"
  },
  {
    id: 2,
    name: "SAV (Underwater Grass) Planting Campaign",
    organization: "Maryland Dept of Natural Resources",
    status: "active",
    startDate: "2025-01",
    targetMetric: "Restore 50 acres of SAV beds",
    progress: 22,
    waterQualityGoal: "Maintain turbidity <12 NTU for sunlight penetration",
    currentImpact: "11 acres planted, monitoring growth weekly",
    fundingSource: "EPA Section 319",
    pearlData: "Turbidity monitoring guides planting locations"
  },
  {
    id: 3,
    name: "Stormwater Education & Rain Garden Program",
    organization: "Alliance for the Chesapeake Bay",
    status: "active",
    startDate: "2024-09",
    targetMetric: "Install 200 residential rain gardens",
    progress: 85,
    waterQualityGoal: "Reduce neighborhood stormwater runoff by 40%",
    currentImpact: "170 gardens filtering ~2.8M gallons/year",
    fundingSource: "State Watershed Grants",
    pearlData: "Before/after water quality monitoring"
  },
  {
    id: 4,
    name: "Nutrient Pollution Advocacy Campaign",
    organization: "Waterkeepers Chesapeake",
    status: "active",
    startDate: "2024-06",
    targetMetric: "Reduce agricultural N runoff 25%",
    progress: 45,
    waterQualityGoal: "Decrease TN from 2.1 mg/L to <1.5 mg/L",
    currentImpact: "12 farms adopting best practices, cover crops planted",
    fundingSource: "Private Donations",
    pearlData: "Real-time nutrient tracking to pressure policymakers"
  },
  {
    id: 5,
    name: "Citizen Science Water Monitoring Network",
    organization: "ShoreRivers",
    status: "planning",
    startDate: "2026-04",
    targetMetric: "Train 500 citizen monitors across MD",
    progress: 15,
    waterQualityGoal: "Expand monitoring coverage 10x",
    currentImpact: "75 volunteers trained, 12 sites added",
    fundingSource: "Community Foundation Grant",
    pearlData: "PEARL dashboard used for volunteer data entry & validation"
  },
  {
    id: 6,
    name: "Living Shoreline Installation - Middle Branch",
    organization: "Blue Water Baltimore",
    status: "completed",
    startDate: "2023-05",
    targetMetric: "Install 2,000 ft of living shoreline",
    progress: 100,
    waterQualityGoal: "Reduce erosion-based TSS by 60%",
    currentImpact: "TSS reduced from 45 mg/L → 18 mg/L (60% improvement)",
    fundingSource: "MD Coastal Resiliency Fund",
    pearlData: "PEARL data validated project success for final report"
  }
];

export function NGOProjects({ regionName, data, removalEfficiencies }: NGOProjectsProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'planning' | 'completed'>('all');

  const filteredProjects = ACTIVE_PROJECTS.filter(project => 
    filterStatus === 'all' || project.status === filterStatus
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'planning': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <TrendingUp className="h-3 w-3" />;
      case 'planning': return <Clock className="h-3 w-3" />;
      case 'completed': return <CheckCircle className="h-3 w-3" />;
      default: return <AlertCircle className="h-3 w-3" />;
    }
  };

  return (
    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TreePine className="h-5 w-5 text-green-600" />
          Active Restoration & Advocacy Projects
        </CardTitle>
        <CardDescription>
          Track environmental projects using PEARL data for monitoring and impact validation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'planning', 'completed'] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={filterStatus === status ? 'default' : 'outline'}
              onClick={() => setFilterStatus(status)}
              className="capitalize"
            >
              {status === 'all' ? 'All Projects' : status}
              {status !== 'all' && (
                <Badge variant="secondary" className="ml-2">
                  {ACTIVE_PROJECTS.filter(p => p.status === status).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Projects List */}
        <div className="space-y-3">
          {filteredProjects.map((project) => (
            <div key={project.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800 mb-1">
                    {project.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                    <Users className="h-3 w-3" />
                    {project.organization}
                  </div>
                </div>
                <Badge className={`${getStatusColor(project.status)} text-xs flex items-center gap-1`}>
                  {getStatusIcon(project.status)}
                  {project.status}
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-700 font-medium">{project.targetMetric}</span>
                  <span className="text-slate-600">{project.progress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      project.status === 'completed' ? 'bg-green-600' :
                      project.status === 'active' ? 'bg-blue-600' :
                      'bg-amber-600'
                    }`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              {/* Key Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-xs">
                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                  <div className="flex items-center gap-1 text-blue-700 font-semibold mb-1">
                    <Target className="h-3 w-3" />
                    Water Quality Goal
                  </div>
                  <div className="text-blue-900">{project.waterQualityGoal}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <div className="flex items-center gap-1 text-green-700 font-semibold mb-1">
                    <TrendingUp className="h-3 w-3" />
                    Current Impact
                  </div>
                  <div className="text-green-900">{project.currentImpact}</div>
                </div>
              </div>

              {/* PEARL Data Usage */}
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded p-2 mb-2">
                <div className="text-xs">
                  <span className="font-semibold text-cyan-900">🔬 PEARL Data Usage:</span>{' '}
                  <span className="text-cyan-800">{project.pearlData}</span>
                </div>
              </div>

              {/* Footer Meta */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Started {project.startDate}
                </div>
                <div className="flex items-center gap-1">
                  💰 {project.fundingSource}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-green-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">
              {ACTIVE_PROJECTS.filter(p => p.status === 'active').length}
            </div>
            <div className="text-xs text-slate-600">Active Projects</div>
          </div>
          <div className="bg-white border border-blue-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {ACTIVE_PROJECTS.filter(p => p.status === 'planning').length}
            </div>
            <div className="text-xs text-slate-600">In Planning</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-slate-600">
              {ACTIVE_PROJECTS.filter(p => p.status === 'completed').length}
            </div>
            <div className="text-xs text-slate-600">Completed</div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 text-emerald-700 flex-shrink-0" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <span className="font-semibold block mb-1">Add Your Project to PEARL Tracking</span>
              Using PEARL data for a restoration or advocacy project? We can help with:
              • Baseline data packages for grant applications<br/>
              • Before/after monitoring and impact reports<br/>
              • Public-facing project dashboards<br/>
              • Success story documentation for funders
              <div className="mt-2">
                <Button size="sm" variant="outline" className="text-xs h-7">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Submit Your Project
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
