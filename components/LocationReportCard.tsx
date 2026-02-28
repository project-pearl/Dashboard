'use client';

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search, MapPin, Droplets, Shield, Activity, Waves, FlaskConical,
  Factory, AlertTriangle, FileBarChart, ChevronDown, ChevronRight,
  Loader2, XCircle,
} from 'lucide-react';
import type { LocationReport } from '@/lib/locationReport';
import { STATE_NAMES, NAME_TO_ABBR, STATE_GEO_LEAFLET } from '@/lib/mapUtils';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// ── Input type detection ────────────────────────────────────────────────────

type InputType = 'coords' | 'zip' | 'state' | 'address';

function detectInputType(input: string): InputType {
  const trimmed = input.trim();
  if (/^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(trimmed)) return 'coords';
  if (/^\d{5}$/.test(trimmed)) return 'zip';
  const upper = trimmed.toUpperCase();
  if (STATE_NAMES[upper]) return 'state';
  const titleCase = trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  if (NAME_TO_ABBR[titleCase]) return 'state';
  return 'address';
}

const TYPE_LABELS: Record<InputType, string> = {
  coords: 'Coordinates',
  zip: 'ZIP Code',
  state: 'State',
  address: 'Address',
};

// ── Collapsible section helper ──────────────────────────────────────────────

function ReportSection({
  title, icon, children, defaultOpen = true, count,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        {icon}
        <span className="font-medium text-sm">{title}</span>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="ml-auto text-xs">{count}</Badge>
        )}
      </button>
      {open && <div className="px-4 py-3 text-sm">{children}</div>}
    </div>
  );
}

function NoData() {
  return <p className="text-muted-foreground text-xs italic">No data near this location</p>;
}

// ── Risk signal computation ─────────────────────────────────────────────────

function computeRisk(report: LocationReport): 'high' | 'medium' | 'low' {
  const violations = (report.sources.sdwis?.violations.length || 0) +
    (report.sources.icis?.violations.length || 0);
  const pfas = report.sources.pfas?.results.filter(r => r.detected).length || 0;
  if (violations > 5 || pfas > 3) return 'high';
  if (violations > 0 || pfas > 0) return 'medium';
  return 'low';
}

const RISK_COLORS = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

// ── Main component ──────────────────────────────────────────────────────────

