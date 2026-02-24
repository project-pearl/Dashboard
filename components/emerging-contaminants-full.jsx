import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend, RadialBarChart, RadialBar, LineChart, Line, ScatterChart, Scatter, ZAxis } from "recharts";

// ── THEME ─────────────────────────────────────────────────────────────
const C = {
  bg: "#060a13", card: "#0c1322", cardAlt: "#111b2e", surface: "#0a1020",
  border: "#1a2540", borderActive: "#2a3a5c", borderHover: "#334766",
  text: "#e8ecf4", textMuted: "#8899b4", textDim: "#5a6d8a",
  accent: "#38bdf8", accentDim: "#1a6d9e",
  pearl: "#0ea5e9", pearlGlow: "rgba(14,165,233,0.12)",
  red: "#ef4444", amber: "#f59e0b", green: "#22c55e", purple: "#a855f7", cyan: "#06b6d4", pink: "#ec4899",
  redBg: "#ef444412", amberBg: "#f59e0b12", greenBg: "#22c55e12",
};

// ── ROLE CONTEXT ──────────────────────────────────────────────────────
const roles = [
  { id: "federal", label: "Federal View", scope: "National", icon: "🏛" },
  { id: "state", label: "State View", scope: "Maryland", icon: "🗺" },
  { id: "ms4", label: "MS4 View", scope: "Anne Arundel County", icon: "🏙" },
  { id: "utility", label: "Utility View", scope: "Baltimore Metro", icon: "💧" },
];

