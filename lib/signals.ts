// lib/signals.ts
// Server-side signal aggregator for PEARL NCC
// Fetches breaking/recent signals from authoritative water-related feeds
// Returns metadata only — links out to canonical source pages
//
// Sources:
//   1. USCG Marine Safety Information Bulletins (RSS)
//   2. EPA BEACON 2.0 beach advisories (REST API)
//   3. NOAA HAB monitoring & event products (RSS)
//   4. EPA Newsroom water-related releases (RSS)
//
// Design: "Signals, not articles." Store title + metadata + match, link out.

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Signal {
  id: string;
  source: 'uscg' | 'beacon' | 'noaa-hab' | 'epa-news'
    | 'nwps' | 'coops' | 'ndbc' | 'snotel' | 'cdc-nwss'
    | 'echo' | 'pfas' | 'tri' | 'usace' | 'bwb';
  sourceLabel: string;
  category: 'spill' | 'bacteria' | 'hab' | 'enforcement' | 'advisory'
    | 'safety' | 'regulatory' | 'general'
    | 'flood' | 'contamination';
  title: string;
  summary: string;          // 1-2 sentence max
  publishedAt: string;      // ISO
  url: string;              // canonical link to authoritative page
  state?: string;           // 2-letter abbr if determinable
  waterbody?: string;       // matched waterbody name if determinable
  pearlRelevant: boolean;   // matches a PEARL-solvable category
  tags: string[];
  confidence: number;       // 0-1, how confident the state/waterbody match is
}

export interface SignalResponse {
  signals: Signal[];
  fetchedAt: string;
  sources: { name: string; status: 'ok' | 'error' | 'timeout'; count: number }[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT = 15_000;

const PEARL_KEYWORDS = [
  'bacteria', 'enterococcus', 'e. coli', 'fecal', 'coliform',
  'algal bloom', 'hab', 'harmful algal', 'cyanobacteria', 'red tide', 'blue-green algae',
  'spill', 'discharge', 'overflow', 'sso', 'cso', 'bypass', 'sewage',
  'stormwater', 'ms4', 'npdes', 'tmdl', 'impaired',
  'beach closure', 'beach advisory', 'swimming advisory', 'water contact',
  'turbidity', 'suspended solids', 'nutrient', 'nitrogen', 'phosphorus',
  'fish kill', 'low oxygen', 'hypoxia', 'dissolved oxygen',
  'consent decree', 'enforcement', 'violation', 'penalty', 'fine',
  'water quality', 'clean water act', 'cwa',
];

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function extractState(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [name, abbr] of Object.entries(STATE_NAMES)) {
    if (lower.includes(name)) return abbr;
  }
  const abbrMatch = text.match(/\b([A-Z]{2})\b/);
  if (abbrMatch && Object.values(STATE_NAMES).includes(abbrMatch[1])) {
    return abbrMatch[1];
  }
  return undefined;
}

function categorize(title: string, summary: string): Signal['category'] {
  const t = `${title} ${summary}`.toLowerCase();
  if (/spill|discharge|overflow|sso|cso|bypass|sewage|leak/.test(t)) return 'spill';
  if (/bacteria|enterococcus|e\. coli|fecal|coliform|beach clos|beach advis|swimming/.test(t)) return 'bacteria';
  if (/algal|hab|cyanobact|red tide|blue.green|bloom/.test(t)) return 'hab';
  if (/enforce|violation|penalty|fine|consent decree|settlement/.test(t)) return 'enforcement';
  if (/advisory|warning|alert|caution/.test(t)) return 'advisory';
  if (/safety zone|restrict|navigation|dredg/.test(t)) return 'safety';
  if (/permit|rule|regulat|tmdl|npdes|ms4/.test(t)) return 'regulatory';
  return 'general';
}

function isPearlRelevant(title: string, summary: string): boolean {
  const t = `${title} ${summary}`.toLowerCase();
  return PEARL_KEYWORDS.some(kw => t.includes(kw));
}

function mkId(src: string, raw: string): string {
  return `${src}-${raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}-${Date.now().toString(36).slice(-4)}`;
}

function safeDate(d: string | undefined): string {
  if (!d) return new Date().toISOString();
  try { return new Date(d).toISOString(); } catch { return new Date().toISOString(); }
}

// Minimal XML parsing (avoids adding xml2js dependency)
function xmlVal(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
}

function xmlItems(xml: string, tag = 'item'): string[] {
  const items: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
  let m;
  while ((m = re.exec(xml)) !== null) items.push(m[0]);
  return items;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

// ─── Source 1: USCG Marine Safety Information Bulletins ─────────────────────────

async function fetchUSCG(): Promise<Signal[]> {
  const feeds = [
    'https://www.navcen.uscg.gov/sites/default/files/rss/lnm.xml',
    'https://www.navcen.uscg.gov/sites/default/files/rss/msib.xml',
  ];

  const signals: Signal[] = [];

  for (const url of feeds) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
        headers: { Accept: 'application/xml, text/xml' },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const xml = await res.text();

      for (const item of xmlItems(xml).slice(0, 15)) {
        const title = stripHtml(xmlVal(item, 'title'));
        const desc = stripHtml(xmlVal(item, 'description')).slice(0, 300);
        const link = xmlVal(item, 'link');
        const pubDate = xmlVal(item, 'pubDate');
        if (!title) continue;

        const combined = `${title} ${desc}`;
        const state = extractState(combined);
        const cat = categorize(title, desc);
        const pearl = isPearlRelevant(title, desc);

        signals.push({
          id: mkId('uscg', title),
          source: 'uscg',
          sourceLabel: 'USCG Marine Safety',
          category: cat,
          title: title.slice(0, 200),
          summary: desc.slice(0, 250),
          publishedAt: safeDate(pubDate),
          url: link || url,
          state,
          pearlRelevant: pearl,
          tags: ['maritime', 'safety', cat],
          confidence: state ? 0.7 : 0.3,
        });
      }
    } catch (e: any) {
      console.warn(`[Signals] USCG feed error:`, e.message);
    }
  }

