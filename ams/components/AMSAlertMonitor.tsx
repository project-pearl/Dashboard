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
// Subcomponents
// ---------------------------------------------------------------------------


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
// Event Row
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: WatershedScore }) {
  const config = LEVEL_CONFIG[event.alertLevel];

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
      <span className={`flex-shrink-0 w-2 h-2 rounded-full ${config.badge.split(' ')[0]}`} />
      <span className="text-xs font-medium text-slate-700 truncate flex-1">{event.watershedName}</span>
      <TimeAgo timestamp={event.lastSignalAt} />
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
  summary: AlertSummary | null;
  role: PinRole;
  onOpenResponsePlanner?: (event: WatershedScore) => void;
  onEventClick?: (huc8: string) => void;
}

export default function AMSAlertMonitor({
  summary,
  role,
  onEventClick,
}: AMSAlertMonitorProps) {
  const [filterLevel, setFilterLevel] = useState<AlertLevel | "ALL">("ALL");

  const filteredEvents = useMemo(() => {
    if (!summary) return [];
    let events = summary.recentEvents;
    if (filterLevel !== "ALL") {
      events = events.filter((e) => e.alertLevel === filterLevel);
    }
    // Sort by composite score descending
    return [...events].sort((a, b) => b.compositeScore - a.compositeScore);
  }, [summary, filterLevel]);

  if (!summary) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200" />
          <div className="text-xs text-slate-400">Loading Sentinel alerts...</div>
        </div>
      </div>
    );
  }

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
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div key={event.huc8} onClick={() => onEventClick?.(event.huc8)} className={onEventClick ? 'cursor-pointer' : ''}>
                <EventRow event={event} />
              </div>
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
