// =============================================================================
// AMS Alert Monitor Card
// Lives inside the Disaster/Emergency sidebar item for each role.
// =============================================================================

"use client";

import React, { useState, useMemo } from "react";
import type {
  AlertLevel,
  AlertSummary,
  WatershedScore,
  ScoredSignal,
  CompoundMatch,
  PinRole,
} from "../types/sentinel";

// ---------------------------------------------------------------------------
// Alert level styling
// ---------------------------------------------------------------------------

const LEVEL_CONFIG: Record<
  AlertLevel,
  { bg: string; text: string; border: string; badge: string; pulse: boolean }
> = {
  ALERT: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-300",
    badge: "bg-red-600 text-white",
    pulse: true,
  },
  ADVISORY: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-300",
    badge: "bg-amber-500 text-white",
    pulse: false,
  },
  WATCH: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-300",
    badge: "bg-blue-500 text-white",
    pulse: false,
  },
  NORMAL: {
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
    badge: "bg-slate-400 text-white",
    pulse: false,
  },
};

const LEVEL_ORDER: AlertLevel[] = ["ALERT", "ADVISORY", "WATCH", "NORMAL"];

// ---------------------------------------------------------------------------
// Signal type display names
// ---------------------------------------------------------------------------

const SIGNAL_LABELS: Record<string, string> = {
  NWS_FLOOD_WARNING: "Flood Warning",
  NWS_FLOOD_WATCH: "Flood Watch",
  SSO_CSO_EVENT: "SSO/CSO Discharge",
  NPDES_EXCEEDANCE: "Permit Exceedance",
  USGS_FLOOD_STAGE: "Flood Stage Reached",
  USGS_ACTION_STAGE: "Action Stage Reached",
  RAINFALL_THRESHOLD: "Heavy Rainfall",
  FEMA_DECLARATION: "FEMA Declaration",
  ATTAINS_CHANGE: "Assessment Update",
  ECHO_ENFORCEMENT: "Enforcement Action",
  MULTI_STATION_EXCEEDANCE: "Multi-Station Violations",
};

const PATTERN_LABELS: Record<string, string> = {
  POTOMAC_PATTERN: "Sewage + Weather + Impact",
  INFRASTRUCTURE_STRESS: "Infrastructure Under Stress",
  SPREADING_CONTAMINATION: "Spreading Contamination",
  REGULATORY_ESCALATION: "Regulatory Escalation",
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function AlertLevelBadge({ level }: { level: AlertLevel }) {
  const config = LEVEL_CONFIG[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${config.badge}`}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-100" />
        </span>
      )}
      {level}
    </span>
  );
}

function ScoreMeter({ score }: { score: number }) {
  // Visual meter: 0-200+ mapped to width percentage (max 200 for scale)
  const maxScore = 200;
  const pct = Math.min(100, (score / maxScore) * 100);
  const color =
    score >= 150
      ? "bg-red-500"
      : score >= 100
        ? "bg-amber-500"
        : score >= 50
          ? "bg-blue-500"
          : "bg-slate-300";
  const label = score >= 150 ? 'Alert' : score >= 100 ? 'Advisory' : score >= 50 ? 'Watch' : 'Normal';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono font-semibold text-slate-600 text-right whitespace-nowrap" title={`Score ${score}/${maxScore} — ${label} threshold`}>
        {score}
      </span>
    </div>
  );
}

function SignalChip({ signal }: { signal: ScoredSignal }) {
  const label = SIGNAL_LABELS[signal.signalType] || signal.signalType;
  const severity = signal.changeEvent.severityHint;
  const severityColor =
    severity === "CRITICAL"
      ? "bg-red-100 text-red-700"
      : severity === "HIGH"
        ? "bg-amber-100 text-amber-700"
        : severity === "MEDIUM"
          ? "bg-blue-100 text-blue-700"
          : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${severityColor}`}
    >
      {label}
    </span>
  );
}

function CompoundPatternTag({ match }: { match: CompoundMatch }) {
  const label = PATTERN_LABELS[match.pattern] || match.pattern;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
          clipRule="evenodd"
        />
      </svg>
      {label} ({match.multiplier}x)
    </span>
  );
}

function TimeAgo({ timestamp }: { timestamp: string }) {
  const minutes = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 60000
  );
  let display: string;
  if (minutes < 1) display = "just now";
  else if (minutes < 60) display = `${minutes}m ago`;
  else if (minutes < 1440) display = `${Math.floor(minutes / 60)}h ago`;
  else display = `${Math.floor(minutes / 1440)}d ago`;

  return <span className="text-xs text-slate-400">{display}</span>;
}

// ---------------------------------------------------------------------------
// Event Detail (expandable row)
// ---------------------------------------------------------------------------