export default function LocationReportCard() {
  const [query, setQuery] = useState('');
  const [inputType, setInputType] = useState<InputType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LocationReport | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced input type detection
  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        setInputType(detectInputType(value));
      } else {
        setInputType(null);
      }
    }, 300);
  }, []);

  // Geocode address via Mapbox
  const geocodeAddress = useCallback(async (address: string): Promise<{ lat: number; lng: number; state: string; label: string } | null> => {
    if (!MAPBOX_TOKEN) return null;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&country=US&limit=1`
      );
      if (!res.ok) return null;
      const data = await res.json();
      const feature = data?.features?.[0];
      if (!feature) return null;
      const [lng, lat] = feature.center;
      // Extract state from context
      const regionCtx = feature.context?.find((c: { id: string }) => c.id?.startsWith('region'));
      const code = regionCtx?.short_code as string | undefined;
      const state = code?.startsWith('US-') ? code.slice(3) : '';
      return { lat, lng, state, label: feature.place_name || address };
    } catch {
      return null;
    }
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const type = detectInputType(trimmed);
      let apiUrl = '/api/location-report?';

      switch (type) {
        case 'coords': {
          const [lat, lng] = trimmed.split(',').map(s => parseFloat(s.trim()));
          apiUrl += `lat=${lat}&lng=${lng}`;
          break;
        }
        case 'zip': {
          apiUrl += `zip=${trimmed}`;
          break;
        }
        case 'state': {
          const upper = trimmed.toUpperCase();
          let abbr = STATE_NAMES[upper] ? upper : '';
          if (!abbr) {
            const titleCase = trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            abbr = NAME_TO_ABBR[titleCase] || '';
          }
          if (!abbr) { setError('Unknown state'); setLoading(false); return; }
          const geo = STATE_GEO_LEAFLET[abbr];
          if (!geo) { setError('No coordinates for state'); setLoading(false); return; }
          apiUrl += `lat=${geo.center[0]}&lng=${geo.center[1]}&state=${abbr}`;
          break;
        }
        case 'address': {
          const geo = await geocodeAddress(trimmed);
          if (!geo) { setError('Could not geocode address'); setLoading(false); return; }
          apiUrl += `lat=${geo.lat}&lng=${geo.lng}`;
          if (geo.state) apiUrl += `&state=${geo.state}`;
          break;
        }
      }

      const res = await fetch(apiUrl);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const data: LocationReport = await res.json();
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [query, geocodeAddress]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Water Quality Report
        </CardTitle>
        <CardDescription>
          Search any US location to get a unified water quality report from 14+ federal data sources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter ZIP, address, coordinates, or state..."
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {inputType && (
              <Badge variant="outline" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs">
                {TYPE_LABELS[inputType]}
              </Badge>
            )}
          </div>
          <Button onClick={handleSearch} disabled={loading || !query.trim()} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Try: <button className="underline" onClick={() => { handleInputChange('21201'); setQuery('21201'); }}>21201</button>
          {' · '}
          <button className="underline" onClick={() => { handleInputChange('Baltimore, MD'); setQuery('Baltimore, MD'); }}>Baltimore, MD</button>
          {' · '}
          <button className="underline" onClick={() => { handleInputChange('39.29, -76.61'); setQuery('39.29, -76.61'); }}>39.29, -76.61</button>
          {' · '}
          <button className="underline" onClick={() => { handleInputChange('Maryland'); setQuery('Maryland'); }}>Maryland</button>
        </p>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Report */}
        {report && (
          <div className="space-y-3">
            {/* Summary strip */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-lg">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{report.location.label}</span>
              {report.location.state && <Badge variant="outline">{report.location.state}</Badge>}
              <span className="text-xs text-muted-foreground">
                {report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)}
              </span>
              <Badge
                className={`ml-auto ${RISK_COLORS[computeRisk(report)]}`}
                title={computeRisk(report) === 'high'
                  ? 'Multiple violations or PFAS detections found near this location'
                  : computeRisk(report) === 'medium'
                  ? 'Some violations or PFAS detections found near this location'
                  : 'No significant water quality concerns detected nearby'}
              >
                {computeRisk(report) === 'high' ? 'Elevated Risk' : computeRisk(report) === 'medium' ? 'Moderate Risk' : 'Low Risk'}
              </Badge>
            </div>

            {/* Drinking Water */}
            <ReportSection
              title="Drinking Water"
              icon={<Droplets className="h-4 w-4 text-blue-500" />}
              count={(report.sources.sdwis?.systems.length || 0) + (report.sources.pfas?.results.length || 0)}
            >
              {report.sources.sdwis ? (
                <div className="space-y-2">
                  <p><strong>{report.sources.sdwis.systems.length}</strong> public water systems nearby</p>
                  {report.sources.sdwis.violations.length > 0 && (
                    <p className="text-red-600 dark:text-red-400">
                      <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                      {report.sources.sdwis.violations.length} violation(s) reported
                    </p>
                  )}
                  {report.sources.sdwis.systems.slice(0, 5).map(s => (
                    <div key={s.pwsid} className="flex items-center gap-2 text-xs">
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        title={s.type === 'CWS' ? 'Community Water System — serves year-round residents'
                          : s.type === 'NTNCWS' ? 'Non-Transient Non-Community Water System — serves the same people regularly (e.g. schools, offices)'
                          : s.type === 'TNCWS' ? 'Transient Non-Community Water System — serves transient visitors (e.g. gas stations, campgrounds)'
                          : s.type}
                      >{s.type}</Badge>
                      <span className="truncate">{s.name}</span>
                      <span className="text-muted-foreground ml-auto">Pop: {s.population?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : <NoData />}
              {report.sources.pfas && report.sources.pfas.results.length > 0 && (() => {
                const detected = report.sources.pfas.results.filter(r => r.detected).length;
                const total = report.sources.pfas.results.length;
                const pct = Math.round((detected / total) * 100);
                const isHigh = pct >= 80;
                return (
                  <div className={`mt-2 pt-2 border-t ${isHigh ? 'bg-red-50 dark:bg-red-950/20 -mx-4 px-4 -mb-3 pb-3 rounded-b-lg' : ''}`}>
                    <p className={`font-medium text-xs ${isHigh ? 'text-red-700 dark:text-red-300' : 'text-orange-600 dark:text-orange-400'}`}>
                      {isHigh && <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />}
                      PFAS: {detected} detection{detected !== 1 ? 's' : ''} out of {total} sample{total !== 1 ? 's' : ''} ({pct}%)
                    </p>
                    {isHigh && (
                      <p className="text-[10px] text-red-600/80 dark:text-red-400/80 mt-0.5">
                        High PFAS detection rate — review source water and treatment options
                      </p>
                    )}
                  </div>
                );
              })()}
            </ReportSection>

            {/* Stream Conditions */}
            <ReportSection
              title="Stream Conditions"
              icon={<Waves className="h-4 w-4 text-cyan-500" />}
              count={report.sources.nwisIv?.sites.length || 0}
            >
              {report.sources.nwisIv ? (
                <div className="space-y-2">
                  <p><strong>{report.sources.nwisIv.sites.length}</strong> USGS gauge(s) nearby</p>
                  {report.sources.nwisIv.readings.slice(0, 8).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">{r.parameterName}</Badge>
                      <span>{r.value} {r.unit}</span>
                      <span
                        className="text-muted-foreground ml-auto cursor-help"
                        title={r.qualifier === 'P'
                          ? 'Provisional — data not yet reviewed and subject to revision'
                          : 'Approved — data has been reviewed and accepted by USGS'}
                      >{r.qualifier === 'P' ? 'Provisional' : 'Approved'}</span>
                    </div>
                  ))}
                </div>
              ) : <NoData />}
            </ReportSection>

            {/* Water Quality Monitoring */}
            <ReportSection
              title="Water Quality Monitoring"
              icon={<FlaskConical className="h-4 w-4 text-purple-500" />}
              count={report.sources.wqp?.records.length || 0}
            >
              {report.sources.wqp ? (
                <div className="space-y-1">
                  <p><strong>{report.sources.wqp.records.length}</strong> WQP monitoring record(s)</p>
                  {(() => {
                    const params = new Map<string, number>();
                    report.sources.wqp.records.forEach(r => params.set(r.key, (params.get(r.key) || 0) + 1));
                    const sorted = [...params.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
                    return (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sorted.map(([key, count]) => (
                          <Badge key={key} variant="secondary" className="text-[10px]">{key}: {count}</Badge>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : <NoData />}
            </ReportSection>

            {/* Permit Compliance */}
            <ReportSection
              title="Permit Compliance"
              icon={<Shield className="h-4 w-4 text-indigo-500" />}
              count={(report.sources.icis?.permits.length || 0) + (report.sources.echo?.facilities.length || 0)}
            >
              {report.sources.icis ? (
                <div className="space-y-1">
                  <p><strong>{report.sources.icis.permits.length}</strong> NPDES permit(s)</p>
                  {report.sources.icis.violations.length > 0 && (
                    <p className="text-red-600 dark:text-red-400 text-xs">
                      {report.sources.icis.violations.length} violation(s) found
                    </p>
                  )}
                  {report.sources.icis.permits.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px] shrink-0">{(p as any).permitId || (p as any).npdesId || (p as any).externalPermitNmbr || `Permit ${i + 1}`}</Badge>
                      <span className="truncate">{(p as any).facilityName || (p as any).name || ''}</span>
                      <Badge
                        variant={(p as any).status === 'Effective' ? 'default' : 'secondary'}
                        className="text-[10px] ml-auto shrink-0"
                      >{(p as any).status || (p as any).permitStatus || 'Active'}</Badge>
                    </div>
                  ))}
                </div>
              ) : null}
              {report.sources.echo ? (
                <div className={`space-y-1 ${report.sources.icis ? 'mt-2 pt-2 border-t' : ''}`}>
                  <p><strong>{report.sources.echo.facilities.length}</strong> ECHO facility(ies)</p>
                  {report.sources.echo.violations.length > 0 && (
                    <p className="text-red-600 dark:text-red-400 text-xs">
                      {report.sources.echo.violations.length} compliance violation(s)
                    </p>
                  )}
                  {report.sources.echo.facilities.slice(0, 5).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="truncate">{(f as any).facilityName || (f as any).name || `Facility ${i + 1}`}</span>
                      <Badge
                        variant={(f as any).complianceStatus === 'No Violation' ? 'default' : 'destructive'}
                        className="text-[10px] ml-auto shrink-0"
                      >{(f as any).complianceStatus || (f as any).status || 'Unknown'}</Badge>
                    </div>
                  ))}
                </div>
              ) : null}
              {!report.sources.icis && !report.sources.echo && <NoData />}
            </ReportSection>

            {/* Groundwater */}
            <ReportSection
              title="Groundwater"
              icon={<Activity className="h-4 w-4 text-teal-500" />}
              defaultOpen={false}
              count={report.sources.nwisGw?.sites.length || 0}
            >
              {report.sources.nwisGw && report.sources.nwisGw.sites.length > 0 ? (
                <div className="space-y-1">
                  <p><strong>{report.sources.nwisGw.sites.length}</strong> USGS WDFN monitoring well(s)</p>
                  {report.sources.nwisGw.trends.slice(0, 5).map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="truncate">{t.siteName}</span>
                      <Badge variant={t.trend === 'falling' ? 'destructive' : t.trend === 'rising' ? 'default' : 'secondary'} className="text-[10px] ml-auto">
                        {t.trend}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs italic">
                  No USGS WDFN groundwater monitoring wells cached near this location
                </p>
              )}
            </ReportSection>

            {/* Toxic Releases */}
            <ReportSection
              title="Toxic Releases"
              icon={<Factory className="h-4 w-4 text-orange-500" />}
              defaultOpen={false}
              count={(report.sources.tri?.facilities.length || 0) + (report.sources.frs?.facilities.length || 0)}
            >
              {report.sources.tri && report.sources.tri.facilities.length > 0 ? (
                <div className="space-y-1">
                  <p><strong>{report.sources.tri.facilities.length}</strong> TRI facility(ies)</p>
                  {report.sources.tri.facilities.slice(0, 5).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="truncate">{f.facilityName}</span>
                      <span className="text-muted-foreground ml-auto">{f.totalReleases.toLocaleString()} lbs</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {report.sources.frs && report.sources.frs.facilities.length > 0 && (
                <div className={report.sources.tri && report.sources.tri.facilities.length > 0 ? 'mt-2 pt-2 border-t' : ''}>
                  <p><strong>{report.sources.frs.facilities.length}</strong> FRS registered facility(ies)</p>
                </div>
              )}
              {(!report.sources.tri || report.sources.tri.facilities.length === 0) &&
               (!report.sources.frs || report.sources.frs.facilities.length === 0) && (
                <p className="text-muted-foreground text-xs italic">
                  No EPA TRI or FRS facilities cached near this location
                </p>
              )}
            </ReportSection>

            {/* Environmental Justice */}
            <ReportSection
              title="Environmental Justice"
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              defaultOpen={false}
            >
              {report.sources.ejscreen ? (
                <div className="space-y-1">
                  {(() => {
                    const raw = report.sources.ejscreen as Record<string, unknown>;
                    // EJScreen returns data nested in various formats — try multiple access paths
                    const rObj = (raw?.RAW_D_INCOME != null) ? raw
                      : (raw as any)?.data != null ? (raw as any).data
                      : (raw as any)?.results?.[0] ?? null;
                    if (!rObj) {
                      // Check if there's any useful data in the raw response
                      const keys = Object.keys(raw).filter(k => k !== 'status' && k !== 'error');
                      if (keys.length === 0) return <p className="text-muted-foreground text-xs italic">EJScreen returned no data for this location</p>;
                      return <p className="text-xs">EJScreen data received — {keys.length} field(s)</p>;
                    }
                    const items: [string, string, unknown][] = [
                      ['EJ Index', 'Combined environmental and demographic percentile', rObj.T_OVR64_PCT ?? rObj.EJ_INDEX_PCT],
                      ['Low Income %', 'Percentage of population below poverty level', rObj.T_LOWINC_PCT ?? rObj.LOWINC_PCT],
                      ['People of Color %', 'Percentage minority population', rObj.T_MINORI_PCT ?? rObj.MINORI_PCT],
                      ['PM2.5', 'Particulate matter 2.5 microns percentile', rObj.T_PM25_PCT ?? rObj.PM25_PCT],
                      ['Wastewater Discharge', 'Wastewater discharge indicator percentile', rObj.T_DWATER_PCT ?? rObj.DWATER_PCT],
                      ['Superfund Proximity', 'Proximity to Superfund sites', rObj.T_PNPL_PCT ?? rObj.PNPL_PCT],
                    ];
                    const filtered = items.filter(([,, v]) => v != null);
                    if (filtered.length === 0) return <p className="text-muted-foreground text-xs italic">EJScreen data structure not recognized</p>;
                    return filtered.map(([label, tooltip, v]) => (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className="cursor-help" title={tooltip}>{label}</span>
                        <span className="font-medium">{typeof v === 'number' ? (v <= 1 ? `${(v * 100).toFixed(0)}th %ile` : `${v.toFixed(0)}th %ile`) : String(v)}</span>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs italic">
                  EJScreen data unavailable — EPA EJScreen API may be temporarily offline
                </p>
              )}
            </ReportSection>

            {/* State Overview */}
            <ReportSection
              title="State Overview"
              icon={<FileBarChart className="h-4 w-4 text-slate-500" />}
              defaultOpen={false}
            >
              {report.sources.stateReport || report.sources.attains ? (
                <div className="space-y-1">
                  {report.sources.stateReport && (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span>Coverage Grade</span>
                        <Badge variant="outline">{report.sources.stateReport.coverageGrade}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Monitored Waterbodies</span>
                        <span>{report.sources.stateReport.monitoredPct.toFixed(0)}%</span>
                      </div>
                    </>
                  )}
                  {/* Prefer ATTAINS impaired count (more accurate) over stateReport */}
                  {report.sources.attains ? (
                    <div className={report.sources.stateReport ? 'mt-2 pt-2 border-t space-y-1' : 'space-y-1'}>
                      <div className="flex items-center justify-between text-xs">
                        <span>Assessed Waterbodies</span>
                        <span className="font-medium">{report.sources.attains.total.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Impaired</span>
                        <span className="font-medium text-red-600 dark:text-red-400">{report.sources.attains.impaired.toLocaleString()}</span>
                      </div>
                      {report.sources.attains.total > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span>Impairment Rate</span>
                          <span className="font-medium">{((report.sources.attains.impaired / report.sources.attains.total) * 100).toFixed(1)}%</span>
                        </div>
                      )}
                      {report.sources.attains.topCauses.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[10px] text-muted-foreground mb-1">Top Causes of Impairment</p>
                          <div className="flex flex-wrap gap-1">
                            {report.sources.attains.topCauses.slice(0, 5).map(c => (
                              <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">Source: EPA ATTAINS</p>
                    </div>
                  ) : report.sources.stateReport && report.sources.stateReport.impairedCount > 0 ? (
                    <div className="flex items-center justify-between text-xs">
                      <span>Impaired</span>
                      <span>{report.sources.stateReport.impairedCount.toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>
              ) : <NoData />}
            </ReportSection>

            {/* NDBC */}
            {report.sources.ndbc && report.sources.ndbc.stations.length > 0 && (
              <ReportSection
                title="Marine Buoys"
                icon={<Waves className="h-4 w-4 text-blue-400" />}
                defaultOpen={false}
                count={report.sources.ndbc.stations.length}
              >
                <div className="space-y-1">
                  {report.sources.ndbc.stations.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <span className="truncate">{s.name || s.id}</span>
                      {s.observation?.waterTemp != null && <span>{s.observation.waterTemp}°C</span>}
                      <Badge variant="outline" className="text-[10px] ml-auto">{s.type}</Badge>
                    </div>
                  ))}
                </div>
              </ReportSection>
            )}

            {/* NARS */}
            {report.sources.nars && report.sources.nars.sites.length > 0 && (
              <ReportSection
                title="National Aquatic Surveys"
                icon={<FlaskConical className="h-4 w-4 text-emerald-500" />}
                defaultOpen={false}
                count={report.sources.nars.sites.length}
              >
                <div className="space-y-1">
                  {report.sources.nars.sites.slice(0, 5).map(s => (
                    <div key={s.uniqueId} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">{s.survey}</Badge>
                      <span className="truncate">{s.name || s.siteId}</span>
                      <span className="text-muted-foreground ml-auto">{s.surveyYear}</span>
                    </div>
                  ))}
                </div>
              </ReportSection>
            )}

            <p className="text-[10px] text-muted-foreground text-right">
              Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
