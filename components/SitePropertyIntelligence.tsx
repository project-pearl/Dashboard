"use client";
import { useState, useCallback } from "react";
import type { HucIndices, IndexScore, IndexId } from "@/lib/indices/types";
import type { WaterRiskScoreResult, CategoryKey } from "@/lib/waterRiskScore";

// ── API response shape ──────────────────────────────
interface ApiResponse extends WaterRiskScoreResult {
  location: { lat: number; lng: number; state: string; label: string; zip?: string; huc8?: string; hucDistance?: number };
  hucIndices: HucIndices | null;
  raw: {
    wqpRecords: { stn: string; name: string; date: string; key: string; char: string; val: number; unit: string; org: string; lat: number; lng: number }[];
    sdwis: { systems: { pwsid: string; name: string; type: string; population: number; sourceWater: string }[]; violations: { pwsid: string; contaminant: string; rule: string; isMajor: boolean; isHealthBased: boolean; compliancePeriod: string }[] } | null;
    icis: { permits: { permit: string; facility: string; status: string; type: string; expiration: string; flow: number | null }[]; violations: { permit: string; code: string; desc: string; date: string; rnc: boolean; severity: string }[] } | null;
    echo: { facilities: { registryId: string; name: string; complianceStatus: string; qtrsInViolation: number }[]; violations: { registryId: string; violationType: string; pollutant: string; qtrsInNc: number }[] } | null;
    pfas: { results: { facilityName: string; contaminant: string; resultValue: number | null; detected: boolean; sampleDate: string }[] } | null;
    tri: unknown[];
    ejscreen: Record<string, unknown> | null;
    attains: { impaired: number; total: number; topCauses: string[] } | null;
  };
  generatedAt: string;
}

// ── 9 real indices metadata ──────────────────────────
const INDEX_META: { id: IndexId; name: string; domain: string }[] = [
  { id: "pearlLoadVelocity", name: "PEARL Load Velocity", domain: "Environmental Dynamics" },
  { id: "infrastructureFailure", name: "Infrastructure Failure Probability", domain: "Infrastructure Risk" },
  { id: "watershedRecovery", name: "Watershed Recovery Rate", domain: "Ecological Resilience" },
  { id: "permitRiskExposure", name: "Permit Risk Exposure", domain: "Regulatory Compliance" },
  { id: "perCapitaLoad", name: "Per Capita Load Contribution", domain: "Source Attribution" },
  { id: "waterfrontExposure", name: "Waterfront Value Exposure", domain: "Economic Risk" },
  { id: "ecologicalHealth", name: "Ecological Health Dependency", domain: "Ecosystem Services" },
  { id: "ejVulnerability", name: "EJ Vulnerability", domain: "Equity & Justice" },
  { id: "governanceResponse", name: "Governance Response", domain: "Governance" },
];

// ── Tier definitions ──────────────────────────────
const TIERS: Record<string, { label: string; icon: string; color: string; bg: string; desc: string }> = {
  T1: { label: "Regulatory", icon: "\u{1F6E1}\uFE0F", color: "#1B6B3A", bg: "#D1FAE5", desc: "EPA/USGS/state agency certified data" },
  T2: { label: "Research", icon: "\u{1F9EA}", color: "#1565C0", bg: "#DBEAFE", desc: "University/accredited research institution" },
  T3: { label: "Community", icon: "\u{1F465}", color: "#E65100", bg: "#FED7AA", desc: "QA/QC-trained volunteer monitoring" },
  T4: { label: "Observational", icon: "\u{1F441}\uFE0F", color: "#757575", bg: "#E2E8F0", desc: "Unverified reports — contextual only" },
};

// ── User types ──────────────────────────────
const USER_TYPES = [
  { id: "buyer", label: "Home Buyer", icon: "\u{1F3E0}" },
  { id: "developer", label: "Developer", icon: "\u{1F3D7}\uFE0F" },
  { id: "insurer", label: "Insurer", icon: "\u{1F4CA}" },
  { id: "lender", label: "Lender", icon: "\u{1F3E6}" },
  { id: "agent", label: "RE Agent", icon: "\u{1F511}" },
];

// ── EJScreen parser ──────────────────────────────
interface EjData {
  index: number | null;
  lowIncome: number | null;
  minority: number | null;
  linguistic: number | null;
  pm25: number | null;
  diesel: number | null;
  traffic: number | null;
  wastewater: number | null;
  superfund: number | null;
  hazWaste: number | null;
}
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return isNaN(n) ? null : n;
}
function parseEj(data: Record<string, unknown> | null): EjData | null {
  if (!data) return null;
  const raw = (data.RAW_DATA as Record<string, unknown>) || data;
  const index = num(raw["EJINDEX"] || raw["P_LDPNT_D2"]);
  if (index === null) return null;
  return {
    index,
    lowIncome: (() => { const v = num(raw["LOWINCPCT"] || raw["P_LWINCPCT"]); return v !== null && v <= 1 ? Math.round(v * 100) : v; })(),
    minority: (() => { const v = num(raw["MINORPCT"] || raw["P_MINORITY"]); return v !== null && v <= 1 ? Math.round(v * 100) : v; })(),
    linguistic: (() => { const v = num(raw["LINGISOPCT"] || raw["P_LINGISOPCT"]); return v !== null && v <= 1 ? Math.round(v * 100) : v; })(),
    pm25: num(raw["P_PM25"] || raw["P_PM25_D2"]),
    diesel: num(raw["P_DSLPM"] || raw["P_DSLPM_D2"]),
    traffic: num(raw["P_PTRAF"] || raw["P_PTRAF_D2"]),
    wastewater: num(raw["P_DWATER"] || raw["D_DWATER_2"]),
    superfund: num(raw["P_PNPL"] || raw["P_PNPL_D2"]),
    hazWaste: num(raw["P_PTSDF"] || raw["P_PTSDF_D2"]),
  };
}

// ── Narrative generation ──────────────────────────────
interface Narrative { headline: string; bullets: string[]; risk: string; action: string }

function riskLabel(score: number): string {
  if (score >= 80) return "Low";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "Moderate-High";
  return "High";
}

