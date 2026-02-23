"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import SystemArchitecture from "@/components/SystemArchitecture";

/* ═══════════════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════════════ */

/** Triggers a CSS class when the element scrolls into view. */
function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/** Animated counter that counts from 0 to `end` when visible. */
function AnimatedCounter({ end, suffix = "", prefix = "", duration = 1800 }: {
  end: number; suffix?: string; prefix?: string; duration?: number;
}) {
  const [value, setValue] = useState(0);
  const { ref, visible } = useInView<HTMLSpanElement>(0.3);

  useEffect(() => {
    if (!visible) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * end));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [visible, end, duration]);

  return <span ref={ref}>{prefix}{value}{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════
   FADE-IN WRAPPER
   ═══════════════════════════════════════════════════════════════════════ */

function FadeIn({ children, className = "", delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const { ref, visible } = useInView<HTMLDivElement>(0.1);
  return (
    <div
      ref={ref}
      className={`transition-all duration-[900ms] ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

const TreatmentSection: React.FC = () => {
  /* Hero parallax-lite: translate image on scroll */
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="min-h-screen bg-white">
      <PublicHeader />

      {/* ════════════════════════════════════════════════════════════════
          HERO — Full-viewport, cinematic
          ════════════════════════════════════════════════════════════════ */}
      <div className="relative h-[100vh] min-h-[600px] overflow-hidden flex items-end">
        {/* Background image with parallax offset */}
        <div
          className="absolute inset-0 scale-110"
          style={{ transform: `translateY(${scrollY * 0.25}px) scale(1.1)` }}
        >
          <Image
            src="/Waterway Restoration.jpg"
            alt="PEARL waterway restoration system deployed in a coastal environment"
            fill
            className="object-cover"
            priority
          />
        </div>
        {/* Gradient overlay — dark at bottom for text */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        {/* Hero copy */}
        <div className="relative z-10 max-w-7xl mx-auto px-8 pb-24 md:pb-32 w-full">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-300/90 mb-5">
            Treatment Technology
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white leading-[1.05] max-w-4xl">
            Cleaning the water{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
              where it matters most.
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed">
            PEARL systems deploy directly in the waterway — treating pollution at the source
            with oyster biofiltration and multi-stage mechanical filtration.
          </p>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-60">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">Scroll</span>
            <div className="w-px h-8 bg-gradient-to-b from-white/50 to-transparent animate-pulse" />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          THE PROBLEM WE SOLVE
          ════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-8 py-28 md:py-36">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-teal-600 mb-4">
              The Shoreline Gap
            </p>
            <h2 className="text-3xl md:text-[2.75rem] font-bold text-slate-900 leading-[1.15] mb-6">
              Land-based tools stop at the water&apos;s edge.{" "}
              <span className="text-slate-400">Pollution doesn&apos;t.</span>
            </h2>
            <div className="space-y-5 text-[17px] leading-[1.9] text-slate-600">
              <p>
                Bioswales, retention ponds, and street sweeping do valuable work on land. But once
                stormwater runoff crosses the shoreline into the water column, no infrastructure
                intercepts it. Sediment settles on habitat. Nutrients drive algal blooms. Bacteria
                spreads through shellfish beds and swimming areas.
              </p>
              <p>
                PEARL was built to close that gap. We deploy treatment systems directly in the water,
                at the point where pollution concentrates and ecosystems are most stressed.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-br from-teal-100/60 to-emerald-100/40 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-700 opacity-0 group-hover:opacity-100" />
              <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5">
                <Image
                  src="/Kidney.JPG"
                  alt="PEARL acts as a kidney for waterways — filtering pollutants at the shoreline"
                  width={700}
                  height={525}
                  className="w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          HOW IT WORKS — Dark section for contrast
          ════════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-8 py-28 md:py-36">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-400 mb-4">
                How It Works
              </p>
              <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-5">
                Multi-Stage Active Filtration
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
                Three treatment stages work together: physical pre-treatment removes large solids,
                chemical polishing targets dissolved nutrients, and biological filtration through
                live oyster raceways handles what remains.
              </p>
            </div>
          </FadeIn>

          {/* Flowtrain image */}
          <FadeIn>
            <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl bg-white/5 backdrop-blur-sm">
              <Image
                src="/Pearl-Flowtrain.png"
                alt="PEARL Multi-Stage Active Filtration — 3 tanks: Pre-Treatment, Chemical Stage, Biological Stage"
                width={1400}
                height={580}
                className="w-full object-contain"
              />
            </div>
          </FadeIn>

          {/* 3-stage breakdown */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              {
                num: "01", title: "Physical Pre-Treatment",
                desc: "Minnow trap entry, 500\u00B5m mesh screen, and gravity settling remove large debris, sediment, and suspended solids before water enters the chemical stage.",
                accent: "from-amber-500 to-orange-500", ring: "ring-amber-500/20", badge: "bg-amber-500/10 text-amber-400",
              },
              {
                num: "02", title: "Chemical Polishing",
                desc: "Zeolite, biochar, and nitrogen/phosphorus resin media adsorb dissolved nutrients and contaminants that physical filtration cannot capture.",
                accent: "from-sky-500 to-cyan-500", ring: "ring-sky-500/20", badge: "bg-sky-500/10 text-sky-400",
              },
              {
                num: "03", title: "Biological Filtration",
                desc: "Live oyster raceways filter particles down to 2\u00B5m, naturally removing bacteria, phytoplankton, and fine sediment. A 50\u00B5m final screen ensures clean effluent.",
                accent: "from-emerald-500 to-teal-500", ring: "ring-emerald-500/20", badge: "bg-emerald-500/10 text-emerald-400",
              },
            ].map((stage, i) => (
              <FadeIn key={stage.num} delay={i * 150}>
                <div className={`group relative bg-white/[0.04] backdrop-blur-sm rounded-2xl p-7 ring-1 ${stage.ring} hover:bg-white/[0.08] transition-all duration-500 h-full`}>
                  {/* Gradient top bar */}
                  <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r ${stage.accent} opacity-40`} />
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-xs font-bold tracking-wider ${stage.badge} px-2.5 py-1 rounded-md`}>{stage.num}</span>
                    <h3 className="font-bold text-white text-[15px]">{stage.title}</h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{stage.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          PILOT RESULTS — Premium metrics
          ════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-8 py-28 md:py-36">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-teal-600 mb-4">
              Field Validated
            </p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight mb-3">
              Milton, Florida &mdash; January 2025
            </h2>
            <p className="text-slate-500 text-base md:text-lg">
              Blackwater River watershed &middot; Real stormwater runoff &middot; 7-day continuous deployment &middot; Independent lab verification
            </p>
          </div>
        </FadeIn>

        {/* Animated metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {[
            { end: 95, prefix: "88–", suffix: "%", label: "TSS Removal", sub: "Suspended solids", gradient: "from-emerald-500 to-teal-500" },
            { end: 93, prefix: "", suffix: ".8%", label: "E. coli Reduction", sub: "Below detection limits", gradient: "from-teal-500 to-cyan-500" },
            { end: 0, prefix: "", suffix: "", label: "Chemicals Added", sub: "Nature-based treatment", gradient: "from-sky-500 to-indigo-500", display: "Zero" },
            { end: 7, prefix: "", suffix: " Days", label: "Continuous Operation", sub: "Uncontrolled conditions", gradient: "from-indigo-500 to-violet-500" },
          ].map((m, i) => (
            <FadeIn key={i} delay={i * 100}>
              <div className="group relative bg-white rounded-2xl p-6 md:p-8 text-center ring-1 ring-slate-200/80 hover:ring-slate-300 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                {/* Top gradient accent */}
                <div className={`absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r ${m.gradient} rounded-full opacity-60 group-hover:opacity-100 transition-opacity`} />
                <div className={`text-3xl md:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r ${m.gradient} bg-clip-text text-transparent mb-2`}>
                  {m.display ?? <AnimatedCounter end={m.end} prefix={m.prefix} suffix={m.suffix} />}
                </div>
                <div className="text-xs font-semibold text-slate-800 uppercase tracking-[0.15em] mb-1">{m.label}</div>
                <div className="text-[11px] text-slate-400">{m.sub}</div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Results infographic */}
        <FadeIn>
          <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5 bg-white">
            <Image
              src="/Pilot-Results-Jan-2026.png"
              alt="Project PEARL pilot performance results — 90-95% TSS reduction, 93.8% E. coli reduction"
              width={1400}
              height={700}
              className="w-full object-contain"
            />
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="text-center text-base text-slate-500 mt-10 max-w-2xl mx-auto leading-relaxed italic">
            &ldquo;The E. coli reduction was unplanned. The system was designed for sediment. The fact that
            it knocked bacteria below detection limits showed us what an integrated biological and
            mechanical approach can do in real conditions.&rdquo;
          </p>
        </FadeIn>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          DEPLOYMENT
          ════════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-8 py-28 md:py-36">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-teal-600 mb-4">
                Deployment
              </p>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight mb-5">
                Built to Go Where the Problem Is
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
                PEARL systems are modular and relocatable. They can be deployed from a vessel in
                tidal estuaries or mounted at fixed outfall points for permanent compliance.
              </p>
            </div>
          </FadeIn>

          <FadeIn>
            <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5 bg-white mb-12">
              <Image
                src="/Deployable.JPG"
                alt="PEARL deployment configurations — vessel-mounted and fixed dockside"
                width={1400}
                height={640}
                className="w-full object-contain"
              />
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-8">
            <FadeIn>
              <div className="group relative bg-white rounded-2xl p-8 ring-1 ring-slate-200/80 hover:ring-sky-300/60 shadow-sm hover:shadow-xl transition-all duration-500 h-full">
                {/* Left accent bar */}
                <div className="absolute left-0 top-8 bottom-8 w-[3px] rounded-full bg-gradient-to-b from-sky-400 to-sky-600" />
                <div className="pl-4">
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Vessel-Mounted Platform</h3>
                  <p className="text-[15px] text-slate-600 leading-relaxed mb-5">
                    Mobile treatment for tidal, estuarine, and brackish environments. No land acquisition
                    required and simplified permitting. Repositionable based on seasonal conditions.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {["Mobile & repositionable", "No land acquisition", "Simplified permitting", "Optimal for oysters"].map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={150}>
              <div className="group relative bg-white rounded-2xl p-8 ring-1 ring-slate-200/80 hover:ring-emerald-300/60 shadow-sm hover:shadow-xl transition-all duration-500 h-full">
                <div className="absolute left-0 top-8 bottom-8 w-[3px] rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
                <div className="pl-4">
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Fixed Dockside System</h3>
                  <p className="text-[15px] text-slate-600 leading-relaxed mb-5">
                    Permanent infrastructure for freshwater MS4 outfalls, PFAS hotspots, and year-round
                    compliance points. Smaller footprint for constrained sites.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {["Smaller footprint", "Permanent infrastructure", "Handles seasonal ice", "Industrial & agricultural"].map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          DATA + INTELLIGENCE
          ════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-8 py-28 md:py-36">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-teal-600 mb-4">
              More Than a Filter
            </p>
            <h2 className="text-3xl md:text-[2.75rem] font-bold text-slate-900 leading-[1.15] mb-6">
              Every unit is{" "}
              <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                a data node.
              </span>
            </h2>
            <div className="space-y-5 text-[17px] leading-[1.9] text-slate-600">
              <p>
                Each PEARL system carries 8 monitoring points that capture influent and effluent
                data in real time — TSS, turbidity, nutrients, microplastics, and dissolved oxygen.
                That data feeds directly into the PEARL Intelligence Network.
              </p>
              <p>
                Paired with federal datasets from USGS, EPA, and NOAA, every deployment
                adds resolution to a national picture of water quality. Treatment and
                monitoring become the same infrastructure.
              </p>
            </div>

            {/* Inline metrics */}
            <div className="flex gap-8 mt-8 pt-8 border-t border-slate-200">
              {[
                { val: "8", label: "Monitoring points per unit" },
                { val: "50", label: "States covered by PIN" },
                { val: "565K+", label: "Assessment points" },
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-2xl font-extrabold text-slate-900">{stat.val}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-br from-teal-100/60 to-emerald-100/40 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-700 opacity-0 group-hover:opacity-100" />
              <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5">
                <Image
                  src="/More than a filter.JPG"
                  alt="PEARL Intelligence Network dashboard — real-time water quality monitoring and treatment data"
                  width={800}
                  height={600}
                  className="w-full object-contain transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SYSTEM ARCHITECTURE — Standalone component
          ════════════════════════════════════════════════════════════════ */}
      <SystemArchitecture />

      {/* ════════════════════════════════════════════════════════════════
          WHY THIS MATTERS — Emotional close
          ════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        {/* Full-bleed wildlife image */}
        <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
          <Image
            src="/Nice Wildlife Image.png"
            alt="Healthy coastal ecosystem — wildlife thriving in clean water"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white" />
        </div>

        <div className="max-w-3xl mx-auto px-8 -mt-16 relative z-10 pb-28 md:pb-36">
          <FadeIn>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 text-center leading-tight mb-8">
              The goal is simple.
            </h2>
            <p className="text-lg md:text-xl text-slate-600 leading-relaxed text-center max-w-2xl mx-auto">
              Clean water gives ecosystems a fair chance. It gives communities something to
              believe in. We are building the tools to prove that restoration works —
              with data, not promises — and to leave these waterways in better shape
              than we found them.
            </p>
          </FadeIn>

          {/* Divider */}
          <div className="flex items-center gap-4 my-16">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          </div>

          {/* CTA */}
          <FadeIn>
            <div className="text-center">
              <p className="text-slate-500 text-lg mb-8">
                If you work on water quality, we should talk.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="mailto:doug@project-pearl.org?subject=PEARL%20Pilot%20Briefing"
                  className="group relative px-10 py-4 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-300"
                >
                  Request a Briefing
                  <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">&rarr;</span>
                </a>
                <Link
                  href="/"
                  className="px-10 py-4 text-sm font-semibold text-slate-700 rounded-xl ring-1 ring-slate-300 hover:ring-slate-400 hover:bg-slate-50 hover:-translate-y-0.5 transition-all duration-300"
                >
                  Explore the Platform
                </Link>
              </div>
              <p className="text-xs text-slate-400 tracking-[0.2em] uppercase mt-6">
                Available for state, federal, and municipal partners
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
};

export default TreatmentSection;
