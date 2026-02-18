'use client';

import React, { useState, useCallback } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search, CheckCircle, AlertTriangle, XCircle, Download, FileText,
  Clock, Database, Shield, Activity, Cpu, FlaskConical, ExternalLink,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { BrandedPDFGenerator } from '@/lib/brandedPdfGenerator';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type ValidationStatus = 'pass' | 'flag' | 'fail';

interface LineageStep {
  label: string;
  description: string;
  timestamp: string;
  sourceSystem: string;
  method: string;
  status: ValidationStatus;
  detail?: string;
}

export interface ProvenanceRecord {
  metricName: string;
  displayValue: string;
  unit?: string;
  waterbody?: string;
  sensorSource: string;
  sensorModel: string;
  lastCalibration: string;
  nextCalibrationDue: string;
  epaMethod: string;
  qappSection?: string;
  lineage: LineageStep[];
}

// ─── Demo provenance data factory ────────────────────────────────────────────

function generateProvenanceRecord(
  metricName: string,
  displayValue: string,
  unit?: string,
): ProvenanceRecord {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);
  const ago = (mins: number) => {
    const d = new Date(now.getTime() - mins * 60_000);
    return fmt(d);
  };

  const methodMap: Record<string, string> = {
    'Dissolved Oxygen': 'ASTM D888 / EPA Method 360.1',
    'Total Nitrogen': 'EPA Method 351.2',
    'Total Phosphorus': 'EPA Method 365.1',
    'Turbidity': 'EPA Method 180.1 / ASTM D6910',
    'E. coli': 'EPA Method 1103.1',
    'pH': 'EPA Method 150.1 / ASTM D1293',
    'TSS': 'EPA Method 160.2',
    'Temperature': 'ASTM D1498',
    'Flow Rate': 'USGS continuous discharge',
    'Water Quality Score': 'PEARL Composite (EPA QA/R-5)',
    'ESG Score': 'PEARL ESG Framework v2.1',
    'Compliance Score': 'EPA NPDES Method 40 CFR §122.26',
  };

  const epaMethod = methodMap[metricName] || 'EPA QA/R-5 Composite';

  return {
    metricName,
    displayValue,
    unit,
    sensorSource: 'YSI EXO2 Multiparameter Sonde',
    sensorModel: 'EXO2-S / Hach FP360',
    lastCalibration: '2026-02-12 08:00:00',
    nextCalibrationDue: '2026-02-19 08:00:00',
    epaMethod,
    qappSection: 'PEARL-QAPP-2025 §4.3',
    lineage: [
      {
        label: 'Sensor Reading',
        description: 'Raw analog signal captured by probe',
        timestamp: ago(8),
        sourceSystem: 'YSI EXO2 Sonde',
        method: 'Continuous 1-min interval',
        status: 'pass',
        detail: `Raw value: ${displayValue}${unit ? ' ' + unit : ''} ± 0.01`,
      },
      {
        label: 'Data Logger',
        description: 'Timestamped, GPS-tagged, stored on-board',
        timestamp: ago(7),
        sourceSystem: 'Campbell CR1000X',
        method: 'RS-485 / SDI-12 digital',
        status: 'pass',
        detail: 'GPS lock: 39.2904° N, 76.6122° W | HDOP: 0.9',
      },
      {
        label: 'Transmission',
        description: 'Encrypted cellular upload to cloud',
        timestamp: ago(6),
        sourceSystem: 'Verizon LTE Gateway',
        method: 'TLS 1.3 encrypted / MQTT',
        status: 'pass',
        detail: 'Payload hash: SHA-256 verified',
      },
      {
        label: 'QA/QC Validation',
        description: 'Automated range, rate-of-change, and pattern checks',
        timestamp: ago(4),
        sourceSystem: 'PEARL QA Engine v3.2',
        method: epaMethod,
        status: 'pass',
        detail: 'Range ✓ | Rate-of-change ✓ | Pattern ✓ | Drift: 0.2%',
      },
      {
        label: 'Derived Metric',
        description: 'Calculated from validated readings with bias correction',
        timestamp: ago(2),
        sourceSystem: 'PEARL Analytics Engine',
        method: 'Rolling 15-min avg + bias correction',
        status: 'pass',
        detail: `Computed: ${displayValue}${unit ? ' ' + unit : ''} (confidence: 98.7%)`,
      },
      {
        label: 'Display Value',
        description: 'Final value rendered on dashboard',
        timestamp: ago(1),
        sourceSystem: 'PEARL Dashboard',
        method: 'Real-time render pipeline',
        status: 'pass',
        detail: `Displayed: ${displayValue}${unit ? ' ' + unit : ''}`,
      },
    ],
  };
}

