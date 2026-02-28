"use client";

import React, { useState, useMemo } from "react";
import {
  MODULES, MODULE_CATS, CAT_COLORS, NGOS, EVENTS,
  CK, CONTAMINANT_LABELS, CONTAMINANT_COLORS,
  OPEX_TEAM_YEAR, PIN_PER_TEAM,
  CLIMATE_PROJECTIONS,
  fmt, fmtN, runCalc, runClimateCalc, applyClimateForcing,
  type Watershed, type TreatmentModule, type NGO, type CommunityEvent,
  type ModuleCategory, type ContaminantKey, type CalcResult,
  type RcpScenario, type ClimateDecade,
} from "./treatmentData";
import ExecutiveOutput from "./ExecutiveOutput";

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Contaminant bar ── */
function Bar({ base, result, colorKey }: { base: number; result?: number; colorKey: ContaminantKey }) {
  const remaining = result != null ? Math.max(0, base - (base * result / 100)) : base;
  const color = CONTAMINANT_COLORS[colorKey];
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <div className="w-[70px] text-[10px] text-slate-400 font-mono truncate">
        {CONTAMINANT_LABELS[colorKey]?.split(" / ")[0]}
      </div>
      <div className="flex-1 h-[5px] bg-slate-100 rounded-sm overflow-hidden relative">
        <div
          className="absolute left-0 top-0 h-full rounded-sm opacity-[0.18]"
          style={{ width: `${base}%`, background: color }}
        />
        {result != null && (
          <div
            className="absolute left-0 top-0 h-full rounded-sm opacity-80 transition-[width] duration-400"
            style={{ width: `${remaining}%`, background: color }}
          />
        )}
      </div>
      <div className="w-[50px] text-[10px] font-mono text-right text-slate-700 font-medium">
        {base}%{result != null ? ` \u2192 ${remaining.toFixed(0)}%` : ""}
      </div>
    </div>
  );
}

