"use client";
import { useState, useCallback } from "react";

// ── DATA ──────────────────────────────────────────────
const TIERS: Record<string, { label: string; icon: string; color: string; bg: string; desc: string }> = {
  T1: { label: "Regulatory", icon: "🛡️", color: "#1B6B3A", bg: "#D1FAE5", desc: "EPA/USGS/state agency certified data" },
  T2: { label: "Research", icon: "🧪", color: "#1565C0", bg: "#DBEAFE", desc: "University/accredited research institution" },
  T3: { label: "Community", icon: "👥", color: "#E65100", bg: "#FED7AA", desc: "QA/QC-trained volunteer monitoring" },
  T4: { label: "Observational", icon: "👁️", color: "#757575", bg: "#E2E8F0", desc: "Unverified reports — contextual only" },
};

function TierBadge({ tier, small }: { tier: string; small?: boolean }) {
  const t = TIERS[tier];
  if (!t) return null;
  return (
    <span title={`${t.label}: ${t.desc}`} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: small ? "1px 5px" : "2px 7px", borderRadius: 4, fontSize: small ? 8 : 9, fontWeight: 700, background: t.bg, color: t.color, border: `1px solid ${t.color}33`, cursor: "help", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
      <span style={{ fontSize: small ? 8 : 10 }}>{t.icon}</span>{t.label}
    </span>
  );
}

const INDICES = [
  { id: 1, name: "PEARL Load Velocity", domain: "Environmental Dynamics", score: 22, weight: 12, insight: "Pollutant loading is accelerating — not stable. DO depression worsening at 3.2% annually despite upstream WWTP upgrade. Current trajectory crosses critical threshold within 18 months." },
  { id: 2, name: "Infrastructure Failure Probability", domain: "Infrastructure Risk", score: 18, weight: 10, insight: "Upstream CSO infrastructure at 87% capacity utilization. Force main serving this watershed segment is 42 years old (design life: 50). SSO probability during >2\" rainfall event: 73%." },
  { id: 3, name: "Watershed Recovery Rate", domain: "Ecological Resilience", score: 31, weight: 8, insight: "Impervious surface cover at 34% — above the 25% threshold where self-recovery becomes unlikely without intervention. Riparian buffer gaps on 2.1 miles of tributary." },
  { id: 4, name: "Permit Risk Exposure", domain: "Regulatory Compliance", score: 22, weight: 9, insight: "E. coli TMDL only 23% toward 65% reduction target with 2029 deadline. At current pace, target will be missed by 27 percentage points. Enforcement escalation probable." },
  { id: 5, name: "Per Capita Load Contribution", domain: "Source Attribution", score: 25, weight: 5, insight: "Per-capita pollutant contribution 2.3x state median due to aging septic density (14.2 systems/sq mi) and limited sewer extension." },
  { id: 6, name: "Waterfront Value Exposure", domain: "Economic Risk", score: 35, weight: 7, insight: "Properties within 0.5 mi of impaired waterbodies showing 8-12% value discount vs comparable properties in non-impaired watersheds. Gap widening since 2021." },
  { id: 7, name: "WQ Economic Impact", domain: "Economic Analysis", score: 28, weight: 6, insight: "Estimated $4.2M/yr in economic impact from impairments: recreational loss, treatment cost escalation, property value depression, and compliance overhead across the watershed." },
  { id: 8, name: "Ecological Health Dependency", domain: "Ecosystem Services", score: 19, weight: 5, insight: "Benthic macroinvertebrate IBI at 2.1 (poor). Fish tissue advisories active. Ecosystem services (flood attenuation, nutrient cycling) degraded — replacement cost ~$1.8M/yr." },
  { id: 9, name: "EJ Vulnerability", domain: "Equity & Justice", score: 11, weight: 8, insight: "81st percentile minority, 68th percentile low-income. Any federal permit action triggers enhanced public notice under EO 12898. Project timelines should budget 60-90 additional days." },
  { id: 10, name: "Population Trajectory Impact", domain: "Growth Planning", score: 30, weight: 5, insight: "Service area population projected +12% by 2035. Without infrastructure expansion, per-capita loading will increase proportionally. Current WW capacity insufficient for projected growth." },
  { id: 11, name: "Political Accountability Exposure", domain: "Governance", score: 34, weight: 4, insight: "Three elected officials have direct regulatory authority over permits affecting this watershed. Two face re-election in 2026. Accountability score rising — political pressure for visible action increasing." },
  { id: 12, name: "Climate-WQ Compound Risk", domain: "Climate Resilience", score: 22, weight: 8, insight: "Projected 15% increase in >2\" rainfall events by 2040 (NOAA Atlas 14). Each event mobilizes ~340% more sediment and bacteria than baseflow. CSO/SSO frequency will increase proportionally." },
  { id: 13, name: "National Security WQ Threat", domain: "Security", score: 45, weight: 3, insight: "No military installations directly served. Aberdeen Proving Ground 28 mi downstream — contamination plume migration risk minimal at current distance." },
  { id: 14, name: "Cross-Media Pollution Transfer", domain: "Multi-Domain", score: 27, weight: 10, insight: "Stormwater runoff is primary bacteria vector into surface water. Surface water impairment is reducing groundwater recharge quality. Air deposition contributing 12% of nitrogen loading. Three domains interconnected." },
];

const PIN_SCORE = 28;

const USER_TYPES = [
  { id: "buyer", label: "Home Buyer", icon: "🏠" },
  { id: "developer", label: "Developer", icon: "🏗️" },
  { id: "insurer", label: "Insurer", icon: "📊" },
  { id: "lender", label: "Lender", icon: "🏦" },
  { id: "agent", label: "RE Agent", icon: "🔑" },
];

