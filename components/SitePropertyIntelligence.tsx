'use client';

import { useState, useCallback } from "react";

const MOCK = {
  address: "416 N Houcksville Road 21074",
  huc: "HUC-8: 02060003",
  watershed: "Patapsco River Watershed",
  risks: [
    { param: "Pathogens (E. coli)", cat: "EPA Category 5", severity: "high" as const, detail: "Waterbody is impaired and requires a TMDL. E. coli concentrations exceed the 126 CFU/100mL geometric mean standard in 78% of samples collected between 2019\u20132024. Primary sources: aging septic systems, urban stormwater runoff, agricultural operations upstream.", samples: 142, exceedances: 111, lastSample: "2024-09-12", threshold: "126 CFU/100mL" },
    { param: "Nutrients (Total Phosphorus)", cat: "EPA Category 4a", severity: "moderate" as const, detail: "A TMDL has been completed or is in development. Phosphorus loading exceeds the 0.05 mg/L target in seasonal measurements. Eutrophication risk is moderate with periodic algal blooms in downstream impoundments.", samples: 89, exceedances: 34, lastSample: "2024-08-28", threshold: "0.05 mg/L" },
    { param: "Sediment / Siltation", cat: "EPA Category 2", severity: "low" as const, detail: "Waterbody is attaining some designated uses but insufficient data for full assessment. Sedimentation from construction and stream bank erosion is episodic, primarily during high-flow events.", samples: 56, exceedances: 8, lastSample: "2024-07-15", threshold: "Narrative criteria" },
  ],
  tmdls: [
    { param: "E. coli", wla: "126 CFU/100mL", status: "Approved (2019)", approved: true, detail: "EPA-approved TMDL establishes Waste Load Allocations for all permitted point sources and Load Allocations for nonpoint sources. Implementation plan requires 65% reduction from 2015 baseline. Monitoring shows 23% achieved through 2024.", reductionTarget: "65%", achieved: "23%", deadline: "2029" },
    { param: "Total Phosphorus", wla: "TBD", status: "In Development", approved: false, detail: "MDE is developing a phosphorus TMDL. Draft expected Q2 2026. Preliminary modeling indicates WLA of ~0.03 mg/L for point sources. Public comment anticipated Fall 2026.", reductionTarget: "TBD", achieved: "N/A", deadline: "Draft Q2 2026" },
  ],
  ms4: { active: true, permitId: "MDR10-0041", jurisdiction: "Carroll County", detail: "This property falls within a regulated MS4 Phase II area. All new development and redevelopment must comply with stormwater management requirements including on-site retention, water quality treatment, and channel protection volume standards. Post-construction BMPs required for disturbance > 5,000 sq ft." },
  ej: { index: 72, lowIncome: 68, minority: 81, linguistic: 24, detail: "EPA EJScreen analysis of surrounding census tracts indicates elevated environmental justice concerns. The 81st percentile minority population and 68th percentile low-income population may trigger enhanced public participation requirements under NEPA and state environmental review.", supplemental: [
    { label: "PM2.5 Exposure", value: "67th", flag: false },
    { label: "Ozone Exposure", value: "58th", flag: false },
    { label: "Diesel PM", value: "74th", flag: true },
    { label: "Toxic Releases", value: "45th", flag: false },
    { label: "Traffic Proximity", value: "82nd", flag: true },
    { label: "Superfund Proximity", value: "31st", flag: false },
    { label: "Hazardous Waste", value: "56th", flag: false },
    { label: "Wastewater Discharge", value: "71st", flag: true },
  ]},
  trends: [
    { param: "Dissolved Oxygen", period: "5-year", delta: +8.2, direction: "up" as const, detail: "DO improved from 6.1 to 6.6 mg/L median. Attributed to upgraded upstream WWTP nutrient removal and 2.3 miles of riparian buffer restoration.", readings: [5.8, 6.0, 6.1, 6.4, 6.6] },
    { param: "E. coli", period: "5-year", delta: -15.4, direction: "down" as const, detail: "Geometric mean increased from 98 to 113 CFU/100mL. Correlated with increased impervious surface from residential development and aging infrastructure.", readings: [98, 102, 108, 110, 113] },
    { param: "Total Nitrogen", period: "5-year", delta: +1.1, direction: "flat" as const, detail: "Stable at 2.4 mg/L median. Agricultural BMPs in headwaters offset loading from new development. Change within measurement uncertainty.", readings: [2.4, 2.4, 2.5, 2.4, 2.4] },
    { param: "Turbidity", period: "5-year", delta: +12, direction: "up" as const, detail: "Improving from 18.2 to 16.2 NTU median. Stream restoration projects at two tributary confluences reducing sediment mobilization.", readings: [18.2, 17.8, 17.1, 16.8, 16.2] },
  ],
  permits: [
    { type: "NPDES General", id: "MDG01-1234", status: "Active" as const, expiry: "2027-03-15", detail: "Covers industrial stormwater discharges. 2022\u20132027 cycle. Requires quarterly visual monitoring, annual analytical monitoring, and SWPPP.", contact: "MDE Water & Science Admin", conditions: ["Quarterly visual monitoring", "Annual benchmark sampling", "SWPPP maintenance", "Annual report by March 1"] },
    { type: "MS4 Phase II", id: "MDR10-0041", status: "Active" as const, expiry: "2026-12-01", detail: "Requires implementation of six Minimum Control Measures: public education, public involvement, illicit discharge detection, construction runoff control, post-construction stormwater management, pollution prevention.", contact: "Carroll County DPW", conditions: ["6 MCM implementation", "Annual report to MDE", "20% impervious restoration", "IDDE program maintenance"] },
    { type: "Construction General", id: "MDR10-9921", status: "Expired" as const, expiry: "2025-06-30", detail: "EXPIRED. Any new construction or land disturbance >1 acre requires a new CGP with approved E&SC Plan and SWM Plan BEFORE ground disturbance. Violations up to $37,500/day.", contact: "MDE Compliance Program", conditions: ["EXPIRED \u2014 Renewal required", "E&SC Plan approval", "SWM Plan approval", "NOI filing before disturbance"] },
  ],
  drinking: {
    system: "Carroll County DPW", pwsid: "MD0060015", violations: 0, lastCcr: "2024", pfas: "Not Detected", leadLines: "0.2% estimated",
    detail: "Served by Carroll County DPW. Source: blend of Prettyboy and Liberty Reservoirs treated at Hampstead WTP. ~42,000 connections. No health-based violations in 3 years. PFAS screening under new EPA rule showed all 6 regulated compounds below detection in Q1 2025.",
    params: [
      { name: "Lead (90th %ile)", value: "4.2 ppb", limit: "15 ppb", status: "ok" },
      { name: "Copper (90th %ile)", value: "0.31 ppm", limit: "1.3 ppm", status: "ok" },
      { name: "Total THMs", value: "42 ppb", limit: "80 ppb", status: "ok" },
      { name: "Haloacetic Acids", value: "28 ppb", limit: "60 ppb", status: "ok" },
      { name: "Nitrate", value: "1.8 ppm", limit: "10 ppm", status: "ok" },
      { name: "Total Coliform", value: "0/month", limit: ">1 positive", status: "ok" },
    ]
  },
  flood: {
    femaZone: "Zone X (Minimal)", csoPoints: 0, ssoEvents: 1, lastOverflow: "2024-08-14",
    detail: "FEMA Zone X = minimal flood hazard (outside 0.2% annual chance floodplain). No CSO points within 1 mile. One SSO event within 2 miles in past 24 months: 12,000-gallon overflow on Aug 14, 2024 from force main failure during 2.5-inch rainfall, reaching an unnamed Patapsco tributary.",
    nearby: [{ type: "SSO", date: "2024-08-14", volume: "12,000 gal", cause: "Force main failure", distance: "1.8 mi" }]
  },
};

