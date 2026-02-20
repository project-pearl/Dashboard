'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Printer, ArrowLeft, ChevronRight } from 'lucide-react';

// ─── Section nav items ───────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'parameters', label: 'Parameter Definitions' },
  { id: 'calculations', label: 'Calculation Methods' },
  { id: 'data-sources', label: 'Data Sources' },
  { id: 'qaqc', label: 'QA/QC Standards' },
  { id: 'units', label: 'Units & Conversions' },
  { id: 'glossary', label: 'Glossary' },
] as const;

// ─── Reusable table wrapper ──────────────────────────────────────────────────

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
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

// ─── Page Component ──────────────────────────────────────────────────────────

export default function MethodologyPage() {
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
          <Image src="/Pearl-Logo-alt.png" alt="PEARL" fill className="object-contain object-left" />
        </div>
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Methodology</div>
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
            <span className="text-sm font-semibold text-slate-800 hidden sm:inline">PEARL Platform Methodology &amp; Data Standards</span>
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

        <div ref={contentRef} className="max-w-4xl mx-auto px-6 py-8 print:px-0 print:max-w-none">
          {/* Title block */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">PEARL Platform Methodology &amp; Data Standards</h1>
            <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
              This document describes the measurement parameters, calculation methods, data sources, and quality assurance standards used across the PEARL water quality monitoring platform.
              All methods conform to EPA-approved analytical procedures and Clean Water Act regulatory frameworks.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
              <span>Version 1.0</span>
              <span>·</span>
              <span>Last updated: February 2026</span>
              <span>·</span>
              <span>Project PEARL — project-pearl.org</span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              §1  PARAMETER DEFINITIONS
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="parameters" number={1} title="Parameter Definitions" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            PEARL monitors the following water quality parameters. All measurements follow EPA-approved methods
            and are calibrated against NIST-traceable standards.
          </p>

          <Table
            headers={['Parameter', 'Unit', 'EPA Method', 'Detection Limit', 'PEARL Measurement Approach']}
            rows={[
              ['Dissolved Oxygen (DO)', 'mg/L', 'SM 4500-O G (Membrane electrode)', '0.1 mg/L', 'Optical luminescence sensor (RDO), continuous logging at 15-min intervals, auto-compensated for salinity and temperature'],
              ['pH', 'SU (Standard Units)', 'EPA 150.1 / SM 4500-H⁺ B', '0.01 SU', 'Combination glass electrode with Ag/AgCl reference, 2-point calibration (pH 4.0 & 7.0 NIST buffers), temperature-compensated'],
              ['Turbidity', 'NTU', 'EPA 180.1 (Nephelometric)', '0.02 NTU', 'Nephelometric 90° scatter sensor with ISO 7027 infrared source, auto-wiper to prevent biofouling'],
              ['Total Suspended Solids (TSS)', 'mg/L', 'EPA 160.2 / SM 2540 D', '1.0 mg/L', 'Gravimetric analysis for laboratory QC; field estimates via turbidity-TSS regression calibrated per site (R² ≥ 0.85)'],
              ['Total Nitrogen (TN)', 'mg/L', 'EPA 353.2 (NO₃-N) + SM 4500-N C (TKN)', '0.05 mg/L', 'Ion-selective electrode for nitrate (continuous); persulfate digestion for TKN (grab samples, lab analysis)'],
              ['Total Phosphorus (TP)', 'mg/L', 'EPA 365.1 (Ascorbic acid colorimetric)', '0.01 mg/L', 'Colorimetric in-situ analyzer with persulfate digestion; cross-validated with laboratory ICP-OES quarterly'],
              ['E. coli', 'CFU/100 mL or MPN/100 mL', 'EPA 1603 (mTEC) / SM 9223 B (Colilert)', '1 CFU/100 mL', 'Automated grab sampling with Colilert-18 IDEXX Quanti-Tray; results within 18-24 hrs; geometric mean over 30-day window'],
              ['Salinity', 'PSU (Practical Salinity Units)', 'SM 2520 B (Conductivity ratio)', '0.01 PSU', 'Calculated from conductivity-temperature-depth (CTD) sensor per UNESCO PSS-78 algorithm'],
              ['Conductivity', 'µS/cm', 'EPA 120.1 / SM 2510 B', '1 µS/cm', 'Four-electrode conductivity cell, temperature-compensated to 25°C reference; continuous logging'],
              ['Temperature', '°C', 'SM 2550 B (Thermometric)', '0.01 °C', 'Platinum RTD sensor (PT-1000), NIST-traceable ±0.1°C accuracy, integrated into multi-parameter sonde'],
            ]}
          />

          {/* ═══════════════════════════════════════════════════════════════════
              §2  CALCULATION METHODS
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="calculations" number={2} title="Calculation Methods" />

          <SubHeading>2.1 Removal Efficiency</SubHeading>
          <p className="text-sm text-slate-600 mb-2 leading-relaxed">
            Removal efficiency quantifies the percentage reduction of a pollutant concentration between an influent (upstream / pre-treatment) and effluent (downstream / post-treatment) measurement point.
            For parameters where higher values indicate better quality (e.g., DO), the formula is inverted to reflect improvement.
          </p>
          <Formula
            label="Standard Removal (TSS, TN, TP, Turbidity, E. coli)"
            formula="Removal % = ((C_influent − C_effluent) / C_influent) × 100"
            notes="Where C = concentration in the parameter's native unit. Negative values indicate degradation rather than improvement."
          />
          <Formula
            label="Improvement (DO — higher is better)"
            formula="Improvement % = ((C_effluent − C_influent) / max(C_influent, 0.1)) × 100"
            notes="DO efficiency uses the inverse relationship — an increase in DO represents treatment effectiveness. A floor of 0.1 mg/L prevents division-by-zero."
          />

          <SubHeading>2.2 Health Grades (A–F)</SubHeading>
          <p className="text-sm text-slate-600 mb-2 leading-relaxed">
            PEARL assigns a composite health grade to each waterbody based on a weighted scoring model across all available parameters.
            The score is mapped to a letter grade using the following scale:
          </p>
          <Table
            headers={['Score Range', 'Grade', 'Interpretation']}
            rows={[
              ['90–100', 'A', 'Excellent — Fully supporting all designated uses; meets or exceeds all criteria'],
              ['80–89', 'B', 'Good — Minor exceedances in 1–2 parameters; generally supporting uses'],
              ['70–79', 'C', 'Fair — Moderate impairment; 2–3 parameters exceed criteria intermittently'],
              ['60–69', 'D', 'Poor — Significant impairment; multiple parameters consistently exceed criteria'],
              ['0–59', 'F', 'Failing — Severe impairment; does not support designated uses; likely Category 5'],
            ]}
          />
          <Formula
            label="Composite Score"
            formula="Score = Σ(w_i × S_i) / Σ(w_i), where i ∈ {DO, pH, Turbidity, TSS, TN, TP, E.coli}"
            notes="Each parameter score S_i is 0–100 based on distance from the EPA criterion threshold. Weights w_i are: DO=0.20, Nutrients(TN+TP)=0.25, TSS=0.15, Turbidity=0.10, pH=0.10, E. coli=0.20. Parameters with no data are excluded and weights are renormalized."
          />

          <SubHeading>2.3 TMDL Credit Computation</SubHeading>
          <p className="text-sm text-slate-600 mb-2 leading-relaxed">
            Total Maximum Daily Load (TMDL) credits represent the pollutant load reduction achieved by a treatment system or BMP,
            expressed as mass per unit time (typically lbs/day or kg/yr).
          </p>
          <Formula
            label="Load Reduction (mass/time)"
            formula="Credit = Q × (C_in − C_out) × CF"
            notes="Q = flow rate (GPD or L/day); C_in/C_out = influent/effluent concentration (mg/L); CF = unit conversion factor (8.34 × 10⁻⁶ for GPD·mg/L → lbs/day, or 10⁻⁶ for L/day·mg/L → kg/day)."
          />
          <Formula
            label="Annualized TMDL Credit"
            formula="Annual Credit (lbs/yr) = Daily Credit (lbs/day) × Operating Days × Performance Factor"
            notes="Performance Factor (0.0–1.0) accounts for downtime, maintenance, and seasonal variation. PEARL default = 0.85 for continuous-monitoring systems."
          />

          {/* ═══════════════════════════════════════════════════════════════════
              §3  DATA SOURCES
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="data-sources" number={3} title="Data Sources" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            PEARL integrates data from multiple federal and state sources. All external data is fetched via official APIs,
            cached for performance, and timestamped for provenance tracking.
          </p>

          <Table
            headers={['Source', 'Agency', 'Update Frequency', 'Data Type', 'Coverage']}
            rows={[
              ['ATTAINS', 'EPA', 'Biennial (assessment cycle); cache refreshed daily', 'Waterbody impairment assessments, 303(d) listings, Category 1-5 classifications, impairment causes', 'All 50 states + territories; ~2.2M assessment units'],
              ['Water Quality Portal (WQP)', 'EPA / USGS / USDA', 'Continuous; new results within 24–48 hrs', 'Discrete water quality sample results (physical, chemical, biological)', '400M+ results from 900+ organizations nationwide'],
              ['ECHO', 'EPA', 'Monthly permit data; weekly DMR updates', 'NPDES permit compliance, discharge monitoring reports (DMRs), enforcement actions, inspection history', 'All active NPDES permits nationwide (~300K facilities)'],
              ['NPDES', 'EPA (via ECHO/ICIS)', 'Monthly', 'Permit limits, effluent guidelines, compliance schedules, MS4 permit status', 'All permitted point-source dischargers'],
              ['NHD (National Hydrography Dataset)', 'USGS', 'Annual refresh; HR version quarterly', 'Stream/waterbody geometry, reach codes, watershed boundaries (HUC-8/10/12), flow direction', 'Nationwide 1:24,000 scale (NHDPlus HR)'],
              ['WATERS (ATTAINS GeoServices)', 'EPA', 'Synced with ATTAINS cycle', 'Geospatial impairment mapping, assessment unit boundaries, TMDL linkage', 'All states with ATTAINS submissions'],
              ['NWIS', 'USGS', 'Real-time (15-min); daily values updated nightly', 'Streamflow, water level, continuous water quality (DO, pH, turbidity, temperature, conductivity)', '~13,000 active real-time stations nationwide'],
              ['EJScreen', 'EPA', 'Annual (demographic); biennial (environmental)', 'Environmental justice indices, demographic indicators, pollution burden scores per census block group', 'Nationwide at census block group level'],
              ['NOAA CO-OPS', 'NOAA', 'Real-time (6-min tidal); hourly meteorological', 'Tidal water levels, water temperature, salinity, meteorological conditions at coastal stations', '~210 active stations along US coastline and Great Lakes'],
            ]}
          />

          {/* ═══════════════════════════════════════════════════════════════════
              §4  QA/QC STANDARDS
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="qaqc" number={4} title="QA/QC Standards" />

          <SubHeading>4.1 Quality Assurance Project Plan (QAPP) Framework</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            All PEARL monitoring deployments operate under a site-specific QAPP conforming to EPA Requirements for Quality Assurance
            Project Plans (QA/R-5, EPA/240/B-01/003). The QAPP defines data quality objectives (DQOs), sampling design,
            analytical methods, and assessment/oversight procedures. Key elements include:
          </p>
          <ul className="text-sm text-slate-600 space-y-1.5 mb-4 ml-4 list-disc">
            <li><span className="font-medium text-slate-700">Data Quality Objectives (DQOs):</span> Precision ≤ 20% RPD for field duplicates; accuracy within ±10% of certified reference materials; completeness ≥ 90% for continuous sensors.</li>
            <li><span className="font-medium text-slate-700">Measurement Performance Criteria:</span> Method detection limits (MDLs) verified quarterly per 40 CFR Part 136, Appendix B.</li>
            <li><span className="font-medium text-slate-700">Assessment &amp; Oversight:</span> Internal audits quarterly; external performance evaluation (PE) samples annually through EPA DMRQA program.</li>
          </ul>

          <SubHeading>4.2 Calibration Requirements</SubHeading>
          <Table
            headers={['Sensor / Instrument', 'Calibration Frequency', 'Standard', 'Acceptance Criteria']}
            rows={[
              ['DO (Optical)', 'Pre-deployment + biweekly', '100% air-saturated water + zero-DO (Na₂SO₃)', '±0.2 mg/L or ±2% of reading'],
              ['pH', 'Pre-deployment + weekly', '3-point: pH 4.01, 7.00, 10.01 NIST buffers', 'Slope 92–102%; offset ±0.3 SU'],
              ['Turbidity', 'Pre-deployment + monthly', 'Formazin: 0, 20, 100, 800 NTU', '±5% of known value or ±0.5 NTU below 40 NTU'],
              ['Conductivity', 'Pre-deployment + monthly', 'KCl standards: 100, 1000, 10000 µS/cm', '±5% of known value'],
              ['Temperature', 'Annual verification', 'NIST-traceable thermometer', '±0.2°C'],
              ['Nutrient Analyzer (TN/TP)', 'Each analytical batch', 'Certified reference materials (ERA/NIST)', 'Recovery 90–110%; RPD ≤ 15%'],
            ]}
          />

          <SubHeading>4.3 Data Validation Rules</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            All incoming data — both from PEARL sensors and external APIs — passes through a multi-tier validation pipeline:
          </p>
          <Table
            headers={['Tier', 'Check', 'Action on Failure']}
            rows={[
              ['Tier 1 — Range', 'Value within physically plausible bounds (e.g., DO 0–20 mg/L, pH 2–14, Temp -2–45°C)', 'Flagged as suspect; excluded from grade calculations; retained in raw archive'],
              ['Tier 2 — Rate-of-Change', 'Parameter change between consecutive readings ≤ 3× historical σ for that site', 'Flagged; manual review required; interpolated if isolated spike'],
              ['Tier 3 — Sensor Diagnostics', 'Battery voltage, signal strength, wiper cycle confirmation, fouling index', 'Data quarantined; maintenance alert generated'],
              ['Tier 4 — Cross-Parameter', 'Logical consistency (e.g., conductivity vs salinity relationship; DO vs temperature saturation)', 'Lower-confidence flag; both parameters reviewed'],
              ['Tier 5 — Duplicate/Replicate', 'Field duplicate RPD ≤ 20%; lab replicate RPD ≤ 15%', 'Results averaged if within tolerance; flagged if exceeded'],
            ]}
          />

          <SubHeading>4.4 Outlier Detection</SubHeading>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            PEARL uses a combination of statistical and domain-specific methods to detect outliers:
          </p>
          <ul className="text-sm text-slate-600 space-y-1.5 mb-4 ml-4 list-disc">
            <li><span className="font-medium text-slate-700">Modified Z-Score (Iglewicz &amp; Hoaglin):</span> Median-based; flags values with |M_i| &gt; 3.5 where M_i = 0.6745(x_i − median)/MAD.</li>
            <li><span className="font-medium text-slate-700">Grubbs&apos; Test:</span> Applied to grab-sample batches (n ≥ 7) at α = 0.05 significance level.</li>
            <li><span className="font-medium text-slate-700">Seasonal Decomposition:</span> STL decomposition removes seasonal + trend components; residuals beyond ±3σ flagged.</li>
            <li><span className="font-medium text-slate-700">Domain Rules:</span> Supersaturation events (DO &gt; 120% saturation) retained but annotated; sudden salinity drops after rain events are expected and not flagged.</li>
          </ul>

          {/* ═══════════════════════════════════════════════════════════════════
              §5  UNITS & CONVERSIONS
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="units" number={5} title="Units & Conversions" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            Standard units and conversion factors used throughout the PEARL platform.
          </p>

          <Table
            headers={['Quantity', 'PEARL Standard Unit', 'Conversion', 'Notes']}
            rows={[
              ['Concentration (mass)', 'mg/L', '1 mg/L = 1 ppm = 1,000 µg/L', 'Used for DO, TN, TP, TSS'],
              ['Concentration (bacteria)', 'CFU/100 mL', '1 CFU/100 mL ≈ 1 MPN/100 mL', 'EPA considers CFU and MPN interchangeable for regulatory purposes'],
              ['Turbidity', 'NTU', '1 NTU ≈ 1 FNU (ISO 7027)', 'NTU (EPA 180.1) and FNU (ISO 7027) are numerically similar but methodologically distinct'],
              ['Conductivity', 'µS/cm', '1 mS/cm = 1,000 µS/cm', 'Always reported at 25°C reference temperature'],
              ['Salinity', 'PSU', '1 PSU ≈ 1 ppt ≈ 1 g/kg', 'PSU is dimensionless per PSS-78; ppt is approximate equivalent'],
              ['Temperature', '°C', '°F = (°C × 9/5) + 32', 'All PEARL data stored in Celsius'],
              ['Flow rate', 'GPD (gallons/day)', '1 GPD = 3.785 L/day; 1 MGD = 10⁶ GPD', 'Used for TMDL load calculations and PEARL unit capacity'],
              ['Load', 'lbs/day', '1 lb/day = 0.4536 kg/day', 'TMDL credits and pollutant load reductions'],
              ['Area', 'acres', '1 acre = 0.4047 hectares = 43,560 ft²', 'Watershed and drainage area'],
              ['Volume', 'gallons', '1 gallon = 3.785 liters', 'Treatment capacity and biofiltration volumes'],
              ['pH', 'SU (dimensionless)', 'pH = −log₁₀[H⁺]', 'Logarithmic scale: each unit = 10× change in acidity'],
            ]}
          />

          {/* ═══════════════════════════════════════════════════════════════════
              §6  GLOSSARY
              ═══════════════════════════════════════════════════════════════════ */}
          <SectionHeading id="glossary" number={6} title="Glossary" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            Key terms used across the PEARL platform, defined in plain language.
          </p>

          <div className="space-y-3">
            {([
              ['ATTAINS', 'Assessment, Total Maximum Daily Load (TMDL) Tracking and Implementation System. EPA\'s national database for tracking waterbody health assessments and impairment listings under Clean Water Act §303(d).'],
              ['BMP (Best Management Practice)', 'A structural or non-structural control measure — such as rain gardens, bioswales, retention ponds, or street sweeping — designed to reduce pollutant loads in stormwater runoff before it reaches surface waters.'],
              ['Category 5 (Cat 5)', 'The most impaired classification under CWA §303(d). A waterbody in Category 5 is impaired for one or more designated uses, and no TMDL has been established yet. These waterbodies are the highest priority for restoration.'],
              ['CWA (Clean Water Act)', 'Federal law (33 U.S.C. §1251 et seq.) establishing the regulatory framework for discharging pollutants into US waters and setting surface water quality standards.'],
              ['Designated Use', 'The purpose a waterbody is intended to serve — e.g., aquatic life support, recreation (swimming), drinking water supply, shellfish harvesting, or agricultural irrigation.'],
              ['DMR (Discharge Monitoring Report)', 'A periodic report submitted by NPDES-permitted facilities documenting their actual effluent discharge concentrations and volumes, filed through EPA\'s NetDMR system.'],
              ['DO (Dissolved Oxygen)', 'The amount of oxygen gas dissolved in water. Aquatic life requires minimum DO levels — typically ≥ 5.0 mg/L for most freshwater fish species.'],
              ['DQO (Data Quality Objective)', 'Qualitative and quantitative statements that define the type, quality, and quantity of data needed to support a specific decision or action, per EPA Guidance (QA/G-4).'],
              ['EJ (Environmental Justice)', 'The fair treatment and meaningful involvement of all people — regardless of race, color, national origin, or income — in environmental decision-making. EPA\'s EJScreen tool quantifies EJ vulnerability.'],
              ['GPD (Gallons Per Day)', 'Standard unit for flow rate in US water treatment contexts. PEARL units are rated in GPD to indicate treatment throughput capacity.'],
              ['Impairment', 'A waterbody is "impaired" when it fails to meet water quality criteria for one or more of its designated uses. Impairments are classified by severity (Categories 1–5) and by cause (e.g., nutrients, pathogens, sediment).'],
              ['MDL (Method Detection Limit)', 'The minimum concentration of a substance that can be measured with 99% confidence that the true value is greater than zero, per 40 CFR Part 136 Appendix B.'],
              ['MS4 (Municipal Separate Storm Sewer System)', 'A publicly-owned stormwater conveyance system (storm drains, pipes, ditches) that discharges into surface waters without treatment. MS4 operators require NPDES permits and must implement stormwater management programs.'],
              ['NPDES (National Pollutant Discharge Elimination System)', 'The EPA permit program under CWA §402 that regulates point-source discharges of pollutants into US waters. All MS4s, industrial facilities, and wastewater treatment plants require NPDES permits.'],
              ['NTU (Nephelometric Turbidity Unit)', 'The standard unit for measuring turbidity — the cloudiness of water caused by suspended particles. Higher NTU values indicate more turbid (cloudier) water.'],
              ['QAPP (Quality Assurance Project Plan)', 'A formal document describing the quality assurance and quality control activities for an environmental data collection project, per EPA Requirements QA/R-5.'],
              ['Removal Efficiency', 'The percentage reduction of a pollutant achieved by a treatment system, calculated from influent and effluent concentrations. A 90% TSS removal means the system captures 90% of suspended solids.'],
              ['TMDL (Total Maximum Daily Load)', 'The maximum amount of a pollutant that a waterbody can receive and still meet water quality standards. TMDLs are established for impaired waters under CWA §303(d) and allocate pollutant loads among sources.'],
              ['TSS (Total Suspended Solids)', 'The total mass of solid particles (organic and inorganic) suspended in a water sample, measured by filtration and gravimetric analysis. A primary indicator of sediment pollution.'],
              ['WLA (Wasteload Allocation)', 'The portion of a TMDL assigned to existing and future point sources (e.g., NPDES-permitted dischargers). The remaining allocation goes to nonpoint sources (LA) and a margin of safety (MOS).'],
              ['WQS (Water Quality Standards)', 'State-adopted standards defining designated uses, numeric criteria (e.g., DO ≥ 5.0 mg/L), narrative criteria, and antidegradation policies for each waterbody, per CWA §303(c).'],
            ] as [string, string][]).map(([term, def]) => (
              <div key={term} className="flex gap-3 text-sm">
                <dt className="font-semibold text-slate-800 min-w-[200px] flex-shrink-0">{term}</dt>
                <dd className="text-slate-600 leading-relaxed">{def}</dd>
              </div>
            ))}
          </div>

          {/* ── Document footer ── */}
          <div className="mt-12 pt-6 border-t border-slate-200 text-[10px] text-slate-400 space-y-1">
            <p>PEARL Platform Methodology &amp; Data Standards · Version 1.0 · February 2026</p>
            <p>This document is provided for informational purposes. PEARL assessments are derived from publicly available data and do not constitute official regulatory determinations. Always verify with primary agency sources for compliance or permitting decisions.</p>
            <p>© {new Date().getFullYear()} Project PEARL · project-pearl.org</p>
          </div>
        </div>
      </div>
    </div>
  );
}