// ── THREAT DATA ───────────────────────────────────────────────────────
const threats = [
  {
    id: "pfas", name: "PFAS", subtitle: "Per- & Polyfluoroalkyl Substances",
    level: "REGULATED", levelColor: C.red, icon: "⬡",
    mcl: "4 ppt (PFOA/PFOS)", deadline: "2031", monitorBy: "2027",
    summary: "First enforceable MCLs. Deadline extended 2029→2031. Four additional PFAS MCLs under reconsideration by Trump EPA.",
    keyFacts: [
      { label: "MCL", value: "4 ppt", desc: "PFOA & PFOS" },
      { label: "Monitor By", value: "2027", desc: "Initial sampling" },
      { label: "Comply By", value: "2031", desc: "Extended" },
      { label: "Funding", value: "$1B", desc: "IIJA allocated" },
    ],
    topStates: [
      { state: "NJ", units: 847 }, { state: "MI", units: 623 }, { state: "MA", units: 512 },
      { state: "NH", units: 389 }, { state: "NY", units: 734 },
    ],
    stateData: { state: "MD", units: 287, systems: 94, rank: 12, stricterThanFed: false, stateStandard: "Follows EPA", trend: "Rising" },
    ms4Data: { jurisdiction: "Anne Arundel County", sites: 12, runoffRisk: "Moderate", bmpsNeeded: 3 },
    waterbodies: [
      { name: "Merrimack River, MA", type: "River", status: "Impaired", level: "12 ppt" },
      { name: "Huron River, MI", type: "River", status: "Impaired", level: "18 ppt" },
      { name: "Cape Fear River, NC", type: "River", status: "Impaired", level: "42 ppt" },
      { name: "Back River WWTP, MD", type: "Discharge", status: "Detected", level: "8 ppt" },
      { name: "Patapsco River, MD", type: "River", status: "Advisory", level: "6 ppt" },
    ],
    trend: [
      { yr: "20", v: 580 }, { yr: "21", v: 890 }, { yr: "22", v: 1240 },
      { yr: "23", v: 1890 }, { yr: "24", v: 2340 }, { yr: "25", v: 2810 },
    ],
    pearlCapable: true, pearlMethod: "Multi-stage resin adsorption + ozone",
    pearlRemoval: 92, pearlStages: "Stages 18-34 (GAC/IX resin) + Stage 45 (ozone)",
    pearlEvidence: "Bench-scale confirmed. Milton FL pilot pending PFAS-specific trial.",
    nationalCount: 9823, yoy: 20,
  },
  {
    id: "microplastics", name: "Microplastics", subtitle: "Micro & Nanoplastic Particles",
    level: "PRE-REGULATORY", levelColor: C.amber, icon: "◈",
    mcl: "None", deadline: "TBD", monitorBy: "TBD",
    summary: "7 governors petitioned EPA. UCMR 6 petition filed. No federal standard. Concentrations predicted to double by 2040.",
    keyFacts: [
      { label: "Per Liter", value: "240K", desc: "Particles (bottled)" },
      { label: "Governors", value: "7", desc: "Petitioned Nov 2025" },
      { label: "Size", value: "<5mm", desc: "Incl. nanoplastics" },
      { label: "UCMR", value: "Petitioned", desc: "Seeking UCMR 6" },
    ],
    topStates: [
      { state: "CA", units: 1240 }, { state: "TX", units: 890 }, { state: "FL", units: 780 },
      { state: "NY", units: 620 }, { state: "OH", units: 510 },
    ],
    stateData: { state: "MD", units: 198, systems: 0, rank: 18, stricterThanFed: false, stateStandard: "No standard", trend: "Rising rapidly" },
    ms4Data: { jurisdiction: "Anne Arundel County", sites: 34, runoffRisk: "High", bmpsNeeded: 8 },
    waterbodies: [
      { name: "Great Lakes (all 5)", type: "Lake System", status: "Detected", level: "High" },
      { name: "Chesapeake Bay, MD/VA", type: "Estuary", status: "Detected", level: "Moderate" },
      { name: "Los Angeles River, CA", type: "River", status: "Detected", level: "Very High" },
      { name: "Severn River, MD", type: "River", status: "Detected", level: "Moderate" },
      { name: "Baltimore Harbor, MD", type: "Harbor", status: "Detected", level: "High" },
    ],
    trend: [
      { yr: "20", v: 120 }, { yr: "21", v: 310 }, { yr: "22", v: 580 },
      { yr: "23", v: 890 }, { yr: "24", v: 1450 }, { yr: "25", v: 2100 },
    ],
    pearlCapable: true, pearlMethod: "Mechanical filtration (up to 75-stage)",
    pearlRemoval: 95, pearlStages: "Stages 1-12 (graduated mesh screens 5mm→50μm)",
    pearlEvidence: "Milton FL pilot: 88-95% TSS removal includes microplastic fraction.",
    nationalCount: 4890, yoy: 45,
  },
  {
    id: "cyanotoxins", name: "Cyanotoxins", subtitle: "Harmful Algal Bloom Toxins",
    level: "ADVISORY", levelColor: C.green, icon: "◉",
    mcl: "Health Advisory", deadline: "N/A", monitorBy: "N/A",
    summary: "On CCL 5. Five states have guidance. EPA finalized recreational criteria. HABs increasing with warming and nutrient loading.",
    keyFacts: [
      { label: "CCL", value: "CCL 5", desc: "Group listing" },
      { label: "States", value: "5", desc: "With rules" },
      { label: "Advisory", value: "Active", desc: "Recreational" },
      { label: "Toxins", value: "2", desc: "Microcystin/cylindro" },
    ],
    topStates: [
      { state: "OH", units: 1890 }, { state: "FL", units: 1620 }, { state: "CA", units: 1340 },
      { state: "NY", units: 980 }, { state: "WI", units: 870 },
    ],
    stateData: { state: "MD", units: 412, systems: 8, rank: 9, stricterThanFed: true, stateStandard: "Advisory + monitoring", trend: "Seasonal peaks" },
    ms4Data: { jurisdiction: "Anne Arundel County", sites: 6, runoffRisk: "Moderate-High", bmpsNeeded: 4 },
    waterbodies: [
      { name: "Grand Lake St. Marys, OH", type: "Lake", status: "Chronic", level: "Critical" },
      { name: "Lake Erie Western Basin", type: "Lake", status: "Annual HABs", level: "Critical" },
      { name: "Lake Okeechobee, FL", type: "Lake", status: "Recurring", level: "High" },
      { name: "Chesapeake Bay tribs, MD", type: "Estuary", status: "Seasonal", level: "Moderate" },
      { name: "Lake Champlain, VT/NY", type: "Lake", status: "Seasonal", level: "Moderate" },
    ],
    trend: [
      { yr: "20", v: 1480 }, { yr: "21", v: 1890 }, { yr: "22", v: 2150 },
      { yr: "23", v: 2680 }, { yr: "24", v: 3100 }, { yr: "25", v: 3540 },
    ],
    pearlCapable: true, pearlMethod: "Activated carbon + oyster biofiltration",
    pearlRemoval: 88, pearlStages: "Stages 38-42 (GAC) + Stages 1-6 (biofiltration nutrient uptake)",
    pearlEvidence: "Biofiltration reduces nutrient loading that fuels HABs. Indirect prevention + direct toxin removal.",
    nationalCount: 12450, yoy: 14,
  },
  {
    id: "6ppd", name: "6PPD-Quinone", subtitle: "Tire-Wear Toxicant",
    level: "EMERGING", levelColor: C.purple, icon: "◆",
    mcl: "None", deadline: "TBD", monitorBy: "TBD",
    summary: "Among the most acutely toxic aquatic contaminants known. Coho salmon die-offs. Enters waterways via stormwater — MS4's problem.",
    keyFacts: [
      { label: "Toxicity", value: "Extreme", desc: "Sub-ppb lethal" },
      { label: "Source", value: "Tires", desc: "6PPD + ozone" },
      { label: "Pathway", value: "Runoff", desc: "MS4 stormwater" },
      { label: "Lead State", value: "WA", desc: "Regulatory effort" },
    ],
    topStates: [
      { state: "WA", units: 340 }, { state: "CA", units: 420 }, { state: "OR", units: 280 },
      { state: "AK", units: 190 }, { state: "ID", units: 120 },
    ],
    stateData: { state: "MD", units: 67, systems: 0, rank: 22, stricterThanFed: false, stateStandard: "No standard", trend: "Newly monitored" },
    ms4Data: { jurisdiction: "Anne Arundel County", sites: 48, runoffRisk: "High", bmpsNeeded: 12 },
    waterbodies: [
      { name: "Longfellow Creek, WA", type: "Creek", status: "Fish kills", level: "Lethal" },
      { name: "Puget Sound tribs", type: "Multiple", status: "Detected", level: "High" },
      { name: "Willamette tribs, OR", type: "Creek", status: "Detected", level: "Moderate" },
      { name: "Stoney Run, MD", type: "Creek", status: "Unknown", level: "Not tested" },
      { name: "Ketchikan Creek, AK", type: "Creek", status: "Fish kills", level: "Lethal" },
    ],
    trend: [
      { yr: "20", v: 12 }, { yr: "21", v: 45 }, { yr: "22", v: 120 },
      { yr: "23", v: 280 }, { yr: "24", v: 480 }, { yr: "25", v: 710 },
    ],
    pearlCapable: true, pearlMethod: "Biochar media + mechanical pre-filtration",
    pearlRemoval: 78, pearlStages: "Stages 8-14 (biochar adsorption media)",
    pearlEvidence: "Biochar shown effective in UW studies. PEARL adaptation in design phase.",
    nationalCount: 1870, yoy: 48,
  },
  {
    id: "pharma", name: "Pharmaceuticals", subtitle: "PPCPs & Endocrine Disruptors",
    level: "MONITORING", levelColor: C.cyan, icon: "◇",
    mcl: "None", deadline: "TBD", monitorBy: "TBD",
    summary: "100+ compounds detected in US waters. ~50% of prescriptions enter waste streams. Antibiotic resistance growing concern.",
    keyFacts: [
      { label: "Discarded", value: "~50%", desc: "Enter waste stream" },
      { label: "Compounds", value: "100+", desc: "In US waters" },
      { label: "AMR Risk", value: "Growing", desc: "Resistance" },
      { label: "Federal Reg", value: "None", desc: "CCL 5 listed" },
    ],
    topStates: [
      { state: "CA", units: 380 }, { state: "TX", units: 290 }, { state: "FL", units: 260 },
      { state: "PA", units: 210 }, { state: "IL", units: 180 },
    ],
    stateData: { state: "MD", units: 124, systems: 0, rank: 15, stricterThanFed: false, stateStandard: "No standard", trend: "Stable" },
    ms4Data: { jurisdiction: "Anne Arundel County", sites: 4, runoffRisk: "Low", bmpsNeeded: 1 },
    waterbodies: [
      { name: "Potomac River, DC/MD/VA", type: "River", status: "Detected", level: "Moderate" },
      { name: "South Platte River, CO", type: "River", status: "Detected", level: "Moderate" },
      { name: "Back River, MD", type: "River", status: "Detected", level: "Low" },
      { name: "Trinity River, TX", type: "River", status: "Detected", level: "High" },
      { name: "Chicago Sanitary Canal", type: "Canal", status: "Detected", level: "Moderate" },
    ],
    trend: [
      { yr: "20", v: 1020 }, { yr: "21", v: 1180 }, { yr: "22", v: 1350 },
      { yr: "23", v: 1540 }, { yr: "24", v: 1780 }, { yr: "25", v: 1950 },
    ],
    pearlCapable: true, pearlMethod: "Activated carbon + advanced oxidation",
    pearlRemoval: 85, pearlStages: "Stages 38-42 (GAC) + Stage 45 (ozone/AOP)",
    pearlEvidence: "GAC + ozone industry standard for PPCPs. PEARL combines both.",
    nationalCount: 3240, yoy: 10,
  },
  {
    id: "lead", name: "Lead & Copper", subtitle: "LCRR / LCRI Compliance",
    level: "REVISED RULE", levelColor: C.pink, icon: "◎",
    mcl: "15 ppb (AL)", deadline: "2027", monitorBy: "Oct 2024",
    summary: "Service line inventories due. Action trigger tightening to 10 ppb. 9.2M lead service lines estimated nationally. EJ impact.",
    keyFacts: [
      { label: "Action Level", value: "15 ppb", desc: "Trigger → 10 ppb" },
      { label: "Inventory", value: "Due Now", desc: "Service lines" },
      { label: "Lead Lines", value: "9.2M", desc: "Estimated US" },
      { label: "Replace", value: "10 yr", desc: "Full timeline" },
    ],
    topStates: [
      { state: "IL", units: 2100 }, { state: "OH", units: 1890 }, { state: "MI", units: 1670 },
      { state: "PA", units: 1450 }, { state: "NJ", units: 1280 },
    ],
    stateData: { state: "MD", units: 890, systems: 210, rank: 8, stricterThanFed: true, stateStandard: "MDE enhanced monitoring", trend: "Improving" },
    ms4Data: { jurisdiction: "Anne Arundel County", sites: 0, runoffRisk: "N/A (distribution)", bmpsNeeded: 0 },
    waterbodies: [
      { name: "Chicago water system", type: "Distribution", status: "Action Level", level: "Critical" },
      { name: "Baltimore water system", type: "Distribution", status: "Monitoring", level: "Moderate" },
      { name: "Newark water system, NJ", type: "Distribution", status: "Replacing", level: "Improving" },
      { name: "Flint water system, MI", type: "Distribution", status: "Recovering", level: "Moderate" },
      { name: "Pittsburgh system, PA", type: "Distribution", status: "Action Level", level: "High" },
    ],
    trend: [
      { yr: "20", v: 4200 }, { yr: "21", v: 3800 }, { yr: "22", v: 3400 },
      { yr: "23", v: 3100 }, { yr: "24", v: 2800 }, { yr: "25", v: 2500 },
    ],
    pearlCapable: false, pearlMethod: "Infrastructure replacement required",
    pearlRemoval: 0, pearlStages: "N/A — source is pipe material, not water quality",
    pearlEvidence: "Not a filtration-addressable contaminant. PIN tracks compliance status.",
    nationalCount: 18900, yoy: -11,
  },
];

