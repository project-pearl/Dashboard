"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

const OurStorySection: React.FC = () => {
  return (
    <section className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50">
      {/* ── Hero image with overlay title ── */}
      <div className="relative w-full h-[420px] md:h-[520px]">
        <Image
          src="/our-story.JPG"
          alt="Navarre Beach Sea Turtle Conservation Center visit"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-10 md:pb-14">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/80 mb-2">
              Our Story
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-800 leading-tight">
              It started with a visit{" "}
              <span className="text-emerald-700">that changed everything.</span>
            </h1>
          </div>
        </div>
      </div>

      {/* ── Story content ── */}
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
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
            PEARL.
          </p>

          <p>
            The first pilot made it real. We measured what went in and what came out. We
            saw large drops in suspended solids and bacteria. That turned this from an
            idea into a commitment. Clean water gives ecosystems a fair chance. It gives
            communities something to believe in. PEARL exists to put working systems in
            the water, prove results with data, and help these places move from survival
            back to recovery.
          </p>
        </div>

        {/* ── Divider ── */}
        <div className="flex items-center gap-4 my-14">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-300 to-transparent" />
        </div>

        {/* ── CTA ── */}
        <div className="text-center">
          <p className="text-slate-500 text-base mb-6">
            The water doesn&apos;t wait. Neither should we.
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
        </div>
      </div>
    </section>
  );
};

export default OurStorySection;
