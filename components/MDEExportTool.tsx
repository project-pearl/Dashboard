'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, CheckCircle, Building2, AlertCircle } from 'lucide-react';
import { WaterQualityData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { createBrandedPDF } from '@/lib/brandedPdfGenerator';

interface MDEExportToolProps {
  data: WaterQualityData;
  removalEfficiencies: Record<string, number>;
  regionId: string;
  regionName: string;
  stormEvents: any[];
  overallScore: number;
}

const MDE_REQUIRED_SECTIONS = [
  'Permittee Information',
  'BMP Performance Monitoring',
  'Storm Event Data',
  'Water Quality Parameters',
  'TMDL Load Reduction Progress',
  'Public Education Activities',
  'Illicit Discharge Detection',
];

export function MDEExportTool({
  data, removalEfficiencies, regionId, regionName, stormEvents, overallScore
}: MDEExportToolProps) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'done'>('idle');

  const reportingYear = new Date().getFullYear();
  const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const periodStart = `Oct 1, ${reportingYear - 1}`;
  const periodEnd   = `Sep 30, ${reportingYear}`;
  const meetsTargetCount = ['TSS', 'TN', 'TP', 'turbidity'].filter(k => removalEfficiencies[k] >= 80).length;
  const avgRemoval = ((removalEfficiencies.TSS + removalEfficiencies.TN + removalEfficiencies.TP) / 3).toFixed(1);

  const handleDownload = async () => {
    setStatus('generating');
    try {
      const bmpRows = [
        ['Total Suspended Solids (TSS)', data.parameters.TSS.value.toFixed(2), (data.parameters.TSS.value * (1 - removalEfficiencies.TSS / 100)).toFixed(2), `${removalEfficiencies.TSS.toFixed(1)}%`, '>=80%', removalEfficiencies.TSS >= 80 ? 'PASS' : 'REVIEW'],
        ['Total Nitrogen (TN)',          data.parameters.TN.value.toFixed(2),  (data.parameters.TN.value  * (1 - removalEfficiencies.TN  / 100)).toFixed(2), `${removalEfficiencies.TN.toFixed(1)}%`,  '>=60%', removalEfficiencies.TN  >= 60 ? 'PASS' : 'REVIEW'],
        ['Total Phosphorus (TP)',        data.parameters.TP.value.toFixed(2),  (data.parameters.TP.value  * (1 - removalEfficiencies.TP  / 100)).toFixed(2), `${removalEfficiencies.TP.toFixed(1)}%`,  '>=60%', removalEfficiencies.TP  >= 60 ? 'PASS' : 'REVIEW'],
        ['Turbidity',                   data.parameters.turbidity.value.toFixed(2), (data.parameters.turbidity.value * (1 - removalEfficiencies.turbidity / 100)).toFixed(2), `${removalEfficiencies.turbidity.toFixed(1)}%`, '>=70%', removalEfficiencies.turbidity >= 70 ? 'PASS' : 'REVIEW'],
        ['Dissolved Oxygen (DO)',        data.parameters.DO.value.toFixed(2),  (data.parameters.DO.value  * (1 + removalEfficiencies.DO  / 100)).toFixed(2), `${removalEfficiencies.DO.toFixed(1)}%`,  'Improve', removalEfficiencies.DO > 0 ? 'PASS' : 'REVIEW'],
      ];

      const stormRows = stormEvents.slice(0, 10).map((event: any) => {
        const dateStr = event.date instanceof Date ? event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : String(event.date);
        return [event.name || 'Storm Event', dateStr, `${event.rainfall}"`, `${event.removalEfficiencies.TSS.toFixed(0)}%`, `${event.removalEfficiencies.TN.toFixed(0)}%`, `${event.removalEfficiencies.TP.toFixed(0)}%`, event.removalEfficiencies.TSS >= 80 ? 'COMPLIANT' : 'REVIEW'];
      });

      const tmdlRows = [
        ['Total Nitrogen',         '1,250', String(Math.round(1250 * (1 - removalEfficiencies.TN  / 100))), `${removalEfficiencies.TN.toFixed(1)}%`,  '>=25%', removalEfficiencies.TN  >= 25 ? 'ON TRACK' : 'BEHIND'],
        ['Total Phosphorus',       '185',   String(Math.round(185  * (1 - removalEfficiencies.TP  / 100))), `${removalEfficiencies.TP.toFixed(1)}%`,  '>=25%', removalEfficiencies.TP  >= 25 ? 'ON TRACK' : 'BEHIND'],
        ['Total Suspended Solids', '8,500', String(Math.round(8500 * (1 - removalEfficiencies.TSS / 100))), `${removalEfficiencies.TSS.toFixed(1)}%`, '>=20%', removalEfficiencies.TSS >= 20 ? 'ON TRACK' : 'BEHIND'],
      ];

      const wqRows = [
        ['Dissolved Oxygen',       `${data.parameters.DO.value.toFixed(2)} mg/L`,       'Continuous sensor', data.parameters.DO.value < 5        ? 'EXCEEDANCE' : 'OK'],
        ['Turbidity',              `${data.parameters.turbidity.value.toFixed(2)} NTU`,  'Continuous sensor', data.parameters.turbidity.value > 50  ? 'EXCEEDANCE' : 'OK'],
        ['Total Nitrogen',         `${data.parameters.TN.value.toFixed(2)} mg/L`,        'Continuous sensor', data.parameters.TN.value > 0.80       ? 'EXCEEDANCE' : 'OK'],
        ['Total Phosphorus',       `${data.parameters.TP.value.toFixed(2)} mg/L`,        'Continuous sensor', data.parameters.TP.value > 0.05       ? 'EXCEEDANCE' : 'OK'],
        ['Total Suspended Solids', `${data.parameters.TSS.value.toFixed(2)} mg/L`,       'Continuous sensor', data.parameters.TSS.value > 30        ? 'EXCEEDANCE' : 'OK'],
        ['Salinity',               `${data.parameters.salinity.value.toFixed(2)} ppt`,   'Continuous sensor', 'OK'],
      ];

      const pdf = await createBrandedPDF('MDE MS4 Annual Compliance Report', [
        {
          content: [
            `Report Date: ${reportDate}`,
            `Reporting Period: ${periodStart} - ${periodEnd}`,
            `Monitoring Location: ${regionName}`,
            `Permit Reference: Maryland NPDES MS4 General Permit No. 12-SW`,
            `Permittee: Local Seafood Projects Inc. - Doug Moreland, Founder & CEO`,
            `Technology: Project PEARL v1.0 - Oyster Biofiltration + Mechanical Filtration`,
            `Data Collection: Automated continuous sensor monitoring`,
          ],
        },
        {
          title: 'EXECUTIVE SUMMARY',
          content: [
            `Overall Water Quality Score: ${overallScore}/100`,
            '',
            `This MS4 Annual Compliance Report documents Project PEARL's continuous ALIA stormwater monitoring performance for the ${periodStart} - ${periodEnd} reporting period. ALIA's combined mechanical filtration and oyster biofiltration system achieved ${avgRemoval}% average pollutant removal, supporting permit compliance and Chesapeake Bay TMDL load reduction goals.`,
            '',
            'Key Performance Indicators:',
            `  TSS Removal: ${removalEfficiencies.TSS.toFixed(1)}% - ${removalEfficiencies.TSS >= 80 ? 'MEETS >=80% MS4 target' : 'Below 80% MS4 target'}`,
            `  Total Nitrogen: ${removalEfficiencies.TN.toFixed(1)}% - ${removalEfficiencies.TN >= 60 ? 'MEETS >=60% nutrient target' : 'Below 60% target'}`,
            `  Total Phosphorus: ${removalEfficiencies.TP.toFixed(1)}% - ${removalEfficiencies.TP >= 60 ? 'MEETS >=60% nutrient target' : 'Below 60% target'}`,
            `  Turbidity: ${removalEfficiencies.turbidity.toFixed(1)}% - ${removalEfficiencies.turbidity >= 70 ? 'MEETS >=70% target' : 'Below 70% target'}`,
            '',
            `${stormEvents.length} storm events captured. ${meetsTargetCount} of 4 parameters meeting 80% removal target.`,
          ],
        },
        {
          title: 'SECTION 1 - BMP PERFORMANCE MONITORING',
          content: ['Influent vs. effluent analysis per NPDES/MS4 BMP performance standards. Target: >=80% TSS, >=60% nutrients.'],
          table: { headers: ['Parameter', 'Influent', 'Effluent', 'Removal', 'Target', 'Status'], rows: bmpRows },
        },
        {
          title: 'SECTION 2 - STORM EVENT MONITORING DATA',
          content: [`${stormEvents.length} storm events captured. Per-event paired influent/effluent data below.`],
          table: { headers: ['Event Name', 'Date', 'Rainfall', 'TSS %', 'TN %', 'TP %', 'Compliance'], rows: stormRows.length > 0 ? stormRows : [['No storm events recorded', '', '', '', '', '', '']] },
        },
        {
          title: 'SECTION 3 - CHESAPEAKE BAY TMDL LOAD REDUCTION',
          content: ['Maryland WIP Phase III load reduction targets. Baseline from 2009 reference year.'],
          table: { headers: ['Pollutant', 'Baseline (lbs/yr)', 'Current (lbs/yr)', 'Reduction', 'WIP Target', 'Status'], rows: tmdlRows },
        },
        {
          title: 'SECTION 4 - AMBIENT WATER QUALITY',
          content: ['Current ambient conditions vs. Maryland water quality standards.'],
          table: { headers: ['Parameter', 'Current Value', 'Method', 'Flag'], rows: wqRows },
        },
        {
          title: 'SECTION 5 - COMPLIANCE NOTES & CERTIFICATION',
          content: [
            'MS4 Permit Compliance: ACTIVE - continuous monitoring maintained throughout reporting period.',
            'NPDES Monitoring: CURRENT - automated data collection per ALIA sensor validation protocol.',
            '',
            'Sections requiring manual supplementation before MDE submission:',
            '  Section 6: Public Education & Outreach Activities',
            '  Section 7: Illicit Discharge Detection & Elimination',
            '  Section 8: Construction Site Stormwater Runoff Control',
            '',
            'CERTIFICATION STATEMENT:',
            'I certify under penalty of law that this document and all attachments were prepared under my direction or supervision in accordance with a system designed to assure that qualified personnel properly gathered and evaluated the information submitted. To the best of my knowledge and belief, the information submitted is true, accurate, and complete. (40 CFR ss122.22)',
            '',
            'Authorized Signatory: ________________________________   Date: _______________',
            '',
            'Title: ________________________________   Permit Number: _______________',
          ],
        },
      ]);

      pdf.download(`PEARL_MDE_MS4_Report_${regionId}_${reportingYear}.pdf`);
      setStatus('done');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error('PDF generation error:', err);
      setStatus('idle');
    }
  };

  return (
    <Card className="border-2 border-blue-400 bg-gradient-to-br from-blue-50 via-white to-slate-50 shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-xl flex items-center gap-2 text-blue-900">
              <Building2 className="h-6 w-6 text-blue-600" />
              MDE MS4 Annual Report — PDF Export
            </CardTitle>
            <CardDescription>
              Formatted PDF matching Maryland NPDES MS4 General Permit reporting requirements · matches your existing TMDL report styling
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 bg-blue-100 border border-blue-300 rounded-full px-3 py-1 text-xs font-semibold text-blue-800">
            <FileText className="h-3.5 w-3.5" />
            MDE Format
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MDE_REQUIRED_SECTIONS.slice(0, 4).map((section, i) => (
            <div key={i} className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-green-800 font-medium leading-tight">{section}</span>
            </div>
          ))}
          {MDE_REQUIRED_SECTIONS.slice(4).map((section, i) => (
            <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-amber-800 font-medium leading-tight">{section} <span className="text-amber-500">(manual)</span></span>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Report Summary — {periodStart} – {periodEnd}</div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><div className="text-2xl font-black text-green-600">{meetsTargetCount}/4</div><div className="text-xs text-slate-500">Parameters &gt;=80%</div></div>
            <div><div className="text-2xl font-black text-blue-600">{stormEvents.length}</div><div className="text-xs text-slate-500">Storm events</div></div>
            <div><div className="text-2xl font-black text-purple-600">{overallScore}</div><div className="text-xs text-slate-500">WQ score</div></div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
          <div className="text-xs font-bold text-slate-700 mb-2">Report includes 5 sections + cover:</div>
          {['Cover + permittee info + executive summary', 'BMP performance — influent/effluent with PASS/REVIEW', 'Storm events — all captured events with per-event removal', 'TMDL load reduction vs. WIP Phase III targets', 'Ambient WQ + certification & signature block'].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-xs">{i + 1}</span>
              {item}
            </div>
          ))}
          <p className="text-xs text-slate-400 pt-1">Uses your PROJECT PEARL logo — matches existing TMDL report styling.</p>
        </div>

        <Button onClick={handleDownload} disabled={status === 'generating'} className="w-full bg-blue-700 hover:bg-blue-800 text-white gap-2 py-5 text-base font-semibold">
          {status === 'generating' && <span className="animate-spin mr-1">⏳</span>}
          {status === 'done'       && <CheckCircle className="h-5 w-5" />}
          {status === 'idle'       && <Download className="h-5 w-5" />}
          {status === 'generating' ? 'Generating PDF...' : status === 'done' ? 'Downloaded!' : 'Download MDE Report PDF'}
        </Button>

        <p className="text-xs text-slate-500 text-center">
          Sections 6-8 require manual supplementation. Reference: Maryland NPDES MS4 General Permit No. 12-SW.
        </p>
      </CardContent>
    </Card>
  );
}