// ── REGULATORY CALENDAR DATA ──────────────────────────────────────────
const regEvents = [
  { date: "2025-05-14", title: "EPA retains PFOA/PFOS MCLs", type: "Final Action", contaminant: "pfas", status: "complete", impact: "MCLs confirmed at 4 ppt. 4 other PFAS MCLs under rescission." },
  { date: "2025-09-11", title: "EPA asks D.C. Circuit to vacate 4 PFAS MCLs", type: "Legal", contaminant: "pfas", status: "complete", impact: "Seeks to drop PFHxS, PFNA, GenX, PFBS standards." },
  { date: "2025-10-07", title: "PFHxS-Na added to TRI", type: "Rule Change", contaminant: "pfas", status: "complete", impact: "206 total PFAS now on Toxics Release Inventory." },
  { date: "2025-11-01", title: "NPDES PFAS monitoring proposed", type: "Proposed Rule", contaminant: "pfas", status: "complete", impact: "Permit applications to include PFAS discharge data." },
  { date: "2025-11-26", title: "7 governors petition EPA on microplastics", type: "Petition", contaminant: "microplastics", status: "complete", impact: "Urge definition, analytical methods, monitoring data." },
  { date: "2026-01-12", title: "D.C. Circuit denies summary vacatur", type: "Legal", contaminant: "pfas", status: "complete", impact: "Court refuses to immediately drop 4 PFAS MCLs." },
  { date: "2026-01-26", title: "PFAS ELG rulemaking proposed", type: "Proposed Rule", contaminant: "pfas", status: "active", impact: "Effluent limits for plastics/chemical/synthetic fiber sectors." },
  { date: "2026-02-28", title: "TRI PFAS additions finalized", type: "Final Rule", contaminant: "pfas", status: "upcoming", impact: "Criteria for automatic PFAS additions to TRI." },
  { date: "2026-04-01", title: "PFAS NPDWR revision finalized", type: "Final Rule", contaminant: "pfas", status: "upcoming", impact: "Compliance extended to 2031. 4 PFAS MCLs rescinded." },
  { date: "2026-04-15", title: "9 PFAS designated hazardous (RCRA)", type: "Final Rule", contaminant: "pfas", status: "upcoming", impact: "Hazardous waste handling requirements triggered." },
  { date: "2026-06-01", title: "UCMR 6 development begins", type: "Rulemaking", contaminant: "microplastics", status: "upcoming", impact: "Microplastics likely included in monitoring rule." },
  { date: "2027-01-01", title: "PFAS initial monitoring deadline", type: "Compliance", contaminant: "pfas", status: "upcoming", impact: "All public water systems must complete PFAS sampling." },
  { date: "2027-06-01", title: "LCRR compliance deadline", type: "Compliance", contaminant: "lead", status: "upcoming", impact: "Service line inventories and enhanced monitoring." },
  { date: "2028-01-01", title: "CCL 5 regulatory determinations", type: "Determination", contaminant: "cyanotoxins", status: "upcoming", impact: "Possible MCL pathway for cyanotoxins." },
  { date: "2031-01-01", title: "PFAS MCL full compliance", type: "Compliance", contaminant: "pfas", status: "upcoming", impact: "Treatment systems operational. No exceedances allowed." },
];