type Severity = 'high' | 'moderate' | 'low';

const sev: Record<Severity, { bg: string; border: string; text: string; dot: string }> = { high: { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444" }, moderate: { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", dot: "#F59E0B" }, low: { bg: "#D1FAE5", border: "#6EE7B7", text: "#065F46", dot: "#10B981" } };
const summaryItems = [
  { label: "Surface Water", score: "High", color: "#EF4444", bg: "#FEE2E2" },
  { label: "Drinking Water", score: "Low", color: "#10B981", bg: "#D1FAE5" },
  { label: "Stormwater", score: "Moderate", color: "#F59E0B", bg: "#FEF3C7" },
  { label: "Flood Risk", score: "Minimal", color: "#10B981", bg: "#D1FAE5" },
  { label: "EJ Concern", score: "Elevated", color: "#F59E0B", bg: "#FEF3C7" },
];

function Pill({ label, color }: { label: string; color: Severity }) {
  const s = sev[color] || sev.low;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px 3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", background: s.bg, color: s.text, border: `1px solid ${s.border}`, letterSpacing: "0.03em", textTransform: "uppercase" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const c = status === "Active" ? { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" } : { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" };
  return <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{status}</span>;
}

function TrendArrow({ delta, direction }: { delta: number; direction: string }) {
  const color = direction === "up" ? "#059669" : direction === "down" ? "#DC2626" : "#6B7280";
  const arrow = direction === "up" ? "\u2191" : direction === "down" ? "\u2193" : "\u2192";
  return <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 13, color }}>{arrow} {delta > 0 ? "+" : ""}{delta}%</span>;
}

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
  const w = 80, h = 28, pad = 3;
  const pts = data.map((v, i) => `${pad + (i / (data.length - 1)) * (w - pad * 2)},${h - pad - ((v - mn) / range) * (h - pad * 2)}`).join(" ");
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />{data.map((v, i) => i === data.length - 1 ? <circle key={i} cx={pad + (i / (data.length - 1)) * (w - pad * 2)} cy={h - pad - ((v - mn) / range) * (h - pad * 2)} r="3" fill={color} /> : null)}</svg>;
}

