// =============================================================================
// Sentinel Health Monitor
// Admin-only component showing Tier 1 source health status.
// Lives in settings/admin area, not customer-facing.
// =============================================================================

"use client";

import React from "react";
import type { SentinelHealth, DataSource } from "../types/sentinel";

const SOURCE_LABELS: Record<DataSource, string> = {
  NWS_ALERTS: "NWS Alerts",
  USGS_NWIS: "USGS Stream Gauges",
  STATE_SSO_CSO: "State SSO/CSO",
  NPDES_DMR: "NPDES Violations",
  NWS_QPE_RAINFALL: "NWS Rainfall (QPE)",
  ATTAINS: "EPA ATTAINS",
  STATE_DISCHARGE: "State Discharge Reports",
  FEMA_DISASTER: "FEMA Declarations",
  EPA_ECHO: "EPA ECHO Enforcement",
};

const STATUS_CONFIG = {
  HEALTHY: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    label: "Healthy",
  },
  DEGRADED: {
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    label: "Degraded",
  },
  OFFLINE: {
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
    label: "Offline",
  },
};

interface SentinelHealthMonitorProps {
  sources: SentinelHealth[];
}

export default function SentinelHealthMonitor({
  sources,
}: SentinelHealthMonitorProps) {
  const healthyCount = sources.filter((s) => s.status === "HEALTHY").length;
  const degradedCount = sources.filter((s) => s.status === "DEGRADED").length;
  const offlineCount = sources.filter((s) => s.status === "OFFLINE").length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              offlineCount > 0
                ? "bg-red-500"
                : degradedCount > 0
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
          />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Sentinel Health
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-600 font-medium">
            {healthyCount} healthy
          </span>
          {degradedCount > 0 && (
            <span className="text-amber-600 font-medium">
              {degradedCount} degraded
            </span>
          )}
          {offlineCount > 0 && (
            <span className="text-red-600 font-medium">
              {offlineCount} offline
            </span>
          )}
        </div>
      </div>

      {/* Source list */}
      <div className="divide-y divide-slate-100">
        {sources.map((source) => {
          const config = STATUS_CONFIG[source.status];
          const label = SOURCE_LABELS[source.source] || source.source;

          const lastPollMinutes = source.lastPollAt
            ? Math.floor(
                (Date.now() - new Date(source.lastPollAt).getTime()) / 60000
              )
            : null;

          let lastPollStr = "Never";
          if (lastPollMinutes !== null) {
            if (lastPollMinutes < 1) lastPollStr = "Just now";
            else if (lastPollMinutes < 60)
              lastPollStr = `${lastPollMinutes}m ago`;
            else lastPollStr = `${Math.floor(lastPollMinutes / 60)}h ago`;
          }

          return (
            <div
              key={source.source}
              className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className="text-xs text-slate-400">
                    Last poll: {lastPollStr}
                    {source.avgResponseTimeMs > 0 &&
                      ` · ${source.avgResponseTimeMs}ms avg`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {source.consecutiveFailures > 0 && (
                  <span className="text-xs text-red-500 font-medium">
                    {source.consecutiveFailures} failures
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}
                >
                  {config.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