// ── STATE COMPARISON DATA ─────────────────────────────────────────────
const stateComparisons = [
  { state: "NJ", pfas: "13 ppt → adopted 4 ppt", micro: "No std", cyano: "Advisory", sixppd: "No std", lead: "Stricter", overall: "Leader", score: 92 },
  { state: "MA", pfas: "20 ppt (6 PFAS)", micro: "No std", cyano: "Advisory", sixppd: "No std", lead: "Federal", overall: "Leader", score: 85 },
  { state: "MI", pfas: "8 ppt (7 PFAS)", micro: "No std", cyano: "Advisory", sixppd: "No std", lead: "Stricter", overall: "Leader", score: 88 },
  { state: "NH", pfas: "12 ppt (4 PFAS)", micro: "No std", cyano: "No std", sixppd: "No std", lead: "Federal", overall: "Active", score: 78 },
  { state: "VT", pfas: "20 ppt (5 PFAS)", micro: "No std", cyano: "Advisory", sixppd: "No std", lead: "Federal", overall: "Active", score: 72 },
  { state: "NY", pfas: "10 ppt (2 PFAS)", micro: "Monitoring", cyano: "Advisory", sixppd: "No std", lead: "Stricter", overall: "Active", score: 80 },
  { state: "WA", pfas: "10-15 ppt (5 PFAS)", micro: "No std", cyano: "Advisory", sixppd: "Regulatory", lead: "Federal", overall: "Leader", score: 86 },
  { state: "CA", pfas: "Notification levels", micro: "State law", cyano: "Advisory", sixppd: "Monitoring", lead: "Stricter", overall: "Leader", score: 90 },
  { state: "MD", pfas: "Follows EPA", micro: "No std", cyano: "Advisory+", sixppd: "No std", lead: "Enhanced", overall: "Moderate", score: 55 },
  { state: "WI", pfas: "20 ppt (2 PFAS)", micro: "No std", cyano: "Advisory", sixppd: "No std", lead: "Federal", overall: "Active", score: 68 },
  { state: "PA", pfas: "Follows EPA", micro: "No std", cyano: "No std", sixppd: "No std", lead: "Federal", overall: "Lagging", score: 35 },
  { state: "OH", pfas: "Follows EPA", micro: "No std", cyano: "Advisory", sixppd: "No std", lead: "Federal", overall: "Moderate", score: 45 },
  { state: "FL", pfas: "Follows EPA", micro: "No std", cyano: "Advisory", sixppd: "No std", lead: "Federal", overall: "Moderate", score: 40 },
  { state: "TX", pfas: "Follows EPA", micro: "No std", cyano: "No std", sixppd: "No std", lead: "Federal", overall: "Lagging", score: 25 },
];

