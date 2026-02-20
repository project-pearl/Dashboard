import { useState, useMemo, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// MS4 Compliance & Fine Avoidance — TSX Component
// Matches NCC design language: light theme, warm backgrounds,
// subtle card borders, professional dashboard aesthetic
// ═══════════════════════════════════════════════════════════════

// ─── Types ───
interface Penalty {
  perDay: number;
  label: string;
  statute: string;
}

interface JurisdictionData {
  name: string;
  abbr: string;
  penalties: Record<string, Penalty>;
}

interface OverviewData {
  finesAvoided: number;
  maxExposure: number;
  complianceScore: number;
  daysMonitored: number;
  activeViolations: number;
  parametersInLimit: boolean;
  lastUpdated: string;
}

interface BreakdownRow {
  type: string;
  days: number;
  perDay: number;
  total: number;
  status: "avoided" | "active" | "resolved";
}

// ─── Penalty Schedules ───
const JURISDICTIONS: Record<string, JurisdictionData> = {
  MD: {
    name: "Maryland",
    abbr: "MD",
    penalties: {
      CWA: { perDay: 56460, label: "Clean Water Act §309(d)", statute: "33 U.S.C. §1319(d)" },
      NPDES: { perDay: 25000, label: "NPDES Permit Violation", statute: "MD Env. §9-342" },
      MS4: { perDay: 37500, label: "MS4 Permit Non-Compliance", statute: "MD MS4/NPDES" },
      TMDL: { perDay: 32500, label: "TMDL Exceedance", statute: "CWA §303(d)" },
      SSO: { perDay: 56460, label: "Sanitary Sewer Overflow", statute: "CWA §301(a)" },
    },
  },
  VA: {
    name: "Virginia",
    abbr: "VA",
    penalties: {
      CWA: { perDay: 56460, label: "Clean Water Act §309(d)", statute: "33 U.S.C. §1319(d)" },
      NPDES: { perDay: 32580, label: "VPDES Permit Violation", statute: "VA Code §62.1-44.32" },
      MS4: { perDay: 32580, label: "MS4 Permit Non-Compliance", statute: "9VAC25-890" },
      TMDL: { perDay: 25000, label: "TMDL Exceedance", statute: "CWA §303(d)" },
      SSO: { perDay: 56460, label: "Sanitary Sewer Overflow", statute: "CWA §301(a)" },
    },
  },
  PA: {
    name: "Pennsylvania",
    abbr: "PA",
    penalties: {
      CWA: { perDay: 56460, label: "Clean Water Act §309(d)", statute: "33 U.S.C. §1319(d)" },
      NPDES: { perDay: 10000, label: "NPDES Permit Violation", statute: "35 P.S. §691.602" },
      MS4: { perDay: 10000, label: "MS4 Permit Non-Compliance", statute: "PAG-13" },
      TMDL: { perDay: 25000, label: "TMDL Exceedance", statute: "CWA §303(d)" },
      SSO: { perDay: 56460, label: "Sanitary Sewer Overflow", statute: "CWA §301(a)" },
    },
  },
  DC: {
    name: "Washington D.C.",
    abbr: "DC",
    penalties: {
      CWA: { perDay: 56460, label: "Clean Water Act §309(d)", statute: "33 U.S.C. §1319(d)" },
      NPDES: { perDay: 25000, label: "NPDES Permit Violation", statute: "DC Code §8-103.16" },
      MS4: { perDay: 37500, label: "MS4 Permit Non-Compliance", statute: "DC MS4 Permit" },
      TMDL: { perDay: 32500, label: "TMDL Exceedance", statute: "CWA §303(d)" },
      SSO: { perDay: 56460, label: "Sanitary Sewer Overflow", statute: "CWA §301(a)" },
    },
  },
  NY: {
    name: "New York",
    abbr: "NY",
    penalties: {
      CWA: { perDay: 56460, label: "Clean Water Act §309(d)", statute: "33 U.S.C. §1319(d)" },
      NPDES: { perDay: 37500, label: "SPDES Permit Violation", statute: "ECL §71-1929" },
      MS4: { perDay: 37500, label: "MS4 Permit Non-Compliance", statute: "GP-0-24-001" },
      TMDL: { perDay: 37500, label: "TMDL Exceedance", statute: "CWA §303(d)" },
      SSO: { perDay: 56460, label: "Sanitary Sewer Overflow", statute: "CWA §301(a)" },
    },
  },
  FL: {
    name: "Florida",
    abbr: "FL",
    penalties: {
      CWA: { perDay: 56460, label: "Clean Water Act §309(d)", statute: "33 U.S.C. §1319(d)" },
      NPDES: { perDay: 50000, label: "NPDES Permit Violation", statute: "FL Stat. §403.161" },
      MS4: { perDay: 50000, label: "MS4 Permit Non-Compliance", statute: "FL DEP MS4" },
      TMDL: { perDay: 50000, label: "TMDL Exceedance", statute: "CWA §303(d)" },
      SSO: { perDay: 56460, label: "Sanitary Sewer Overflow", statute: "CWA §301(a)" },
    },
  },
  CA: {
    name: "California",
    abbr: "CA",
    penalties: {
      CWA: { perDay: 56460, label: "Clean Water Act §309(d)", statute: "33 U.S.C. §1319(d)" },
      NPDES: { perDay: 25000, label: "NPDES Permit Violation", statute: "CWC §13385" },
      MS4: { perDay: 25000, label: "MS4 Permit Non-Compliance", statute: "CA MS4 General Permit" },
      TMDL: { perDay: 25000, label: "TMDL Exceedance", statute: "CWA §303(d)" },
      SSO: { perDay: 56460, label: "Sanitary Sewer Overflow", statute: "CWA §301(a)" },
    },
  },
  TX: {
    name: "Texas",
    abbr: "TX",
    penalties: {
      CWA: { perDay: 56460, label: "Clean Water Act §309(d)", statute: "33 U.S.C. §1319(d)" },
      NPDES: { perDay: 25000, label: "TPDES Permit Violation", statute: "TX Water Code §26.136" },
      MS4: { perDay: 25000, label: "MS4 Permit Non-Compliance", statute: "TPDES MS4 GP" },
      TMDL: { perDay: 25000, label: "TMDL Exceedance", statute: "CWA §303(d)" },
      SSO: { perDay: 56460, label: "Sanitary Sewer Overflow", statute: "CWA §301(a)" },
    },
  },
};

const FLOW_TIERS = [
  { min: 0, max: 10000, factor: 1.0, label: "Minor (< 10K GPD)", severity: "Low" },
  { min: 10000, max: 100000, factor: 1.25, label: "Moderate (10K–100K GPD)", severity: "Medium" },
  { min: 100000, max: 1000000, factor: 1.75, label: "Major (100K–1M GPD)", severity: "High" },
  { min: 1000000, max: Infinity, factor: 2.5, label: "Significant (> 1M GPD)", severity: "Critical" },
];

// ─── Utils ───
function getFlowTier(gpd: number) {
  return FLOW_TIERS.find((t) => gpd >= t.min && gpd < t.max) || FLOW_TIERS[0];
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toLocaleString()}`;
}

function formatNumber(val: number): string {
  return val.toLocaleString();
}

// ─── Subcomponents ───

function ComplianceBadge({ score }: { score: number }) {
  const config = score >= 90
    ? { label: "COMPLIANT", bg: "#dcfce7", border: "#86efac", color: "#15803d", dot: "#22c55e" }
    : score >= 70
    ? { label: "AT RISK", bg: "#fef9c3", border: "#fde047", color: "#a16207", dot: "#eab308" }
    : score >= 50
    ? { label: "WARNING", bg: "#ffedd5", border: "#fdba74", color: "#c2410c", dot: "#f97316" }
    : { label: "NON-COMPLIANT", bg: "#fce4ec", border: "#ef9a9a", color: "#c62828", dot: "#ef4444" };

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      background: config.bg, border: `1.5px solid ${config.border}`,
      borderRadius: 20, padding: "5px 14px 5px 10px",
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%", background: config.dot,
        boxShadow: `0 0 6px ${config.dot}60`,
      }} />
      <span style={{ fontSize: 11.5, fontWeight: 700, color: config.color, letterSpacing: "0.05em" }}>
        {config.label}
      </span>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent }: {
  icon: string; label: string; value: string; sub: string; accent: string;
}) {
  return (
    <div style={{
      background: "#fff", border: `1.5px solid ${accent}25`,
      borderRadius: 12, padding: "18px 16px", textAlign: "center",
      borderTop: `3px solid ${accent}`,
      transition: "box-shadow 0.2s",
    }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: accent,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 800, color: "#1e293b",
        letterSpacing: "-0.03em", lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 5 }}>{sub}</div>
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 90 ? "#22c55e" : score >= 70 ? "#eab308" : score >= 50 ? "#f97316" : "#ef4444";
  const r = 36;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 100, 1);
  return (
    <div style={{ position: "relative", width: 88, height: 88 }}>
      <svg width={88} height={88} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={44} cy={44} r={r} fill="none" stroke="#f1f5f9" strokeWidth={7} />
        <circle cx={44} cy={44} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>/ 100</span>
      </div>
    </div>
  );
}

function SectionButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: string; label: string;
}) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "8px 16px",
      background: active ? "#eff6ff" : "#fff",
      border: `1.5px solid ${active ? "#93c5fd" : "#e2e8f0"}`,
      borderRadius: 8, color: active ? "#2563eb" : "#64748b",
      fontSize: 13, fontWeight: 600, cursor: "pointer",
      transition: "all 0.15s", fontFamily: "inherit",
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span> {label}
    </button>
  );
}

// ─── Main Component ───
export default function MS4ComplianceFineAvoidance({
  data,
}: {
  data?: Partial<OverviewData>;
}) {
  const [showCalc, setShowCalc] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Calculator state
  const [jurisdiction, setJurisdiction] = useState("MD");
  const [violationType, setViolationType] = useState("CWA");
  const [violationDays, setViolationDays] = useState(30);
  const [flowGPD, setFlowGPD] = useState(50000);

  // Merge with defaults
  const overview: OverviewData = {
    finesAvoided: 1452000,
    maxExposure: 1817000,
    complianceScore: 100,
    daysMonitored: 400,
    activeViolations: 0,
    parametersInLimit: true,
    lastUpdated: "Nov 12, 2025, 7:00 PM",
    ...data,
  };

  const calc = useMemo(() => {
    const penalty = JURISDICTIONS[jurisdiction].penalties[violationType];
    const tier = getFlowTier(flowGPD);
    const baseFine = penalty.perDay * violationDays;
    const adjustedFine = baseFine * tier.factor;
    return {
      baseFine,
      adjustedFine,
      perDay: penalty.perDay,
      flowMultiplier: tier.factor,
      flowTierLabel: tier.label,
      flowSeverity: tier.severity,
      violationLabel: penalty.label,
      statute: penalty.statute,
      jurisdictionName: JURISDICTIONS[jurisdiction].name,
    };
  }, [jurisdiction, violationType, violationDays, flowGPD]);

  const breakdownRows: BreakdownRow[] = [
    { type: "CWA §309(d) — Federal", days: 120, perDay: 56460, total: 6775200, status: "avoided" },
    { type: "NPDES Permit Violation", days: 85, perDay: 25000, total: 2125000, status: "avoided" },
    { type: "MS4 Non-Compliance", days: 200, perDay: 37500, total: 7500000, status: "avoided" },
  ];

  const totalAvoided = breakdownRows.reduce((sum, r) => sum + r.total, 0);

  // Shared styles
  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1.5px solid #e8ecf1",
    borderRadius: 14,
    overflow: "hidden",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px",
    background: "#f8fafc", border: "1.5px solid #e2e8f0",
    borderRadius: 8, color: "#1e293b", fontSize: 13.5,
    fontFamily: "inherit", outline: "none", cursor: "pointer",
  };

  const inputNumStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px",
    background: "#f8fafc", border: "1.5px solid #e2e8f0",
    borderRadius: 8, color: "#1e293b", fontSize: 13.5,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 700, color: "#64748b",
    textTransform: "uppercase", letterSpacing: "0.07em",
    marginBottom: 5, display: "block",
  };

  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: "#f6f7f9",
      borderRadius: 16, padding: 0,
      maxWidth: 980, margin: "0 auto",
    }}>

      {/* ═══ Main Card ═══ */}
      <div style={cardStyle}>

        {/* Header */}
        <div style={{
          padding: "20px 24px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          borderBottom: "1px solid #f0f2f5",
          flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>🛡️</span>
              <h2 style={{
                margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b",
                letterSpacing: "-0.01em",
              }}>
                MS4 Compliance & Fine Avoidance
              </h2>
            </div>
            <p style={{
              margin: 0, fontSize: 13, color: "#94a3b8", paddingLeft: 29,
            }}>
              Regulatory risk analysis and estimated penalty exposure avoided · {overview.daysMonitored} days monitored
            </p>
          </div>
          <ComplianceBadge score={overview.complianceScore} />
        </div>

        {/* KPI Row */}
        <div style={{
          padding: "18px 24px",
          display: "grid", gridTemplateColumns: "1fr 1fr auto",
          gap: 14, alignItems: "stretch",
        }}>
          <KpiCard icon="$" label="Fines Avoided" value={formatCurrency(overview.finesAvoided)}
            sub="since Jan 2025" accent="#16a34a" />
          <KpiCard icon="📈" label="Max CWA Exposure" value={formatCurrency(overview.maxExposure)}
            sub="avoided per event cluster" accent="#ea580c" />

          {/* Score gauge card */}
          <div style={{
            background: "#fff", border: "1.5px solid #e2e8f025",
            borderRadius: 12, padding: "18px 24px",
            borderTop: "3px solid #2563eb",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", minWidth: 140,
          }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: "#2563eb",
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
            }}>
              Compliance Score
            </div>
            <ScoreGauge score={overview.complianceScore} />
          </div>
        </div>

        {/* Compliance Status Bar */}
        <div style={{ padding: "0 24px 16px" }}>
          <div style={{
            background: "#f8fafc", border: "1px solid #e8ecf1",
            borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}>Permit Compliance Status</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: overview.complianceScore >= 90 ? "#16a34a" : "#ea580c" }}>
                {overview.complianceScore}/100
              </span>
            </div>
            <div style={{
              height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${overview.complianceScore}%`,
                background: "linear-gradient(90deg, #ef4444 0%, #eab308 40%, #22c55e 80%)",
                borderRadius: 4,
                transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", marginTop: 5,
              fontSize: 10, color: "#94a3b8", letterSpacing: "0.02em",
            }}>
              <span>Non-Compliant</span><span>At Risk</span><span>Compliant</span><span>Excellent</span>
            </div>

            {/* Status Alert */}
            <div style={{
              marginTop: 12, display: "flex", alignItems: "center", gap: 8,
              padding: "9px 13px", borderRadius: 8,
              background: overview.parametersInLimit ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${overview.parametersInLimit ? "#bbf7d0" : "#fecaca"}`,
            }}>
              <span style={{ fontSize: 15 }}>{overview.parametersInLimit ? "✅" : "🚨"}</span>
              <span style={{
                fontSize: 13, fontWeight: 500,
                color: overview.parametersInLimit ? "#15803d" : "#b91c1c",
              }}>
                {overview.parametersInLimit
                  ? "All parameters within permit limits — no active violations detected"
                  : `${overview.activeViolations} active violation(s) detected — immediate action required`}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ padding: "0 24px 18px", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SectionButton active={showBreakdown} onClick={() => setShowBreakdown(!showBreakdown)}
            icon="📋" label={`${showBreakdown ? "Hide" : "Show"} fine avoidance breakdown`} />
          <SectionButton active={showCalc} onClick={() => setShowCalc(!showCalc)}
            icon="🧮" label={`${showCalc ? "Hide" : "Open"} fine exposure calculator`} />
        </div>

        {/* ═══ Breakdown Table ═══ */}
        {showBreakdown && (
          <div style={{ padding: "0 24px 18px" }}>
            <div style={{
              border: "1.5px solid #e8ecf1", borderRadius: 10, overflow: "hidden",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Violation Type", "Days", "Per Day Rate", "Status", "Total Avoided"].map((h, i) => (
                      <th key={h} style={{
                        padding: "10px 14px", fontSize: 10.5, fontWeight: 700,
                        color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em",
                        textAlign: i === 0 ? "left" : "right",
                        borderBottom: "1px solid #e8ecf1",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map((row, i) => (
                    <tr key={i} style={{
                      borderBottom: i < breakdownRows.length - 1 ? "1px solid #f0f2f5" : "none",
                    }}>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500, color: "#334155" }}>
                        {row.type}
                      </td>
                      <td style={{ padding: "11px 14px", fontSize: 13, color: "#64748b", textAlign: "right" }}>
                        {row.days}
                      </td>
                      <td style={{ padding: "11px 14px", fontSize: 13, color: "#64748b", textAlign: "right" }}>
                        ${formatNumber(row.perDay)}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right" }}>
                        <span style={{
                          display: "inline-block", fontSize: 10.5, fontWeight: 700,
                          padding: "3px 10px", borderRadius: 12,
                          background: row.status === "avoided" ? "#dcfce7" : row.status === "active" ? "#fce4ec" : "#f0f4ff",
                          color: row.status === "avoided" ? "#15803d" : row.status === "active" ? "#c62828" : "#3b82f6",
                          textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{
                        padding: "11px 14px", fontSize: 13.5, fontWeight: 700,
                        color: "#16a34a", textAlign: "right",
                      }}>
                        {formatCurrency(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f0fdf4", borderTop: "1.5px solid #bbf7d0" }}>
                    <td colSpan={4} style={{
                      padding: "11px 14px", fontSize: 12, fontWeight: 700,
                      color: "#15803d", textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      Total Penalty Exposure Avoided
                    </td>
                    <td style={{
                      padding: "11px 14px", fontSize: 16, fontWeight: 800,
                      color: "#15803d", textAlign: "right",
                    }}>
                      {formatCurrency(totalAvoided)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ═══ Calculator ═══ */}
        {showCalc && (
          <div style={{ padding: "0 24px 22px" }}>
            <div style={{
              background: "#fafbff",
              border: "1.5px solid #dbeafe",
              borderRadius: 12, padding: 22,
            }}>
              {/* Calc Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 18, flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 18 }}>🧮</span>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                  Fine Exposure Calculator
                </h3>
                <span style={{
                  marginLeft: "auto", fontSize: 10.5, color: "#94a3b8",
                  background: "#f1f5f9", padding: "3px 10px", borderRadius: 6,
                  fontWeight: 600,
                }}>
                  Estimates only · consult legal counsel
                </span>
              </div>

              {/* Input Grid */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 14, marginBottom: 18,
              }}>
                <div>
                  <label style={fieldLabel}>Jurisdiction</label>
                  <select value={jurisdiction}
                    onChange={(e) => { setJurisdiction(e.target.value); setViolationType("CWA"); }}
                    style={selectStyle}>
                    {Object.entries(JURISDICTIONS).map(([code, j]) => (
                      <option key={code} value={code}>{j.name} ({j.abbr})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Violation Type</label>
                  <select value={violationType}
                    onChange={(e) => setViolationType(e.target.value)}
                    style={selectStyle}>
                    {Object.entries(JURISDICTIONS[jurisdiction].penalties).map(([code, p]) => (
                      <option key={code} value={code}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>
                    Violation Days
                    <span style={{ float: "right", color: "#2563eb", fontWeight: 800 }}>{violationDays}</span>
                  </label>
                  <input type="range" min={1} max={365} value={violationDays}
                    onChange={(e) => setViolationDays(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#2563eb", margin: "4px 0" }} />
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 10, color: "#94a3b8", marginTop: 2,
                  }}>
                    <span>1 day</span><span>1 year</span>
                  </div>
                </div>
                <div>
                  <label style={fieldLabel}>
                    Discharge Rate (GPD)
                    <span style={{ float: "right", color: "#2563eb", fontWeight: 800 }}>
                      {flowGPD >= 1000000 ? `${(flowGPD / 1000000).toFixed(1)}M` : `${(flowGPD / 1000).toFixed(0)}K`}
                    </span>
                  </label>
                  <input type="range" min={1000} max={2000000} step={5000} value={flowGPD}
                    onChange={(e) => setFlowGPD(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#2563eb", margin: "4px 0" }} />
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 10, color: "#94a3b8", marginTop: 2,
                  }}>
                    <span>1K GPD</span><span>2M GPD</span>
                  </div>
                </div>
              </div>

              {/* Results Panel */}
              <div style={{
                background: "#fff", borderRadius: 10,
                border: "1.5px solid #e8ecf1", overflow: "hidden",
              }}>
                {/* Breakdown metrics */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  borderBottom: "1px solid #f0f2f5",
                }}>
                  {[
                    { label: "Base Rate/Day", value: `$${formatNumber(calc.perDay)}`, color: "#1e293b" },
                    { label: "× Violation Days", value: String(violationDays), color: "#1e293b" },
                    { label: "× Flow Multiplier", value: `${calc.flowMultiplier}×`, color: "#ea580c" },
                    { label: "Flow Tier", value: calc.flowSeverity, color:
                      calc.flowSeverity === "Critical" ? "#dc2626" :
                      calc.flowSeverity === "High" ? "#ea580c" :
                      calc.flowSeverity === "Medium" ? "#ca8a04" : "#64748b"
                    },
                  ].map((m, i) => (
                    <div key={i} style={{
                      padding: "14px 12px", textAlign: "center",
                      borderRight: i < 3 ? "1px solid #f0f2f5" : "none",
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Total result */}
                <div style={{
                  padding: "16px 20px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  flexWrap: "wrap", gap: 16,
                }}>
                  <div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: "#94a3b8",
                      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4,
                    }}>
                      Total Estimated Penalty Exposure
                    </div>
                    <div style={{
                      fontSize: 32, fontWeight: 900, color: "#dc2626",
                      letterSpacing: "-0.03em", lineHeight: 1,
                    }}>
                      {formatCurrency(calc.adjustedFine)}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 5 }}>
                      {calc.jurisdictionName} · {calc.violationLabel} · {calc.statute}
                    </div>
                  </div>

                  {/* PEARL comparison */}
                  <div style={{
                    background: "#f0fdf4", border: "1.5px solid #bbf7d0",
                    borderRadius: 10, padding: "12px 18px", textAlign: "center",
                    minWidth: 160,
                  }}>
                    <div style={{
                      fontSize: 9.5, fontWeight: 700, color: "#15803d",
                      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4,
                    }}>
                      w/ PEARL Deployed
                    </div>
                    <div style={{
                      fontSize: 24, fontWeight: 900, color: "#16a34a", lineHeight: 1,
                    }}>
                      $0
                    </div>
                    <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4, fontWeight: 600 }}>
                      {formatCurrency(calc.adjustedFine)} avoided
                    </div>
                  </div>
                </div>
              </div>

              {/* Formula footnote */}
              <div style={{
                marginTop: 10, padding: "8px 12px",
                background: "#f8fafc", borderRadius: 6,
                border: "1px solid #e8ecf1",
              }}>
                <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                  <strong style={{ color: "#64748b" }}>Formula:</strong> Base Penalty/Day × Violation Days × Flow Multiplier = Total Exposure.
                  Flow multipliers reflect EPA enforcement gravity component scaling.
                  Actual penalties vary by enforcement discretion, compliance history, and economic benefit of noncompliance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer provenance */}
        <div style={{
          padding: "10px 24px 12px",
          borderTop: "1px solid #f0f2f5",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 8,
        }}>
          <span style={{ fontSize: 10.5, color: "#cbd5e1" }}>
            Penalty schedules sourced from EPA ECHO, state enforcement databases, and CWA statutory maximums.
            Informational only — not legal advice.
          </span>
          <span style={{ fontSize: 10.5, color: "#cbd5e1" }}>
            Updated: {overview.lastUpdated}
          </span>
        </div>
      </div>
    </div>
  );
}