const USER_NARRATIVES: Record<string, { headline: string; bullets: string[]; risk: string; action: string }> = {
  buyer: {
    headline: "This property has significant water quality risks that may affect your health, property value, and future costs.",
    bullets: [
      "Surface water near your property is impaired for bacteria (E. coli) at levels unsafe for recreational contact. Children and pets should avoid direct water contact.",
      "The drinking water system serving this address has zero violations and no PFAS detected — your tap water is currently safe.",
      "Property values within 0.5 miles of impaired waterbodies are trending 8-12% below comparable properties in cleaner watersheds. This gap is widening.",
      "The area's aging infrastructure (42-year-old force main, septic density 2.3x state median) means sewage overflow risk during heavy rain is elevated. This happened in August 2024, 1.8 miles away.",
      "A mandatory TMDL cleanup is underway but significantly behind schedule (23% of 65% target with 2029 deadline). Expect increased stormwater fees and potential special assessments.",
      "Environmental justice designation (81st percentile minority) means any major construction project nearby will require extended public review — expect construction delays in the area.",
    ],
    risk: "Moderate-High",
    action: "Request seller disclosure of any known water quality issues. Budget for potential stormwater fee increases. Consider water testing before closing."
  },
  developer: {
    headline: "This site presents manageable but significant water quality regulatory constraints that will affect project timeline and cost.",
    bullets: [
      "MS4 Phase II jurisdiction: post-construction BMPs required for disturbance >5,000 sq ft. On-site retention, water quality treatment, and channel protection volume standards apply.",
      "Construction General Permit EXPIRED (June 2025). New CGP required with approved E&SC and SWM plans BEFORE any ground disturbance >1 acre. Violations: $37,500/day.",
      "Active E. coli TMDL with Waste Load Allocations — your project's stormwater discharge must demonstrate consistency with TMDL targets. This will require enhanced BMPs beyond minimum code.",
      "EJ designation (81st percentile minority, 68th low-income): federal permit actions trigger enhanced public notice under EO 12898. Budget 60-90 additional days for NEPA/state review.",
      "Total Phosphorus TMDL in development (draft Q2 2026). If adopted before your permit issuance, additional nutrient management requirements will apply retroactively to active permits.",
      "Cross-media analysis shows stormwater is the primary bacteria vector. Your project's stormwater management plan will face heightened scrutiny from MDE given TMDL non-attainment.",
    ],
    risk: "High Regulatory",
    action: "Engage environmental counsel before site plan submission. Pre-application meeting with MDE recommended. Budget 15-25% above standard BMP costs for enhanced treatment. PFAS site screening recommended given proximity to industrial legacy land uses."
  },
  insurer: {
    headline: "This property sits in a watershed with compounding risk factors: aging infrastructure, regulatory non-attainment, climate exposure, and environmental justice sensitivity.",
    bullets: [
      "Infrastructure Failure Probability Score: 18/100 (Critical). Force main is 42 years old at 87% capacity. SSO probability during >2\" rain: 73%. Climate projections show 15% increase in qualifying events by 2040.",
      "PEARL Load Velocity accelerating at 3.2%/yr despite mitigation. Pollutant trajectory crossing critical threshold within 18 months — expect regulatory escalation and potential mandatory remediation assessments.",
      "TMDL non-attainment (23% of 65% target, 2029 deadline) signals probable enforcement action. MS4 permittees in this watershed face compliance cost escalation of $2-4M over next 5 years.",
      "Waterfront Value Exposure Score: 35/100. Properties near impaired waters showing 8-12% discount widening YoY. Portfolio concentration risk if multiple insured properties in this HUC-8.",
      "Climate-WQ Compound Risk Score: 22/100 (Critical). Each >2\" rain event mobilizes 340% more contaminants. Flood Zone X designation may understate actual water damage risk from non-flood water intrusion events.",
      "Cross-Media transfer active across 3 domains. Stormwater→surface→groundwater contamination pathway means a single infrastructure failure cascades across coverage categories.",
    ],
    risk: "Elevated — Compound",
    action: "Consider water damage rider pricing adjustment. Flag for portfolio concentration review if >5 policies in HUC-8 02060003. Monitor TMDL enforcement actions as leading indicator for claims frequency."
  },
  lender: {
    headline: "Collateral at this address faces water quality-related value risk from regulatory, infrastructure, and environmental justice factors.",
    bullets: [
      "Property value exposure: 8-12% discount in impaired watershed vs comparables. Waterfront Value Exposure Score 35/100 with negative trajectory. Appraisal should account for environmental risk discount.",
      "Regulatory risk to collateral value: TMDL non-attainment likely to trigger increased stormwater fees, special assessments, or mandatory connection fees as municipality pursues compliance.",
      "Infrastructure risk: 42-year force main at 87% capacity serving this area. Major infrastructure failure would trigger emergency assessment and potential temporary condemnation of affected properties.",
      "Environmental justice designation adds project delay risk for any renovation/redevelopment requiring federal permits. Enhanced public notice adds 60-90 days to permit timelines.",
      "Construction General Permit expired — any borrower planning renovation involving land disturbance >1 acre must obtain new CGP before work begins. Non-compliance penalties up to $37,500/day could impair borrower's ability to service debt.",
      "Climate compound risk: increasing extreme precipitation events will stress aging infrastructure further. Long-term (20-30 year) collateral value trajectory is negative absent major public infrastructure investment.",
    ],
    risk: "Moderate Collateral Risk",
    action: "Request Phase I ESA if not already completed. Consider environmental risk in LTV calculation. Monitor municipal capital improvement plans for infrastructure investment commitments."
  },
  agent: {
    headline: "Key disclosure items and talking points for this property's water quality profile.",
    bullets: [
      "Drinking water is clean — zero violations, no PFAS. Lead at this: strong positive disclosure point.",
      "Surface water impairment is the main concern. E. coli levels exceed recreational contact standards. If property has creek access or is marketed for outdoor recreation, disclose advisory status.",
      "Flood risk is minimal (FEMA Zone X). This is a positive selling point relative to many comparable properties.",
      "Stormwater fees may increase. The watershed's TMDL is behind schedule and the municipality will likely need to invest more in compliance — those costs get passed to property owners.",
      "EJ designation is informational. It doesn't affect the property directly but means any nearby development will face extended review timelines — could affect neighborhood development pace.",
      "The expired Construction General Permit doesn't affect the current property owner, but if the buyer plans additions or significant landscaping involving >1 acre, they'll need a new permit.",
    ],
    risk: "Moderate — Disclosure Required",
    action: "Prepare water quality disclosure addendum. Emphasize clean drinking water as positive. Disclose surface water advisory. Have PIN report available for buyer's review."
  },
};

const RISKS = [
  { param: "Pathogens (E. coli)", cat: "EPA Category 5", severity: "high" as const, tier: "T1", detail: "Waterbody impaired. E. coli exceeds 126 CFU/100mL geometric mean in 78% of samples (2019–2024). Sources: aging septic, urban stormwater, agriculture.", samples: 142, exceedances: 111, lastSample: "2024-09-12", threshold: "126 CFU/100mL", pinInsight: "PEARL Load Velocity shows bacterial loading accelerating 3.2%/yr. At current trajectory, the 2029 TMDL target will be missed by 27 percentage points. Infrastructure Failure Probability connects this to upstream CSO capacity at 87% — a single force main failure would spike readings 400-600% above baseline." },
  { param: "Nutrients (Total Phosphorus)", cat: "EPA Category 4a", severity: "moderate" as const, tier: "T1", detail: "TMDL completed or in development. Phosphorus exceeds 0.05 mg/L target seasonally. Eutrophication risk moderate.", samples: 89, exceedances: 34, lastSample: "2024-08-28", threshold: "0.05 mg/L", pinInsight: "Cross-Media Pollution Transfer analysis shows phosphorus loading has three concurrent sources: agricultural runoff (42%), aging septic leachate (31%), and atmospheric deposition (12%). Single-source remediation strategies will fail — integrated watershed approach required." },
  { param: "Sediment / Siltation", cat: "EPA Category 2", severity: "low" as const, tier: "T1", detail: "Attaining some uses but insufficient data for full assessment. Episodic sedimentation during high-flow events.", samples: 56, exceedances: 8, lastSample: "2024-07-15", threshold: "Narrative criteria", pinInsight: "Climate-WQ Compound Risk projects 15% increase in >2\" rainfall by 2040, each event mobilizing 340% more sediment. Current 'low' severity likely to escalate to 'moderate' within 5-7 years without intervention at tributary restoration sites." },
];

const TMDLS = [
  { param: "E. coli", wla: "126 CFU/100mL", status: "Approved (2019)", approved: true, tier: "T1", reductionTarget: "65%", achieved: "23%", deadline: "2029", pinInsight: "At the current 4.6%/yr reduction rate, this TMDL will reach only 46% by deadline. Permit Risk Exposure Score of 22 reflects high probability of enforcement escalation — expect supplemental monitoring requirements and potential mandatory BMP installation orders for MS4 permittees." },
  { param: "Total Phosphorus", wla: "TBD", status: "In Development", approved: false, tier: "T1", reductionTarget: "TBD", achieved: "N/A", deadline: "Draft Q2 2026", pinInsight: "Once adopted, this TMDL will impose WLAs on all NPDES permittees in the watershed retroactively. Per Capita Load Contribution analysis shows residential septic systems contributing 31% of phosphorus — expect pressure for mandatory sewer connection in areas currently served by septic." },
];

