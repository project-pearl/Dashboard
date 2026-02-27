'use client';

import { useCallback, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import Papa from 'papaparse';

const CSV_TO_PEARL: Record<string, string> = {
  'dissolved_oxygen': 'DO', 'do': 'DO', 'dissolved oxygen': 'DO',
  'ph': 'pH', 'temperature': 'temperature', 'temp': 'temperature',
  'turbidity': 'turbidity', 'e_coli': 'bacteria', 'ecoli': 'bacteria',
  'total_nitrogen': 'TN', 'tn': 'TN', 'total_phosphorus': 'TP', 'tp': 'TP',
  'conductivity': 'conductivity', 'specific_conductance': 'conductivity',
};

const PEARL_KEYS = ['DO', 'pH', 'temperature', 'turbidity', 'bacteria', 'TN', 'TP', 'conductivity'] as const;

interface CSVUploadDropzoneProps {
  mode: 'citizen' | 'student';
  userId: string;
  stateAbbr: string;
  teacherUid?: string;
  onUploaded?: () => void;
}

function normalizeColumnName(col: string): string {
  return col.trim().toLowerCase().replace(/[^a-z0-9_\s]/g, '').replace(/\s+/g, '_');
}

export function CSVUploadDropzone({ mode, userId, stateAbbr, teacherUid, onUploaded }: CSVUploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    insertedCount?: number;
    errorCount?: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);

      // Parse for preview
      const parsed = Papa.parse<string[]>(text, {
        header: false,
        skipEmptyLines: true,
        preview: 6, // header + 5 data rows
      });

      if (parsed.data.length > 0) {
        const hdrs = parsed.data[0].map((h: string) => h.trim());
        setHeaders(hdrs);
        setPreview(parsed.data.slice(1, 6));

        // Auto-detect column mapping
        const mapping: Record<string, string> = {};
        for (const h of hdrs) {
          const normalized = normalizeColumnName(h);
          if (CSV_TO_PEARL[normalized]) {
            mapping[h] = CSV_TO_PEARL[normalized];
          }
        }
        setColumnMapping(mapping);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  async function handleUpload() {
    if (!csvText) return;
    setUploading(true);
    setResult(null);

    try {
      const res = await fetch('/api/uploads/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv_text: csvText,
          user_id: userId,
          user_role: mode === 'citizen' ? 'NGO' : 'K12',
          column_mapping: columnMapping,
          state_abbr: stateAbbr,
          teacher_uid: mode === 'student' ? teacherUid : undefined,
          original_file: fileName,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResult({
          success: true,
          message: `Successfully uploaded ${data.insertedCount} readings`,
          insertedCount: data.insertedCount,
          errorCount: data.errorCount,
        });
        onUploaded?.();
      } else {
        setResult({
          success: false,
          message: data.error || 'Upload failed',
          errorCount: data.errorRows?.length,
        });
      }
    } catch {
      setResult({ success: false, message: 'Network error — please try again' });
    } finally {
      setUploading(false);
    }
  }

  function clearFile() {
    setCsvText(null);
    setFileName(null);
    setPreview([]);
    setHeaders([]);
    setColumnMapping({});
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const isCitizen = mode === 'citizen';
  const accentColor = isCitizen ? 'amber' : 'indigo';
  const mappedCount = Object.keys(columnMapping).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet size={16} className={`text-${accentColor}-600`} />
          Bulk CSV Upload
        </CardTitle>
        <CardDescription>
          Upload a CSV file with water quality readings — columns are auto-detected
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drop zone */}
        {!csvText ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? `border-${accentColor}-400 bg-${accentColor}-50`
                : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <Upload size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-600 font-medium">
              Drop a CSV file here, or click to browse
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Columns like &quot;pH&quot;, &quot;dissolved_oxygen&quot;, &quot;temperature&quot; are auto-detected
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        ) : (
          <>
            {/* File info */}
            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-700">{fileName}</span>
                <Badge variant="secondary" className="text-[9px]">{preview.length} rows previewed</Badge>
              </div>
              <button onClick={clearFile} className="p-1 hover:bg-slate-200 rounded">
                <X size={14} className="text-slate-400" />
              </button>
            </div>

            {/* Column mapping */}
            <div>
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
                Column Mapping ({mappedCount} detected)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {headers.map(h => {
                  const normalized = normalizeColumnName(h);
                  const isLocation = /^(lat|latitude|lng|lon|longitude|date|sample_date|site|station|location|student|team)$/i.test(h.trim());
                  return (
                    <div key={h} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 truncate max-w-[80px]" title={h}>{h}</span>
                      <span className="text-[10px] text-slate-400">&rarr;</span>
                      {isLocation ? (
                        <Badge variant="outline" className="text-[9px] text-slate-400">auto</Badge>
                      ) : (
                        <select
                          value={columnMapping[h] || ''}
                          onChange={e => {
                            const newMapping = { ...columnMapping };
                            if (e.target.value) {
                              newMapping[h] = e.target.value;
                            } else {
                              delete newMapping[h];
                            }
                            setColumnMapping(newMapping);
                          }}
                          className="text-[10px] h-6 rounded border border-slate-200 px-1 bg-white"
                        >
                          <option value="">skip</option>
                          {PEARL_KEYS.map(pk => (
                            <option key={pk} value={pk}>{pk}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preview table */}
            {preview.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      {headers.map(h => (
                        <th key={h} className="pb-1 pr-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        {row.map((cell, j) => (
                          <td key={j} className="py-1 pr-3 text-slate-600">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Upload button */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleUpload}
                disabled={uploading || mappedCount === 0}
                className={`${isCitizen ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
              >
                {uploading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
                {uploading ? 'Uploading...' : `Upload ${mappedCount} mapped column${mappedCount !== 1 ? 's' : ''}`}
              </Button>
              {mappedCount === 0 && (
                <span className="text-[10px] text-amber-600">No parameter columns detected — map at least one</span>
              )}
            </div>

            {/* Result */}
            {result && (
              <div className={`flex items-center gap-2 p-2 rounded-md text-xs ${
                result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {result.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <span>{result.message}</span>
                {result.errorCount != null && result.errorCount > 0 && (
                  <Badge variant="secondary" className="text-[9px] ml-1">{result.errorCount} errors</Badge>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
