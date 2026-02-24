'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface BayImpactCounterProps {
  removalEfficiencies: Record<string, number>;
  regionId: string;
  userRole: string;
}

const FLOW_RATE_GPD = 50000;
const LITERS_PER_GALLON = 3.785;
const FLOW_RATE_LPD = FLOW_RATE_GPD * LITERS_PER_GALLON;

const TYPICAL_INFLUENT = {
  TSS: 280,
  TN: 3.2,
  TP: 0.45,
};

const MG_TO_LBS = 0.0000000022046;

function calcLbsRemoved(concentrationMgL: number, efficiencyPct: number, daysRunning: number) {
  const mgRemoved = concentrationMgL * (efficiencyPct / 100) * FLOW_RATE_LPD * daysRunning * 1000;
  return mgRemoved * MG_TO_LBS;
}

const OYSTER_GALLONS_PER_DAY = 50;

function useCountUp(target: number, duration: number = 1200) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startValueRef.current = value;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(startValueRef.current + (target - startValueRef.current) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}

function StatCard({ emoji, label, value, unit, sublabel, color, animatedValue }: {
  emoji: string; label: string; value: number; unit: string;
  sublabel: string; color: string; animatedValue: number;
}) {
  const colorMap: Record<string, { bg: string; border: string; text: string; subtext: string }> = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-900',   subtext: 'text-blue-600' },
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-900',  subtext: 'text-green-600' },
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-900',  subtext: 'text-amber-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', subtext: 'text-purple-600' },
  };
  const c = colorMap[color] || colorMap.blue;
  const formatted = animatedValue >= 1000000
    ? `${(animatedValue / 1000000).toFixed(2)}M`
    : animatedValue >= 1000
    ? `${(animatedValue / 1000).toFixed(1)}K`
    : animatedValue >= 10
    ? animatedValue.toFixed(1)
    : animatedValue.toFixed(2);

  return (
    <div className={`${c.bg} ${c.border} border-2 rounded-xl p-4 flex flex-col gap-1`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className={`text-xs font-semibold uppercase tracking-wide ${c.subtext}`}>{label}</div>
      <div className={`text-3xl font-black tabular-nums ${c.text}`}>
        {formatted}
        <span className={`text-sm font-semibold ml-1 ${c.subtext}`}>{unit}</span>
      </div>
      <div className={`text-xs ${c.subtext} mt-1`}>{sublabel}</div>
    </div>
  );
}