const PERMITS = [
  { type: "NPDES General", id: "MDG01-1234", status: "Active", expiry: "2027-03-15", tier: "T1", detail: "Industrial stormwater. 2022–2027 cycle. Quarterly visual, annual analytical, SWPPP required.", conditions: ["Quarterly visual monitoring", "Annual benchmark sampling", "SWPPP maintenance", "Annual report by March 1"] },
  { type: "MS4 Phase II", id: "MDR10-0041", status: "Active", expiry: "2026-12-01", tier: "T1", detail: "Six MCMs: public ed, public involvement, IDDE, construction runoff, post-construction SWM, pollution prevention.", conditions: ["6 MCM implementation", "Annual report to MDE", "20% impervious restoration", "IDDE program"] },
  { type: "Construction General", id: "MDR10-9921", status: "Expired", expiry: "2025-06-30", tier: "T1", detail: "EXPIRED. New CGP with E&SC and SWM plans required BEFORE ground disturbance >1 acre. Penalties up to $37,500/day.", conditions: ["EXPIRED — Renewal required", "E&SC Plan", "SWM Plan", "NOI before disturbance"] },
];

const DRINKING = {
  system: "Carroll County DPW", pwsid: "MD0060015", violations: 0, pfas: "Not Detected", leadLines: "0.2%", tier: "T1",
  detail: "Served by Carroll County DPW. Blend of Prettyboy & Liberty Reservoirs. ~42,000 connections. No violations in 3 years. All 6 EPA-regulated PFAS compounds below detection in Q1 2025.",
  params: [
    { name: "Lead (90th %ile)", value: "4.2 ppb", limit: "15 ppb" },
    { name: "Copper (90th %ile)", value: "0.31 ppm", limit: "1.3 ppm" },
    { name: "Total THMs", value: "42 ppb", limit: "80 ppb" },
    { name: "Haloacetic Acids", value: "28 ppb", limit: "60 ppb" },
    { name: "Nitrate", value: "1.8 ppm", limit: "10 ppm" },
  ]
};

const TRENDS = [
  { param: "Dissolved Oxygen", delta: +8.2, direction: "up" as const, tier: "T1", readings: [5.8,6.0,6.1,6.4,6.6], pinInsight: "Improvement attributed to WWTP upgrade. However, PEARL Load Velocity shows the rate of improvement is decelerating — gains from point-source fixes are plateauing. Further improvement requires nonpoint source intervention." },
  { param: "E. coli", delta: -15.4, direction: "down" as const, tier: "T1", readings: [98,102,108,110,113], pinInsight: "Worsening despite TMDL implementation. Infrastructure Failure Probability analysis identifies the primary driver: 14.2 septic systems/sq mi with average age 28 years. Until septic-to-sewer conversion occurs, bacteria loading will continue increasing." },
  { param: "Total Nitrogen", delta: +1.1, direction: "flat" as const, tier: "T1", readings: [2.4,2.4,2.5,2.4,2.4], pinInsight: "Agricultural BMPs in headwaters are exactly offsetting new development loading. Net zero progress. Population Trajectory Impact projects +12% growth by 2035 — without additional intervention, nitrogen will begin increasing." },
  { param: "Turbidity", delta: +12, direction: "up" as const, tier: "T2", readings: [18.2,17.8,17.1,16.8,16.2], pinInsight: "Stream restoration at two confluences is working. Watershed Recovery Rate confirms improvement in channel stability. Climate projections suggest these gains are durable unless impervious surface exceeds 40%." },
];

const EJ = { index: 72, lowIncome: 68, minority: 81, linguistic: 24, tier: "T1",
  pinInsight: "The combination of 81st percentile minority population and 72nd percentile EJ Index means this area meets the threshold for enhanced public participation under EPA's EJ screening methodology. Any project requiring federal permits, federal funding, or NEPA review will require extended public notice and comment periods. Budget 60-90 additional days for any permitting action.",
  supplemental: [
    { label: "PM2.5", value: "67th", flag: false }, { label: "Diesel PM", value: "74th", flag: true },
    { label: "Traffic", value: "82nd", flag: true }, { label: "Wastewater", value: "71st", flag: true },
    { label: "Superfund", value: "31st", flag: false }, { label: "Haz Waste", value: "56th", flag: false },
  ]
};

const FLOOD = { femaZone: "Zone X (Minimal)", csoPoints: 0, ssoEvents: 1, lastOverflow: "2024-08-14", tier: "T1",
  pinInsight: "FEMA Zone X designation addresses fluvial flooding only. PIN's Infrastructure Failure Probability Score identifies a different risk vector: non-flood water intrusion from SSO/CSO events during extreme precipitation. The August 2024 SSO (12,000 gal, force main failure, 2.5\" rain) demonstrates this risk is not theoretical. Climate projections show 15% increase in qualifying rainfall events by 2040.",
  nearby: [{ type: "SSO", date: "2024-08-14", volume: "12,000 gal", cause: "Force main failure (age: 42 yrs)", distance: "1.8 mi" }]
};

const CROSS_DOMAIN = [
  { from: "Stormwater", to: "Surface Water", mechanism: "Urban runoff is the primary bacteria and sediment transport vector. Each 1\" rain event flushes accumulated pollutants from 34% impervious surface into receiving waters.", severity: "critical" as const },
  { from: "Surface Water", to: "Groundwater", mechanism: "Impaired surface water is reducing groundwater recharge quality. Properties on wells within 0.5 mi of impaired streams show elevated nitrate in 23% of samples.", severity: "moderate" as const },
  { from: "Infrastructure", to: "All Domains", mechanism: "Aging force main (42 yrs) and septic density (14.2/sq mi) create dual-vector contamination pathway. Infrastructure failure cascades across surface, ground, and drinking water domains simultaneously.", severity: "high" as const },
  { from: "Climate", to: "All Domains", mechanism: "Projected 15% increase in >2\" events by 2040 amplifies every existing pathway. Each qualifying event mobilizes 340% more contaminants than baseflow.", severity: "high" as const },
];

// ── COMPONENTS ──────────────────────────────────────
const sev: Record<string, { bg: string; border: string; text: string; dot: string }> = { high: { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444" }, moderate: { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", dot: "#F59E0B" }, low: { bg: "#D1FAE5", border: "#6EE7B7", text: "#065F46", dot: "#10B981" }, critical: { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444" } };

function Pill({ label, color }: { label: string; color: string }) {
  const s = sev[color] || sev.low;
  return <span style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px 2px 6px",borderRadius:16,fontSize:10,fontWeight:700,background:s.bg,color:s.text,border:`1px solid ${s.border}`,textTransform:"uppercase",letterSpacing:"0.03em" }}><span style={{width:5,height:5,borderRadius:"50%",background:s.dot}}/>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const c = status === "Active" ? { bg:"#D1FAE5",text:"#065F46",border:"#6EE7B7" } : { bg:"#FEE2E2",text:"#991B1B",border:"#FCA5A5" };
  return <span style={{padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700,background:c.bg,color:c.text,border:`1px solid ${c.border}`}}>{status}</span>;
}

function TrendArrow({ delta, direction }: { delta: number; direction: string }) {
  const color = direction === "up" ? "#059669" : direction === "down" ? "#DC2626" : "#6B7280";
  const a = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  return <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:12,color}}>{a} {delta>0?"+":""}{delta}%</span>;
}

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1, w = 72, h = 24, pad = 3;
  const pts = data.map((v, i) => `${pad + (i / (data.length - 1)) * (w - pad * 2)},${h - pad - ((v - mn) / range) * (h - pad * 2)}`).join(" ");
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>{data.map((v, i) => i === data.length - 1 ? <circle key={i} cx={pad + (i / (data.length - 1)) * (w - pad * 2)} cy={h - pad - ((v - mn) / range) * (h - pad * 2)} r="2.5" fill={color}/> : null)}</svg>;
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

