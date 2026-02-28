"use client";

import React, { useState, useMemo } from "react";
import { WATERSHEDS, CK, CONTAMINANT_COLORS, type Watershed } from "./treatmentData";

interface WatershedPickerProps {
  onSelect: (ws: Watershed) => void;
}

export default function WatershedPicker({ onSelect }: WatershedPickerProps) {
  const [filter, setFilter] = useState("All");
  const [techOpen, setTechOpen] = useState(false);

  const states = useMemo(
    () => ["All", ...Array.from(new Set(WATERSHEDS.map(w => w.state)))],
    [],
  );
  const filtered = filter === "All" ? WATERSHEDS : WATERSHEDS.filter(w => w.state === filter);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-900 flex flex-col">
      {/* ── Hero ── */}
      <div className="px-6 sm:px-10 pt-12 pb-8 max-w-[860px] mx-auto w-full text-center">
        <h1 className="font-serif text-3xl sm:text-4xl text-slate-100 leading-tight mb-3">
          Select a Waterbody
          <br />
          <span className="text-emerald-400">to Begin Your Resolution</span>
        </h1>
        <p className="text-sm text-sky-700 leading-relaxed max-w-[520px] mx-auto mb-4">
          Configure treatment modules, NGO partners, and community programs.
          The calculator runs live as you build.
        </p>

        {/* Pilot credibility badges */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {[
            { label: "88\u201395% TSS", sub: "Pilot Verified" },
            { label: "93.8% E. coli", sub: "Below Detection" },
            { label: "Zero Chemicals", sub: "Nature-Based" },
            { label: "7-Day Deploy", sub: "Continuous Run" },
          ].map(b => (
            <div
              key={b.label}
              className="px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20"
            >
              <span className="text-[11px] font-bold text-emerald-400 font-mono tracking-wide">
                {b.label}
              </span>
              <span className="text-[9px] text-sky-700 ml-1.5">{b.sub}</span>
            </div>
          ))}
        </div>

        {/* How PIN Works expandable */}
        <button
          onClick={() => setTechOpen(o => !o)}
          className="text-[11px] text-sky-600 hover:text-emerald-400 transition-colors tracking-wide uppercase font-mono"
        >
          How PIN Works {techOpen ? "\u25B4" : "\u25BE"}
        </button>
        {techOpen && (
          <div className="mt-3 max-w-[640px] mx-auto text-left grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                num: "01",
                title: "Physical Pre-Treatment",
                desc: "500\u00B5m mesh screen + gravity settling remove debris and suspended solids.",
                accent: "border-amber-500/40 text-amber-400",
              },
              {
                num: "02",
                title: "Chemical Polishing",
                desc: "Zeolite, biochar, and nutrient resin media adsorb dissolved contaminants.",
                accent: "border-sky-500/40 text-sky-400",
              },
              {
                num: "03",
                title: "Biological Filtration",
                desc: "Live oyster raceways filter to 2\u00B5m \u2014 bacteria, phytoplankton, fine sediment.",
                accent: "border-emerald-500/40 text-emerald-400",
              },
            ].map(s => (
              <div
                key={s.num}
                className={`bg-white/[0.04] rounded-lg p-3 border ${s.accent.split(" ")[0]}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold ${s.accent.split(" ")[1]} font-mono`}>
                    {s.num}
                  </span>
                  <span className="text-[11px] font-bold text-slate-200">{s.title}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* State filter pills */}
        <div className="flex gap-1.5 justify-center mt-6">
          {states.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3.5 py-1 rounded-full border text-[11px] font-mono cursor-pointer transition-all ${
                filter === s
                  ? "border-emerald-400 bg-emerald-400 text-slate-900"
                  : "border-slate-700 bg-transparent text-sky-700 hover:border-sky-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Watershed Grid ── */}
      <div className="px-6 sm:px-10 pb-12 max-w-[1080px] mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(w => (
          <button
            key={w.id}
            onClick={() => onSelect(w)}
            className="group text-left bg-[#141f2e] border border-slate-700 rounded-xl px-5 py-4 cursor-pointer transition-all hover:border-emerald-400 hover:-translate-y-0.5 relative overflow-hidden"
          >
            {/* corner accent */}
            <div className="absolute top-0 right-0 w-14 h-14 bg-emerald-400 opacity-[0.03] rounded-bl-[60px]" />

            <div className="flex justify-between mb-1.5">
              <span className="text-[10px] font-mono text-sky-800">
                {w.state} &middot; {w.huc}
              </span>
              <span className="text-[9px] font-semibold bg-red-950 text-red-300 px-1.5 rounded">
                IMPAIRED
              </span>
            </div>

            <div className="font-serif text-base text-slate-100 mb-1 leading-snug">{w.name}</div>
            <div className="text-[10px] text-sky-700 leading-snug mb-2.5">{w.context}</div>

            {/* contaminant chips */}
            <div className="flex gap-1.5 flex-wrap">
              {CK.map(
                k =>
                  w.baseline[k] > 30 && (
                    <span
                      key={k}
                      className="px-1.5 rounded text-[9px] font-mono"
                      style={{
                        background:
                          w.baseline[k] > 65
                            ? "#3d1515"
                            : w.baseline[k] > 40
                              ? "#2d1e0f"
                              : "#141f2e",
                        color:
                          w.baseline[k] > 65
                            ? "#ef9a9a"
                            : w.baseline[k] > 40
                              ? "#ffcc80"
                              : "#78909c",
                      }}
                    >
                      {k} {w.baseline[k]}
                    </span>
                  ),
              )}
            </div>

            {/* footer stats */}
            <div className="flex gap-2.5 mt-2.5 pt-2.5 border-t border-slate-700">
              <span className="text-[9px] text-sky-800 font-mono">
                {w.flowMGD.toLocaleString()} MGD
              </span>
              <span className="text-[9px] text-sky-800 font-mono">
                {w.acres.toLocaleString()} ac
              </span>
              <span
                className={`text-[9px] font-mono ${w.doMgL < 3.5 ? "text-red-300" : "text-sky-700"}`}
              >
                DO {w.doMgL}
              </span>
              {w.aquaculture.length > 0 && (
                <span className="text-[9px] text-emerald-400">Aquaculture</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
