'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users, Info, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { WaterQualityParameter } from '@/lib/types';
import { getEJMetricsForLocation, assessEJImpact, EJMetrics } from '@/lib/ejImpact';

interface EnvironmentalJusticeImpactProps {
  regionId: string;
  regionName: string;
  parameters: WaterQualityParameter[];
}

export function EnvironmentalJusticeImpact({ regionId, regionName, parameters }: EnvironmentalJusticeImpactProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ejMetrics = getEJMetricsForLocation(regionName, regionId);

  if (!mounted) {
    return (
      <Card className="border-2 border-slate-300 bg-slate-50 animate-pulse">
        <CardHeader>
          <div className="h-6 bg-slate-300 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-slate-300 rounded w-1/2"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-20 bg-slate-300 rounded"></div>
            <div className="h-20 bg-slate-300 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!ejMetrics.isEJArea) {
    return (
      <Card className="border-2 border-slate-200 bg-slate-50">
        <CardContent className="pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-slate-400 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 mb-2">
                Environmental Justice Status
                <Info className="h-4 w-4 text-slate-600" />
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                This location is not currently designated as an EPA EJScreen overburdened community.
                Environmental justice considerations may still apply at the local level.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const assessments = parameters
    .map(param => ({
      param,
      assessment: assessEJImpact(param, ejMetrics)
    }))
    .filter(item => item.assessment !== null);

  const criticalAssessments = assessments.filter(a => a.assessment?.status === 'attention');
  const benefitAssessments = assessments.filter(a => a.assessment?.status === 'benefit');

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            Environmental Justice Impact
            <CardDescription className="text-xs mt-1">
              EPA EJScreen-designated overburdened community
            </CardDescription>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 p-4 bg-white/60 rounded-lg border border-blue-200">
          <div>
            <div className="text-xs text-blue-700 font-medium mb-1">Low Income</div>
            <div className="text-2xl font-bold text-blue-900">{ejMetrics.percentLowIncome}%</div>
          </div>
          <div>
            <div className="text-xs text-blue-700 font-medium mb-1">Minority</div>
            <div className="text-2xl font-bold text-blue-900">{ejMetrics.percentMinority}%</div>
          </div>
          <div>
            <div className="text-xs text-blue-700 font-medium mb-1">EJ Index</div>
            <div className="text-2xl font-bold text-blue-900">{ejMetrics.ejIndexScore}</div>
          </div>
        </div>

        {criticalAssessments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Areas Requiring Attention
            </h4>
            {criticalAssessments.map((item, idx) => (
              <Alert key={idx} className="border-2 border-orange-300 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-700" />
                <AlertTitle className="text-sm font-bold text-orange-900">
                  {item.param.name}
                  <Badge className="ml-2 bg-orange-600 text-white text-xs">
                    EJ Priority
                  </Badge>
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-xs text-orange-800 font-medium">
                    {item.assessment!.message}
                  </p>
                  {item.assessment!.recommendations && item.assessment!.recommendations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-orange-300">
                      <div className="text-xs font-semibold mb-1 text-orange-900">Recommended Actions:</div>
                      <ul className="space-y-0.5 text-xs text-orange-800">
                        {item.assessment!.recommendations.map((rec, recIdx) => (
                          <li key={recIdx} className="flex items-start gap-1.5">
                            <span className="mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {benefitAssessments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Positive EJ Outcomes
            </h4>
            {benefitAssessments.map((item, idx) => (
              <Alert key={idx} className="border-2 border-green-300 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-700" />
                <AlertTitle className="text-sm font-bold text-green-900">
                  {item.param.name}
                  <Badge className="ml-2 bg-green-600 text-white text-xs">
                    EJ Benefit
                  </Badge>
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-xs text-green-800 font-medium">
                    {item.assessment!.message}
                  </p>
                  {item.assessment!.recommendations && item.assessment!.recommendations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-green-300">
                      <div className="text-xs font-semibold mb-1 text-green-900">Recommended Actions:</div>
                      <ul className="space-y-0.5 text-xs text-green-800">
                        {item.assessment!.recommendations.map((rec, recIdx) => (
                          <li key={recIdx} className="flex items-start gap-1.5">
                            <span className="mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 p-3 bg-blue-100/50 rounded-lg border border-blue-200">
          <Info className="h-4 w-4 text-blue-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800 leading-relaxed">
            <span className="font-semibold">Data Source:</span> {ejMetrics.dataSource}.
            EJ indicators show potential benefits from pollutant reduction based on established thresholds.
            These assessments use conservative language ("may reduce risk," "supports EJ goals") and do not
            predict specific health outcomes. Prioritizing improvements in EJ-designated areas can help
            address disproportionate environmental burdens.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
