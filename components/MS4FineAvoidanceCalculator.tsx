'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle, CheckCircle, DollarSign, TrendingDown, FileText } from 'lucide-react';
import { WaterQualityData } from '@/lib/types';

interface MS4FineAvoidanceProps {
  data: WaterQualityData;
  removalEfficiencies: Record<string, number>;
  regionId: string;
  stormEventsMonitored: number;
}

// Maryland/EPA MS4 fine schedule (per violation per day)
const FINE_SCHEDULE = {
  tss_exceedance:       { label: 'TSS Permit Exceedance',        dailyFine: 10000, maxPerViolation: 37500  },
  nutrient_exceedance:  { label: 'Nutrient Load Exceedance',     dailyFine: 16000, maxPerViolation: 60000  },
  reporting_failure:    { label: 'Missing Annual Report',        dailyFine: 5000,  maxPerViolation: 25000  },
  bmp_failure:          { label: 'BMP Performance Failure',      dailyFine: 7500,  maxPerViolation: 37500  },
  chronic_violation:    { label: 'Chronic/Willful Violation',    dailyFine: 37500, maxPerViolation: 250000 },
};

// EPA Clean Water Act Section 309 civil penalty baseline
const CWA_BASE_PENALTY = 25964; // per day per violation (2024 adjusted)

function getComplianceRisk(removalEfficiencies: Record<string, number>, data: WaterQualityData) {
  const risks: { param: string; risk: 'low' | 'medium' | 'high'; message: string }[] = [];

  if (removalEfficiencies.TSS < 80) {
    risks.push({ param: 'TSS', risk: 'high', message: `${removalEfficiencies.TSS.toFixed(0)}% removal — below 80% MS4 target` });
  } else if (removalEfficiencies.TSS < 90) {
    risks.push({ param: 'TSS', risk: 'medium', message: `${removalEfficiencies.TSS.toFixed(0)}% removal — approaching limit` });
  }

  if (removalEfficiencies.TN < 60) {
    risks.push({ param: 'Total Nitrogen', risk: 'high', message: `${removalEfficiencies.TN.toFixed(0)}% removal — TMDL non-compliant` });
  }

  if (removalEfficiencies.TP < 60) {
    risks.push({ param: 'Total Phosphorus', risk: 'high', message: `${removalEfficiencies.TP.toFixed(0)}% removal — TMDL non-compliant` });
  }

  if (data.parameters.DO.value < 5) {
    risks.push({ param: 'Dissolved Oxygen', risk: 'high', message: `${data.parameters.DO.value.toFixed(1)} mg/L — below aquatic life threshold` });
  }

  return risks;
}