function generateNarrative(userType: string, d: ApiResponse): Narrative {
  const score = d.composite.score;
  const violations = (d.raw.sdwis?.violations.length ?? 0) + (d.raw.icis?.violations.length ?? 0);
  const sdwisViols = d.raw.sdwis?.violations.length ?? 0;
  const pfasCount = d.raw.pfas?.results.length ?? 0;
  const impaired = d.raw.attains?.impaired ?? 0;
  const totalWaterbodies = d.raw.attains?.total ?? 0;
  const topCauses = d.raw.attains?.topCauses ?? [];
  const ej = parseEj(d.raw.ejscreen);
  const permits = d.raw.icis?.permits ?? [];
  const systems = d.raw.sdwis?.systems ?? [];
  const echoViols = d.raw.echo?.violations.length ?? 0;
  const triCount = Array.isArray(d.raw.tri) ? d.raw.tri.length : 0;
  const wqpCount = d.raw.wqpRecords.length;

  const drinkingSafe = sdwisViols === 0;
  const pfasClean = pfasCount === 0;
  const impairedPct = totalWaterbodies > 0 ? Math.round((impaired / totalWaterbodies) * 100) : 0;
  const risk = riskLabel(score);

  switch (userType) {
    case "buyer": return {
      headline: score >= 70
        ? "This property's water quality profile is generally favorable with some areas worth monitoring."
        : "This property has water quality concerns that may affect health, property value, and future costs.",
      bullets: [
        drinkingSafe
          ? `The drinking water system${systems.length > 0 ? ` (${systems[0].name})` : ""} has zero violations${pfasClean ? " and no PFAS detected" : ""} — your tap water is currently safe.`
          : `The drinking water system has ${sdwisViols} violation${sdwisViols !== 1 ? "s" : ""} on record. Review water quality reports before closing.`,
        totalWaterbodies > 0
          ? `${impairedPct}% of waterbodies in the state are impaired (${impaired} of ${totalWaterbodies}).${topCauses.length > 0 ? ` Top causes: ${topCauses.slice(0, 3).join(", ")}.` : ""}`
          : "No impairment data available for this watershed.",
        pfasCount > 0
          ? `PFAS has been detected at ${pfasCount} nearby location${pfasCount !== 1 ? "s" : ""}. Monitor EPA advisories for this area.`
          : "No PFAS detections reported in the immediate area.",
        violations > 0
          ? `${violations} total regulatory violation${violations !== 1 ? "s" : ""} recorded across water programs — this may indicate infrastructure or compliance challenges.`
          : "No regulatory violations found across water programs — a positive indicator.",
        ej && ej.index !== null && ej.index > 70
          ? `Environmental justice index is at the ${Math.round(ej.index)}th percentile — any nearby development may face extended public review.`
          : "Environmental justice indicators are within normal range for this area.",
        wqpCount > 0
          ? `${wqpCount} water quality monitoring records available for this area, providing good data coverage.`
          : "Limited water quality monitoring data available for this specific location.",
      ],
      risk,
      action: score >= 70
        ? "Standard due diligence recommended. Request recent water quality report from utility."
        : "Request seller disclosure of any known water quality issues. Budget for potential stormwater fee increases. Consider water testing before closing.",
    };

    case "developer": return {
      headline: score >= 70
        ? "This site has a favorable water quality regulatory profile with standard permitting requirements."
        : "This site presents significant water quality regulatory constraints that will affect project timeline and cost.",
      bullets: [
        permits.length > 0
          ? `${permits.length} active NPDES permit${permits.length !== 1 ? "s" : ""} in the area. Review permit conditions for stormwater requirements.`
          : "No active NPDES permits found in the immediate area.",
        totalWaterbodies > 0 && impaired > 0
          ? `${impairedPct}% waterbody impairment rate${topCauses.length > 0 ? ` (${topCauses[0]})` : ""} — your stormwater discharge must demonstrate consistency with TMDL targets.`
          : "No active impairments identified — standard BMP requirements likely apply.",
        ej && ej.index !== null && ej.index > 70
          ? `EJ designation (${Math.round(ej.index)}th percentile) — federal permit actions trigger enhanced public notice. Budget 60-90 additional days.`
          : "No elevated EJ concerns — standard permitting timelines apply.",
        violations > 0
          ? `${violations} violations in the watershed indicate heightened regulatory scrutiny. Expect enhanced BMP requirements.`
          : "Clean compliance record in this area — permitting should proceed normally.",
        echoViols > 0
          ? `${echoViols} ECHO enforcement violation${echoViols !== 1 ? "s" : ""} at nearby facilities — regulators are active in this area.`
          : "No nearby enforcement actions — regulators have low current activity in this area.",
        triCount > 0
          ? `${triCount} TRI facilit${triCount !== 1 ? "ies" : "y"} nearby. Environmental site assessment may be required.`
          : "No TRI facilities nearby — reduced contamination risk.",
      ],
      risk: score >= 70 ? "Standard Regulatory" : "High Regulatory",
      action: score >= 70
        ? "Standard permitting process. Pre-application meeting recommended but not critical."
        : "Engage environmental counsel before site plan submission. Pre-application meeting with regulators recommended. Budget 15-25% above standard BMP costs.",
    };

    case "insurer": return {
      headline: score >= 70
        ? "This property sits in an area with manageable water quality risk factors. Standard underwriting appropriate."
        : "This property sits in a watershed with compounding risk factors that may affect loss projections.",
      bullets: [
        `Composite Water Risk Score: ${score}/100 (${d.composite.letter}). ${score < 50 ? "Below threshold — enhanced review recommended." : score < 70 ? "Moderate — monitor trends." : "Acceptable range."}`,
        violations > 0
          ? `${violations} total violations across programs signal potential enforcement escalation and compliance cost increases.`
          : "Clean violation record reduces regulatory-driven loss probability.",
        pfasCount > 0
          ? `PFAS detected at ${pfasCount} nearby location${pfasCount !== 1 ? "s" : ""}. EPA limits may require treatment upgrades — potential for special assessment claims.`
          : "No PFAS detections — reduced emerging contaminant exposure.",
        totalWaterbodies > 0
          ? `Waterbody impairment rate: ${impairedPct}%.${impairedPct > 30 ? " Elevated impairment may correlate with property value depression in this watershed." : ""}`
          : "Insufficient impairment data for watershed risk assessment.",
        ej && ej.index !== null
          ? `EJ Index: ${Math.round(ej.index)}th percentile.${ej.index > 70 ? " High EJ designation means extended timelines for any infrastructure repairs." : ""}`
          : "EJ data not available for this location.",
        d.hucIndices?.infrastructureFailure
          ? `Infrastructure Failure Index: ${d.hucIndices.infrastructureFailure.value}/100 (${d.hucIndices.infrastructureFailure.trend}). ${d.hucIndices.infrastructureFailure.value > 60 ? "Elevated — non-flood water intrusion risk." : "Within acceptable range."}`
          : "Infrastructure index data not available.",
      ],
      risk: risk === "Low" ? "Standard" : risk === "Moderate" ? "Watch" : "Elevated — Compound",
      action: score >= 70
        ? "Standard underwriting. Annual monitoring recommended."
        : "Consider water damage rider pricing adjustment. Flag for portfolio concentration review. Monitor enforcement actions as leading indicator.",
    };

    case "lender": return {
      headline: score >= 70
        ? "Collateral at this address has a favorable water quality profile with minimal risk to value."
        : "Collateral at this address faces water quality-related value risk from regulatory, infrastructure, and environmental factors.",
      bullets: [
        `Water Risk Score: ${score}/100 (${d.composite.letter}). ${score < 60 ? "Below safe lending threshold — environmental risk may impair collateral value." : "Within acceptable range for standard lending."}`,
        violations > 0
          ? `${violations} regulatory violations — potential for increased stormwater fees, special assessments, or mandatory compliance costs affecting borrower's debt service capacity.`
          : "No regulatory violations — reduced risk of surprise environmental assessments.",
        totalWaterbodies > 0 && impairedPct > 20
          ? `${impairedPct}% waterbody impairment may contribute to environmental risk discount on property values in this watershed.`
          : "Low impairment rate — minimal environmental discount to property values.",
        pfasCount > 0
          ? `PFAS detected nearby — EPA's proposed limits may trigger treatment costs that could affect property values or utility assessments.`
          : "No PFAS detections — no emerging contaminant risk to collateral value.",
        ej && ej.index !== null && ej.index > 70
          ? `EJ designation adds project delay risk for any renovation requiring federal permits (+60-90 days).`
          : "No elevated EJ designation — standard permitting timelines for any renovation.",
        d.hucIndices?.composite !== undefined
          ? `HUC-8 composite index: ${d.hucIndices.composite}/100. ${d.hucIndices.composite < 40 ? "Poor watershed health may pressure long-term property values." : "Watershed health supports stable property values."}`
          : "Watershed index data not available for long-term value assessment.",
      ],
      risk: score >= 70 ? "Low Collateral Risk" : score >= 50 ? "Moderate Collateral Risk" : "Elevated Collateral Risk",
      action: score >= 70
        ? "Standard environmental due diligence sufficient."
        : "Request Phase I ESA if not already completed. Consider environmental risk in LTV calculation. Monitor municipal capital improvement plans.",
    };

    case "agent": return {
      headline: "Key disclosure items and talking points for this property's water quality profile.",
      bullets: [
        drinkingSafe
          ? `Drinking water is clean — ${sdwisViols === 0 ? "zero violations" : ""}${pfasClean ? ", no PFAS" : ""}. Lead with this as a strong positive disclosure point.`
          : `Drinking water system has ${sdwisViols} violation${sdwisViols !== 1 ? "s" : ""}. Disclose to buyer and recommend independent testing.`,
        totalWaterbodies > 0 && impairedPct > 20
          ? `Surface water impairment (${impairedPct}% of waterbodies) is a concern. If property has creek access, disclose advisory status.`
          : "Surface water quality is generally good — positive selling point for outdoor recreation.",
        violations > 0
          ? `${violations} regulatory violations on record. Stormwater fees may increase as the municipality pursues compliance.`
          : "Clean regulatory record — no anticipated stormwater fee increases from enforcement action.",
        ej && ej.index !== null && ej.index > 70
          ? `EJ designation (${Math.round(ej.index)}th percentile) — informational. May affect pace of nearby development.`
          : "No EJ designation concerns for this area.",
        `Overall Water Risk Score: ${score}/100 (${d.composite.letter}). ${score >= 70 ? "This is a favorable score you can share with prospective buyers." : "Be prepared to discuss water quality concerns with informed buyers."}`,
        wqpCount > 0
          ? `${wqpCount} monitoring records provide good transparency. Have the PIN report available for buyer review.`
          : "Limited monitoring data — recommend buyer conduct independent water quality assessment.",
      ],
      risk: score >= 70 ? "Low — Standard Disclosure" : "Moderate — Disclosure Required",
      action: score >= 70
        ? "Standard disclosure. Highlight clean water score as differentiator."
        : "Prepare water quality disclosure addendum. Emphasize clean drinking water as positive. Have PIN report available for buyer's review.",
    };

    default: return { headline: "", bullets: [], risk: "Unknown", action: "" };
  }
}

