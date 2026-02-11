'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Clock, TrendingUp, Users } from 'lucide-react';

interface ROISavingsCalculatorProps {
  stormEventsMonitored: number;
  regionId: string;
}

export function ROISavingsCalculator({ stormEventsMonitored, regionId }: ROISavingsCalculatorProps) {
  const manualSamplingCostPerEvent = 850;
  const labAnalysisCostPerEvent = 1200;
  const staffHoursPerEvent = 8;
  const hourlyStaffRate = 75;

  const annualReportingHours = 40;
  const traditionalReportingCost = 3500;

  const monthsActive = 1.33;
  const annualStormEvents = Math.round((stormEventsMonitored / monthsActive) * 12);

  const manualSamplingSavings = annualStormEvents * manualSamplingCostPerEvent;
  const labAnalysisSavings = annualStormEvents * labAnalysisCostPerEvent;
  const staffTimeSavings = annualStormEvents * staffHoursPerEvent;
  const reportingSavings = traditionalReportingCost;

  const totalAnnualSavings = manualSamplingSavings + labAnalysisSavings + (staffTimeSavings * hourlyStaffRate) + reportingSavings;
  const totalStaffHoursSaved = staffTimeSavings + annualReportingHours;

  const pearlSystemCost = 25000;
  const annualMaintenanceCost = 3500;
  const netSavingsFirstYear = totalAnnualSavings - pearlSystemCost - annualMaintenanceCost;
  const paybackPeriod = pearlSystemCost / (totalAnnualSavings - annualMaintenanceCost);

  return (
    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-900">
          <DollarSign className="h-6 w-6" />
          ROI Savings Calculator
        </CardTitle>
        <CardDescription>
          Estimated cost and time savings from Pearl automated monitoring vs. traditional manual sampling
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
              equivalent to 3 weeks of work
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border-2 border-purple-300">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-semibold text-slate-700">Payback Period</span>
            </div>
            <div className="text-3xl font-bold text-purple-600">
              {paybackPeriod.toFixed(1)} yrs
            </div>
            <div className="text-xs text-slate-600 mt-1">
              system fully pays for itself
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border-2 border-teal-300">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-teal-600" />
              <span className="text-sm font-semibold text-slate-700">Net First Year</span>
            </div>
            <div className="text-3xl font-bold text-teal-600">
              ${netSavingsFirstYear >= 0 ? '+' : ''}{(netSavingsFirstYear / 1000).toFixed(1)}K
            </div>
            <div className="text-xs text-slate-600 mt-1">
              after system & maintenance costs
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-900 mb-3">Savings Breakdown (Annual)</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Manual sampling eliminated:</span>
              <span className="font-semibold text-green-600">${(manualSamplingSavings / 1000).toFixed(1)}K</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Lab analysis costs avoided:</span>
              <span className="font-semibold text-green-600">${(labAnalysisSavings / 1000).toFixed(1)}K</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Staff time savings ({staffTimeSavings} hrs):</span>
              <span className="font-semibold text-green-600">${((staffTimeSavings * hourlyStaffRate) / 1000).toFixed(1)}K</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Automated reporting:</span>
              <span className="font-semibold text-green-600">${(reportingSavings / 1000).toFixed(1)}K</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="text-slate-900 font-bold">Total Annual Savings:</span>
              <span className="font-bold text-green-600">${(totalAnnualSavings / 1000).toFixed(1)}K</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Annual maintenance cost:</span>
              <span>-${(annualMaintenanceCost / 1000).toFixed(1)}K</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 pt-2 border-t">
          Calculations based on {annualStormEvents} projected annual storm events, avoiding manual grab sampling,
          lab turnaround delays, and manual data compilation. Additional benefits: real-time alerts,
          continuous monitoring, and regulatory compliance documentation.
        </p>
      </CardContent>
    </Card>
  );
}