function InsightBox({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "linear-gradient(135deg, #0F172A, #1E3A5F)", border: "1px solid #334155" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#60A5FA", letterSpacing: "0.05em" }}>PIN INTELLIGENCE</span>
      </div>
      <p style={{ fontSize: 11, color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>{text}</p>
    </div>
  );
}

function Card({ title, icon, children, span2, accent, onClick }: { title: string; icon: string; children: React.ReactNode; span2?: boolean; accent?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",gridColumn:span2?"span 2":"span 1",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",cursor:onClick?"pointer":"default",transition:"box-shadow 0.2s,transform 0.15s"}} onMouseEnter={e=>{if(onClick){e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.12)";e.currentTarget.style.transform="translateY(-1px)"}}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.06)";e.currentTarget.style.transform="translateY(0)"}}>
      {accent&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent,borderRadius:"12px 12px 0 0"}}/>}
      <div style={{padding:"10px 14px 7px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #F1F5F9"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14}}>{icon}</span><span style={{fontWeight:700,fontSize:10,color:"#334155",letterSpacing:"0.03em",textTransform:"uppercase"}}>{title}</span></div>
        {onClick&&<span style={{fontSize:9,color:"#3B82F6",fontWeight:600}}>Details →</span>}
      </div>
      <div style={{padding:"8px 14px 12px",flex:1}}>{children}</div>
    </div>
  );
}

function Modal({ open, onClose, title, icon, accent, children }: { open: boolean; onClose: () => void; title: string; icon: string; accent?: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(15,23,42,0.6)",backdropFilter:"blur(4px)"}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:"#fff",borderRadius:16,width:"92%",maxWidth:660,maxHeight:"85vh",overflow:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>
        {accent&&<div style={{height:4,background:accent,borderRadius:"16px 16px 0 0"}}/>}
        <div style={{padding:"14px 18px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #F1F5F9",position:"sticky",top:0,background:"#fff",zIndex:2}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>{icon}</span><span style={{fontWeight:800,fontSize:15,color:"#1E293B"}}>{title}</span></div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:"1px solid #E2E8F0",background:"#F8FAFC",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",color:"#64748B"}}>✕</button>
        </div>
        <div style={{padding:"14px 18px 22px"}}>{children}</div>
      </div>
    </div>
  );
}

function SL({ text }: { text: string }) {
  return <div style={{fontSize:9,fontWeight:700,color:"#94A3B8",letterSpacing:"0.08em",textTransform:"uppercase",marginTop:12,marginBottom:5}}>{text}</div>;
}

// ── SCORE GAUGE ──────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => s < 30 ? "#EF4444" : s < 50 ? "#F59E0B" : s < 70 ? "#EAB308" : s < 85 ? "#22C55E" : "#3B82F6";
  const getLabel = (s: number) => s < 30 ? "SEVERE" : s < 50 ? "POOR" : s < 70 ? "FAIR" : s < 85 ? "GOOD" : "EXCELLENT";
  const color = getColor(score);
  const angle = -90 + (score / 100) * 180;
  const r = 58, cx = 70, cy = 64;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={140} height={80} viewBox="0 0 140 80">
        <defs>
          <linearGradient id="arcBg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#EF4444" stopOpacity="0.15"/><stop offset="35%" stopColor="#F59E0B" stopOpacity="0.15"/><stop offset="65%" stopColor="#22C55E" stopOpacity="0.15"/><stop offset="100%" stopColor="#3B82F6" stopOpacity="0.15"/></linearGradient>
        </defs>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="url(#arcBg)" strokeWidth="10" strokeLinecap="round"/>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(angle * Math.PI / 180)} ${cy + r * Math.sin(angle * Math.PI / 180)}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"/>
        <circle cx={cx + r * Math.cos(angle * Math.PI / 180)} cy={cy + r * Math.sin(angle * Math.PI / 180)} r="5" fill={color} stroke="#fff" strokeWidth="2"/>
        <text x={cx} y={cy - 10} textAnchor="middle" style={{ fontSize: 28, fontWeight: 800, fill: "#1E293B", fontFamily: "'DM Mono', monospace" }}>{score}</text>
        <text x={cx} y={cy + 6} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: color, letterSpacing: "0.1em", fontFamily: "'DM Sans', sans-serif" }}>{getLabel(score)}</text>
      </svg>
    </div>
  );
}