/* ── Module row ── */
function ModRow({
  m, checked, onToggle, units, onUnits, climActive,
}: {
  m: TreatmentModule;
  checked: boolean;
  onToggle: (id: string) => void;
  units: number;
  onUnits: (id: string, v: number) => void;
  climActive?: boolean;
}) {
  const cost = units * m.costPer;
  const catColor = CAT_COLORS[m.cat];
  return (
    <div
      onClick={() => onToggle(m.id)}
      className={`flex items-start gap-2.5 px-3 py-2 border-b border-slate-100 cursor-pointer transition-colors ${
        checked ? "bg-blue-50/60" : "hover:bg-slate-50"
      }`}
      style={{ borderLeft: `3px solid ${checked ? catColor : "transparent"}` }}
    >
      {/* checkbox */}
      <div
        className="w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center"
        style={{
          border: checked ? "none" : "1.5px solid #c8d4e0",
          background: checked ? catColor : "white",
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8">
            <path d="M1 3.5L4 6.5L9 1" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs">{m.icon}</span>
          <span className={`text-[11px] font-semibold ${checked ? "text-slate-800" : "text-slate-500"}`}>
            {m.name.trim()}
          </span>
          {!m.isBMP && (
            <span className="text-[8px] bg-red-50 text-red-700 px-1 rounded font-bold">PILOT</span>
          )}
          {m.trl && (
            <span className="text-[8px] bg-purple-50 text-purple-700 px-1 rounded">TRL {m.trl}</span>
          )}
          {m.hasOpex && (
            <span className="text-[8px] bg-orange-50 text-orange-700 px-1 rounded font-bold">OPEX</span>
          )}
          {m.isAddon && (
            <span className="text-[8px] bg-green-50 text-green-800 px-1 rounded">ADD-ON</span>
          )}
          {climActive && m.climateVulnerability === "high" && (
            <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded font-bold">CLIM-VULN</span>
          )}
          {climActive && m.climateVulnerability === "moderate" && (
            <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded font-bold">CLIM-MOD</span>
          )}
        </div>
        <div className="text-[9px] text-slate-400 mt-0.5 leading-snug">{m.desc || m.pilotNote || ""}</div>
        {/* contaminant chips */}
        <div className="flex gap-1 mt-1 flex-wrap">
          {CK.map(
            k =>
              m[k] > 0 && (
                <span
                  key={k}
                  className="text-[8px] px-1 rounded font-mono"
                  style={{
                    background: m[k] > 60 ? CONTAMINANT_COLORS[k] + "22" : "#f0f3f7",
                    color: m[k] > 60 ? CONTAMINANT_COLORS[k] : "#8a9bb0",
                  }}
                >
                  {k.toUpperCase()} {m[k]}%
                </span>
              ),
          )}
          {m.gpm > 0 && (
            <span className="text-[8px] px-1 rounded font-mono bg-blue-50 text-blue-700">
              {(m.gpm * units).toLocaleString()} GPM
            </span>
          )}
        </div>
      </div>

      {/* units + cost */}
      <div className="flex flex-col items-end gap-1 shrink-0" onClick={e => e.stopPropagation()}>
        <span className={`font-mono text-[11px] font-medium ${checked ? "text-slate-800" : "text-slate-300"}`}>
          {checked ? fmt(cost) : "\u2014"}
        </span>
        {checked && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUnits(m.id, Math.max(1, units - 1))}
              className="w-[18px] h-[18px] rounded border border-slate-200 bg-slate-50 text-xs flex items-center justify-center text-slate-500 hover:bg-slate-100"
            >
              &minus;
            </button>
            <span className="text-[11px] font-mono text-slate-800 min-w-[16px] text-center">{units}</span>
            <button
              onClick={() => onUnits(m.id, units + 1)}
              className="w-[18px] h-[18px] rounded border border-slate-200 bg-slate-50 text-xs flex items-center justify-center text-slate-500 hover:bg-slate-100"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── NGO row ── */
function NgoRow({ n, checked, onToggle }: { n: NGO; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <div
      onClick={() => onToggle(n.id)}
      className={`flex items-start gap-2 px-3 py-2 border-b border-slate-100 cursor-pointer transition-colors ${
        checked ? "bg-green-50/60" : "hover:bg-slate-50"
      }`}
      style={{ borderLeft: `3px solid ${checked ? "#2e7d32" : "transparent"}` }}
    >
      <div
        className="w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center"
        style={{
          border: checked ? "none" : "1.5px solid #c8d4e0",
          background: checked ? "#2e7d32" : "white",
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8">
            <path d="M1 3.5L4 6.5L9 1" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1">
          <span className="text-[13px]">{n.icon}</span>
          <span className={`text-[11px] font-semibold ${checked ? "text-slate-800" : "text-slate-500"}`}>
            {n.name}
          </span>
          {n.grant && (
            <span className="text-[8px] bg-green-50 text-green-800 px-1 rounded font-bold">GRANT</span>
          )}
        </div>
        <div className="text-[9px] text-slate-400 mt-0.5">
          {n.type} &mdash; {n.desc}
        </div>
      </div>
      <span className={`font-mono text-[10px] font-medium shrink-0 ${checked ? "text-green-700" : "text-slate-300"}`}>
        {checked ? "+" + fmt(n.value) : "\u2014"}
      </span>
    </div>
  );
}

/* ── Event row ── */
function EventRow({ ev, checked, onToggle }: { ev: CommunityEvent; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <div
      onClick={() => onToggle(ev.id)}
      className={`flex items-start gap-2 px-3 py-2 border-b border-slate-100 cursor-pointer transition-colors ${
        checked ? "bg-amber-50/60" : "hover:bg-slate-50"
      }`}
      style={{ borderLeft: `3px solid ${checked ? "#e65100" : "transparent"}` }}
    >
      <div
        className="w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center"
        style={{
          border: checked ? "none" : "1.5px solid #c8d4e0",
          background: checked ? "#e65100" : "white",
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8">
            <path d="M1 3.5L4 6.5L9 1" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[13px]">{ev.icon}</span>
          <span className={`text-[11px] font-semibold ${checked ? "text-slate-800" : "text-slate-500"}`}>
            {ev.name}
          </span>
          <span className="text-[8px] bg-orange-50 text-orange-700 px-1 rounded">{ev.freq}</span>
          <span className="text-[8px] bg-slate-100 text-slate-500 px-1 rounded">{ev.cat}</span>
        </div>
        <div className="text-[9px] text-slate-400 mt-0.5">{ev.desc}</div>
      </div>
      <span className={`font-mono text-[10px] font-medium shrink-0 ${checked ? "text-orange-700" : "text-slate-300"}`}>
        {checked ? "+" + fmt(ev.cost) + "/yr" : "\u2014"}
      </span>
    </div>
  );
}

/* ── Ledger line ── */
function LedgerLine({
  label, value, sub, color = "#1b3a5c", size = 12, bold = false,
}: {
  label: string; value: string; sub?: string; color?: string; size?: number; bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline py-1 border-b border-slate-100">
      <div>
        <span className="text-[11px] text-slate-400">{label}</span>
        {sub && <span className="text-[8px] text-slate-300 ml-1.5">{sub}</span>}
      </div>
      <span
        className="font-mono"
        style={{ fontSize: size, fontWeight: bold ? 700 : 500, color }}
      >
        {value}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PLANNER
   ═══════════════════════════════════════════════════════════════════════════ */

interface TreatmentPlannerProps {
  ws: Watershed;
  onBack: () => void;
}

export default function TreatmentPlanner({ ws, onBack }: TreatmentPlannerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["sensors", "pin_ai", "alia_50", "riparian", "aerator", "trash_wheel"]),
  );
  const [units, setUnits] = useState<Record<string, number>>({});
  const [ngoSel, setNgoSel] = useState<Set<string>>(new Set());
  const [evtSel, setEvtSel] = useState<Set<string>>(new Set());
  const [tl, setTl] = useState(5);
  const [target, setTarget] = useState(70);
  const [catOpen, setCatOpen] = useState<Set<string>>(new Set(MODULE_CATS));
  const [leftTab, setLeftTab] = useState<"modules" | "ngo" | "events">("modules");
  const [showExec, setShowExec] = useState(false);
  const [climScenario, setClimScenario] = useState<RcpScenario>("baseline");
  const [climDecade, setClimDecade] = useState<ClimateDecade>(2050);

  const getU = (id: string) => units[id] ?? MODULES.find(m => m.id === id)?.defUnits ?? 1;
  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  };

  const calc = useMemo(
    () => (ws ? runCalc(ws, selected, units, tl, target) : null),
    [ws, selected, units, tl, target],
  );

  const climResult = useMemo(
    () => climScenario !== "baseline"
      ? runClimateCalc(ws, selected, units, tl, target, climScenario, climDecade)
      : null,
    [ws, selected, units, tl, target, climScenario, climDecade],
  );

  const climActive = climScenario !== "baseline";
  const climProj = climActive ? CLIMATE_PROJECTIONS[climScenario][climDecade] : null;

  // Running totals
  const selModules = MODULES.filter(m => selected.has(m.id));
  const runningCapex = selModules.reduce((s, m) => s + getU(m.id) * m.costPer, 0);
  const ngoValue = NGOS.filter(n => ngoSel.has(n.id)).reduce((s, n) => s + n.value, 0);
  const evtCostYr = EVENTS.filter(e => evtSel.has(e.id)).reduce((s, e) => s + e.cost, 0);
  const aliaCount = selModules.filter(m => m.hasOpex).reduce((s, m) => s + getU(m.id), 0);
  const estOpexYr = aliaCount > 0 ? Math.max(1, Math.ceil(aliaCount / PIN_PER_TEAM)) * OPEX_TEAM_YEAR : 0;
  const estOpexTotal = estOpexYr * tl;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-100 flex flex-col">
      {/* ── Top nav bar ── */}
      <div className="bg-slate-900 px-4 sm:px-6 flex items-center gap-3 h-11 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_theme(colors.emerald.400)]" />
        <span className="font-mono text-xs font-medium text-slate-100 tracking-[3px]">PIN</span>
        <span className="text-slate-700 text-xs">|</span>
        <span className="text-[11px] text-sky-700">Resolution Planner</span>
        <span className="text-slate-700 text-[10px]">&rsaquo;</span>
        <span className="text-[11px] text-slate-100 font-serif">{ws.name}</span>
        <div className="ml-auto flex gap-2 items-center">
          <span className="text-[9px] font-mono text-slate-700">GC VIEW</span>
          <button
            onClick={onBack}
            className="text-[10px] text-sky-700 bg-transparent border border-slate-700 rounded px-2.5 py-0.5 cursor-pointer hover:border-sky-600 transition-colors"
          >
            &larr; Back
          </button>
        </div>
      </div>

      {/* ── Watershed summary bar ── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex gap-4 items-center flex-wrap">
        <span className="font-serif text-[17px] text-slate-800">{ws.name}</span>
        <div className="w-px h-5 bg-slate-200 hidden sm:block" />
        {[
          { l: "Flow", v: ws.flowMGD.toLocaleString() + " MGD", delta: climActive && climProj ? `+${climProj.precipIntensityPct}%` : undefined },
          { l: "Area", v: ws.acres.toLocaleString() + " ac" },
          { l: "Salinity", v: ws.salinity + " ppt", delta: climActive && climProj && ws.salinity > 0 ? `+${(1.5 * climProj.seaLevelRise_ft).toFixed(1)}` : undefined },
          {
            l: "DO",
            v: ws.doMgL + " mg/L",
            c: ws.doMgL < 3.5 ? "#c62828" : ws.doMgL < 5 ? "#e65100" : "#2e7d32",
            delta: climActive && climProj ? `\u2212${(0.1 * climProj.tempIncrease_F).toFixed(1)}` : undefined,
          },
          { l: "Treatable", v: ws.treatable + "%" },
        ].map((x, i) => (
          <div key={i} className="text-center">
            <div className="text-[8px] text-slate-400 uppercase font-mono tracking-wider">{x.l}</div>
            <div className="text-xs font-semibold font-mono" style={{ color: (x as { c?: string }).c || "#1b3a5c" }}>
              {x.v}
              {(x as { delta?: string }).delta && (
                <span className="text-[8px] text-amber-600 ml-1">({(x as { delta?: string }).delta})</span>
              )}
            </div>
          </div>
        ))}
        <div className="ml-auto flex gap-1.5 flex-wrap">
          {ws.causes.map((c, i) => (
            <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* ── Three-column body ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1fr_340px] min-h-0">
        {/* ══ LEFT: SELECTOR ══ */}
        <div className="bg-white lg:border-r border-slate-200 flex flex-col overflow-hidden">
          {/* tab bar */}
          <div className="flex border-b-2 border-slate-200 shrink-0">
            {([
              { id: "modules" as const, label: "Treatment Modules", count: selected.size },
              { id: "ngo" as const, label: "NGO Partners", count: ngoSel.size },
              { id: "events" as const, label: "Community Events", count: evtSel.size },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setLeftTab(t.id)}
                className={`flex-1 py-2.5 px-1 border-b-2 -mb-[2px] text-[10.5px] cursor-pointer transition-colors ${
                  leftTab === t.id
                    ? "border-slate-800 font-semibold text-slate-800"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="ml-1 text-[9px] bg-slate-800 text-white rounded-full px-1.5 py-px">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* MODULES tab */}
          {leftTab === "modules" && (
            <div className="flex-1 overflow-y-auto">
              {MODULE_CATS.map(cat => {
                const mods = MODULES.filter(m => m.cat === cat);
                const open = catOpen.has(cat);
                const selCount = mods.filter(m => selected.has(m.id)).length;
                return (
                  <div key={cat}>
                    <div
                      onClick={() => setCatOpen(prev => toggle(prev, cat))}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-100 cursor-pointer sticky top-0 z-[1]"
                    >
                      <div className="w-[3px] h-3.5 rounded-sm" style={{ background: CAT_COLORS[cat as ModuleCategory] }} />
                      <span className="text-[11px] font-bold text-slate-700 flex-1">{cat}</span>
                      {selCount > 0 && (
                        <span
                          className="text-[9px] font-bold px-1.5 rounded"
                          style={{
                            background: CAT_COLORS[cat as ModuleCategory] + "22",
                            color: CAT_COLORS[cat as ModuleCategory],
                          }}
                        >
                          {selCount} selected
                        </span>
                      )}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        className={`text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`}
                      >
                        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    </div>
                    {open &&
                      mods.map(m => (
                        <ModRow
                          key={m.id}
                          m={m}
                          checked={selected.has(m.id)}
                          onToggle={id => setSelected(prev => toggle(prev, id))}
                          units={getU(m.id)}
                          onUnits={(id, v) => setUnits(prev => ({ ...prev, [id]: Math.max(1, v) }))}
                          climActive={climActive}
                        />
                      ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* NGO tab */}
          {leftTab === "ngo" && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 py-2.5 bg-green-50 border-b border-slate-200">
                <div className="text-[11px] font-semibold text-green-900">
                  Partnership Value Selected: <span className="font-mono">{fmt(ngoValue)}</span>
                </div>
                <div className="text-[9px] text-green-600 mt-0.5">
                  In-kind services, co-funding eligibility, and grant match support.
                </div>
              </div>
              {NGOS.map(n => (
                <NgoRow
                  key={n.id}
                  n={n}
                  checked={ngoSel.has(n.id)}
                  onToggle={id => setNgoSel(prev => toggle(prev, id))}
                />
              ))}
            </div>
          )}

          {/* EVENTS tab */}
          {leftTab === "events" && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 py-2.5 bg-amber-50 border-b border-slate-200">
                <div className="text-[11px] font-semibold text-orange-800">
                  Community Program Cost: <span className="font-mono">{fmt(evtCostYr)}/yr</span>
                </div>
                <div className="text-[9px] text-orange-500 mt-0.5">
                  Optional community add-ons. Strengthens stakeholder buy-in + data collection.
                </div>
              </div>
              {EVENTS.map(e => (
                <EventRow
                  key={e.id}
                  ev={e}
                  checked={evtSel.has(e.id)}
                  onToggle={id => setEvtSel(prev => toggle(prev, id))}
                />
              ))}
            </div>
          )}
        </div>

        {/* ══ MIDDLE: CONDITIONS ══ */}
        <div className="bg-white lg:border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 shrink-0">
            <div className="text-[11px] font-bold text-slate-800">Waterbody Conditions</div>
            <div className="text-[9px] text-slate-400 mt-0.5">
              Baseline impairment vs. projected outcome from selected stack
            </div>
          </div>

          {/* Baseline bars */}
          <div className="px-4 py-3 border-b border-slate-200 shrink-0">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-mono mb-2">
              Contaminant Index (% impaired)
            </div>
            {CK.map(k => ws.baseline[k] > 0 && <Bar key={k} base={ws.baseline[k]} result={calc?.ach[k]} colorKey={k} />)}
          </div>

          {/* Projected outcomes */}
          {calc && (
            <div className="px-4 py-3 bg-slate-50 shrink-0">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider font-mono mb-2">
                Projected Improvement
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    l: "Avg Reduction", v: calc.avg.toFixed(0) + "%", c: calc.met ? "#2e7d32" : "#e65100",
                    delta: climResult?.stressed ? (climResult.stressed.avg - calc.avg).toFixed(1) + "%" : undefined,
                  },
                  {
                    l: "DO Projected", v: calc.projDO.toFixed(1) + " mg/L", c: calc.projDO > 5 ? "#2e7d32" : "#e65100",
                    delta: climResult?.stressed ? (climResult.stressed.projDO - calc.projDO).toFixed(1) : undefined,
                  },
                  { l: "GPM Deployed", v: fmtN(Math.round(calc.totGPM)), c: "#1565c0" },
                  { l: "Target", v: target + "%", c: "#78909c" },
                ].map((x, i) => (
                  <div key={i} className="bg-white rounded-lg px-2.5 py-1.5 border border-slate-200">
                    <div className="text-[8px] text-slate-400 uppercase tracking-wide">{x.l}</div>
                    <div className="text-base font-bold font-mono" style={{ color: x.c }}>
                      {x.v}
                      {(x as { delta?: string }).delta && (
                        <span className="text-[9px] text-amber-600 font-medium ml-1">
                          ({(x as { delta?: string }).delta})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div
                className={`mt-2.5 px-2.5 py-2 rounded-lg border ${
                  calc.met ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
                }`}
              >
                <span className={`text-[11px] font-bold ${calc.met ? "text-green-700" : "text-orange-700"}`}>
                  {calc.met
                    ? "\u2713 Target achievable with selected stack"
                    : "\u26A0 Below target \u2014 add modules or increase units"}
                </span>
              </div>
            </div>
          )}

          {/* Grants */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2.5 bg-slate-50 border-y border-slate-200">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider font-mono">
                Upstream Load Sources
              </div>
            </div>
            {calc && calc.grants.length > 0 && (
              <div className="px-4 py-2.5 border-b border-slate-200">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-mono mb-1.5">
                  Eligible Grants
                </div>
                {calc.grants.map((g, i) => (
                  <div key={i} className="flex justify-between py-0.5 border-b border-slate-50">
                    <span className="text-[10px] text-slate-600">{g.name}</span>
                    <span className="text-[10px] font-semibold text-green-700 font-mono">{fmt(g.savings)}</span>
                  </div>
                ))}
                <div className="flex justify-between mt-1 pt-1 border-t-2 border-slate-200">
                  <span className="text-[10px] font-bold text-slate-800">Total Grant Potential</span>
                  <span className="text-[11px] font-bold text-green-700 font-mono">{fmt(calc.grantTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT: COST LEDGER ══ */}
        <div className="bg-white flex flex-col overflow-hidden">
          {/* dark header */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-200 shrink-0">
            <div className="font-mono text-[10px] text-emerald-400 tracking-[2px] mb-0.5">COST LEDGER</div>
            <div className="font-serif text-[22px] text-slate-100">{fmt(runningCapex + estOpexTotal)}</div>
            <div className="text-[9px] text-sky-700 mt-0.5">Lifecycle estimate &middot; {tl}yr</div>
          </div>

          {/* controls */}
          <div className="px-4 py-3 border-b border-slate-200 grid grid-cols-2 gap-2 shrink-0">
            <div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wider mb-1">Timeline (years)</div>
              <div className="flex gap-1">
                {[2, 5, 10, 15].map(y => (
                  <button
                    key={y}
                    onClick={() => setTl(y)}
                    className={`flex-1 py-1 rounded text-[11px] font-mono cursor-pointer border transition-all ${
                      tl === y
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wider mb-1">Target (%)</div>
              <input
                type="number"
                min={25}
                max={99}
                value={target}
                onChange={e => setTarget(+e.target.value)}
                className="w-full px-2 py-1 border border-slate-200 rounded text-sm font-mono text-slate-800 font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* climate scenario controls */}
          <div className="px-4 py-3 border-b border-slate-200 shrink-0">
            <div className="text-[8px] text-slate-400 uppercase tracking-wider mb-1.5">Climate Scenario</div>
            <div className="flex gap-1 mb-2">
              {([
                { id: "baseline" as RcpScenario, label: "Baseline" },
                { id: "rcp45" as RcpScenario, label: "RCP 4.5" },
                { id: "rcp85" as RcpScenario, label: "RCP 8.5" },
              ]).map(s => (
                <button
                  key={s.id}
                  onClick={() => setClimScenario(s.id)}
                  className={`flex-1 py-1 rounded text-[11px] font-mono cursor-pointer border transition-all ${
                    climScenario === s.id
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {climActive && (
              <>
                <div className="text-[8px] text-slate-400 uppercase tracking-wider mb-1">Projection Horizon</div>
                <div className="flex gap-1 mb-2">
                  {([2030, 2050, 2080] as ClimateDecade[]).map(d => (
                    <button
                      key={d}
                      onClick={() => setClimDecade(d)}
                      className={`flex-1 py-1 rounded text-[11px] font-mono cursor-pointer border transition-all ${
                        climDecade === d
                          ? "border-slate-800 bg-slate-800 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                {climProj && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 space-y-0.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">Climate stress active</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] font-mono">
                      <span className="text-slate-500">Temp</span>
                      <span className="text-amber-700 text-right">+{climProj.tempIncrease_F}°F</span>
                      <span className="text-slate-500">Precip</span>
                      <span className="text-amber-700 text-right">+{climProj.precipIntensityPct}%</span>
                      {ws.salinity > 0 && (
                        <>
                          <span className="text-slate-500">SLR</span>
                          <span className="text-amber-700 text-right">+{climProj.seaLevelRise_ft} ft</span>
                        </>
                      )}
                      <span className="text-slate-500">CSO</span>
                      <span className="text-amber-700 text-right">+{climProj.csoFreqIncreasePct}%</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ledger lines */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {/* CapEx */}
            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-mono mb-1.5">
              CapEx &mdash; Module Stack
            </div>
            {MODULE_CATS.map(cat => {
              const mods = selModules.filter(m => m.cat === cat);
              if (!mods.length) return null;
              const catTotal = mods.reduce((s, m) => s + getU(m.id) * m.costPer, 0);
              return (
                <div key={cat} className="mb-2">
                  <div className="flex justify-between py-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-[3px] h-2.5 rounded-sm" style={{ background: CAT_COLORS[cat as ModuleCategory] }} />
                      <span className="text-[10px] font-semibold text-slate-600">{cat}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-800 font-mono">{fmt(catTotal)}</span>
                  </div>
                  {mods.map(m => (
                    <div key={m.id} className="flex justify-between py-0.5 pl-3 border-b border-slate-50">
                      <span className="text-[9.5px] text-slate-400">
                        {m.icon} {m.name.trim()} &times;{getU(m.id)}
                      </span>
                      <span className="text-[9.5px] text-slate-500 font-mono">+{fmt(getU(m.id) * m.costPer)}</span>
                    </div>
                  ))}
                </div>
              );
            })}

            {selModules.length === 0 && (
              <div className="text-center py-5 text-slate-300 text-[11px]">
                Select modules from the left &rarr;
              </div>
            )}

            <div className="border-t-2 border-slate-200 my-2.5" />

            {/* OpEx */}
            {aliaCount > 0 && (
              <>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-mono mb-1.5">
                  OpEx &mdash; PIN Operating
                </div>
                <LedgerLine label="PIN Units" value={String(aliaCount)} />
                <LedgerLine label="Teams Needed" value={`${Math.ceil(aliaCount / PIN_PER_TEAM)} \u00D7 $200K`} />
                <LedgerLine label="Annual OpEx" value={fmt(estOpexYr)} color="#e65100" />
                <LedgerLine label={`${tl}-yr OpEx Total`} value={fmt(estOpexTotal)} color="#e65100" bold />
                <div className="border-t-2 border-slate-200 my-2.5" />
              </>
            )}

            {/* NGO value */}
            {ngoSel.size > 0 && (
              <>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-mono mb-1.5">
                  NGO Partnership Value
                </div>
                {NGOS.filter(n => ngoSel.has(n.id)).map(n => (
                  <LedgerLine key={n.id} label={n.name} value={"+ " + fmt(n.value)} color="#2e7d32" />
                ))}
                <LedgerLine label="Total NGO Value" value={fmt(ngoValue)} color="#2e7d32" bold />
                <div className="border-t-2 border-slate-200 my-2.5" />
              </>
            )}

            {/* Community events */}
            {evtSel.size > 0 && (
              <>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-mono mb-1.5">
                  Community Program (Annual)
                </div>
                {EVENTS.filter(e => evtSel.has(e.id)).map(e => (
                  <LedgerLine key={e.id} label={e.name} value={"+" + fmt(e.cost) + "/yr"} color="#e65100" />
                ))}
                <LedgerLine label={`${tl}-yr Program Total`} value={fmt(evtCostYr * tl)} color="#e65100" bold />
                <div className="border-t-2 border-slate-200 my-2.5" />
              </>
            )}

            {/* Summary */}
            {selModules.length > 0 && (
              <>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-mono mb-1.5">Summary</div>
                <LedgerLine label="CapEx" value={fmt(runningCapex)} />
                {aliaCount > 0 && <LedgerLine label="OpEx Total" value={fmt(estOpexTotal)} color="#e65100" />}
                {evtSel.size > 0 && <LedgerLine label="Community Program" value={fmt(evtCostYr * tl)} color="#e65100" />}
                {calc?.grantTotal ? <LedgerLine label="Grants Available" value={"\u2212" + fmt(calc.grantTotal)} color="#2e7d32" /> : null}
                <div className="border-t-2 border-slate-800 my-2" />
                <LedgerLine
                  label="Total Lifecycle"
                  value={fmt(runningCapex + estOpexTotal + evtCostYr * tl)}
                  color="#1b3a5c"
                  bold
                  size={14}
                />
                {calc?.grantTotal ? (
                  <LedgerLine
                    label="Net (after grants)"
                    value={fmt(Math.max(0, runningCapex + estOpexTotal + evtCostYr * tl - (calc?.grantTotal || 0)))}
                    color="#2e7d32"
                    bold
                    size={13}
                  />
                ) : null}
              </>
            )}
          </div>

          {/* Bottom controls */}
          <div className="px-4 py-3 border-t border-slate-200 shrink-0">
            {calc && (
              <div
                className={`px-2.5 py-1.5 rounded-lg border mb-2 flex justify-between items-center ${
                  calc.met ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
                }`}
              >
                <span className={`text-[11px] font-bold ${calc.met ? "text-green-700" : "text-orange-700"}`}>
                  {calc.met ? "\u2713 TARGET MET" : "\u26A0 " + calc.avg.toFixed(0) + "% / " + target + "%"}
                </span>
                <span className="text-[10px] font-mono text-slate-600">
                  {calc.active.length} modules{calc.totGPM > 0 ? " \u00B7 " + fmtN(Math.round(calc.totGPM)) + " GPM" : ""}
                </span>
              </div>
            )}
            <button
              onClick={() => setShowExec(true)}
              disabled={!calc}
              className={`w-full py-3 rounded-lg text-xs font-bold font-mono tracking-wider transition-all ${
                calc
                  ? "bg-gradient-to-r from-slate-800 to-slate-600 text-white shadow-lg shadow-slate-800/25 hover:-translate-y-px cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-default"
              }`}
            >
              {calc ? "GENERATE EXECUTIVE SUMMARY" : "SELECT MODULES TO BEGIN"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Executive Output ── */}
      {showExec && calc && (
        <ExecutiveOutput
          ws={ws}
          calc={calc}
          timeline={tl}
          target={target}
          selectedNGOs={NGOS.filter(n => ngoSel.has(n.id))}
          selectedEvents={EVENTS.filter(e => evtSel.has(e.id))}
          ngoValue={ngoValue}
          evtCostYr={evtCostYr}
          onClose={() => setShowExec(false)}
          climateScenario={climScenario}
          climateDecade={climDecade}
          climateCalc={climResult?.stressed ?? null}
          climateWs={climResult ? climResult.climateWs : ws}
        />
      )}
    </div>
  );
}