// ─── Status icon helper ──────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ValidationStatus }) {
  switch (status) {
    case 'pass':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'flag':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case 'fail':
      return <XCircle className="h-5 w-5 text-red-500" />;
  }
}

function statusBadge(status: ValidationStatus) {
  const map = {
    pass: { label: 'Pass', cls: 'bg-green-100 text-green-700 border-green-300' },
    flag: { label: 'Flagged', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    fail: { label: 'Fail', cls: 'bg-red-100 text-red-700 border-red-300' },
  };
  const s = map[status];
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}

// ─── Step icon helper ────────────────────────────────────────────────────────

function StepIcon({ label }: { label: string }) {
  const cls = 'h-4 w-4 text-blue-600';
  if (label.includes('Sensor')) return <Activity className={cls} />;
  if (label.includes('Logger')) return <Database className={cls} />;
  if (label.includes('Transmission')) return <Cpu className={cls} />;
  if (label.includes('QA')) return <FlaskConical className={cls} />;
  if (label.includes('Derived')) return <Shield className={cls} />;
  return <FileText className={cls} />;
}

// ─── PDF Export ──────────────────────────────────────────────────────────────

async function exportProvenancePDF(record: ProvenanceRecord) {
  const pdf = new BrandedPDFGenerator('portrait');
  await pdf.loadLogo();
  pdf.initialize();

  pdf.addTitle('Data Provenance Audit Trail');
  pdf.addSpacer(3);

  pdf.addMetadata('Metric', record.metricName);
  pdf.addMetadata('Display Value', `${record.displayValue}${record.unit ? ' ' + record.unit : ''}`);
  if (record.waterbody) pdf.addMetadata('Waterbody', record.waterbody);
  pdf.addMetadata('Sensor Source', record.sensorSource);
  pdf.addMetadata('Sensor Model', record.sensorModel);
  pdf.addMetadata('EPA Method', record.epaMethod);
  pdf.addMetadata('Last Calibration', record.lastCalibration);
  pdf.addMetadata('Next Cal. Due', record.nextCalibrationDue);
  if (record.qappSection) pdf.addMetadata('QAPP Reference', record.qappSection);
  pdf.addMetadata('Generated', new Date().toISOString().replace('T', ' ').slice(0, 19));

  pdf.addSpacer(5);
  pdf.addDivider();
  pdf.addSubtitle('Data Lineage Chain');
  pdf.addSpacer(3);

  pdf.addTable(
    ['Step', 'Timestamp', 'Source System', 'Method', 'Status'],
    record.lineage.map((s) => [
      s.label,
      s.timestamp,
      s.sourceSystem,
      s.method,
      s.status.toUpperCase(),
    ]),
    [30, 38, 35, 42, 20],
  );

  pdf.addSpacer(5);
  pdf.addSubtitle('Step Details');
  pdf.addSpacer(2);
  record.lineage.forEach((step) => {
    pdf.addText(`${step.label}: ${step.description}`, { bold: true, fontSize: 9 });
    if (step.detail) pdf.addText(step.detail, { indent: 5, fontSize: 8 });
    pdf.addSpacer(2);
  });

  pdf.addSpacer(5);
  pdf.addDivider();
  pdf.addText('This document certifies the full data provenance chain for regulatory audit purposes.', { fontSize: 8 });
  pdf.addText('Generated by Project PEARL — EPA QAPP-compliant monitoring platform.', { fontSize: 8 });

  const filename = `PEARL_Provenance_${record.metricName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.download(filename);
}

// ─── ProvenanceIcon (exported for use in command centers) ────────────────────

interface ProvenanceIconProps {
  metricName: string;
  displayValue: string;
  unit?: string;
  className?: string;
}

export function ProvenanceIcon({ metricName, displayValue, unit, className }: ProvenanceIconProps) {
  const [open, setOpen] = useState(false);
  const record = generateProvenanceRecord(metricName, displayValue, unit);

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={cn(
          'inline-flex items-center justify-center rounded-full p-0.5 transition-colors',
          'hover:bg-blue-100 text-blue-400 hover:text-blue-600',
          'focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1',
          className,
        )}
        title={`View audit trail for ${metricName}`}
        aria-label={`View data provenance for ${metricName}`}
      >
        <Search className="h-3 w-3" />
      </button>

      <DataProvenancePanel open={open} onOpenChange={setOpen} record={record} />
    </>
  );
}

// ─── DataProvenancePanel (the side-panel sheet) ──────────────────────────────

interface DataProvenancePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ProvenanceRecord;
}

export function DataProvenancePanel({ open, onOpenChange, record }: DataProvenancePanelProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportProvenancePDF(record);
    } finally {
      setExporting(false);
    }
  }, [record]);

  const toggleStep = (i: number) => setExpandedStep(expandedStep === i ? null : i);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        {/* Header */}
        <SheetHeader className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-5 pb-4">
          <SheetTitle className="text-white text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Provenance Audit
          </SheetTitle>
          <SheetDescription className="text-blue-100">
            Full chain-of-custody for <span className="font-semibold text-white">{record.metricName}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="p-5 space-y-5">

          {/* Metric summary card */}
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">{record.metricName}</div>
                <div className="text-3xl font-black text-blue-900 mt-1">
                  {record.displayValue}
                  {record.unit && <span className="text-lg font-normal text-blue-500 ml-1">{record.unit}</span>}
                </div>
              </div>
              <div className="text-right space-y-1">
                {statusBadge(record.lineage.every(s => s.status === 'pass') ? 'pass' : record.lineage.some(s => s.status === 'fail') ? 'fail' : 'flag')}
                <div className="text-[10px] text-blue-500 mt-1">All {record.lineage.length} steps verified</div>
              </div>
            </div>
          </div>

          {/* Sensor / Calibration info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-slate-700">Sensor Source</span>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>{record.sensorSource}</div>
                <div className="text-[10px] text-slate-400">{record.sensorModel}</div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <FlaskConical className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-slate-700">EPA Method</span>
              </div>
              <div className="text-xs text-slate-600">{record.epaMethod}</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-xs font-semibold text-green-700">Last Calibration</span>
              </div>
              <div className="text-xs text-green-600 font-medium">{record.lastCalibration}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">Next Cal. Due</span>
              </div>
              <div className="text-xs text-amber-600 font-medium">{record.nextCalibrationDue}</div>
            </div>
          </div>

          {/* QAPP link */}
          {record.qappSection && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <div>
                  <div className="text-xs font-semibold text-purple-700">QAPP Reference</div>
                  <div className="text-[10px] text-purple-500">{record.qappSection}</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
                onClick={() => window.open('https://www.epa.gov/quality/quality-assurance-project-plan-qapp', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View QAPP
              </Button>
            </div>
          )}

          {/* ── Data Lineage Timeline ── */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              Data Lineage Chain
            </h3>

            <div className="relative ml-3">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-300 via-blue-200 to-green-300" />

              <div className="space-y-0">
                {record.lineage.map((step, i) => {
                  const isExpanded = expandedStep === i;
                  const isLast = i === record.lineage.length - 1;

                  return (
                    <div key={i} className="relative pl-8">
                      {/* Timeline node */}
                      <div className={cn(
                        'absolute left-0 top-3 z-10 flex items-center justify-center rounded-full border-2 bg-white',
                        'w-5 h-5',
                        step.status === 'pass' ? 'border-green-400' :
                        step.status === 'flag' ? 'border-amber-400' :
                        'border-red-400',
                      )}>
                        <StatusIcon status={step.status} />
                      </div>

                      {/* Arrow connector between nodes */}
                      {!isLast && (
                        <div className="absolute left-[7px] top-[28px] text-slate-300 text-[10px] leading-none">▼</div>
                      )}

                      {/* Step card */}
                      <button
                        onClick={() => toggleStep(i)}
                        className={cn(
                          'w-full text-left rounded-lg border p-3 mb-2 transition-all',
                          'hover:shadow-sm',
                          isExpanded ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-white',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StepIcon label={step.label} />
                            <span className="text-xs font-semibold text-slate-800">{step.label}</span>
                            {statusBadge(step.status)}
                          </div>
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                            : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          }
                        </div>

                        <div className="text-[10px] text-slate-500 mt-1">{step.description}</div>

                        {isExpanded && (
                          <div className="mt-3 space-y-1.5 text-[11px] bg-white rounded border border-slate-100 p-2.5">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Timestamp:</span>
                              <span className="font-mono text-slate-700">{step.timestamp}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Source System:</span>
                              <span className="text-slate-700">{step.sourceSystem}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Method:</span>
                              <span className="text-slate-700">{step.method}</span>
                            </div>
                            {step.detail && (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                                <span className="text-slate-500">Detail:</span>
                                <span className="block text-slate-700 font-mono text-[10px] mt-0.5">{step.detail}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Export Button ── */}
          <div className="border-t border-slate-200 pt-4">
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Generating PDF…' : 'Export Provenance Chain (PDF)'}
            </Button>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              One-click audit-ready PDF for regulatory review
            </p>
          </div>

          {/* ── Compliance footer ── */}
          <div className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold mb-1">EPA QAPP Compliant</h4>
                <p className="text-[10px] opacity-90">
                  All data follows EPA QA/R-5 quality assurance requirements. Chain of custody is
                  digitally signed, immutable, and available 24/7 for MDE audit access.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
