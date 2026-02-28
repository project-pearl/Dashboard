'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertTriangle, CheckCircle, Shield, Clock, TrendingUp, Sliders, ChevronDown, ChevronUp, ExternalLink, Mail, Zap } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ── Jurisdiction profiles ────────────────────────────────────────────────────

interface JurisdictionProfile {
  name: string;
  tier: MS4Tier;
  sites: number;
  phase: string;
  permit: string;
  wprf?: string;       // Water Protection & Restoration Fund revenue
  totalRestoration?: string; // Total MS4/restoration costs through projection period
  fapLink?: string;    // Financial Assurance Plan link
  notes?: string;
}

const JURISDICTIONS: Record<string, JurisdictionProfile> = {
  anne_arundel_county: {
    name: 'Anne Arundel County',
    tier: 'large',
    sites: 8,
    phase: 'Phase I',
    permit: 'MDR068144',
    wprf: '$27.1M (FY25)',
    totalRestoration: '$447M through FY27',
    fapLink: 'https://www.aacounty.org/stormwater-management',
    notes: 'Largest WPRF revenue in MD. PEARL targets monitoring subset — high-ROI slice of $447M total program.',
  },
  baltimore_city: {
    name: 'Baltimore City',
    tier: 'large',
    sites: 12,
    phase: 'Phase I',
    permit: 'MDR068322',
    wprf: '$42M (FY24)',
    totalRestoration: '$2.4B consent decree',
    notes: 'Under consent decree. CBT pooled monitoring $124K/yr. PEARL replaces manual sampling while providing continuous compliance verification.',
  },
  baltimore_county: {
    name: 'Baltimore County',
    tier: 'large',
    sites: 10,
    phase: 'Phase I',
    permit: 'MDR068246',
    notes: 'Phase I MS4 with extensive stormwater infrastructure. Large tier pricing.',
  },
  montgomery_county: {
    name: 'Montgomery County',
    tier: 'large',
    sites: 10,
    phase: 'Phase I',
    permit: 'MDR068399',
    wprf: '$108M WSSC (FY24)',
    notes: 'Highest per-capita stormwater spending in MD. PEARL augments existing BMP monitoring network.',
  },
  prince_georges_county: {
    name: "Prince George's County",
    tier: 'large',
    sites: 10,
    phase: 'Phase I',
    permit: 'MDR068284',
    notes: 'Phase I MS4 — Anacostia watershed priority area with significant EJ burden.',
  },
  howard_county: {
    name: 'Howard County',
    tier: 'medium',
    sites: 6,
    phase: 'Phase I',
    permit: 'MDR068365',
    notes: 'Phase I MS4 with strong environmental program. Medium tier pricing.',
  },
  harford_county: {
    name: 'Harford County',
    tier: 'medium',
    sites: 5,
    phase: 'Phase I',
    permit: 'MDR068411',
    notes: 'Phase I MS4 — Gunpowder and Bush River watersheds.',
  },
  frederick_county: {
    name: 'Frederick County',
    tier: 'medium',
    sites: 5,
    phase: 'Phase II',
    permit: 'MDR068446',
    notes: 'Phase II growing jurisdiction. Medium tier with expansion potential.',
  },
  charles_county: {
    name: 'Charles County',
    tier: 'small',
    sites: 4,
    phase: 'Phase II',
    permit: 'MDR068438',
    notes: 'Phase II MS4 — Potomac and Mattawoman watershed focus.',
  },
  cecil_county: {
    name: 'Cecil County',
    tier: 'small',
    sites: 3,
    phase: 'Phase II',
    permit: 'MDR068462',
    notes: 'Small Phase II MS4. PEARL provides compliance monitoring at fraction of consultant cost.',
  },
  carroll_county: {
    name: 'Carroll County',
    tier: 'small',
    sites: 3,
    phase: 'Phase II',
    permit: 'MDR068454',
    notes: 'Phase II MS4 — Patapsco and Liberty Reservoir watersheds.',
  },
};

// ── Pricing tiers ────────────────────────────────────────────────────────────

type MS4Tier = 'small' | 'medium' | 'large';

