'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, Users, FileText, AlertTriangle, TrendingDown, TrendingUp,
  Clock, CheckCircle, XCircle, ArrowRight, Zap, Shield
} from 'lucide-react';

interface EconomicReplacementPanelProps {
  municipalitySize: 'small' | 'medium' | 'large';
  municipalityName?: string;
  stateAuthAbbr?: string;
}

export function EconomicReplacementPanel({ 
  municipalitySize, 
  municipalityName = 'Municipality',
  stateAuthAbbr = 'MDE'
}: EconomicReplacementPanelProps) {
  
  // Cost data based on municipality size
  const costs = {
    small: {
      pooledMonitoring: 60000,
      sampling: 75000,
      consultants: 30000,
      staffTime: 15000,
      pearlSubscription: 35000,
      sampleSets: 16,
      consultantHours: 120,
      staffHours: 96
    },
    medium: {
      pooledMonitoring: 95000,
      sampling: 110000,
      consultants: 38000,
      staffTime: 18000,
      pearlSubscription: 75000,
      sampleSets: 24,
      consultantHours: 180,
      staffHours: 144
    },
    large: {
      pooledMonitoring: 124000,
      sampling: 128000,
      consultants: 40500,
      staffTime: 20400,
      pearlSubscription: 150000,
      sampleSets: 32,
      consultantHours: 240,
      staffHours: 152
    }
  };

  const data = costs[municipalitySize];
  const currentTotal = data.pooledMonitoring + data.sampling + data.consultants + data.staffTime;
  const savings = currentTotal - data.pearlSubscription;
  const savingsPercent = Math.round((savings / currentTotal) * 100);

  return (
    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50" suppressHydrationWarning>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-900">
          <DollarSign className="h-6 w-6" />
          Economic Replacement Analysis: Current Process vs PEARL
        </CardTitle>
        <CardDescription>
          Direct comparison of {municipalityName}'s current MS4 compliance costs versus PEARL subscription model
          <span className="block mt-1 text-xs text-gray-600">
            Based on typical MS4 Phase I monitoring and reporting practices for a large jurisdiction
          </span>
          <span className="block mt-1 text-xs font-semibold text-blue-700">
            Example shown for a single major outfall or treatment zone. Portfolio-wide deployments scale these savings across jurisdictions.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        
        {/* Executive Summary Banner */}
        <div className="bg-green-600 text-white p-4 rounded-lg mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90">Annual Cost Reduction</div>
              <div className="text-3xl font-bold">${(savings / 1000).toFixed(0)}K/year</div>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-90">Savings Percentage</div>
              <div className="text-3xl font-bold">{savingsPercent}%</div>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-90">5-Year Savings</div>
              <div className="text-3xl font-bold">${(savings * 5 / 1000).toFixed(0)}K</div>
            </div>
          </div>
        </div>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          
          {/* CURRENT PROCESS */}
          <div className="border-2 border-red-200 rounded-lg p-4 bg-red-50">
            <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Current Process
            </h3>
            
            {/* Cost Breakdown */}
            <div className="space-y-3 mb-4">
              <div className="bg-white p-3 rounded border border-red-200">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm">Pooled Monitoring Payment</span>
                  <span className="font-bold text-red-700">${(data.pooledMonitoring / 1000).toFixed(0)}K</span>
                </div>
                <div className="text-xs text-gray-600">
                  Annual fee to Chesapeake Bay Trust or regional program
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-red-200">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm">Storm Event Sampling</span>
                  <span className="font-bold text-red-700">${(data.sampling / 1000).toFixed(0)}K</span>
                </div>
                <div className="text-xs text-gray-600">
                  {data.sampleSets} sample sets/year @ ~${(data.sampling / data.sampleSets / 1000).toFixed(1)}K each
                  <br />Mobilization + field + lab + QA/QC + reporting
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-red-200">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm">Consultant Reports</span>
                  <span className="font-bold text-red-700">${(data.consultants / 1000).toFixed(0)}K</span>
                </div>
                <div className="text-xs text-gray-600">
                  Annual permit report, quarterly BMP inspections, TMDL documentation
                  <br />~{data.consultantHours} consultant hours/year
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-red-200">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm">Staff Time</span>
                  <span className="font-bold text-red-700">${(data.staffTime / 1000).toFixed(0)}K</span>
                </div>
                <div className="text-xs text-gray-600">
                  Storm chasing, sample collection, coordination, data compilation
                  <br />~{data.staffHours} staff hours/year
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="bg-red-100 p-3 rounded border-2 border-red-300">
              <div className="flex justify-between items-center">
                <span className="font-bold text-red-900">TOTAL ANNUAL COST</span>
                <span className="text-2xl font-bold text-red-700">${(currentTotal / 1000).toFixed(0)}K</span>
              </div>
            </div>

            {/* What Doesn't Work */}
            <div className="mt-4 space-y-2">
              <h4 className="font-semibold text-sm text-red-900 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Key Problems:
              </h4>
              <ul className="space-y-1 text-xs text-red-800">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Delayed data:</strong> Results arrive weeks after sampling, too late for intervention</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Miss peak events:</strong> Grab sampling often misses storm peaks, underestimates loads</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Manual reporting:</strong> Staff spend weeks compiling data for annual reports</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>High cost:</strong> Multiple vendors (pooled monitoring + sampling + consultants)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Compliance risk:</strong> If you miss a required sample, you're non-compliant</span>
                </li>
              </ul>
            </div>
          </div>

          {/* PEARL PROCESS */}
          <div className="border-2 border-green-300 rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50">
            <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              PEARL Process
            </h3>

            {/* What PEARL Replaces */}
            <div className="space-y-3 mb-4">
              <div className="bg-white p-3 rounded border border-green-300">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm flex items-center gap-1">
                    Site-Specific Continuous Monitoring
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                      ✓ Included
                    </Badge>
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Dedicated monitoring at your outfalls provides better data than regional pooled programs. 
                  Reduces reliance on shared monitoring fee structures.
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-green-300">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm flex items-center gap-1">
                    Continuous Primary Data for Storm Events
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                      ✓ Included
                    </Badge>
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Real-time data every minute captures entire storm hydrograph. Reduces reliance on episodic grab sampling 
                  which often misses peak concentrations.
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-green-300">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm flex items-center gap-1">
                    Automated Report Generation
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                      ✓ Automated
                    </Badge>
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  {stateAuthAbbr}-formatted reports auto-generated from continuous data stream. Reduces consultant scope 
                  from full report writing to technical review and certification.
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-green-300">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm flex items-center gap-1">
                    Frees Staff Time
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                      ✓ Bonus
                    </Badge>
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  No storm chasing, no sample collection, no data compilation
                  <br />Staff focus on strategic work, not logistics
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="bg-green-100 p-3 rounded border-2 border-green-400">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-green-900">PEARL SUBSCRIPTION</span>
                <span className="text-2xl font-bold text-green-700">${(data.pearlSubscription / 1000).toFixed(0)}K</span>
              </div>
              <div className="text-xs text-green-700">
                All-inclusive: hardware deployment, continuous monitoring, automated reporting, maintenance
              </div>
            </div>

            {/* What You Get */}
            <div className="mt-4 space-y-2">
              <h4 className="font-semibold text-sm text-green-900 flex items-center gap-1">
                <Zap className="h-4 w-4" />
                What Becomes Automatic:
              </h4>
              <ul className="space-y-1 text-xs text-green-800">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Real-time alerts:</strong> Know about water quality issues immediately, not weeks later</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Complete storm capture:</strong> Continuous data catches peak concentrations traditional sampling misses</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>One-click reporting:</strong> {stateAuthAbbr} permit reports generated in 30 seconds</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Single vendor:</strong> One subscription replaces pooled monitoring + sampling + consultants</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Zero compliance risk:</strong> Continuous monitoring means you never "miss" a required sample</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Risk Mitigation Section */}
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-yellow-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Risk Removal: What PEARL Eliminates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-3 rounded border border-yellow-200">
              <div className="font-semibold text-sm text-yellow-900 mb-1">Missed Sample Risk</div>
              <div className="text-xs text-gray-700">
                If storm occurs when staff unavailable (night, weekend, holiday), you miss required sample.
                <span className="block mt-1 font-semibold text-yellow-800">PEARL never sleeps - continuous 24/7 monitoring</span>
              </div>
            </div>
            <div className="bg-white p-3 rounded border border-yellow-200">
              <div className="font-semibold text-sm text-yellow-900 mb-1">Lab Delay Risk</div>
              <div className="text-xs text-gray-700">
                Lab results take 1-3 weeks. By then, pollution event is over - can't intervene.
                <span className="block mt-1 font-semibold text-yellow-800">PEARL provides real-time data - act immediately</span>
              </div>
            </div>
            <div className="bg-white p-3 rounded border border-yellow-200">
              <div className="font-semibold text-sm text-yellow-900 mb-1">Budget Uncertainty Risk</div>
              <div className="text-xs text-gray-700">
                Sampling costs vary (storm frequency, lab fees). Hard to budget accurately.
                <span className="block mt-1 font-semibold text-yellow-800">PEARL fixed annual cost - predictable budgeting</span>
              </div>
            </div>
          </div>
        </div>

        {/* What Stays the Same - Regulatory Assurance */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            What Stays the Same: Your Responsibilities Don't Change
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded border border-blue-200">
              <div className="font-semibold text-sm text-blue-900 mb-1 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Permits
              </div>
              <div className="text-xs text-gray-700">
                MS4 permit requirements unchanged. PEARL changes <em>how</em> you collect data, not <em>what</em> you're responsible for.
              </div>
            </div>
            <div className="bg-white p-3 rounded border border-blue-200">
              <div className="font-semibold text-sm text-blue-900 mb-1 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Standards
              </div>
              <div className="text-xs text-gray-700">
                Water quality standards still apply. PEARL provides better data to demonstrate compliance with same thresholds.
              </div>
            </div>
            <div className="bg-white p-3 rounded border border-blue-200">
              <div className="font-semibold text-sm text-blue-900 mb-1 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Audits
              </div>
              <div className="text-xs text-gray-700">
                {stateAuthAbbr} can still audit at any time. PEARL makes audits easier (24/7 data access) not harder.
              </div>
            </div>
            <div className="bg-white p-3 rounded border border-blue-200">
              <div className="font-semibold text-sm text-blue-900 mb-1 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Liability
              </div>
              <div className="text-xs text-gray-700">
                Municipality remains responsible for stormwater compliance. PEARL is a monitoring tool, not a liability shield.
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Replacement Visual */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-2 border-slate-300 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-slate-900 mb-4 text-center">How Your Workflow Changes</h3>
          
          {/* Traditional Workflow */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Traditional Process (Manual, Delayed, Fragmented):
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <div className="bg-red-50 border-2 border-red-300 px-3 py-2 rounded text-xs whitespace-nowrap">
                ⛈ Storm Event
              </div>
              <ArrowRight className="h-4 w-4 text-red-400 flex-shrink-0" />
              <div className="bg-red-50 border-2 border-red-300 px-3 py-2 rounded text-xs whitespace-nowrap">
                📞 Staff Mobilization<br /><span className="text-red-600">(if available)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-red-400 flex-shrink-0" />
              <div className="bg-red-50 border-2 border-red-300 px-3 py-2 rounded text-xs whitespace-nowrap">
                🧪 Grab Samples<br /><span className="text-red-600">(may miss peak)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-red-400 flex-shrink-0" />
              <div className="bg-red-50 border-2 border-red-300 px-3 py-2 rounded text-xs whitespace-nowrap">
                🔬 Lab Analysis<br /><span className="text-red-600">(1-3 weeks)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-red-400 flex-shrink-0" />
              <div className="bg-red-50 border-2 border-red-300 px-3 py-2 rounded text-xs whitespace-nowrap">
                👔 Consultant Report<br /><span className="text-red-600">(weeks more)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-red-400 flex-shrink-0" />
              <div className="bg-red-50 border-2 border-red-300 px-3 py-2 rounded text-xs whitespace-nowrap">
                📄 {stateAuthAbbr} Submission<br /><span className="text-red-600">(months later)</span>
              </div>
            </div>
          </div>

          {/* PEARL Workflow */}
          <div>
            <div className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              PEARL Process (Automated, Real-Time, Integrated):
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <div className="bg-green-50 border-2 border-green-400 px-3 py-2 rounded text-xs whitespace-nowrap">
                ⛈ Storm Event
              </div>
              <ArrowRight className="h-4 w-4 text-green-500 flex-shrink-0" />
              <div className="bg-green-50 border-2 border-green-400 px-3 py-2 rounded text-xs whitespace-nowrap">
                🦪 PEARL Continuous<br /><span className="text-green-600">(captures everything)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-green-500 flex-shrink-0" />
              <div className="bg-green-50 border-2 border-green-400 px-3 py-2 rounded text-xs whitespace-nowrap">
                📊 Dashboard Update<br /><span className="text-green-600">(real-time)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-green-500 flex-shrink-0" />
              <div className="bg-green-50 border-2 border-green-400 px-3 py-2 rounded text-xs whitespace-nowrap">
                🤖 Auto-Report<br /><span className="text-green-600">(one click)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-green-500 flex-shrink-0" />
              <div className="bg-green-50 border-2 border-green-400 px-3 py-2 rounded text-xs whitespace-nowrap">
                📄 {stateAuthAbbr} Submission<br /><span className="text-green-600">(same day)</span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-center">
            <Badge className="bg-green-600 text-white text-xs">
              6 steps → 5 steps | Weeks → Hours | $4K per event → $0 marginal cost
            </Badge>
          </div>
        </div>

        {/* Bottom Line Summary */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Bottom Line for {municipalityName}</h3>
              <p className="text-sm opacity-90 mb-2">
                Replace ${(currentTotal / 1000).toFixed(0)}K/year in fragmented monitoring costs with 
                ${(data.pearlSubscription / 1000).toFixed(0)}K/year comprehensive subscription. 
                Save ${(savings / 1000).toFixed(0)}K annually while getting better data, 
                faster response, and zero compliance risk.
              </p>
              <p className="text-xs opacity-90 bg-green-700 bg-opacity-40 rounded px-3 py-2 inline-block">
                <strong>Procurement Advantage:</strong> PEARL can be procured as an annual operating expense (OpEx) subscription, 
                avoiding capital budget cycles and multi-year approval processes.
              </p>
            </div>
            <div className="ml-6 text-right">
              <div className="text-sm opacity-90">First Year ROI</div>
              <div className="text-4xl font-bold">{Math.round((savings / data.pearlSubscription) * 100)}%</div>
            </div>
          </div>
        </div>

        {/* Multi-Site Scaling Economics */}
        <div className="bg-gradient-to-r from-slate-100 to-gray-100 border-2 border-slate-300 rounded-lg p-5 mt-4">
          <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Multi-Site Scaling: Why PEARL Economics Get Better as You Expand
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Traditional Costs (Linear Scaling) */}
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-red-900 mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Traditional Monitoring Costs: Linear Scaling
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-red-200">
                  <span className="text-gray-700">Monitoring Zone</span>
                  <span className="font-semibold text-red-700">Annual Cost</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Site 1 (Middle Branch)</span>
                  <span className="font-semibold">${(currentTotal / 1000).toFixed(0)}K</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Site 2 (Fells Point)</span>
                  <span className="font-semibold">+$210K</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Site 3 (Canton)</span>
                  <span className="font-semibold">+$185K</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t-2 border-red-400">
                  <span className="font-bold text-red-900">3-Site Total</span>
                  <span className="font-bold text-lg text-red-700">$708K/year</span>
                </div>
              </div>
              <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-800">
                <strong>Problem:</strong> Each new monitoring zone adds ~$180-315K in annual costs. 
                Costs compound linearly. 10 zones = $2.5M+/year.
              </div>
            </div>

            {/* PEARL Costs (Flat Tier) */}
            <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-green-900 mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                PEARL Subscription: Jurisdiction-Wide Coverage
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-green-200">
                  <span className="text-gray-700">Coverage</span>
                  <span className="font-semibold text-green-700">Annual Cost</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">All Sites (Middle Branch)</span>
                  <span className="font-semibold">${(data.pearlSubscription / 1000).toFixed(0)}K</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">+ Fells Point added</span>
                  <span className="font-semibold text-green-600">$0 additional</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">+ Canton added</span>
                  <span className="font-semibold text-green-600">$0 additional</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t-2 border-green-500">
                  <span className="font-bold text-green-900">3-Site Total</span>
                  <span className="font-bold text-lg text-green-700">${(data.pearlSubscription / 1000).toFixed(0)}K/year</span>
                </div>
              </div>
              <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-800">
                <strong>Solution:</strong> One subscription covers entire MS4 jurisdiction. Add sites 
                within tier at no additional cost. Savings compound as you scale.
              </div>
            </div>
          </div>

          {/* Scaling Comparison Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-400">
                  <th className="text-left p-2 font-semibold">Deployment Scale</th>
                  <th className="text-right p-2 font-semibold bg-red-50">Traditional Annual Cost</th>
                  <th className="text-right p-2 font-semibold bg-green-50">PEARL Annual Cost</th>
                  <th className="text-right p-2 font-semibold bg-blue-50">Annual Savings</th>
                  <th className="text-right p-2 font-semibold bg-purple-50">Savings %</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                <tr className="border-b border-slate-200">
                  <td className="p-2">1 Site (Middle Branch only)</td>
                  <td className="p-2 text-right bg-red-50">${(currentTotal / 1000).toFixed(0)}K</td>
                  <td className="p-2 text-right bg-green-50">${(data.pearlSubscription / 1000).toFixed(0)}K</td>
                  <td className="p-2 text-right bg-blue-50 font-semibold">${(savings / 1000).toFixed(0)}K</td>
                  <td className="p-2 text-right bg-purple-50 font-semibold">52%</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2">3 Sites (Middle Branch + Fells + Canton)</td>
                  <td className="p-2 text-right bg-red-50">$708K</td>
                  <td className="p-2 text-right bg-green-50">${(data.pearlSubscription / 1000).toFixed(0)}K</td>
                  <td className="p-2 text-right bg-blue-50 font-semibold">$558K</td>
                  <td className="p-2 text-right bg-purple-50 font-semibold">79%</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2">5 Sites (Harbor-wide deployment)</td>
                  <td className="p-2 text-right bg-red-50">$1,180K</td>
                  <td className="p-2 text-right bg-green-50">${(data.pearlSubscription / 1000).toFixed(0)}K</td>
                  <td className="p-2 text-right bg-blue-50 font-semibold">$1,030K</td>
                  <td className="p-2 text-right bg-purple-50 font-semibold">87%</td>
                </tr>
                <tr className="bg-slate-100 font-semibold">
                  <td className="p-2">10 Sites (Jurisdiction-wide)</td>
                  <td className="p-2 text-right bg-red-100">$2,360K</td>
                  <td className="p-2 text-right bg-green-100">${(data.pearlSubscription / 1000).toFixed(0)}K</td>
                  <td className="p-2 text-right bg-blue-100 font-bold text-blue-900">$2,210K</td>
                  <td className="p-2 text-right bg-purple-100 font-bold text-purple-900">94%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-blue-600 text-white p-4 rounded-lg">
            <p className="text-sm font-semibold mb-2">
              The More You Monitor, The More You Save
            </p>
            <p className="text-xs opacity-90">
              Traditional monitoring costs scale <strong>linearly</strong> (~$236K per additional site). 
              PEARL costs stay <strong>flat within tier</strong>. At 10 sites, you're saving <strong>$2.2M annually (94%)</strong> 
              while getting exponentially better data coverage. This is why jurisdictions that start with one pilot site 
              rapidly expand - the economics get better with every deployment.
            </p>
          </div>
        </div>

        {/* Critical Assumption Disclaimer */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-xs text-blue-900">
            <strong>⚠️ Critical Assumption:</strong> Cost savings realized as {stateAuthAbbr} accepts PEARL{"'"}s continuous 
            monitoring data for MS4 permit compliance. Phased adoption over 2-3 years as regulatory confidence 
            builds. Some periodic confirmatory sampling may remain for sensor validation. Hardware deployment 
            costs covered in subscription. Does not include capital restoration costs (largest MS4 budget item).
          </p>
        </div>

      </CardContent>
    </Card>
  );
}