// ── SHARED COMPONENTS ─────────────────────────────────────────────────
const Badge = ({ text, color }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "2px 8px", borderRadius: 3, fontSize: 9, fontWeight: 700,
    letterSpacing: 1, textTransform: "uppercase",
    background: color + "15", color, border: `1px solid ${color}30`,
  }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}` }} />
    {text}
  </span>
);

const Stat = ({ label, value, desc, color = C.accent }) => (
  <div style={{ background: C.surface, borderRadius: 6, padding: "10px 12px", border: `1px solid ${C.border}`, flex: "1 1 0", minWidth: 0 }}>
    <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "mono" }}>{value}</div>
    {desc && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{desc}</div>}
  </div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 10 }}>{children}</div>
);

const MiniBar = ({ pct, color, height = 6 }) => (
  <div style={{ width: "100%", height, background: C.surface, borderRadius: 3, overflow: "hidden" }}>
    <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
  </div>
);

const ttStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 10, color: C.text };

// ── TAB 1: THREAT DASHBOARD ──────────────────────────────────────────
function ThreatDashboard({ role, selected, setSelected, expanded, setExpanded }) {
  const active = threats.find(t => t.id === selected);

  return (
    <div>
      {/* Summary Bar */}
      <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: "14px 18px", marginBottom: 14 }}>
        {active ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20, color: active.levelColor }}>{active.icon}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{active.name}</span>
              <Badge text={active.level} color={active.levelColor} />
              {role !== "federal" && (
                <span style={{ fontSize: 11, color: C.textMuted, marginLeft: "auto" }}>
                  {role === "state" ? `${active.stateData.state}: ${active.stateData.units} units (Rank #${active.stateData.rank})` :
                   role === "ms4" ? `${active.ms4Data.jurisdiction}: ${active.ms4Data.sites} affected sites` :
                   `${active.stateData.state}: ${active.stateData.systems} systems`}
                </span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, height: 120 }}>
              <ResponsiveContainer>
                <BarChart data={active.topStates} layout="vertical" margin={{ left: 2, right: 8, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="state" width={24} tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={ttStyle} />
                  <Bar dataKey="units" fill={active.levelColor} radius={[0, 3, 3, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
              <ResponsiveContainer>
                <AreaChart data={active.trend} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={active.levelColor} stopOpacity={0.3}/><stop offset="95%" stopColor={active.levelColor} stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="yr" tick={{ fontSize: 9, fill: C.textDim }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={ttStyle} />
                  <Area type="monotone" dataKey="v" stroke={active.levelColor} strokeWidth={2} fill="url(#ag)" name="Detections" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>
              {role === "federal" ? "National Overview" : role === "state" ? "Maryland Overview" : role === "ms4" ? "Anne Arundel County" : "Baltimore Metro Utility"} — {threats.reduce((a,t) => a + (role === "federal" ? t.nationalCount : t.stateData.units), 0).toLocaleString()} assessment units affected
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${threats.length}, 1fr)`, gap: 6 }}>
              {threats.map(t => (
                <div key={t.id} style={{ background: C.surface, borderRadius: 4, padding: "6px 8px", borderLeft: `3px solid ${t.levelColor}`, cursor: "pointer" }} onClick={() => setSelected(t.id)}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{t.name}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: t.levelColor, fontFamily: "mono" }}>{(role === "federal" ? t.nationalCount : t.stateData.units).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {threats.map(t => {
          const count = role === "federal" ? t.nationalCount : t.stateData.units;
          const isSel = selected === t.id;
          return (
            <div key={t.id} onClick={() => setSelected(t.id === selected ? null : t.id)} style={{
              background: isSel ? `linear-gradient(145deg, ${t.levelColor}06, ${C.card})` : C.card,
              borderRadius: 8, padding: 14, cursor: "pointer",
              border: isSel ? `1px solid ${t.levelColor}50` : `1px solid ${C.border}`,
              transition: "all 0.2s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 16, color: t.levelColor }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{t.name}</div>
                    <div style={{ fontSize: 9, color: C.textDim }}>{t.subtitle}</div>
                  </div>
                </div>
                <Badge text={t.level} color={t.levelColor} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: t.levelColor, fontFamily: "mono" }}>{count.toLocaleString()}</span>
                <span style={{ fontSize: 9, color: C.textDim }}>{role === "federal" ? "national" : role === "state" ? "in MD" : "local"}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: t.yoy > 0 ? C.red : C.green, marginLeft: "auto" }}>
                  {t.yoy > 0 ? "▲" : "▼"}{Math.abs(t.yoy)}%
                </span>
              </div>
              <div style={{ height: 32, marginBottom: 8 }}>
                <ResponsiveContainer>
                  <AreaChart data={t.trend} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                    <defs><linearGradient id={`s${t.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.levelColor} stopOpacity={0.25}/><stop offset="100%" stopColor={t.levelColor} stopOpacity={0}/></linearGradient></defs>
                    <Area type="monotone" dataKey="v" stroke={t.levelColor} strokeWidth={1.5} fill={`url(#s${t.id})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: C.surface, borderRadius: 4, border: `1px solid ${C.border}` }}>
                <div><div style={{ fontSize: 8, color: C.textDim }}>MCL</div><div style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{t.mcl.split(" ")[0]}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 8, color: C.textDim }}>Deadline</div><div style={{ fontSize: 10, fontWeight: 700, color: t.levelColor }}>{t.deadline}</div></div>
              </div>
              {role !== "federal" && (
                <div style={{ fontSize: 9, color: C.textMuted, marginTop: 6, padding: "4px 8px", background: C.surface, borderRadius: 3 }}>
                  {role === "ms4" ? `${t.ms4Data.sites} sites • ${t.ms4Data.runoffRisk} risk` : `State std: ${t.stateData.stateStandard}`}
                </div>
              )}
              <button onClick={e => { e.stopPropagation(); setExpanded(t.id); }} style={{
                width: "100%", marginTop: 8, padding: "5px 0", background: "transparent",
                border: `1px solid ${C.border}`, borderRadius: 4, color: C.textDim, fontSize: 9, cursor: "pointer",
              }}>⤢ Expand</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TAB 2: REGULATORY CALENDAR ───────────────────────────────────────
function RegCalendar({ role }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? regEvents : regEvents.filter(e => e.contaminant === filter);

  const statusColor = s => s === "complete" ? C.green : s === "active" ? C.amber : C.accent;
  const typeIcon = t => t === "Legal" ? "⚖" : t.includes("Compliance") ? "🔒" : t.includes("Final") ? "✓" : t.includes("Proposed") ? "📋" : t === "Petition" ? "📨" : "◈";

  const upcoming = filtered.filter(e => e.status === "upcoming");
  const nextDeadline = upcoming.length > 0 ? upcoming[0] : null;
  const daysToNext = nextDeadline ? Math.ceil((new Date(nextDeadline.date) - new Date()) / 86400000) : null;

  return (
    <div>
      {/* Countdown Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.red}30`, padding: "12px 16px" }}>
          <div style={{ fontSize: 9, color: C.red, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>PFAS Monitoring Deadline</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.red, fontFamily: "mono" }}>{Math.ceil((new Date("2027-01-01") - new Date()) / 86400000)}</div>
          <div style={{ fontSize: 10, color: C.textDim }}>days remaining • Jan 2027</div>
        </div>
        <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.amber}30`, padding: "12px 16px" }}>
          <div style={{ fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>PFAS Compliance Deadline</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.amber, fontFamily: "mono" }}>{Math.ceil((new Date("2031-01-01") - new Date()) / 86400000)}</div>
          <div style={{ fontSize: 10, color: C.textDim }}>days remaining • Jan 2031</div>
        </div>
        <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.pink}30`, padding: "12px 16px" }}>
          <div style={{ fontSize: 9, color: C.pink, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>LCRR Compliance</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.pink, fontFamily: "mono" }}>{Math.ceil((new Date("2027-06-01") - new Date()) / 86400000)}</div>
          <div style={{ fontSize: 10, color: C.textDim }}>days remaining • Jun 2027</div>
        </div>
      </div>

      {/* Filter Row */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {[{ id: "all", label: "All", color: C.accent }, ...threats.map(t => ({ id: t.id, label: t.name, color: t.levelColor }))].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer",
            background: filter === f.id ? f.color + "20" : "transparent",
            border: `1px solid ${filter === f.id ? f.color + "50" : C.border}`,
            color: filter === f.id ? f.color : C.textDim,
          }}>{f.label}</button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {filtered.map((ev, i) => {
          const t = threats.find(x => x.id === ev.contaminant);
          const sc = statusColor(ev.status);
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "90px 28px 1fr", gap: 12,
              padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
              opacity: ev.status === "complete" ? 0.6 : 1,
              background: ev.status === "active" ? C.amber + "06" : "transparent",
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: sc, fontFamily: "mono" }}>{ev.date.slice(0, 7)}</div>
                <div style={{ fontSize: 9, color: C.textDim }}>{ev.type}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: sc, boxShadow: `0 0 6px ${sc}44`, flexShrink: 0 }} />
                {i < filtered.length - 1 && <div style={{ width: 1, flex: 1, background: C.border, marginTop: 4 }} />}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{ev.title}</span>
                  {t && <span style={{ fontSize: 12, color: t.levelColor }}>{t.icon}</span>}
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.4 }}>{ev.impact}</div>
                {role !== "federal" && ev.contaminant === "pfas" && ev.status === "upcoming" && (
                  <div style={{ fontSize: 9, color: C.accent, marginTop: 3, fontStyle: "italic" }}>
                    → MD impact: {threats.find(x => x.id === "pfas").stateData.systems} systems must prepare
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TAB 3: STATE VS FEDERAL MAP ──────────────────────────────────────
function StateVsFederal({ role }) {
  const [sortBy, setSortBy] = useState("score");
  const sorted = [...stateComparisons].sort((a, b) => sortBy === "score" ? b.score - a.score : a.state.localeCompare(b.state));
  const mdRow = stateComparisons.find(s => s.state === "MD");

  const scoreColor = s => s >= 80 ? C.green : s >= 50 ? C.amber : C.red;
  const cellColor = v => v.includes("Stricter") || v.includes("Leader") || v.includes("Regulatory") || v.includes("State law") || v.includes("Enhanced")
    ? C.green : v.includes("Advisory") || v.includes("Active") || v.includes("Moderate") || v.includes("Monitoring") || v.includes("Notification")
    ? C.amber : v.includes("No std") || v.includes("Follows") || v.includes("Federal") || v.includes("Lagging")
    ? C.textDim : C.text;

  return (
    <div>
      {/* MD Spotlight (for non-federal roles) */}
      {role !== "federal" && mdRow && (
        <div style={{
          background: C.card, borderRadius: 8, border: `1px solid ${C.accent}30`,
          padding: "14px 18px", marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 3fr", gap: 16, alignItems: "center",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Maryland Score</div>
            <div style={{ fontSize: 42, fontWeight: 900, color: scoreColor(mdRow.score), fontFamily: "mono" }}>{mdRow.score}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>of 100 • <span style={{ color: C.amber }}>Moderate</span></div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Maryland exceeds federal standards in 2 of 6 contaminant classes</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
              {threats.map(t => (
                <div key={t.id} style={{ background: C.surface, borderRadius: 4, padding: "6px 8px", borderTop: `2px solid ${t.stateData.stricterThanFed ? C.green : C.textDim}` }}>
                  <div style={{ fontSize: 9, color: C.textDim }}>{t.name}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.stateData.stricterThanFed ? C.green : C.textMuted, marginTop: 2 }}>
                    {t.stateData.stricterThanFed ? "Stricter" : "Federal"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Score Distribution Chart */}
      <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: "14px 18px", marginBottom: 14 }}>
        <SectionLabel>State Regulatory Strictness Score (0-100)</SectionLabel>
        <div style={{ height: 160 }}>
          <ResponsiveContainer>
            <BarChart data={sorted} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <XAxis dataKey="state" tick={{ fontSize: 9, fill: C.textMuted }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.textDim }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={ttStyle} />
              <Bar dataKey="score" radius={[3, 3, 0, 0]} barSize={20}>
                {sorted.map((s, i) => (
                  <Cell key={i} fill={s.state === "MD" ? C.accent : scoreColor(s.score)} opacity={s.state === "MD" ? 1 : 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison Table */}
      <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["State", "Score", "PFAS", "Microplastics", "Cyanotoxins", "6PPD-Q", "Lead", "Overall"].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, cursor: "pointer" }}
                  onClick={() => h === "Score" ? setSortBy("score") : h === "State" ? setSortBy("state") : null}
                >{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => (
              <tr key={s.state} style={{
                borderBottom: `1px solid ${C.border}`,
                background: s.state === "MD" ? C.accent + "08" : "transparent",
              }}>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: s.state === "MD" ? C.accent : C.text }}>{s.state}</td>
                <td style={{ padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <MiniBar pct={s.score} color={scoreColor(s.score)} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(s.score), fontFamily: "mono", minWidth: 20 }}>{s.score}</span>
                  </div>
                </td>
                <td style={{ padding: "8px 10px", color: cellColor(s.pfas), fontSize: 10 }}>{s.pfas}</td>
                <td style={{ padding: "8px 10px", color: cellColor(s.micro), fontSize: 10 }}>{s.micro}</td>
                <td style={{ padding: "8px 10px", color: cellColor(s.cyano), fontSize: 10 }}>{s.cyano}</td>
                <td style={{ padding: "8px 10px", color: cellColor(s.sixppd), fontSize: 10 }}>{s.sixppd}</td>
                <td style={{ padding: "8px 10px", color: cellColor(s.lead), fontSize: 10 }}>{s.lead}</td>
                <td style={{ padding: "8px 10px" }}><Badge text={s.overall} color={scoreColor(s.score)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── TAB 4: PEARL TREATMENT MATCH ─────────────────────────────────────
function PearlMatch({ role }) {
  const treatable = threats.filter(t => t.pearlCapable);
  const notTreatable = threats.filter(t => !t.pearlCapable);

  return (
    <div>
      {/* Capability Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <Stat label="Treatable Threats" value={`${treatable.length}/${threats.length}`} desc="Contaminant classes" color={C.green} />
        <Stat label="Max Removal" value="95%" desc="Microplastics (mechanical)" color={C.green} />
        <Stat label="Filtration Stages" value="Up to 75" desc="Configurable per threat" color={C.accent} />
        <Stat label="Pilot Data" value="Milton, FL" desc="88-95% TSS • 94% bacteria" color={C.pearl} />
      </div>

      {/* Removal Effectiveness Chart */}
      <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: "14px 18px", marginBottom: 14 }}>
        <SectionLabel>PEARL Removal Effectiveness by Contaminant</SectionLabel>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={threats.map(t => ({ name: t.name, removal: t.pearlRemoval, color: t.levelColor, capable: t.pearlCapable }))} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.textDim }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={ttStyle} formatter={v => `${v}%`} />
              <Bar dataKey="removal" radius={[4, 4, 0, 0]} barSize={36} name="Removal %">
                {threats.map((t, i) => (
                  <Cell key={i} fill={t.pearlCapable ? t.levelColor : C.textDim + "40"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Threat Cards with PEARL detail */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {threats.map(t => (
          <div key={t.id} style={{
            background: C.card, borderRadius: 8, padding: 14,
            border: `1px solid ${t.pearlCapable ? C.pearl + "30" : C.border}`,
            opacity: t.pearlCapable ? 1 : 0.5,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 18, color: t.levelColor }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{t.name}</div>
                  <Badge text={t.pearlCapable ? "PEARL TREATABLE" : "NOT ADDRESSABLE"} color={t.pearlCapable ? C.pearl : C.textDim} />
                </div>
              </div>
              {t.pearlCapable && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.pearl, fontFamily: "mono" }}>{t.pearlRemoval}%</div>
                  <div style={{ fontSize: 9, color: C.textDim }}>removal rate</div>
                </div>
              )}
            </div>
            {t.pearlCapable ? (
              <>
                <div style={{ marginBottom: 8 }}>
                  <MiniBar pct={t.pearlRemoval} color={C.pearl} height={8} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ background: C.surface, borderRadius: 4, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.8 }}>Method</div>
                    <div style={{ fontSize: 10, color: C.text, marginTop: 2 }}>{t.pearlMethod}</div>
                  </div>
                  <div style={{ background: C.surface, borderRadius: 4, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.8 }}>Stages</div>
                    <div style={{ fontSize: 10, color: C.text, marginTop: 2 }}>{t.pearlStages}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8, padding: "6px 8px", background: C.surface, borderRadius: 4, borderLeft: `2px solid ${C.pearl}` }}>
                  {t.pearlEvidence}
                </div>
                {role !== "federal" && (
                  <div style={{ fontSize: 9, color: C.accent, marginTop: 6, fontStyle: "italic" }}>
                    {role === "ms4" ? `${t.ms4Data.sites} sites in Anne Arundel could benefit from PEARL deployment` :
                     `${t.stateData.units} MD assessment units with ${t.name} detections`}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{t.pearlEvidence}</div>
            )}
          </div>
        ))}
      </div>

      {/* Closed Loop Diagram */}
      <div style={{
        background: C.card, borderRadius: 8, border: `1px solid ${C.pearl}20`, padding: "16px 20px", marginTop: 14,
      }}>
        <SectionLabel>Closed-Loop: Detect → Treat → Verify</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, alignItems: "center" }}>
          {[
            { step: "1", label: "PIN Detects", desc: "ATTAINS data identifies contaminant in waterbody", color: C.accent, icon: "🔍" },
            { step: "2", label: "PEARL Treats", desc: "Configurable filtration targets specific contaminant", color: C.pearl, icon: "⚙" },
            { step: "3", label: "Aqua-Lo Validates", desc: "Lab results confirm removal effectiveness", color: C.green, icon: "🧪" },
            { step: "4", label: "PIN Documents", desc: "Compliance record updated, resolution tracked", color: C.purple, icon: "✓" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", position: "relative" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", margin: "0 auto 8px",
                background: s.color + "18", border: `2px solid ${s.color}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}>{s.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</div>
              <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2, lineHeight: 1.3, padding: "0 8px" }}>{s.desc}</div>
              {i < 3 && (
                <div style={{
                  position: "absolute", right: -8, top: 18, width: 16, height: 2,
                  background: `linear-gradient(90deg, ${s.color}44, ${C.border})`,
                }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── EXPANDED OVERLAY ─────────────────────────────────────────────────
function ExpandedCard({ threat, role, onClose }) {
  const [view, setView] = useState("states");
  if (!threat) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: C.bg, borderRadius: 12, width: "100%", maxWidth: 880, maxHeight: "88vh", overflow: "auto", border: `1px solid ${threat.levelColor}30`, boxShadow: `0 0 60px ${threat.levelColor}10` }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: `linear-gradient(135deg, ${threat.levelColor}06, transparent)` }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 22, color: threat.levelColor }}>{threat.icon}</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{threat.name}</span>
              <Badge text={threat.level} color={threat.levelColor} />
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, maxWidth: 560 }}>{threat.summary}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 5, color: C.textMuted, padding: "5px 12px", fontSize: 10, cursor: "pointer" }}>📄 PDF</button>
            <button onClick={onClose} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 5, color: C.textMuted, padding: "5px 10px", fontSize: 13, cursor: "pointer" }}>✕</button>
          </div>
        </div>
        <div style={{ padding: "12px 20px", display: "flex", gap: 8 }}>
          {threat.keyFacts.map((f, i) => <Stat key={i} {...f} color={threat.levelColor} />)}
        </div>
        <div style={{ padding: "0 20px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: C.card, borderRadius: 6, padding: 12, border: `1px solid ${C.border}` }}>
            <SectionLabel>Detection Trend</SectionLabel>
            <div style={{ height: 150 }}>
              <ResponsiveContainer>
                <AreaChart data={threat.trend} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={threat.levelColor} stopOpacity={0.3}/><stop offset="95%" stopColor={threat.levelColor} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="yr" tick={{ fontSize: 9, fill: C.textDim }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: C.textDim }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={ttStyle} />
                  <Area type="monotone" dataKey="v" stroke={threat.levelColor} strokeWidth={2} fill="url(#eg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ background: C.card, borderRadius: 6, padding: 12, border: `1px solid ${C.border}` }}>
            <SectionLabel>Top 5 States</SectionLabel>
            <div style={{ height: 150 }}>
              <ResponsiveContainer>
                <BarChart data={threat.topStates} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="state" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: C.textDim }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={ttStyle} />
                  <Bar dataKey="units" fill={threat.levelColor} radius={[3, 3, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        {/* Toggle */}
        <div style={{ padding: "0 20px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 2, background: C.card, borderRadius: 4, padding: 2, border: `1px solid ${C.border}` }}>
              {["states", "waterbodies"].map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  background: view === v ? threat.levelColor + "18" : "transparent", border: view === v ? `1px solid ${threat.levelColor}40` : "1px solid transparent",
                  borderRadius: 3, padding: "4px 12px", fontSize: 10, fontWeight: 600, color: view === v ? threat.levelColor : C.textDim, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.8,
                }}>{v === "states" ? "States" : "Waterbodies"}</button>
              ))}
            </div>
            {threat.pearlCapable && <Badge text={`PEARL: ${threat.pearlRemoval}% removal`} color={C.pearl} />}
          </div>
          <div style={{ background: C.card, borderRadius: 6, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {(view === "states" ? ["#", "State", "Units", "MCL"] : ["Waterbody", "Type", "Status", "Level"]).map(h => (
                    <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view === "states" ? threat.topStates.map((s, i) => (
                  <tr key={s.state} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "7px 10px", color: C.textDim, fontFamily: "mono" }}>#{i + 1}</td>
                    <td style={{ padding: "7px 10px", fontWeight: 700, color: C.text }}>{s.state}</td>
                    <td style={{ padding: "7px 10px", color: threat.levelColor, fontWeight: 700, fontFamily: "mono" }}>{s.units.toLocaleString()}</td>
                    <td style={{ padding: "7px 10px", color: C.textMuted }}>{threat.mcl}</td>
                  </tr>
                )) : threat.waterbodies.map((w, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "7px 10px", fontWeight: 600, color: C.text }}>{w.name}</td>
                    <td style={{ padding: "7px 10px", color: C.textMuted }}>{w.type}</td>
                    <td style={{ padding: "7px 10px" }}><Badge text={w.status} color={w.status.includes("Impaired") || w.status.includes("Lethal") || w.status.includes("Critical") || w.status.includes("Chronic") || w.status.includes("Exceeded") ? C.red : w.status.includes("High") || w.status.includes("Recurring") || w.status.includes("Action") || w.status.includes("Annual") ? C.amber : C.green} /></td>
                    <td style={{ padding: "7px 10px", color: threat.levelColor, fontWeight: 600 }}>{w.level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────
function EmergingContaminants({ role = "federal" }) {
  const [tab, setTab] = useState("threats");
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const currentRole = roles.find(r => r.id === role) || roles[0];

  const tabs = [
    { id: "threats", label: "Threat Dashboard", icon: "⬡" },
    { id: "calendar", label: "Regulatory Calendar", icon: "📅" },
    ...(role === "federal" ? [{ id: "states", label: "State vs Federal", icon: "🗺" }] : []),
    { id: "pearl", label: "PEARL Treatment", icon: "💎" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', -apple-system, sans-serif", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        ::-webkit-scrollbar { width: 5px } ::-webkit-scrollbar-track { background: ${C.bg} } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px }
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 20px 0", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}`, animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 2 }}>Federal Management Center</span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, margin: 0 }}>Emerging Contaminants</h1>
          </div>
          {/* Role Context */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, borderRadius: 6, padding: "6px 12px", border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 14 }}>{currentRole.icon}</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accent }}>{currentRole.label}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>{currentRole.scope}</div>
            </div>
          </div>
        </div>
        {/* Tab Bar */}
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 16px", fontSize: 11, fontWeight: 600, cursor: "pointer",
              background: "transparent", border: "none", borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              color: tab === t.id ? C.accent : C.textDim,
              transition: "all 0.15s",
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "14px 20px 20px" }}>
        {tab === "threats" && <ThreatDashboard role={role} selected={selected} setSelected={setSelected} expanded={expanded} setExpanded={setExpanded} />}
        {tab === "calendar" && <RegCalendar role={role} />}
        {tab === "states" && <StateVsFederal role={role} />}
        {tab === "pearl" && <PearlMatch role={role} />}
      </div>

      {/* Expanded Overlay */}
      {expanded && <ExpandedCard threat={threats.find(t => t.id === expanded)} role={role} onClose={() => setExpanded(null)} />}
    </div>
  );
}

// ── DEMO WRAPPER (remove in production) ──────────────────────────────
export { EmergingContaminants };

function DemoWrapper() {
  const [demoRole, setDemoRole] = useState("federal");
  return (
    <div>
      <EmergingContaminants role={demoRole} />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0c1322ee", borderTop: "1px solid #1a2540", padding: "6px 16px", display: "flex", alignItems: "center", gap: 8, zIndex: 999, backdropFilter: "blur(8px)" }}>
        <span style={{ fontSize: 9, color: "#5a6d8a", textTransform: "uppercase", letterSpacing: 1.5 }}>Demo role preview:</span>
        {roles.map(r => (
          <button key={r.id} onClick={() => setDemoRole(r.id)} style={{
            padding: "3px 10px", borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: "pointer",
            background: demoRole === r.id ? "#38bdf818" : "transparent",
            border: demoRole === r.id ? "1px solid #38bdf840" : "1px solid #1a2540",
            color: demoRole === r.id ? "#38bdf8" : "#5a6d8a",
          }}>{r.icon} {r.label}</button>
        ))}
      </div>
    </div>
  );
}

export default DemoWrapper;