function EjBar({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  const pct = Math.min(value, 100);
  const color = warn ? (value >= 80 ? "#DC2626" : value >= 50 ? "#F59E0B" : "#10B981") : "#3B82F6";
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ position: "relative", height: 44, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div style={{ position: "absolute", bottom: 0, width: "100%", height: 5, borderRadius: 3, background: "#F1F5F9" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, width: `${pct}%`, height: 5, borderRadius: 3, background: `linear-gradient(90deg, ${color}44, ${color})` }} />
        <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 800, fontSize: 24, color: "#1E293B", lineHeight: 1, position: "relative", zIndex: 1 }}>{value}<span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>{label === "EJ INDEX" ? "th" : "%"}</span></span>
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", marginTop: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function Card({ title, icon, children, accent, onClick }: { title: string; icon: string; children: React.ReactNode; span2?: boolean; accent?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", cursor: onClick ? "pointer" : "default", transition: "box-shadow 0.2s, transform 0.15s" }} onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}} onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.03)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      {accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: "14px 14px 0 0" }} />}
      <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F1F5F9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 15 }}>{icon}</span><span style={{ fontWeight: 700, fontSize: 11, color: "#334155", letterSpacing: "0.03em", textTransform: "uppercase" }}>{title}</span></div>
        {onClick && <span style={{ fontSize: 10, color: "#3B82F6", fontWeight: 600 }}>Details {"\u2192"}</span>}
      </div>
      <div style={{ padding: "10px 16px 14px", flex: 1 }}>{children}</div>
    </div>
  );
}

function Modal({ open, onClose, title, icon, accent, children }: { open: boolean; onClose: () => void; title: string; icon: string; accent?: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }} />
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", background: "#fff", borderRadius: 18, width: "92%", maxWidth: 640, maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
        {accent && <div style={{ height: 4, background: accent, borderRadius: "18px 18px 0 0" }} />}
        <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F1F5F9", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 20 }}>{icon}</span><span style={{ fontWeight: 800, fontSize: 16, color: "#1E293B" }}>{title}</span></div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>{"\u2715"}</button>
        </div>
        <div style={{ padding: "16px 20px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 14, marginBottom: 6 }}>{text}</div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F8FAFC" }}><span style={{ fontSize: 12, color: "#64748B" }}>{label}</span><span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{value}</span></div>;
}