export function MS4FineAvoidanceCalculator({ data, removalEfficiencies, regionId, stormEventsMonitored }: MS4FineAvoidanceProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const PILOT_START = new Date('2025-01-09');
  const daysCompliant = Math.floor((Date.now() - PILOT_START.getTime()) / (1000 * 60 * 60 * 24));

  const risks = useMemo(() => getComplianceRisk(removalEfficiencies, data), [removalEfficiencies, data]);
  const highRiskCount = risks.filter(r => r.risk === 'high').length;

  // Calculate fines avoided based on compliance days
  // Without PEARL: assume 3 exceedance events per year (typical non-monitored MS4)
  const annualExceedancesWithoutPearl = 3;
  const daysPerExceedance = 14; // average duration before detection and correction

  const tssFineSaved = annualExceedancesWithoutPearl * daysPerExceedance * FINE_SCHEDULE.tss_exceedance.dailyFine * (daysCompliant / 365);
  const nutrientFineSaved = annualExceedancesWithoutPearl * daysPerExceedance * FINE_SCHEDULE.nutrient_exceedance.dailyFine * (daysCompliant / 365);
  const reportingFineSaved = FINE_SCHEDULE.reporting_failure.maxPerViolation; // 1 report automated
  const bmpFineSaved = 2 * daysPerExceedance * FINE_SCHEDULE.bmp_failure.dailyFine * (daysCompliant / 365);

  const totalFinesSaved = tssFineSaved + nutrientFineSaved + reportingFineSaved + bmpFineSaved;

  // CWA max exposure without PEARL
  const cwaPotentialExposure = 5 * CWA_BASE_PENALTY * daysPerExceedance; // 5 violations

  // Compliance score 0-100
  const baseScore = 100 - (highRiskCount * 25) - (risks.filter(r => r.risk === 'medium').length * 10);
  const complianceScore = Math.max(0, Math.min(100, baseScore));

  const scoreColor = complianceScore >= 85 ? 'text-green-600' : complianceScore >= 65 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = complianceScore >= 85 ? 'bg-green-50 border-green-300' : complianceScore >= 65 ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-300';
  const scoreLabel = complianceScore >= 85 ? 'COMPLIANT' : complianceScore >= 65 ? 'AT RISK' : 'NON-COMPLIANT';
  const ScoreIcon = complianceScore >= 85 ? CheckCircle : AlertTriangle;

  return (
    <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-green-50 shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-xl flex items-center gap-2 text-emerald-900">
              <Shield className="h-6 w-6 text-emerald-600" />
              MS4 Compliance & Fine Avoidance
            </CardTitle>
            <CardDescription>
              Regulatory risk analysis and estimated penalty exposure avoided · {daysCompliant} days monitored
            </CardDescription>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${scoreBg}`}>
            <ScoreIcon className={`h-4 w-4 ${scoreColor}`} />
            <span className={`text-sm font-bold ${scoreColor}`}>{scoreLabel}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Headline numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center">
            <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <div className="text-3xl font-black text-green-700">
              ${(totalFinesSaved / 1000).toFixed(0)}K
            </div>
            <div className="text-xs font-semibold text-green-600 mt-1">Fines Avoided</div>
            <div className="text-xs text-green-500">since Jan 2025</div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 text-center">
            <TrendingDown className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <div className="text-3xl font-black text-blue-700">
              ${(cwaPotentialExposure / 1000).toFixed(0)}K
            </div>
            <div className="text-xs font-semibold text-blue-600 mt-1">Max CWA Exposure</div>
            <div className="text-xs text-blue-500">avoided per event cluster</div>
          </div>

          <div className={`${scoreBg} border-2 rounded-xl p-4 text-center`}>
            <ScoreIcon className={`h-6 w-6 ${scoreColor} mx-auto mb-1`} />
            <div className={`text-3xl font-black ${scoreColor}`}>{complianceScore}</div>
            <div className={`text-xs font-semibold ${scoreColor} mt-1`}>Compliance Score</div>
            <div className="text-xs text-slate-500">out of 100</div>
          </div>
        </div>

        {/* Compliance score bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-slate-600">
            <span>Permit Compliance Status</span>
            <span>{complianceScore}/100</span>
          </div>
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                complianceScore >= 85 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                complianceScore >= 65 ? 'bg-gradient-to-r from-amber-400 to-yellow-500' :
                'bg-gradient-to-r from-red-400 to-rose-500'
              }`}
              style={{ width: `${complianceScore}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Non-Compliant</span>
            <span>At Risk</span>
            <span>Compliant</span>
            <span>Excellent</span>
          </div>
        </div>

        {/* Risk flags */}
        {risks.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Active Risk Flags</div>
            {risks.map((r, i) => (
              <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border ${
                r.risk === 'high' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
              }`}>
                <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${r.risk === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                <div>
                  <span className={`text-xs font-bold ${r.risk === 'high' ? 'text-red-700' : 'text-amber-700'}`}>{r.param}: </span>
                  <span className="text-xs text-slate-600">{r.message}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-700 font-medium">All parameters within permit limits — no active violations detected</span>
          </div>
        )}

        {/* Fine breakdown toggle */}
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="flex items-center gap-2 text-xs text-emerald-700 font-semibold hover:text-emerald-900 transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          {showBreakdown ? 'Hide' : 'Show'} fine avoidance breakdown
        </button>

        {showBreakdown && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Estimated Fines Avoided (Pro-rated {daysCompliant} days)</div>
            {[
              { label: 'TSS exceedance penalties', value: tssFineSaved },
              { label: 'Nutrient load penalties', value: nutrientFineSaved },
              { label: 'Automated annual report filing', value: reportingFineSaved },
              { label: 'BMP failure citations', value: bmpFineSaved },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold text-green-700">${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold">
              <span>Total avoided</span>
              <span className="text-green-700">${totalFinesSaved.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
            <p className="text-xs text-slate-400 pt-2">
              Based on EPA CWA §309 civil penalty schedule (2024 inflation-adjusted). Assumes 3 undetected exceedance events/year without continuous monitoring, 14-day average detection lag. Actual penalties depend on violation history, good faith effort, and judicial discretion.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
