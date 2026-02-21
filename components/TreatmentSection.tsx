"use client";

import React, { useState } from "react";
import Image from "next/image";

// ─── Ocean palette tokens ─────────────────────────────────────────────────
const OCEAN = {
  deep: "#020c1b",
  mid: "#0a192f",
  shelf: "#0d2847",
  seafoam: "#64ffda",
  blue: "#00b4d8",
  deepWater: "#0077b6",
  abyss: "#023e8a",
  gold: "#ffd166",
  text: "#ccd6f6",
  muted: "#8892b0",
  faint: "#495670",
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="h-px flex-1 max-w-[40px]" style={{ background: `linear-gradient(to right, ${OCEAN.seafoam}60, transparent)` }} />
    <span className="text-[11px] font-mono tracking-[0.15em] uppercase" style={{ color: `${OCEAN.seafoam}99` }}>
      {children}
    </span>
    <div className="h-px flex-1 max-w-[40px]" style={{ background: `linear-gradient(to left, ${OCEAN.seafoam}60, transparent)` }} />
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
    className="absolute rounded-full pointer-events-none blur-[100px]"
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

  return (
    <section className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${OCEAN.deep} 0%, ${OCEAN.mid} 40%, ${OCEAN.shelf} 100%)` }}>
      {/* Ocean-tinted grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(${OCEAN.blue}40 1px, transparent 1px),
            linear-gradient(90deg, ${OCEAN.blue}40 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — The Kidney Metaphor
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-24 md:py-32 px-6">
        <GlowOrb size={600} color={`${OCEAN.deepWater}15`} top="-10%" left="15%" />
        <GlowOrb size={500} color={`${OCEAN.blue}10`} top="10%" right="5%" />
        <GlowOrb size={300} color={`${OCEAN.seafoam}08`} bottom="0" left="50%" />

        <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div>
            <SectionLabel>Treatment Technology</SectionLabel>

            <h2 className="text-4xl md:text-[3.4rem] leading-[1.08] font-light tracking-tight mb-6" style={{ color: OCEAN.text }}>
              What if we could install<br />
              a kidney for{" "}
              <span
                className="font-bold"
                style={{
                  background: `linear-gradient(135deg, ${OCEAN.blue}, ${OCEAN.seafoam})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                America&apos;s waterways
              </span>
              ?
            </h2>

            <p className="text-lg md:text-xl leading-relaxed max-w-lg" style={{ color: OCEAN.muted }}>
              PIN provides the diagnostic layer &mdash; real-time intelligence across
              565,000 assessment points. PEARL provides the therapeutic layer &mdash;
              physical treatment at the shoreline.
            </p>
          </div>

          {/* CSS Kidney Visual */}
          <div className="relative flex items-center justify-center py-8">
            {/* Ambient glow behind kidney */}
            <div className="absolute w-64 h-64 rounded-full blur-[60px] opacity-30" style={{ background: `radial-gradient(circle, ${OCEAN.blue}, transparent)` }} />

            <svg viewBox="0 0 280 320" className="w-56 md:w-72 relative z-10" aria-label="Kidney metaphor — filtering waterways">
              <defs>
                <linearGradient id="kidneyFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={OCEAN.deepWater} stopOpacity="0.6" />
                  <stop offset="50%" stopColor={OCEAN.blue} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={OCEAN.seafoam} stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="dirtyFlow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.5" />
                </linearGradient>
                <linearGradient id="cleanFlow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={OCEAN.blue} stopOpacity="0.5" />
                  <stop offset="100%" stopColor={OCEAN.seafoam} stopOpacity="0.8" />
                </linearGradient>
                <filter id="kidneyGlow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Kidney shape — stylized bean */}
              <path
                d="M140,30 C200,30 230,80 230,130 C230,180 200,220 180,240 C160,260 155,290 140,290 C125,290 120,260 100,240 C80,220 50,180 50,130 C50,80 80,30 140,30Z"
                fill="url(#kidneyFill)"
                stroke={OCEAN.blue}
                strokeWidth="1.5"
                filter="url(#kidneyGlow)"
                opacity="0.9"
              />
              {/* Inner structure lines */}
              <path d="M140,60 C160,100 160,180 140,240" fill="none" stroke={OCEAN.seafoam} strokeWidth="0.8" opacity="0.3" strokeDasharray="4 3" />
              <path d="M110,80 C130,120 130,200 110,260" fill="none" stroke={OCEAN.blue} strokeWidth="0.6" opacity="0.25" strokeDasharray="3 4" />
              <path d="M170,80 C150,120 150,200 170,260" fill="none" stroke={OCEAN.blue} strokeWidth="0.6" opacity="0.25" strokeDasharray="3 4" />

              {/* Dirty water IN (left) */}
              <line x1="0" y1="120" x2="50" y2="130" stroke="url(#dirtyFlow)" strokeWidth="3" strokeDasharray="6 4">
                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
              </line>
              <line x1="0" y1="150" x2="50" y2="150" stroke="url(#dirtyFlow)" strokeWidth="2.5" strokeDasharray="5 4" opacity="0.7">
                <animate attributeName="stroke-dashoffset" from="18" to="0" dur="2.5s" repeatCount="indefinite" />
              </line>
              <line x1="0" y1="180" x2="55" y2="170" stroke="url(#dirtyFlow)" strokeWidth="2" strokeDasharray="4 4" opacity="0.5">
                <animate attributeName="stroke-dashoffset" from="16" to="0" dur="3s" repeatCount="indefinite" />
              </line>

              {/* Clean water OUT (right) */}
              <line x1="230" y1="130" x2="280" y2="120" stroke="url(#cleanFlow)" strokeWidth="3" strokeDasharray="6 4">
                <animate attributeName="stroke-dashoffset" from="0" to="20" dur="2s" repeatCount="indefinite" />
              </line>
              <line x1="230" y1="150" x2="280" y2="150" stroke="url(#cleanFlow)" strokeWidth="2.5" strokeDasharray="5 4" opacity="0.7">
                <animate attributeName="stroke-dashoffset" from="0" to="18" dur="2.5s" repeatCount="indefinite" />
              </line>
              <line x1="225" y1="170" x2="280" y2="180" stroke="url(#cleanFlow)" strokeWidth="2" strokeDasharray="4 4" opacity="0.5">
                <animate attributeName="stroke-dashoffset" from="0" to="16" dur="3s" repeatCount="indefinite" />
              </line>

              {/* Labels */}
              <text x="5" y="108" fill="#ef4444" fontSize="9" fontFamily="monospace" opacity="0.8" letterSpacing="0.05em">POLLUTED</text>
              <text x="235" y="108" fill={OCEAN.seafoam} fontSize="9" fontFamily="monospace" opacity="0.8" letterSpacing="0.05em">CLEAN</text>
            </svg>
          </div>
        </div>

        {/* Wave divider */}
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ height: 40 }}>
          <path d="M0,30 C360,60 720,0 1080,30 C1260,45 1380,40 1440,30 L1440,60 L0,60Z" fill={OCEAN.mid} opacity="0.5" />
        </svg>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SHORELINE GAP
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative max-w-6xl mx-auto px-6 pb-20 md:pb-28">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          {/* Diagram */}
          <div className="relative">
            <svg viewBox="0 0 400 280" className="w-full" aria-label="Treatment gap diagram">
              <defs>
                <linearGradient id="oceanWaterFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={OCEAN.abyss} stopOpacity="0.08" />
                  <stop offset="100%" stopColor={OCEAN.abyss} stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="oceanLandFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c4956a" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#c4956a" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Zones */}
              <rect x="0" y="30" width="150" height="210" fill="url(#oceanLandFill)" rx="2" />
              <rect x="150" y="30" width="100" height="210" fill={`${OCEAN.deepWater}14`} />
              <rect x="250" y="30" width="150" height="210" fill="url(#oceanWaterFill)" rx="2" />

              {/* Zone labels */}
              <text x="75" y="20" textAnchor="middle" fill="#c4956a" fontSize="8" fontFamily="monospace" opacity="0.7" letterSpacing="0.1em">LAND-BASED BMPs</text>
              <text x="200" y="20" textAnchor="middle" fill={OCEAN.blue} fontSize="8" fontFamily="monospace" fontWeight="bold" letterSpacing="0.1em">PEARL ZONE</text>
              <text x="325" y="20" textAnchor="middle" fill={OCEAN.abyss} fontSize="8" fontFamily="monospace" opacity="0.9" letterSpacing="0.1em">OPEN WATER</text>

              {/* Boundary lines */}
              <line x1="150" y1="30" x2="150" y2="240" stroke="#c4956a" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
              <line x1="250" y1="30" x2="250" y2="240" stroke={OCEAN.deepWater} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />

              {/* Pollutant flows */}
              {[70, 100, 130, 160, 190].map((y, i) => (
                <g key={`p-${i}`} opacity={0.3 + i * 0.08}>
                  <line x1="20" y1={y} x2="148" y2={y} stroke="#ef4444" strokeWidth="0.8" />
                  <circle cx={140 - i * 6} cy={y} r="1.5" fill="#ef4444" />
                </g>
              ))}

              {/* PEARL unit */}
              <rect x="165" y="110" width="70" height="28" rx="3" fill="none" stroke={OCEAN.blue} strokeWidth="0.8" opacity="0.8" />
              <rect x="182" y="98" width="36" height="12" rx="2" fill="none" stroke={OCEAN.blue} strokeWidth="0.6" opacity="0.6" />
              <circle cx="200" cy="104" r="4" fill="none" stroke={OCEAN.seafoam} strokeWidth="0.6" opacity="0.5" />
              {[172, 180, 188, 196, 204, 212, 220, 228].map((x, i) => (
                <line key={`f-${i}`} x1={x} y1="113" x2={x} y2="135" stroke={OCEAN.blue} strokeWidth="0.3" opacity={0.2 + i * 0.08} />
              ))}

              {/* Clean outflow */}
              {[70, 100, 130, 160, 190].map((y, i) => (
                <line key={`c-${i}`} x1="252" y1={y} x2="380" y2={y} stroke={OCEAN.seafoam} strokeWidth="0.6" opacity="0.12" strokeDasharray="4 4" />
              ))}

              {/* Gap callout */}
              <line x1="155" y1="232" x2="245" y2="232" stroke={OCEAN.gold} strokeWidth="1.2" />
              <text x="200" y="252" textAnchor="middle" fill={OCEAN.gold} fontSize="7" fontFamily="monospace" fontWeight="bold" letterSpacing="0.05em">CRITICAL TREATMENT GAP</text>
            </svg>

            {/* Floating badge */}
            <div className="absolute -bottom-3 right-4 md:right-0 flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-md border shadow-lg" style={{ background: `${OCEAN.deep}E6`, borderColor: `${OCEAN.seafoam}30`, boxShadow: `0 4px 20px ${OCEAN.seafoam}10` }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: OCEAN.seafoam, boxShadow: `0 0 8px ${OCEAN.seafoam}80` }} />
              <span className="text-sm font-semibold font-mono" style={{ color: OCEAN.seafoam }}>88&ndash;95% TSS Removal</span>
            </div>
          </div>

          {/* Explanation */}
          <div>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-[3px] h-7 mt-1 rounded-full" style={{ background: `linear-gradient(to bottom, ${OCEAN.gold}, transparent)` }} />
              <h3 className="text-2xl md:text-3xl font-bold leading-tight" style={{ color: OCEAN.text }}>
                Closing the Shoreline<br />Treatment Gap
              </h3>
            </div>

            <div className="space-y-4 text-[15px] leading-[1.8] ml-4" style={{ color: OCEAN.muted }}>
              <p>
                Current BMPs are <span className="font-medium" style={{ color: OCEAN.text }}>land-based</span> &mdash;
                they treat runoff before it reaches the water. Once pollutants cross the shoreline into the water column, no infrastructure intercepts them.
              </p>
              <p>
                PEARL fills this gap with a <span className="font-medium" style={{ color: OCEAN.text }}>dual-mechanism approach</span>: biological filtration through oyster raceways and mechanical filtration through progressive mesh stages.
              </p>
            </div>

            {/* Spec table */}
            <div className="mt-8 ml-4 pt-5 space-y-3" style={{ borderTop: `1px solid ${OCEAN.deepWater}20` }}>
              {[
                { k: "MECHANISM", v: "Oyster biofiltration + multi-stage mechanical" },
                { k: "DEPLOYMENT", v: "Vessel-mounted (mobile) · Dockside (fixed)" },
                { k: "TARGET", v: "TSS, microplastics, sediment, nutrients" },
              ].map(({ k, v }) => (
                <div key={k} className="flex gap-4 text-[12px] font-mono">
                  <span className="min-w-[100px] shrink-0" style={{ color: OCEAN.faint }}>{k}</span>
                  <span style={{ color: OCEAN.text }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FLOWTRAIN — Real image
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-16 md:py-24 px-6">
        <div className="relative max-w-5xl mx-auto">
          <SectionLabel>Multi-Stage Filtration</SectionLabel>

          <div className="rounded-md overflow-hidden border" style={{ borderColor: `${OCEAN.deepWater}30` }}>
            <Image
              src="/Pearl-Flowtrain.png"
              alt="PEARL Multi-Stage Active Filtration Flow Chart — 3 tanks: Pre-Treatment, Chemical Stage, Biological Stage"
              width={1200}
              height={500}
              className="w-full object-contain"
            />
          </div>

          <p className="text-center text-[11px] font-mono mt-4 leading-relaxed" style={{ color: OCEAN.faint }}>
            Tank 1: Physical pre-treatment (minnow trap → 500&mu;m screen → settling) &rarr; Tank 2: Chemical polishing (zeolite, biochar, N/P resin) &rarr; Tank 3: Biological stage (oyster biofiltration → 50&mu;m final screen)
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PILOT RESULTS
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-16 md:py-24 px-6">
        <GlowOrb size={500} color={`${OCEAN.blue}08`} top="20%" left="30%" />

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-sm mb-5" style={{ background: `${OCEAN.gold}12`, border: `1px solid ${OCEAN.gold}30` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: OCEAN.gold, boxShadow: `0 0 6px ${OCEAN.gold}80` }} />
              <span className="text-[10px] font-mono tracking-[0.12em] font-semibold uppercase" style={{ color: OCEAN.gold }}>
                Pilot Validated &middot; Independent Lab Verified
              </span>
            </div>

            <h3 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: OCEAN.text }}>
              Milton, Florida &mdash; January 2025
            </h3>
            <p className="text-sm font-mono" style={{ color: OCEAN.faint }}>
              Blackwater River watershed &middot; Real stormwater runoff &middot; 7-day field deployment
            </p>
          </div>

          {/* Metrics */}
          <div className="flex flex-wrap justify-center gap-12 md:gap-16 mb-12">
            {[
              { value: "88\u201395%", label: "TSS Removal", detail: "Total Suspended Solids" },
              { value: "93.8%", label: "E. coli Reduction", detail: "Below detection limits" },
              { value: "Field", label: "Conditions", detail: "Real stormwater runoff" },
              { value: "Independent", label: "Lab Verified", detail: "Third-party analysis" },
            ].map((metric, i) => (
              <div key={i} className="text-center">
                <div
                  className="text-3xl md:text-4xl font-extrabold tracking-tight mb-1"
                  style={{
                    background: `linear-gradient(135deg, ${OCEAN.blue}, ${OCEAN.seafoam})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {metric.value}
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: OCEAN.text }}>
                  {metric.label}
                </div>
                <div className="text-[10px] font-mono" style={{ color: OCEAN.faint }}>
                  {metric.detail}
                </div>
              </div>
            ))}
          </div>

          {/* Pilot Results Infographic */}
          <div className="rounded-md overflow-hidden border" style={{ borderColor: `${OCEAN.deepWater}30` }}>
            <Image
              src="/Pilot-Results-Jan-2026.png"
              alt="Project PEARL: 4-Stage Modular Treatment Process and Pilot Performance Results (Jan 2026) — 90-95% TSS reduction, 93.8% E. coli reduction"
              width={1200}
              height={600}
              className="w-full object-contain"
            />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DEPLOYMENT
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-16 md:py-24 px-6">
        <GlowOrb size={400} color={`${OCEAN.deepWater}10`} bottom="10%" right="20%" />

        <div className="relative max-w-5xl mx-auto">
          <SectionLabel>Deployment</SectionLabel>

          <h3 className="text-2xl md:text-3xl font-bold text-center mb-8" style={{ color: OCEAN.text }}>
            Deployable Where You Need It Most
          </h3>

          <div className="rounded-md overflow-hidden border mb-8" style={{ borderColor: `${OCEAN.deepWater}30` }}>
            <Image
              src="/Deployable.JPG"
              alt="PEARL deployment options — vessel-mounted mobile platform and fixed dockside system"
              width={1200}
              height={550}
              className="w-full object-contain"
            />
          </div>

          {/* Two deployment cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-sm border-l-[3px]" style={{ borderColor: OCEAN.blue, background: `${OCEAN.blue}08` }}>
              <h4 className="text-lg font-bold mb-3" style={{ color: OCEAN.text }}>
                Vessel-Mounted Platform
              </h4>
              <p className="text-sm mb-4" style={{ color: OCEAN.muted }}>
                Ideal for tidal, estuarine, and brackish environments.
              </p>
              <div className="space-y-2 text-[13px] font-mono" style={{ color: OCEAN.muted }}>
                {["Mobile and repositionable", "No land acquisition required", "Simplified permitting", "Optimal for oyster integration"].map((t, i) => (
                  <span key={i} className="block">
                    <span style={{ color: `${OCEAN.blue}80` }} className="mr-2">&#9656;</span>{t}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-sm border-l-[3px]" style={{ borderColor: OCEAN.seafoam, background: `${OCEAN.seafoam}08` }}>
              <h4 className="text-lg font-bold mb-3" style={{ color: OCEAN.text }}>
                Fixed Dockside System
              </h4>
              <p className="text-sm mb-4" style={{ color: OCEAN.muted }}>
                Designed for freshwater MS4 outfalls, PFAS hotspots, and permanent compliance points.
              </p>
              <div className="space-y-2 text-[13px] font-mono" style={{ color: OCEAN.muted }}>
                {["Smaller footprint", "Permanent infrastructure", "Ideal for sites with seasonal ice", "Agricultural and industrial sites"].map((t, i) => (
                  <span key={i} className="block">
                    <span style={{ color: `${OCEAN.seafoam}80` }} className="mr-2">&#9656;</span>{t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DATA PLATFORM — More Than a Filter
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-16 md:py-24 px-6">
        <div className="relative max-w-5xl mx-auto">
          <SectionLabel>More Than a Filter</SectionLabel>

          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold mb-5 leading-tight" style={{ color: OCEAN.text }}>
                An Environmental<br />Intelligence Network
              </h3>
              <p className="text-[15px] leading-[1.8] mb-6" style={{ color: OCEAN.muted }}>
                Every PEARL unit is a high-frequency data node with 8 monitoring points, transforming environmental restoration into a source of valuable, real-time intelligence for regulators, researchers, and municipalities.
              </p>
              <div className="space-y-3 text-[13px] font-mono" style={{ color: OCEAN.muted }}>
                {[
                  "Captures influent-to-effluent data on microplastics, nutrients, turbidity, and TSS",
                  "Integrates external datasets from USGS, NOAA, and state networks",
                  "Positions PEARL as a foundational environmental data network",
                ].map((t, i) => (
                  <span key={i} className="flex items-start gap-2">
                    <span style={{ color: OCEAN.seafoam }} className="mt-0.5 shrink-0">&#9656;</span>
                    <span>{t}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-md overflow-hidden border" style={{ borderColor: `${OCEAN.deepWater}30` }}>
              <Image
                src="/More than a filter.JPG"
                alt="PEARL Data Platform — dashboard mockup showing Chesapeake Bay monitoring, nutrient removal, microplastic capture, and turbidity reduction"
                width={700}
                height={500}
                className="w-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SYSTEM ARCHITECTURE
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-20">
        <div className="text-center mb-12">
          <SectionLabel>System Architecture</SectionLabel>
          <h3 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: OCEAN.text }}>
            Diagnostic + Therapeutic
          </h3>
          <p className="text-base max-w-lg mx-auto" style={{ color: OCEAN.muted }}>
            The only integrated platform for both water quality intelligence and physical remediation.
          </p>
        </div>

        {/* PIN Layer */}
        <div
          className="transition-all duration-300 cursor-default"
          style={{
            padding: "28px 36px",
            borderLeft: `3px solid ${OCEAN.blue}`,
            background: hoveredLayer === "pin" ? `${OCEAN.blue}08` : "transparent",
          }}
          onMouseEnter={() => setHoveredLayer("pin")}
          onMouseLeave={() => setHoveredLayer(null)}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono tracking-wider" style={{ color: OCEAN.blue }}>01</span>
              <h4 className="text-lg md:text-xl font-bold" style={{ color: OCEAN.text }}>PIN &mdash; Diagnostic Layer</h4>
            </div>
            <span className="text-[10px] font-mono font-semibold tracking-wider px-3 py-1 rounded-sm" style={{ color: OCEAN.seafoam, border: `1px solid ${OCEAN.seafoam}40` }}>
              OPERATIONAL
            </span>
          </div>
          <p className="text-sm leading-relaxed ml-8 mb-4 max-w-2xl" style={{ color: OCEAN.muted }}>
            Real-time water quality monitoring, role-based compliance dashboards, and AI-powered analytical insights across all 565,000 EPA assessment units.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 ml-8">
            {["565K monitoring points", "Role-based dashboards", "AI-powered analysis", "Cross-jurisdictional", "Real-time data feeds"].map((text, i) => (
              <span key={i} className="text-[11px] font-mono flex items-center gap-1.5" style={{ color: OCEAN.blue }}>
                <span className="opacity-40">&#9656;</span> {text}
              </span>
            ))}
          </div>
        </div>

        {/* Connector */}
        <div className="flex items-center ml-[17px] h-6">
          <div className="w-px h-full" style={{ background: `linear-gradient(to bottom, ${OCEAN.blue}, ${OCEAN.seafoam})` }} />
          <span className="text-[9px] font-mono tracking-widest ml-4" style={{ color: OCEAN.faint }}>INTEGRATED</span>
        </div>

        {/* PEARL Layer */}
        <div
          className="transition-all duration-300 cursor-default"
          style={{
            padding: "28px 36px",
            borderLeft: `3px solid ${OCEAN.seafoam}`,
            background: hoveredLayer === "pearl" ? `${OCEAN.seafoam}08` : "transparent",
          }}
          onMouseEnter={() => setHoveredLayer("pearl")}
          onMouseLeave={() => setHoveredLayer(null)}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono tracking-wider" style={{ color: OCEAN.seafoam }}>02</span>
              <h4 className="text-lg md:text-xl font-bold" style={{ color: OCEAN.text }}>PEARL &mdash; Therapeutic Layer</h4>
            </div>
            <span className="text-[10px] font-mono font-semibold tracking-wider px-3 py-1 rounded-sm" style={{ color: OCEAN.gold, border: `1px solid ${OCEAN.gold}40` }}>
              PILOT VALIDATED
            </span>
          </div>
          <p className="text-sm leading-relaxed ml-8 mb-4 max-w-2xl" style={{ color: OCEAN.muted }}>
            Modular biofiltration and mechanical treatment deployed at the shoreline &mdash; the first system engineered to close the critical treatment gap between land-based BMPs and open water.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 ml-8">
            {["Oyster biofiltration", "Mechanical filtration", "88\u201395% TSS removal", "Mobile + fixed deploy", "Watershed-scalable"].map((text, i) => (
              <span key={i} className="text-[11px] font-mono flex items-center gap-1.5" style={{ color: OCEAN.seafoam }}>
                <span className="opacity-40">&#9656;</span> {text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CTA
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-16 md:py-20 text-center px-6">
        <GlowOrb size={400} color={`${OCEAN.blue}08`} bottom="0" left="35%" />

        <div className="relative max-w-xl mx-auto pt-12" style={{ borderTop: `1px solid ${OCEAN.deepWater}20` }}>
          <p className="text-lg md:text-xl mb-2" style={{ color: OCEAN.muted }}>
            Most platforms diagnose.
          </p>
          <p
            className="text-2xl md:text-3xl font-bold mb-10"
            style={{
              background: `linear-gradient(135deg, ${OCEAN.blue}, ${OCEAN.seafoam})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            PEARL is built to treat.
          </p>

          <a
            href="mailto:doug@project-pearl.org?subject=PEARL%20Pilot%20Briefing"
            className="inline-block px-10 py-4 text-sm font-mono font-bold tracking-wider text-white uppercase rounded-sm transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${OCEAN.deepWater}50, ${OCEAN.blue}30)`,
              border: `1px solid ${OCEAN.seafoam}30`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${OCEAN.seafoam}60`;
              e.currentTarget.style.boxShadow = `0 0 30px ${OCEAN.seafoam}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = `${OCEAN.seafoam}30`;
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Request Pilot Briefing &rarr;
          </a>

          <p className="text-[11px] font-mono tracking-wider mt-5" style={{ color: OCEAN.faint }}>
            AVAILABLE FOR STATE &middot; FEDERAL &middot; MUNICIPAL PARTNERS
          </p>
        </div>
      </div>
    </section>
  );
};

export default TreatmentSection;
