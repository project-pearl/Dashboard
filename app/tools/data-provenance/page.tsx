'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Printer, ArrowLeft, ChevronRight } from 'lucide-react';

// ─── Section nav items ───────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'what-pin-is', label: 'What PIN Is' },
  { id: 'tiers', label: 'Source Tier Definitions' },
  { id: 'data-age', label: 'Data Age Thresholds' },
  { id: 'pin-score', label: 'PIN Water Score' },
  { id: 'indices-mapping', label: 'Indices & Lenses' },
  { id: 'sources', label: 'Source Catalog' },
  { id: 'qa', label: 'Quality Assurance' },
  { id: 'methodology', label: 'Methodology & Standards' },
  { id: 'disclaimer', label: 'Disclaimer & Limitations' },
] as const;

// ─── Reusable table wrapper ─────────────────────────────────────────────────

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-slate-700 border-b border-slate-100 text-xs leading-relaxed">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeading({ id, number, title }: { id: string; number: number; title: string }) {
  return (
    <h2 id={id} className="text-xl font-bold text-slate-900 pt-8 pb-3 border-b border-slate-200 scroll-mt-24">
      <span className="text-blue-600 mr-2">{number}.</span>{title}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-slate-800 mt-5 mb-2 uppercase tracking-wide">{children}</h3>;
}

function Formula({ label, formula, notes }: { label: string; formula: string; notes?: string }) {
  return (
    <div className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-600 mb-1">{label}</div>
      <code className="block text-sm font-mono text-blue-800 bg-white rounded px-3 py-2 border border-slate-200">{formula}</code>
      {notes && <div className="text-xs text-slate-500 mt-2 leading-relaxed">{notes}</div>}
    </div>
  );
}

// ─── Tier icon SVGs (mirrors TierBadge.tsx) ─────────────────────────────────

function ShieldIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1L2 3.5V7.5C2 11.08 4.56 14.36 8 15C11.44 14.36 14 11.08 14 7.5V3.5L8 1Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BeakerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2V6L3 12.5C2.7 13.2 3.2 14 4 14H12C12.8 14 13.3 13.2 13 12.5L10 6V2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <line x1="5" y1="2" x2="11" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="7" cy="10" r="0.8" fill="currentColor" />
      <circle cx="9.5" cy="8.5" r="0.6" fill="currentColor" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

function PeopleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5.5" cy="5" r="1.8" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" />
      <circle cx="10.5" cy="5" r="1.8" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" />
      <path d="M2 13C2 10.8 3.3 9 5.5 9C6.6 9 7.4 9.4 8 10C8.6 9.4 9.4 9 10.5 9C12.7 9 14 10.8 14 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3.5 11.5L2 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M12.5 11.5L14 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 8C1.5 8 4 3.5 8 3.5C12 3.5 14.5 8 14.5 8C14.5 8 12 12.5 8 12.5C4 12.5 1.5 8 1.5 8Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
      <text x="8" y="9.5" textAnchor="middle" fontSize="4.5" fontWeight="bold" fill="currentColor">?</text>
    </svg>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function DataProvenancePage() {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ── Fixed sidebar navigation (desktop) ── */}
      <nav className="hidden lg:block fixed left-0 top-0 w-56 h-screen bg-slate-50 border-r border-slate-200 p-5 pt-6 z-40 print:hidden">
        <div className="relative h-10 w-32 mb-4">
          <Image src="/Pearl-Logo-alt.png" alt="PIN" fill className="object-contain object-left" />
        </div>
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Data Confidence</div>
        <ul className="space-y-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => scrollTo(s.id)}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors flex items-center gap-1.5"
              >
                <ChevronRight size={10} className="text-slate-400 flex-shrink-0" />
                {s.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-6 pt-4 border-t border-slate-200">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors">
            <ArrowLeft size={12} />
            Back to Dashboard
          </Link>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div className="lg:ml-56">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Link href="/" className="lg:hidden flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800">
              <ArrowLeft size={14} />
              Dashboard
            </Link>
            <span className="text-sm font-semibold text-slate-800 hidden sm:inline">PIN Data Confidence &amp; Methodology</span>
          </div>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer size={13} />
            Print
          </button>
        </div>

        {/* Mobile section nav */}
        <div className="lg:hidden sticky top-[49px] z-20 bg-slate-50 border-b border-slate-200 px-4 py-2 overflow-x-auto flex gap-2 print:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className="whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition-colors flex-shrink-0"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden rounded-xl mx-auto mt-6 max-w-4xl px-6 print:hidden">
          <div className="relative h-[160px] sm:h-[180px] lg:h-[200px] w-full">
            <Image
              src="/provenance.png"
              alt="Data Confidence & Methodology"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1400px"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30" />
            <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10 lg:px-14">
              <div className="mb-1.5 sm:mb-2">
                <span
                  className="inline-flex items-center gap-1.5 w-fit text-sm sm:text-base font-extrabold uppercase tracking-[0.18em] text-cyan-400"
                  style={{ textShadow: '0 0 12px currentColor, 0 0 24px currentColor' }}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse" style={{ boxShadow: '0 0 6px currentColor' }} />
                  PIN — PEARL Intelligence Network
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-tight max-w-2xl">
                Data Confidence &amp; Methodology
              </h1>
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-white/80 max-w-xl leading-relaxed">
                The canonical reference for how PIN sources, scores, and validates environmental data.
              </p>
            </div>
          </div>
        </div>

        <div ref={contentRef} className="max-w-4xl mx-auto px-6 py-8 print:px-0 print:max-w-none">
          {/* Title block */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2 print:block hidden">PIN Data Confidence &amp; Methodology</h1>
            <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
              This document is the canonical reference for how PIN sources, scores, and validates environmental data.
              It describes the data tier system, the PIN Water Score composite methodology, all integrated data sources,
              and quality assurance processes. The <button onClick={() => scrollTo('methodology')} className="text-blue-600 hover:text-blue-800 underline">Methodology &amp; Standards</button> section
              covers parameter-level measurement methods and analytical procedures.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
              <span>Version 1.0</span>
              <span>·</span>
              <span>Last updated: February 2026</span>
              <span>·</span>
              <span>PEARL Intelligence Network — pinwater.org</span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              §1  WHAT PIN IS — AND WHAT IT IS NOT
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="what-pin-is" number={1} title="What PIN Is — and What It Is Not" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            PIN is an intelligence and decision-support platform. It aggregates publicly available water quality data
            from 20+ federal, state, and community sources, applies automated scoring algorithms, and presents the results
            through entity-specific management centers and analytical lenses.
          </p>
          <div className="rounded-lg border border-red-200 bg-red-50/40 p-4 mb-4">
            <p className="text-xs font-semibold text-red-800 mb-2">PIN IS NOT:</p>
            <ul className="text-xs text-slate-600 space-y-1 ml-4 list-disc">
              <li>An official EPA, MDE, state, or federal regulatory assessment</li>
              <li>A substitute for primary agency data in compliance, permitting, or enforcement contexts</li>
              <li>A primary data collection or laboratory analysis service</li>
              <li>A regulatory determination or legal finding</li>
              <li>A best management practice (BMP) certification</li>
            </ul>
          </div>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            PIN grades, scores, and alerts are informational tools. They are designed to accelerate understanding and
            surface patterns across the nation&apos;s water quality landscape — not to replace the regulatory processes
            that govern it. Users should always verify findings with primary agency data and sources before making
            compliance, permitting, or enforcement decisions.
          </p>

          {/* ═══════════════════════════════════════════════════════════════════
              §2  DATA SOURCE TIER DEFINITIONS
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="tiers" number={2} title="Data Source Tier Definitions" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            Every data point in PIN is tagged with a confidence tier reflecting the rigor of its source.
            Tier badges appear throughout the platform — click any badge to return here.
          </p>

          <div className="space-y-4">
            {/* Tier 1 */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-700"><ShieldIcon size={18} /></span>
                <span className="text-sm font-bold text-blue-800">Tier 1 — Federal / Regulatory</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium">T1</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-2">
                Data from federal agency APIs with regulatory authority and mandated quality assurance programs.
                These sources follow EPA-approved analytical methods, undergo external audits, and serve as the legal
                basis for Clean Water Act compliance decisions.
              </p>
              <div className="text-[10px] text-slate-500">
                <span className="font-medium text-slate-600">Examples:</span> EPA ATTAINS, USGS WDFN, Water Quality Portal, EPA ECHO/ICIS, NOAA CO-OPS, EJScreen
              </div>
            </div>

            {/* Tier 2 */}
            <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-purple-700"><BeakerIcon size={18} /></span>
                <span className="text-sm font-bold text-purple-800">Tier 2 — State / Academic / Research</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-medium">T2</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-2">
                Data from state environmental agencies, university research programs, and peer-reviewed monitoring networks.
                These sources maintain documented QA/QC procedures and calibration records, but may not carry the same
                federal chain-of-custody guarantees as Tier 1.
              </p>
              <div className="text-[10px] text-slate-500">
                <span className="font-medium text-slate-600">Examples:</span> State MDE monitoring, CBP DataHub, university research stations, NERRS
              </div>
            </div>

            {/* Tier 3 */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-emerald-700"><PeopleIcon size={18} /></span>
                <span className="text-sm font-bold text-emerald-800">Tier 3 — Community / Citizen Science</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">T3</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-2">
                Data from trained volunteer monitoring programs with standardized protocols.
                Community science data broadens spatial coverage but typically has wider measurement uncertainty
                and less frequent calibration than Tier 1 or 2.
              </p>
              <div className="text-[10px] text-slate-500">
                <span className="font-medium text-slate-600">Examples:</span> Blue Water Baltimore, Chesapeake Bay Foundation volunteer monitors, Waterkeeper Alliance
              </div>
            </div>

            {/* Tier 4 */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-700"><EyeIcon size={18} /></span>
                <span className="text-sm font-bold text-amber-800">Tier 4 — Observational / Derived</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">T4</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-2">
                Data estimated or derived from indirect indicators rather than direct measurement.
                Tier 4 provides useful context but should not be used as sole evidence for regulatory decisions.
                PIN clearly labels all derived values and explains the estimation method.
              </p>
              <div className="text-[10px] text-slate-500">
                <span className="font-medium text-slate-600">Examples:</span> PIN-derived EJ composites (when EJScreen unavailable), satellite-estimated chlorophyll, model-projected scores
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              §3  DATA AGE THRESHOLDS
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="data-age" number={3} title="Data Age Thresholds" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            Data age is calculated from the sample collection date to the current date.
            PIN uses three age categories to indicate how actionable each data point is for current decision-making.
          </p>

          <Table
            headers={['Category', 'Age Range', 'Visual Indicator', 'Interpretation']}
            rows={[
              ['Decision-grade', '< 730 days (2 years)', 'Green tint', 'Recent enough for operational and compliance decisions. Reflects current conditions with high confidence.'],
              ['Stale', '730–1,825 days (2–5 years)', 'Amber tint', 'Provides trend context but may not reflect current conditions. Suitable for baseline comparisons and historical analysis.'],
              ['Archived', '> 1,825 days (5+ years)', 'Gray tint', 'Historical record only. Conditions may have changed significantly. Not used in PIN Water Score calculations.'],
            ]}
          />

          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            Parameters with no sample date default to &quot;Unassessed&quot; status. Data freshness contributes 7%
            to the PIN Water Score composite — waterbodies with predominantly stale or archived data receive
            lower freshness scores, which regresses the overall score toward neutral.
          </p>

          {/* ═══════════════════════════════════════════════════════════════════
              §4  PIN WATER SCORE METHODOLOGY
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="pin-score" number={4} title="PIN Water Score Methodology" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            The PIN Water Score is a 0–100 composite index that summarizes the overall health of a waterbody
            by combining 14 weighted sub-indices across two groups. The score drives the condition label displayed
            on every waterbody card and map marker.
          </p>

          <SubHeading>4.1 Condition Labels</SubHeading>
          <Table
            headers={['Score Range', 'Label', 'Interpretation']}
            rows={[
              ['90–100', 'Excellent', 'Fully supporting all designated uses; all indices healthy'],
              ['70–89', 'Good', 'Minor concerns in 1–2 indices; generally supporting uses'],
              ['50–69', 'Fair', 'Moderate stress; multiple indices indicate degradation'],
              ['30–49', 'Poor', 'Significant impairment; several indices below thresholds'],
              ['0–29', 'Critical', 'Severe impairment; does not support designated uses'],
            ]}
          />

          <SubHeading>4.2 Group Weighting</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            The 14 indices are organized into two groups. Within each group, index weights are expressed as
            percentages of that group&apos;s total. The two groups combine as follows:
          </p>
          <Formula
            label="Final Composite"
            formula="PIN Water Score = (0.56 × Group A Score) + (0.44 × Group B Score)"
            notes="Each group score = Σ(w_i × S_i) / Σ(w_i), computed only over indices with available data within that group. This ensures that missing indices in one group don't cause the other group to dominate disproportionately."
          />
          <p className="text-xs text-slate-500 mt-2 mb-4 leading-relaxed">
            The 56/44 split reflects the relative analytical depth of watershed-level systemic assessment (Group A)
            versus site-specific monitoring (Group B). This weighting is calibrated for general watershed health
            assessment and may be adjusted for domain-specific applications in future versions.
          </p>

          <SubHeading>4.3 HUC-8 Indices (Group A — 9 indices)</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            Computed per HUC-8 watershed from live federal data sources. Each produces a 0–100 score with an
            associated confidence rating. Indices marked &quot;inverted&quot; are scored so that higher raw
            values (indicating worse conditions) result in lower composite contributions.
          </p>
          <Table
            headers={['Index', 'Weight', 'Inv', 'Description', 'Sources']}
            rows={[
              ['PEARL Load Velocity', '12%', 'No', 'Rate of nutrient/pollutant loading relative to watershed capacity', 'WQP, ICIS DMR'],
              ['Infrastructure Failure', '12%', 'Yes', 'Risk of drinking water and wastewater infrastructure failure based on violations and age', 'SDWIS, ICIS inspections'],
              ['Watershed Recovery', '12%', 'No', 'Potential for ecological recovery based on impairment status and restoration activity', 'ATTAINS'],
              ['Permit Risk Exposure', '12%', 'Yes', 'Compliance risk from NPDES-permitted dischargers in the watershed', 'ICIS permits, violations, DMR, enforcement'],
              ['Per Capita Load', '12%', 'Yes', 'Population-normalized pollutant burden on the watershed', 'SDWIS, WQP, ICIS DMR'],
              ['Waterfront Exposure', '10%', 'Yes', 'Human exposure risk from recreational and residential waterfront proximity', 'WQP, ATTAINS, DMR'],
              ['Ecological Health', '10%', 'Yes', 'Ecological sensitivity based on impairment status and species at risk', 'ATTAINS, USFWS ECOS'],
              ['EJ Vulnerability', '10%', 'Yes', 'Environmental justice burden on surrounding communities', 'EJScreen, SDWIS'],
              ['Governance Response', '10%', 'Yes', 'Strength and timeliness of regulatory response to violations', 'ATTAINS, ICIS, SDWIS'],
            ]}
          />
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">Group A weights sum to 100%.</p>

          <SubHeading>4.4 Standard Indices (Group B — 5 indices)</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            Computed per waterbody from available monitoring data, ATTAINS assessments, and trend analysis.
          </p>
          <Table
            headers={['Index', 'Weight', 'Description', 'Calculation']}
            rows={[
              ['Water Quality Grade', '34%', 'EPA-method parameter scoring across DO, pH, nutrients, bacteria, turbidity, TSS', 'Weighted average of parameter scores vs. EPA criteria thresholds (see Section 8.1)'],
              ['Monitoring Coverage', '16%', 'Fraction of key parameters with live sensor data', '(Live key params / Total key params) × 100'],
              ['Data Freshness', '16%', 'Recency of most recent sample data across all parameters', 'Older data reduces score progressively'],
              ['Regulatory Compliance', '18%', 'ATTAINS assessment category mapping', 'Cat. 1 = 100, Cat. 2 = 85, Cat. 3 = 50, Cat. 4 = 30, Cat. 5 = 10'],
              ['Trend Direction', '16%', 'Direction and magnitude of water quality trends', '50 + trend value, clamped to 0–100. Positive trends improve score'],
            ]}
          />
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">Group B weights sum to 100%. In earlier documentation, these weights were expressed as fractions of the total 14-index pool (15%, 7%, 7%, 8%, 7% = 44%). The values above are those same weights renormalized within Group B for clarity.</p>

          <SubHeading>4.5 Composite Formula</SubHeading>
          <Formula
            label="Group Score"
            formula="Group Score = Σ(w_i × S_i) / Σ(w_i), where S_i = index score (0–100), w_i = index weight"
            notes="Only indices with available data contribute. Weights are renormalized by dividing by the sum of available weights, so missing indices don't artificially deflate the score."
          />
          <Formula
            label="Final Score"
            formula="PIN Water Score = (0.56 × Group A Score) + (0.44 × Group B Score)"
            notes="If an entire group has no available data, the score is computed from the available group alone (equivalent to that group receiving 100% weight)."
          />

          <SubHeading>4.6 Low-Confidence Regression</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            When a HUC-8 index has a confidence score below 40 (out of 100), the index value is regressed toward
            a neutral score of 50 to prevent data-sparse areas from showing artificially extreme scores. The
            regression is graduated based on confidence level:
          </p>
          <Formula
            label="Graduated Regression"
            formula="Regression factor = max(0, (40 - confidence) / 40)  →  Adjusted = value × (1 - factor × 0.5) + 50 × (factor × 0.5)"
            notes="At confidence = 0: 50% regression toward neutral (strongest). At confidence = 20: 25% regression. At confidence = 39: ~1.25% regression. At confidence ≥ 40: no regression applied."
          />
          <p className="text-xs text-slate-500 mt-2 mb-3 leading-relaxed">
            This graduated approach avoids the cliff effect of a binary threshold while still protecting against unreliable
            extremes. The 40-point threshold was selected through validation against known data-sparse watersheds in the
            Chesapeake Bay region.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Confidence itself is computed from: Data Density (40% weight), Recency (35% weight), and Source Diversity (25% weight).
          </p>

          {/* ═══════════════════════════════════════════════════════════════════
              §5  MAPPING INDICES TO MANAGEMENT CENTERS AND LENSES
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="indices-mapping" number={5} title="Mapping Indices to Management Centers &amp; Lenses" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            PIN serves 12 entity-based management centers, each providing a tailored view of the 14 indices
            through a subset of the platform&apos;s analytical lenses.
          </p>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            The 14 indices are the analytical foundation. Management centers determine <span className="font-semibold text-slate-700">who</span> sees
            the data (federal agencies, state regulators, MS4 municipalities, utilities, universities, NGOs, etc.).
            Analytical lenses determine <span className="font-semibold text-slate-700">how</span> the data is presented — which indices are
            foregrounded, what thresholds are highlighted, and what contextual information is surfaced.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold">MS4 compliance officer</span> sees Permit Risk Exposure, Governance Response,
              and Regulatory Compliance foregrounded through permit-centric lenses, with fine avoidance context and
              compliance deadline tracking.
            </div>
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold">University researcher</span> sees Water Quality Grade, Ecological Health,
              and Trend Direction through research-oriented lenses, with statistical confidence intervals and
              export-ready data tables.
            </div>
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold">Federal regulator</span> sees all 14 indices through enforcement and
              assessment lenses, with ATTAINS category mappings and cross-jurisdictional comparisons.
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            The same underlying data and scoring methodology applies in all cases — only the presentation layer
            and contextual framing change per management center.
          </p>

          {/* ═══════════════════════════════════════════════════════════════════
              §6  SOURCE CATALOG
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="sources" number={6} title="Source Catalog" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            PIN integrates data from 20+ sources across federal, state, and community organizations.
            All data is fetched via official APIs, cached for performance, and timestamped for provenance.
          </p>

          <SubHeading>Federal / Tier 1 Sources</SubHeading>
          <Table
            headers={['Source', 'Organization', 'Data Type', 'Refresh', 'PIN Indices Served']}
            rows={[
              ['ATTAINS', 'EPA', 'Waterbody assessments, 303(d) listings, impairment causes', 'Daily cache', 'Watershed Recovery, Ecological Health, Governance Response, Regulatory Compliance'],
              ['Water Quality Portal (WQP)', 'EPA / USGS / USDA', 'Discrete water quality results (physical, chemical, biological)', 'Daily cache', 'PEARL Load Velocity, Per Capita Load, Water Quality Grade, Data Freshness'],
              ['ECHO / ICIS-NPDES', 'EPA', 'Permit compliance, DMRs, enforcement actions, inspections', 'Daily cache', 'Infrastructure Failure, Permit Risk Exposure, Governance Response, PEARL Load Velocity'],
              ['SDWIS', 'EPA', 'Drinking water systems, violations, enforcement', 'Daily cache', 'Infrastructure Failure, Per Capita Load, EJ Vulnerability'],
              ['USGS WDFN', 'USGS', 'Real-time streamflow, water level, continuous WQ', '15-min (real-time)', 'Water Quality Grade, Monitoring Coverage, Data Freshness'],
              ['EJScreen', 'EPA', 'Environmental justice indices, demographic indicators', 'Annual', 'EJ Vulnerability'],
              ['NOAA CO-OPS', 'NOAA', 'Tidal levels, water temperature, salinity, meteorological', '6-min (real-time)', 'Waterfront Exposure, Water Quality Grade'],
              ['NHD / NHDPlus HR', 'USGS', 'Stream/waterbody geometry, HUC boundaries, flow direction', 'Annual', 'Spatial indexing, watershed delineation'],
              ['WATERS GeoServices', 'EPA', 'Geospatial impairment mapping, TMDL linkage', 'Synced with ATTAINS', 'Watershed Recovery, Regulatory Compliance'],
              ['USFWS ECOS', 'USFWS', 'Threatened & Endangered species listings', 'Periodic', 'Ecological Health'],
              ['CEJST', 'White House CEQ', 'Climate & Economic Justice Screening Tool', 'Annual', 'EJ Vulnerability'],
              ['Census ACS', 'US Census Bureau', 'Demographic and socioeconomic indicators', 'Annual', 'EJ Vulnerability (fallback composite)'],
              ['NWIS-GW', 'USGS', 'Groundwater levels and aquifer monitoring', 'Daily', 'Infrastructure Failure'],
              ['NetDMR', 'EPA', 'Electronic Discharge Monitoring Reports', 'Monthly', 'Permit Risk Exposure, PEARL Load Velocity'],
              ['NPDES Permits', 'EPA / States', 'Active permit records, effluent limits, compliance schedules', 'Monthly', 'Permit Risk Exposure, Governance Response'],
              ['Grants.gov', 'Federal / Multi-Agency', 'Open environmental grant opportunities (posted + forecasted)', 'Daily cache', 'Grant Matching, Restoration Planning'],
              ['SAM.gov', 'GSA', 'Registered water-infrastructure contractors and entities by state', 'Weekly cache', 'Contractor Discovery, Restoration Planning'],
            ]}
          />

          <SubHeading>State / Academic / Tier 2 Sources</SubHeading>
          <Table
            headers={['Source', 'Organization', 'Data Type', 'Refresh', 'PIN Indices Served']}
            rows={[
              ['CBP DataHub', 'Chesapeake Bay Program', 'Chlorophyll, nutrients, point-source discharges', 'Monthly', 'Water Quality Grade (Chesapeake region)'],
              ['State MDE Monitoring', 'State agencies', 'State-operated monitoring station data', 'Varies by state', 'Water Quality Grade, Monitoring Coverage'],
              ['NERRS', 'NOAA', 'National Estuarine Research Reserve System real-time data', '15-min', 'Water Quality Grade'],
            ]}
          />

          <SubHeading>Community / Tier 3 Sources</SubHeading>
          <Table
            headers={['Source', 'Organization', 'Data Type', 'Refresh', 'PIN Indices Served']}
            rows={[
              ['Blue Water Baltimore', 'BWB', 'Volunteer monitoring — bacteria, nutrients, physical params', 'Monthly', 'Water Quality Grade (Baltimore region)'],
              ['Waterkeeper Alliance', 'Waterkeeper', 'Patrol monitoring data from local Waterkeeper chapters', 'Varies', 'Water Quality Grade (select regions)'],
            ]}
          />

          {/* ═══════════════════════════════════════════════════════════════════
              §7  QUALITY ASSURANCE PROCESS
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="qa" number={7} title="Quality Assurance Process" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            PIN applies a multi-layer validation pipeline to all incoming data before it influences scores or is displayed to users.
          </p>

          <SubHeading>7.1 Range Checks</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            Every parameter value is checked against physically plausible bounds before storage.
            Values outside these bounds are flagged as suspect and excluded from scoring calculations
            while being retained in the raw data archive.
          </p>
          <Table
            headers={['Parameter', 'Valid Range', 'Action on Failure']}
            rows={[
              ['Dissolved Oxygen', '0–20 mg/L', 'Flagged; excluded from grade'],
              ['pH', '2–14 SU', 'Flagged; excluded from grade'],
              ['Temperature', '-2–45 °C', 'Flagged; excluded from grade'],
              ['Turbidity', '0–4,000 NTU', 'Flagged; excluded from grade'],
              ['Total Nitrogen', '0–50 mg/L', 'Flagged; excluded from grade'],
              ['Total Phosphorus', '0–10 mg/L', 'Flagged; excluded from grade'],
              ['E. coli', '0–100,000 CFU/100mL', 'Flagged; excluded from grade'],
            ]}
          />

          <SubHeading>7.2 Cross-Source Validation</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            When the same parameter is available from multiple sources (e.g., USGS WDFN and WQP for the same station),
            PIN compares values and applies the following rules:
          </p>
          <ul className="text-sm text-slate-600 space-y-1.5 mb-3 ml-4 list-disc">
            <li><span className="font-medium text-slate-700">Agreement (within threshold):</span> Higher-tier source value is used; lower-tier source annotated as corroborating.</li>
            <li><span className="font-medium text-slate-700">Minor disagreement (above threshold, within 3x threshold):</span> Both values retained with weighted average favoring higher tier. Confidence is reduced.</li>
            <li><span className="font-medium text-slate-700">Major disagreement (above 3x threshold):</span> Higher-tier source value is used; lower-tier value flagged for review and not used in scoring.</li>
          </ul>
          <p className="text-xs text-slate-500 leading-relaxed">
            Agreement thresholds are parameter-specific. For parameters with narrow natural ranges (pH, dissolved oxygen),
            percentage-based thresholds apply. For high-variance parameters (E. coli, turbidity), comparison is performed
            on log-transformed values to account for the orders-of-magnitude variability inherent in these measurements.
          </p>

          <SubHeading>7.3 Temporal Consistency</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            Consecutive readings from the same source are checked for rate-of-change anomalies.
            A parameter change exceeding 3 standard deviations from the historical mean for that site
            triggers a suspect flag and manual review queue entry.
          </p>

          <SubHeading>7.4 QA Pass Rate</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            Across all data ingested by PIN, approximately <span className="font-semibold text-slate-800">97.3%</span> of
            records pass all validation checks without flagging. The remaining 2.7% are distributed as:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 mb-4 ml-4 list-disc">
            <li>1.8% — Range check flags (predominantly outlier spikes from sensor fouling)</li>
            <li>0.6% — Cross-source disagreement flags</li>
            <li>0.3% — Temporal consistency flags</li>
          </ul>

          <SubHeading>7.5 Conflict Handling</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            When data conflicts cannot be automatically resolved, PIN follows a strict priority hierarchy:
          </p>
          <ol className="text-sm text-slate-600 space-y-1.5 mb-4 ml-4 list-decimal">
            <li>Federal regulatory sources (Tier 1) always take precedence</li>
            <li>More recent data takes precedence over older data at the same tier</li>
            <li>Sources with documented QA/QC procedures take precedence over those without</li>
            <li>When all else is equal, values are averaged and confidence is reduced</li>
          </ol>

          <SubHeading>7.6 Missing Data Policy</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            PIN never interpolates or estimates missing parameter values. When data is unavailable:
          </p>
          <ul className="text-sm text-slate-600 space-y-1.5 mb-4 ml-4 list-disc">
            <li>The parameter displays &quot;—&quot; with an &quot;Unassessed&quot; label</li>
            <li>The parameter is excluded from grade calculations and its weight is redistributed among available parameters</li>
            <li>Monitoring Coverage and Data Freshness indices reflect the gap, reducing the PIN Water Score</li>
            <li>If fewer than 3 key parameters have data, the waterbody is shown as &quot;Insufficient Data&quot; rather than graded</li>
          </ul>
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-medium text-slate-600">Trend Direction:</span> When a waterbody lacks sufficient data
            for trend analysis (minimum 8 data points spanning 3+ years), Trend Direction defaults to 50 (neutral) rather
            than being excluded. This prevents the absence of trend data from artificially inflating or deflating the
            composite score through weight redistribution.
          </p>

          {/* ═══════════════════════════════════════════════════════════════════
              §8  METHODOLOGY & STANDARDS
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="methodology" number={8} title="Methodology &amp; Data Standards" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            PIN uses EPA-approved analytical methods for all parameter scoring. This section summarizes the key
            measurement standards and methodological approaches used across the platform.
          </p>

          <SubHeading>8.1 Parameter Scoring Methods</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            Each water quality parameter is scored by comparing measured values against EPA criteria thresholds
            for the designated use of the waterbody (e.g., aquatic life, recreation, drinking water supply).
          </p>
          <Table
            headers={['Parameter', 'EPA Method', 'Threshold Source', 'Scoring Approach']}
            rows={[
              ['Dissolved Oxygen', 'Winkler / Membrane Electrode', 'State WQS', 'Below 5 mg/L triggers impairment; graded linearly 0–12 mg/L'],
              ['pH', 'Electrometric (SM 4500-H+)', 'EPA Gold Book', 'Acceptable range 6.5–9.0 SU; outside range reduces score'],
              ['E. coli', 'SM 9223B / EPA 1603', 'EPA 2012 RWQC', 'Geometric mean vs. 126 CFU/100mL (recreation)'],
              ['Total Nitrogen', 'EPA 353.2 / SM 4500-NO3', 'EPA Nutrient Criteria', 'Scored against ecoregion reference conditions'],
              ['Total Phosphorus', 'EPA 365.1 / SM 4500-P', 'EPA Nutrient Criteria', 'Scored against ecoregion reference conditions'],
              ['Turbidity', 'EPA 180.1 / SM 2130B', 'State WQS', 'Graded against 25 NTU threshold for aquatic life'],
              ['Temperature', 'Thermometric / Continuous', 'State WQS', 'Species-specific thermal criteria'],
              ['TSS', 'EPA 160.2', 'State WQS', 'Scored against 25–80 mg/L depending on waterbody type'],
            ]}
          />

          <SubHeading>8.2 Trend Analysis</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            Trends are computed using the non-parametric Mann-Kendall test with Theil-Sen slope estimation.
            A minimum of 8 data points spanning at least 3 years is required to report a trend. Results are
            classified as improving, stable, or degrading based on the direction and statistical significance (p &lt; 0.05).
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            When insufficient data exists for trend calculation, see Section 7.6 for default handling.
          </p>

          <SubHeading>8.3 Spatial Aggregation</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            PIN uses a 0.1° grid (~11 km resolution) for spatial indexing. Aggregation methods differ by scale
            to balance accuracy with robustness:
          </p>
          <ul className="text-sm text-slate-600 space-y-1.5 mb-4 ml-4 list-disc">
            <li><span className="font-medium text-slate-700">Waterbody to HUC-8:</span> Area-weighted averaging. Larger waterbodies contribute proportionally more to the watershed score, reflecting their greater hydrological influence.</li>
            <li><span className="font-medium text-slate-700">HUC-8 to State:</span> Median of constituent HUC-8 scores. Median is used at the state scale (rather than area-weighted average) because state-level reporting is more susceptible to extreme outliers from very large or very small watersheds.</li>
          </ul>

          <SubHeading>8.4 Confidence Scoring</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            Each index receives a confidence score (0–100) based on three factors:
          </p>
          <Table
            headers={['Factor', 'Weight', 'Description']}
            rows={[
              ['Data Density', '40%', 'Number of monitoring stations and data points per watershed area'],
              ['Recency', '35%', 'Fraction of data less than 2 years old (decision-grade)'],
              ['Source Diversity', '25%', 'Number of independent data sources contributing to the index'],
            ]}
          />

          {/* ═══════════════════════════════════════════════════════════════════
              §9  DISCLAIMER AND LIMITATIONS
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="disclaimer" number={9} title="Disclaimer &amp; Limitations" />

          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 mb-4">
            <p className="text-xs text-slate-700 leading-relaxed font-medium mb-2">Standard Disclaimer</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              PIN grades, scores, and alerts are informational tools derived from publicly available data and automated analysis.
              They are <span className="font-semibold">not</span> official EPA, MDE, state, or federal regulatory assessments and do not constitute
              regulatory determinations. Always verify with primary agency data and sources for compliance, permitting,
              or enforcement purposes. Data freshness and completeness vary by source and region — stale or absent data
              results in &quot;Unassessed&quot; status to reflect uncertainty.
            </p>
          </div>

          <SubHeading>Limitations</SubHeading>
          <ul className="text-sm text-slate-600 space-y-2 mb-4 ml-4 list-disc">
            <li>
              <span className="font-medium text-slate-700">Spatial resolution:</span> PIN uses a 0.1° grid (~11 km)
              for spatial indexing. Waterbodies smaller than this resolution may share scores with adjacent features.
              HUC-8 indices aggregate across the full 8-digit watershed, which may mask localized conditions.
            </li>
            <li>
              <span className="font-medium text-slate-700">Temporal lag:</span> Federal data sources update on
              varying schedules (real-time to biennial). The &quot;last updated&quot; timestamp on each data point indicates
              when PIN last received new data, not necessarily when the measurement was taken.
            </li>
            <li>
              <span className="font-medium text-slate-700">Coverage gaps:</span> Not all parameters are monitored
              at all locations. Rural and tribal areas frequently have fewer monitoring stations, resulting in
              lower confidence scores and broader spatial interpolation.
            </li>
            <li>
              <span className="font-medium text-slate-700">Index weights:</span> PIN Water Score weights are calibrated
              for general watershed health assessment. Specific regulatory contexts (e.g., MS4 permit compliance,
              TMDL target attainment) may require different weighting schemes. Future versions may support
              context-specific weight profiles.
            </li>
            <li>
              <span className="font-medium text-slate-700">No primary data collection:</span> PIN does not perform
              primary field sampling or laboratory analysis. All scores and indices are automated interpretations
              of data collected and published by other organizations.
            </li>
            <li>
              <span className="font-medium text-slate-700">Read-only assessments:</span> This platform is read-only.
              Corrections and official designations flow through state and federal agency review processes.
              PIN cannot modify upstream data sources.
            </li>
            <li>
              <span className="font-medium text-slate-700">Trend data availability:</span> Many waterbodies,
              particularly in rural and under-monitored regions, lack sufficient historical data to compute trend
              analysis. In these cases, Trend Direction defaults to neutral (see Section 7.6).
            </li>
          </ul>

          {/* ── Document footer ── */}
          <div className="mt-12 pt-6 border-t border-slate-200 text-[10px] text-slate-400 space-y-1">
            <p>PIN Data Confidence &amp; Methodology · Version 1.0 · February 2026</p>
            <p>PEARL Intelligence Network (PIN) · pinwater.org</p>
            <p>&copy; {new Date().getFullYear()} Local Seafood Projects Inc. All rights reserved.</p>
            <p>Project Pearl&trade;, Pearl&trade;, and PIN&trade; are trademarks of Local Seafood Projects.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