// ── Derive summary items from categories ──────────────
function deriveSummary(cats: Record<CategoryKey, { score: number; label: string }>) {
  const ratingColor = (s: number) => {
    if (s >= 70) return { rating: "Low", color: "#10B981", bg: "#D1FAE5" };
    if (s >= 50) return { rating: "Moderate", color: "#F59E0B", bg: "#FEF3C7" };
    return { rating: "High", color: "#EF4444", bg: "#FEE2E2" };
  };
  return [
    { label: "Water Quality", ...ratingColor(cats.waterQuality.score) },
    { label: "Infrastructure", ...ratingColor(cats.infrastructure.score) },
    { label: "Compliance", ...ratingColor(cats.compliance.score) },
    { label: "Contamination", ...ratingColor(cats.contamination.score) },
    { label: "EJ Concern", ...ratingColor(cats.environmentalJustice.score) },
  ];
}

// ── Derive cross-domain connections ──────────────────
function deriveCrossDomain(d: ApiResponse): { from: string; to: string; mechanism: string; severity: "critical" | "high" | "moderate" | "low" }[] {
  const items: { from: string; to: string; mechanism: string; severity: "critical" | "high" | "moderate" | "low" }[] = [];
  const violations = (d.raw.sdwis?.violations.length ?? 0) + (d.raw.icis?.violations.length ?? 0);
  const pfasCount = d.raw.pfas?.results.length ?? 0;
  const impaired = d.raw.attains?.impaired ?? 0;
  const echoViols = d.raw.echo?.violations.length ?? 0;
  const triCount = Array.isArray(d.raw.tri) ? d.raw.tri.length : 0;

  if (impaired > 0 && violations > 0) {
    items.push({
      from: "Surface Water", to: "Regulatory",
      mechanism: `${impaired} impaired waterbodies combined with ${violations} regulatory violations suggest systemic non-compliance driving environmental degradation.`,
      severity: violations > 5 ? "critical" : "high",
    });
  }
  if (pfasCount > 0 && (d.raw.sdwis?.systems.length ?? 0) > 0) {
    items.push({
      from: "Contamination", to: "Drinking Water",
      mechanism: `${pfasCount} PFAS detection${pfasCount !== 1 ? "s" : ""} near ${d.raw.sdwis?.systems.length ?? 0} drinking water system${(d.raw.sdwis?.systems.length ?? 0) !== 1 ? "s" : ""}. Potential contamination pathway to drinking water supply.`,
      severity: pfasCount > 3 ? "high" : "moderate",
    });
  }
  if (triCount > 0 && impaired > 0) {
    items.push({
      from: "Industrial", to: "Surface Water",
      mechanism: `${triCount} TRI facilit${triCount !== 1 ? "ies" : "y"} releasing chemicals in a watershed with ${impaired} impaired waterbodies — industrial discharge may compound existing impairment.`,
      severity: triCount > 3 ? "high" : "moderate",
    });
  }
  if (echoViols > 0 && (d.raw.icis?.violations.length ?? 0) > 0) {
    items.push({
      from: "Enforcement", to: "Permits",
      mechanism: `${echoViols} ECHO violation${echoViols !== 1 ? "s" : ""} and ${d.raw.icis?.violations.length ?? 0} NPDES violation${(d.raw.icis?.violations.length ?? 0) !== 1 ? "s" : ""} indicate active enforcement across programs.`,
      severity: "moderate",
    });
  }
  if (items.length === 0) {
    items.push({
      from: "All Domains", to: "Overall",
      mechanism: "No significant cross-domain risk connections identified. Data sources show independent, manageable risk levels.",
      severity: "low",
    });
  }
  return items;
}

