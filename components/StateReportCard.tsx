'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
  LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};

function scoreToGrade(score: number): { letter: string; color: string; bg: string } {
  if (score >= 97) return { letter: 'A+', color: 'text-green-700', bg: 'bg-green-100 border-green-300' };
  if (score >= 93) return { letter: 'A',  color: 'text-green-700', bg: 'bg-green-100 border-green-300' };
  if (score >= 90) return { letter: 'A-', color: 'text-green-600', bg: 'bg-green-50 border-green-200' };
  if (score >= 87) return { letter: 'B+', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 83) return { letter: 'B',  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 80) return { letter: 'B-', color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' };
  if (score >= 77) return { letter: 'C+', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300' };
  if (score >= 73) return { letter: 'C',  color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300' };
  if (score >= 70) return { letter: 'C-', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
  if (score >= 67) return { letter: 'D+', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300' };
  if (score >= 63) return { letter: 'D',  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
  if (score >= 60) return { letter: 'D-', color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' };
  return { letter: 'F', color: 'text-red-700', bg: 'bg-red-50 border-red-300' };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Signal {
  type: string;
  severity: string;
  title: string;
  location: string;
  timestamp: string;
}

interface AttainsState {
  total: number;
  stored: number;
  high: number;
  medium: number;
  low: number;
  none: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StateReportCard({ stateAbbr }: { stateAbbr: string }) {
  const [attainsData, setAttainsData] = useState<AttainsState | null>(null);
  const [attainsLoading, setAttainsLoading] = useState(true);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);

  // ── Fetch ATTAINS data from national cache ──
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const maxRetries = 3;

    async function load() {
      setAttainsLoading(true);
      while (attempt < maxRetries && !cancelled) {
        try {
          const r = await fetch('/api/water-data?action=attains-national-cache');
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const json = await r.json();
          const stateData = json.states?.[stateAbbr];
          if (!cancelled) {
            setAttainsData(stateData ?? null);
            setAttainsLoading(false);
          }
          return;
        } catch (e: any) {
          attempt++;
          console.warn(`[ReportCard] ATTAINS attempt ${attempt} failed:`, e.message);
          if (attempt < maxRetries && !cancelled) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          }
        }
      }
      if (!cancelled) setAttainsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [stateAbbr]);

  // ── Fetch signals (poll every 5 min for real-time updates) ──
  const signalsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSignals = useCallback(async () => {
    let attempt = 0;
    const maxRetries = 3;
    while (attempt < maxRetries) {
      try {
        const r = await fetch(`/api/water-data?action=signals&statecode=${stateAbbr}&limit=5`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setSignals(data.signals || []);
        setSignalsLoading(false);
        return;
      } catch (e: any) {
        attempt++;
        console.warn(`[ReportCard] Signals attempt ${attempt} failed:`, e.message);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    setSignalsLoading(false);
  }, [stateAbbr]);

  useEffect(() => {
    setSignalsLoading(true);
    fetchSignals();

    // Poll every 5 minutes
    signalsPollRef.current = setInterval(fetchSignals, 5 * 60 * 1000);
    return () => {
      if (signalsPollRef.current) clearInterval(signalsPollRef.current);
    };
  }, [fetchSignals]);

  // ── Derived values ──
  const { gradeScore, impairedPct, totalAssessed, progressCount, watchCount, actionCount } = useMemo(() => {
    const highSignals = signals.filter(s => s.severity === 'high').length;
    const mediumSignals = signals.filter(s => s.severity === 'medium').length;
    const nwsFemaCount = signals.filter(s => s.type === 'weather_alert' || s.type === 'disaster_declaration').length;

    if (!attainsData || attainsData.stored === 0) {
      return {
        gradeScore: -1,
        impairedPct: 0,
        totalAssessed: 0,
        progressCount: 0,
        watchCount: mediumSignals,
        actionCount: highSignals + nwsFemaCount,
      };
    }

    const total = attainsData.stored;
    const impaired = attainsData.high + attainsData.medium;
    const pct = Math.round((impaired / total) * 100);
    const score = 100 - pct;

    return {
      gradeScore: score,
      impairedPct: pct,
      totalAssessed: total,
      progressCount: total - impaired,
      watchCount: mediumSignals,
      actionCount: highSignals + nwsFemaCount,
    };
  }, [attainsData, signals]);

  const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
  const isLoading = attainsLoading || signalsLoading;
  const hasData = gradeScore >= 0;
  const grade = hasData ? scoreToGrade(gradeScore) : null;

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-pulse">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <div className="h-5 w-40 bg-slate-200 rounded mb-2" />
            <div className="h-4 w-28 bg-slate-100 rounded" />
          </div>
          <div className="h-14 w-14 bg-slate-200 rounded-lg" />
        </div>
        <div className="border-t border-slate-100 px-5 py-4 space-y-3">
          <div className="h-4 w-48 bg-slate-100 rounded" />
          <div className="h-4 w-44 bg-slate-100 rounded" />
          <div className="h-4 w-40 bg-slate-100 rounded" />
        </div>
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="h-4 w-56 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header: state name + grade badge */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{stateName}</h3>
          <p className="text-sm text-slate-500">Water Quality Report Card</p>
        </div>
        {hasData && grade ? (
          <div className={`flex items-center justify-center w-14 h-14 rounded-lg border-2 ${grade.bg}`}>
            <span className={`text-2xl font-black ${grade.color}`}>{grade.letter}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center w-14 h-14 rounded-lg border-2 bg-slate-100 border-slate-300">
            <span className="text-lg font-bold text-slate-400">N/A</span>
          </div>
        )}
      </div>

      {/* Three-tier summary */}
      <div className="border-t border-slate-100 px-5 py-4 space-y-2.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-green-500">&#x1F7E2;</span>
          <span className="text-slate-600">
            <span className="font-medium text-slate-800">Progress</span>
            {' '}&mdash; {hasData ? `${progressCount.toLocaleString()} waters meeting standards` : 'No data available'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-yellow-500">&#x1F7E1;</span>
          <span className="text-slate-600">
            <span className="font-medium text-slate-800">Watch</span>
            {' '}&mdash; {watchCount} medium alert{watchCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-red-500">&#x1F534;</span>
          <span className="text-slate-600">
            <span className="font-medium text-slate-800">Action Needed</span>
            {' '}&mdash; {actionCount} high alert{actionCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* CTA footer */}
      <div className="border-t border-slate-100 px-5 py-4">
        <p className="text-xs text-slate-500 mb-2">
          PIN monitors {stateName} water quality in real-time
        </p>
        <a
          href={`/command-center?state=${stateAbbr}`}
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          See what we see &rarr;
        </a>
      </div>
    </div>
  );
}
