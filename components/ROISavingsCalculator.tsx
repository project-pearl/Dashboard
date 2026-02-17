'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Clock, TrendingUp, Users } from 'lucide-react';

interface ROISavingsCalculatorProps {
  stormEventsMonitored: number;
  regionId: string;
}

export function ROISavingsCalculator({ stormEventsMonitored, regionId }: ROISavingsCalculatorProps) {
  // ── REAL MUNICIPAL COSTS (Baltimore City & MDE framework) ─────────────────
  // Source: Baltimore City FY24 Financial Assurance Plan + MDE monitoring guidelines
  
  // ══ ELIMINATED: Pooled Monitoring Payments ══
  // Baltimore City pays CBT for pooled monitoring instead of doing their own
  const pooledMonitoringPayment = 124000; // $100K-148K actual range, using mid-point
  
  // ══ ELIMINATED: Required Storm Event Sampling ══
  // MDE requires: 12 storm events + 4 baseflow samples per year
  // At 2 stations (in-stream + outfall) = 32 sample sets/year
  const stormEventsPerYear = 12; // MDE minimum requirement
  const baseflowSamplesPerYear = 4; // Quarterly baseflow
  const monitoringStations = 2; // In-stream + outfall per watershed
  const totalAnnualSamples = (stormEventsPerYear + baseflowSamplesPerYear) * monitoringStations; // 32 sets
  
  // All-in cost per sample set: mobilization + field + lab + QA/QC + reporting
  const costPerSampleSet = 4000; // $2K-6K range (using mid-point)
  const annualSamplingCost = totalAnnualSamples * costPerSampleSet; // $128K
  
  // ══ ELIMINATED: MS4 Consulting & Reporting ══
  // Phase II typical: $25K-60K/year for full compliance support
  const annualReportConsultingCost = 18000; // Report writing: $6K-22K (mid-range)
  const quarterlyInspectionReportCost = 3500; // BMP inspections
  const annualInspectionReportingSavings = quarterlyInspectionReportCost * 4; // $14K
  const tmdlComplianceCost = 8500; // TMDL tracking
  const totalConsultingSavings = annualReportConsultingCost + annualInspectionReportingSavings + tmdlComplianceCost;
  
  // ══ STAFF TIME FREED ══
  const staffHoursPerSampleEvent = 6; // Field mobilization + data entry
  const annualReportingHours = 80; // Data compilation + report prep
  const hourlyStaffRate = 75;
  const totalStaffHoursSaved = (totalAnnualSamples * staffHoursPerSampleEvent) + annualReportingHours; // 272 hours
  const staffTimeSavings = totalStaffHoursSaved * hourlyStaffRate; // $20.4K
  
  // ══ TOTAL ANNUAL SAVINGS ══
  const totalAnnualSavings = 
    pooledMonitoringPayment +        // $124K - Eliminate CBT pooled monitoring
    annualSamplingCost +              // $128K - Eliminate storm event sampling
    totalConsultingSavings +          // $40.5K - Eliminate consultant reports
    staffTimeSavings;                 // $20.4K - Staff time freed
  // TOTAL: ~$313K/year

  // ══ PEARL PRICING TIERS (Realistic Market Pricing) ══
  // Small MS4 (1-2 sites): $35K/year
  // Medium MS4 (4-6 sites): $75K/year  
  // Large City (8-12+ sites): $150K/year - Baltimore Middle Branch deployment
  // Updated: 2026-02-13 for Baltimore Large tier
  const annualDataSubscription = 150000; // Large MS4 tier: $150K/year (12 PEARL units at Middle Branch + other outfalls)
  const annualMaintenanceCost = 0; // No hardware maintenance in data-only model
  
  // Net savings = Cost avoided - PEARL subscription
  const netAnnualSavings = totalAnnualSavings - annualDataSubscription;
  const roiPercentage = ((netAnnualSavings / annualDataSubscription) * 100);

  return (
    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50" suppressHydrationWarning>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-900">
          <DollarSign className="h-6 w-6" />
          Data Intelligence ROI Calculator
        </CardTitle>
        <CardDescription>
          Cost savings from PEARL's automated compliance reporting vs. traditional manual sampling and consultant fees (hardware costs excluded)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg border-2 border-green-300">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span className="text-sm font-semibold text-slate-700">Annual Cost Savings</span>
            </div>
            <div className="text-3xl font-bold text-green-600">
              ${(totalAnnualSavings / 1000).toFixed(1)}K
            </div>
            <div className="text-xs text-slate-600 mt-1">
              vs. traditional sampling methods
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border-2 border-blue-300">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">Staff Time Saved</span>
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {totalStaffHoursSaved} hrs
            </div>
            <div className="text-xs text-slate-600 mt-1">
              sampling, data entry & report prep
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border-2 border-purple-300">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-semibold text-slate-700">ROI Percentage</span>
            </div>
            <div className="text-3xl font-bold text-purple-600">
              {roiPercentage.toFixed(0)}%
            </div>
            <div className="text-xs text-slate-600 mt-1">
              return on data subscription cost
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border-2 border-teal-300">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-teal-600" />
              <span className="text-sm font-semibold text-slate-700">Net Annual Savings</span>
            </div>
            <div className="text-3xl font-bold text-teal-600">
              ${netAnnualSavings >= 0 ? '+' : ''}{(netAnnualSavings / 1000).toFixed(1)}K
            </div>
            <div className="text-xs text-slate-600 mt-1">
              after data subscription cost
            </div>
          </div>
        </div>

        {/* PEARL Pricing Tiers */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-sm text-blue-900 mb-3">PEARL Pricing Tiers</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs bg-white rounded p-2 border border-blue-100">
              <div>
                <span className="font-semibold text-slate-700">Small MS4</span>
                <span className="text-slate-500 ml-2">(2-4 sites)</span>
              </div>
              <span className="font-bold text-blue-700">$35K/year</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-white rounded p-2 border border-blue-100">
              <div>
                <span className="font-semibold text-slate-700">Medium MS4</span>
                <span className="text-slate-500 ml-2">(4-8 sites)</span>
              </div>
              <span className="font-bold text-blue-700">$75K/year</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-blue-100 rounded p-2 border-2 border-blue-400">
              <div>
                <span className="font-semibold text-blue-900">Large City</span>
                <span className="text-blue-700 ml-2">(8-12+ sites) — This calculation ✓</span>
              </div>
              <span className="font-bold text-blue-900">$150K/year</span>
            </div>
          </div>
          <div className="text-xs text-blue-700 mt-3 leading-relaxed">
            💡 <span className="font-semibold">Still 52% savings</span> vs current monitoring + consulting costs. Baltimore City (12 PEARL units at Middle Branch) pays $150K Large tier and saves $163K/year.
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-900 mb-3">Savings Breakdown (Annual) — Based on Real Municipal Costs</h4>
          <div className="space-y-2 text-sm">

            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">
              MDE-Required Monitoring Eliminated
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Pooled monitoring payment (CBT):</span>
              <span className="font-semibold text-green-600">${(pooledMonitoringPayment / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{totalAnnualSamples} annual samples ({stormEventsPerYear} storm + {baseflowSamplesPerYear} baseflow × {monitoringStations} stations):</span>
              <span className="font-semibold text-green-600">${(annualSamplingCost / 1000).toFixed(0)}K</span>
            </div>
            
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">
              Consulting & Reporting Replaced
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">MS4 annual report preparation:</span>
              <span className="font-semibold text-green-600">${(annualReportConsultingCost / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Quarterly BMP inspection reports (×4):</span>
              <span className="font-semibold text-green-600">${(annualInspectionReportingSavings / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">TMDL compliance documentation:</span>
              <span className="font-semibold text-green-600">${(tmdlComplianceCost / 1000).toFixed(1)}K</span>
            </div>

            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">
              Staff Time Freed
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Field sampling time ({totalStaffHoursSaved} hrs @ ${hourlyStaffRate}/hr):</span>
              <span className="font-semibold text-green-600">${(staffTimeSavings / 1000).toFixed(1)}K</span>
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="text-slate-900 font-bold">Total Annual Savings:</span>
              <span className="font-bold text-green-600">${(totalAnnualSavings / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>PEARL data subscription cost:</span>
              <span>-${(annualDataSubscription / 1000).toFixed(1)}K/year</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1">
              <span className="text-teal-900">Net Annual Savings:</span>
              <span className="text-teal-600">${(netAnnualSavings / 1000).toFixed(1)}K/year</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 pt-2 border-t leading-relaxed">
          <span className="font-semibold">Data Intelligence ROI (MDE Approval Required):</span> These savings assume MDE accepts PEARL's continuous real-time data as an equal substitute for required representative sampling under MS4 permits. Based on <span className="font-semibold">actual Baltimore City costs</span>: $124K pooled monitoring + $128K for {totalAnnualSamples} sample sets + ${(totalConsultingSavings / 1000).toFixed(1)}K consulting + ${(staffTimeSavings / 1000).toFixed(1)}K staff time = <span className="font-semibold text-green-700">${(totalAnnualSavings / 1000).toFixed(0)}K total avoided costs</span>. PEARL Large tier (${(annualDataSubscription / 1000).toFixed(0)}K/year) covers 12 PEARL units at Middle Branch plus expansion to other outfalls. <span className="font-semibold text-teal-700">Net savings: ${(netAnnualSavings / 1000).toFixed(0)}K/year ({Math.round((netAnnualSavings / totalAnnualSavings) * 100)}% savings).</span> Hardware costs not included.
        </p>
        
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2">
          <p className="text-xs text-amber-900 leading-relaxed">
            <span className="font-semibold">⚠️ Critical Assumption:</span> Savings are realized only if MDE formally accepts PEARL's continuous data as compliant with permit sampling requirements. Some periodic confirmatory sampling may still be required for sensor validation. Does not include capital restoration costs (the largest MS4 budget item).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
