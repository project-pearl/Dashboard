'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, CheckCircle, AlertCircle, MapPin, TrendingDown, TrendingUp,
  Droplets, FileText, Users, Building, Download, ExternalLink, BarChart3, CloudRain
} from 'lucide-react';

interface MarylandStateViewProps {
  selectedState: string;
}

// Maryland MS4 jurisdictions with mock data
const MARYLAND_MS4S = [
  { 
    id: 'baltimore-city', 
    name: 'Baltimore City', 
    population: 585708,
    status: 'compliant', 
    lastReport: '2025-12-15',
    alerts: 2,
    tmdlProgress: 78,
    pearlDeployed: true,
    sites: 8
  },
  { 
    id: 'anne-arundel', 
    name: 'Anne Arundel County', 
    population: 588261,
    status: 'compliant', 
    lastReport: '2025-12-20',
    alerts: 1,
    tmdlProgress: 82,
    pearlDeployed: true,
    sites: 6
  },
  { 
    id: 'annapolis', 
    name: 'City of Annapolis', 
    population: 40812,
    status: 'compliant', 
    lastReport: '2026-01-05',
    alerts: 0,
    tmdlProgress: 85,
    pearlDeployed: false,
    sites: 2
  },
  { 
    id: 'montgomery', 
    name: 'Montgomery County', 
    population: 1062061,
    status: 'warning', 
    lastReport: '2025-11-30',
    alerts: 4,
    tmdlProgress: 65,
    pearlDeployed: false,
    sites: 12
  },
  { 
    id: 'prince-georges', 
    name: "Prince George's County", 
    population: 967201,
    status: 'compliant', 
    lastReport: '2025-12-10',
    alerts: 2,
    tmdlProgress: 71,
    pearlDeployed: false,
    sites: 10
  },
  { 
    id: 'howard', 
    name: 'Howard County', 
    population: 334529,
    status: 'compliant', 
    lastReport: '2025-12-18',
    alerts: 1,
    tmdlProgress: 88,
    pearlDeployed: false,
    sites: 5
  },
  { 
    id: 'harford', 
    name: 'Harford County', 
    population: 260924,
    status: 'compliant', 
    lastReport: '2025-12-12',
    alerts: 1,
    tmdlProgress: 74,
    pearlDeployed: false,
    sites: 4
  },
  { 
    id: 'frederick', 
    name: 'Frederick County', 
    population: 271717,
    status: 'warning', 
    lastReport: '2025-10-15',
    alerts: 5,
    tmdlProgress: 58,
    pearlDeployed: false,
    sites: 6
  },
];

