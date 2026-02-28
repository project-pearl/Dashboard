// components/DataExportHub.tsx
// Advanced Data Export Hub — multi-format exports, PIN API docs, standards badges, template downloads, bulk export

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Download, FileText, Database, Globe, Table2, FileJson, FileSpreadsheet,
  Calendar, ChevronDown, ChevronUp, Copy, Check, ExternalLink, Clock,
  Shield, BookOpen, Filter, Play
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ExportFormat = 'csv' | 'json' | 'wqx' | 'geojson' | 'excel';

type Props = {
  context?: 'ms4' | 'state' | 'esg' | 'university';
};

// ─── Constants ───────────────────────────────────────────────────────────────

const EXPORT_FORMATS: { id: ExportFormat; label: string; icon: any; desc: string; mime: string }[] = [
  { id: 'csv', label: 'CSV', icon: Table2, desc: 'Comma-separated values for spreadsheets', mime: 'text/csv' },
  { id: 'json', label: 'JSON', icon: FileJson, desc: 'Structured data for APIs & applications', mime: 'application/json' },
  { id: 'wqx', label: 'WQX', icon: Shield, desc: 'EPA Water Quality Exchange XML format', mime: 'application/xml' },
  { id: 'geojson', label: 'GeoJSON', icon: Globe, desc: 'Geospatial data with coordinates', mime: 'application/geo+json' },
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet, desc: 'Multi-sheet workbook (.xlsx)', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
];

const API_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/waterbodies',
    label: 'Waterbody List',
    description: 'List all monitored waterbodies with metadata, ATTAINS IDs, and coordinates',
    request: `GET /api/v1/waterbodies?state=MD&status=assessed
Accept: application/json
Authorization: Bearer <api_key>`,
    response: `{
  "data": [
    {
      "id": "back_river",
      "name": "Back River",
      "state": "MD",
      "attainsId": "MD-02130802",
      "huc12": "021301040403",
      "coordinates": [-76.468, 39.247],
      "status": "assessed",
      "category": "5 — Impaired",
      "causes": ["Nutrients", "Sediment"]
    }
  ],
  "total": 47,
  "page": 1
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/assessments',
    label: 'Assessment Data',
    description: 'EPA ATTAINS assessment records — impairment status, TMDL linkage, causes/sources',
    request: `GET /api/v1/assessments?waterbody_id=back_river&cycle=2024