// ── Derive risk profile from WQP + ATTAINS ──────────────
function deriveRisks(d: ApiResponse): { param: string; detail: string; severity: "high" | "moderate" | "low"; samples: number }[] {
  const risks: { param: string; detail: string; severity: "high" | "moderate" | "low"; samples: number }[] = [];
  // Group WQP records by parameter key
  const byKey: Record<string, { count: number; vals: number[] }> = {};
  for (const r of d.raw.wqpRecords) {
    if (!byKey[r.key]) byKey[r.key] = { count: 0, vals: [] };
    byKey[r.key].count++;
    byKey[r.key].vals.push(r.val);
  }
  const sorted = Object.entries(byKey).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
  for (const [key, info] of sorted) {
    const avg = info.vals.reduce((a, b) => a + b, 0) / info.vals.length;
    risks.push({
      param: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      detail: `${info.count} monitoring records. Average value: ${avg.toFixed(2)}.`,
      severity: info.count > 50 ? "moderate" : "low",
      samples: info.count,
    });
  }
  if (d.raw.attains && d.raw.attains.impaired > 0) {
    risks.unshift({
      param: `Impaired Waterbodies (${d.raw.attains.topCauses.slice(0, 2).join(", ") || "Multiple Causes"})`,
      detail: `${d.raw.attains.impaired} of ${d.raw.attains.total} waterbodies impaired (${Math.round((d.raw.attains.impaired / d.raw.attains.total) * 100)}%).`,
      severity: d.raw.attains.impaired / d.raw.attains.total > 0.3 ? "high" : "moderate",
      samples: d.raw.attains.total,
    });
  }
  return risks.slice(0, 4);
}

// ── VISUAL COMPONENTS (preserved from original) ──────────────────────────────
const sev: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  high: { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444" },
  moderate: { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", dot: "#F59E0B" },
  low: { bg: "#D1FAE5", border: "#6EE7B7", text: "#065F46", dot: "#10B981" },
  critical: { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444" },
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

function Pill({ label, color }: { label: string; color: string }) {
  const s = sev[color] || sev.low;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px 2px 6px", borderRadius: 16, fontSize: 10, fontWeight: 700, background: s.bg, color: s.text, border: `1px solid ${s.border}`, textTransform: "uppercase", letterSpacing: "0.03em" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "Active" || status === "Effective";
  const c = isActive ? { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" } : { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" };
  return <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{status}</span>;
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

function Card({ title, icon, children, span2, accent, onClick, empty }: { title: string; icon: string; children: React.ReactNode; span2?: boolean; accent?: string; onClick?: () => void; empty?: boolean }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", gridColumn: span2 ? "span 2" : "span 1", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", cursor: onClick ? "pointer" : "default", transition: "box-shadow 0.2s,transform 0.15s", opacity: empty ? 0.6 : 1 }} onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)"; e.currentTarget.style.transform = "translateY(-1px)"; } }} onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      {accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: "12px 12px 0 0" }} />}
      <div style={{ padding: "10px 14px 7px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F1F5F9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 14 }}>{icon}</span><span style={{ fontWeight: 700, fontSize: 10, color: "#334155", letterSpacing: "0.03em", textTransform: "uppercase" }}>{title}</span></div>
        {onClick && <span style={{ fontSize: 9, color: "#3B82F6", fontWeight: 600 }}>Details →</span>}
      </div>
      <div style={{ padding: "8px 14px 12px", flex: 1 }}>{children}</div>
    </div>
  );
}

function Modal({ open, onClose, title, icon, accent, children }: { open: boolean; onClose: () => void; title: string; icon: string; accent?: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }} />
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", background: "#fff", borderRadius: 16, width: "92%", maxWidth: 660, maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
        {accent && <div style={{ height: 4, background: accent, borderRadius: "16px 16px 0 0" }} />}
        <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F1F5F9", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 18 }}>{icon}</span><span style={{ fontWeight: 800, fontSize: 15, color: "#1E293B" }}>{title}</span></div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>✕</button>
        </div>
        <div style={{ padding: "14px 18px 22px" }}>{children}</div>
      </div>
    </div>
  );
}

function SL({ text }: { text: string }) {
  return <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 12, marginBottom: 5 }}>{text}</div>;
}

function EjBar({ value, label, warn }: { value: number | null; label: string; warn?: boolean }) {
  if (value === null) return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#CBD5E1" }}>—</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", marginTop: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
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
          <linearGradient id="arcBg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#EF4444" stopOpacity="0.15" /><stop offset="35%" stopColor="#F59E0B" stopOpacity="0.15" /><stop offset="65%" stopColor="#22C55E" stopOpacity="0.15" /><stop offset="100%" stopColor="#3B82F6" stopOpacity="0.15" /></linearGradient>
        </defs>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="url(#arcBg)" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(angle * Math.PI / 180)} ${cy + r * Math.sin(angle * Math.PI / 180)}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
        <circle cx={cx + r * Math.cos(angle * Math.PI / 180)} cy={cy + r * Math.sin(angle * Math.PI / 180)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
        <text x={cx} y={cy - 10} textAnchor="middle" style={{ fontSize: 28, fontWeight: 800, fill: "#1E293B", fontFamily: "'DM Mono', monospace" }}>{score}</text>
        <text x={cx} y={cy + 6} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: color, letterSpacing: "0.1em", fontFamily: "'DM Sans', sans-serif" }}>{getLabel(score)}</text>
      </svg>
    </div>
  );
}

// ── INDEX BAR (real data version) ──────────────────────
function IndexBar({ num: idx, name, domain, score, confidence, trend, onClick }: { num: number; name: string; domain: string; score: number; confidence: number; trend: string; onClick: () => void }) {
  const color = score < 30 ? "#EF4444" : score < 50 ? "#F59E0B" : score < 70 ? "#22C55E" : "#3B82F6";
  const trendIcon = trend === "improving" ? "\u2191" : trend === "declining" ? "\u2193" : "\u2192";
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", cursor: "pointer" }} title={`${domain} · Confidence: ${confidence}% · Trend: ${trend}`}>
      <span style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600, width: 14, textAlign: "right", flexShrink: 0 }}>{idx}</span>
      <span style={{ fontSize: 9, fontWeight: 600, color: "#475569", width: 130, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#F1F5F9", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${score}%`, borderRadius: 3, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color, fontFamily: "'DM Mono',monospace", width: 22, textAlign: "right", flexShrink: 0 }}>{score}</span>
      <span style={{ fontSize: 8, color: "#94A3B8", width: 16, flexShrink: 0, textAlign: "right" }}>{trendIcon}</span>
    </div>
  );
}

// ── NoData placeholder ──────────────────────────────
function NoData({ message }: { message?: string }) {
  return <div style={{ padding: "12px 0", textAlign: "center", fontSize: 11, color: "#94A3B8", fontStyle: "italic" }}>{message || "No data available for this location"}</div>;
}

