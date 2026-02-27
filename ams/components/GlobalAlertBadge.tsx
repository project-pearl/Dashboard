// =============================================================================
// Global Alert Badge
// Persistent top-bar component visible across all CCs and roles.
// Clicking opens a slide-out panel or navigates to Disaster/Emergency.
// =============================================================================

"use client";

import React, { useState } from "react";
import type { AlertSummary, WatershedScore, AlertLevel } from "../types/sentinel";

interface GlobalAlertBadgeProps {
  summary: AlertSummary;
  onNavigateToDisaster?: () => void;
}

export default function GlobalAlertBadge({
  summary,
  onNavigateToDisaster,
}: GlobalAlertBadgeProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  const alertCount = summary.byLevel.ALERT || 0;
  const advisoryCount = summary.byLevel.ADVISORY || 0;
  const activeCount = alertCount + advisoryCount;
  const hasAlerts = alertCount > 0;
  const hasAdvisories = advisoryCount > 0;

  // Determine badge color based on highest active level
  const badgeColor = hasAlerts
    ? "bg-red-500"
    : hasAdvisories
      ? "bg-amber-500"
      : "bg-slate-400";

  return (
    <>
      {/* Badge button — sits in global nav */}
      <button
        onClick={() => {
          if (activeCount > 0) {
            setPanelOpen(!panelOpen);
          } else if (onNavigateToDisaster) {
            onNavigateToDisaster();
          }
        }}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        title={`${activeCount} active alert${activeCount !== 1 ? "s" : ""}`}
      >
        {/* Bell icon */}
        <svg
          className="w-5 h-5 text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Count badge */}
        {activeCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white ${badgeColor}`}
          >
            {hasAlerts && (
              <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-40" />
            )}
            <span className="relative">{activeCount}</span>
          </span>
        )}
      </button>

      {/* Slide-out panel */}
      {panelOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setPanelOpen(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col">
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Active Alerts
                </h3>
                <p className="text-xs text-slate-500">
                  {alertCount} alert{alertCount !== 1 ? "s" : ""},{" "}
                  {advisoryCount} advisor{advisoryCount !== 1 ? "ies" : "y"}
                </p>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <svg
                  className="w-5 h-5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable event list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {summary.recentEvents
                .filter(
                  (e) =>
                    e.alertLevel === "ALERT" || e.alertLevel === "ADVISORY"
                )
                .sort((a, b) => b.compositeScore - a.compositeScore)
                .map((event) => (
                  <QuickAlertCard key={event.huc8} event={event} />
                ))}
            </div>

            {/* Footer — link to full AMS */}
            <div className="px-4 py-3 border-t border-slate-200">
              <button
                onClick={() => {
                  setPanelOpen(false);
                  onNavigateToDisaster?.();
                }}
                className="w-full px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded hover:bg-slate-700 transition-colors"
              >
                Open Disaster/Emergency →
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Quick card for the slide-out panel (compact version)
// ---------------------------------------------------------------------------

function QuickAlertCard({ event }: { event: WatershedScore }) {
  const isAlert = event.alertLevel === "ALERT";
  const borderColor = isAlert ? "border-red-300" : "border-amber-300";
  const bgColor = isAlert ? "bg-red-50" : "bg-amber-50";

  const minutes = Math.floor(
    (Date.now() - new Date(event.lastSignalAt).getTime()) / 60000
  );
  const timeStr =
    minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
              isAlert ? "bg-red-600 text-white" : "bg-amber-500 text-white"
            }`}
          >
            {isAlert && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-100" />
              </span>
            )}
            {event.alertLevel}
          </span>
          <p className="text-sm font-semibold text-slate-800 mt-1">
            {event.watershedName}
          </p>
        </div>
        <span className="text-xs text-slate-400">{timeStr}</span>
      </div>

      {/* Compound pattern summary */}
      {event.compoundMatches.length > 0 && (
        <p className="text-xs text-slate-600 mb-2">
          {event.compoundMatches
            .map((m) => {
              const labels: Record<string, string> = {
                POTOMAC_PATTERN: "Sewage + Weather + Impact",
                INFRASTRUCTURE_STRESS: "Infrastructure Stress",
                SPREADING_CONTAMINATION: "Spreading Contamination",
                REGULATORY_ESCALATION: "Regulatory Escalation",
              };
              return labels[m.pattern] || m.pattern;
            })
            .join(" · ")}
        </p>
      )}

      {/* Score bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isAlert ? "bg-red-500" : "bg-amber-500"}`}
            style={{
              width: `${Math.min(100, (event.compositeScore / 200) * 100)}%`,
            }}
          />
        </div>
        <span className="text-xs font-mono font-semibold text-slate-600">
          {event.compositeScore}
        </span>
      </div>

      <p className="text-xs text-slate-400 mt-1">
        {event.signalCount} correlated signal
        {event.signalCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