  return signals;
}

// ─── Source 2: EPA BEACON Beach Advisories ──────────────────────────────────────

async function fetchBeacon(): Promise<Signal[]> {
  try {
    const url = `https://watersgeo.epa.gov/beacon2/BEACON2_BEACH_DATA_SERVICE/query?where=ADVISORY_IND%3D'Y'+OR+CLOSURE_IND%3D'Y'&outFields=BEACH_NAME,STATE_NAME,ADVISORY_IND,CLOSURE_IND,NOTIFICATION_DATE&orderByFields=NOTIFICATION_DATE+DESC&resultRecordCount=30&f=json`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return [];

    const json = await res.json();
    return (json?.features || []).map((f: any) => {
      const a = f.attributes || {};
      const beach = a.BEACH_NAME || 'Unknown beach';
      const stateName = a.STATE_NAME || '';
      const closure = a.CLOSURE_IND === 'Y';
      const date = a.NOTIFICATION_DATE ? new Date(a.NOTIFICATION_DATE).toISOString() : new Date().toISOString();
      const st = extractState(stateName);

      return {
        id: mkId('beacon', `${beach}-${date}`),
        source: 'beacon' as const,
        sourceLabel: 'EPA BEACON',
        category: 'bacteria' as const,
        title: `${closure ? 'Beach Closure' : 'Beach Advisory'}: ${beach}`,
        summary: `${closure ? 'Closure' : 'Advisory'} at ${beach}${stateName ? `, ${stateName}` : ''}. Bacteria exceeded safe swimming standards.`,
        publishedAt: date,
        url: 'https://www.epa.gov/beach-tech/beach-advisory-and-closing-online-notification-beacon',
        state: st,
        waterbody: beach,
        pearlRelevant: true,
        tags: ['bacteria', 'beach', closure ? 'closure' : 'advisory', 'public-health'],
        confidence: st ? 0.9 : 0.5,
      } satisfies Signal;
    });
  } catch (e: any) {
    console.warn('[Signals] BEACON error:', e.message);
    return [];
  }
}

// ─── Source 3: NOAA HAB Monitoring ──────────────────────────────────────────────

async function fetchNOAAHAB(): Promise<Signal[]> {
  const feeds = [
    'https://coastalscience.noaa.gov/science-areas/habs/hab-monitoring-system/feed/',
    'https://tidesandcurrents.noaa.gov/hab/rss.xml',
  ];

  const signals: Signal[] = [];

  for (const url of feeds) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
        headers: { Accept: 'application/xml, text/xml' },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const xml = await res.text();

      for (const item of xmlItems(xml).slice(0, 15)) {
        const title = stripHtml(xmlVal(item, 'title'));
        const desc = stripHtml(xmlVal(item, 'description')).slice(0, 300);
        const link = xmlVal(item, 'link');
        const pubDate = xmlVal(item, 'pubDate');
        if (!title) continue;

        const state = extractState(`${title} ${desc}`);

        signals.push({
          id: mkId('hab', title),
          source: 'noaa-hab',
          sourceLabel: 'NOAA HAB Monitoring',
          category: 'hab',
          title: title.slice(0, 200),
          summary: desc.slice(0, 250),
          publishedAt: safeDate(pubDate),
          url: link || 'https://coastalscience.noaa.gov/science-areas/habs/',
          state,
          pearlRelevant: true,
          tags: ['hab', 'algal-bloom', 'monitoring'],
          confidence: state ? 0.8 : 0.4,
        });
      }
    } catch (e: any) {
      console.warn(`[Signals] NOAA HAB feed error:`, e.message);
    }
  }

  return signals;
}