interface TierConfig {
  label: string;
  sitesLabel: string;
  annualCost: number;
  pooledMonitoring: number;
  stormSamplesDefault: number;
  baseflowSamples: number;
  stations: number;
  costPerSampleDefault: number;
  consultingReport: number;
  inspectionReports: number;
  tmdlCompliance: number;
  staffHoursPerSample: number;
  reportingHours: number;
  staffRateDefault: number;
  fineAvoidedLow: number;
  fineAvoidedHigh: number;
}

const TIERS: Record<MS4Tier, TierConfig> = {
  small: {
    label: 'Small MS4',
    sitesLabel: '2-4 sites',
    annualCost: 35000,
    pooledMonitoring: 0,
    stormSamplesDefault: 8,
    baseflowSamples: 4,
    stations: 1,
    costPerSampleDefault: 3000,
    consultingReport: 12000,
    inspectionReports: 2500,
    tmdlCompliance: 5000,
    staffHoursPerSample: 5,
    reportingHours: 40,
    staffRateDefault: 65,
    fineAvoidedLow: 5000,
    fineAvoidedHigh: 20000,
  },
  medium: {
    label: 'Medium MS4',
    sitesLabel: '4-8 sites',
    annualCost: 75000,
    pooledMonitoring: 62000,
    stormSamplesDefault: 12,
    baseflowSamples: 4,
    stations: 2,
    costPerSampleDefault: 3500,
    consultingReport: 15000,
    inspectionReports: 3000,
    tmdlCompliance: 7000,
    staffHoursPerSample: 6,
    reportingHours: 60,
    staffRateDefault: 70,
    fineAvoidedLow: 10000,
    fineAvoidedHigh: 35000,
  },
  large: {
    label: 'Large MS4',
    sitesLabel: '8-12+ sites',
    annualCost: 150000,
    pooledMonitoring: 124000,
    stormSamplesDefault: 12,
    baseflowSamples: 4,
    stations: 2,
    costPerSampleDefault: 4000,
    consultingReport: 18000,
    inspectionReports: 3500,
    tmdlCompliance: 8500,
    staffHoursPerSample: 6,
    reportingHours: 80,
    staffRateDefault: 75,
    fineAvoidedLow: 15000,
    fineAvoidedHigh: 50000,
  },
};

// ── Props ────────────────────────────────────────────────────────────────────

interface ComplianceEconomicsProps {
  regionId: string;
  tier?: MS4Tier;
  jurisdictionName?: string;
  jurisdictionKey?: string; // key into JURISDICTIONS
}

// ── Slider component ─────────────────────────────────────────────────────────

function AssumptionSlider({ label, value, onChange, min, max, step, unit, description }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit: string; description?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-bold text-slate-800">{unit === '$' ? `$${value}` : unit === '$K' ? `$${value}K` : `${value}${unit}`}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-cyan-600"
      />
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>{unit === '$' ? `$${min}` : unit === '$K' ? `$${min}K` : `${min}${unit}`}</span>
        {description && <span className="text-slate-500 italic">{description}</span>}
        <span>{unit === '$' ? `$${max}` : unit === '$K' ? `$${max}K` : `${max}${unit}`}</span>
      </div>
    </div>
  );
}

// ── Pie chart colors ─────────────────────────────────────────────────────────

const PIE_COLORS = ['#dc2626', '#f59e0b', '#6366f1', '#0891b2'];

// ── Main Component ───────────────────────────────────────────────────────────

