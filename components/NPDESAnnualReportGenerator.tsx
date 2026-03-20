'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Download, Calendar, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Minus, ExternalLink, Settings,
  Building2, Droplets, Scale, BarChart3
} from 'lucide-react';
import { getIcisAllData, type IcisPermit, type IcisViolation, type IcisDmr, type IcisEnforcement, type IcisInspection } from '@/lib/icisCache';
import { type CacheDelta } from '@/lib/cacheUtils';

interface NPDESAnnualReport {
  reportingPeriod: string;
  generatedAt: string;
  permitsSummary: {
    totalPermits: number;
    activePermits: number;
    expiredPermits: number;
    renewalsPending: number;
  };
  complianceSummary: {
    totalViolations: number;
    significantViolations: number;
    reportableViolations: number;
    complianceRate: number;
  };
  dmrSummary: {
    totalReports: number;
    lateReports: number;
    parameterExceedances: number;
    averageCompliance: number;
  };
  enforcementActions: {
    totalActions: number;
    civilPenalties: number;
    administrativeOrders: number;
    totalPenaltiesAssessed: number;
  };
  inspectionActivity: {
    totalInspections: number;
    complianceInspections: number;
    investigativeSampling: number;
    followupInspections: number;
  };
}

interface ReportPreferences {
  reportingYear: string;
  includeStateBreakdown: boolean;
  includeTrendAnalysis: boolean;
  includeEJConsiderations: boolean;
  format: 'pdf' | 'xlsx' | 'docx';
}

const DEFAULT_PREFERENCES: ReportPreferences = {
  reportingYear: new Date().getFullYear().toString(),
  includeStateBreakdown: true,
  includeTrendAnalysis: true,
  includeEJConsiderations: true,
  format: 'pdf',
};