// ── MAIN COMPONENT ──────────────────────────────────────
export default function SitePropertyIntelligence() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [userType, setUserType] = useState("buyer");
  const open = useCallback((id: string) => setModal(id), []);
  const close = useCallback(() => setModal(null), []);

  const fetchData = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      // Detect input type: zip (5 digits), lat/lng (contains comma + numbers), or address
      let url: string;
      if (/^\d{5}$/.test(trimmed)) {
        url = `/api/water-risk-score?zip=${trimmed}`;
      } else if (/^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(trimmed)) {
        const [lat, lng] = trimmed.split(",").map(s => s.trim());
        url = `/api/water-risk-score?lat=${lat}&lng=${lng}`;
      } else {
        url = `/api/water-risk-score?address=${encodeURIComponent(trimmed)}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => { fetchData(query); }, [fetchData, query]);

  // Derived data
  const narrative = data ? generateNarrative(userType, data) : null;
  const summaryItems = data ? deriveSummary(data.categories) : [];
  const crossDomain = data ? deriveCrossDomain(data) : [];
  const risks = data ? deriveRisks(data) : [];
  const ej = data ? parseEj(data.raw.ejscreen) : null;

  // Build index list from real HUC indices
  const indices: { id: IndexId; num: number; name: string; domain: string; score: IndexScore }[] = [];
  if (data?.hucIndices) {
    let n = 0;
    for (const meta of INDEX_META) {
      const val = data.hucIndices[meta.id] as IndexScore | undefined;
      if (val) {
        n++;
        indices.push({ id: meta.id, num: n, name: meta.name, domain: meta.domain, score: val });
      }
    }
  }

  // Permits from ICIS
  const permits = data?.raw.icis?.permits ?? [];

  // Drinking water
  const sdwisSystems = data?.raw.sdwis?.systems ?? [];
  const sdwisViols = data?.raw.sdwis?.violations ?? [];
  const pfasResults = data?.raw.pfas?.results ?? [];

  // PDF export with real data
  const exportPDF = useCallback(() => {
    if (!data) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const now = new Date();
    const ds = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const ts = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const n = generateNarrative(userType, data);
    const ut = USER_TYPES.find(u => u.id === userType);
    const sumItems = deriveSummary(data.categories);
    const riskItems = deriveRisks(data);

    const idxRows = indices.map(ix => {
      const c = ix.score.value < 30 ? "#EF4444" : ix.score.value < 50 ? "#F59E0B" : ix.score.value < 70 ? "#22C55E" : "#3B82F6";
      return `<tr><td style="padding:4px 8px;border-bottom:1px solid #F1F5F9;font-size:10px;color:#94A3B8;text-align:right;width:20px">${ix.num}</td><td style="padding:4px 8px;border-bottom:1px solid #F1F5F9;font-weight:600;font-size:11px">${ix.name}</td><td style="padding:4px 8px;border-bottom:1px solid #F1F5F9;width:200px"><div style="height:6px;border-radius:3px;background:#F1F5F9"><div style="height:6px;border-radius:3px;width:${ix.score.value}%;background:${c}"></div></div></td><td style="padding:4px 8px;border-bottom:1px solid #F1F5F9;font-family:monospace;font-weight:800;color:${c};text-align:right;width:30px">${ix.score.value}</td><td style="padding:4px 8px;border-bottom:1px solid #F1F5F9;font-size:10px;color:#94A3B8;width:50px">${ix.score.confidence}% conf</td></tr>`;
    }).join("");

    const riskRows = riskItems.map(r => `<div style="margin-bottom:12px;padding:12px;border-radius:8px;background:${sev[r.severity].bg}44;border:1px solid ${sev[r.severity].border}44"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><strong>${r.param}</strong><span style="font-size:10px;text-transform:uppercase;font-weight:700;color:${sev[r.severity].text}">${r.severity}</span></div><p style="font-size:11px;color:#475569;margin:4px 0">${r.detail}</p></div>`).join("");

    const sumBoxes = sumItems.map(s => `<div style="flex:1;text-align:center;padding:12px 6px;border-radius:8px;background:${s.bg}"><div style="font-size:16px;font-weight:800;color:${s.color}">${s.rating}</div><div style="font-size:8px;font-weight:700;color:#64748B;margin-top:2px;text-transform:uppercase">${s.label}</div></div>`).join("");
    const narrativeBullets = n.bullets.map(b => `<li style="margin-bottom:6px;font-size:11px;color:#475569;line-height:1.5">${b}</li>`).join("");

    const loc = data.location;
    const locLabel = loc.label || `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
    const hucLabel = loc.huc8 ? ` \u00B7 HUC-8: ${loc.huc8}` : "";

    w.document.write(`<!DOCTYPE html><html><head><title>PIN Site Report — ${locLabel}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;color:#1E293B}@media print{@page{size:letter;margin:0.5in 0.6in}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.nb{page-break-inside:avoid}}
.hdr{background:linear-gradient(135deg,#0F172A,#1E3A5F);color:#fff;padding:20px 24px;border-radius:0 0 12px 12px}
.sec{margin:14px 0;page-break-inside:avoid}.sec h2{font-size:12px;font-weight:800;color:#1B3A5C;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:5px;border-bottom:2px solid #1B3A5C;margin-bottom:8px}
table{width:100%;border-collapse:collapse}th{background:#F1F5F9;padding:5px 8px;text-align:left;font-weight:700;font-size:9px;text-transform:uppercase;color:#64748B;border-bottom:2px solid #E2E8F0}
.ft{margin-top:16px;padding:12px 0;border-top:2px solid #1B3A5C;display:flex;justify-content:space-between;font-size:8px;color:#94A3B8}
</style></head><body>
<div class="hdr">
<div style="display:flex;justify-content:space-between;align-items:center">
<div><div style="font-size:18px;font-weight:800">Water Quality Site Report</div><div style="font-size:10px;color:#94A3B8;margin-top:2px">${locLabel}${hucLabel}</div></div>
<div style="text-align:right"><div style="font-size:20px;font-weight:800;color:#60A5FA">PIN</div><div style="font-size:9px;color:#94A3B8">PEARL Intelligence Network</div></div>
</div>
<div style="display:flex;gap:8px;margin-top:12px;align-items:center">
<div style="text-align:center;padding:8px 16px;background:rgba(255,255,255,0.1);border-radius:8px;border:1px solid rgba(255,255,255,0.15)"><div style="font-size:28px;font-weight:800;font-family:'DM Mono',monospace;color:#F8FAFC">${data.composite.score}</div><div style="font-size:8px;font-weight:700;color:${data.composite.score < 30 ? "#EF4444" : data.composite.score < 50 ? "#F59E0B" : "#22C55E"};letter-spacing:0.1em">${data.composite.letter}</div><div style="font-size:8px;color:#94A3B8;margin-top:2px">PIN Water Score</div></div>
<div style="flex:1;display:flex;gap:6px">${sumBoxes}</div>
</div>
</div>

<div class="sec nb" style="margin-top:12px;padding:14px;border-radius:10px;background:#EFF6FF;border:1px solid #93C5FD">
<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span style="font-size:14px">${ut?.icon}</span><span style="font-size:12px;font-weight:800;color:#1E40AF">WHAT THIS MEANS FOR YOU: ${ut?.label.toUpperCase()}</span><span style="padding:2px 8px;border-radius:4px;background:${n.risk.includes("High") || n.risk.includes("Elevated") ? "#FEE2E2" : "#FEF3C7"};color:${n.risk.includes("High") || n.risk.includes("Elevated") ? "#991B1B" : "#92400E"};font-size:10px;font-weight:700">${n.risk}</span></div>
<p style="font-size:12px;font-weight:600;color:#1E40AF;margin-bottom:8px">${n.headline}</p>
<ul style="padding-left:18px">${narrativeBullets}</ul>
<div style="margin-top:8px;padding:8px 10px;background:#1E40AF;border-radius:6px;color:#fff;font-size:11px"><strong>Recommended Action:</strong> ${n.action}</div>
</div>

<div class="sec nb"><h2>PIN Water Score — ${indices.length} Index Analysis</h2><table>${idxRows}</table></div>
<div class="sec nb"><h2>Waterbody Risk Profile</h2>${riskRows}</div>

<div class="ft"><div><strong style="color:#1B3A5C;font-size:10px">PIN</strong> PEARL Intelligence Network · ${data.dataSources.length} data sources · ${indices.length} indices</div><div>${ds} ${ts} · PIN-${Date.now().toString(36).toUpperCase()}</div></div>
<div style="margin-top:6px;padding:8px 12px;background:#F8FAFC;border-radius:6px;border:1px solid #E2E8F0;font-size:8px;color:#94A3B8;line-height:1.5"><strong>Disclaimer:</strong> Generated from publicly available data by PIN. Sources: ${data.dataSources.join(", ")}. PIN Intelligence interpretations are modeled estimates. Not legal, environmental, or real estate advice. \u00A9 ${now.getFullYear()} Local Seafood Projects Inc.</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }, [data, userType, indices]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F0F4F8 0%, #E8ECF1 100%)", fontFamily: "'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F172A 100%)", padding: "14px 0 18px", borderBottom: "3px solid #3B82F6" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #3B82F6, #1D4ED8)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 15 }}>{"\u{1F4CD}"}</span></div>
            <div><div style={{ color: "#F8FAFC", fontWeight: 800, fontSize: 15 }}>Site Intelligence</div><div style={{ color: "#94A3B8", fontSize: 10 }}>PIN Water Score · 9 Indices · Five Domains · Real-Time Data</div></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Enter address, ZIP code, or lat,lng..."
              style={{ flex: 1, padding: "9px 14px", borderRadius: 8, border: "2px solid #334155", background: "#1E293B", color: "#F8FAFC", fontSize: 13, fontWeight: 500, outline: "none" }}
            />
            <button onClick={handleSearch} disabled={loading} style={{ padding: "9px 18px", borderRadius: 8, background: loading ? "#64748B" : "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#fff", fontWeight: 700, fontSize: 12, border: "none", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 2px 8px rgba(59,130,246,0.4)" }}>
              {loading ? "Analyzing..." : "Assess Site"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>

        {/* LOADING STATE */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ display: "inline-block", width: 40, height: 40, border: "4px solid #E2E8F0", borderTopColor: "#3B82F6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ marginTop: 12, fontSize: 13, color: "#64748B", fontWeight: 600 }}>Analyzing water quality data...</div>
            <div style={{ marginTop: 4, fontSize: 11, color: "#94A3B8" }}>Querying EPA databases, HUC-8 indices, and EJScreen</div>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div style={{ margin: "20px 0", padding: "16px 20px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#991B1B", marginBottom: 4 }}>Error</div>
            <div style={{ fontSize: 12, color: "#DC2626" }}>{error}</div>
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && !error && !data && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F4CD}"}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>Enter a Location to Assess</div>
            <div style={{ fontSize: 13, color: "#64748B", maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
              Search by street address, ZIP code, or latitude/longitude coordinates to generate a comprehensive water quality intelligence report.
            </div>
          </div>
        )}

        {/* DATA DISPLAY */}
        {data && !loading && (
          <>
            {/* LOCATION STRIP */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #CBD5E1" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981" }} />
                <span style={{ fontWeight: 700, fontSize: 12, color: "#1E293B" }}>{data.location.label}</span>
                <span style={{ color: "#94A3B8", fontSize: 10, marginLeft: 4 }}>
                  {data.location.huc8 ? `HUC-8: ${data.location.huc8}` : ""}{data.location.state ? ` · ${data.location.state}` : ""}
                </span>
              </div>
              <button onClick={() => { setData(null); setQuery(""); }} style={{ fontSize: 10, color: "#64748B", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear</button>
            </div>

            {/* PIN WATER SCORE + SUMMARY */}
            <div style={{ margin: "10px 0", padding: "14px 16px", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 10, color: "#334155", letterSpacing: "0.03em", textTransform: "uppercase" }}>PIN Water Score</span>
                  <TierBadge tier="T1" small />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={exportPDF} style={{ padding: "4px 12px", borderRadius: 6, background: "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(59,130,246,0.3)" }}>{"\u{1F4C4}"} Download Report</button>
                  <button style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", color: "#64748B", fontSize: 10, fontWeight: 700, border: "1px solid #CBD5E1", cursor: "pointer" }}>Share</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, alignItems: "start" }}>
                {/* GAUGE */}
                <div>
                  <ScoreGauge score={data.composite.score} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 4 }}>
                    {summaryItems.slice(0, 4).map((s, i) => (
                      <div key={i} style={{ textAlign: "center", padding: "4px 2px", borderRadius: 5, background: s.bg + "88" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: s.color }}>{s.rating}</div>
                        <div style={{ fontSize: 7, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* INDEX BARS */}
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>{indices.length}-Index Breakdown</div>
                  {indices.length > 0 ? indices.map((ix) => (
                    <IndexBar key={ix.id} num={ix.num} name={ix.name} domain={ix.domain} score={ix.score.value} confidence={ix.score.confidence} trend={ix.score.trend} onClick={() => open("idx-" + ix.id)} />
                  )) : <NoData message="No HUC-8 index data available" />}
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
            {narrative && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", border: "1px solid #93C5FD", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12 }}>{USER_TYPES.find(u => u.id === userType)?.icon}</span>
                  <span style={{ fontWeight: 800, fontSize: 11, color: "#1E40AF" }}>WHAT THIS MEANS FOR YOU</span>
                  <span style={{ padding: "1px 7px", borderRadius: 4, background: narrative.risk.includes("High") || narrative.risk.includes("Elevated") ? "#FEE2E2" : "#FEF3C7", color: narrative.risk.includes("High") || narrative.risk.includes("Elevated") ? "#991B1B" : "#92400E", fontSize: 9, fontWeight: 700 }}>{narrative.risk}</span>
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
            )}

            {/* CARD GRID */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingBottom: 32 }}>
              {/* RISK */}
              <Card title="Waterbody Risk" icon={"\u26A0\uFE0F"} accent="#EF4444" onClick={risks.length > 0 ? () => open("risk") : undefined} empty={risks.length === 0}>
                {risks.length > 0 ? risks.map((r, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 7px", borderRadius: 6, background: sev[r.severity].bg + "66", border: `1px solid ${sev[r.severity].border}44` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <TierBadge tier="T1" small />
                        <div><div style={{ fontWeight: 700, fontSize: 10, color: "#1E293B" }}>{r.param}</div><div style={{ fontSize: 9, color: "#64748B" }}>{r.samples} records</div></div>
                      </div>
                      <Pill label={r.severity} color={r.severity} />
                    </div>
                  </div>
                )) : <NoData />}
              </Card>

              {/* CROSS-DOMAIN */}
              <Card title="Cross-Domain Connections" icon={"\u{1F517}"} accent="#7C3AED" onClick={() => open("cross")}>
                {crossDomain.map((c, i) => (
                  <div key={i} style={{ padding: "6px 8px", borderRadius: 6, background: sev[c.severity].bg + "44", border: `1px solid ${sev[c.severity].border}44`, marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <span style={{ fontWeight: 800, fontSize: 10, color: "#1E293B" }}>{c.from}</span>
                      <span style={{ fontSize: 10, color: "#94A3B8" }}>{"\u2192"}</span>
                      <span style={{ fontWeight: 800, fontSize: 10, color: "#1E293B" }}>{c.to}</span>
                      <Pill label={c.severity} color={c.severity} />
                    </div>
                    <p style={{ fontSize: 9, color: "#475569", lineHeight: 1.4, margin: 0 }}>{c.mechanism}</p>
                  </div>
                ))}
              </Card>

              {/* REGULATORY / ATTAINS */}
              <Card title="Regulatory Exposure" icon={"\u{1F4CB}"} accent="#3B82F6" onClick={data.raw.attains ? () => open("reg") : undefined} empty={!data.raw.attains}>
                {data.raw.attains ? (
                  <>
                    <SL text="Impairment Summary" />
                    <div style={{ padding: "6px 8px", borderRadius: 6, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 11 }}>{data.raw.attains.impaired} of {data.raw.attains.total} waterbodies impaired</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: data.raw.attains.impaired / data.raw.attains.total > 0.3 ? "#DC2626" : "#F59E0B" }}>
                          {Math.round((data.raw.attains.impaired / data.raw.attains.total) * 100)}%
                        </span>
                      </div>
                      {data.raw.attains.topCauses.length > 0 && (
                        <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {data.raw.attains.topCauses.slice(0, 4).map((c, i) => (
                            <span key={i} style={{ padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" }}>{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : <NoData />}
              </Card>

              {/* PERMITS */}
              <Card title="Permits" icon={"\u{1F4C4}"} onClick={permits.length > 0 ? () => open("permits") : undefined} empty={permits.length === 0}>
                {permits.length > 0 ? permits.slice(0, 4).map((pr, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px", borderRadius: 5, background: pr.status === "Expired" ? "#FEF2F2" : "#F8FAFC", border: `1px solid ${pr.status === "Expired" ? "#FECACA" : "#E2E8F0"}`, marginBottom: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <TierBadge tier="T1" small />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 10 }}>{pr.type || "NPDES"}</div>
                        <div style={{ fontSize: 9, color: "#3B82F6", fontFamily: "'DM Mono',monospace" }}>{pr.permit}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <StatusBadge status={pr.status} />
                      <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono',monospace", marginTop: 1 }}>{pr.expiration}</div>
                    </div>
                  </div>
                )) : <NoData />}
              </Card>

              {/* DRINKING WATER */}
              <Card title="Drinking Water" icon={"\u{1F6B0}"} accent="#10B981" onClick={sdwisSystems.length > 0 ? () => open("drinking") : undefined} empty={sdwisSystems.length === 0 && pfasResults.length === 0}>
                {sdwisSystems.length > 0 || pfasResults.length > 0 ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                      <TierBadge tier="T1" small />
                      <span style={{ fontSize: 10, fontWeight: 600, color: sdwisViols.length === 0 ? "#059669" : "#DC2626" }}>
                        {sdwisViols.length === 0 ? "Zero violations" : `${sdwisViols.length} violation${sdwisViols.length !== 1 ? "s" : ""}`}
                        {pfasResults.length === 0 ? " · No PFAS" : ` · ${pfasResults.length} PFAS detection${pfasResults.length !== 1 ? "s" : ""}`}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {sdwisSystems.slice(0, 2).map((sys, i) => (
                        <div key={i} style={{ padding: "4px 6px", borderRadius: 4, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>System</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#1E293B" }}>{sys.name}</div>
                          <div style={{ fontSize: 8, color: "#94A3B8", fontFamily: "'DM Mono',monospace" }}>{sys.pwsid} · {sys.type}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <NoData />}
              </Card>

              {/* EJ */}
              <Card title="EJ Vulnerability" icon={"\u{1F465}"} accent="#F59E0B" onClick={ej ? () => open("ej") : undefined} empty={!ej}>
                {ej ? (
                  <>
                    <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                      <EjBar value={ej.index !== null ? Math.round(ej.index) : null} label="EJ INDEX" warn />
                      <EjBar value={ej.lowIncome} label="LOW INC" warn />
                      <EjBar value={ej.minority} label="MINORITY" warn />
                      <EjBar value={ej.linguistic} label="LING" warn />
                    </div>
                  </>
                ) : <NoData />}
              </Card>

              {/* FLOOD — no real data source */}
              <Card title="Flood & Stormwater" icon={"\u{1F30A}"} empty>
                <NoData message="Limited data available — FEMA/CSO/SSO data not currently in our data pipeline" />
              </Card>
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      {data && indices.map(ix => (
        <Modal key={ix.id} open={modal === "idx-" + ix.id} onClose={close} title={ix.name} icon={"\u{1F4CA}"} accent={ix.score.value < 30 ? "#EF4444" : ix.score.value < 50 ? "#F59E0B" : "#22C55E"}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ textAlign: "center", padding: "10px 16px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: ix.score.value < 30 ? "#EF4444" : ix.score.value < 50 ? "#F59E0B" : "#22C55E", fontFamily: "'DM Mono',monospace" }}>{ix.score.value}</div>
              <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700 }}>SCORE</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>{ix.domain}</div>
              <div style={{ fontSize: 9, color: "#64748B", marginTop: 2 }}>Confidence: {ix.score.confidence}% · Trend: {ix.score.trend} · Data points: {ix.score.dataPoints}</div>
              <div style={{ height: 8, borderRadius: 4, background: "#F1F5F9", marginTop: 8 }}>
                <div style={{ height: 8, borderRadius: 4, width: `${ix.score.value}%`, background: ix.score.value < 30 ? "#EF4444" : ix.score.value < 50 ? "#F59E0B" : "#22C55E" }} />
              </div>
            </div>
          </div>
          <InsightBox text={`${ix.name} index is at ${ix.score.value}/100 with ${ix.score.confidence}% confidence. Trend: ${ix.score.trend}. Based on ${ix.score.dataPoints} data points.${ix.score.tidalModified ? " Tidal adjustment applied." : ""}`} />
        </Modal>
      ))}

      {data && (
        <Modal open={modal === "risk"} onClose={close} title="Waterbody Risk Profile" icon={"\u26A0\uFE0F"} accent="#EF4444">
          {risks.map((r, i) => (
            <div key={i} style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: sev[r.severity].bg + "44", border: `1px solid ${sev[r.severity].border}66` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{r.param}</span>
                  <TierBadge tier="T1" />
                </div>
                <Pill label={r.severity} color={r.severity} />
              </div>
              <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.5, marginBottom: 6 }}>{r.detail}</p>
              <div style={{ display: "flex", gap: 5 }}>
                <div style={{ padding: "4px 6px", borderRadius: 4, background: "#fff" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Records</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B" }}>{r.samples}</div>
                </div>
              </div>
            </div>
          ))}
        </Modal>
      )}

      {data && (
        <Modal open={modal === "cross"} onClose={close} title="Cross-Domain Risk Connections" icon={"\u{1F517}"} accent="#7C3AED">
          <p style={{ fontSize: 12, color: "#64748B", marginBottom: 12, lineHeight: 1.5 }}>PIN identifies how water quality risks cascade across domains. These connections emerge from analyzing multiple data sources together.</p>
          {crossDomain.map((c, i) => (
            <div key={i} style={{ padding: 12, borderRadius: 10, background: sev[c.severity].bg + "44", border: `1px solid ${sev[c.severity].border}66`, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: "#1E293B" }}>{c.from}</span>
                <span style={{ color: "#94A3B8", fontSize: 14 }}>{"\u2192"}</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: "#1E293B" }}>{c.to}</span>
                <Pill label={c.severity} color={c.severity} />
              </div>
              <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.5, margin: 0 }}>{c.mechanism}</p>
            </div>
          ))}
        </Modal>
      )}

      {data && data.raw.attains && (
        <Modal open={modal === "reg"} onClose={close} title="Regulatory Exposure" icon={"\u{1F4CB}"} accent="#3B82F6">
          <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontWeight: 800, fontSize: 13 }}>ATTAINS Impairment Assessment</span>
              <TierBadge tier="T1" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 6 }}>
              {[
                { l: "Impaired", v: String(data.raw.attains.impaired) },
                { l: "Total", v: String(data.raw.attains.total) },
                { l: "Rate", v: `${Math.round((data.raw.attains.impaired / data.raw.attains.total) * 100)}%` },
              ].map((x, j) => (
                <div key={j} style={{ padding: "4px 6px", borderRadius: 4, background: "#fff", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{x.l}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{x.v}</div>
                </div>
              ))}
            </div>
            {data.raw.attains.topCauses.length > 0 && (
              <>
                <SL text="Top Impairment Causes" />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {data.raw.attains.topCauses.map((c, i) => (
                    <span key={i} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" }}>{c}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {data && (
        <Modal open={modal === "permits"} onClose={close} title="Permits" icon={"\u{1F4C4}"}>
          {permits.length > 0 ? permits.map((pr, i) => (
            <div key={i} style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: pr.status === "Expired" ? "#FEF2F266" : "#F8FAFC", border: `1px solid ${pr.status === "Expired" ? "#FCA5A5" : "#E2E8F0"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{pr.type || "NPDES"}</span>
                  <TierBadge tier="T1" />
                </div>
                <div style={{ textAlign: "right" }}>
                  <StatusBadge status={pr.status} />
                  <div style={{ fontSize: 10, color: "#64748B", fontFamily: "'DM Mono',monospace", marginTop: 1 }}>Exp: {pr.expiration}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#3B82F6", fontFamily: "'DM Mono',monospace" }}>{pr.permit}</div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{pr.facility}{pr.flow ? ` · ${pr.flow} MGD` : ""}</div>
            </div>
          )) : <NoData />}
        </Modal>
      )}

      {data && (
        <Modal open={modal === "drinking"} onClose={close} title="Drinking Water" icon={"\u{1F6B0}"} accent="#10B981">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <TierBadge tier="T1" />
            <span style={{ fontSize: 11, fontWeight: 600, color: sdwisViols.length === 0 ? "#059669" : "#DC2626" }}>
              {sdwisViols.length === 0 ? "Zero violations" : `${sdwisViols.length} violation${sdwisViols.length !== 1 ? "s" : ""}`}
              · PFAS: {pfasResults.length === 0 ? "Not Detected" : `${pfasResults.length} detection${pfasResults.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {sdwisSystems.length > 0 && (
            <>
              <SL text="Water Systems" />
              {sdwisSystems.map((sys, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>{sys.name}</span>
                    <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono',monospace" }}>{sys.pwsid} · {sys.type} · Pop: {sys.population.toLocaleString()}</div>
                  </div>
                  <span style={{ fontSize: 10, color: "#64748B" }}>{sys.sourceWater === "GW" ? "Groundwater" : sys.sourceWater === "SW" ? "Surface Water" : sys.sourceWater}</span>
                </div>
              ))}
            </>
          )}

          {sdwisViols.length > 0 && (
            <>
              <SL text="Violations" />
              {sdwisViols.slice(0, 10).map((v, i) => (
                <div key={i} style={{ padding: "4px 6px", borderRadius: 4, background: v.isHealthBased ? "#FEF2F2" : "#FEF3C7", border: `1px solid ${v.isHealthBased ? "#FECACA" : "#FCD34D"}`, marginBottom: 3 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: v.isHealthBased ? "#991B1B" : "#92400E" }}>{v.contaminant || v.rule}</span>
                    <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono',monospace" }}>{v.compliancePeriod}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {pfasResults.length > 0 && (
            <>
              <SL text="PFAS Detections" />
              {pfasResults.slice(0, 5).map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <span style={{ fontSize: 10, color: "#475569" }}>{p.contaminant} at {p.facilityName}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: p.detected ? "#DC2626" : "#059669" }}>
                    {p.resultValue !== null ? p.resultValue : p.detected ? "Detected" : "ND"}
                  </span>
                </div>
              ))}
            </>
          )}
        </Modal>
      )}

      {data && ej && (
        <Modal open={modal === "ej"} onClose={close} title="EJ Vulnerability" icon={"\u{1F465}"} accent="#F59E0B">
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <EjBar value={ej.index !== null ? Math.round(ej.index) : null} label="EJ INDEX" warn />
            <EjBar value={ej.lowIncome} label="LOW INCOME" warn />
            <EjBar value={ej.minority} label="MINORITY" warn />
            <EjBar value={ej.linguistic} label="LINGUISTIC" warn />
          </div>
          <SL text="Supplemental Indicators" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            {[
              { label: "PM2.5", value: ej.pm25 },
              { label: "Diesel PM", value: ej.diesel },
              { label: "Traffic", value: ej.traffic },
              { label: "Wastewater", value: ej.wastewater },
              { label: "Superfund", value: ej.superfund },
              { label: "Haz Waste", value: ej.hazWaste },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 7px", borderRadius: 5, background: s.value !== null && s.value > 70 ? "#FEF2F2" : "#F8FAFC", border: `1px solid ${s.value !== null && s.value > 70 ? "#FECACA" : "#E2E8F0"}` }}>
                <span style={{ fontSize: 10, color: "#475569" }}>{s.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.value !== null && s.value > 70 ? "#DC2626" : "#1E293B", fontFamily: "'DM Mono',monospace" }}>
                  {s.value !== null ? `${Math.round(s.value)}th` : "—"}
                </span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
