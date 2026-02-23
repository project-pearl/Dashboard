// =============================================================
// State Waterbody Card — Federal Management Center
// PEARL Intelligence Network (PIN)
//
// Federal-only component. Provides top-down oversight view
// of individual waterbodies within a selected state.
// Shows regulatory status, jurisdictional responsibility,
// cross-domain compliance, trends, and data gaps.
//
// State users never see this card — they have their own
// management center with operationally scoped views.
// =============================================================

"use client";

import { useState, useMemo } from "react";

// ----- Types -----

export interface StateWaterbodyData {
  // Identity
  assessmentUnitId: string;
  name: string;
  state: string;
  epaRegion: number;
  huc12: string;
  watershed: string;

  // Current Status
  grade: string;                    // "A" through "F" or "N/A"
  gradeScore: number;               // 0-100
  severity: "healthy" | "watch" | "impaired" | "severe" | "unassessed";
  dataFreshnessDays: number;
  lastUpdated: string;              // ISO date

  // Regulatory Status
  listing303d: boolean;
  category: string;                 // "Category 5", "Category 4a", etc.
  tmldEstablished: boolean;
  tmdlPollutants: string[];
  cwaAuthority: string;             // "§303(d)/§402"
  stateIRCycle: string;             // "2024" — last integrated report cycle

  // Jurisdictional Responsibility
  ms4Permits: {
    permitId: string;
    permitteeName: string;
    phase: "I" | "II";
  }[];
  stateAgency: {
    name: string;
    division: string;
    phone: string;
  };
  npdesDischargers: {
    facilityName: string;
    permitId: string;
    majorMinor: "Major" | "Minor";
    status: "Active" | "Expired" | "Pending";
  }[];

  // Cross-Domain Compliance
  ambient: {
    parametersExceeding: {
      name: string;
      value: number;
      threshold: number;
      unit: string;
    }[];
    parametersMonitored: number;
    parametersMissing: number;
  };
  drinkingWater: {
    systemsAffected: number;
    populationServed: number;
    activeViolations: number;
    healthBasedViolations: number;
    systemNames: string[];
  };
  wastewater: {
    activeFacilities: number;
    npdesViolations12mo: number;
    significantNoncompliance: number;
    enforcementActions: number;
    totalDischargeVolume: string;    // e.g., "2.4 MGD"
  };

  // Trends
  trendDirection: "improving" | "stable" | "worsening" | "insufficient_data";
  trendCycles: {
    cycle: string;                   // "2020", "2022", "2024"
    category: string;
    impairmentCount: number;
  }[];

  // Data Gaps
  dataGaps: {
    missingParameters: string[];
    staleParameters: { name: string; daysSinceUpdate: number }[];
    noRealtimeSensors: boolean;
    monitoringFrequency: string;     // "Monthly", "Quarterly", "Unknown"
    blindSpotFlag: boolean;
  };
}

// ----- Severity Styles -----

const severityConfig = {
  severe:     { bg: "bg-red-50",    border: "border-red-300",    badge: "bg-red-600 text-white",    label: "Severe" },
  impaired:   { bg: "bg-orange-50", border: "border-orange-300", badge: "bg-orange-500 text-white",  label: "Impaired" },
  watch:      { bg: "bg-yellow-50", border: "border-yellow-300", badge: "bg-yellow-500 text-white",  label: "Watch" },
  healthy:    { bg: "bg-green-50",  border: "border-green-300",  badge: "bg-green-600 text-white",   label: "Healthy" },
  unassessed: { bg: "bg-gray-50",   border: "border-gray-300",   badge: "bg-gray-400 text-white",    label: "Unassessed" },
};

const trendIcons = {
  improving: "↗️",
  stable: "→",
  worsening: "↘️",
  insufficient_data: "—",
};

// ----- Sub-Components -----

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
      <span className="text-lg">{icon}</span>
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  color?: string;
  subtitle?: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${color || "bg-gray-50"}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}

function StatusPill({ label, positive }: { label: string; positive: boolean }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {label}
    </span>
  );
}

// ----- Main Component -----

export interface StateWaterbodyCardProps {
  data: StateWaterbodyData;
  onClose?: () => void;
}