export function NPDESAnnualReportGenerator() {
  const [preferences, setPreferences] = useState<ReportPreferences>(DEFAULT_PREFERENCES);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<NPDESAnnualReport | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Get ICIS data for report generation
  const icisData = useMemo(() => {
    try {
      return getIcisAllData();
    } catch {
      return { permits: [], violations: [], dmr: [], enforcement: [], inspections: [] };
    }
  }, []);

  // Generate report data
  const generateReportData = useMemo((): NPDESAnnualReport => {
    const reportingYear = parseInt(preferences.reportingYear);
    const startDate = new Date(reportingYear, 0, 1);
    const endDate = new Date(reportingYear, 11, 31);

    // Filter data by reporting year
    const yearViolations = icisData.violations.filter(v => {
      const violationDate = new Date(v.date);
      return violationDate >= startDate && violationDate <= endDate;
    });

    const yearEnforcement = icisData.enforcement.filter(e => {
      const settlementDate = new Date(e.settlementDate);
      return settlementDate >= startDate && settlementDate <= endDate;
    });

    const yearInspections = icisData.inspections.filter(i => {
      const inspectionDate = new Date(i.date);
      return inspectionDate >= startDate && inspectionDate <= endDate;
    });

    const yearDmr = icisData.dmr.filter(d => {
      const periodDate = new Date(d.period);
      return periodDate >= startDate && periodDate <= endDate;
    });

    return {
      reportingPeriod: `Calendar Year ${reportingYear}`,
      generatedAt: new Date().toISOString(),
      permitsSummary: {
        totalPermits: icisData.permits.length,
        activePermits: icisData.permits.filter(p => p.status === 'Effective').length,
        expiredPermits: icisData.permits.filter(p => p.status === 'Expired').length,
        renewalsPending: icisData.permits.filter(p => {
          const expDate = new Date(p.expiration);
          const today = new Date();
          const daysToExpiration = Math.floor((expDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
          return daysToExpiration <= 180 && daysToExpiration > 0;
        }).length,
      },
      complianceSummary: {
        totalViolations: yearViolations.length,
        significantViolations: yearViolations.filter(v => v.severity?.toLowerCase().includes('significant')).length,
        reportableViolations: yearViolations.filter(v => v.rnc).length,
        complianceRate: Math.max(0, 100 - (yearViolations.length / Math.max(1, icisData.permits.length)) * 100),
      },
      dmrSummary: {
        totalReports: yearDmr.length,
        lateReports: 0, // Would need submission date vs due date logic
        parameterExceedances: yearDmr.filter(d => d.exceedance).length,
        averageCompliance: yearDmr.length > 0
          ? (yearDmr.filter(d => !d.exceedance).length / yearDmr.length) * 100
          : 100,
      },
      enforcementActions: {
        totalActions: yearEnforcement.length,
        civilPenalties: yearEnforcement.filter(e => e.penaltyAssessed > 0).length,
        administrativeOrders: yearEnforcement.filter(e => e.actionType?.toLowerCase().includes('order')).length,
        totalPenaltiesAssessed: yearEnforcement.reduce((sum, e) => sum + e.penaltyAssessed, 0),
      },
      inspectionActivity: {
        totalInspections: yearInspections.length,
        complianceInspections: yearInspections.filter(i => i.type?.toLowerCase().includes('compliance')).length,
        investigativeSampling: yearInspections.filter(i => i.type?.toLowerCase().includes('sampling')).length,
        followupInspections: yearInspections.filter(i => i.type?.toLowerCase().includes('follow')).length,
      },
    };
  }, [icisData, preferences.reportingYear]);

  useEffect(() => {
    setReportData(generateReportData);
  }, [generateReportData]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);

    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // In a real implementation, this would:
    // 1. Aggregate all ICIS data by reporting year
    // 2. Generate charts and tables
    // 3. Apply formatting based on EPA templates
    // 4. Include state-specific sections if requested
    // 5. Generate the final document in requested format

    setIsGenerating(false);
    setShowPreview(true);
  };

  const handleDownloadReport = () => {
    // In a real implementation, this would trigger file download
    const filename = `NPDES_Annual_Report_${preferences.reportingYear}.${preferences.format}`;
    alert(`Report "${filename}" would be downloaded here`);
  };

  if (!reportData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            NPDES Annual Report Generator
          </CardTitle>
          <CardDescription>
            Loading ICIS data for report generation...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            NPDES Annual Report Generator
          </CardTitle>
          <CardDescription>
            Generate comprehensive annual NPDES compliance reports from ICIS data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Reporting Year</label>
              <select
                value={preferences.reportingYear}
                onChange={(e) => setPreferences({...preferences, reportingYear: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year.toString()}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Output Format</label>
              <select
                value={preferences.format}
                onChange={(e) => setPreferences({...preferences, format: e.target.value as 'pdf' | 'xlsx' | 'docx'})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="pdf">PDF Report</option>
                <option value="xlsx">Excel Workbook</option>
                <option value="docx">Word Document</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="state-breakdown"
                checked={preferences.includeStateBreakdown}
                onChange={(e) => setPreferences({...preferences, includeStateBreakdown: e.target.checked})}
              />
              <label htmlFor="state-breakdown" className="text-sm">State Breakdown</label>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="trend-analysis"
                checked={preferences.includeTrendAnalysis}
                onChange={(e) => setPreferences({...preferences, includeTrendAnalysis: e.target.checked})}
              />
              <label htmlFor="trend-analysis" className="text-sm">Trend Analysis</label>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleGenerateReport} disabled={isGenerating} className="flex items-center gap-2">
              {isGenerating ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </Button>

            {showPreview && (
              <Button variant="outline" onClick={handleDownloadReport} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download {preferences.format.toUpperCase()}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Preview/Summary */}
      {showPreview && reportData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              Report Summary - {reportData.reportingPeriod}
            </CardTitle>
            <CardDescription>
              Generated on {new Date(reportData.generatedAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* Permits Summary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">Permits</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Total</span>
                    <span className="font-medium">{reportData.permitsSummary.totalPermits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Active</span>
                    <span className="font-medium text-green-600">{reportData.permitsSummary.activePermits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Renewals Due</span>
                    <span className="font-medium text-amber-600">{reportData.permitsSummary.renewalsPending.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Compliance Summary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">Compliance</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Rate</span>
                    <span className="font-medium text-green-600">{reportData.complianceSummary.complianceRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Violations</span>
                    <span className="font-medium text-red-600">{reportData.complianceSummary.totalViolations.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>RNC</span>
                    <span className="font-medium text-red-600">{reportData.complianceSummary.reportableViolations.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* DMR Summary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">DMR Reports</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Total</span>
                    <span className="font-medium">{reportData.dmrSummary.totalReports.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Exceedances</span>
                    <span className="font-medium text-amber-600">{reportData.dmrSummary.parameterExceedances.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Avg Compliance</span>
                    <span className="font-medium text-green-600">{reportData.dmrSummary.averageCompliance.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Enforcement Summary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-sm">Enforcement</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Actions</span>
                    <span className="font-medium">{reportData.enforcementActions.totalActions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Penalties</span>
                    <span className="font-medium text-red-600">${(reportData.enforcementActions.totalPenaltiesAssessed / 1000000).toFixed(1)}M</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Inspections</span>
                    <span className="font-medium">{reportData.inspectionActivity.totalInspections.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div className="flex-1 text-sm">
                <span className="font-medium">Report Ready:</span> Comprehensive {reportData.reportingPeriod} NPDES annual report compiled from {reportData.permitsSummary.totalPermits.toLocaleString()} permits and {reportData.complianceSummary.totalViolations + reportData.dmrSummary.totalReports + reportData.enforcementActions.totalActions + reportData.inspectionActivity.totalInspections} compliance records.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Sources Notice */}
      <Card className="border-slate-200 bg-slate-50 dark:bg-slate-800/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <ExternalLink className="h-4 w-4 text-slate-500 mt-0.5" />
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p className="font-medium mb-1">Data Sources</p>
              <p>Reports generated from EPA ICIS-NPDES database including permit records, discharge monitoring reports, violation records, enforcement actions, and inspection findings. Data refreshed daily via automated cron jobs.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default NPDESAnnualReportGenerator;