// ── INDEX BAR ──────────────────────────────────────
function IndexBar({ index, onClick }: { index: typeof INDICES[number]; onClick: () => void }) {
  const color = index.score < 30 ? "#EF4444" : index.score < 50 ? "#F59E0B" : index.score < 70 ? "#22C55E" : "#3B82F6";
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", cursor: "pointer" }} title={index.insight}>
      <span style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600, width: 14, textAlign: "right", flexShrink: 0 }}>{index.id}</span>
      <span style={{ fontSize: 9, fontWeight: 600, color: "#475569", width: 130, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{index.name}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#F1F5F9", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${index.score}%`, borderRadius: 3, background: `linear-gradient(90deg, ${color}88, ${color})` }}/>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color, fontFamily: "'DM Mono',monospace", width: 22, textAlign: "right", flexShrink: 0 }}>{index.score}</span>
      <span style={{ fontSize: 8, color: "#94A3B8", width: 20, flexShrink: 0, textAlign: "right" }}>{index.weight}%</span>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────
export default function SitePropertyIntelligence() {
  const [query, setQuery] = useState("416 n houcksville road 21074");
  const [modal, setModal] = useState<string | null>(null);
  const [userType, setUserType] = useState("buyer");
  const open = useCallback((id: string) => setModal(id), []);
  const close = useCallback(() => setModal(null), []);
  const narrative = USER_NARRATIVES[userType];

  const summaryItems = [
    { label: "Surface Water", score: "High", color: "#EF4444", bg: "#FEE2E2" },
    { label: "Drinking Water", score: "Low", color: "#10B981", bg: "#D1FAE5" },
    { label: "Stormwater", score: "Moderate", color: "#F59E0B", bg: "#FEF3C7" },
    { label: "Flood Risk", score: "Minimal", color: "#10B981", bg: "#D1FAE5" },
    { label: "EJ Concern", score: "Elevated", color: "#F59E0B", bg: "#FEF3C7" },
  ];

  const exportPDF = useCallback(() => {
    const w = window.open("", "_blank");
    if (!w) return;
    const now = new Date();
    const ds = now.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
    const ts = now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
    const n = USER_NARRATIVES[userType];
    const ut = USER_TYPES.find(u=>u.id===userType);
    const idxRows = INDICES.map(ix => { const c=ix.score<30?"#EF4444":ix.score<50?"#F59E0B":ix.score<70?"#22C55E":"#3B82F6"; return `<tr><td style="padding:4px 8px;border-bottom:1px solid #F1F5F9;font-size:10px;color:#94A3B8;text-align:right;width:20px">${ix.id}</td><td style="padding:4px 8px;border-bottom:1px solid #F1F5F9;font-weight:600;font-size:11px">${ix.name}</td><td style="padding:4px 8px;border-bottom:1px solid #F1F5F9;width:200px"><div style="height:6px;border-radius:3px;background:#F1F5F9"><div style="height:6px;border-radius:3px;width:${ix.score}%;background:${c}"></div></div></td><td style="padding:4px 8px;border-bottom:1px solid #F1F5F9;font-family:monospace;font-weight:800;color:${c};text-align:right;width:30px">${ix.score}</td><td style="padding:4px 8px;border-bottom:1px solid #F1F5F9;font-size:10px;color:#94A3B8;width:30px">${ix.weight}%</td></tr>`; }).join("");
    const riskRows = RISKS.map(r=>`<div style="margin-bottom:12px;padding:12px;border-radius:8px;background:${sev[r.severity].bg}44;border:1px solid ${sev[r.severity].border}44"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><strong>${r.param}</strong> <span style="font-size:10px">${TIERS[r.tier].icon} ${TIERS[r.tier].label}</span></div><p style="font-size:11px;color:#475569;margin:4px 0">${r.detail}</p><div style="margin-top:6px;padding:8px;border-radius:6px;background:#0F172A;color:#CBD5E1;font-size:10px;line-height:1.5"><strong style="color:#60A5FA;font-size:9px;letter-spacing:0.05em">PIN INTELLIGENCE</strong><br>${r.pinInsight}</div></div>`).join("");
    const trendRows = TRENDS.map(t=>{const c=t.direction==="up"?"#059669":t.direction==="down"?"#DC2626":"#6B7280";const a=t.direction==="up"?"↑":t.direction==="down"?"↓":"→";return `<div style="margin-bottom:10px;padding:10px;border-radius:8px;background:#F8FAFC;border:1px solid #E2E8F0"><div style="display:flex;justify-content:space-between"><strong style="font-size:12px">${t.param}</strong><span style="font-family:monospace;font-weight:700;color:${c}">${a} ${t.delta>0?"+":""}${t.delta}%</span></div><p style="font-size:10px;color:#475569;margin:4px 0">${TIERS[t.tier].icon} ${TIERS[t.tier].label}</p><div style="margin-top:4px;padding:6px 8px;border-radius:6px;background:#0F172A;color:#CBD5E1;font-size:10px;line-height:1.5"><strong style="color:#60A5FA;font-size:9px">PIN</strong> ${t.pinInsight}</div></div>`;}).join("");
    const crossRows = CROSS_DOMAIN.map(c=>`<div style="padding:8px 10px;border-radius:6px;background:${sev[c.severity].bg}44;border:1px solid ${sev[c.severity].border}44;margin-bottom:6px"><strong style="font-size:11px">${c.from} → ${c.to}</strong><p style="font-size:10px;color:#475569;margin:3px 0 0">${c.mechanism}</p></div>`).join("");
    const sumBoxes = summaryItems.map(s=>`<div style="flex:1;text-align:center;padding:12px 6px;border-radius:8px;background:${s.bg}"><div style="font-size:16px;font-weight:800;color:${s.color}">${s.score}</div><div style="font-size:8px;font-weight:700;color:#64748B;margin-top:2px;text-transform:uppercase">${s.label}</div></div>`).join("");
    const narrativeBullets = n.bullets.map(b=>`<li style="margin-bottom:6px;font-size:11px;color:#475569;line-height:1.5">${b}</li>`).join("");

    w.document.write(`<!DOCTYPE html><html><head><title>PIN Site Report — ${"416 N Houcksville Road 21074"}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;color:#1E293B}@media print{@page{size:letter;margin:0.5in 0.6in}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.nb{page-break-inside:avoid}}
.hdr{background:linear-gradient(135deg,#0F172A,#1E3A5F);color:#fff;padding:20px 24px;border-radius:0 0 12px 12px}
.sec{margin:14px 0;page-break-inside:avoid}.sec h2{font-size:12px;font-weight:800;color:#1B3A5C;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:5px;border-bottom:2px solid #1B3A5C;margin-bottom:8px}
table{width:100%;border-collapse:collapse}th{background:#F1F5F9;padding:5px 8px;text-align:left;font-weight:700;font-size:9px;text-transform:uppercase;color:#64748B;border-bottom:2px solid #E2E8F0}
.ft{margin-top:16px;padding:12px 0;border-top:2px solid #1B3A5C;display:flex;justify-content:space-between;font-size:8px;color:#94A3B8}
</style></head><body>
<div class="hdr">
<div style="display:flex;justify-content:space-between;align-items:center">
<div><div style="font-size:18px;font-weight:800">Water Quality Site Report</div><div style="font-size:10px;color:#94A3B8;margin-top:2px">416 N Houcksville Road 21074 · HUC-8: 02060003 · Patapsco River Watershed</div></div>
<div style="text-align:right"><div style="font-size:20px;font-weight:800;color:#60A5FA">PIN</div><div style="font-size:9px;color:#94A3B8">PEARL Intelligence Network</div></div>
</div>
<div style="display:flex;gap:8px;margin-top:12px;align-items:center">
<div style="text-align:center;padding:8px 16px;background:rgba(255,255,255,0.1);border-radius:8px;border:1px solid rgba(255,255,255,0.15)"><div style="font-size:28px;font-weight:800;font-family:'DM Mono',monospace;color:#F8FAFC">${PIN_SCORE}</div><div style="font-size:8px;font-weight:700;color:#EF4444;letter-spacing:0.1em">SEVERE</div><div style="font-size:8px;color:#94A3B8;margin-top:2px">PIN Water Score</div></div>
<div style="flex:1;display:flex;gap:6px">${sumBoxes}</div>
</div>
</div>

<div class="sec nb" style="margin-top:12px;padding:14px;border-radius:10px;background:#EFF6FF;border:1px solid #93C5FD">
<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span style="font-size:14px">${ut?.icon}</span><span style="font-size:12px;font-weight:800;color:#1E40AF">WHAT THIS MEANS FOR YOU: ${ut?.label.toUpperCase()}</span><span style="padding:2px 8px;border-radius:4px;background:${n.risk.includes("High")?"#FEE2E2":"#FEF3C7"};color:${n.risk.includes("High")?"#991B1B":"#92400E"};font-size:10px;font-weight:700">${n.risk}</span></div>
<p style="font-size:12px;font-weight:600;color:#1E40AF;margin-bottom:8px">${n.headline}</p>
<ul style="padding-left:18px">${narrativeBullets}</ul>
<div style="margin-top:8px;padding:8px 10px;background:#1E40AF;border-radius:6px;color:#fff;font-size:11px"><strong>Recommended Action:</strong> ${n.action}</div>
</div>

<div class="sec nb"><h2>PIN Water Score — 14 Index Analysis</h2><table>${idxRows}</table></div>
<div class="sec nb"><h2>Waterbody Risk Profile</h2>${riskRows}</div>
<div class="sec nb"><h2>5-Year Trends with PIN Analysis</h2>${trendRows}</div>
<div class="sec nb"><h2>Cross-Domain Risk Connections</h2>${crossRows}</div>
<div class="sec nb"><h2>Permits</h2>${PERMITS.map(p=>`<div style="padding:8px;border-radius:6px;background:${p.status==="Expired"?"#FEF2F2":"#F8FAFC"};border:1px solid ${p.status==="Expired"?"#FCA5A5":"#E2E8F0"};margin-bottom:6px"><div style="display:flex;justify-content:space-between"><strong>${p.type}</strong><span style="font-family:monospace;color:#3B82F6;font-size:11px">${p.id} · ${p.status} · ${p.expiry}</span></div><p style="font-size:10px;color:#475569;margin-top:3px">${p.detail}</p></div>`).join("")}</div>
<div class="sec nb"><h2>Drinking Water</h2><p style="font-size:11px;color:#475569;margin-bottom:6px">${DRINKING.detail}</p><table><tr><th>Parameter</th><th>Result</th><th>MCL</th><th>Status</th></tr>${DRINKING.params.map(p=>`<tr><td style="padding:5px 8px;border-bottom:1px solid #E2E8F0;font-size:11px">${p.name}</td><td style="padding:5px 8px;border-bottom:1px solid #E2E8F0;font-family:monospace;font-weight:600">${p.value}</td><td style="padding:5px 8px;border-bottom:1px solid #E2E8F0;font-family:monospace;color:#94A3B8">${p.limit}</td><td style="padding:5px 8px;border-bottom:1px solid #E2E8F0;color:#059669;font-weight:700">✓</td></tr>`).join("")}</table></div>
<div class="sec nb"><h2>Flood & Stormwater</h2><p style="font-size:11px;color:#475569">${FLOOD.detail}</p><div style="margin-top:6px;padding:8px;border-radius:6px;background:#0F172A;color:#CBD5E1;font-size:10px"><strong style="color:#60A5FA;font-size:9px">PIN</strong> ${FLOOD.pinInsight}</div></div>

<div class="ft"><div><strong style="color:#1B3A5C;font-size:10px">PIN</strong> PEARL Intelligence Network · pinwater.org · 430M+ datapoints · 14 indices · 5 domains</div><div>${ds} ${ts} · PIN-${Date.now().toString(36).toUpperCase()}</div></div>
<div style="margin-top:6px;padding:8px 12px;background:#F8FAFC;border-radius:6px;border:1px solid #E2E8F0;font-size:8px;color:#94A3B8;line-height:1.5"><strong>Disclaimer:</strong> Generated from publicly available data by PIN. Sources: EPA ATTAINS, ECHO, SDWIS, USGS NWIS, FEMA NFHL, EPA EJScreen. PIN Intelligence interpretations are modeled estimates using proprietary indices. Not legal, environmental, or real estate advice. © ${now.getFullYear()} Local Seafood Projects Inc.</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }, [userType, summaryItems]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F0F4F8 0%, #E8ECF1 100%)", fontFamily: "'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F172A 100%)", padding: "14px 0 18px", borderBottom: "3px solid #3B82F6" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #3B82F6, #1D4ED8)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 15 }}>📍</span></div>
            <div><div style={{ color: "#F8FAFC", fontWeight: 800, fontSize: 15 }}>Site & Property Intelligence</div><div style={{ color: "#94A3B8", fontSize: 10 }}>PIN Water Score · 14 Indices · All Five Domains · 430M+ Datapoints</div></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1, padding: "9px 14px", borderRadius: 8, border: "2px solid #334155", background: "#1E293B", color: "#F8FAFC", fontSize: 13, fontWeight: 500, outline: "none" }} />
            <button style={{ padding: "9px 18px", borderRadius: 8, background: "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#fff", fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(59,130,246,0.4)" }}>Assess Site</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        {/* LOCATION */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #CBD5E1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981" }} /><span style={{ fontWeight: 700, fontSize: 12, color: "#1E293B" }}>416 N Houcksville Road 21074</span><span style={{ color: "#94A3B8", fontSize: 10, marginLeft: 4 }}>HUC-8: 02060003 · Patapsco River Watershed</span></div>
          <button style={{ fontSize: 10, color: "#64748B", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear</button>
        </div>

        {/* PIN WATER SCORE + SUMMARY */}
        <div style={{ margin: "10px 0", padding: "14px 16px", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 10, color: "#334155", letterSpacing: "0.03em", textTransform: "uppercase" }}>PIN Water Score</span>
              <TierBadge tier="T1" small />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={exportPDF} style={{ padding: "4px 12px", borderRadius: 6, background: "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(59,130,246,0.3)" }}>📄 Download Report</button>
              <button style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", color: "#64748B", fontSize: 10, fontWeight: 700, border: "1px solid #CBD5E1", cursor: "pointer" }}>Share</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, alignItems: "start" }}>
            {/* GAUGE */}
            <div>
              <ScoreGauge score={PIN_SCORE} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 4 }}>
                {summaryItems.slice(0, 4).map((s, i) => (
                  <div key={i} style={{ textAlign: "center", padding: "4px 2px", borderRadius: 5, background: s.bg + "88" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: s.color }}>{s.score}</div>
                    <div style={{ fontSize: 7, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* 14 INDICES */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>14-Index Breakdown</div>
              {INDICES.map((ix) => <IndexBar key={ix.id} index={ix} onClick={() => open("idx-" + ix.id)} />)}
            </div>
          </div>
        </div>

        {/* USER TYPE SELECTOR */}
        <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
          {USER_TYPES.map(u => (
            <button key={u.id} onClick={() => setUserType(u.id)} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: userType === u.id ? "2px solid #3B82F6" : "1px solid #E2E8F0", background: userType === u.id ? "#EFF6FF" : "#fff", cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ fontSize: 14 }}>{u.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: userType === u.id ? "#1D4ED8" : "#64748B", marginTop: 2 }}>{u.label}</div>
            </button>
          ))}
        </div>

        {/* NARRATIVE */}
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", border: "1px solid #93C5FD", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 12 }}>{USER_TYPES.find(u=>u.id===userType)?.icon}</span>
            <span style={{ fontWeight: 800, fontSize: 11, color: "#1E40AF" }}>WHAT THIS MEANS FOR YOU</span>
            <span style={{ padding: "1px 7px", borderRadius: 4, background: narrative.risk.includes("High") ? "#FEE2E2" : "#FEF3C7", color: narrative.risk.includes("High") ? "#991B1B" : "#92400E", fontSize: 9, fontWeight: 700 }}>{narrative.risk}</span>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#1E40AF", marginBottom: 6, lineHeight: 1.4 }}>{narrative.headline}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {narrative.bullets.map((b, i) => (
              <div key={i} style={{ padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,0.7)", border: "1px solid #BFDBFE", fontSize: 10, color: "#334155", lineHeight: 1.4 }}>
                <span style={{ fontWeight: 700, color: "#1D4ED8", marginRight: 4 }}>{i + 1}.</span>{b}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "#1E40AF", color: "#fff", fontSize: 10 }}>
            <strong>Recommended:</strong> {narrative.action}
          </div>
        </div>

        {/* CARD GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingBottom: 32 }}>
          {/* RISK */}
          <Card title="Waterbody Risk" icon="⚠️" accent="#EF4444" onClick={() => open("risk")}>
            {RISKS.map((r, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 7px", borderRadius: 6, background: sev[r.severity].bg + "66", border: `1px solid ${sev[r.severity].border}44` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <TierBadge tier={r.tier} small />
                    <div><div style={{ fontWeight: 700, fontSize: 10, color: "#1E293B" }}>{r.param}</div><div style={{ fontSize: 9, color: "#64748B" }}>{r.cat}</div></div>
                  </div>
                  <Pill label={r.severity} color={r.severity} />
                </div>
                <InsightBox text={r.pinInsight} />
              </div>
            ))}
          </Card>

          {/* CROSS-DOMAIN */}
          <Card title="Cross-Domain Connections" icon="🔗" accent="#7C3AED" onClick={() => open("cross")}>
            {CROSS_DOMAIN.map((c, i) => (
              <div key={i} style={{ padding: "6px 8px", borderRadius: 6, background: sev[c.severity].bg + "44", border: `1px solid ${sev[c.severity].border}44`, marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: 10, color: "#1E293B" }}>{c.from}</span>
                  <span style={{ fontSize: 10, color: "#94A3B8" }}>→</span>
                  <span style={{ fontWeight: 800, fontSize: 10, color: "#1E293B" }}>{c.to}</span>
                  <Pill label={c.severity} color={c.severity} />
                </div>
                <p style={{ fontSize: 9, color: "#475569", lineHeight: 1.4, margin: 0 }}>{c.mechanism}</p>
              </div>
            ))}
          </Card>

          {/* TRENDS */}
          <Card title="5-Year Trends" icon="📈" onClick={() => open("trends")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {TRENDS.map((t, i) => (
                <div key={i} style={{ padding: "6px 7px", borderRadius: 6, background: t.direction==="down"?"#FEF2F2":t.direction==="up"?"#F0FDF4":"#F8FAFC", border: `1px solid ${t.direction==="down"?"#FECACA":t.direction==="up"?"#BBF7D0":"#E2E8F0"}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}><TierBadge tier={t.tier} small /><span style={{ fontWeight: 700, fontSize: 10 }}>{t.param}</span></div>
                    <TrendArrow delta={t.delta} direction={t.direction} />
                  </div>
                  <MiniSpark data={t.readings} color={t.direction==="down"?"#DC2626":t.direction==="up"?"#059669":"#6B7280"} />
                </div>
              ))}
            </div>
          </Card>

          {/* REGULATORY */}
          <Card title="Regulatory Exposure" icon="📋" accent="#3B82F6" onClick={() => open("reg")}>
            <SL text="Active TMDLs" />
            {TMDLS.map((t, i) => (
              <div key={i} style={{ padding: "4px 6px", borderRadius: 5, background: "#F8FAFC", border: "1px solid #E2E8F0", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}><TierBadge tier={t.tier} small /><span style={{ fontWeight: 700, fontSize: 10 }}>{t.param}</span></div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: t.approved?"#065F46":"#3730A3", background: t.approved?"#D1FAE5":"#E0E7FF", padding: "1px 5px", borderRadius: 3 }}>{t.status}</span>
                </div>
                {t.approved && <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                  <span style={{ fontSize: 9, color: "#94A3B8" }}>Target: <strong style={{ color: "#1E293B" }}>{t.reductionTarget}</strong></span>
                  <span style={{ fontSize: 9, color: "#DC2626" }}>Achieved: <strong>{t.achieved}</strong></span>
                  <span style={{ fontSize: 9, color: "#94A3B8" }}>Deadline: <strong style={{ color: "#1E293B" }}>{t.deadline}</strong></span>
                </div>}
              </div>
            ))}
          </Card>

          {/* PERMITS */}
          <Card title="Permits" icon="📄" onClick={() => open("permits")}>
            {PERMITS.map((pr, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px", borderRadius: 5, background: pr.status==="Expired"?"#FEF2F2":"#F8FAFC", border: `1px solid ${pr.status==="Expired"?"#FECACA":"#E2E8F0"}`, marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><TierBadge tier={pr.tier} small /><div><div style={{ fontWeight: 700, fontSize: 10 }}>{pr.type}</div><div style={{ fontSize: 9, color: "#3B82F6", fontFamily: "'DM Mono',monospace" }}>{pr.id}</div></div></div>
                <div style={{ textAlign: "right" }}><StatusBadge status={pr.status} /><div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono',monospace", marginTop: 1 }}>{pr.expiry}</div></div>
              </div>
            ))}
          </Card>

          {/* DRINKING */}
          <Card title="Drinking Water" icon="🚰" accent="#10B981" onClick={() => open("drinking")}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}><TierBadge tier={DRINKING.tier} small /><span style={{ fontSize: 10, fontWeight: 600, color: "#059669" }}>Zero violations · No PFAS · {DRINKING.leadLines} lead lines</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              {DRINKING.params.slice(0, 3).map((p, i) => (
                <div key={i} style={{ padding: "4px 6px", borderRadius: 4, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{p.name}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", fontFamily: "'DM Mono',monospace" }}>{p.value} <span style={{ fontSize: 8, color: "#94A3B8", fontWeight: 500 }}>/ {p.limit}</span></div>
                </div>
              ))}
            </div>
          </Card>

          {/* EJ */}
          <Card title="EJ Vulnerability" icon="👥" accent="#F59E0B" onClick={() => open("ej")}>
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}><EjBar value={EJ.index} label="EJ INDEX" warn /><EjBar value={EJ.lowIncome} label="LOW INC" warn /><EjBar value={EJ.minority} label="MINORITY" warn /><EjBar value={EJ.linguistic} label="LING" warn /></div>
            <InsightBox text={EJ.pinInsight} />
          </Card>

          {/* FLOOD */}
          <Card title="Flood & Stormwater" icon="🌊" onClick={() => open("flood")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 4 }}>
              {[{l:"FEMA",v:FLOOD.femaZone},{l:"CSO",v:`${FLOOD.csoPoints}`,good:true},{l:"SSO (2yr)",v:`${FLOOD.ssoEvents}`,warn:FLOOD.ssoEvents>0},{l:"Last",v:FLOOD.lastOverflow,mono:true}].map((x,i)=>(
                <div key={i} style={{padding:"4px 6px",borderRadius:4,background:x.warn?"#FEF2F2":"#F8FAFC",border:`1px solid ${x.warn?"#FECACA":"#E2E8F0"}`}}>
                  <div style={{fontSize:8,fontWeight:700,color:"#94A3B8",textTransform:"uppercase"}}>{x.l}</div>
                  <div style={{fontSize:11,fontWeight:700,color:x.good?"#059669":x.warn?"#DC2626":"#1E293B",fontFamily:x.mono?"'DM Mono',monospace":"'DM Sans',sans-serif"}}>{x.v}</div>
                </div>
              ))}
            </div>
            <InsightBox text={FLOOD.pinInsight} />
          </Card>
        </div>
      </div>

      {/* MODALS */}
      {INDICES.map(ix => (
        <Modal key={ix.id} open={modal === "idx-" + ix.id} onClose={close} title={ix.name} icon="📊" accent={ix.score<30?"#EF4444":ix.score<50?"#F59E0B":"#22C55E"}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ textAlign: "center", padding: "10px 16px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0" }}><div style={{ fontSize: 28, fontWeight: 800, color: ix.score<30?"#EF4444":ix.score<50?"#F59E0B":"#22C55E", fontFamily: "'DM Mono',monospace" }}>{ix.score}</div><div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700 }}>SCORE</div></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>{ix.domain}</div><div style={{ fontSize: 9, color: "#64748B", marginTop: 2 }}>Weight: {ix.weight}% of composite PIN Water Score</div><div style={{ height: 8, borderRadius: 4, background: "#F1F5F9", marginTop: 8 }}><div style={{ height: 8, borderRadius: 4, width: `${ix.score}%`, background: ix.score<30?"#EF4444":ix.score<50?"#F59E0B":"#22C55E" }} /></div></div>
          </div>
          <InsightBox text={ix.insight} />
        </Modal>
      ))}

      <Modal open={modal==="risk"} onClose={close} title="Waterbody Risk Profile" icon="⚠️" accent="#EF4444">
        {RISKS.map((r,i) => (
          <div key={i} style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: sev[r.severity].bg+"44", border:`1px solid ${sev[r.severity].border}66` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><div style={{ display:"flex",alignItems:"center",gap:6 }}><span style={{fontWeight:800,fontSize:13}}>{r.param}</span><TierBadge tier={r.tier} /></div><Pill label={r.severity} color={r.severity} /></div>
            <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.5, marginBottom: 6 }}>{r.detail}</p>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:5 }}>
              {[{l:"Samples",v:r.samples},{l:"Exceed",v:r.exceedances,w:true},{l:"Threshold",v:r.threshold,m:true},{l:"Last",v:r.lastSample,m:true}].map((x,j)=>(
                <div key={j} style={{padding:"4px 6px",borderRadius:4,background:"#fff"}}><div style={{fontSize:8,fontWeight:700,color:"#94A3B8",textTransform:"uppercase"}}>{x.l}</div><div style={{fontSize:x.m?9:13,fontWeight:800,color:x.w?"#DC2626":"#1E293B",fontFamily:x.m?"'DM Mono',monospace":"'DM Sans',sans-serif"}}>{x.v}</div></div>
              ))}
            </div>
            <InsightBox text={r.pinInsight} />
          </div>
        ))}
      </Modal>

      <Modal open={modal==="cross"} onClose={close} title="Cross-Domain Risk Connections" icon="🔗" accent="#7C3AED">
        <p style={{ fontSize: 12, color: "#64748B", marginBottom: 12, lineHeight: 1.5 }}>PIN uniquely identifies how water quality risks cascade across domains. These connections are invisible in single-domain monitoring systems.</p>
        {CROSS_DOMAIN.map((c,i) => (
          <div key={i} style={{ padding: 12, borderRadius: 10, background: sev[c.severity].bg+"44", border:`1px solid ${sev[c.severity].border}66`, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: "#1E293B" }}>{c.from}</span><span style={{ color: "#94A3B8", fontSize: 14 }}>→</span><span style={{ fontWeight: 800, fontSize: 13, color: "#1E293B" }}>{c.to}</span><Pill label={c.severity} color={c.severity} />
            </div>
            <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.5, margin: 0 }}>{c.mechanism}</p>
          </div>
        ))}
      </Modal>

      <Modal open={modal==="trends"} onClose={close} title="5-Year Trends" icon="📈">
        {TRENDS.map((t,i)=>{ const color=t.direction==="down"?"#DC2626":t.direction==="up"?"#059669":"#6B7280"; return (
          <div key={i} style={{marginBottom:12,padding:10,borderRadius:8,background:"#F8FAFC",border:"1px solid #E2E8F0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontWeight:800,fontSize:13}}>{t.param}</span><TierBadge tier={t.tier} /></div><TrendArrow delta={t.delta} direction={t.direction}/></div>
            <MiniSpark data={t.readings} color={color}/>
            <div style={{display:"flex",gap:4,marginTop:4}}>{t.readings.map((v,j)=>(<div key={j} style={{flex:1,textAlign:"center",padding:"2px 0",borderRadius:4,background:"#fff",border:"1px solid #E2E8F0"}}><div style={{fontSize:7,color:"#94A3B8"}}>Yr{j+1}</div><div style={{fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{v}</div></div>))}</div>
            <InsightBox text={t.pinInsight} />
          </div>
        );})}
      </Modal>

      <Modal open={modal==="reg"} onClose={close} title="Regulatory Exposure" icon="📋" accent="#3B82F6">
        {TMDLS.map((t,i)=>(
          <div key={i} style={{marginBottom:12,padding:10,borderRadius:8,background:"#F8FAFC",border:"1px solid #E2E8F0"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontWeight:800,fontSize:13}}>{t.param}</span><TierBadge tier={t.tier}/></div><span style={{fontSize:10,fontWeight:700,color:t.approved?"#065F46":"#3730A3",background:t.approved?"#D1FAE5":"#E0E7FF",padding:"2px 7px",borderRadius:4}}>{t.status}</span></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:6}}>{[{l:"WLA",v:t.wla},{l:"Target",v:t.reductionTarget},{l:"Deadline",v:t.deadline}].map((x,j)=>(<div key={j} style={{padding:"4px 6px",borderRadius:4,background:"#fff",border:"1px solid #E2E8F0"}}><div style={{fontSize:8,fontWeight:700,color:"#94A3B8",textTransform:"uppercase"}}>{x.l}</div><div style={{fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{x.v}</div></div>))}</div>
            <InsightBox text={t.pinInsight} />
          </div>
        ))}
      </Modal>

      <Modal open={modal==="permits"} onClose={close} title="Permits" icon="📄">
        {PERMITS.map((pr,i)=>(
          <div key={i} style={{marginBottom:10,padding:10,borderRadius:8,background:pr.status==="Expired"?"#FEF2F266":"#F8FAFC",border:`1px solid ${pr.status==="Expired"?"#FCA5A5":"#E2E8F0"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontWeight:800,fontSize:13}}>{pr.type}</span><TierBadge tier={pr.tier}/></div><div style={{textAlign:"right"}}><StatusBadge status={pr.status}/><div style={{fontSize:10,color:"#64748B",fontFamily:"'DM Mono',monospace",marginTop:1}}>Exp: {pr.expiry}</div></div></div>
            <p style={{fontSize:11,color:"#475569",lineHeight:1.5,marginBottom:4}}>{pr.detail}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>{pr.conditions.map((c,j)=>(<span key={j} style={{padding:"2px 6px",borderRadius:4,fontSize:9,fontWeight:600,background:c.includes("EXPIRED")?"#FEE2E2":"#F1F5F9",color:c.includes("EXPIRED")?"#991B1B":"#475569",border:`1px solid ${c.includes("EXPIRED")?"#FCA5A5":"#E2E8F0"}`}}>{c}</span>))}</div>
          </div>
        ))}
      </Modal>

      <Modal open={modal==="drinking"} onClose={close} title="Drinking Water" icon="🚰" accent="#10B981">
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><TierBadge tier={DRINKING.tier}/><span style={{fontSize:11,fontWeight:600,color:"#059669"}}>Zero violations · PFAS: {DRINKING.pfas}</span></div>
        <p style={{fontSize:11,color:"#475569",lineHeight:1.5,marginBottom:10}}>{DRINKING.detail}</p>
        <SL text="Contaminant Results"/>
        {DRINKING.params.map((p,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #F1F5F9"}}>
            <span style={{fontSize:11,color:"#475569"}}>{p.name}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{p.value}</span><span style={{fontSize:9,color:"#94A3B8",fontFamily:"'DM Mono',monospace"}}>/ {p.limit}</span><span style={{color:"#059669",fontWeight:700,fontSize:10}}>✓</span></div>
          </div>
        ))}
      </Modal>

      <Modal open={modal==="ej"} onClose={close} title="EJ Vulnerability" icon="👥" accent="#F59E0B">
        <div style={{display:"flex",gap:10,marginBottom:12}}><EjBar value={EJ.index} label="EJ INDEX" warn/><EjBar value={EJ.lowIncome} label="LOW INCOME" warn/><EjBar value={EJ.minority} label="MINORITY" warn/><EjBar value={EJ.linguistic} label="LINGUISTIC" warn/></div>
        <InsightBox text={EJ.pinInsight}/>
        <SL text="Supplemental Indicators"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
          {EJ.supplemental.map((s,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 7px",borderRadius:5,background:s.flag?"#FEF2F2":"#F8FAFC",border:`1px solid ${s.flag?"#FECACA":"#E2E8F0"}`}}>
              <span style={{fontSize:10,color:"#475569"}}>{s.label}</span>
              <span style={{fontSize:10,fontWeight:700,color:s.flag?"#DC2626":"#1E293B",fontFamily:"'DM Mono',monospace"}}>{s.value}</span>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={modal==="flood"} onClose={close} title="Flood & Stormwater" icon="🌊">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
          {[{l:"FEMA Zone",v:FLOOD.femaZone},{l:"CSO (1mi)",v:`${FLOOD.csoPoints}`,good:true},{l:"SSO (2yr)",v:`${FLOOD.ssoEvents}`,warn:FLOOD.ssoEvents>0},{l:"Last Overflow",v:FLOOD.lastOverflow,mono:true}].map((x,i)=>(
            <div key={i} style={{padding:"6px 8px",borderRadius:6,background:x.warn?"#FEF2F2":"#F8FAFC",border:`1px solid ${x.warn?"#FECACA":"#E2E8F0"}`}}><div style={{fontSize:9,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",marginBottom:1}}>{x.l}</div><div style={{fontSize:12,fontWeight:700,color:x.good?"#059669":x.warn?"#DC2626":"#1E293B",fontFamily:x.mono?"'DM Mono',monospace":"'DM Sans',sans-serif"}}>{x.v}</div></div>
          ))}
        </div>
        <InsightBox text={FLOOD.pinInsight}/>
        {FLOOD.nearby.length>0&&<><SL text="Nearby Events"/>{FLOOD.nearby.map((e,i)=>(<div key={i} style={{padding:8,borderRadius:6,background:"#FEF2F2",border:"1px solid #FECACA"}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700,fontSize:11,color:"#991B1B"}}>{e.type} — {e.date}</span><span style={{fontSize:10,color:"#DC2626",fontFamily:"'DM Mono',monospace"}}>{e.distance}</span></div><div style={{fontSize:10,color:"#475569",marginTop:2}}>{e.volume} · {e.cause}</div></div>))}</>}
      </Modal>
    </div>
  );
}