// ─── Source 4: EPA Newsroom (Water-filtered RSS) ────────────────────────────────

async function fetchEPANews(): Promise<Signal[]> {
  try {
    const url = 'https://www.epa.gov/newsreleases/search/rss?search_api_views_fulltext=water+quality+enforcement+clean+water+act&op=Search';

    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { Accept: 'application/xml, text/xml' },
      cache: 'no-store',
    });
    if (!res.ok) return [];

    const xml = await res.text();

    return xmlItems(xml).slice(0, 20).map(item => {
      const title = stripHtml(xmlVal(item, 'title'));
      const desc = stripHtml(xmlVal(item, 'description')).slice(0, 300);
      const link = xmlVal(item, 'link');
      const pubDate = xmlVal(item, 'pubDate');
      if (!title) return null;

      const state = extractState(`${title} ${desc}`);
      const cat = categorize(title, desc);
      const pearl = isPearlRelevant(title, desc);

      return {
        id: mkId('epa', title),
        source: 'epa-news' as const,
        sourceLabel: 'EPA Newsroom',
        category: cat,
        title: title.slice(0, 200),
        summary: desc.slice(0, 250),
        publishedAt: safeDate(pubDate),
        url: link || 'https://www.epa.gov/newsreleases',
        state,
        pearlRelevant: pearl,
        tags: [cat, 'epa', 'official'],
        confidence: state ? 0.7 : 0.3,
      } satisfies Signal;
    }).filter(Boolean) as Signal[];
  } catch (e: any) {
    console.warn('[Signals] EPA News error:', e.message);
    return [];
  }
}

// ─── Cache-derived signals ──────────────────────────────────────────────────

import { generateCacheSignals } from './cacheSignals';

// ─── Signal cache (5 min TTL, globalThis for hot reload survival) ───────────────

interface SigCache { signals: Signal[]; sources: SignalResponse['sources']; at: Date; }
const SIG_KEY = '__pearl_signals_v1';

function getCached(): SigCache | null {
  const c = (globalThis as any)[SIG_KEY] as SigCache | undefined;
  if (!c || Date.now() - c.at.getTime() > 5 * 60 * 1000) return null;
  return c;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function fetchAllSignals(opts: {
  state?: string;
  pearlOnly?: boolean;
  limit?: number;
} = {}): Promise<SignalResponse> {
  let all: Signal[];
  let sources: SignalResponse['sources'];

  const cached = getCached();
  if (cached) {
    all = cached.signals;
    sources = cached.sources;
  } else {
    const results = await Promise.allSettled([
      fetchUSCG(), fetchBeacon(), fetchNOAAHAB(), fetchEPANews(),
    ]);

    const names = ['USCG Marine Safety', 'EPA BEACON', 'NOAA HAB', 'EPA Newsroom'];
    sources = results.map((r, i) => ({
      name: names[i],
      status: (r.status === 'fulfilled' ? 'ok' : 'error') as 'ok' | 'error',
      count: r.status === 'fulfilled' ? r.value.length : 0,
    }));

    all = results
      .filter((r): r is PromiseFulfilledResult<Signal[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // Merge cache-derived signals (synchronous, no API calls)
    let cacheSignals: Signal[] = [];
    try {
      cacheSignals = generateCacheSignals();
    } catch (e: any) {
      console.warn(`[Signals] Cache signal generation error:`, e.message);
    }
    all.push(...cacheSignals);
    sources.push({
      name: 'Cache-Derived Signals',
      status: cacheSignals.length > 0 ? 'ok' : 'error',
      count: cacheSignals.length,
    });

    all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    (globalThis as any)[SIG_KEY] = { signals: all, sources, at: new Date() } satisfies SigCache;
    console.log(`[Signals] Fetched ${all.length} signals from ${sources.filter(s => s.status === 'ok').length}/${sources.length} sources`);
  }

  let filtered = all;
  if (opts.state) filtered = filtered.filter(s => s.state === opts.state);
  if (opts.pearlOnly) filtered = filtered.filter(s => s.pearlRelevant);

  return {
    signals: filtered.slice(0, opts.limit || 50),
    fetchedAt: new Date().toISOString(),
    sources,
  };
}

export async function fetchStateSignals(state: string): Promise<SignalResponse> {
  return fetchAllSignals({ state, limit: 25 });
}
