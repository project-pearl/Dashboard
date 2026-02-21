"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

const TreatmentSection: React.FC = () => {
  return (
    <section className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50">

      {/* ══════════════════════════════════════════════════════════════════════
          HERO
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-6 pt-12 md:pt-16 pb-8">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/80 mb-3">
            Treatment Technology
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-800 leading-tight max-w-3xl mx-auto">
            Cleaning the water{" "}
            <span className="text-emerald-700">where it matters most.</span>
          </h1>
          <p className="mt-4 text-slate-500 max-w-xl mx-auto text-base">
            PEARL systems deploy directly in the waterway &mdash; treating pollution at the source
            with oyster biofiltration and multi-stage mechanical filtration.
          </p>
        </div>

        {/* Hero image — displayed prominently, not as a background */}
        <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200">
          <Image
            src="/Waterway Restoration.jpg"
            alt="PEARL waterway restoration system deployed in a coastal environment"
            width={1200}
            height={600}
            className="w-full object-cover"
            priority
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          THE PROBLEM WE SOLVE
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-600 mb-3">
              The Shoreline Gap
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-snug mb-5">
              Land-based tools stop at the water&apos;s edge. Pollution doesn&apos;t.
            </h2>
            <div className="space-y-4 text-[16px] leading-[1.85] text-slate-600">
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
          </div>
          <div className="rounded-xl overflow-hidden shadow-md border border-slate-200">
            <Image
              src="/Kidney.JPG"
              alt="PEARL acts as a kidney for waterways — filtering pollutants at the shoreline"
              width={600}
              height={450}
              className="w-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-b from-emerald-50/50 via-teal-50/30 to-white">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-600 mb-3">
              How It Works
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">
              Multi-Stage Active Filtration
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Three treatment stages work together: physical pre-treatment removes large solids,
              chemical polishing targets dissolved nutrients, and biological filtration through
              live oyster raceways handles what remains.
            </p>
          </div>

          {/* Flowtrain image */}
          <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white">
            <Image
              src="/Pearl-Flowtrain.png"
              alt="PEARL Multi-Stage Active Filtration — 3 tanks: Pre-Treatment, Chemical Stage, Biological Stage"
              width={1200}
              height={500}
              className="w-full object-contain"
            />
          </div>

          {/* 3-stage breakdown */}
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">1</span>
                <h3 className="font-bold text-slate-800 text-sm">Physical Pre-Treatment</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Minnow trap entry, 500&mu;m mesh screen, and gravity settling remove large debris,
                sediment, and suspended solids before water enters the chemical stage.
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">2</span>
                <h3 className="font-bold text-slate-800 text-sm">Chemical Polishing</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Zeolite, biochar, and nitrogen/phosphorus resin media adsorb dissolved nutrients
                and contaminants that physical filtration cannot capture.
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">3</span>
                <h3 className="font-bold text-slate-800 text-sm">Biological Filtration</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Live oyster raceways filter particles down to 2&mu;m, naturally removing bacteria,
                phytoplankton, and fine sediment. A 50&mu;m final screen ensures clean effluent.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PILOT RESULTS
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-6 py-16 md:py-20">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-600 mb-3">
            Field Validated
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
            Milton, Florida &mdash; January 2025
          </h2>
          <p className="text-slate-500 text-sm">
            Blackwater River watershed &middot; Real stormwater runoff &middot; 7-day continuous deployment &middot; Independent lab verification
          </p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { value: "88\u201395%", label: "TSS Removal", sub: "Suspended solids", color: "text-emerald-700" },
            { value: "93.8%", label: "E. coli Reduction", sub: "Below detection limits", color: "text-teal-700" },
            { value: "Zero", label: "Chemicals Added", sub: "Nature-based treatment", color: "text-sky-700" },
            { value: "7 Days", label: "Continuous Operation", sub: "Uncontrolled conditions", color: "text-indigo-700" },
          ].map((m, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm text-center">
              <div className={`text-2xl md:text-3xl font-extrabold ${m.color} mb-1`}>{m.value}</div>
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{m.label}</div>
              <div className="text-[11px] text-slate-400 mt-1">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Results infographic */}
        <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white">
          <Image
            src="/Pilot-Results-Jan-2026.png"
            alt="Project PEARL pilot performance results — 90-95% TSS reduction, 93.8% E. coli reduction"
            width={1200}
            height={600}
            className="w-full object-contain"
          />
        </div>

        <p className="text-center text-sm text-slate-500 mt-5 max-w-2xl mx-auto leading-relaxed">
          The E. coli reduction was unplanned. The system was designed for sediment. The fact that
          it knocked bacteria below detection limits showed us what an integrated biological and
          mechanical approach can do in real conditions.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DEPLOYMENT
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-b from-stone-50/80 via-white to-white">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-600 mb-3">
              Deployment
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">
              Built to Go Where the Problem Is
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              PEARL systems are modular and relocatable. They can be deployed from a vessel in
              tidal estuaries or mounted at fixed outfall points for permanent compliance.
            </p>
          </div>

          <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white mb-8">
            <Image
              src="/Deployable.JPG"
              alt="PEARL deployment configurations — vessel-mounted and fixed dockside"
              width={1200}
              height={550}
              className="w-full object-contain"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border-l-4 border-sky-500 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Vessel-Mounted Platform</h3>
              <p className="text-sm text-slate-600 mb-4">
                Mobile treatment for tidal, estuarine, and brackish environments. No land acquisition
                required and simplified permitting. Repositionable based on seasonal conditions.
              </p>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {["Mobile and repositionable", "No land acquisition required", "Simplified permitting", "Optimal for oyster integration"].map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-sky-500 mt-0.5">&#8226;</span>{t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl p-6 border-l-4 border-emerald-500 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Fixed Dockside System</h3>
              <p className="text-sm text-slate-600 mb-4">
                Permanent infrastructure for freshwater MS4 outfalls, PFAS hotspots, and year-round
                compliance points. Smaller footprint for constrained sites.
              </p>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {["Smaller footprint", "Permanent infrastructure", "Handles seasonal ice", "Agricultural and industrial sites"].map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">&#8226;</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DATA + INTELLIGENCE
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-6 py-16 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-600 mb-3">
              More Than a Filter
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-snug mb-5">
              Every unit is a data node.
            </h2>
            <div className="space-y-4 text-[16px] leading-[1.85] text-slate-600">
              <p>
                Each PEARL system carries 8 monitoring points that capture influent and effluent
                data in real time &mdash; TSS, turbidity, nutrients, microplastics, and dissolved oxygen.
                That data feeds directly into the PEARL Intelligence Network.
              </p>
              <p>
                Paired with federal datasets from USGS, EPA, and NOAA, every deployment
                adds resolution to a national picture of water quality. Treatment and
                monitoring become the same infrastructure.
              </p>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden shadow-md border border-slate-200">
            <Image
              src="/More than a filter.JPG"
              alt="PEARL Intelligence Network dashboard — real-time water quality monitoring and treatment data"
              width={700}
              height={500}
              className="w-full object-contain"
            />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SYSTEM ARCHITECTURE
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-b from-emerald-50/40 via-teal-50/20 to-white">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-600 mb-3">
              System Architecture
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">
              Diagnose and treat. One platform.
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              The only integrated system that identifies where waterways are failing and deploys
              physical infrastructure to fix them.
            </p>
          </div>

          <div className="space-y-4">
            {/* PIN Layer */}
            <div className="bg-white rounded-xl p-6 md:p-8 border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">01</span>
                  <h3 className="text-lg font-bold text-slate-800">PIN &mdash; The Diagnostic Layer</h3>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  Operational
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                The PEARL Intelligence Network monitors surface water quality across all 50 states.
                565,000+ assessment points. Real-time federal data from USGS, EPA, NOAA, and state
                agencies. Role-based dashboards for municipalities, regulators, researchers, and educators.
              </p>
              <div className="flex flex-wrap gap-2">
                {["50-state coverage", "15-min data resolution", "AI-powered analysis", "Compliance automation", "Cross-jurisdictional benchmarking"].map((t, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">{t}</span>
                ))}
              </div>
            </div>

            {/* Connector */}
            <div className="flex justify-center">
              <div className="w-px h-8 bg-gradient-to-b from-sky-300 to-emerald-300" />
            </div>

            {/* PEARL Layer */}
            <div className="bg-white rounded-xl p-6 md:p-8 border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">02</span>
                  <h3 className="text-lg font-bold text-slate-800">PEARL &mdash; The Treatment Layer</h3>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                  Pilot Validated
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Modular biofiltration and mechanical treatment deployed at the shoreline. Oyster
                raceways and progressive mesh screens intercept what land-based BMPs miss. Each
                unit generates high-frequency treatment data that feeds back into PIN.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Oyster biofiltration", "3-stage mechanical filtration", "88\u201395% TSS removal", "Mobile + fixed deployment", "Watershed-scalable"].map((t, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          WHY THIS MATTERS
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        <div className="relative rounded-xl overflow-hidden mb-10">
          <Image
            src="/Nice Wildlife Image.png"
            alt="Healthy coastal ecosystem — wildlife thriving in clean water"
            width={900}
            height={400}
            className="w-full object-cover aspect-[2.4/1]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
        </div>

        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-5">
            The goal is simple.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto mb-4">
            Clean water gives ecosystems a fair chance. It gives communities something to
            believe in. We are building the tools to prove that restoration works &mdash;
            with data, not promises &mdash; and to leave these waterways in better shape
            than we found them.
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-12">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-300 to-transparent" />
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-slate-500 text-base mb-6">
            If you work on water quality, we should talk.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="mailto:doug@project-pearl.org?subject=PEARL%20Pilot%20Briefing"
              className="px-8 py-3.5 text-sm font-semibold text-white rounded-lg bg-emerald-700 hover:bg-emerald-800 shadow-sm hover:shadow-md transition-all"
            >
              Request a Briefing
            </a>
            <Link
              href="/"
              className="px-8 py-3.5 text-sm font-semibold text-slate-700 rounded-lg border border-slate-300 hover:border-slate-400 hover:bg-stone-50 transition-all"
            >
              Explore the Platform
            </Link>
          </div>
          <p className="text-xs text-slate-400 tracking-wider mt-4">
            Available for state, federal, and municipal partners
          </p>
        </div>
      </div>
    </section>
  );
};

export default TreatmentSection;
