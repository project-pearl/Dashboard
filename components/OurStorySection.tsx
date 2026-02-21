"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// ─── Sub-components (matching TreatmentSection design language) ──────────────

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

const OurStorySection: React.FC = () => {
  return (
    <section
      className="relative text-white overflow-hidden"
      style={{ background: "#060e1a" }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — "It started with a river"
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-24 md:py-32 px-6 text-center">
        <GlowOrb size={500} color="rgba(14,165,233,0.04)" top="-100px" left="20%" />
        <GlowOrb size={400} color="rgba(20,184,166,0.03)" top="50px" right="10%" />

        <div className="relative max-w-3xl mx-auto">
          <SectionLabel>Origin Story</SectionLabel>

          <h1 className="text-4xl md:text-[3.4rem] leading-[1.1] font-light text-slate-200 mb-6">
            It started with a river{" "}
            <span
              className="font-bold"
              style={{
                background: "linear-gradient(135deg, #38bdf8, #06b6d4, #22c55e)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              no one was cleaning.
            </span>
          </h1>

          <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            The Potomac. The Chesapeake. Waterways across America choked by stormwater
            runoff, agricultural nutrients, and sediment &mdash; with no infrastructure
            between the land and the water to stop it.
          </p>
        </div>

        {/* Hero image */}
        <div className="relative max-w-4xl mx-auto mt-12 rounded-sm overflow-hidden">
          <Image
            src="/marsh-waterfront.jpeg"
            alt="Coastal marsh waterfront"
            width={1200}
            height={500}
            className="object-cover w-full aspect-[2.4/1]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060e1a] via-transparent to-transparent" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          THE PROBLEM
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-16 md:py-24 px-6">
        <div className="relative max-w-5xl mx-auto">
          <SectionLabel>The Problem We Found</SectionLabel>

          {/* 3-stat row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              { value: "200M+", label: "gallons of raw sewage", detail: "Potomac River, Jan 2026" },
              { value: "7,000+", label: "MS4 systems nationwide", detail: "No shoreline interception" },
              { value: "Cat. 5", label: "impaired waterbodies", detail: "No TMDL yet established" },
            ].map((stat, i) => (
              <div key={i} className="text-center p-6 rounded-sm border border-white/[0.06] bg-white/[0.02]">
                <div
                  className="text-3xl md:text-4xl font-bold mb-2"
                  style={{
                    background: "linear-gradient(135deg, #38bdf8, #22c55e)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {stat.value}
                </div>
                <div className="text-sm text-slate-300 font-medium">{stat.label}</div>
                <div className="text-[11px] font-mono text-slate-600 mt-1">{stat.detail}</div>
              </div>
            ))}
          </div>

          {/* Prose */}
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <p className="text-slate-400 text-[15px] leading-[1.8]">
                Land-based best management practices &mdash; bioswales, retention ponds,
                street sweeping &mdash; stop at the shoreline. Once pollutants cross into
                the water column, nothing intercepts them. Sediment settles. Nutrients
                feed algal blooms. Bacteria spreads.
              </p>
              <p className="text-slate-400 text-[15px] leading-[1.8]">
                This gap has been documented, regulated around, and worked around for
                decades &mdash; but never directly solved. The EPA tracks it. States
                report on it. Municipal stormwater permits require action. But between the
                last BMP and the open water, there is nothing.
              </p>
              <p className="text-slate-500 text-[15px] leading-[1.8] italic">
                We asked a simple question: what if there was something?
              </p>
            </div>
            <div className="relative rounded-sm overflow-hidden border border-white/[0.06]">
              <Image
                src="/Real Culprit.png"
                alt="The real culprit — stormwater runoff"
                width={600}
                height={400}
                className="object-cover w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          THE EXPERIMENT
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-16 md:py-24 px-6">
        <GlowOrb size={350} color="rgba(6,182,212,0.03)" bottom="0" left="10%" />

        <div className="relative max-w-5xl mx-auto">
          <SectionLabel>The Experiment</SectionLabel>

          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Prose */}
            <div className="space-y-5">
              <p className="text-slate-300 text-[15px] leading-[1.8]">
                In January 2025, a team deployed a prototype biofiltration system in
                Milton, Florida &mdash; on the Blackwater River watershed. Real stormwater
                runoff. No lab conditions. No controlled environment.
              </p>
              <p className="text-slate-400 text-[15px] leading-[1.8]">
                The hypothesis: oysters &mdash; nature&apos;s most efficient filter feeders
                &mdash; combined with progressive mechanical mesh screens, could intercept
                what land-based BMPs miss. A living treatment system deployed at the
                shoreline gap itself.
              </p>

              {/* Spec table */}
              <div className="border border-white/[0.06] rounded-sm overflow-hidden text-[13px] font-mono">
                {[
                  ["Location", "Milton, FL — Blackwater River"],
                  ["Duration", "7-day continuous field deployment"],
                  ["Conditions", "Real stormwater runoff, uncontrolled"],
                  ["Verification", "Independent third-party lab analysis"],
                ].map(([label, value], i) => (
                  <div key={i} className={`flex ${i > 0 ? "border-t border-white/[0.06]" : ""}`}>
                    <div className="w-32 sm:w-40 px-3 py-2.5 text-cyan-400/70 bg-white/[0.02] shrink-0">
                      {label}
                    </div>
                    <div className="px-3 py-2.5 text-slate-400">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Image */}
            <div className="relative">
              <Image
                src="/pearl-barge.jpg"
                alt="PEARL modular treatment barge"
                width={600}
                height={400}
                className="rounded-sm shadow-2xl w-full"
              />
              <div className="absolute -bottom-3 right-4 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#060e1a]/90 backdrop-blur-md border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-mono text-emerald-400/80 tracking-wide">
                  Field Validated &middot; Jan 2025
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          THE RESULTS
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-16 md:py-24 px-6">
        <GlowOrb size={400} color="rgba(20,184,166,0.04)" top="0" right="20%" />

        <div className="relative max-w-5xl mx-auto">
          <SectionLabel>What We Found</SectionLabel>

          {/* 4-metric display */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { value: "93.8%", label: "E. coli Reduction", detail: "Not even targeting bacteria" },
              { value: "88–95%", label: "TSS Removal", detail: "Total Suspended Solids" },
              { value: "Zero", label: "Added Chemicals", detail: "Nature-based treatment" },
              { value: "7 Days", label: "Field Deployment", detail: "Continuous operation" },
            ].map((m, i) => (
              <div key={i} className="text-center p-5 rounded-sm border border-white/[0.06] bg-white/[0.02]">
                <div
                  className="text-2xl md:text-3xl font-bold mb-1"
                  style={{
                    background: "linear-gradient(135deg, #38bdf8, #22c55e)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {m.value}
                </div>
                <div className="text-sm text-slate-300 font-medium">{m.label}</div>
                <div className="text-[10px] font-mono text-slate-600 mt-1">{m.detail}</div>
              </div>
            ))}
          </div>

          {/* Blockquote */}
          <blockquote className="border-l-[3px] border-cyan-500/40 pl-6 ml-4 md:ml-8 mb-10">
            <p className="text-slate-300 text-lg md:text-xl leading-relaxed italic">
              &ldquo;The 93.8% E. coli reduction was completely unexpected. The filtration
              system wasn&apos;t designed to target pathogens &mdash; it was designed for
              sediment. The result changed what we thought was possible.&rdquo;
            </p>
          </blockquote>

          {/* Results image */}
          <div className="relative max-w-3xl mx-auto rounded-sm overflow-hidden border border-white/[0.06]">
            <Image
              src="/pilot-results.png"
              alt="PEARL pilot results — lab analysis"
              width={800}
              height={400}
              className="object-cover w-full"
            />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          THE VISION
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-16 md:py-24 px-6">
        <div className="relative max-w-5xl mx-auto">
          <SectionLabel>What This Means</SectionLabel>

          <p className="text-slate-300 text-lg md:text-xl text-center max-w-3xl mx-auto mb-12 leading-relaxed">
            This is not a dashboard company with a side project. It is an integrated
            system &mdash; the only platform in the country that can simultaneously{" "}
            <span className="text-cyan-400 font-medium">identify where waterways are failing</span>{" "}
            and{" "}
            <span className="text-teal-400 font-medium">deploy physical infrastructure to fix them</span>.
          </p>

          {/* Two architecture cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* PIN */}
            <div className="relative p-6 rounded-sm border-l-[3px] border-cyan-500 bg-white/[0.02]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-cyan-400/50">01</span>
                  <span className="text-lg font-bold text-slate-200">The Diagnostic Layer</span>
                </div>
                <span className="text-[10px] font-mono tracking-wider px-2 py-1 rounded-sm bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  OPERATIONAL
                </span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                PIN &mdash; the PEARL Intelligence Network &mdash; monitors every surface
                waterbody in the United States. 565,000+ monitoring points. Real-time
                federal data from USGS, EPA, NOAA, and state agencies. Role-based
                dashboards for municipalities, agencies, researchers, and educators.
              </p>
              <div className="space-y-2 text-[13px] font-mono text-slate-500">
                <span className="block"><span className="text-cyan-400/50 mr-2">&#9656;</span>50-state coverage with 15-min data resolution</span>
                <span className="block"><span className="text-cyan-400/50 mr-2">&#9656;</span>AI-powered analysis and compliance automation</span>
                <span className="block"><span className="text-cyan-400/50 mr-2">&#9656;</span>Cross-jurisdictional benchmarking</span>
              </div>
            </div>

            {/* PEARL */}
            <div className="relative p-6 rounded-sm border-l-[3px] border-teal-500 bg-white/[0.02]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-teal-400/50">02</span>
                  <span className="text-lg font-bold text-slate-200">The Treatment Layer</span>
                </div>
                <span className="text-[10px] font-mono tracking-wider px-2 py-1 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  PILOT VALIDATED
                </span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                PEARL units are modular treatment platforms deployed at the shoreline gap.
                Each unit is also a high-frequency data node with 8 monitoring points,
                transforming environmental restoration into a source of valuable, real-time
                intelligence.
              </p>
              <div className="space-y-2 text-[13px] font-mono text-slate-500">
                <span className="block"><span className="text-teal-400/50 mr-2">&#9656;</span>Oyster biofiltration + mechanical mesh screens</span>
                <span className="block"><span className="text-teal-400/50 mr-2">&#9656;</span>88-95% TSS removal in field conditions</span>
                <span className="block"><span className="text-teal-400/50 mr-2">&#9656;</span>Zero chemical additives</span>
              </div>
            </div>
          </div>

          {/* Potomac callout */}
          <div className="max-w-3xl mx-auto p-6 rounded-sm border border-white/[0.06] bg-white/[0.02]">
            <p className="text-slate-400 text-[15px] leading-[1.8]">
              In January 2026, a collapsed sewer line dumped over 200 million gallons of
              raw sewage into the Potomac River &mdash; one of the largest spills in U.S.
              history. No independent monitoring detected it. No treatment intercepted it.
              Had PEARL units been deployed at overflow points along that corridor, the
              system would have both detected the anomaly in real-time and provided
              physical interception of particulates and pathogens.
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          BUILT IN MARYLAND
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-16 md:py-24 px-6">
        <GlowOrb size={350} color="rgba(14,165,233,0.03)" bottom="20%" right="25%" />

        <div className="relative max-w-3xl mx-auto text-center">
          <SectionLabel>Built In Maryland</SectionLabel>

          <Image
            src="/Logo_Pearl_with_reef.jpg"
            alt="Project PEARL"
            width={160}
            height={160}
            className="rounded-xl opacity-80 mx-auto mb-8"
          />

          <div className="space-y-5 text-left">
            <p className="text-slate-400 text-[15px] leading-[1.8]">
              Project PEARL was born out of Maryland&apos;s local seafood industry and
              Chesapeake Bay conservation culture. Local Seafood Projects Inc. saw the
              same problem from both sides: watermen watching their harvest decline, and
              municipalities struggling to meet stormwater permits with tools that stop at
              the shoreline.
            </p>
            <p className="text-slate-400 text-[15px] leading-[1.8]">
              The frustration was simple &mdash; the monitoring infrastructure and the
              treatment infrastructure had never been integrated. Agencies had the data.
              Engineers had the BMPs. But no one had built a system that could diagnose a
              waterbody&apos;s health and treat it in the same platform.
            </p>
            <p className="text-slate-300 text-[15px] leading-[1.8] font-medium">
              PEARL&apos;s mission is not to sell software. It is to restore water quality
              at national scale &mdash; and to build the intelligence infrastructure that
              makes restoration measurable, verifiable, and fundable.
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CTA
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative py-16 md:py-20 text-center px-6">
        <GlowOrb size={400} color="rgba(14,165,233,0.04)" bottom="0" left="35%" />

        <div className="relative max-w-xl mx-auto border-t border-cyan-500/10 pt-12">
          <p className="text-slate-500 text-lg md:text-xl mb-2">
            The water doesn&apos;t wait.
          </p>
          <p
            className="text-2xl md:text-3xl font-bold mb-10"
            style={{
              background: "linear-gradient(135deg, #38bdf8, #06b6d4, #22c55e)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Neither should we.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="mailto:doug@project-pearl.org?subject=PEARL%20Pilot%20Briefing"
              className="px-10 py-4 text-sm font-mono font-bold tracking-wider text-white uppercase rounded-sm bg-gradient-to-r from-cyan-600/30 to-teal-600/20 border border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(14,165,233,0.15)] transition-all duration-300"
            >
              Request a Briefing &rarr;
            </a>
            <Link
              href="/"
              className="px-10 py-4 text-sm font-mono font-bold tracking-wider text-slate-400 uppercase rounded-sm border border-white/[0.08] hover:border-white/[0.15] hover:text-white transition-all duration-300"
            >
              Explore the Platform
            </Link>
          </div>

          <p className="text-slate-700 text-[11px] font-mono tracking-wider mt-5">
            AVAILABLE FOR STATE &middot; FEDERAL &middot; MUNICIPAL PARTNERS
          </p>
        </div>
      </div>
    </section>
  );
};

export default OurStorySection;
