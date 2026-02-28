"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";

const OurStorySection: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-stone-50 via-white to-stone-50">
    <section className="flex-1">
      <PublicHeader />
      {/* ── Title ── */}
      <div className="max-w-3xl mx-auto px-6 pt-28 md:pt-36 pb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/80 mb-3">
          Our Story
        </p>
        <h1 className="text-3xl md:text-5xl font-bold text-slate-800 leading-tight">
          It started with a visit{" "}
          <span className="text-emerald-700">that changed everything.</span>
        </h1>
      </div>

      {/* ── Featured image — full display ── */}
      <div className="max-w-4xl mx-auto px-6 mb-14">
        <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200">
          <Image
            src="/our-story.JPG"
            alt="Doug and family at the Navarre Beach Sea Turtle Conservation Center"
            width={1200}
            height={700}
            className="w-full object-cover"
            priority
          />
        </div>
        <p className="text-center text-sm text-slate-400 mt-3">
          Navarre Beach Sea Turtle Conservation Center &mdash; where it all started.
        </p>
      </div>

      {/* ── Story content ── */}
      <div className="max-w-3xl mx-auto px-6 pb-16 md:pb-20">
        <div className="space-y-8 text-[17px] md:text-lg leading-[1.9] text-slate-700">
          <p>
            We started Project PEARL after Doug and his family visited the Navarre Beach
            Sea Turtle Conservation Center. They saw what polluted coastal water does to
            living systems up close. The people there work every day to save animals that
            depend on these waters. What stayed with Doug was a simple thought.{" "}
            <span className="font-semibold text-slate-800">
              We work hard to rescue life in the water, but we rarely fix the water itself.
            </span>
          </p>

          <p>
            That visit changed how Doug looked at restoration. Most projects live in the
            nearshore zone, where stress is highest and pollution concentrates. Yet our
            tools stop at the shoreline or far upstream. There was no practical system
            focused on cleaning that water in place. That gap is what pushed him to build
            PIN.
          </p>

          <p>
            The first pilot made it real. We measured what went in and what came out. We
            saw large drops in suspended solids and bacteria. That turned this from an
            idea into a commitment. Clean water gives ecosystems a fair chance. It gives
            communities something to believe in. PIN exists to put working systems in
            the water, prove results with data, and help these places move from survival
            back to recovery.
          </p>
        </div>

        {/* ── Divider ── */}
        <div className="flex items-center gap-4 my-14">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-300 to-transparent" />
        </div>

        {/* ── Quote ── */}
        <div className="text-center mb-16">
          <p className="text-slate-500 text-base italic">
            &ldquo;The water doesn&apos;t wait. Neither should we.&rdquo;
          </p>
        </div>

        {/* ── Case Study: Milton, FL Pilot ── */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-bold uppercase tracking-wider mb-3">
              Case Study
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
              Milton, Florida &mdash; Blackwater River Watershed
            </h2>
            <p className="text-slate-500 text-sm">
              January 2025 &middot; 7-day continuous deployment &middot; Independent lab verification
            </p>
          </div>

          {/* Problem → Solution → Result structure */}
          <div className="grid md:grid-cols-3 gap-5 mb-10">
            <div className="p-6 rounded-xl bg-red-50 border border-red-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-3">The Problem</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Stormwater runoff carrying high sediment loads and bacteria into the Blackwater River watershed &mdash; a system already under stress. No in-water treatment existed between pollution sources and receiving waters.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-blue-50 border border-blue-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-3">The Solution</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Deployed PIN &mdash; a modular, chemical-free treatment platform combining engineered media filtration with biological processes. Continuous 7-day operation treating real stormwater runoff in field conditions.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-3">The Result</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                88&ndash;95% TSS removal and 93.8% E. coli reduction &mdash; with zero chemicals. The bacteria reduction was unplanned; the system was designed for sediment. Lab-verified by independent analysis.
              </p>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { value: "88\u201395%", label: "TSS Removal", color: "text-emerald-700" },
              { value: "93.8%", label: "E. coli Reduction", color: "text-teal-700" },
              { value: "Zero", label: "Chemicals Added", color: "text-sky-700" },
              { value: "7 Days", label: "Continuous Run", color: "text-indigo-700" },
            ].map((m, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm text-center">
                <div className={`text-2xl md:text-3xl font-extrabold ${m.color} mb-1`}>{m.value}</div>
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Results infographic */}
          <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white">
            <Image
              src="/Pilot-Results-Jan-2026.png"
              alt="Project PEARL pilot performance results — 88-95% TSS reduction, 93.8% E. coli reduction"
              width={1200}
              height={600}
              className="w-full object-contain"
            />
          </div>

          {/* Key takeaway */}
          <div className="mt-8 p-5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-sm text-slate-600 leading-relaxed text-center">
              <span className="font-semibold text-slate-800">Key Takeaway:</span> A nature-inspired mechanical system achieved lab-grade bacteria reduction without targeting bacteria directly &mdash; demonstrating that integrated biological and mechanical filtration outperforms single-mechanism approaches in real stormwater conditions.
            </p>
          </div>

          {/* Contact */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              For pilot data, lab reports, or deployment inquiries: <a href="mailto:doug@project-pearl.org" className="text-teal-600 hover:underline font-medium">doug@project-pearl.org</a>
            </p>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="flex items-center gap-4 mb-14">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-300 to-transparent" />
        </div>

        {/* ── CTA ── */}
        <div className="text-center">
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="mailto:doug@project-pearl.org?subject=PEARL%20Pilot%20Briefing"
              className="px-8 py-3.5 text-sm font-semibold text-white rounded-lg bg-emerald-700 hover:bg-emerald-800 shadow-sm hover:shadow-md transition-all"
            >
              Request a Briefing
            </a>
            <Link
              href="/treatment"
              className="px-8 py-3.5 text-sm font-semibold text-slate-700 rounded-lg border border-slate-300 hover:border-slate-400 hover:bg-stone-50 transition-all"
            >
              See the Technology
            </Link>
          </div>
        </div>
      </div>
    </section>
    <footer className="py-8 bg-stone-50 border-t border-slate-200">
      <div className="max-w-3xl mx-auto px-6 text-center space-y-1">
        <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Local Seafood Projects Inc. All rights reserved.</p>
        <p className="text-[10px] text-slate-400/70">Project Pearl&trade;, Pearl&trade;, ALIA&trade;, and AQUA-LO&trade; are trademarks of Local Seafood Projects.</p>
      </div>
    </footer>
    </div>
  );
};

export default OurStorySection;