// ─── K-12 Simplified Version ────────────────────────────────────────────────
function K12ImpactCard({ removalEfficiencies, daysRunning, gallonsTreated, oysterEquivalent, animGallons, animOysters, animDays }: {
  removalEfficiencies: Record<string, number>;
  daysRunning: number;
  gallonsTreated: number;
  oysterEquivalent: number;
  animGallons: number;
  animOysters: number;
  animDays: number;
}) {
  const fishSaved = Math.round((removalEfficiencies.TSS || 91) * daysRunning * 0.4);
  const swimmingPools = Math.round(gallonsTreated / 660000);

  return (
    <Card className="border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 via-blue-50 to-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          🌊 What Has ALIA Cleaned? 
        </CardTitle>
        <CardDescription>Real water quality impact — made simple!</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-100 border-2 border-blue-300 rounded-xl p-4 text-center">
            <div className="text-3xl mb-1">🏊</div>
            <div className="text-3xl font-black text-blue-900 tabular-nums">{Math.round(animGallons / 660000)}</div>
            <div className="text-sm font-semibold text-blue-700">Olympic Swimming Pools</div>
            <div className="text-xs text-blue-500 mt-1">worth of water cleaned!</div>
          </div>
          <div className="bg-purple-100 border-2 border-purple-300 rounded-xl p-4 text-center">
            <div className="text-3xl mb-1">🦪</div>
            <div className="text-3xl font-black text-purple-900 tabular-nums">{Math.round(animOysters).toLocaleString()}</div>
            <div className="text-sm font-semibold text-purple-700">Oyster Equivalent</div>
            <div className="text-xs text-purple-500 mt-1">working together all day</div>
          </div>
          <div className="bg-green-100 border-2 border-green-300 rounded-xl p-4 text-center">
            <div className="text-3xl mb-1">🐟</div>
            <div className="text-3xl font-black text-green-900 tabular-nums">{fishSaved.toLocaleString()}</div>
            <div className="text-sm font-semibold text-green-700">Fish Habitat Days</div>
            <div className="text-xs text-green-500 mt-1">of healthy water created</div>
          </div>
          <div className="bg-amber-100 border-2 border-amber-300 rounded-xl p-4 text-center">
            <div className="text-3xl mb-1">📅</div>
            <div className="text-3xl font-black text-amber-900 tabular-nums">{Math.round(animDays)}</div>
            <div className="text-sm font-semibold text-amber-700">Days Running</div>
            <div className="text-xs text-amber-500 mt-1">since January 2025</div>
          </div>
        </div>
        <div className="bg-cyan-100 border border-cyan-300 rounded-lg p-3 text-center">
          <p className="text-sm text-cyan-900 font-medium">
            🌍 ALIA removes dirt, chemicals, and pollution from stormwater before it reaches the Chesapeake Bay watershed — protecting fish, crabs, and the whole ecosystem!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function BayImpactCounter({ removalEfficiencies, regionId, userRole }: BayImpactCounterProps) {
  const [mounted, setMounted] = useState(false);
  const PILOT_START = new Date('2025-01-09');
  const daysRunning = Math.floor((Date.now() - PILOT_START.getTime()) / (1000 * 60 * 60 * 24));

  useEffect(() => { setMounted(true); }, []);

  const tssRemoved   = calcLbsRemoved(TYPICAL_INFLUENT.TSS, removalEfficiencies.TSS || 91, daysRunning);
  const tnRemoved    = calcLbsRemoved(TYPICAL_INFLUENT.TN,  removalEfficiencies.TN  || 92, daysRunning);
  const tpRemoved    = calcLbsRemoved(TYPICAL_INFLUENT.TP,  removalEfficiencies.TP  || 93, daysRunning);
  const gallonsTreated = FLOW_RATE_GPD * daysRunning;
  const oysterEquivalent = Math.round(gallonsTreated / (OYSTER_GALLONS_PER_DAY * daysRunning));
  const tnTmdlProgress = Math.min(((tnRemoved / 10000) * 100), 100);

  const [liveTick, setLiveTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setLiveTick(t => t + 1), 3000);
    return () => clearInterval(interval);
  }, []);
  const liveGallons = gallonsTreated + Math.floor(liveTick * (FLOW_RATE_GPD / (24 * 60 * 60 / 3)));

  const animTSS         = useCountUp(mounted ? tssRemoved       : 0, 1800);
  const animTN          = useCountUp(mounted ? tnRemoved        : 0, 2000);
  const animTP          = useCountUp(mounted ? tpRemoved        : 0, 2200);
  const animLiveGallons = useCountUp(liveGallons,                    2800);
  const animOysters     = useCountUp(mounted ? oysterEquivalent : 0, 1600);
  const animDays        = useCountUp(mounted ? daysRunning      : 0, 1000);

  // K-12 simplified view
  if (userRole === 'K-12 Student / Teacher') {
    return (
      <K12ImpactCard
        removalEfficiencies={removalEfficiencies}
        daysRunning={daysRunning}
        gallonsTreated={gallonsTreated}
        oysterEquivalent={oysterEquivalent}
        animGallons={animLiveGallons}
        animOysters={animOysters}
        animDays={animDays}
      />
    );
  }

  // Full version for all other roles
  return (
    <Card className="border-2 border-cyan-400 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white shadow-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              🦪 Chesapeake Bay Impact
            </CardTitle>
            <CardDescription className="text-blue-300 mt-1">
              Cumulative pollutant removal since Milton pilot launch · {daysRunning} days running
              <span className="block text-blue-400/70 text-[10px] mt-0.5">Applies to Chesapeake Bay Watershed states (MD, VA, PA, WV, DE, NY, DC)</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 bg-green-500/20 border border-green-400/40 rounded-full px-4 py-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-300 text-xs font-semibold">SYSTEM ACTIVE</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Big headline number */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
          <div className="text-xs font-semibold text-blue-300 uppercase tracking-widest mb-2">
            Total Water Treated
          </div>
          <div className="text-5xl font-black tabular-nums text-white">
            {(animLiveGallons / 1_000_000).toFixed(3)}
            <span className="text-2xl text-blue-300 ml-2">million gallons</span>
          </div>
          <div className="text-xs text-blue-400 mt-2 flex items-center justify-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>Counter updates every 3 seconds</span>
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard emoji="🟤" label="TSS Removed"       value={tssRemoved}       unit="lbs" sublabel={`${(removalEfficiencies.TSS || 91).toFixed(0)}% removal rate`} color="amber"  animatedValue={animTSS} />
          <StatCard emoji="🟢" label="Nitrogen Removed"  value={tnRemoved}        unit="lbs" sublabel="Bay TMDL credit eligible"                                      color="green"  animatedValue={animTN} />
          <StatCard emoji="🔵" label="Phosphorus Removed" value={tpRemoved}       unit="lbs" sublabel="Algae bloom prevention"                                        color="blue"   animatedValue={animTP} />
          <StatCard emoji="🦪" label="Oyster Equivalent" value={oysterEquivalent} unit="oysters" sublabel="Filtration equivalent"                                     color="purple" animatedValue={animOysters} />
        </div>

        {/* TMDL bar — hide for Sustainability, show for everyone else */}
        {userRole !== 'Corporate / ESG' && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-blue-200">Chesapeake Bay TMDL Nitrogen Progress</span>
              <span className="text-sm font-bold text-green-300">{tnTmdlProgress.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full transition-all duration-[2000ms]"
                style={{ width: mounted ? `${tnTmdlProgress}%` : '0%' }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-blue-400">0%</span>
              <span className="text-xs text-blue-400">Target: 25% reduction</span>
              <span className="text-xs text-blue-400">100%</span>
            </div>
          </div>
        )}

        {/* ESG-specific sustainability framing */}
        {userRole === 'Corporate / ESG' && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-300 uppercase tracking-widest mb-3">Sustainability Water Impact Metrics</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xl font-black text-emerald-400">{((tnRemoved + tpRemoved) * 0.001).toFixed(1)}t</div>
                <div className="text-xs text-blue-400 mt-0.5">Nutrient Load (metric tons)</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xl font-black text-cyan-400">{((removalEfficiencies.TSS + removalEfficiencies.TN + removalEfficiencies.TP) / 3).toFixed(0)}%</div>
                <div className="text-xs text-blue-400 mt-0.5">Avg Contaminant Reduction</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xl font-black text-purple-400">{(liveGallons / 1_000_000).toFixed(2)}M</div>
                <div className="text-xs text-blue-400 mt-0.5">Gallons Treated (Scope 3)</div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom context row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-2xl font-black text-white tabular-nums">{Math.round(animDays)}</div>
            <div className="text-xs text-blue-400 mt-0.5">Days Running</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-2xl font-black text-white">{FLOW_RATE_GPD.toLocaleString()}</div>
            <div className="text-xs text-blue-400 mt-0.5">Gallons / Day</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-2xl font-black text-green-400">
              {((removalEfficiencies.TSS + removalEfficiencies.TN + removalEfficiencies.TP) / 3).toFixed(0)}%
            </div>
            <div className="text-xs text-blue-400 mt-0.5">Avg Removal</div>
          </div>
        </div>

        <p className="text-xs text-blue-500 text-center">
          Based on ALIA Milton pilot data (Jan 2025). Flow rate and concentrations are representative estimates for demonstration. Chesapeake Bay Watershed states: MD, VA, PA, WV, DE, NY, DC.
        </p>
      </CardContent>
    </Card>
  );
}