export function MarylandStateView({ selectedState }: MarylandStateViewProps) {
  
  const totalMS4s = MARYLAND_MS4S.length;
  const compliantMS4s = MARYLAND_MS4S.filter(m => m.status === 'compliant').length;
  const totalAlerts = MARYLAND_MS4S.reduce((sum, m) => sum + m.alerts, 0);
  const avgTMDL = Math.round(MARYLAND_MS4S.reduce((sum, m) => sum + m.tmdlProgress, 0) / totalMS4s);
  const pearlDeployments = MARYLAND_MS4S.filter(m => m.pearlDeployed).length;
  const totalSites = MARYLAND_MS4S.reduce((sum, m) => sum + m.sites, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Maryland Department of Environment</h1>
            <p className="text-blue-100">Statewide MS4 Compliance & Water Quality Monitoring</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-100">Total Jurisdictions</div>
            <div className="text-4xl font-bold">{totalMS4s}</div>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-blue-100 text-xs mb-1">Compliant</div>
            <div className="text-2xl font-bold">{compliantMS4s}/{totalMS4s}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-blue-100 text-xs mb-1">Active Alerts</div>
            <div className="text-2xl font-bold">{totalAlerts}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-blue-100 text-xs mb-1">Avg TMDL Progress</div>
            <div className="text-2xl font-bold">{avgTMDL}%</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-blue-100 text-xs mb-1">PEARL Sites</div>
            <div className="text-2xl font-bold">{pearlDeployments} MS4s</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-blue-100 text-xs mb-1">Monitoring Sites</div>
            <div className="text-2xl font-bold">{totalSites}</div>
          </div>
        </div>
      </div>

      {/* Chesapeake Bay TMDL Progress */}
      <Card className="border-2 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900">
            <Droplets className="h-5 w-5" />
            Chesapeake Bay TMDL Progress
          </CardTitle>
          <CardDescription>Nitrogen and Phosphorus Load Reduction Targets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-green-900">Total Nitrogen (TN)</span>
                <Badge className="bg-green-600 text-white">On Track</Badge>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-xs text-green-700 mb-1">
                  <span>Progress to 2025 Target</span>
                  <span className="font-bold">74%</span>
                </div>
                <div className="h-3 bg-green-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600 rounded-full" style={{ width: '74%' }} />
                </div>
              </div>
              <div className="text-xs text-green-700 space-y-1">
                <div className="flex justify-between">
                  <span>Target:</span>
                  <span className="font-semibold">6.45M lbs/year reduction</span>
                </div>
                <div className="flex justify-between">
                  <span>Current:</span>
                  <span className="font-semibold">4.77M lbs/year reduced</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining:</span>
                  <span className="font-semibold text-orange-600">1.68M lbs/year</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-blue-900">Total Phosphorus (TP)</span>
                <Badge className="bg-blue-600 text-white">On Track</Badge>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-xs text-blue-700 mb-1">
                  <span>Progress to 2025 Target</span>
                  <span className="font-bold">81%</span>
                </div>
                <div className="h-3 bg-blue-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '81%' }} />
                </div>
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <div className="flex justify-between">
                  <span>Target:</span>
                  <span className="font-semibold">285K lbs/year reduction</span>
                </div>
                <div className="flex justify-between">
                  <span>Current:</span>
                  <span className="font-semibold">230.9K lbs/year reduced</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining:</span>
                  <span className="font-semibold text-orange-600">54.1K lbs/year</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3">
            <div className="text-xs text-amber-900">
              <span className="font-semibold">💡 PEARL Impact:</span> Current PEARL deployments (Baltimore City, Anne Arundel) are contributing approximately 125K lbs/year TN reduction and 8.2K lbs/year TP reduction toward statewide targets.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MS4 Jurisdiction List */}
      <Card className="border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            MS4 Jurisdictions - Compliance Status
          </CardTitle>
          <CardDescription>Real-time monitoring and reporting status for all Maryland Phase I & II MS4s</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MARYLAND_MS4S.map((ms4) => (
              <div key={ms4.id} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{ms4.name}</h3>
                      {ms4.status === 'compliant' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Compliant
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Needs Attention
                        </Badge>
                      )}
                      {ms4.pearlDeployed && (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                          <Droplets className="h-3 w-3 mr-1" />
                          PEARL Deployed
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-slate-500">Population</div>
                        <div className="font-semibold text-slate-700">{ms4.population.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Monitoring Sites</div>
                        <div className="font-semibold text-slate-700">{ms4.sites} sites</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Active Alerts</div>
                        <div className="font-semibold text-slate-700">
                          {ms4.alerts === 0 ? (
                            <span className="text-green-600">None</span>
                          ) : (
                            <span className="text-orange-600">{ms4.alerts}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">TMDL Progress</div>
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-slate-700">{ms4.tmdlProgress}%</div>
                          {ms4.tmdlProgress >= 80 ? (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          ) : ms4.tmdlProgress >= 65 ? (
                            <TrendingUp className="h-3 w-3 text-yellow-600" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-600" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Last Report: {ms4.lastReport}
                      </div>
                      {!ms4.pearlDeployed && (
                        <div className="text-blue-600 font-medium">
                          → Potential PEARL deployment site
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" className="text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      Reports
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* MDE Actions */}
      <Card className="border-2 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <BarChart3 className="h-5 w-5" />
            MDE Reporting & Analysis Tools
          </CardTitle>
          <CardDescription>Generate statewide reports and export data for EPA reporting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="flex items-center gap-3 w-full text-left">
                <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">Statewide MS4 Annual Report</div>
                  <div className="text-xs text-slate-600">Compile all jurisdictions for EPA submission</div>
                </div>
                <Download className="h-4 w-4 text-slate-400" />
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="flex items-center gap-3 w-full text-left">
                <Droplets className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">Chesapeake Bay TMDL Report</div>
                  <div className="text-xs text-slate-600">Load reduction progress by jurisdiction</div>
                </div>
                <Download className="h-4 w-4 text-slate-400" />
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="flex items-center gap-3 w-full text-left">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">Non-Compliance Summary</div>
                  <div className="text-xs text-slate-600">Jurisdictions requiring MDE follow-up</div>
                </div>
                <Download className="h-4 w-4 text-slate-400" />
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="flex items-center gap-3 w-full text-left">
                <Users className="h-5 w-5 text-purple-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">Environmental Justice Analysis</div>
                  <div className="text-xs text-slate-600">EJ community water quality dashboard</div>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-400" />
              </div>
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
            <div className="text-xs text-blue-900">
              <span className="font-semibold">💡 Real-Time Dashboard:</span> All data updates automatically from PEARL deployments and submitted MS4 reports. MDE can monitor compliance status 24/7 without waiting for annual submissions.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chesapeake Bay State Comparison */}
      <Card className="border-2 border-cyan-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-cyan-900">
            <BarChart3 className="h-5 w-5" />
            Chesapeake Bay State Performance Comparison
          </CardTitle>
          <CardDescription>How Maryland compares to other Bay watershed states on TMDL progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { state: 'Delaware', progress: 79, rank: 1, trend: 'up', color: 'emerald' },
              { state: 'Pennsylvania', progress: 71, rank: 2, trend: 'up', color: 'green' },
              { state: 'Maryland', progress: 75, rank: 3, trend: 'up', color: 'blue', isYou: true },
              { state: 'New York', progress: 69, rank: 4, trend: 'flat', color: 'slate' },
              { state: 'Virginia', progress: 68, rank: 5, trend: 'up', color: 'slate' },
              { state: 'West Virginia', progress: 62, rank: 6, trend: 'down', color: 'orange' },
            ].map((item) => (
              <div 
                key={item.state} 
                className={`border rounded-lg p-4 ${
                  item.isYou 
                    ? 'bg-blue-50 border-blue-300 shadow-md' 
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`text-lg font-bold ${
                      item.rank === 1 ? 'text-yellow-600' :
                      item.rank === 2 ? 'text-slate-400' :
                      item.rank === 3 ? 'text-amber-700' : 'text-slate-500'
                    }`}>
                      #{item.rank}
                    </div>
                    <div>
                      <div className={`font-semibold ${item.isYou ? 'text-blue-900' : 'text-slate-900'}`}>
                        {item.state}
                        {item.isYou && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">YOU</span>}
                      </div>
                      <div className="text-xs text-slate-600">TMDL Implementation Progress</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        item.isYou ? 'text-blue-700' : 'text-slate-700'
                      }`}>
                        {item.progress}%
                      </div>
                      <div className="text-xs text-slate-500">avg progress</div>
                    </div>
                    {item.trend === 'up' && <TrendingUp className="h-5 w-5 text-green-600" />}
                    {item.trend === 'down' && <TrendingDown className="h-5 w-5 text-red-600" />}
                    {item.trend === 'flat' && <div className="h-5 w-5" />}
                  </div>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      item.color === 'emerald' ? 'bg-emerald-600' :
                      item.color === 'green' ? 'bg-green-600' :
                      item.color === 'blue' ? 'bg-blue-600' :
                      item.color === 'orange' ? 'bg-orange-500' : 'bg-slate-400'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-700 mb-1">Gap to #1 (Delaware)</div>
              <div className="text-lg font-bold text-blue-900">4 percentage points</div>
              <div className="text-xs text-blue-600 mt-1">Estimated: 260K lbs N/year additional reduction needed</div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs text-green-700 mb-1">Lead over #5 (Virginia)</div>
              <div className="text-lg font-bold text-green-900">7 percentage points</div>
              <div className="text-xs text-green-600 mt-1">Maryland is outperforming VA, WV, NY</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3">
              <div className="text-xs text-purple-700 mb-1">PEARL Potential Impact</div>
              <div className="text-lg font-bold text-purple-900">+3-5% progress</div>
              <div className="text-xs text-purple-600 mt-1">If deployed to all 8 MD MS4s</div>
            </div>
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3">
            <div className="text-xs text-amber-900">
              <span className="font-semibold">💡 Competitive Advantage:</span> Maryland is currently ranked #3 out of 6 Chesapeake Bay states. Expanding PEARL deployments to Montgomery, Frederick, and other MS4s could move Maryland to #2 or #1, demonstrating national leadership in innovative stormwater management.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Maryland Water Quality Challenges */}
      <Card className="border-2 border-red-200 bg-red-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertTriangle className="h-5 w-5" />
            Current Maryland Water Quality Challenges (2024-2026)
          </CardTitle>
          <CardDescription>Active issues requiring monitoring and intervention - areas where PEARL could provide real-time intelligence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Potomac River Sewage Spill */}
            <div className="bg-white border-l-4 border-red-600 rounded-r-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-red-900 mb-1">Potomac River Major Sewage Spill (January 2026 - ACTIVE)</div>
                  <div className="text-sm text-red-800 mb-2">
                    DC Water Potomac Interceptor rupture spilling tens of millions of gallons of untreated sewage daily. High E. coli levels near site, public warnings to avoid contact, repairs ongoing.
                  </div>
                  <div className="text-xs text-red-700 bg-red-100 rounded px-2 py-1 inline-block">
                    💡 PEARL Opportunity: Real-time bacterial monitoring would provide immediate public health alerts vs. delayed lab results
                  </div>
                </div>
              </div>
            </div>

            {/* PFAS Fish Advisories */}
            <div className="bg-white border-l-4 border-orange-500 rounded-r-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-orange-900 mb-1">PFAS-Driven Fish Consumption Advisories (Ongoing)</div>
                  <div className="text-sm text-orange-800 mb-2">
                    MDE continues updating fish consumption advisories statewide due to PFAS (especially PFOS) contamination affecting common sportfish in multiple Maryland waters.
                  </div>
                  <div className="text-xs text-orange-700 bg-orange-100 rounded px-2 py-1 inline-block">
                    💡 PEARL Opportunity: Continuous PFAS monitoring at stormwater outfalls to track and reduce loadings
                  </div>
                </div>
              </div>
            </div>

            {/* Bay Health Decline */}
            <div className="bg-white border-l-4 border-amber-500 rounded-r-lg p-4">
              <div className="flex items-start gap-3">
                <TrendingDown className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-amber-900 mb-1">Chesapeake Bay Health Grade Dropped to "C" (2025)</div>
                  <div className="text-sm text-amber-800 mb-2">
                    UMCES Chesapeake Bay Report Card declined from C+ to C in 2025. Extreme rainfall and heat cited as drivers of nutrient runoff and hypoxic "dead zone" conditions.
                  </div>
                  <div className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-1 inline-block">
                    💡 PEARL Opportunity: Nutrient load tracking at MS4 outfalls directly addresses root cause of Bay degradation
                  </div>
                </div>
              </div>
            </div>

            {/* Bacteria Beach Closures */}
            <div className="bg-white border-l-4 border-yellow-500 rounded-r-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-yellow-900 mb-1">Frequent Rainfall-Triggered Beach Closures (2024-2025)</div>
                  <div className="text-sm text-yellow-800 mb-2">
                    County health programs continue issuing no-swim advisories after rainfall events due to bacterial indicators (enterococci). Multi-beach advisories common during storm events.
                  </div>
                  <div className="text-xs text-yellow-700 bg-yellow-100 rounded px-2 py-1 inline-block">
                    💡 PEARL Opportunity: Storm-triggered monitoring provides real-time data for faster, more accurate beach closure decisions
                  </div>
                </div>
              </div>
            </div>

            {/* Harmful Algal Blooms */}
            <div className="bg-white border-l-4 border-green-500 rounded-r-lg p-4">
              <div className="flex items-start gap-3">
                <Droplets className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-green-900 mb-1">Harmful Algal Bloom Advisories (Summer 2025)</div>
                  <div className="text-sm text-green-800 mb-2">
                    WSSC Water issued recreational water-contact health advisory for Triadelphia Reservoir. MDE's 2024 Integrated Report documents ongoing HAB investigations and protective measures statewide.
                  </div>
                  <div className="text-xs text-green-700 bg-green-100 rounded px-2 py-1 inline-block">
                    💡 PEARL Opportunity: Early detection via chlorophyll-a and nutrient monitoring enables proactive HAB management
                  </div>
                </div>
              </div>
            </div>

            {/* Potomac Polluted Runoff */}
            <div className="bg-white border-l-4 border-blue-500 rounded-r-lg p-4">
              <div className="flex items-start gap-3">
                <CloudRain className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-blue-900 mb-1">Potomac River Polluted Runoff Pressure (2025 Report Card)</div>
                  <div className="text-sm text-blue-800 mb-2">
                    Potomac River Report Card identified polluted runoff as rising pollution source, worsened by tree loss and heavier rainstorms. USGS and ICPRB highlight PFAS as continuing basin-wide challenge.
                  </div>
                  <div className="text-xs text-blue-700 bg-blue-100 rounded px-2 py-1 inline-block">
                    💡 PEARL Opportunity: MS4 compliance monitoring addresses stormwater runoff at source before reaching Potomac
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-4">
            <div className="text-sm text-blue-900">
              <span className="font-semibold">🎯 Strategic Context:</span> Each of these challenges requires better monitoring and faster response. PEARL's continuous real-time data provides MDE with the intelligence infrastructure to detect, track, and respond to water quality emergencies more effectively than current grab sampling approaches. Maryland's environmental challenges are accelerating - the monitoring systems need to accelerate too.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
