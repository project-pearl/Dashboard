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
              <Badge className={`ml-auto ${RISK_COLORS[computeRisk(report)]}`}>
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
                      <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                      <span className="truncate">{s.name}</span>
                      <span className="text-muted-foreground ml-auto">Pop: {s.population?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : <NoData />}
              {report.sources.pfas && report.sources.pfas.results.length > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-orange-600 dark:text-orange-400 font-medium text-xs">
                    PFAS: {report.sources.pfas.results.filter(r => r.detected).length} detection(s) out of {report.sources.pfas.results.length} sample(s)
                  </p>
                </div>
              )}
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
                      <span className="text-muted-foreground ml-auto">{r.qualifier === 'P' ? 'Provisional' : 'Approved'}</span>
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
                </div>
              ) : <NoData />}
              {report.sources.echo ? (
                <div className="mt-2 pt-2 border-t space-y-1">
                  <p><strong>{report.sources.echo.facilities.length}</strong> ECHO facility(ies)</p>
                  {report.sources.echo.violations.length > 0 && (
                    <p className="text-red-600 dark:text-red-400 text-xs">
                      {report.sources.echo.violations.length} compliance violation(s)
                    </p>
                  )}
                </div>
              ) : null}
            </ReportSection>

            {/* Groundwater */}
            <ReportSection
              title="Groundwater"
              icon={<Activity className="h-4 w-4 text-teal-500" />}
              defaultOpen={false}
              count={report.sources.nwisGw?.sites.length || 0}
            >
              {report.sources.nwisGw ? (
                <div className="space-y-1">
                  <p><strong>{report.sources.nwisGw.sites.length}</strong> monitoring well(s)</p>
                  {report.sources.nwisGw.trends.slice(0, 5).map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="truncate">{t.siteName}</span>
                      <Badge variant={t.trend === 'falling' ? 'destructive' : t.trend === 'rising' ? 'default' : 'secondary'} className="text-[10px] ml-auto">
                        {t.trend}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : <NoData />}
            </ReportSection>

            {/* Toxic Releases */}
            <ReportSection
              title="Toxic Releases"
              icon={<Factory className="h-4 w-4 text-orange-500" />}
              defaultOpen={false}
              count={(report.sources.tri?.facilities.length || 0) + (report.sources.frs?.facilities.length || 0)}
            >
              {report.sources.tri ? (
                <div className="space-y-1">
                  <p><strong>{report.sources.tri.facilities.length}</strong> TRI facility(ies)</p>
                  {report.sources.tri.facilities.slice(0, 5).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="truncate">{f.facilityName}</span>
                      <span className="text-muted-foreground ml-auto">{f.totalReleases.toLocaleString()} lbs</span>
                    </div>
                  ))}
                </div>
              ) : <NoData />}
              {report.sources.frs && report.sources.frs.facilities.length > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <p><strong>{report.sources.frs.facilities.length}</strong> FRS registered facility(ies)</p>
                </div>
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
                    // EJScreen returns nested data — try to extract key percentiles
                    const rObj = (raw?.RAW_D_INCOME != null) ? raw : (raw as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
                    if (!rObj) return <p className="text-xs">EJScreen data received (see raw response for details)</p>;
                    const items: [string, unknown][] = [
                      ['EJ Index', rObj.T_OVR64_PCT],
                      ['Low Income %', rObj.T_LOWINC_PCT],
                      ['People of Color %', rObj.T_MINORI_PCT],
                      ['PM2.5', rObj.T_PM25_PCT],
                      ['Wastewater Discharge', rObj.T_DWATER_PCT],
                    ];
                    return items
                      .filter(([, v]) => v != null)
                      .map(([label, v]) => (
                        <div key={label} className="flex items-center justify-between text-xs">
                          <span>{label}</span>
                          <span className="font-medium">{typeof v === 'number' ? `${(v * 100).toFixed(0)}th %ile` : String(v)}</span>
                        </div>
                      ));
                  })()}
                </div>
              ) : <NoData />}
            </ReportSection>

            {/* State Overview */}
            <ReportSection
              title="State Overview"
              icon={<FileBarChart className="h-4 w-4 text-slate-500" />}
              defaultOpen={false}
            >
              {report.sources.stateReport ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>Coverage Grade</span>
                    <Badge variant="outline">{report.sources.stateReport.coverageGrade}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Monitored Waterbodies</span>
                    <span>{report.sources.stateReport.monitoredPct.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Impaired</span>
                    <span>{report.sources.stateReport.impairedCount.toLocaleString()}</span>
                  </div>
                </div>
              ) : <NoData />}
              {report.sources.attains ? (
                <div className="mt-2 pt-2 border-t space-y-1">
                  <p className="text-xs">
                    <strong>{report.sources.attains.impaired.toLocaleString()}</strong> impaired of <strong>{report.sources.attains.total.toLocaleString()}</strong> assessed
                  </p>
                  {report.sources.attains.topCauses.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {report.sources.attains.topCauses.slice(0, 5).map(c => (
                        <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
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