export function ComplianceEconomics({ regionId, tier: initialTier = 'large', jurisdictionName, jurisdictionKey }: ComplianceEconomicsProps) {

  // Resolve jurisdiction profile
  const jProfile = jurisdictionKey ? JURISDICTIONS[jurisdictionKey] : null;
  const resolvedTier = jProfile?.tier || initialTier;
  const resolvedName = jProfile?.name || jurisdictionName || 'Your Jurisdiction';
  const t = TIERS[resolvedTier];

  // ── Interactive assumptions (state) ──
  const [staffRate, setStaffRate] = useState(t.staffRateDefault);
  const [confirmatoryPct, setConfirmatoryPct] = useState(15); // % of current sampling retained
  const [stormSamples, setStormSamples] = useState(t.stormSamplesDefault);
  const [tnCreditPrice, setTnCreditPrice] = useState(50); // $/lb TN
  const [tpCreditPrice, setTpCreditPrice] = useState(75); // $/lb TP
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<1 | 2 | 3>(1);

  // ── Derived calculations ──
  const calc = useMemo(() => {
    const totalSamples = (stormSamples + t.baseflowSamples) * t.stations;
    const samplingCost = totalSamples * t.costPerSampleDefault;
    const consultingTotal = t.consultingReport + (t.inspectionReports * 4) + t.tmdlCompliance;
    const staffHours = (totalSamples * t.staffHoursPerSample) + t.reportingHours;
    const staffCost = staffHours * staffRate;
    const statusQuoTotal = t.pooledMonitoring + samplingCost + consultingTotal + staffCost;

    // PEARL path
    const pearlAnnual = t.annualCost;
    const confirmatorySampling = Math.round(samplingCost * (confirmatoryPct / 100));
    const pearlTotal = pearlAnnual + confirmatorySampling;

    // Delta
    const annualSavings = statusQuoTotal - pearlTotal;
    const savingsPct = statusQuoTotal > 0 ? Math.round((annualSavings / statusQuoTotal) * 100) : 0;

    // Nutrient credits (estimated annual load reductions from PEARL-monitored BMPs)
    // Conservative: 500-2000 lbs TN, 50-200 lbs TP depending on tier
    const tnReduction = resolvedTier === 'large' ? 1500 : resolvedTier === 'medium' ? 800 : 400;
    const tpReduction = resolvedTier === 'large' ? 120 : resolvedTier === 'medium' ? 65 : 30;
    const creditValueTN = tnReduction * tnCreditPrice;
    const creditValueTP = tpReduction * tpCreditPrice;
    const creditValueTotal = creditValueTN + creditValueTP;

    // Grant offsets
    const grantOffsetLow = Math.round(pearlAnnual * 0.40);
    const grantOffsetHigh = Math.round(pearlAnnual * 0.75);

    // Fines
    const fineAvoidedMid = Math.round((t.fineAvoidedLow + t.fineAvoidedHigh) / 2);

    // Total value range
    const totalValueLow = annualSavings + t.fineAvoidedLow + creditValueTotal + grantOffsetLow;
    const totalValueHigh = annualSavings + t.fineAvoidedHigh + creditValueTotal + grantOffsetHigh;

    // Phased savings (Year 1-3)
    // Phase 1: parallel validation (retain ~100% grabs + PEARL) — net cost increase
    const phase1Savings = -pearlAnnual; // paying both
    // Phase 2: reduced grabs to confirmatory level — savings begin
    const phase2PearlTotal = pearlAnnual + confirmatorySampling;
    const phase2Savings = statusQuoTotal - phase2PearlTotal;
    // Phase 3: primary continuous, minimal grabs (~5%) — maximum savings
    const phase3Confirmatory = Math.round(samplingCost * 0.05);
    const phase3PearlTotal = pearlAnnual + phase3Confirmatory;
    const phase3Savings = statusQuoTotal - phase3PearlTotal;

    // Cumulative over 3 years
    const yr1Cumulative = phase1Savings;
    const yr2Cumulative = phase1Savings + phase2Savings;
    const yr3Cumulative = phase1Savings + phase2Savings + phase3Savings;

    return {
      totalSamples, samplingCost, consultingTotal, staffHours, staffCost, statusQuoTotal,
      pearlAnnual, confirmatorySampling, pearlTotal,
      annualSavings, savingsPct,
      tnReduction, tpReduction, creditValueTN, creditValueTP, creditValueTotal,
      grantOffsetLow, grantOffsetHigh, fineAvoidedMid,
      totalValueLow, totalValueHigh,
      phase1Savings, phase2Savings, phase3Savings,
      yr1Cumulative, yr2Cumulative, yr3Cumulative,
      phase2PearlTotal, phase3PearlTotal, phase3Confirmatory,
    };
  }, [staffRate, confirmatoryPct, stormSamples, tnCreditPrice, tpCreditPrice, t, resolvedTier]);

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
    return `$${n.toLocaleString()}`;
  };
  const fmtRange = (lo: number, hi: number) => `${fmt(lo)}-${fmt(hi)}`;

  // ── Chart data ──
  const pieData = [
    { name: 'Sampling', value: calc.samplingCost },
    ...(t.pooledMonitoring > 0 ? [{ name: 'Pooled Monitoring', value: t.pooledMonitoring }] : []),
    { name: 'Consulting & Reports', value: calc.consultingTotal },
    { name: 'Staff Time', value: calc.staffCost },
  ];

  const barData = [
    {
      name: 'Year 1',
      phase: 'Parallel Validation',
      savings: Math.max(calc.phase1Savings, 0),
      cost: Math.abs(Math.min(calc.phase1Savings, 0)),
      credits: calc.creditValueTotal,
      cumulative: calc.yr1Cumulative + calc.creditValueTotal,
    },
    {
      name: 'Year 2',
      phase: 'Reduced Grabs',
      savings: Math.max(calc.phase2Savings, 0),
      cost: 0,
      credits: calc.creditValueTotal,
      cumulative: calc.yr2Cumulative + calc.creditValueTotal * 2,
    },
    {
      name: 'Year 3',
      phase: 'Primary Continuous',
      savings: Math.max(calc.phase3Savings, 0),
      cost: 0,
      credits: calc.creditValueTotal,
      cumulative: calc.yr3Cumulative + calc.creditValueTotal * 3,
    },
  ];

  const PHASE_TIMELINE = [
    {
      phase: 1, label: 'Parallel Validation',
      desc: 'PEARL runs alongside existing grabs. Split-sample validation builds MDE confidence. No cost savings yet — investment period.',
      confirmatory: '100%', savings: calc.phase1Savings,
      color: 'amber',
    },
    {
      phase: 2, label: 'Reduced Grabs',
      desc: `MDE approves QAPP. Grab sampling drops to ${confirmatoryPct}% confirmatory. Consulting and staff time largely eliminated.`,
      confirmatory: `${confirmatoryPct}%`, savings: calc.phase2Savings,
      color: 'cyan',
    },
    {
      phase: 3, label: 'Primary Continuous',
      desc: 'PEARL accepted as primary compliance data source. Minimal (~5%) confirmatory grabs for sensor QA/QC. Maximum cost avoidance.',
      confirmatory: '~5%', savings: calc.phase3Savings,
      color: 'green',
    },
  ];

  return (
    <Card className="border-2 border-slate-300 bg-white" suppressHydrationWarning>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
          <DollarSign className="h-5 w-5 text-slate-600" />
          Compliance ROI Calculator — {resolvedName}
        </CardTitle>
        <CardDescription>
          What {resolvedName} spends today on monitoring, sampling, and reporting vs. what PEARL replaces
        </CardDescription>
        {jProfile && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="text-[10px]">{jProfile.phase}</Badge>
            <Badge variant="outline" className="text-[10px] font-mono">{jProfile.permit}</Badge>
            {jProfile.wprf && <Badge variant="outline" className="text-[10px] bg-green-50 border-green-200 text-green-700">WPRF: {jProfile.wprf}</Badge>}
            {jProfile.sites && <Badge variant="outline" className="text-[10px]">{jProfile.sites} monitoring sites</Badge>}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5">

        {/* ── Interactive Assumptions Toggle ── */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowAssumptions(!showAssumptions)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Sliders className="h-3.5 w-3.5" />
              Adjust Assumptions — Sensitivity Analysis
            </span>
            {showAssumptions ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
          </button>
          {showAssumptions && (
            <div className="p-4 bg-white border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AssumptionSlider
                label="Staff Hourly Rate" value={staffRate} onChange={setStaffRate}
                min={45} max={120} step={5} unit="$"
                description="loaded rate incl. benefits"
              />
              <AssumptionSlider
                label="Confirmatory Sampling" value={confirmatoryPct} onChange={setConfirmatoryPct}
                min={0} max={50} step={5} unit="%"
                description="% of current grabs retained"
              />
              <AssumptionSlider
                label="Storm Events Sampled/Yr" value={stormSamples} onChange={setStormSamples}
                min={4} max={24} step={1} unit=""
                description="MDE requires 12 for Phase I"
              />
              <AssumptionSlider
                label="TN Credit Price" value={tnCreditPrice} onChange={setTnCreditPrice}
                min={10} max={150} step={5} unit="$"
                description="$/lb — MD Bay market rate"
              />
              <AssumptionSlider
                label="TP Credit Price" value={tpCreditPrice} onChange={setTpCreditPrice}
                min={20} max={200} step={5} unit="$"
                description="$/lb — MD Bay market rate"
              />
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setStaffRate(t.staffRateDefault);
                    setConfirmatoryPct(15);
                    setStormSamples(t.stormSamplesDefault);
                    setTnCreditPrice(50);
                    setTpCreditPrice(75);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Cost comparison table ── */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left px-3 py-2.5 font-semibold text-slate-700 w-[40%]">Category</th>
                <th className="text-right px-3 py-2.5 font-semibold text-red-700 w-[20%]">
                  <span className="flex items-center justify-end gap-1"><AlertTriangle className="h-3 w-3" />Current (Manual)</span>
                </th>
                <th className="text-right px-3 py-2.5 font-semibold text-green-700 w-[20%]">
                  <span className="flex items-center justify-end gap-1"><CheckCircle className="h-3 w-3" />PEARL Continuous</span>
                </th>
                <th className="text-right px-3 py-2.5 font-semibold text-cyan-700 w-[20%]">Net Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {t.pooledMonitoring > 0 ? (
                <tr className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">Pooled Monitoring (CBT)</td>
                  <td className="px-3 py-2 text-right font-medium text-red-700">{fmt(t.pooledMonitoring)}</td>
                  <td className="px-3 py-2 text-right font-medium text-green-700">{fmt(calc.pearlAnnual)}</td>
                  <td className="px-3 py-2 text-right font-medium text-amber-600">
                    {t.pooledMonitoring >= calc.pearlAnnual ? '-' : '+'}{fmt(Math.abs(t.pooledMonitoring - calc.pearlAnnual))}
                  </td>
                </tr>
              ) : (
                <tr className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">PEARL Subscription</td>
                  <td className="px-3 py-2 text-right text-slate-400">--</td>
                  <td className="px-3 py-2 text-right font-medium text-green-700">{fmt(calc.pearlAnnual)}</td>
                  <td className="px-3 py-2 text-right font-medium text-amber-600">+{fmt(calc.pearlAnnual)}</td>
                </tr>
              )}
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-600">Sampling ({calc.totalSamples} sets/yr &rarr; {confirmatoryPct}% confirmatory)</td>
                <td className="px-3 py-2 text-right font-medium text-red-700">{fmt(calc.samplingCost)}</td>
                <td className="px-3 py-2 text-right font-medium text-green-700">{fmt(calc.confirmatorySampling)}</td>
                <td className="px-3 py-2 text-right font-medium text-cyan-700">-{fmt(calc.samplingCost - calc.confirmatorySampling)}</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-600">Annual Report + Inspections + TMDL Docs</td>
                <td className="px-3 py-2 text-right font-medium text-red-700">{fmt(calc.consultingTotal)}</td>
                <td className="px-3 py-2 text-right text-slate-400 line-through">Eliminated</td>
                <td className="px-3 py-2 text-right font-medium text-cyan-700">-{fmt(calc.consultingTotal)}</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-600">Staff Time ({calc.staffHours} hrs @ ${staffRate}/hr)</td>
                <td className="px-3 py-2 text-right font-medium text-red-700">{fmt(calc.staffCost)}</td>
                <td className="px-3 py-2 text-right text-slate-400 line-through">Eliminated</td>
                <td className="px-3 py-2 text-right font-medium text-cyan-700">-{fmt(calc.staffCost)}</td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="px-3 py-3 text-slate-900">Annual Total</td>
                <td className="px-3 py-3 text-right text-red-700">{fmt(calc.statusQuoTotal)}/yr</td>
                <td className="px-3 py-3 text-right text-green-700">{fmt(calc.pearlTotal)}/yr</td>
                <td className="px-3 py-3 text-right text-cyan-700">
                  +{fmt(calc.annualSavings)} Saved ({calc.savingsPct}%)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Charts row: Pie + Bar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Pie: Current cost breakdown */}
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-xs font-bold text-slate-700 mb-2">Current Manual Cost Breakdown</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => fmt(val)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {pieData.map((d, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] text-slate-600">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}: {fmt(d.value)}
                </span>
              ))}
            </div>
          </div>

          {/* Bar: Year 1-3 savings + credits */}
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-xs font-bold text-slate-700 mb-2">3-Year Value Trajectory</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(val: number) => fmt(val)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="savings" name="Compliance Savings" fill="#0891b2" radius={[2, 2, 0, 0]} />
                <Bar dataKey="credits" name="Nutrient Credits" fill="#059669" radius={[2, 2, 0, 0]} />
                {barData.some(d => d.cost > 0) && (
                  <Bar dataKey="cost" name="Net Cost (Parallel)" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
            <div className="text-[10px] text-slate-500 mt-1 text-center">
              3-year cumulative: <span className="font-bold text-cyan-700">{fmt(barData[2].cumulative)}</span> total value generated
            </div>
          </div>
        </div>

        {/* ── Phased MDE Acceptance Timeline ── */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">MDE Acceptance Roadmap</div>
          <div className="grid grid-cols-3 gap-2">
            {PHASE_TIMELINE.map((p) => {
              const isActive = selectedPhase === p.phase;
              const borderClass = p.color === 'amber' ? 'border-amber-400 bg-amber-50' : p.color === 'cyan' ? 'border-cyan-400 bg-cyan-50' : 'border-green-400 bg-green-50';
              const inactiveClass = 'border-slate-200 bg-white';
              return (
                <button
                  key={p.phase}
                  onClick={() => setSelectedPhase(p.phase as 1 | 2 | 3)}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${isActive ? borderClass : inactiveClass}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[10px] font-bold uppercase ${
                      p.color === 'amber' ? 'text-amber-700' : p.color === 'cyan' ? 'text-cyan-700' : 'text-green-700'
                    }`}>Phase {p.phase}</span>
                    {p.phase === 1 && <span className="text-[9px] text-slate-400">Year 1</span>}
                    {p.phase === 2 && <span className="text-[9px] text-slate-400">Year 2</span>}
                    {p.phase === 3 && <span className="text-[9px] text-slate-400">Year 3+</span>}
                  </div>
                  <div className="text-xs font-semibold text-slate-800">{p.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Grabs: {p.confirmatory}</div>
                  <div className={`text-xs font-bold mt-1 ${p.savings >= 0 ? 'text-cyan-700' : 'text-amber-700'}`}>
                    {p.savings >= 0 ? '+' : ''}{fmt(p.savings)}/yr
                  </div>
                </button>
              );
            })}
          </div>
          {/* Phase detail */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-600 leading-relaxed">{PHASE_TIMELINE[selectedPhase - 1].desc}</p>
            {selectedPhase === 3 && (
              <p className="text-xs text-green-700 font-semibold mt-1">
                &quot;What if MDE accepts full continuous after Year 1?&quot; — Skip to Phase 3: {fmt(calc.phase3Savings)}/yr savings + {fmt(calc.creditValueTotal)}/yr credits = {fmt(calc.phase3Savings + calc.creditValueTotal)}/yr total value.
              </p>
            )}
          </div>
        </div>

        {/* ── Additional ROI Benefits ── */}
        <div className="rounded-xl border-2 border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-4 space-y-3">
          <div className="text-xs font-bold text-cyan-900 uppercase tracking-wide">Additional Value Generated</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg border border-cyan-200 p-3 text-center">
              <div className="text-[10px] text-slate-500 font-medium uppercase">Fines Avoided</div>
              <div className="text-sm font-bold text-cyan-800 mt-1">{fmtRange(t.fineAvoidedLow, t.fineAvoidedHigh)}</div>
              <div className="text-[10px] text-slate-400">early exceedance detection</div>
            </div>
            <div className="bg-white rounded-lg border border-cyan-200 p-3 text-center">
              <div className="text-[10px] text-slate-500 font-medium uppercase">TN Credits</div>
              <div className="text-sm font-bold text-cyan-800 mt-1">{fmt(calc.creditValueTN)}/yr</div>
              <div className="text-[10px] text-slate-400">{calc.tnReduction} lbs @ ${tnCreditPrice}/lb</div>
            </div>
            <div className="bg-white rounded-lg border border-cyan-200 p-3 text-center">
              <div className="text-[10px] text-slate-500 font-medium uppercase">TP Credits</div>
              <div className="text-sm font-bold text-cyan-800 mt-1">{fmt(calc.creditValueTP)}/yr</div>
              <div className="text-[10px] text-slate-400">{calc.tpReduction} lbs @ ${tpCreditPrice}/lb</div>
            </div>
            <div className="bg-white rounded-lg border border-cyan-200 p-3 text-center">
              <div className="text-[10px] text-slate-500 font-medium uppercase">Staff Freed</div>
              <div className="text-sm font-bold text-cyan-800 mt-1">{calc.staffHours} hrs/yr</div>
              <div className="text-[10px] text-slate-400">fieldwork &amp; other priorities</div>
            </div>
          </div>

          {/* Grant offset */}
          <div className="bg-white rounded-lg border border-cyan-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 font-medium uppercase">Grant Funding Offset (40-75%)</div>
                <div className="text-sm font-bold text-cyan-800">{fmtRange(calc.grantOffsetLow, calc.grantOffsetHigh)}</div>
                <div className="text-[10px] text-slate-400">EPA 319(h), NOAA NFWF, MD Bay Restoration Fund, Justice40</div>
              </div>
              <Zap className="h-5 w-5 text-cyan-600" />
            </div>
          </div>

          {/* Total value headline */}
          <div className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 p-4 text-center">
            <div className="text-[10px] text-cyan-100 font-medium uppercase tracking-widest">Estimated Year 1 Total Value</div>
            <div className="text-2xl md:text-3xl font-black text-white mt-1">
              {fmtRange(calc.totalValueLow, calc.totalValueHigh)}
            </div>
            <div className="text-xs text-cyan-100 mt-1">
              compliance savings + fines avoided + {fmt(calc.creditValueTotal)} credits + grant offsets
            </div>
          </div>
        </div>

        {/* ── Tier display ── */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">PEARL Compliance Tiers</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(TIERS) as [MS4Tier, TierConfig][]).map(([key, cfg]) => {
              const isActive = key === resolvedTier;
              return (
                <div key={key} className={`text-center p-2.5 rounded-lg border-2 transition-all ${isActive ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 bg-white'}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-cyan-800' : 'text-slate-500'}`}>{cfg.label}</div>
                  <div className={`text-sm font-bold ${isActive ? 'text-cyan-700' : 'text-slate-700'}`}>{fmt(cfg.annualCost)}/yr</div>
                  <div className="text-[10px] text-slate-400">{cfg.sitesLabel}</div>
                  {isActive && <div className="text-[10px] font-bold text-cyan-600 mt-0.5">Current &#10003;</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Jurisdiction context (if profile available) ── */}
        {jProfile && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
            <div className="text-xs font-bold text-blue-900">{jProfile.name} Context</div>
            {jProfile.totalRestoration && (
              <div className="text-[10px] text-blue-800">Total restoration/MS4 program: <span className="font-bold">{jProfile.totalRestoration}</span>. PEARL targets the monitoring subset — high-ROI slice.</div>
            )}
            {jProfile.notes && <div className="text-[10px] text-blue-700">{jProfile.notes}</div>}
            {jProfile.fapLink && (
              <a href={jProfile.fapLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                View Financial Assurance Plan <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        )}

        {/* ── CTAs ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => {
              const subject = encodeURIComponent(`PEARL Compliance ROI — ${resolvedName} Custom Quote Request`);
              const body = encodeURIComponent(
                `PEARL Compliance ROI — Custom Quote / Letter of Support\n` +
                `${'='.repeat(50)}\n\n` +
                `Jurisdiction: ${resolvedName}\n` +
                `Permit: ${jProfile?.permit || 'N/A'}\n` +
                `Phase: ${jProfile?.phase || 'N/A'}\n` +
                `Tier: ${TIERS[resolvedTier].label} (${TIERS[resolvedTier].sitesLabel})\n\n` +
                `Current Annual Compliance Spend: ${fmt(calc.statusQuoTotal)}/yr\n` +
                `PEARL Annual Cost: ${fmt(calc.pearlTotal)}/yr\n` +
                `Projected Net Savings: ${fmt(calc.annualSavings)}/yr (${calc.savingsPct}%)\n` +
                `Estimated Nutrient Credit Value: ${fmt(calc.creditValueTotal)}/yr\n` +
                `Est. Year 1 Total Value: ${fmtRange(calc.totalValueLow, calc.totalValueHigh)}\n\n` +
                `Assumptions Used:\n` +
                `  Staff Rate: $${staffRate}/hr\n` +
                `  Confirmatory Sampling: ${confirmatoryPct}%\n` +
                `  Storm Events/Yr: ${stormSamples}\n` +
                `  TN Credit Price: $${tnCreditPrice}/lb\n` +
                `  TP Credit Price: $${tpCreditPrice}/lb\n\n` +
                `Requesting organization: \n` +
                `Contact name: \n` +
                `Contact email: \n` +
                `Phone: \n\n` +
                `Request type (check one):\n` +
                `[ ] Custom ROI analysis for our jurisdiction\n` +
                `[ ] Letter of Support for grant application\n` +
                `[ ] Pilot deployment proposal\n` +
                `[ ] All of the above\n\n` +
                `Grant program(s) targeted: \n` +
                `Additional notes: \n`
              );
              window.open(`mailto:info@project-pearl.org?subject=${subject}&body=${body}`, '_blank');
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold hover:from-cyan-700 hover:to-blue-700 transition-all shadow-md"
          >
            <Mail className="h-4 w-4" />
            Request Custom Quote / Letter of Support
          </button>
          <button
            onClick={() => {
              const grantSection = document.getElementById('section-grants');
              if (grantSection) {
                grantSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                const subject = encodeURIComponent(`PEARL Grant Offset Inquiry — ${resolvedName}`);
                const body = encodeURIComponent(
                  `PEARL Grant Funding Inquiry\n` +
                  `${'='.repeat(40)}\n\n` +
                  `Jurisdiction: ${resolvedName}\n` +
                  `PEARL Subscription: ${fmt(calc.pearlAnnual)}/yr (${TIERS[resolvedTier].label})\n` +
                  `Potential Grant Offset (40-75%): ${fmtRange(calc.grantOffsetLow, calc.grantOffsetHigh)}\n\n` +
                  `Interested in grant eligibility for:\n` +
                  `[ ] EPA 319(h) — Nonpoint Source Pollution\n` +
                  `[ ] NOAA NFWF — Coastal Resilience\n` +
                  `[ ] MD Bay Restoration Fund\n` +
                  `[ ] Justice40 — Environmental Justice\n` +
                  `[ ] Other: \n\n` +
                  `Contact name: \n` +
                  `Contact email: \n` +
                  `Additional notes: \n`
                );
                window.open(`mailto:info@project-pearl.org?subject=${subject}&body=${body}`, '_blank');
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-cyan-300 bg-white text-cyan-800 text-sm font-semibold hover:bg-cyan-50 transition-all"
          >
            <TrendingUp className="h-4 w-4" />
            Find Grants to Offset Subscription
          </button>
        </div>

        {/* ── Pilot proof + disclaimer ── */}
        <div className="space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-[10px] text-green-900 leading-relaxed">
              <span className="font-bold">Pilot Proof:</span> PEARL achieved <span className="font-bold">88-95% TSS removal</span> during the Milton, Florida pilot deployment (January 2025), validated across 7 days of continuous monitoring. This exceeds MDE&apos;s &gt;80% TSS target for BMP crediting and demonstrates the data quality foundation for sensor-based compliance acceptance.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-[10px] text-amber-900 leading-relaxed">
              <span className="font-bold">Assumptions &amp; Risk:</span> Savings assume phased MDE acceptance of continuous monitoring per your QAPP/split-sample validation roadmap. Actuals vary by permit renewal cycle, sensor verification requirements, and MDE policy evolution. Confirmatory sampling retained per slider setting above. Does not include capital restoration costs — the largest MS4 budget item. Cost data sourced from Baltimore City FY24 Financial Assurance Plan, MDE monitoring guidelines, and peer jurisdiction surveys. Hardware costs not included in subscription pricing. Nutrient credit values based on current MD Bay trading rates — subject to market fluctuation.
            </p>
          </div>
          <div className="text-[10px] text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-500">Data Provenance:</span> PEARL aggregated from USGS WDFN, Water Quality Portal, EPA ATTAINS, NOAA CO-OPS. Estimates informational only — consult MDE for official compliance determinations.
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
