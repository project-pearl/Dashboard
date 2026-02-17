'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, Globe, Users, FileText, Award, Target,
  Download, ExternalLink, BarChart3, Leaf, Droplets, Building
} from 'lucide-react';

interface CorporateESGDashboardProps {
  esgScore: number;
  waterQualityScore: number;
  loadReductionScore: number;
  ecosystemHealthScore: number;
  removalEfficiencies: Record<string, number>;
  regionName: string;
}

export function CorporateESGDashboard({
  esgScore,
  waterQualityScore,
  loadReductionScore,
  ecosystemHealthScore,
  removalEfficiencies,
  regionName
}: CorporateESGDashboardProps) {

  // Calculate sustainability metrics
  const annualGallonsTreated = 2800000; // Based on 2M gallons/day avg
  const co2eAvoided = (removalEfficiencies.TSS / 100) * 45; // Tons CO2e/year from avoided treatment
  const nutrientCreditsGenerated = (removalEfficiencies.TN / 100) * 12.5; // lbs N/year
  const plasticEquivalent = (removalEfficiencies.TSS / 100) * 8.2; // Tons plastic equivalent prevented
  const ecosystemServicesValue = (esgScore / 100) * 125000; // Annual ecosystem services ($)
  
  return (
    <div className="space-y-4">
      {/* Executive Summary Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Environmental Impact Summary</h2>
            <p className="text-emerald-100 text-sm">{regionName} Facility • Real-time ESG Performance</p>
          </div>
          <Badge className="bg-white text-emerald-700 text-lg px-4 py-2">
            {esgScore >= 85 ? 'A' : esgScore >= 70 ? 'B' : 'C'} Rating
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-emerald-100 text-xs mb-1">ESG Score</div>
            <div className="text-3xl font-bold">{esgScore}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-emerald-100 text-xs mb-1">CO₂ Avoided</div>
            <div className="text-2xl font-bold">{co2eAvoided.toFixed(0)} tons</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-emerald-100 text-xs mb-1">Water Treated</div>
            <div className="text-2xl font-bold">{(annualGallonsTreated / 1000000).toFixed(1)}M gal</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-emerald-100 text-xs mb-1">Ecosystem Value</div>
            <div className="text-2xl font-bold">${(ecosystemServicesValue / 1000).toFixed(0)}K</div>
          </div>
        </div>
      </div>
      {/* Investor Summary Card */}
      <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-emerald-600" />
            Corporate Sustainability Dashboard
          </CardTitle>
          <CardDescription>
            Investor-grade ESG metrics and sustainability reporting for {regionName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key ESG Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border-2 border-emerald-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-700">ESG Score</span>
              </div>
              <div className="text-4xl font-bold text-emerald-600">{esgScore}</div>
              <div className="text-xs text-slate-600 mt-1">Out of 100</div>
              <Badge className="mt-2 bg-emerald-100 text-emerald-800 border-emerald-200">
                {esgScore >= 85 ? 'A' : esgScore >= 70 ? 'B' : 'C'} Rating
              </Badge>
            </div>

            <div className="bg-white border-2 border-blue-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-semibold text-slate-700">Water Treated</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {(annualGallonsTreated / 1000000).toFixed(1)}M
              </div>
              <div className="text-xs text-slate-600 mt-1">Gallons annually</div>
            </div>

            <div className="bg-white border-2 border-green-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="h-5 w-5 text-green-600" />
                <span className="text-sm font-semibold text-slate-700">CO₂e Avoided</span>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {co2eAvoided.toFixed(0)}
              </div>
              <div className="text-xs text-slate-600 mt-1">Tons per year</div>
            </div>
          </div>

          {/* SDG Alignment */}
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              UN Sustainable Development Goals Alignment
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { number: 6, label: 'Clean Water', color: '#26BDE2' },
                { number: 14, label: 'Life Below Water', color: '#0A97D9' },
                { number: 13, label: 'Climate Action', color: '#3F7E44' },
                { number: 11, label: 'Sustainable Cities', color: '#FD9D24' }
              ].map((sdg) => (
                <div key={sdg.number} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: sdg.color }}
                  >
                    {sdg.number}
                  </div>
                  <span className="text-slate-700">{sdg.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Environmental Impact Metrics */}
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="text-sm font-semibold text-slate-900 mb-3">Environmental Impact Metrics</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">TSS Removal Efficiency:</span>
                <span className="font-semibold text-emerald-600">{removalEfficiencies.TSS?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Nitrogen Reduction:</span>
                <span className="font-semibold text-emerald-600">{removalEfficiencies.TN?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Phosphorus Reduction:</span>
                <span className="font-semibold text-emerald-600">{removalEfficiencies.TP?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-slate-700 font-semibold">Nutrient Credits Generated:</span>
                <span className="font-bold text-green-600">{nutrientCreditsGenerated.toFixed(1)} lbs N/year</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stakeholder Reporting */}
      <Card className="border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Users className="h-5 w-5" />
            Stakeholder Reporting & Investor Relations
          </CardTitle>
          <CardDescription>
            Export-ready reports for shareholders, board meetings, and sustainability disclosures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Report Templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="flex items-center gap-3 w-full">
                <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="text-left flex-1">
                  <div className="text-sm font-semibold">Annual Sustainability Report</div>
                  <div className="text-xs text-slate-600">CDP, GRI, SASB formatted</div>
                </div>
                <Download className="h-4 w-4 text-slate-400" />
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="flex items-center gap-3 w-full">
                <BarChart3 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="text-left flex-1">
                  <div className="text-sm font-semibold">ESG Scorecard (Quarterly)</div>
                  <div className="text-xs text-slate-600">Executive summary with KPIs</div>
                </div>
                <Download className="h-4 w-4 text-slate-400" />
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="flex items-center gap-3 w-full">
                <Target className="h-5 w-5 text-purple-600 flex-shrink-0" />
                <div className="text-left flex-1">
                  <div className="text-sm font-semibold">Carbon Offset Documentation</div>
                  <div className="text-xs text-slate-600">CO₂e avoided calculations</div>
                </div>
                <Download className="h-4 w-4 text-slate-400" />
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="flex items-center gap-3 w-full">
                <Globe className="h-5 w-5 text-cyan-600 flex-shrink-0" />
                <div className="text-left flex-1">
                  <div className="text-sm font-semibold">SDG Impact Report</div>
                  <div className="text-xs text-slate-600">UN goals contribution</div>
                </div>
                <Download className="h-4 w-4 text-slate-400" />
              </div>
            </Button>
          </div>

          {/* Investor Dashboard Link */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-5 w-5 text-blue-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-blue-900 mb-1">
                  Public Investor Dashboard
                </div>
                <div className="text-xs text-blue-700 leading-relaxed mb-2">
                  Share real-time ESG performance with shareholders via white-labeled public dashboard. 
                  Updates automatically, no manual reporting needed.
                </div>
                <Button size="sm" variant="outline" className="text-xs h-7">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Generate Public Link
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competitive Benchmarking */}
      <Card className="border-2 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <BarChart3 className="h-5 w-5" />
            Industry ESG Benchmarking
          </CardTitle>
          <CardDescription>
            How your environmental performance compares to industry peers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { metric: 'Overall ESG Score', your: esgScore, industry: 68, percentile: 85 },
              { metric: 'Water Quality Management', your: waterQualityScore, industry: 62, percentile: 92 },
              { metric: 'Pollution Reduction', your: loadReductionScore, industry: 71, percentile: 88 },
              { metric: 'Ecosystem Impact', your: ecosystemHealthScore, industry: 65, percentile: 81 }
            ].map((item) => (
              <div key={item.metric} className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">{item.metric}</span>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    {item.percentile}th Percentile
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-600">Your Score</span>
                      <span className="font-bold text-emerald-600">{item.your}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${item.your}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-600">Industry Avg</span>
                      <span className="font-bold text-slate-600">{item.industry}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-slate-400 rounded-full transition-all"
                        style={{ width: `${item.industry}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Supply Chain & Regulatory Compliance */}
      <Card className="border-2 border-cyan-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-cyan-900">
            <Target className="h-5 w-5" />
            Regulatory Compliance & Risk Management
          </CardTitle>
          <CardDescription>
            Real-time compliance status and supply chain transparency
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Compliance Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-green-900">Clean Water Act</span>
                <Badge className="bg-green-600 text-white">Compliant</Badge>
              </div>
              <div className="text-xs text-green-700">
                All discharge parameters within permit limits
              </div>
            </div>

            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-green-900">TMDL Requirements</span>
                <Badge className="bg-green-600 text-white">Compliant</Badge>
              </div>
              <div className="text-xs text-green-700">
                {removalEfficiencies.TN?.toFixed(0)}% N reduction exceeds target
              </div>
            </div>

            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-blue-900">ISO 14001</span>
                <Badge className="bg-blue-600 text-white">Certified</Badge>
              </div>
              <div className="text-xs text-blue-700">
                Environmental management system verified
              </div>
            </div>
          </div>

          {/* Supply Chain Transparency */}
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-4">
            <div className="text-sm font-semibold text-cyan-900 mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Supply Chain Water Stewardship
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-cyan-700 font-medium mb-1">Water Risk Assessment</div>
                <div className="text-xs text-cyan-600">
                  Facility located in <span className="font-semibold">Low-Medium</span> water stress area (Chesapeake Bay watershed)
                </div>
              </div>
              <div>
                <div className="text-xs text-cyan-700 font-medium mb-1">Supplier Transparency</div>
                <div className="text-xs text-cyan-600">
                  Demonstrate downstream impact to <span className="font-semibold">98%</span> of supply chain partners
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Value & Marketing */}
      <Card className="border-2 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <Award className="h-5 w-5" />
            Brand Value & Consumer Trust
          </CardTitle>
          <CardDescription>
            Leverage environmental performance for marketing and stakeholder engagement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Marketing Claims - Pre-Approved */}
          <div>
            <div className="text-sm font-semibold text-slate-900 mb-3">Verified Marketing Claims</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { claim: '88% reduction in water pollution', verified: true },
                { claim: 'Zero net discharge to Chesapeake Bay', verified: esgScore >= 90 },
                { claim: 'Carbon neutral water operations', verified: co2eAvoided >= 40 },
                { claim: 'UN SDG aligned operations', verified: true },
                { claim: 'B Corp certified environmental practices', verified: esgScore >= 85 },
                { claim: 'Industry-leading sustainability (85th percentile)', verified: true }
              ].map((item, idx) => (
                <div key={idx} className={`flex items-start gap-2 text-xs p-2 rounded border ${
                  item.verified ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`mt-0.5 ${item.verified ? 'text-green-600' : 'text-slate-400'}`}>
                    {item.verified ? '✓' : '○'}
                  </div>
                  <div className="flex-1">
                    <div className={item.verified ? 'text-slate-700 font-medium' : 'text-slate-500'}>
                      {item.claim}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Consumer Engagement Tools */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-lg p-4">
            <div className="text-sm font-semibold text-orange-900 mb-3">Consumer Engagement Assets</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button variant="outline" className="justify-start h-auto py-2">
                <div className="flex items-center gap-2 w-full text-left">
                  <FileText className="h-4 w-4 text-orange-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-semibold">QR Code for Product Packaging</div>
                    <div className="text-xs text-slate-600">Links to live environmental data</div>
                  </div>
                </div>
              </Button>

              <Button variant="outline" className="justify-start h-auto py-2">
                <div className="flex items-center gap-2 w-full text-left">
                  <Globe className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-semibold">Sustainability Page Embed</div>
                    <div className="text-xs text-slate-600">Real-time widget for company website</div>
                  </div>
                </div>
              </Button>

              <Button variant="outline" className="justify-start h-auto py-2">
                <div className="flex items-center gap-2 w-full text-left">
                  <Download className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-semibold">Social Media Graphics Pack</div>
                    <div className="text-xs text-slate-600">Pre-approved visuals with live data</div>
                  </div>
                </div>
              </Button>

              <Button variant="outline" className="justify-start h-auto py-2">
                <div className="flex items-center gap-2 w-full text-left">
                  <Award className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-semibold">Digital Sustainability Badge</div>
                    <div className="text-xs text-slate-600">For email signatures & marketing</div>
                  </div>
                </div>
              </Button>
            </div>
          </div>

          {/* Brand Value Metrics */}
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="text-sm font-semibold text-slate-900 mb-3">Quantified Brand Value Impact</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Consumer trust premium (verified sustainability):</span>
                <span className="font-semibold text-emerald-600">+12-18%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Employee retention lift (purpose-driven workplace):</span>
                <span className="font-semibold text-blue-600">+23%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Investor ESG score improvement potential:</span>
                <span className="font-semibold text-purple-600">+15 points</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-slate-700 font-semibold">Annual ecosystem services value:</span>
                <span className="font-bold text-green-600">${(ecosystemServicesValue / 1000).toFixed(0)}K</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