Accept: application/json
Authorization: Bearer <api_key>`,
    response: `{
  "waterbody_id": "back_river",
  "cycle": "2024",
  "category": "5",
  "useAttainments": [
    {
      "designatedUse": "Aquatic Life",
      "status": "Not Supporting",
      "causes": ["Nitrogen", "Phosphorus"],
      "tmdlStatus": "TMDL Approved"
    }
  ],
  "overallStatus": "Impaired"
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/monitoring',
    label: 'Monitoring Data',
    description: 'Continuous water quality monitoring — turbidity, pH, DO, conductivity, temperature',
    request: `GET /api/v1/monitoring?waterbody_id=back_river&start=2025-01-01&end=2025-03-01&params=turbidity,do,ph
Accept: application/json
Authorization: Bearer <api_key>`,
    response: `{
  "waterbody_id": "back_river",
  "interval": "15min",
  "parameters": ["turbidity", "do", "ph"],
  "records": [
    {
      "timestamp": "2025-01-15T08:00:00Z",
      "turbidity": { "value": 12.4, "unit": "NTU" },
      "do": { "value": 8.2, "unit": "mg/L" },
      "ph": { "value": 7.3, "unit": "SU" }
    }
  ],
  "count": 5760
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/treatment',
    label: 'Treatment Metrics',
    description: 'PIN unit treatment performance — TSS/TN/TP removal, gallons processed, efficiency',
    request: `GET /api/v1/treatment?site_id=back_river&period=2025-Q1
Accept: application/json
Authorization: Bearer <api_key>`,
    response: `{
  "site_id": "back_river",
  "period": "2025-Q1",
  "gallonsTreated": 4520000,
  "removal": {
    "tss": { "lbs": 2840, "efficiency": 0.91 },
    "tn":  { "lbs": 145,  "efficiency": 0.42 },
    "tp":  { "lbs": 38,   "efficiency": 0.55 }
  },
  "uptime": 0.97,
  "pinUnits": 3
}`,
  },
];

const STANDARDS = [
  { label: 'OGC SensorThings', version: '1.1', status: 'Compliant', color: 'bg-green-100 text-green-800 border-green-300' },
  { label: 'WaterML 2.0', version: '2.0.2', status: 'Compliant', color: 'bg-green-100 text-green-800 border-green-300' },
  { label: 'WQX 3.0', version: '3.0', status: 'Compliant', color: 'bg-green-100 text-green-800 border-green-300' },
];

const TEMPLATES = [
  { name: 'MDE Annual Report', desc: 'Pre-filled MS4 annual compliance report for Maryland Dept. of the Environment', filename: 'PIN_MDE_Annual_Report_Template.xlsx', icon: '📋' },
  { name: 'EPA 303(d) Submission', desc: 'Impaired waters list submission format per EPA guidance', filename: 'PIN_EPA_303d_Template.xlsx', icon: '🏛️' },
  { name: 'NPDES DMR Template', desc: 'Discharge Monitoring Report (DMR) template for NPDES permit holders', filename: 'PIN_NPDES_DMR_Template.xlsx', icon: '📄' },
];

const PARAMETERS = [
  { id: 'tss', label: 'TSS (mg/L)' },
  { id: 'tn', label: 'Total Nitrogen' },
  { id: 'tp', label: 'Total Phosphorus' },
  { id: 'do', label: 'Dissolved Oxygen' },
  { id: 'ph', label: 'pH' },
  { id: 'turbidity', label: 'Turbidity (NTU)' },
  { id: 'conductivity', label: 'Conductivity' },
  { id: 'temp', label: 'Temperature' },
  { id: 'flow', label: 'Flow Rate' },
  { id: 'ecoli', label: 'E. coli' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function DataExportHub({ context = 'ms4' }: Props) {
  const [expandedApi, setExpandedApi] = useState<string | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done'>('idle');
  const [showApiDocs, setShowApiDocs] = useState(false);
  const [showBulkExport, setShowBulkExport] = useState(false);
  const [bulkDateStart, setBulkDateStart] = useState('2025-01-01');
  const [bulkDateEnd, setBulkDateEnd] = useState(new Date().toISOString().slice(0, 10));
  const [selectedParams, setSelectedParams] = useState<string[]>(['tss', 'tn', 'tp']);
  const [bulkFormat, setBulkFormat] = useState<ExportFormat>('csv');

  // ── Handlers ──

  const handleFormatExport = (format: ExportFormat) => {
    setSelectedFormat(format);
    setExportStatus('exporting');
    // Simulate export
    setTimeout(() => {
      setExportStatus('done');
      const fmt = EXPORT_FORMATS.find(f => f.id === format);
      const ext = format === 'wqx' ? 'xml' : format === 'excel' ? 'xlsx' : format;
      const blob = new Blob(
        [format === 'json' ? '{"data": []}' : format === 'csv' ? 'timestamp,parameter,value\n' : format === 'wqx' ? '<?xml version="1.0"?><WQX/>' : format === 'geojson' ? '{"type":"FeatureCollection","features":[]}' : ''],
        { type: fmt?.mime || 'text/plain' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PIN_Export_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTimeout(() => { setExportStatus('idle'); setSelectedFormat(null); }, 2000);
    }, 1200);
  };

  const handleCopyEndpoint = (path: string) => {
    navigator.clipboard.writeText(`https://api.pinwater.org${path}`);
    setCopiedEndpoint(path);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const toggleParam = (id: string) => {
    setSelectedParams(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleBulkExport = () => {
    setExportStatus('exporting');
    setTimeout(() => {
      setExportStatus('done');
      const ext = bulkFormat === 'wqx' ? 'xml' : bulkFormat === 'excel' ? 'xlsx' : bulkFormat;
      const blob = new Blob(
        [`Bulk export: ${selectedParams.join(',')} from ${bulkDateStart} to ${bulkDateEnd}`],
        { type: 'text/plain' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PIN_Bulk_Export_${bulkDateStart}_to_${bulkDateEnd}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTimeout(() => { setExportStatus('idle'); }, 2000);
    }, 1500);
  };

  const handleTemplateDownload = (filename: string) => {
    const blob = new Blob([`Template: ${filename}\nGenerated by PIN on ${new Date().toISOString()}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const accentColor = context === 'esg' ? 'emerald' : context === 'university' ? 'violet' : 'blue';
  const accentMap: Record<string, { border: string; bg: string; text: string; badge: string; header: string; button: string }> = {
    blue: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700 border-blue-200', header: 'bg-gradient-to-r from-blue-50 to-indigo-50', button: 'bg-blue-700 hover:bg-blue-800' },
    emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', header: 'bg-gradient-to-r from-emerald-50 to-teal-50', button: 'bg-emerald-700 hover:bg-emerald-800' },
    violet: { border: 'border-violet-200', bg: 'bg-violet-50', text: 'text-violet-800', badge: 'bg-violet-100 text-violet-700 border-violet-200', header: 'bg-gradient-to-r from-violet-50 to-purple-50', button: 'bg-violet-700 hover:bg-violet-800' },
  };
  const accent = accentMap[accentColor];

  return (
    <div className="space-y-4">

      {/* ═══ 1. EXPORT FORMAT BUTTONS ═══ */}
      <div>
        <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Export Formats
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {EXPORT_FORMATS.map(fmt => {
            const Icon = fmt.icon;
            const isActive = selectedFormat === fmt.id;
            const isDone = isActive && exportStatus === 'done';
            return (
              <button
                key={fmt.id}
                onClick={() => handleFormatExport(fmt.id)}
                disabled={exportStatus === 'exporting'}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center ${
                  isDone
                    ? 'border-green-400 bg-green-50'
                    : isActive
                    ? `${accent.border} ${accent.bg}`
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                } ${exportStatus === 'exporting' && !isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {isDone ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <Icon className={`h-5 w-5 ${isActive ? accent.text : 'text-slate-500'}`} />
                )}
                <span className={`text-xs font-bold ${isActive ? accent.text : 'text-slate-700'}`}>{fmt.label}</span>
                <span className="text-[9px] text-slate-400 leading-tight">{fmt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ 2. API DOCUMENTATION ═══ */}
      <div className={`rounded-lg border ${accent.border} overflow-hidden`}>
        <button
          onClick={() => setShowApiDocs(!showApiDocs)}
          className={`w-full flex items-center justify-between px-4 py-2.5 ${accent.header} transition-colors`}
        >
          <span className={`text-xs font-bold ${accent.text} flex items-center gap-1.5`}>
            <BookOpen className="h-3.5 w-3.5" />
            PIN API Documentation
          </span>
          {showApiDocs ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {showApiDocs && (
          <div className="p-3 space-y-2 bg-white">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] text-slate-500">Base URL: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">https://api.pinwater.org/api/v1</code></div>
              <Badge variant="outline" className="text-[9px] border-amber-300 bg-amber-50 text-amber-700">v1.0 Beta</Badge>
            </div>
            {API_ENDPOINTS.map(ep => (
              <div key={ep.path} className="rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedApi(expandedApi === ep.path ? null : ep.path)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 font-mono">{ep.method}</span>
                    <code className="text-xs text-slate-700 font-mono">{ep.path}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{ep.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyEndpoint(ep.path); }}
                      className="p-1 rounded hover:bg-slate-200 transition-colors"
                      title="Copy endpoint URL"
                    >
                      {copiedEndpoint === ep.path ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-slate-400" />}
                    </button>
                  </div>
                </button>
                {expandedApi === ep.path && (
                  <div className="border-t border-slate-200 px-3 py-2 space-y-2 bg-slate-50/50">
                    <p className="text-[10px] text-slate-600">{ep.description}</p>
                    <div>
                      <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Request</div>
                      <pre className="bg-slate-900 text-green-400 text-[10px] p-2.5 rounded-md overflow-x-auto font-mono leading-relaxed">{ep.request}</pre>
                    </div>
                    <div>
                      <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Response</div>
                      <pre className="bg-slate-900 text-amber-300 text-[10px] p-2.5 rounded-md overflow-x-auto font-mono leading-relaxed">{ep.response}</pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="text-[9px] text-slate-400 flex items-center gap-1 pt-1">
              <ExternalLink className="h-2.5 w-2.5" />
              Full API reference at docs.pinwater.org/api
            </div>
          </div>
        )}
      </div>

      {/* ═══ 3. STANDARDS COMPLIANCE BADGES ═══ */}
      <div>
        <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          Standards Compliance
        </div>
        <div className="flex flex-wrap gap-2">
          {STANDARDS.map(std => (
            <div key={std.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${std.color}`}>
              <Check className="h-3.5 w-3.5" />
              <div>
                <div className="text-xs font-bold">{std.label}</div>
                <div className="text-[9px] opacity-75">v{std.version} · {std.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 4. TEMPLATE DOWNLOADS ═══ */}
      <div>
        <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Regulatory Templates
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.name}
              onClick={() => handleTemplateDownload(tpl.filename)}
              className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-left group"
            >
              <span className="text-lg">{tpl.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{tpl.name}</div>
                <div className="text-[9px] text-slate-500 leading-tight mt-0.5">{tpl.desc}</div>
                <div className="flex items-center gap-1 mt-1.5 text-[9px] text-blue-600 font-medium">
                  <Download className="h-2.5 w-2.5" />
                  {tpl.filename}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ 5. BULK EXPORT WITH DATE RANGE & PARAMETER SELECTOR ═══ */}
      <div className={`rounded-lg border ${accent.border} overflow-hidden`}>
        <button
          onClick={() => setShowBulkExport(!showBulkExport)}
          className={`w-full flex items-center justify-between px-4 py-2.5 ${accent.header} transition-colors`}
        >
          <span className={`text-xs font-bold ${accent.text} flex items-center gap-1.5`}>
            <Database className="h-3.5 w-3.5" />
            Bulk Data Export
          </span>
          {showBulkExport ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {showBulkExport && (
          <div className="p-4 space-y-3 bg-white">
            {/* Date range */}
            <div>
              <div className="text-[10px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Date Range
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={bulkDateStart}
                  onChange={e => setBulkDateStart(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-md border border-slate-300 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={bulkDateEnd}
                  onChange={e => setBulkDateEnd(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-md border border-slate-300 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
            </div>

            {/* Parameter selector */}
            <div>
              <div className="text-[10px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Parameters ({selectedParams.length} selected)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PARAMETERS.map(p => {
                  const isSelected = selectedParams.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleParam(p.id)}
                      className={`px-2 py-1 rounded-full text-[10px] font-medium border transition-all ${
                        isSelected
                          ? `${accent.badge}`
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Format selector + export button */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-slate-600 mb-1.5">Output Format</div>
                <div className="flex gap-1.5">
                  {EXPORT_FORMATS.map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => setBulkFormat(fmt.id)}
                      className={`px-2.5 py-1.5 rounded-md text-[10px] font-semibold border transition-all ${
                        bulkFormat === fmt.id
                          ? `${accent.badge}`
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleBulkExport}
                disabled={exportStatus === 'exporting' || selectedParams.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors shadow-sm ${accent.button} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {exportStatus === 'exporting' ? (
                  <>
                    <Clock className="h-3.5 w-3.5 animate-spin" />
                    Exporting...
                  </>
                ) : exportStatus === 'done' ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Done!
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Export Bulk Data
                  </>
                )}
              </button>
            </div>

            {/* Estimated size */}
            <div className="text-[9px] text-slate-400 flex items-center gap-1">
              <Database className="h-2.5 w-2.5" />
              Estimated export: ~{selectedParams.length * 12}K records ({Math.round(((new Date(bulkDateEnd).getTime() - new Date(bulkDateStart).getTime()) / (1000 * 60 * 60 * 24)))} days x {selectedParams.length} params x 96 readings/day)
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
