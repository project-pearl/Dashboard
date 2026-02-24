'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  TrendingUp,
  Shield,
  Eye,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  BarChart3
} from 'lucide-react';
import { WaterQualityData } from '@/lib/types';
import { EJMetrics } from '@/lib/ejImpact';
import { calculateESGScore, generateESGTrendData, generateESGReport, ESGScore } from '@/lib/esgScore';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { createBrandedPDF, PDFContentSection } from '@/lib/brandedPdfGenerator';

const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />
});

interface ESGImpactReportingProps {
  data: WaterQualityData;
  regionName: string;
  removalEfficiencies?: {
    TSS: number;
    TN: number;
    TP: number;
    turbidity: number;
    DO: number;
  };
  ejMetrics?: EJMetrics;
  alertCount: number;
  isPublicView: boolean;
}

export function ESGImpactReporting({
  data,
  regionName,
  removalEfficiencies,
  ejMetrics,
  alertCount,
  isPublicView
}: ESGImpactReportingProps) {
  const [mounted, setMounted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const esgScore = useMemo(() => {
    return calculateESGScore(data, removalEfficiencies, ejMetrics, alertCount, isPublicView);
  }, [data, removalEfficiencies, ejMetrics, alertCount, isPublicView]);

  const trendData = useMemo(() => {
    return generateESGTrendData(esgScore.overall);
  }, [esgScore.overall]);

  const handleDownloadReport = async (format: 'pdf' | 'csv') => {
    if (format === 'pdf') {
      setIsGenerating(true);
      try {
        const sections: PDFContentSection[] = [
          {
            content: [
              `Region: ${regionName}`,
              `Report Date: ${new Date().toLocaleDateString()}`,
              `Sustainability Score: ${esgScore.overall}/100 (Grade ${esgScore.grade})`
            ]
          },
          {
            title: 'EXECUTIVE SUMMARY',
            content: [
              `Overall Sustainability Water Impact Score: ${esgScore.overall}/100`,
              `Grade: ${esgScore.grade}`,
              `Water Risk Level: ${esgScore.waterRiskLevel}`,
              '',
              'This report provides a comprehensive assessment of water quality performance using Environmental, Social, and Governance (ESG) metrics aligned with GRI 303 and SASB Water Sector Standards.'
            ]
          },
          {
            title: 'SUSTAINABILITY COMPONENT SCORES',
            content: [],
            table: {
              headers: ['Component', 'Score', 'Weight', 'Contribution'],
              rows: [
                ['Water Quality', `${esgScore.components.waterQuality}%`, '40%', `${(esgScore.components.waterQuality * 0.4).toFixed(1)} pts`],
                ['Pollutant Reduction', `${esgScore.components.pollutantReduction}%`, '30%', `${(esgScore.components.pollutantReduction * 0.3).toFixed(1)} pts`],
                ['Risk Management', `${esgScore.components.riskManagement}%`, '20%', `${(esgScore.components.riskManagement * 0.2).toFixed(1)} pts`],
                ['Transparency', `${esgScore.components.transparency}%`, '10%', `${(esgScore.components.transparency * 0.1).toFixed(1)} pts`]
              ]
            }
          },
          {
            title: 'WATER QUALITY PARAMETERS',
            content: ['Current water quality measurements:'],
            table: {
              headers: ['Parameter', 'Value', 'Unit'],
              rows: [
                ['Dissolved Oxygen', data.parameters.DO.value.toFixed(2), data.parameters.DO.unit],
                ['Turbidity', data.parameters.turbidity.value.toFixed(2), data.parameters.turbidity.unit],
                ['Total Nitrogen', data.parameters.TN.value.toFixed(2), data.parameters.TN.unit],
                ['Total Phosphorus', data.parameters.TP.value.toFixed(2), data.parameters.TP.unit],
                ['Total Suspended Solids', data.parameters.TSS.value.toFixed(2), data.parameters.TSS.unit]
              ]
            }
          }
        ];

        if (removalEfficiencies) {
          sections.push({
            title: 'POLLUTANT REMOVAL PERFORMANCE',
            content: [],
            table: {
              headers: ['Parameter', 'Removal Efficiency'],
              rows: [
                ['Total Nitrogen', `${removalEfficiencies.TN.toFixed(1)}%`],
                ['Total Phosphorus', `${removalEfficiencies.TP.toFixed(1)}%`],
                ['Total Suspended Solids', `${removalEfficiencies.TSS.toFixed(1)}%`],
                ['Turbidity', `${removalEfficiencies.turbidity.toFixed(1)}%`]
              ]
            }
          });
        }

        if (esgScore.improvementTips.length > 0) {
          sections.push({
            title: 'IMPROVEMENT OPPORTUNITIES',
            content: esgScore.improvementTips
          });
        }

        sections.push({
          title: 'METHODOLOGY',
          content: [
            'This Sustainability Water Impact Score is calculated using the following methodology:',
            '',
            '• Water Quality (40%): Based on compliance with regulatory thresholds for key parameters',
            '• Pollutant Reduction (30%): Measured by BMP removal efficiency performance',
            '• Risk Management (20%): Alert frequency and response effectiveness',
            '• Transparency (10%): Public data availability and stakeholder engagement',
            '',
            'Scoring aligned with GRI 303 (Water and Effluents) and SASB Water Sector Standards for sustainability disclosure and stakeholder communication.'
          ]
        });

        const pdf = await createBrandedPDF('SUSTAINABILITY WATER IMPACT REPORT', sections);
        pdf.download(`Sustainability-Water-Impact-Report-${regionName.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF report. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    } else {
      const report = generateESGReport(esgScore, regionName, data, ejMetrics);
      const blob = new Blob([report], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sustainability-Water-Impact-Report-${regionName.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-600';
      case 'B': return 'bg-blue-600';
      case 'C': return 'bg-yellow-600';
      case 'D': return 'bg-orange-600';
      case 'F': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'bg-green-100 border-green-300 text-green-900';
      case 'Medium': return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      case 'High': return 'bg-red-100 border-red-300 text-red-900';
      default: return 'bg-slate-100 border-slate-300 text-slate-900';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'Low': return <CheckCircle2 className="h-5 w-5 text-green-700" />;
      case 'Medium': return <AlertCircle className="h-5 w-5 text-yellow-700" />;
      case 'High': return <AlertTriangle className="h-5 w-5 text-red-700" />;
      default: return <Shield className="h-5 w-5" />;
    }
  };

  const trendChartOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const date = new Date(params[0].value[0]).toLocaleDateString();
        return `${date}<br/>Sustainability Score: ${params[0].value[1]}`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLabel: {
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        fontSize: 10
      }
    },
    series: [{
      name: 'Sustainability Score',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        width: 3,
        color: '#2563eb'
      },
      itemStyle: {
        color: '#2563eb'
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(37, 99, 235, 0.3)' },
            { offset: 1, color: 'rgba(37, 99, 235, 0.05)' }
          ]
        }
      },
      data: trendData.map(point => [point.date.getTime(), point.score])
    }]
  };

  if (!mounted) {
    return (
      <Card className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50 animate-pulse">
        <CardHeader>
          <div className="h-8 bg-blue-300 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-blue-300 rounded w-1/2"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-48 bg-blue-300 rounded"></div>
            <div className="h-32 bg-blue-300 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-blue-900">
            <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              Sustainability Water Impact Score
              <CardDescription className="text-sm mt-1">
                Environmental, Social, and Governance Performance
              </CardDescription>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white/70 rounded-xl border-2 border-blue-200">
              <div className={`h-32 w-32 rounded-full ${getGradeColor(esgScore.grade)} flex items-center justify-center mb-4 shadow-lg`}>
                <div className="text-center">
                  <div className="text-5xl font-black text-white">{esgScore.grade}</div>
                  <div className="text-sm font-bold text-white/90">Grade</div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-blue-900 mb-1">{esgScore.overall}</div>
                <div className="text-sm font-semibold text-blue-700">Out of 100</div>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div className="p-3 bg-white/70 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-900">Water Quality</span>
                  </div>
                  <span className="text-sm font-bold text-blue-900">{esgScore.components.waterQuality}%</span>
                </div>
                <Progress value={esgScore.components.waterQuality} className="h-2" />
                <div className="text-xs text-blue-700 mt-1">40% of overall score</div>
              </div>

              <div className="p-3 bg-white/70 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-semibold text-blue-900">Pollutant Reduction</span>
                  </div>
                  <span className="text-sm font-bold text-blue-900">{esgScore.components.pollutantReduction}%</span>
                </div>
                <Progress value={esgScore.components.pollutantReduction} className="h-2" />
                <div className="text-xs text-blue-700 mt-1">30% of overall score</div>
              </div>

              <div className="p-3 bg-white/70 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-orange-600" />
                    <span className="text-xs font-semibold text-blue-900">Risk Management</span>
                  </div>
                  <span className="text-sm font-bold text-blue-900">{esgScore.components.riskManagement}%</span>
                </div>
                <Progress value={esgScore.components.riskManagement} className="h-2" />
                <div className="text-xs text-blue-700 mt-1">20% of overall score</div>
              </div>

              <div className="p-3 bg-white/70 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-semibold text-blue-900">Transparency</span>
                  </div>
                  <span className="text-sm font-bold text-blue-900">{esgScore.components.transparency}%</span>
                </div>
                <Progress value={esgScore.components.transparency} className="h-2" />
                <div className="text-xs text-blue-700 mt-1">10% of overall score</div>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg border-2 ${getRiskColor(esgScore.waterRiskLevel)}`}>
            <div className="flex items-center gap-3">
              {getRiskIcon(esgScore.waterRiskLevel)}
              <div className="flex-1">
                <h4 className="text-sm font-bold mb-1">Water Risk Level: {esgScore.waterRiskLevel}</h4>
                <p className="text-xs leading-relaxed">
                  {esgScore.waterRiskLevel === 'Low' && 'Water quality metrics within acceptable ranges with effective pollutant management.'}
                  {esgScore.waterRiskLevel === 'Medium' && 'Some water quality concerns identified. Monitoring and targeted improvements recommended.'}
                  {esgScore.waterRiskLevel === 'High' && 'Elevated water quality risks detected. Immediate attention and remediation actions recommended.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => handleDownloadReport('pdf')} className="flex-1 min-w-[200px] bg-blue-600 hover:bg-blue-700" disabled={isGenerating}>
              <Download className="h-4 w-4 mr-2" />
              {isGenerating ? 'Generating PDF...' : 'Download Sustainability Report (PDF)'}
            </Button>
            <Button onClick={() => handleDownloadReport('csv')} variant="outline" className="flex-1 min-w-[200px] border-blue-600 text-blue-600 hover:bg-blue-50" disabled={isGenerating}>
              <FileText className="h-4 w-4 mr-2" />
              Export Data (TXT)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-slate-300">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Sustainability Score Trend (12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReactECharts option={trendChartOption} style={{ height: '280px' }} />
        </CardContent>
      </Card>

      {esgScore.improvementTips.length > 0 && (
        <Card className="border-2 border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Improvement Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {esgScore.improvementTips.map((tip, idx) => (
              <Alert key={idx} className="border-green-300 bg-white/60">
                <CheckCircle2 className="h-4 w-4 text-green-700" />
                <AlertDescription className="text-sm text-green-900 font-medium">
                  {tip}
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-2 border-green-300 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-900 flex items-center gap-2">
            <Download className="h-5 w-5" />
            Sustainability Grant Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-green-800">
              Your sustainability score of <span className="font-bold">{esgScore.overall}/100</span> qualifies you for
              specialized sustainability-focused grants.
            </p>
            <Alert className="border-green-300 bg-white/60">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
              <AlertDescription className="text-xs text-green-900">
                <span className="font-semibold">Water Stewardship Partnership</span> - Up to $300,000 available.
                Your strong {esgScore.components.waterQuality >= 80 ? 'water quality' : 'transparency'} score
                makes this a high-match opportunity.
              </AlertDescription>
            </Alert>
            <Alert className="border-green-300 bg-white/60">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
              <AlertDescription className="text-xs text-green-900">
                <span className="font-semibold">UN Sustainable Development Goals - Water Action</span> - Up to $1,000,000.
                Requires sustainability performance documentation (your reports qualify).
              </AlertDescription>
            </Alert>
            <p className="text-xs text-green-700 italic">
              Check the Grant Opportunity Matcher for full details and additional funding opportunities.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-slate-300 bg-slate-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold">Sustainability Methodology:</span> Score based on 40% water quality metrics,
              30% pollutant reduction efficiency, 20% risk management, and 10% transparency.
              Aligned with GRI 303 (Water and Effluents) and SASB Water Sector Standards.
              Reports provide standardized metrics for sustainability disclosure and stakeholder communication.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
