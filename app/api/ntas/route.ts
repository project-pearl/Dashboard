// app/api/ntas/route.ts
// Lightweight proxy for the DHS NTAS (National Terrorism Advisory System) feed.
// In-memory TTL cache (30 min) — no cron/blob needed since NTAS updates every few months.

export const dynamic = 'force-dynamic';

interface NtasAdvisory {
  type: 'bulletin' | 'elevated' | 'imminent';
  title: string;
  summary: string;
  issued: string;
  expires: string;
  link: string;
}

interface NtasResponse {
  status: 'none' | 'bulletin' | 'elevated' | 'imminent';
  advisories: NtasAdvisory[];
  fetchedAt: string;
}

// ── In-memory cache ──
let _cache: NtasResponse | null = null;
let _cachedAt = 0;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

const FEED_URL = 'https://www.dhs.gov/ntas/1.1/feed.xml';

function parseAdvisories(xml: string): NtasAdvisory[] {
  const advisories: NtasAdvisory[] = [];
  // Match each <item> block
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const tag = (name: string) => {
      const m = block.match(new RegExp(`<${name}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${name}>`, 'i'))
        || block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'));
      return m ? m[1].trim() : '';
    };

    const title = tag('title');
    const summary = tag('description') || tag('summary');
    const link = tag('link');
    const issued = tag('pubDate') || tag('ntas:issueDate') || '';
    const expires = tag('ntas:expirationDate') || '';

    // Determine advisory type from title/category
    const titleLower = title.toLowerCase();
    let type: NtasAdvisory['type'] = 'bulletin';
    if (titleLower.includes('imminent')) type = 'imminent';
    else if (titleLower.includes('elevated')) type = 'elevated';

    if (title) {
      advisories.push({ type, title, summary, issued, expires, link });
    }
  }
  return advisories;
}

function highestLevel(advisories: NtasAdvisory[]): NtasResponse['status'] {
  if (advisories.some(a => a.type === 'imminent')) return 'imminent';
  if (advisories.some(a => a.type === 'elevated')) return 'elevated';
  if (advisories.length > 0) return 'bulletin';
  return 'none';
}

async function fetchNtas(): Promise<NtasResponse> {
  const now = Date.now();
  if (_cache && now - _cachedAt < TTL_MS) return _cache;

  try {
    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'WaterQualityDashboard/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const advisories = parseAdvisories(xml);
    const result: NtasResponse = {
      status: highestLevel(advisories),
      advisories,
      fetchedAt: new Date().toISOString(),
    };
    _cache = result;
    _cachedAt = now;
    return result;
  } catch {
    // Return cached data if available, otherwise empty
    if (_cache) return _cache;
    return { status: 'none', advisories: [], fetchedAt: new Date().toISOString() };
  }
}

export async function GET() {
  const data = await fetchNtas();
  return Response.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  });
}
