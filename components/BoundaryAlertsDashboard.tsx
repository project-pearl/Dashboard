// =============================================================
// Watershed Boundary Alerts — Dashboard Component
// PEARL Intelligence Network (PIN)
//
// Displays in the MS4 Management Center.
// Shows alerts from upstream/downstream waterbodies
// crossing thresholds, with contact info for neighboring MS4s.
// =============================================================

"use client";

import { useState, useMemo } from "react";
import {
  BoundaryAlert,
  AlertSeverity,
  AlertStatus,
  ImpairmentCategory,
} from "@/lib/types";
import { formatAlertMessage } from "@/lib/boundary-alerts";

// ----- Styles -----

const severityStyles: Record<AlertSeverity, { bg: string; border: string; icon: string; badge: string }> = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-300",
    icon: "🔴",
    badge: "bg-red-600 text-white",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    icon: "🟡",
    badge: "bg-amber-500 text-white",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-300",
    icon: "🔵",
    badge: "bg-blue-500 text-white",
  },
};

const statusLabels: Record<AlertStatus, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_contact: "In Contact",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const categoryLabels: Record<ImpairmentCategory, string> = {
  nutrients: "Nutrients",
  bacteria: "Bacteria",
  sediment: "Sediment",
  metals: "Metals",
  temperature: "Temperature",
  dissolved_oxygen: "Dissolved Oxygen",
  pfas: "PFAS",
  other: "Other",
};

// ----- Filter Bar -----

interface FilterState {
  severity: AlertSeverity | "all";
  status: AlertStatus | "all";
  relationship: "upstream" | "downstream" | "all";
  category: ImpairmentCategory | "all";
}

function AlertFilterBar({
  filters,
  onChange,
  alertCounts,
}: {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  alertCounts: { critical: number; warning: number; info: number };
}) {
  return (
    <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
      {/* Severity quick filters */}
      <div className="flex gap-1">
        <button
          onClick={() => onChange({ ...filters, severity: "all" })}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            filters.severity === "all"
              ? "bg-gray-700 text-white"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          All ({alertCounts.critical + alertCounts.warning + alertCounts.info})
        </button>
        <button
          onClick={() => onChange({ ...filters, severity: "critical" })}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            filters.severity === "critical"
              ? "bg-red-600 text-white"
              : "bg-white text-gray-600 hover:bg-red-50"
          }`}
        >
          🔴 Critical ({alertCounts.critical})
        </button>
        <button
          onClick={() => onChange({ ...filters, severity: "warning" })}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            filters.severity === "warning"
              ? "bg-amber-500 text-white"
              : "bg-white text-gray-600 hover:bg-amber-50"
          }`}
        >
          🟡 Warning ({alertCounts.warning})
        </button>
      </div>

      {/* Relationship filter */}
      <select
        value={filters.relationship}
        onChange={(e) =>
          onChange({ ...filters, relationship: e.target.value as FilterState["relationship"] })
        }
        className="px-3 py-1 rounded-lg border border-gray-200 text-sm bg-white"
      >
        <option value="all">↕ All Directions</option>
        <option value="upstream">↓ Upstream Only</option>
        <option value="downstream">↑ Downstream Only</option>
      </select>

      {/* Status filter */}
      <select
        value={filters.status}
        onChange={(e) =>
          onChange({ ...filters, status: e.target.value as FilterState["status"] })
        }
        className="px-3 py-1 rounded-lg border border-gray-200 text-sm bg-white"
      >
        <option value="all">All Statuses</option>
        <option value="new">New</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="in_contact">In Contact</option>
        <option value="resolved">Resolved</option>
      </select>

      {/* Category filter */}
      <select
        value={filters.category}
        onChange={(e) =>
          onChange({ ...filters, category: e.target.value as FilterState["category"] })
        }
        className="px-3 py-1 rounded-lg border border-gray-200 text-sm bg-white"
      >
        <option value="all">All Parameters</option>
        {Object.entries(categoryLabels).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
    </div>
  );
}

// ----- Individual Alert Card -----

