"use client";

import React, { useState, useEffect, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PilotMetric {
  value: string;
  label: string;
  detail: string;
}

interface ProcessStep {
  label: string;
  color: string;
  glow: string;
}

interface LayerFeature {
  text: string;
}

// ─── Animated Counter Hook ──────────────────────────────────────────────────

function useAnimatedValue(target: number, duration = 2000): number {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start: number | null = null;
          const animate = (ts: number) => {
            if (!start) start = ts;
            const progress = Math.min((ts - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(eased * target);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return value;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-2 mb-6">
    <div className="h-px flex-1 max-w-[40px] bg-gradient-to-r from-cyan-500/60 to-transparent" />
    <span className="text-[11px] font-mono tracking-[0.15em] text-cyan-400/70 uppercase">
      {children}
    </span>
    <div className="h-px flex-1 max-w-[40px] bg-gradient-to-l from-cyan-500/60 to-transparent" />
  </div>
);

const GlowOrb: React.FC<{
  size: number;
  color: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
}> = ({ size, color, ...pos }) => (
  <div
    className="absolute rounded-full pointer-events-none blur-[80px]"
    style={{
      width: size,
      height: size,
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      ...pos,
    }}
  />
);

// ─── Main Component ─────────────────────────────────────────────────────────

const TreatmentSection: React.FC = () => {
  const [hoveredLayer, setHoveredLayer] = useState<"pin" | "pearl" | null>(null);

  const pilotMetrics: PilotMetric[] = [
    { value: "88–95%", label: "TSS Removal", detail: "Total Suspended Solids" },
    { value: "Multi-Stage", label: "Filtration", detail: "1mm → 500μm → 100μm" },
    { value: "Field", label: "Conditions", detail: "Real stormwater runoff" },
    { value: "Independent", label: "Lab Verified", detail: "Third-party analysis" },
  ];

  const processSteps: ProcessStep[] = [
    { label: "Polluted\nInflow", color: "#ef4444", glow: "rgba(239,68,68,0.15)" },
    { label: "Progressive\nScreens", color: "#f59e0b", glow: "rgba(245,158,11,0.15)" },
    { label: "Oyster\nBiofiltration", color: "#06b6d4", glow: "rgba(6,182,212,0.15)" },
    { label: "Fine Particle\nRemoval", color: "#8b5cf6", glow: "rgba(139,92,246,0.15)" },
    { label: "Clean\nOutflow", color: "#22c55e", glow: "rgba(34,197,94,0.15)" },
  ];

  const pinFeatures: LayerFeature[] = [
    { text: "565K monitoring points" },
    { text: "Role-based dashboards" },
    { text: "AI-powered analysis" },
    { text: "Cross-jurisdictional" },
    { text: "Real-time data feeds" },
  ];

  const pearlFeatures: LayerFeature[] = [
    { text: "Oyster biofiltration" },
    { text: "Mechanical filtration" },
    { text: "88–95% TSS removal" },
    { text: "Mobile + fixed deploy" },
    { text: "Watershed-scalable" },
  ];

  return (
    <section className="relative bg-[#060e1a] overflow-hidden">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(56,189,248,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56,189,248,0.4) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── HERO ── */}
      <div className="relative py-24 md:py-32 text-center px-6">
        <GlowOrb size={600} color="rgba(14,165,233,0.04)" top="-10%" left="20%" />
        <GlowOrb size={400} color="rgba(6,182,212,0.03)" top="20%" right="10%" />

        <div className="relative max-w-3xl mx-auto">
          <SectionLabel>Treatment Technology</SectionLabel>

          <h2 className="text-4xl md:text-[3.4rem] leading-[1.1] font-light text-slate-200 tracking-tight mb-6">
            What if we could install
            <br />
            a kidney for{" "}
            <span className="font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
              America&apos;s waterways
            </span>
            ?
          </h2>

          <p className="text-slate-500 text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
            PIN provides the diagnostic layer — real-time intelligence across
            565,000 assessment points. PEARL provides the therapeutic layer —
            physical treatment at the shoreline.
          </p>
        </div>
      </div>

      {/* ── SHORELINE GAP ── */}
      <div className="relative max-w-6xl mx-auto px-6 pb-20 md:pb-28">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          {/* Diagram */}
          <div className="relative">
            <svg viewBox="0 0 400 280" className="w-full" aria-label="Treatment gap diagram">
              <defs>
                <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.01" />
                </linearGradient>
                <linearGradient id="landFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#854d0e" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#854d0e" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Zones */}
              <rect x="0" y="30" width="150" height="210" fill="url(#landFill)" rx="2" />
              <rect x="150" y="30" width="100" height="210" fill="rgba(6,182,212,0.05)" />
              <rect x="250" y="30" width="150" height="210" fill="url(#waterFill)" rx="2" />

              {/* Zone labels */}
              <text x="75" y="20" textAnchor="middle" fill="#a16207" fontSize="8" fontFamily="monospace" opacity="0.7" letterSpacing="0.1em">
                LAND-BASED BMPs
              </text>
              <text x="200" y="20" textAnchor="middle" fill="#06b6d4" fontSize="8" fontFamily="monospace" fontWeight="bold" letterSpacing="0.1em">
                PEARL ZONE
              </text>
              <text x="325" y="20" textAnchor="middle" fill="#0ea5e9" fontSize="8" fontFamily="monospace" opacity="0.7" letterSpacing="0.1em">
                OPEN WATER
              </text>

              {/* Boundary lines */}
              <line x1="150" y1="30" x2="150" y2="240" stroke="#a16207" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
              <line x1="250" y1="30" x2="250" y2="240" stroke="#0ea5e9" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />

              {/* Pollutant flows */}
              {[70, 100, 130, 160, 190].map((y, i) => (
                <g key={`pollutant-${i}`} opacity={0.3 + i * 0.08}>
                  <line x1="20" y1={y} x2="148" y2={y} stroke="#ef4444" strokeWidth="0.8" />
                  <circle cx={140 - i * 6} cy={y} r="1.5" fill="#ef4444" />
                </g>
              ))}

              {/* PEARL unit */}
              <rect x="165" y="110" width="70" height="28" rx="3" fill="none" stroke="#06b6d4" strokeWidth="0.8" opacity="0.8" />
              <rect x="182" y="98" width="36" height="12" rx="2" fill="none" stroke="#06b6d4" strokeWidth="0.6" opacity="0.6" />
              <circle cx="200" cy="104" r="4" fill="none" stroke="#38bdf8" strokeWidth="0.6" opacity="0.5" />
              {[172, 180, 188, 196, 204, 212, 220, 228].map((x, i) => (
                <line key={`filter-${i}`} x1={x} y1="113" x2={x} y2="135" stroke="#06b6d4" strokeWidth="0.3" opacity={0.2 + i * 0.08} />
              ))}

              {/* Clean outflow */}
              {[70, 100, 130, 160, 190].map((y, i) => (
                <line key={`clean-${i}`} x1="252" y1={y} x2="380" y2={y} stroke="#22c55e" strokeWidth="0.6" opacity="0.12" strokeDasharray="4 4" />
              ))}

              {/* Gap callout */}
              <line x1="155" y1="232" x2="245" y2="232" stroke="#f59e0b" strokeWidth="1.2" />
              <text x="200" y="252" textAnchor="middle" fill="#f59e0b" fontSize="7" fontFamily="monospace" fontWeight="bold" letterSpacing="0.05em">
                CRITICAL TREATMENT GAP
              </text>
            </svg>

            {/* Floating pilot badge */}
            <div className="absolute -bottom-3 right-4 md:right-0 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#060e1a]/90 backdrop-blur-md border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-emerald-400 text-sm font-semibold font-mono">
                88–95% TSS Removal
              </span>
            </div>
          </div>

          {/* Explanation */}
          <div>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-[3px] h-7 mt-1 rounded-full bg-gradient-to-b from-amber-500 to-amber-500/0" />
              <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                Closing the Shoreline
                <br />
                Treatment Gap
              </h3>
            </div>

            <div className="space-y-4 text-slate-400 text-[15px] leading-[1.8] ml-4">
              <p>
                Current BMPs are{" "}
                <span className="text-slate-200 font-medium">land-based</span> —
                they treat runoff before it reaches the water. Once pollutants
                cross the shoreline into the water column, no infrastructure
                intercepts them.
              </p>
              <p>
                PEARL fills this gap with a{" "}
                <span className="text-slate-200 font-medium">
                  dual-mechanism approach
                </span>
                : biological filtration through oyster raceways and mechanical
                filtration through progressive mesh stages.
              </p>
            </div>

            {/* Spec table */}
            <div className="mt-8 ml-4 border-t border-cyan-500/10 pt-5 space-y-3">
              {[
                { k: "MECHANISM", v: "Oyster biofiltration + multi-stage mechanical" },
                { k: "DEPLOYMENT", v: "Vessel-mounted (mobile) · Dockside (fixed)" },
                { k: "TARGET", v: "TSS, microplastics, sediment, nutrients" },
              ].map(({ k, v }) => (
                <div key={k} className="flex gap-4 text-[12px] font-mono">
                  <span className="text-slate-600 min-w-[100px] shrink-0">{k}</span>
                  <span className="text-slate-300">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── PILOT RESULTS ── */}
      <div className="relative py-20 md:py-24">
        <GlowOrb size={500} color="rgba(6,182,212,0.04)" top="20%" left="35%" />

        <div className="relative max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-sm bg-emerald-500/[0.08] border border-emerald-500/20 mb-5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
              <span className="text-[10px] font-mono tracking-[0.12em] text-emerald-400 font-semibold uppercase">
                Pilot Validated · Independent Lab Verified
              </span>
            </div>

            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Milton, Florida — January 2025
            </h3>
            <p className="text-slate-600 text-sm font-mono">
              Blackwater River watershed · Real stormwater runoff · 7-day field deployment
            </p>
          </div>

          {/* Metrics */}
          <div className="flex flex-wrap justify-center gap-12 md:gap-16">
            {pilotMetrics.map((metric, i) => (
              <div key={i} className="text-center">
                <div
                  className="text-3xl md:text-4xl font-extrabold tracking-tight mb-1"
                  style={{
                    background: "linear-gradient(135deg, #38bdf8, #22c55e)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    textShadow: "0 0 40px rgba(56,189,248,0.15)",
                  }}
                >
                  {metric.value}
                </div>
                <div className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-0.5">
                  {metric.label}
                </div>
                <div className="text-slate-600 text-[10px] font-mono">
                  {metric.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PROCESS FLOW ── */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <p className="text-center text-slate-600 text-[10px] font-mono tracking-[0.15em] uppercase mb-8">
          Multi-Stage Active Filtration Process
        </p>

        <div className="flex items-center justify-center">
          {processSteps.map((step, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center">
                <div
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center mb-2 transition-all duration-300"
                  style={{
                    background: step.glow,
                    border: `1px solid ${step.color}33`,
                    boxShadow: `0 0 20px ${step.glow}`,
                  }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: step.color, opacity: 0.8 }}
                  />
                </div>
                <span
                  className="text-[10px] md:text-[11px] font-mono font-semibold text-center whitespace-pre-line leading-tight"
                  style={{ color: step.color }}
                >
                  {step.label}
                </span>
              </div>
              {i < processSteps.length - 1 && (
                <svg width="36" height="2" className="mx-1 md:mx-2 mb-8 shrink-0">
                  <line
                    x1="0" y1="1" x2="36" y2="1"
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                </svg>
              )}
            </React.Fragment>
          ))}
        </div>

        <p className="text-center text-slate-700 text-[11px] font-mono mt-6 italic">
          [ Replace with Pearl Flowtrain graphic ]
        </p>
      </div>

      {/* ── SYSTEM ARCHITECTURE ── */}
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-20">
        <div className="text-center mb-12">
          <SectionLabel>System Architecture</SectionLabel>
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Diagnostic + Therapeutic
          </h3>
          <p className="text-slate-500 text-base max-w-lg mx-auto">
            The only integrated platform for both water quality intelligence and
            physical remediation.
          </p>
        </div>

        {/* PIN Layer */}
        <div
          className="transition-all duration-300 cursor-default"
          style={{
            padding: "28px 36px",
            borderLeft: "3px solid #0ea5e9",
            background:
              hoveredLayer === "pin"
                ? "rgba(14,165,233,0.04)"
                : "transparent",
          }}
          onMouseEnter={() => setHoveredLayer("pin")}
          onMouseLeave={() => setHoveredLayer(null)}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-cyan-500 text-[11px] font-mono tracking-wider">
                01
              </span>
              <h4 className="text-lg md:text-xl font-bold text-white">
                PIN — Diagnostic Layer
              </h4>
            </div>
            <span className="text-[10px] font-mono font-semibold tracking-wider text-emerald-400 px-3 py-1 border border-emerald-500/25 rounded-sm">
              OPERATIONAL
            </span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed ml-8 mb-4 max-w-2xl">
            Real-time water quality monitoring, role-based compliance dashboards,
            and AI-powered analytical insights across all 565,000 EPA assessment
            units.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 ml-8">
            {pinFeatures.map((f, i) => (
              <span
                key={i}
                className="text-sky-400 text-[11px] font-mono flex items-center gap-1.5"
              >
                <span className="opacity-40">▸</span> {f.text}
              </span>
            ))}
          </div>
        </div>

        {/* Connector */}
        <div className="flex items-center ml-[17px] h-6">
          <div className="w-px h-full bg-gradient-to-b from-cyan-500 to-teal-500" />
          <span className="text-slate-700 text-[9px] font-mono tracking-widest ml-4">
            INTEGRATED
          </span>
        </div>

        {/* PEARL Treatment Layer */}
        <div
          className="transition-all duration-300 cursor-default"
          style={{
            padding: "28px 36px",
            borderLeft: "3px solid #06b6d4",
            background:
              hoveredLayer === "pearl"
                ? "rgba(6,182,212,0.04)"
                : "transparent",
          }}
          onMouseEnter={() => setHoveredLayer("pearl")}
          onMouseLeave={() => setHoveredLayer(null)}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-teal-500 text-[11px] font-mono tracking-wider">
                02
              </span>
              <h4 className="text-lg md:text-xl font-bold text-white">
                PEARL — Therapeutic Layer
              </h4>
            </div>
            <span className="text-[10px] font-mono font-semibold tracking-wider text-amber-400 px-3 py-1 border border-amber-500/25 rounded-sm">
              PILOT VALIDATED
            </span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed ml-8 mb-4 max-w-2xl">
            Modular biofiltration and mechanical treatment deployed at the
            shoreline — the first system engineered to close the critical
            treatment gap between land-based BMPs and open water.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 ml-8">
            {pearlFeatures.map((f, i) => (
              <span
                key={i}
                className="text-teal-400 text-[11px] font-mono flex items-center gap-1.5"
              >
                <span className="opacity-40">▸</span> {f.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="relative py-16 md:py-20 text-center px-6">
        <GlowOrb size={400} color="rgba(14,165,233,0.04)" bottom="0" left="35%" />

        <div className="relative max-w-xl mx-auto border-t border-cyan-500/10 pt-12">
          <p className="text-slate-500 text-lg md:text-xl mb-2">
            Most platforms diagnose.
          </p>
          <p
            className="text-2xl md:text-3xl font-bold mb-10"
            style={{
              background: "linear-gradient(135deg, #38bdf8, #06b6d4, #22c55e)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            PEARL is built to treat.
          </p>

          <a
            href="mailto:doug@project-pearl.org?subject=PEARL%20Pilot%20Briefing"
            className="inline-block px-10 py-4 text-sm font-mono font-bold tracking-wider text-white uppercase rounded-sm bg-gradient-to-r from-cyan-600/30 to-teal-600/20 border border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(14,165,233,0.15)] transition-all duration-300"
          >
            Request Pilot Briefing &rarr;
          </a>

          <p className="text-slate-700 text-[11px] font-mono tracking-wider mt-5">
            AVAILABLE FOR STATE · FEDERAL · MUNICIPAL PARTNERS
          </p>
        </div>
      </div>
    </section>
  );
};

export default TreatmentSection;