export default function StateWaterbodyCard({ data, onClose }: StateWaterbodyCardProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "compliance" | "trends" | "gaps"
  >("overview");

  const sev = severityConfig[data.severity];

  return (
    <div className={`border rounded-xl ${sev.border} bg-white shadow-sm overflow-hidden`}>
      {/* ── Header ── */}
      <div className={`${sev.bg} px-6 py-4`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${sev.badge}`}>
                {sev.label}
              </span>
              <span className="text-xs text-gray-500">
                EPA Region {data.epaRegion}
              </span>
              <span className="text-xs text-gray-500">
                {data.assessmentUnitId}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{data.name}</h2>
            <p className="text-sm text-gray-600">
              {data.state} · {data.watershed} · HUC {data.huc12}
            </p>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <div className="text-3xl font-bold text-gray-900">
              {data.grade}
            </div>
            <p className="text-xs text-gray-400">
              Updated {data.dataFreshnessDays}d ago
            </p>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-sm mt-1"
              >
                ✕ Close
              </button>
            )}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="flex gap-4 mt-3 text-xs text-gray-600">
          <span>
            {data.listing303d ? "📋 303(d) Listed" : "✅ Not 303(d) Listed"}
          </span>
          <span>
            {data.tmldEstablished ? "📊 TMDL Established" : "⚠️ No TMDL"}
          </span>
          <span>
            {trendIcons[data.trendDirection]} Trend: {data.trendDirection.replace("_", " ")}
          </span>
          <span>
            {data.ms4Permits.length} MS4 permit{data.ms4Permits.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex border-b border-gray-200">
        {(
          [
            ["overview", "Overview"],
            ["compliance", "Cross-Domain Compliance"],
            ["trends", "Trends & History"],
            ["gaps", "Data Gaps"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="px-6 py-4">
        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div>
            {/* Regulatory Status */}
            <SectionHeader title="Regulatory Status" icon="📋" />
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">303(d) Status</p>
                <p className="font-semibold text-sm">
                  {data.listing303d ? data.category : "Not Listed"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">TMDL</p>
                <p className="font-semibold text-sm">
                  {data.tmldEstablished
                    ? `Established (${data.tmdlPollutants.join(", ")})`
                    : "Needed — Not Established"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">CWA Authority</p>
                <p className="font-semibold text-sm">{data.cwaAuthority}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">State IR Cycle</p>
                <p className="font-semibold text-sm">{data.stateIRCycle}</p>
              </div>
            </div>

            {/* Jurisdictional Responsibility */}
            <SectionHeader title="Who Is Responsible" icon="🏛️" />
            <div className="space-y-2">
              {/* State agency */}
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  State Agency
                </p>
                <p className="font-semibold text-sm">{data.stateAgency.name}</p>
                <p className="text-xs text-gray-500">
                  {data.stateAgency.division} · {data.stateAgency.phone}
                </p>
              </div>

              {/* MS4 permits */}
              {data.ms4Permits.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    MS4 Permits Covering This Waterbody
                  </p>
                  {data.ms4Permits.map((p) => (
                    <div key={p.permitId} className="flex justify-between text-sm py-1">
                      <span className="font-medium">{p.permitteeName}</span>
                      <span className="text-gray-400">
                        {p.permitId} · Phase {p.phase}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* NPDES dischargers */}
              {data.npdesDischargers.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    NPDES Discharge Permits ({data.npdesDischargers.length})
                  </p>
                  {data.npdesDischargers.slice(0, 5).map((d) => (
                    <div key={d.permitId} className="flex justify-between text-sm py-1">
                      <span className="font-medium">{d.facilityName}</span>
                      <div className="flex gap-2 items-center">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            d.majorMinor === "Major"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {d.majorMinor}
                        </span>
                        <span className="text-gray-400 text-xs">{d.status}</span>
                      </div>
                    </div>
                  ))}
                  {data.npdesDischargers.length > 5 && (
                    <p className="text-xs text-gray-400 mt-1">
                      +{data.npdesDischargers.length - 5} more facilities
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Ambient exceedances summary */}
            {data.ambient.parametersExceeding.length > 0 && (
              <>
                <SectionHeader title="Active Exceedances" icon="⚠️" />
                <div className="space-y-1">
                  {data.ambient.parametersExceeding.map((p) => (
                    <div
                      key={p.name}
                      className="flex justify-between items-center bg-red-50 rounded px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-red-800">{p.name}</span>
                      <span className="text-red-600">
                        {p.value} {p.unit}{" "}
                        <span className="text-red-400">
                          (limit: {p.threshold} {p.unit})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CROSS-DOMAIN COMPLIANCE TAB ── */}
        {activeTab === "compliance" && (
          <div>
            {/* Ambient */}
            <SectionHeader title="Ambient Water Quality" icon="🌊" />
            <div className="grid grid-cols-3 gap-3 mb-4">
              <StatBox
                label="Parameters Monitored"
                value={data.ambient.parametersMonitored}
                color="bg-blue-50"
              />
              <StatBox
                label="Exceeding Threshold"
                value={data.ambient.parametersExceeding.length}
                color={
                  data.ambient.parametersExceeding.length > 0
                    ? "bg-red-50"
                    : "bg-green-50"
                }
              />
              <StatBox
                label="Not Monitored"
                value={data.ambient.parametersMissing}
                color={
                  data.ambient.parametersMissing > 0
                    ? "bg-yellow-50"
                    : "bg-green-50"
                }
              />
            </div>

            {/* Drinking Water */}
            <SectionHeader title="Drinking Water Systems" icon="🚰" />
            {data.drinkingWater.systemsAffected > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <StatBox
                    label="Systems Drawing From"
                    value={data.drinkingWater.systemsAffected}
                    subtitle={`${data.drinkingWater.populationServed.toLocaleString()} people served`}
                  />
                  <StatBox
                    label="Active Violations"
                    value={data.drinkingWater.activeViolations}
                    color={
                      data.drinkingWater.activeViolations > 0
                        ? "bg-red-50"
                        : "bg-green-50"
                    }
                  />
                  <StatBox
                    label="Health-Based"
                    value={data.drinkingWater.healthBasedViolations}
                    color={
                      data.drinkingWater.healthBasedViolations > 0
                        ? "bg-red-50"
                        : "bg-green-50"
                    }
                  />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Affected Systems</p>
                  {data.drinkingWater.systemNames.map((name) => (
                    <p key={name} className="text-sm font-medium">{name}</p>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">
                No drinking water systems identified drawing from this waterbody.
              </p>
            )}

            {/* Wastewater */}
            <SectionHeader title="Wastewater Discharge" icon="🏭" />
            <div className="grid grid-cols-3 gap-3">
              <StatBox
                label="Active Facilities"
                value={data.wastewater.activeFacilities}
              />
              <StatBox
                label="NPDES Violations (12mo)"
                value={data.wastewater.npdesViolations12mo}
                color={
                  data.wastewater.npdesViolations12mo > 0
                    ? "bg-red-50"
                    : "bg-green-50"
                }
              />
              <StatBox
                label="Significant Noncompliance"
                value={data.wastewater.significantNoncompliance}
                color={
                  data.wastewater.significantNoncompliance > 0
                    ? "bg-red-50"
                    : "bg-green-50"
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <StatBox
                label="Enforcement Actions"
                value={data.wastewater.enforcementActions}
                color={
                  data.wastewater.enforcementActions > 0
                    ? "bg-orange-50"
                    : "bg-gray-50"
                }
              />
              <StatBox
                label="Total Discharge Volume"
                value={data.wastewater.totalDischargeVolume}
              />
            </div>

            {/* Federal Action Indicator */}
            {(data.wastewater.significantNoncompliance > 0 ||
              data.drinkingWater.healthBasedViolations > 0 ||
              (data.listing303d && !data.tmldEstablished)) && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-bold text-red-800 mb-2">
                  ⚠️ Federal Attention Recommended
                </p>
                <ul className="text-sm text-red-700 space-y-1">
                  {data.listing303d && !data.tmldEstablished && (
                    <li>
                      • Category 5 impaired without approved TMDL — federal
                      oversight or enforcement referral may be warranted under CWA
                      §303(d)
                    </li>
                  )}
                  {data.wastewater.significantNoncompliance > 0 && (
                    <li>
                      • {data.wastewater.significantNoncompliance} facilit
                      {data.wastewater.significantNoncompliance === 1 ? "y" : "ies"} in
                      significant noncompliance — EPA enforcement review recommended
                    </li>
                  )}
                  {data.drinkingWater.healthBasedViolations > 0 && (
                    <li>
                      • {data.drinkingWater.healthBasedViolations} health-based
                      drinking water violation{data.drinkingWater.healthBasedViolations === 1 ? "" : "s"} —
                      SDWA enforcement review recommended
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── TRENDS TAB ── */}
        {activeTab === "trends" && (
          <div>
            <SectionHeader title="Assessment Trend" icon="📈" />
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">
                {trendIcons[data.trendDirection]}
              </span>
              <div>
                <p className="text-lg font-bold capitalize">
                  {data.trendDirection.replace("_", " ")}
                </p>
                <p className="text-sm text-gray-500">
                  Based on {data.trendCycles.length} assessment cycle
                  {data.trendCycles.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Cycle history */}
            {data.trendCycles.length > 0 ? (
              <div className="space-y-2">
                {data.trendCycles.map((cycle) => (
                  <div
                    key={cycle.cycle}
                    className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-sm">IR Cycle {cycle.cycle}</p>
                      <p className="text-xs text-gray-500">{cycle.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{cycle.impairmentCount}</p>
                      <p className="text-xs text-gray-400">impairments</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">
                No historical assessment cycles available for trend analysis.
              </p>
            )}
          </div>
        )}

        {/* ── DATA GAPS TAB ── */}
        {activeTab === "gaps" && (
          <div>
            <SectionHeader title="Monitoring Status" icon="📡" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatBox
                label="Monitoring Frequency"
                value={data.dataGaps.monitoringFrequency}
              />
              <StatBox
                label="Real-Time Sensors"
                value={data.dataGaps.noRealtimeSensors ? "None" : "Active"}
                color={data.dataGaps.noRealtimeSensors ? "bg-yellow-50" : "bg-green-50"}
              />
            </div>

            {data.dataGaps.blindSpotFlag && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-bold text-yellow-800">
                  🔍 Blind Spot Detected
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  This waterbody has insufficient monitoring data for reliable
                  assessment. Consider requesting updated sampling or sensor
                  deployment.
                </p>
              </div>
            )}

            {/* Missing parameters */}
            {data.dataGaps.missingParameters.length > 0 && (
              <>
                <SectionHeader title="Parameters Not Monitored" icon="❌" />
                <div className="flex flex-wrap gap-2">
                  {data.dataGaps.missingParameters.map((p) => (
                    <span
                      key={p}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Stale parameters */}
            {data.dataGaps.staleParameters.length > 0 && (
              <>
                <SectionHeader title="Stale Data" icon="⏰" />
                <div className="space-y-1">
                  {data.dataGaps.staleParameters.map((p) => (
                    <div
                      key={p.name}
                      className="flex justify-between items-center bg-orange-50 rounded px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-orange-800">
                        {p.name}
                      </span>
                      <span className="text-orange-600">
                        {p.daysSinceUpdate} days since last observation
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Recommendation */}
            {(data.dataGaps.blindSpotFlag ||
              data.dataGaps.missingParameters.length > 2 ||
              data.dataGaps.noRealtimeSensors) && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-bold text-blue-800 mb-2">
                  📋 Recommended Actions
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  {data.dataGaps.noRealtimeSensors && (
                    <li>
                      • Deploy continuous monitoring sensors — this waterbody has no
                      real-time data feed
                    </li>
                  )}
                  {data.dataGaps.missingParameters.length > 0 && (
                    <li>
                      • Request state agency expand sampling to include{" "}
                      {data.dataGaps.missingParameters.slice(0, 3).join(", ")}
                      {data.dataGaps.missingParameters.length > 3 &&
                        ` and ${data.dataGaps.missingParameters.length - 3} more`}
                    </li>
                  )}
                  {data.dataGaps.blindSpotFlag && (
                    <li>
                      • Flag for priority monitoring — insufficient data for
                      regulatory confidence
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
        <p>
          Sources: EPA ATTAINS · EPA ECHO/ICIS · EPA SDWIS · USGS NWIS · State
          Integrated Reports · PEARL monitoring network
        </p>
        <p className="mt-1">
          This card is informational and derived from public sources. It is not
          an official EPA, state, or federal determination. Verify with primary
          agency data for compliance or permitting purposes.
        </p>
      </div>
    </div>
  );
}