function EventDetail({ event }: { event: WatershedScore }) {
  return (
    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 space-y-3">
      {/* Compound patterns detected */}
      {event.compoundMatches.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Compound Patterns Detected
          </p>
          <div className="flex flex-wrap gap-1.5">
            {event.compoundMatches.map((match, i) => (
              <CompoundPatternTag key={i} match={match} />
            ))}
          </div>
        </div>
      )}

      {/* Contributing signals timeline */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Contributing Signals ({event.signalCount})
        </p>
        <div className="space-y-1">
          {event.signals
            .sort(
              (a, b) =>
                new Date(b.changeEvent.detectedAt).getTime() -
                new Date(a.changeEvent.detectedAt).getTime()
            )
            .map((signal, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <SignalChip signal={signal} />
                  <span className="text-slate-500">
                    {signal.changeEvent.source}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-500">
                    +{signal.effectiveScore.toFixed(0)}
                  </span>
                  <TimeAgo timestamp={signal.changeEvent.detectedAt} />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Affected downstream entities */}
      {(event.affectedEntities.shellfishBeds.length > 0 ||
        event.affectedEntities.recreationalWaters.length > 0 ||
        event.affectedEntities.drinkingWaterIntakes.length > 0) && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Downstream Impact
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {event.affectedEntities.shellfishBeds.length > 0 && (
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="font-semibold text-slate-700">Shellfish Beds</p>
                <p className="text-slate-500">
                  {event.affectedEntities.shellfishBeds.length} affected
                </p>
              </div>
            )}
            {event.affectedEntities.recreationalWaters.length > 0 && (
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="font-semibold text-slate-700">Recreational</p>
                <p className="text-slate-500">
                  {event.affectedEntities.recreationalWaters.length} affected
                </p>
              </div>
            )}
            {event.affectedEntities.drinkingWaterIntakes.length > 0 && (
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="font-semibold text-slate-700">
                  Drinking Water
                </p>
                <p className="text-slate-500">
                  {event.affectedEntities.drinkingWaterIntakes.length} intakes
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action button — connects to Response Planner */}
      {event.alertLevel === "ALERT" || event.alertLevel === "ADVISORY" ? (
        <button className="w-full mt-2 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded hover:bg-slate-700 transition-colors">
          Open in Response Planner →
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Row
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: WatershedScore }) {
  const [expanded, setExpanded] = useState(false);
  const config = LEVEL_CONFIG[event.alertLevel];

  return (
    <div className={`border rounded-lg overflow-hidden ${config.border}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-4 py-3 ${config.bg} hover:brightness-95 transition-all`}
      >
        <div className="flex items-start justify-between">
          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <AlertLevelBadge level={event.alertLevel} />
              <span className="text-sm font-semibold text-slate-800">
                {event.watershedName}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {event.compoundMatches.length > 0 ? (
                event.compoundMatches.map((m, i) => (
                  <CompoundPatternTag key={i} match={m} />
                ))
              ) : (
                event.signals.slice(0, 3).map((s, i) => (
                  <SignalChip key={i} signal={s} />
                ))
              )}
              {event.signals.length > 3 && event.compoundMatches.length === 0 && (
                <span className="text-xs text-slate-400">
                  +{event.signals.length - 3} more
                </span>
              )}
            </div>
            <ScoreMeter score={event.compositeScore} />
          </div>
          <div className="flex flex-col items-end gap-1">
            <TimeAgo timestamp={event.lastSignalAt} />
            <span className="text-xs text-slate-400">
              {event.signalCount} signal{event.signalCount !== 1 ? "s" : ""}
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </button>
      {expanded && <EventDetail event={event} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Header
// ---------------------------------------------------------------------------

function SummaryHeader({ summary }: { summary: AlertSummary }) {
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {LEVEL_ORDER.map((level) => {
        const count = summary.byLevel[level] || 0;
        const config = LEVEL_CONFIG[level];
        return (
          <div
            key={level}
            className={`rounded-lg px-3 py-2 border text-center ${config.bg} ${config.border}`}
          >
            <p className={`text-2xl font-bold ${config.text}`}>{count}</p>
            <p className="text-xs text-slate-500 font-medium">{level}</p>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Card Component
// ---------------------------------------------------------------------------

interface AMSAlertMonitorProps {
  summary: AlertSummary;
  role: PinRole;
  onOpenResponsePlanner?: (event: WatershedScore) => void;
}

export default function AMSAlertMonitor({
  summary,
  role,
}: AMSAlertMonitorProps) {
  const [filterLevel, setFilterLevel] = useState<AlertLevel | "ALL">("ALL");

  const filteredEvents = useMemo(() => {
    let events = summary.recentEvents;
    if (filterLevel !== "ALL") {
      events = events.filter((e) => e.alertLevel === filterLevel);
    }
    // Sort by composite score descending
    return [...events].sort((a, b) => b.compositeScore - a.compositeScore);
  }, [summary.recentEvents, filterLevel]);

  const hasActiveAlerts =
    summary.byLevel.ALERT > 0 || summary.byLevel.ADVISORY > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasActiveAlerts && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
          )}
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Alert Monitor
          </h3>
          <span className="text-xs text-slate-400 font-medium">AMS</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">
            {summary.total} active
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Summary counts */}
        <SummaryHeader summary={summary} />

        {/* Filter tabs */}
        <div className="flex gap-1 mb-3 border-b border-slate-100 pb-2">
          {(["ALL", ...LEVEL_ORDER] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filterLevel === level
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Event feed */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">✓</div>
              <p className="text-sm text-slate-500">
                No active events at this level
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Sentinel monitoring {Object.keys(SIGNAL_LABELS).length} signal
                types
              </p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <EventRow key={event.huc8} event={event} />
            ))
          )}
        </div>
      </div>

      {/* Card Footer — last update */}
      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Sentinel active · {summary.total} watershed
          {summary.total !== 1 ? "s" : ""} monitored
        </span>
        <span className="text-xs text-slate-400">
          Role: {role.replace(/_/g, " ")}
        </span>
      </div>
    </div>
  );
}