function AlertCard({
  alert,
  onStatusChange,
  onAddNote,
}: {
  alert: BoundaryAlert;
  onStatusChange: (alertId: string, status: AlertStatus) => void;
  onAddNote: (alertId: string, note: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState("");
  const style = severityStyles[alert.severity];

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(alert.timestamp).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
  }, [alert.timestamp]);

  const relationshipArrow = alert.relationship === "upstream" ? "↓" : "↑";
  const relationshipLabel = alert.relationship === "upstream"
    ? "Upstream of your waters"
    : "Downstream of your waters";

  return (
    <div
      className={`border rounded-lg ${style.bg} ${style.border} transition-all duration-200`}
    >
      {/* Alert header — always visible */}
      <div
        className="p-4 cursor-pointer flex items-start gap-3"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xl mt-0.5">{style.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">
              {alert.parameter}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.badge}`}>
              {alert.severity.toUpperCase()}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
              {statusLabels[alert.status]}
            </span>
          </div>

          <p className="text-sm text-gray-600 mt-1">
            {relationshipArrow} {alert.sourceWaterbodyName} — {relationshipLabel}
          </p>

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>{timeAgo}</span>
            <span>
              {alert.percentOverThreshold.toFixed(0)}%{" "}
              {alert.direction === "rising" ? "over" : "under"} threshold
            </span>
            <span>
              Contact: <strong className="text-gray-700">{alert.neighborPermitteeName}</strong>
            </span>
          </div>
        </div>

        <button className="text-gray-400 hover:text-gray-600 mt-1">
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {/* Expanded detail — no neighbor compliance data shown */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-200 pt-3">
          {/* Key info grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Waterbody</p>
              <p className="font-medium text-sm">{alert.sourceWaterbodyName}</p>
              <p className="text-xs text-gray-400">{alert.sourceWaterbodyId}</p>
            </div>
            <div className="bg-white rounded p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Parameter</p>
              <p className="font-medium text-sm">{alert.parameter}</p>
              <p className="text-xs text-gray-400">
                Threshold: {alert.threshold} {alert.unit}
              </p>
            </div>
            <div className="bg-white rounded p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Neighboring Jurisdiction</p>
              <p className="font-medium text-sm">{alert.neighborPermitteeName}</p>
              <p className="text-xs text-gray-400">
                Contact: {alert.neighborContactName}
              </p>
            </div>
            <div className="bg-white rounded p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Direction</p>
              <p className="font-medium text-sm capitalize">{alert.relationship}</p>
              <p className="text-xs text-gray-400">
                {alert.relationship === "upstream"
                  ? "This waterbody flows into your permitted waters"
                  : "Your waters flow into this waterbody"}
              </p>
            </div>
          </div>

          {/* Privacy notice */}
          <div className="bg-white border border-gray-200 rounded p-3 mb-4 text-xs text-gray-500 italic">
            This alert is for watershed coordination purposes only. No compliance
            data from {alert.neighborPermitteeName} is included. Please reach out
            directly to coordinate on shared water quality concerns.
          </div>

          {/* Status actions */}
          <div className="flex gap-2 mb-4">
            {alert.status === "new" && (
              <button
                onClick={() => onStatusChange(alert.id, "acknowledged")}
                className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Acknowledge
              </button>
            )}
            {(alert.status === "new" || alert.status === "acknowledged") && (
              <button
                onClick={() => onStatusChange(alert.id, "in_contact")}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Mark as In Contact
              </button>
            )}
            {alert.status !== "resolved" && alert.status !== "dismissed" && (
              <>
                <button
                  onClick={() => onStatusChange(alert.id, "resolved")}
                  className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Resolve
                </button>
                <button
                  onClick={() => onStatusChange(alert.id, "dismissed")}
                  className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Notes
            </p>
            {alert.notes.length > 0 && (
              <div className="space-y-1 mb-2">
                {alert.notes.map((note, i) => (
                  <p key={i} className="text-sm text-gray-600 bg-white rounded p-2">
                    {note}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note about this alert..."
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm"
              />
              <button
                onClick={() => {
                  if (noteText.trim()) {
                    onAddNote(alert.id, noteText.trim());
                    setNoteText("");
                  }
                }}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Main Dashboard Component -----

export interface BoundaryAlertsDashboardProps {
  alerts: BoundaryAlert[];
  permitteeName: string;
  onStatusChange: (alertId: string, status: AlertStatus) => void;
  onAddNote: (alertId: string, note: string) => void;
}

export default function BoundaryAlertsDashboard({
  alerts,
  permitteeName,
  onStatusChange,
  onAddNote,
}: BoundaryAlertsDashboardProps) {
  const [filters, setFilters] = useState<FilterState>({
    severity: "all",
    status: "all",
    relationship: "all",
    category: "all",
  });

  // Count alerts by severity (unfiltered)
  const alertCounts = useMemo(
    () => ({
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      info: alerts.filter((a) => a.severity === "info").length,
    }),
    [alerts]
  );

  // Apply filters
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (filters.severity !== "all" && alert.severity !== filters.severity) return false;
      if (filters.status !== "all" && alert.status !== filters.status) return false;
      if (filters.relationship !== "all" && alert.relationship !== filters.relationship) return false;
      if (filters.category !== "all" && alert.category !== filters.category) return false;
      return true;
    });
  }, [alerts, filters]);

  // Active (non-resolved/dismissed) alert count
  const activeCount = alerts.filter(
    (a) => a.status !== "resolved" && a.status !== "dismissed"
  ).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Watershed Boundary Alerts
          </h2>
          <p className="text-sm text-gray-500">
            Threshold changes on waterbodies bordering {permitteeName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active Alerts</p>
        </div>
      </div>

      {/* Summary bar */}
      {alertCounts.critical > 0 && (
        <div className="bg-red-600 text-white px-4 py-2 rounded-lg mb-4 text-sm font-medium">
          {alertCounts.critical} critical alert{alertCounts.critical !== 1 ? "s" : ""} requiring attention
        </div>
      )}

      {/* Filters */}
      <AlertFilterBar
        filters={filters}
        onChange={setFilters}
        alertCounts={alertCounts}
      />

      {/* Alert list */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No alerts match your filters</p>
            <p className="text-sm mt-1">
              {alerts.length === 0
                ? "All boundary waterbodies are within normal thresholds"
                : "Try adjusting your filter criteria"}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onStatusChange={onStatusChange}
              onAddNote={onAddNote}
            />
          ))
        )}
      </div>
    </div>
  );
}
