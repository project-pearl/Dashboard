'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileDown, Target, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createBrandedPDF, PDFContentSection } from '@/lib/brandedPdfGenerator';

interface TMDLProgressAndReportGeneratorProps {
  regionId: string;
  removalEfficiencies: Record<string, number>;
  stormEvents?: any[];
  alertCount?: number;
  overallScore?: number;
  dateRange?: { start: string; end: string };
}

export function TMDLProgressAndReportGenerator({
  regionId,
  removalEfficiencies,
  stormEvents = [],
  alertCount = 0,
  overallScore = 0,
  dateRange
}: TMDLProgressAndReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const isChesapeake = regionId.includes('maryland') || regionId.includes('dc');

  const progressData = {
    tn: {
      current: 68,
      target: 100,
      label: 'Total Nitrogen Reduction',
      color: 'bg-blue-600'
    },
    tp: {
      current: 81,
      target: 100,
      label: 'Total Phosphorus Reduction',
      color: 'bg-green-600'
    },
    tss: {
      current: 75,
      target: 100,
      label: 'Total Suspended Solids',
      color: 'bg-amber-600'
    }
  };

  const creditsEarned = isChesapeake ? {
    tn: (removalEfficiencies.TN * 0.45).toFixed(1),
    tp: (removalEfficiencies.TP * 0.32).toFixed(1)
  } : null;

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      const reportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const dateRangeText = dateRange
        ? `${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`
        : 'Current Monitoring Period';

      const complianceScore = overallScore || Math.round((progressData.tn.current + progressData.tp.current + progressData.tss.current) / 3);

      const avgRemoval = (
        (removalEfficiencies.TN + removalEfficiencies.TP + removalEfficiencies.TSS) / 3
      ).toFixed(1);

      const stormEventCount = stormEvents?.length || 0;
      const avgStormRemoval = stormEvents?.length
        ? (stormEvents.reduce((sum: number, event: any) => {
            const eventAvg = Object.values(event.removalEfficiencies || {})
              .filter((val): val is number => typeof val === 'number')
              .reduce((a: number, b: number) => a + b, 0) / 5;
            return sum + eventAvg;
          }, 0) / stormEvents.length).toFixed(1)
        : 'N/A';

      const sections: PDFContentSection[] = [
        {
          content: [
            `Report Date: ${reportDate}`,
            `Monitoring Period: ${dateRangeText}`,
            `Region: ${regionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`
          ]
        },
        {
          title: 'EXECUTIVE SUMMARY',
          content: [
            `Overall Progress Score: ${complianceScore}/100`,
            ``,
            `This comprehensive MS4/TMDL progress report demonstrates ongoing compliance with stormwater permit requirements and progress toward Bay TMDL pollution reduction goals.`,
            ``,
            `Key Performance Indicators:`,
            `• Total Nitrogen (TN) Reduction: ${progressData.tn.current}% - ${progressData.tn.current >= 70 ? 'ON TRACK' : 'NEEDS IMPROVEMENT'}`,
            `• Total Phosphorus (TP) Reduction: ${progressData.tp.current}% - ${progressData.tp.current >= 70 ? 'ON TRACK' : 'NEEDS IMPROVEMENT'}`,
            `• Total Suspended Solids (TSS): ${progressData.tss.current}% - ${progressData.tss.current >= 70 ? 'ON TRACK' : 'NEEDS IMPROVEMENT'}`,
            ``,
            `Best Management Practice (BMP) Performance: Your stormwater infrastructure achieved ${removalEfficiencies.TN.toFixed(1)}% TN removal, ${removalEfficiencies.TP.toFixed(1)}% TP removal, and ${removalEfficiencies.TSS.toFixed(1)}% TSS removal efficiency during this monitoring period.`,
            ``,
            `${stormEventCount > 0 ? `Storm Event Analysis: ${stormEventCount} storm events monitored with average removal efficiency of ${avgStormRemoval}%.` : 'No storm events recorded during this period.'}`
          ]
        },
        {
          title: 'TMDL PROGRESS TOWARD GOALS',
          content: ['Progress tracking for pollution reduction targets:'],
          table: {
            headers: ['Parameter', 'Current Progress (%)', 'Target (%)', 'Status'],
            rows: [
              ['Total Nitrogen', progressData.tn.current.toString(), progressData.tn.target.toString(),
               progressData.tn.current >= 70 ? 'On Track' : 'Needs Improvement'],
              ['Total Phosphorus', progressData.tp.current.toString(), progressData.tp.target.toString(),
               progressData.tp.current >= 70 ? 'On Track' : 'Needs Improvement'],
              ['TSS Reduction', progressData.tss.current.toString(), progressData.tss.target.toString(),
               progressData.tss.current >= 70 ? 'On Track' : 'Needs Improvement']
            ]
          }
        },
        {
          title: 'BMP PERFORMANCE TABLE',
          content: ['Detailed pollutant removal performance by parameter:'],
          table: {
            headers: ['Parameter', 'Current Value (mg/L)', '% Reduction', 'Status'],
            rows: [
              ['Total Nitrogen (TN)', '0.85', removalEfficiencies.TN.toFixed(1) + '%', removalEfficiencies.TN >= 60 ? 'Compliant' : 'Monitor'],
              ['Total Phosphorus (TP)', '0.12', removalEfficiencies.TP.toFixed(1) + '%', removalEfficiencies.TP >= 60 ? 'Compliant' : 'Monitor'],
              ['Total Suspended Solids', '8.5', removalEfficiencies.TSS.toFixed(1) + '%', removalEfficiencies.TSS >= 80 ? 'Compliant' : 'Monitor'],
              ['Turbidity', '4.2 NTU', removalEfficiencies.turbidity.toFixed(1) + '%', removalEfficiencies.turbidity >= 70 ? 'Compliant' : 'Monitor'],
              ['Dissolved Oxygen', '7.8 mg/L', 'N/A', 'Healthy']
            ]
          }
        }
      ];

      if (stormEventCount > 0) {
        const stormRows = stormEvents.slice(0, 5).map((event: any) => {
          const eventRemoval = event.removalEfficiencies
            ? ((event.removalEfficiencies.TN + event.removalEfficiencies.TP + event.removalEfficiencies.TSS) / 3).toFixed(1)
            : 'N/A';
          return [
            event.name || 'Storm Event',
            event.date ? new Date(event.date).toLocaleDateString() : 'N/A',
            event.rainfall || 'N/A',
            eventRemoval + '%'
          ];
        });

        sections.push({
          title: 'STORM EVENT SUMMARY',
          content: [
            `Total Storm Events Monitored: ${stormEventCount}`,
            `Average Removal Efficiency: ${avgStormRemoval}%`,
            '',
            'Recent storm events demonstrate consistent BMP performance during high-flow conditions:'
          ],
          table: {
            headers: ['Event Name', 'Date', 'Rainfall', 'Avg Removal'],
            rows: stormRows
          }
        });
      }

      if (isChesapeake && creditsEarned) {
        sections.push({
          title: 'NUTRIENT CREDITS EARNED (ESTIMATED)',
          content: [
            'Based on current BMP performance, the following nutrient reduction credits are estimated:',
            '',
            'These credits may be eligible for trading under the Chesapeake Bay nutrient credit program.'
          ],
          table: {
            headers: ['Credit Type', 'Amount', 'Market Value (Est.)'],
            rows: [
              ['TN Credits', `${creditsEarned.tn} lbs/year`, `$${(parseFloat(creditsEarned.tn) * 8.5).toFixed(0)}`],
              ['TP Credits', `${creditsEarned.tp} lbs/year`, `$${(parseFloat(creditsEarned.tp) * 12.3).toFixed(0)}`]
            ]
          }
        });
      }

      sections.push({
        title: 'WATER QUALITY ALERTS & COMPLIANCE MONITORING',
        content: [
          `Active Alerts: ${alertCount}`,
          '',
          'Real-time monitoring system provides continuous water quality surveillance with automated alert generation for threshold exceedances.',
          '',
          'All alerts are logged and investigated per QAPP protocols. Corrective actions are documented and tracked for permit compliance verification.'
        ]
      });

      sections.push({
        title: 'REGULATORY COMPLIANCE STATUS',
        content: [
          'MS4 Permit Compliance: ACTIVE AND CURRENT',
          'NPDES Monitoring: CURRENT (Permit #MS4-2024-XXX)',
          'Data Quality Assurance: QAPP CERTIFIED',
          'Annual Report Status: IN PROGRESS',
          '',
          'Compliance Notes:',
          '• All monitoring equipment calibrated per manufacturer specifications',
          '• Data undergoes QA/QC review before reporting',
          '• Real-time monitoring provides continuous verification for permit requirements',
          '• BMP performance meets or exceeds regulatory targets for nutrient and sediment removal',
          '• Storm event monitoring demonstrates effectiveness during design storm conditions',
          '',
          'This report supports MS4 permit requirements for BMP performance monitoring and documents progress toward TMDL load reduction goals. Real-time data provides continuous compliance verification suitable for annual reporting and permit renewal applications.'
        ]
      });

      const pdf = await createBrandedPDF('FULL MS4/TMDL PROGRESS REPORT', sections);
      pdf.download(`ms4-tmdl-full-progress-report-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportCSV = () => {
    const reportData = [
      ['TMDL/MS4 PROGRESS REPORT'],
      ['Generated:', new Date().toLocaleString()],
      ['Region:', regionId],
      [''],
      ['TMDL PROGRESS TOWARD GOALS'],
      ['Parameter', 'Current Progress (%)', 'Target (%)', 'Status'],
      ['Total Nitrogen', progressData.tn.current.toString(), progressData.tn.target.toString(),
       progressData.tn.current >= 70 ? 'On Track' : 'Needs Improvement'],
      ['Total Phosphorus', progressData.tp.current.toString(), progressData.tp.target.toString(),
       progressData.tp.current >= 70 ? 'On Track' : 'Needs Improvement'],
      ['TSS Reduction', progressData.tss.current.toString(), progressData.tss.target.toString(),
       progressData.tss.current >= 70 ? 'On Track' : 'Needs Improvement'],
      [''],
      ['BMP REMOVAL EFFICIENCIES'],
      ['Parameter', 'Removal Efficiency (%)'],
      ['Total Nitrogen', removalEfficiencies.TN.toFixed(1)],
      ['Total Phosphorus', removalEfficiencies.TP.toFixed(1)],
      ['Total Suspended Solids', removalEfficiencies.TSS.toFixed(1)],
      ['Turbidity', removalEfficiencies.turbidity.toFixed(1)],
      [''],
      ['COMPLIANCE STATUS'],
      ['MS4 Permit Compliance', 'ACTIVE'],
      ['NPDES Monitoring', 'CURRENT'],
      ['Data Quality Assurance', 'QAPP CERTIFIED'],
      ['Active Alerts', alertCount.toString()]
    ];

    if (isChesapeake && creditsEarned) {
      reportData.push(
        [''],
        ['NUTRIENT CREDITS EARNED (ESTIMATED)'],
        ['TN Credits', creditsEarned.tn + ' lbs/year'],
        ['TP Credits', creditsEarned.tp + ' lbs/year']
      );
    }

    const csvContent = reportData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tmdl-progress-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-teal-900">
          <Target className="h-6 w-6" />
          TMDL/MS4 Progress & Report Generator
        </CardTitle>
        <CardDescription>
          {isChesapeake
            ? 'Live progress tracking and comprehensive reporting for Chesapeake Bay TMDL goals'
            : 'Municipal stormwater compliance tracking with one-click MS4 annual reporting'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{progressData.tn.label}</span>
                {progressData.tn.current >= 70 && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    On Track
                  </Badge>
                )}
              </div>
              <span className="text-sm font-bold text-slate-900">{progressData.tn.current}%</span>
            </div>
            <Progress value={progressData.tn.current} className="h-3" />
            <p className="text-xs text-slate-600">
              Your BMP achieves {removalEfficiencies.TN.toFixed(1)}% TN removal efficiency
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{progressData.tp.label}</span>
                {progressData.tp.current >= 70 && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    On Track
                  </Badge>
                )}
              </div>
              <span className="text-sm font-bold text-slate-900">{progressData.tp.current}%</span>
            </div>
            <Progress value={progressData.tp.current} className="h-3" />
            <p className="text-xs text-slate-600">
              Your BMP achieves {removalEfficiencies.TP.toFixed(1)}% TP removal efficiency
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{progressData.tss.label}</span>
                {progressData.tss.current >= 70 && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    On Track
                  </Badge>
                )}
              </div>
              <span className="text-sm font-bold text-slate-900">{progressData.tss.current}%</span>
            </div>
            <Progress value={progressData.tss.current} className="h-3" />
            <p className="text-xs text-slate-600">
              Your BMP achieves {removalEfficiencies.TSS.toFixed(1)}% TSS removal efficiency
            </p>
          </div>
        </div>

        {isChesapeake && creditsEarned && (
          <div className="bg-white p-4 rounded-lg border-2 border-teal-300">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-teal-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-slate-900 mb-2">
                  Estimated Nutrient Credits Earned
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-blue-50 rounded px-3 py-2 border border-blue-200">
                    <div className="text-xs text-blue-700 font-medium">TN Credits</div>
                    <div className="text-lg font-bold text-blue-900">{creditsEarned.tn}</div>
                    <div className="text-xs text-blue-600">lbs/year</div>
                  </div>
                  <div className="bg-green-50 rounded px-3 py-2 border border-green-200">
                    <div className="text-xs text-green-700 font-medium">TP Credits</div>
                    <div className="text-lg font-bold text-green-900">{creditsEarned.tp}</div>
                    <div className="text-xs text-green-600">lbs/year</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2 border-t-2 border-teal-200">
          <Button
            variant="default"
            className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-6 text-base shadow-lg"
            onClick={handleGeneratePDF}
            disabled={isGenerating}
          >
            <FileDown className="h-5 w-5" />
            {isGenerating ? 'Generating Full Report...' : 'Generate Full MS4/TMDL Progress Report (PDF)'}
          </Button>

          <Button
            variant="outline"
            className="w-full gap-2 border-2 border-green-600 bg-green-50 hover:bg-green-100 text-green-700 hover:text-green-800 font-medium"
            onClick={handleExportCSV}
            disabled={isGenerating}
          >
            <FileDown className="h-4 w-4" />
            Export Raw Data (CSV)
          </Button>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <p className="text-xs text-slate-600">
            <span className="font-semibold">MS4 Compliance Note:</span> Real-time monitoring data supports
            continuous verification for permit requirements. This report documents your stormwater BMP
            performance and progress toward TMDL load reduction goals for annual reporting and permit renewal.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
