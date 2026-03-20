'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search, CheckCircle, AlertTriangle, XCircle, Download, FileText,
  Clock, Database, Shield, Activity, Cpu, FlaskConical, ExternalLink,
  ChevronDown, ChevronUp, Loader2, Globe,
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
  // Live data fields
  isLive?: boolean;
  agency?: string;
  apiEndpoint?: string;
  refreshSchedule?: string;
  dataDescription?: string;
  totalRecords?: number;
}

// ─── Live provenance data from API ──────────────────────────────────────────

interface LiveCacheInfo {
  cacheKey: string;
  loaded: boolean;
  built: string | null;
  recordCount: number;
  source: string | null;
  staleness: number | null; // minutes since last build
}

interface LiveProvenanceResponse {
  metric: string;
  agency: string;
  apiEndpoint: string;
  refreshSchedule: string;
  epaMethod: string;
  dataDescription: string;
  caches: LiveCacheInfo[];
  allCachesLoaded: boolean;
  oldestBuild: string | null;
  newestBuild: string | null;
  totalRecords: number;
  error?: string;
}

function stalenessStatus(minutes: number | null): ValidationStatus {
  if (minutes === null) return 'fail';
  if (minutes < 120) return 'pass';   // < 2 hours
  if (minutes < 1440) return 'flag';  // < 24 hours
  return 'fail';                       // > 24 hours
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Never built';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatStaleness(minutes: number | null): string {
  if (minutes === null) return 'No data';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

function buildLiveRecord(
  metricName: string,
  displayValue: string,
  unit: string | undefined,
  data: LiveProvenanceResponse,
): ProvenanceRecord {
  const lineage: LineageStep[] = [];

  // Step 1: Federal API source
  lineage.push({
    label: 'Federal API Source',
    description: `Data sourced from ${data.apiEndpoint}`,
    timestamp: data.oldestBuild ? formatTimestamp(data.oldestBuild) : 'Unknown',
    sourceSystem: data.agency,
    method: data.refreshSchedule,
    status: data.allCachesLoaded ? 'pass' : 'flag',
    detail: `${data.dataDescription}`,
  });

  // Step 2: Individual cache statuses
  for (const cache of data.caches) {
    const staleStatus = stalenessStatus(cache.staleness);
    lineage.push({
      label: `Cache: ${cache.cacheKey}`,
      description: cache.loaded
        ? `${cache.recordCount.toLocaleString()} records loaded from ${cache.source || 'disk/blob'}`
        : 'Cache not loaded — data unavailable',
      timestamp: cache.built ? formatTimestamp(cache.built) : 'Never built',
      sourceSystem: `PIN ${cache.cacheKey}Cache`,
      method: cache.loaded ? `${cache.source || 'persisted'} storage` : 'Not available',
      status: cache.loaded ? staleStatus : 'fail',
      detail: cache.staleness !== null
        ? `Last rebuilt: ${formatStaleness(cache.staleness)} | ${cache.recordCount.toLocaleString()} records`
        : 'No build timestamp available',
    });
  }

  // Step 3: QA/QC validation
  const allFresh = data.caches.every(c => c.staleness !== null && c.staleness < 1440);
  lineage.push({
    label: 'QA/QC Validation',
    description: 'Automated range checks, rate-of-change validation, and cross-source consistency',
    timestamp: formatTimestamp(data.newestBuild),
    sourceSystem: 'PIN QA Engine',
    method: data.epaMethod,
    status: allFresh ? 'pass' : 'flag',
    detail: allFresh
      ? `All ${data.caches.length} source caches within freshness threshold | ${data.epaMethod}`
      : `${data.caches.filter(c => !c.loaded || (c.staleness !== null && c.staleness > 1440)).length} cache(s) stale or unavailable`,
  });

  // Step 4: Composite scoring
  lineage.push({
    label: 'Display Value',
    description: 'Final computed value rendered on dashboard',
    timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    sourceSystem: 'PIN Dashboard',
    method: 'Real-time render from cached data',
    status: 'pass',
    detail: `Displayed: ${displayValue}${unit ? ' ' + unit : ''} | Total backing records: ${data.totalRecords.toLocaleString()}`,
  });

  return {
    metricName,
    displayValue,
    unit,
    sensorSource: data.apiEndpoint,
    sensorModel: data.agency,
    lastCalibration: data.newestBuild ? formatTimestamp(data.newestBuild) : 'N/A',
    nextCalibrationDue: data.refreshSchedule,
    epaMethod: data.epaMethod,
    qappSection: undefined,
    lineage,
    isLive: true,
    agency: data.agency,
    apiEndpoint: data.apiEndpoint,
    refreshSchedule: data.refreshSchedule,
    dataDescription: data.dataDescription,
    totalRecords: data.totalRecords,
  };
}

// ─── Fallback: generated record when API is unavailable ─────────────────────

function generateFallbackRecord(
  metricName: string,
  displayValue: string,
  unit?: string,
): ProvenanceRecord {
  const methodMap: Record<string, string> = {
    'Dissolved Oxygen': 'EPA Method 360.1 / ASTM D888',
    'Total Nitrogen': 'EPA Method 351.2',
    'Total Phosphorus': 'EPA Method 365.1',
    'Turbidity': 'EPA Method 180.1 / ASTM D6910',
    'E. coli': 'EPA Method 1103.1',
    'pH': 'EPA Method 150.1 / ASTM D1293',
    'TSS': 'EPA Method 160.2',
    'Temperature': 'ASTM D1498',
    'Flow Rate': 'USGS continuous discharge',
    'Water Quality Score': 'PIN 14-Layer Composite Index',
    'Compliance Score': 'EPA NPDES Method 40 CFR §122.26',
  };

  return {
    metricName,
    displayValue,
    unit,
    sensorSource: 'Federal API (status unavailable)',
    sensorModel: 'EPA / USGS / NOAA',
    lastCalibration: 'Unavailable — API did not respond',
    nextCalibrationDue: 'Check cache-status endpoint',
    epaMethod: methodMap[metricName] || 'EPA QA/R-5 Composite',
    lineage: [
      {
        label: 'Data Source',
        description: 'Live provenance data unavailable — showing fallback',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        sourceSystem: 'PIN API',
        method: 'Fallback mode',
        status: 'flag' as const,
        detail: 'The /api/provenance endpoint did not respond. This is a placeholder lineage.',
      },
    ],
    isLive: false,
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
  if (label.includes('Federal') || label.includes('Source')) return <Globe className={cls} />;
  if (label.includes('Cache')) return <Database className={cls} />;
  if (label.includes('QA')) return <FlaskConical className={cls} />;
  if (label.includes('Display') || label.includes('Derived')) return <Shield className={cls} />;
  if (label.includes('Sensor')) return <Activity className={cls} />;
  if (label.includes('Logger')) return <Database className={cls} />;
  if (label.includes('Transmission')) return <Cpu className={cls} />;
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
  pdf.addMetadata('Data Source', record.sensorSource);
  pdf.addMetadata('Agency', record.sensorModel);
  pdf.addMetadata('EPA Method', record.epaMethod);
  pdf.addMetadata('Last Build', record.lastCalibration);
  pdf.addMetadata('Refresh Schedule', record.nextCalibrationDue);
  if (record.totalRecords) pdf.addMetadata('Backing Records', record.totalRecords.toLocaleString());
  if (record.isLive) pdf.addMetadata('Data Status', 'LIVE — sourced from federal API cache metadata');
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
  if (record.isLive) {
    pdf.addText('This audit trail is sourced from live federal API cache metadata — not simulated data.', { fontSize: 8 });
  }
  pdf.addText('Generated by PIN — Pearl Intelligence Network.', { fontSize: 8 });

  const filename = `PIN_Provenance_${record.metricName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.download(filename);
}

// ─── ProvenanceIcon (exported for use in management centers) ────────────────

interface ProvenanceIconProps {
  metricName: string;
  displayValue: string;
  unit?: string;
  className?: string;
}

export function ProvenanceIcon({ metricName, displayValue, unit, className }: ProvenanceIconProps) {
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState<ProvenanceRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    fetch(`/api/provenance?metric=${encodeURIComponent(metricName)}`)
      .then(res => res.ok ? res.json() : null)
      .then((data: LiveProvenanceResponse | null) => {
        if (cancelled) return;
        if (data && data.caches?.length > 0) {
          setRecord(buildLiveRecord(metricName, displayValue, unit, data));
        } else {
          setRecord(generateFallbackRecord(metricName, displayValue, unit));
        }
      })
      .catch(() => {
        if (!cancelled) setRecord(generateFallbackRecord(metricName, displayValue, unit));
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, metricName, displayValue, unit]);

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

      {record && <DataProvenancePanel open={open} onOpenChange={setOpen} record={record} loading={loading} />}
      {!record && open && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-full sm:max-w-lg flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

// ─── DataProvenancePanel (the side-panel sheet) ──────────────────────────────

interface DataProvenancePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ProvenanceRecord;
  loading?: boolean;
}

export function DataProvenancePanel({ open, onOpenChange, record, loading }: DataProvenancePanelProps) {
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
            {record.isLive && (
              <Badge variant="outline" className="ml-2 border-green-300 text-green-100 text-2xs">LIVE DATA</Badge>
            )}
            {!record.isLive && (
              <Badge variant="outline" className="ml-2 border-amber-300 text-amber-100 text-2xs">FALLBACK</Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-blue-100">
            {record.isLive
              ? <>Chain-of-custody for <span className="font-semibold text-white">{record.metricName}</span> — sourced from live cache metadata</>
              : <>Audit trail for <span className="font-semibold text-white">{record.metricName}</span></>
            }
          </SheetDescription>
        </SheetHeader>

        <div className="p-5 space-y-5">

          {loading && (
            <div className="flex items-center gap-2 text-xs text-blue-500 mb-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading live provenance data...
            </div>
          )}

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
                <div className="text-2xs text-blue-500 mt-1">{record.lineage.length} steps verified</div>
              </div>
            </div>
          </div>

          {/* Source info — shows different cards for live vs fallback */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Globe className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-slate-700">Data Source</span>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>{record.sensorSource}</div>
                <div className="text-2xs text-slate-400">{record.sensorModel}</div>
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
                <span className="text-xs font-semibold text-green-700">{record.isLive ? 'Last Cache Build' : 'Last Calibration'}</span>
              </div>
              <div className="text-xs text-green-600 font-medium">{record.lastCalibration}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">{record.isLive ? 'Refresh Schedule' : 'Next Cal. Due'}</span>
              </div>
              <div className="text-xs text-amber-600 font-medium">{record.nextCalibrationDue}</div>
            </div>
          </div>

          {/* Total records badge (live only) */}
          {record.isLive && record.totalRecords !== undefined && record.totalRecords > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center gap-3">
              <Database className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-xs font-semibold text-blue-700">Backing Data Records</div>
                <div className="text-lg font-bold text-blue-900">{record.totalRecords.toLocaleString()}</div>
              </div>
              {record.dataDescription && (
                <div className="text-2xs text-blue-500 ml-auto max-w-[200px]">{record.dataDescription}</div>
              )}
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
                        <div className="absolute left-[7px] top-[28px] text-slate-300 text-2xs leading-none">▼</div>
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

                        <div className="text-2xs text-slate-500 mt-1">{step.description}</div>

                        {isExpanded && (
                          <div className="mt-3 space-y-1.5 text-xs bg-white rounded border border-slate-100 p-2.5">
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
                                <span className="block text-slate-700 font-mono text-2xs mt-0.5">{step.detail}</span>
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
            <p className="text-2xs text-slate-400 text-center mt-2">
              Audit-ready PDF for regulatory review
            </p>
          </div>

          {/* ── Compliance footer ── */}
          <div className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold mb-1">
                  {record.isLive ? 'Live Federal Data Provenance' : 'Data Provenance'}
                </h4>
                <p className="text-2xs opacity-90">
                  {record.isLive
                    ? 'This audit trail is sourced from live cache metadata — showing actual build timestamps, record counts, and data freshness from federal API integrations.'
                    : 'Provenance data is currently unavailable from the cache status API. Showing fallback information.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