export default function SitePropertyIntelligence() {
  const [query, setQuery] = useState("416 n houcksville road 21074");
  const [modal, setModal] = useState<string | null>(null);
  const d = MOCK;
  const open = useCallback((id: string) => setModal(id), []);
  const close = useCallback(() => setModal(null), []);

  const exportPDF = useCallback(() => {
    const w = window.open("", "_blank");
    if (!w) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const riskRows = d.risks.map(r => `<tr><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-weight:600">${r.param}</td><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0">${r.cat}</td><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0"><span style="background:${sev[r.severity].bg};color:${sev[r.severity].text};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase">${r.severity}</span></td></tr>`).join("");
    const tmdlRows = d.tmdls.map(t => `<tr><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-weight:600">${t.param}</td><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-family:monospace">${t.wla}</td><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0">${t.status}</td></tr>`).join("");
    const permitRows = d.permits.map(p => `<tr style="background:${p.status==='Expired'?'#FEF2F2':'#fff'}"><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-weight:600">${p.type}</td><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-family:monospace;color:#3B82F6">${p.id}</td><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0"><span style="background:${p.status==='Active'?'#D1FAE5':'#FEE2E2'};color:${p.status==='Active'?'#065F46':'#991B1B'};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${p.status}</span></td><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-family:monospace;font-size:12px">${p.expiry}</td></tr>`).join("");
    const trendRows = d.trends.map(t => { const c=t.direction==="up"?"#059669":t.direction==="down"?"#DC2626":"#6B7280"; const a=t.direction==="up"?"\u2191":t.direction==="down"?"\u2193":"\u2192"; return `<tr><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-weight:600">${t.param}</td><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0">${t.period}</td><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-family:monospace;color:${c};font-weight:700">${a} ${t.delta>0?"+":""}${t.delta}%</td></tr>`; }).join("");
    const drinkRows = d.drinking.params.map(p => `<tr><td style="padding:6px 12px;border-bottom:1px solid #E2E8F0">${p.name}</td><td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;font-family:monospace;font-weight:600">${p.value}</td><td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;font-family:monospace;color:#94A3B8">${p.limit}</td><td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;color:#059669;font-weight:700">\u2713 Pass</td></tr>`).join("");
    const sumBoxes = summaryItems.map(s => `<div style="flex:1;text-align:center;padding:14px 8px;border-radius:10px;background:${s.bg}"><div style="font-size:18px;font-weight:800;color:${s.color}">${s.score}</div><div style="font-size:9px;font-weight:700;color:#64748B;margin-top:3px;text-transform:uppercase;letter-spacing:0.05em">${s.label}</div></div>`).join("");
    const ejRows = d.ej.supplemental.map(s => `<tr><td style="padding:6px 12px;border-bottom:1px solid #E2E8F0">${s.label}</td><td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;font-family:monospace;font-weight:600;color:${s.flag?'#DC2626':'#1E293B'}">${s.value}${s.flag?' \u26d1':''}</td></tr>`).join("");

    w.document.write(`<!DOCTYPE html><html><head><title>PIN Site Report \u2014 ${d.address}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;color:#1E293B;background:#fff}@media print{@page{size:letter;margin:0.5in 0.65in}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-break{page-break-inside:avoid}}
.hdr{background:linear-gradient(135deg,#0F172A,#1E3A5F);color:#fff;padding:24px 28px;border-radius:0 0 14px 14px}
.hdr h1{font-size:20px;font-weight:800;margin-bottom:3px}.hdr p{font-size:11px;color:#94A3B8}
.sec{margin:16px 0 0;page-break-inside:avoid}.sec h2{font-size:13px;font-weight:800;color:#1B3A5C;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:6px;border-bottom:2px solid #1B3A5C;margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:11px}th{background:#F1F5F9;padding:6px 12px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748B;border-bottom:2px solid #E2E8F0}
.dt{font-size:11px;color:#475569;line-height:1.5;margin:6px 0}.ft{margin-top:20px;padding:14px 0;border-top:2px solid #1B3A5C;display:flex;justify-content:space-between;font-size:9px;color:#94A3B8}
.warn{background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:8px 12px;font-size:10px;color:#92400E;margin-top:6px}
.info{background:#EFF6FF;border:1px solid #93C5FD;border-radius:6px;padding:8px 12px;font-size:10px;color:#1E40AF;margin-top:6px}
</style></head><body>
<div class="hdr"><div style="display:flex;justify-content:space-between;align-items:center"><div><h1>Water Quality Site Report</h1><p>${d.address} \u00b7 ${d.huc} \u00b7 ${d.watershed}</p></div><div style="text-align:right"><div style="font-size:22px;font-weight:800;color:#60A5FA">PIN</div><div style="font-size:9px;color:#94A3B8">PEARL Intelligence Network</div></div></div>
<div style="display:flex;gap:10px;margin-top:14px">${sumBoxes}</div></div>
<div style="padding:0 2px">
<div class="sec no-break"><h2>\u26a0\ufe0f Waterbody Risk Profile</h2><table><tr><th>Parameter</th><th>Category</th><th>Severity</th></tr>${riskRows}</table>${d.risks.map(r=>`<p class="dt"><strong>${r.param}:</strong> ${r.detail}</p>`).join("")}</div>
<div class="sec no-break"><h2>\ud83d\udccb Regulatory Exposure</h2><p class="dt" style="font-weight:600">Active TMDLs</p><table><tr><th>Parameter</th><th>WLA</th><th>Status</th></tr>${tmdlRows}</table>${d.tmdls.map(t=>`<p class="dt"><strong>${t.param}:</strong> ${t.detail}</p>`).join("")}<div class="info"><strong>\u25c9 MS4 Phase II (${d.ms4.permitId})</strong><br>${d.ms4.detail}</div></div>
<div class="sec no-break"><h2>\ud83d\udc65 Environmental Justice Screening</h2><table style="margin-bottom:6px"><tr><th>EJ Index</th><th>Low Income</th><th>Minority</th><th>Linguistic Isolation</th></tr><tr><td style="padding:8px 12px;font-weight:800;font-size:15px">${d.ej.index}th</td><td style="padding:8px 12px;font-weight:800;font-size:15px">${d.ej.lowIncome}%</td><td style="padding:8px 12px;font-weight:800;font-size:15px">${d.ej.minority}%</td><td style="padding:8px 12px;font-weight:800;font-size:15px">${d.ej.linguistic}%</td></tr></table><p class="dt">${d.ej.detail}</p><p class="dt" style="font-weight:600">Supplemental Indicators</p><table><tr><th>Indicator</th><th>Percentile</th></tr>${ejRows}</table></div>
<div class="sec no-break"><h2>\ud83d\udcc8 5-Year Trend Analysis</h2><table><tr><th>Parameter</th><th>Period</th><th>Change</th></tr>${trendRows}</table>${d.trends.map(t=>`<p class="dt"><strong>${t.param}:</strong> ${t.detail}</p>`).join("")}</div>
<div class="sec no-break"><h2>\ud83d\udcc4 Permit Constraints</h2><table><tr><th>Type</th><th>Permit ID</th><th>Status</th><th>Expiry</th></tr>${permitRows}</table>${d.permits.filter(p=>p.status==="Expired").map(p=>`<div class="warn"><strong>\u26a0 ${p.type} (${p.id}) EXPIRED.</strong> ${p.detail}</div>`).join("")}</div>
<div class="sec no-break"><h2>\ud83d\udeb0 Drinking Water</h2><table style="margin-bottom:6px"><tr><th>System</th><th>PWSID</th><th>Violations</th><th>PFAS</th><th>Lead Lines</th></tr><tr><td style="padding:8px 12px;font-weight:600">${d.drinking.system}</td><td style="padding:8px 12px;font-family:monospace">${d.drinking.pwsid}</td><td style="padding:8px 12px;color:#059669;font-weight:700">${d.drinking.violations}</td><td style="padding:8px 12px;color:#059669;font-weight:700">${d.drinking.pfas}</td><td style="padding:8px 12px">${d.drinking.leadLines}</td></tr></table><p class="dt">${d.drinking.detail}</p><table><tr><th>Parameter</th><th>Result</th><th>MCL</th><th>Status</th></tr>${drinkRows}</table></div>
<div class="sec no-break"><h2>\ud83c\udf0a Flood & Stormwater</h2><table><tr><th>FEMA Zone</th><th>CSO (1mi)</th><th>SSO (2yr)</th><th>Last Overflow</th></tr><tr><td style="padding:8px 12px;font-weight:600">${d.flood.femaZone}</td><td style="padding:8px 12px">${d.flood.csoPoints}</td><td style="padding:8px 12px;${d.flood.ssoEvents>0?'color:#DC2626;font-weight:700':''}">${d.flood.ssoEvents}</td><td style="padding:8px 12px;font-family:monospace">${d.flood.lastOverflow}</td></tr></table><p class="dt">${d.flood.detail}</p></div>
<div class="ft"><div><strong style="color:#1B3A5C;font-size:11px">PIN</strong> PEARL Intelligence Network \u00b7 pinwater.org \u00b7 430M+ datapoints \u00b7 5 water domains \u00b7 50 states</div><div>${dateStr} ${timeStr} \u00b7 PIN-${Date.now().toString(36).toUpperCase()}</div></div>
<div style="margin-top:8px;padding:10px 14px;background:#F8FAFC;border-radius:6px;border:1px solid #E2E8F0;font-size:9px;color:#94A3B8;line-height:1.5"><strong>Disclaimer:</strong> Generated from publicly available federal, state, and local water quality data by PIN (PEARL Intelligence Network). Sources: EPA ATTAINS, ECHO, SDWIS, USGS NWIS, FEMA NFHL, EPA EJScreen. PIN does not independently verify source data. Not legal, environmental, or real estate advice. Consult qualified professionals for site-specific assessments. \u00a9 ${now.getFullYear()} Local Seafood Projects Inc.</div>
</div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }, [d]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F0F4F8 0%, #E8ECF1 100%)", fontFamily: "'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F172A 100%)", padding: "16px 0 20px", borderBottom: "3px solid #3B82F6" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #3B82F6, #1D4ED8)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 16 }}>{"\ud83d\udccd"}</span></div>
            <div><div style={{ color: "#F8FAFC", fontWeight: 800, fontSize: 16 }}>Site & Property Intelligence</div><div style={{ color: "#94A3B8", fontSize: 11 }}>Address-level water quality risk {"\u00b7"} All five domains {"\u00b7"} 50 states</div></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1, padding: "10px 14px", borderRadius: 9, border: "2px solid #334155", background: "#1E293B", color: "#F8FAFC", fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: 500, outline: "none" }} />
            <button style={{ padding: "10px 20px", borderRadius: 9, background: "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(59,130,246,0.4)" }}>Assess Site</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>
        {/* LOCATION */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #CBD5E1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} /><span style={{ fontWeight: 700, fontSize: 13, color: "#1E293B" }}>{d.address}</span><span style={{ color: "#94A3B8", fontSize: 11, marginLeft: 4 }}>{d.huc} {"\u00b7"} {d.watershed}</span></div>
          <button style={{ fontSize: 11, color: "#64748B", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear</button>
        </div>

        {/* SITE RISK SUMMARY */}
        <div style={{ margin: "12px 0", padding: "14px 18px", background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 15 }}>{"\ud83c\udfaf"}</span><span style={{ fontWeight: 700, fontSize: 11, color: "#334155", letterSpacing: "0.03em", textTransform: "uppercase" }}>Site Risk Summary</span></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={exportPDF} style={{ padding: "5px 14px", borderRadius: 7, background: "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(59,130,246,0.3)", display: "flex", alignItems: "center", gap: 4 }}>{"\ud83d\udcc4"} Download Report</button>
              <button style={{ padding: "5px 12px", borderRadius: 7, background: "transparent", color: "#64748B", fontSize: 11, fontWeight: 700, border: "1px solid #CBD5E1", cursor: "pointer" }}>Share</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {summaryItems.map((s, i) => (
              <div key={i} style={{ textAlign: "center", padding: "12px 6px", borderRadius: 10, background: s.bg + "88", border: `2px solid ${s.bg}` }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.score}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", marginTop: 2, letterSpacing: "0.05em", textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3B82F6" }} />
            <span style={{ fontSize: 10, color: "#94A3B8" }}>Powered by <strong style={{ color: "#1E293B" }}>PIN</strong> {"\u00b7"} 430M+ datapoints {"\u00b7"} 5 domains {"\u00b7"} {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {/* CARD GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingBottom: 36 }}>

          <Card title="Waterbody Risk" icon={"\u26a0\ufe0f"} accent="#EF4444" onClick={() => open("risk")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {d.risks.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 7, background: sev[r.severity].bg + "66", border: `1px solid ${sev[r.severity].border}44` }}>
                  <div><div style={{ fontWeight: 700, fontSize: 11, color: "#1E293B" }}>{r.param}</div><div style={{ fontSize: 9, color: "#64748B" }}>{r.cat}</div></div>
                  <Pill label={r.severity} color={r.severity} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="EJ Vulnerability" icon={"\ud83d\udc65"} accent="#F59E0B" onClick={() => open("ej")}>
            <div style={{ display: "flex", gap: 8 }}>
              <EjBar value={d.ej.index} label="EJ INDEX" warn />
              <EjBar value={d.ej.lowIncome} label="LOW INCOME" warn />
              <EjBar value={d.ej.minority} label="MINORITY" warn />
              <EjBar value={d.ej.linguistic} label="LINGUISTIC" warn />
            </div>
            <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 6, fontStyle: "italic" }}>EPA EJScreen. 80th+ flagged.</div>
          </Card>

          <Card title="5-Year Trends" icon={"\ud83d\udcc8"} onClick={() => open("trends")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {d.trends.map((t, i) => (
                <div key={i} style={{ padding: "7px 8px", borderRadius: 7, background: t.direction === "down" ? "#FEF2F2" : t.direction === "up" ? "#F0FDF4" : "#F8FAFC", border: `1px solid ${t.direction === "down" ? "#FECACA" : t.direction === "up" ? "#BBF7D0" : "#E2E8F0"}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: 11, color: "#1E293B" }}>{t.param}</span>
                    <TrendArrow delta={t.delta} direction={t.direction} />
                  </div>
                  <div style={{ marginTop: 3 }}><MiniSpark data={t.readings} color={t.direction === "down" ? "#DC2626" : t.direction === "up" ? "#059669" : "#6B7280"} /></div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Regulatory Exposure" icon={"\ud83d\udccb"} accent="#3B82F6" onClick={() => open("reg")}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Active TMDLs</div>
            {d.tmdls.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 7px", borderRadius: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 18, height: 18, borderRadius: 4, background: t.approved ? "#D1FAE5" : "#E0E7FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>{t.approved ? "\u2713" : "\u25d0"}</span><div><div style={{ fontWeight: 700, fontSize: 10, color: "#1E293B" }}>{t.param}</div><div style={{ fontSize: 9, color: "#94A3B8" }}>WLA: {t.wla}</div></div></div>
                <span style={{ fontSize: 9, fontWeight: 700, color: t.approved ? "#065F46" : "#3730A3", background: t.approved ? "#D1FAE5" : "#E0E7FF", padding: "2px 5px", borderRadius: 3 }}>{t.status}</span>
              </div>
            ))}
            {d.ms4.active && <div style={{ padding: "6px 8px", borderRadius: 7, background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", border: "1px solid #93C5FD", marginTop: 5 }}><div style={{ fontWeight: 800, fontSize: 10, color: "#1E40AF" }}>{"\u25c9"} MS4 Phase II</div><div style={{ fontSize: 9, color: "#3B82F6" }}>Regulated boundary {"\u00b7"} Stormwater mgmt applies</div></div>}
          </Card>

          <Card title="Permit Constraints" icon={"\ud83d\udcc4"} onClick={() => open("permits")}>
            {d.permits.map((pr, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 7px", borderRadius: 6, background: pr.status === "Expired" ? "#FEF2F2" : "#F8FAFC", border: `1px solid ${pr.status === "Expired" ? "#FECACA" : "#E2E8F0"}`, marginBottom: 3 }}>
                <div><div style={{ fontWeight: 700, fontSize: 10, color: "#1E293B" }}>{pr.type}</div><div style={{ fontSize: 9, color: "#3B82F6", fontFamily: "'DM Mono',monospace" }}>{pr.id}</div></div>
                <div style={{ textAlign: "right" }}><StatusBadge status={pr.status} /><div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono',monospace", marginTop: 1 }}>{pr.expiry}</div></div>
              </div>
            ))}
            {d.permits.some(p => p.status === "Expired") && <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, padding: "4px 7px", borderRadius: 5, background: "#FFFBEB", border: "1px solid #FDE68A" }}><span style={{ fontSize: 11 }}>{"\u26a0"}</span><span style={{ fontSize: 9, color: "#92400E" }}>Expired permit {"\u2014"} action required</span></div>}
          </Card>

          <Card title="Drinking Water" icon={"\ud83d\udeb0"} accent="#10B981" onClick={() => open("drinking")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {([{ l: "System", v: d.drinking.system }, { l: "PWSID", v: d.drinking.pwsid, mono: true }, { l: "Violations", v: `${d.drinking.violations}`, good: true }, { l: "PFAS", v: d.drinking.pfas, good: true }, { l: "Lead Lines", v: d.drinking.leadLines }, { l: "CCR", v: d.drinking.lastCcr, mono: true }] as const).map((item, i) => (
                <div key={i} style={{ padding: "5px 7px", borderRadius: 5, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 1 }}>{item.l}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'good' in item && item.good ? "#059669" : "#1E293B", fontFamily: 'mono' in item && item.mono ? "'DM Mono',monospace" : "'DM Sans',sans-serif" }}>{item.v}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Flood & Stormwater" icon={"\ud83c\udf0a"} onClick={() => open("flood")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {([{ l: "FEMA Zone", v: d.flood.femaZone }, { l: "CSO (1mi)", v: `${d.flood.csoPoints}`, good: d.flood.csoPoints === 0 }, { l: "SSO (2yr)", v: `${d.flood.ssoEvents}`, warn: d.flood.ssoEvents > 0 }, { l: "Last Overflow", v: d.flood.lastOverflow, mono: true }] as const).map((item, i) => (
                <div key={i} style={{ padding: "5px 7px", borderRadius: 5, background: 'warn' in item && item.warn ? "#FEF2F2" : "#F8FAFC", border: `1px solid ${'warn' in item && item.warn ? "#FECACA" : "#E2E8F0"}` }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 1 }}>{item.l}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'good' in item && item.good ? "#059669" : 'warn' in item && item.warn ? "#DC2626" : "#1E293B", fontFamily: 'mono' in item && item.mono ? "'DM Mono',monospace" : "'DM Sans',sans-serif" }}>{item.v}</div>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>

      {/* MODALS */}
      <Modal open={modal === "risk"} onClose={close} title="Waterbody Risk Profile" icon={"\u26a0\ufe0f"} accent="#EF4444">
        <p style={{ fontSize: 12, color: "#64748B", marginBottom: 14, lineHeight: 1.5 }}>Impairment status, causes, and severity for nearby waterbodies based on EPA ATTAINS assessment data.</p>
        {d.risks.map((r, i) => (
          <div key={i} style={{ marginBottom: 14, padding: 14, borderRadius: 10, background: sev[r.severity].bg + "44", border: `1px solid ${sev[r.severity].border}66` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontWeight: 800, fontSize: 14, color: "#1E293B" }}>{r.param}</span><Pill label={r.severity} color={r.severity} /></div>
            <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 8 }}>{r.detail}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
              {([{ l: "Samples", v: String(r.samples) }, { l: "Exceedances", v: String(r.exceedances), warn: true }, { l: "Threshold", v: r.threshold, mono: true }, { l: "Last Sample", v: r.lastSample, mono: true }] as const).map((x, j) => (
                <div key={j} style={{ padding: "5px 7px", borderRadius: 5, background: "#fff" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{x.l}</div><div style={{ fontSize: 'mono' in x && x.mono ? 10 : 14, fontWeight: 800, color: 'warn' in x && x.warn ? "#DC2626" : "#1E293B", fontFamily: 'mono' in x && x.mono ? "'DM Mono',monospace" : "'DM Sans',sans-serif" }}>{x.v}</div></div>
              ))}
            </div>
          </div>
        ))}
      </Modal>

      <Modal open={modal === "ej"} onClose={close} title="EJ Vulnerability Screening" icon={"\ud83d\udc65"} accent="#F59E0B">
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}><EjBar value={d.ej.index} label="EJ INDEX" warn /><EjBar value={d.ej.lowIncome} label="LOW INCOME" warn /><EjBar value={d.ej.minority} label="MINORITY" warn /><EjBar value={d.ej.linguistic} label="LINGUISTIC" warn /></div>
        <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 14 }}>{d.ej.detail}</p>
        <SectionLabel text="Supplemental EJScreen Indicators" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {d.ej.supplemental.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6, background: s.flag ? "#FEF2F2" : "#F8FAFC", border: `1px solid ${s.flag ? "#FECACA" : "#E2E8F0"}` }}>
              <span style={{ fontSize: 11, color: "#475569" }}>{s.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: s.flag ? "#DC2626" : "#1E293B", fontFamily: "'DM Mono',monospace" }}>{s.value}{s.flag ? " \u26d1" : ""}</span>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={modal === "trends"} onClose={close} title="5-Year Trend Analysis" icon={"\ud83d\udcc8"}>
        {d.trends.map((t, i) => {
          const color = t.direction === "down" ? "#DC2626" : t.direction === "up" ? "#059669" : "#6B7280";
          return (
            <div key={i} style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontWeight: 800, fontSize: 14, color: "#1E293B" }}>{t.param}</span><TrendArrow delta={t.delta} direction={t.direction} /></div>
              <MiniSpark data={t.readings} color={color} />
              <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginTop: 6 }}>{t.detail}</p>
              <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                {t.readings.map((v, j) => (
                  <div key={j} style={{ flex: 1, textAlign: "center", padding: "3px 0", borderRadius: 5, background: "#fff", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: 8, color: "#94A3B8" }}>Yr {j + 1}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </Modal>

      <Modal open={modal === "reg"} onClose={close} title="Regulatory Exposure" icon={"\ud83d\udccb"} accent="#3B82F6">
        <SectionLabel text="Active TMDLs" />
        {d.tmdls.map((t, i) => (
          <div key={i} style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontWeight: 800, fontSize: 14, color: "#1E293B" }}>{t.param}</span><span style={{ fontSize: 10, fontWeight: 700, color: t.approved ? "#065F46" : "#3730A3", background: t.approved ? "#D1FAE5" : "#E0E7FF", padding: "2px 8px", borderRadius: 5 }}>{t.status}</span></div>
            <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 6 }}>{t.detail}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
              {[{ l: "WLA", v: t.wla }, { l: "Target", v: t.reductionTarget }, { l: "Deadline", v: t.deadline }].map((x, j) => (
                <div key={j} style={{ padding: "5px 7px", borderRadius: 5, background: "#fff", border: "1px solid #E2E8F0" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{x.l}</div><div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{x.v}</div></div>
              ))}
            </div>
          </div>
        ))}
        <SectionLabel text="MS4 Jurisdiction" />
        <div style={{ padding: 12, borderRadius: 10, background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", border: "1px solid #93C5FD" }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#1E40AF", marginBottom: 3 }}>{"\u25c9"} MS4 Phase II {"\u2014"} {d.ms4.permitId}</div>
          <div style={{ fontWeight: 600, fontSize: 11, color: "#3B82F6", marginBottom: 4 }}>{d.ms4.jurisdiction}</div>
          <p style={{ fontSize: 12, color: "#1E40AF", lineHeight: 1.6 }}>{d.ms4.detail}</p>
        </div>
      </Modal>

      <Modal open={modal === "permits"} onClose={close} title="Permit Constraints" icon={"\ud83d\udcc4"}>
        {d.permits.map((pr, i) => (
          <div key={i} style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: pr.status === "Expired" ? "#FEF2F266" : "#F8FAFC", border: `1px solid ${pr.status === "Expired" ? "#FCA5A5" : "#E2E8F0"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <div><div style={{ fontWeight: 800, fontSize: 14, color: "#1E293B" }}>{pr.type}</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#3B82F6", marginTop: 1 }}>{pr.id}</div></div>
              <div style={{ textAlign: "right" }}><StatusBadge status={pr.status} /><div style={{ fontSize: 10, color: "#64748B", fontFamily: "'DM Mono',monospace", marginTop: 2 }}>Exp: {pr.expiry}</div></div>
            </div>
            <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 6 }}>{pr.detail}</p>
            <DetailRow label="Contact" value={pr.contact} />
            <SectionLabel text="Conditions" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {pr.conditions.map((c, j) => (
                <span key={j} style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: c.includes("EXPIRED") ? "#FEE2E2" : "#F1F5F9", color: c.includes("EXPIRED") ? "#991B1B" : "#475569", border: `1px solid ${c.includes("EXPIRED") ? "#FCA5A5" : "#E2E8F0"}` }}>{c}</span>
              ))}
            </div>
          </div>
        ))}
      </Modal>

      <Modal open={modal === "drinking"} onClose={close} title="Drinking Water Quality" icon={"\ud83d\udeb0"} accent="#10B981">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
          {([{ l: "System", v: d.drinking.system }, { l: "PWSID", v: d.drinking.pwsid, mono: true }, { l: "Violations", v: `${d.drinking.violations}`, good: true }] as const).map((x, i) => (
            <div key={i} style={{ padding: "6px 8px", borderRadius: 6, background: "#F8FAFC", border: "1px solid #E2E8F0" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 1 }}>{x.l}</div><div style={{ fontSize: 12, fontWeight: 700, color: 'good' in x && x.good ? "#059669" : "#1E293B", fontFamily: 'mono' in x && x.mono ? "'DM Mono',monospace" : "'DM Sans',sans-serif" }}>{x.v}</div></div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 12 }}>{d.drinking.detail}</p>
        <SectionLabel text="Regulated Contaminant Results" />
        {d.drinking.params.map((pr, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #F1F5F9" }}>
            <span style={{ fontSize: 12, color: "#475569" }}>{pr.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{pr.value}</span>
              <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'DM Mono',monospace" }}>MCL: {pr.limit}</span>
              <span style={{ color: "#059669", fontWeight: 700, fontSize: 11 }}>{"\u2713"}</span>
            </div>
          </div>
        ))}
      </Modal>

      <Modal open={modal === "flood"} onClose={close} title="Flood & Stormwater Risk" icon={"\ud83c\udf0a"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
          {([{ l: "FEMA Zone", v: d.flood.femaZone }, { l: "CSO (1mi)", v: `${d.flood.csoPoints}`, good: d.flood.csoPoints === 0 }, { l: "SSO (2yr)", v: `${d.flood.ssoEvents}`, warn: d.flood.ssoEvents > 0 }, { l: "Last Overflow", v: d.flood.lastOverflow, mono: true }] as const).map((x, i) => (
            <div key={i} style={{ padding: "6px 8px", borderRadius: 6, background: 'warn' in x && x.warn ? "#FEF2F2" : "#F8FAFC", border: `1px solid ${'warn' in x && x.warn ? "#FECACA" : "#E2E8F0"}` }}><div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 1 }}>{x.l}</div><div style={{ fontSize: 12, fontWeight: 700, color: 'good' in x && x.good ? "#059669" : 'warn' in x && x.warn ? "#DC2626" : "#1E293B", fontFamily: 'mono' in x && x.mono ? "'DM Mono',monospace" : "'DM Sans',sans-serif" }}>{x.v}</div></div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 12 }}>{d.flood.detail}</p>
        {d.flood.nearby.length > 0 && <>
          <SectionLabel text="Nearby Overflow Events" />
          {d.flood.nearby.map((e, i) => (
            <div key={i} style={{ padding: 10, borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontWeight: 700, fontSize: 12, color: "#991B1B" }}>{e.type} {"\u2014"} {e.date}</span><span style={{ fontSize: 10, color: "#DC2626", fontFamily: "'DM Mono',monospace" }}>{e.distance}</span></div>
              <DetailRow label="Volume" value={e.volume} />
              <DetailRow label="Cause" value={e.cause} />
            </div>
          ))}
        </>}
      </Modal>
    </div>
  );
}
