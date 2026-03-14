/**
 * Compliance Calendar Event Aggregation — Server-side only.
 *
 * Reads from existing warmed caches (ms4PermitCache, icisCache, sdwisCache)
 * to produce auto-populated calendar events. No new API calls.
 */

import { getMs4PermitsByState, type Ms4Permit } from './ms4PermitCache';
import { getIcisAllData, type IcisPermit, type IcisEnforcement } from './icisCache';
import { getSdwisForState } from './sdwisCache';

// ── Unified Event Type ──────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;                  // YYYY-MM-DD
  type: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'upcoming' | 'in-progress' | 'completed' | 'overdue' | 'skipped';
  source: 'auto' | 'user';
  permitId?: string;
  facilityName?: string;
  daysUntil: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function priorityFromDays(days: number): CalendarEvent['priority'] {
  if (days <= 0) return 'critical';
  if (days <= 90) return 'critical';
  if (days <= 180) return 'high';
  return 'medium';
}

function parseDate(d: string | undefined | null): string | null {
  if (!d) return null;
  // Handle MM/DD/YYYY, YYYY-MM-DD, etc.
  const iso = d.includes('T') ? d.split('T')[0] : d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const parts = iso.split('/');
  if (parts.length === 3) {
    const [m, day, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

// ── Hardcoded Federal Deadlines ──────────────────────────────────────────────

const FEDERAL_DEADLINES: Omit<CalendarEvent, 'daysUntil' | 'status'>[] = [
  {
    id: 'auto-fed-annual-report',
    title: 'MS4 Annual Report Due',
    description: 'Annual MS4 stormwater management program report submission deadline',
    date: `${new Date().getFullYear()}-10-01`,
    type: 'annual-report',
    category: 'reporting',
    priority: 'high',
    source: 'auto',
  },
  {
    id: 'auto-fed-lsl-inventory',
    title: 'Lead Service Line Inventory Due',
    description: 'LCRR initial lead service line inventory submission deadline',
    date: `${new Date().getFullYear()}-06-30`,
    type: 'permit-deadline',
    category: 'compliance',
    priority: 'high',
    source: 'auto',
  },
  {
    id: 'auto-fed-pfas-monitoring',
    title: 'PFAS Monitoring Results Due',
    description: 'UCMR5 PFAS monitoring results submission deadline',
    date: `${new Date().getFullYear()}-10-01`,
    type: 'permit-deadline',
    category: 'compliance',
    priority: 'high',
    source: 'auto',
  },
  {
    id: 'auto-fed-arpa-obligation',
    title: 'ARPA Fund Obligation Deadline',
    description: 'American Rescue Plan Act water infrastructure fund obligation deadline',
    date: '2026-12-31',
    type: 'permit-deadline',
    category: 'compliance',
    priority: 'medium',
    source: 'auto',
  },
];

// ── Auto-Populate from Caches ────────────────────────────────────────────────

export function getAutoPopulatedEvents(state: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const seenPermitIds = new Set<string>();

  // ── MS4 Permit Expirations ──
  const ms4Permits = getMs4PermitsByState(state);
  for (const p of ms4Permits) {
    const expDate = parseDate(p.expirationDate);
    if (!expDate) continue;
    seenPermitIds.add(p.permitId);
    const days = daysUntil(expDate);
    events.push({
      id: `auto-ms4-${p.permitId}-exp`,
      title: `Permit Expiration: ${p.permittee}`,
      description: `${p.permitType} permit ${p.permitId} expires`,
      date: expDate,
      type: 'permit-expiration',
      category: 'compliance',
      priority: priorityFromDays(days),
      status: days < 0 ? 'overdue' : 'upcoming',
      source: 'auto',
      permitId: p.permitId,
      facilityName: p.permittee,
      daysUntil: days,
    });
  }

  // ── ICIS Data ──
  const icis = getIcisAllData();

  // ICIS Permit expirations (dedup with MS4)
  for (const p of icis.permits) {
    if (p.state !== state.toUpperCase()) continue;
    if (seenPermitIds.has(p.permit)) continue;
    const expDate = parseDate(p.expiration);
    if (!expDate) continue;
    const days = daysUntil(expDate);
    events.push({
      id: `auto-icis-${p.permit}-exp`,
      title: `NPDES Permit Expiration: ${p.facility}`,
      description: `NPDES permit ${p.permit} (${p.type}) expires`,
      date: expDate,
      type: 'permit-expiration',
      category: 'compliance',
      priority: priorityFromDays(days),
      status: days < 0 ? 'overdue' : 'upcoming',
      source: 'auto',
      permitId: p.permit,
      facilityName: p.facility,
      daysUntil: days,
    });
  }

  // ICIS Enforcement settlement dates
  for (const e of icis.enforcement) {
    if (!e.permit) continue;
    // Match state by checking if permit starts with state abbr
    const permitState = icis.permits.find(p => p.permit === e.permit)?.state;
    if (permitState && permitState !== state.toUpperCase()) continue;
    const setDate = parseDate(e.settlementDate);
    if (!setDate) continue;
    const days = daysUntil(setDate);
    events.push({
      id: `auto-icis-${e.permit}-enf-${e.caseNumber}`,
      title: `Enforcement: ${e.actionType}`,
      description: `Case ${e.caseNumber} — Penalty: $${(e.penaltyAssessed || 0).toLocaleString()}`,
      date: setDate,
      type: 'enforcement-date',
      category: 'compliance',
      priority: 'high',
      status: days < 0 ? 'overdue' : 'upcoming',
      source: 'auto',
      permitId: e.permit,
      daysUntil: days,
    });
  }

  // ── SDWIS Data ──
  const sdwis = getSdwisForState(state);
  if (sdwis) {
    // SDWIS Violation compliance periods
    for (const v of sdwis.violations) {
      const compDate = parseDate(v.compliancePeriod);
      if (!compDate) continue;
      const days = daysUntil(compDate);
      events.push({
        id: `auto-sdwis-${v.pwsid}-viol-${v.code}`,
        title: `Compliance Deadline: ${v.contaminant}`,
        description: `${v.rule} violation (${v.code}) — ${v.isMajor ? 'Major' : 'Minor'}${v.isHealthBased ? ', Health-based' : ''}`,
        date: compDate,
        type: 'permit-deadline',
        category: 'compliance',
        priority: v.isMajor || v.isHealthBased ? 'critical' : 'high',
        status: days < 0 ? 'overdue' : 'upcoming',
        source: 'auto',
        permitId: v.pwsid,
        daysUntil: days,
      });
    }

    // SDWIS Enforcement action dates
    for (const e of sdwis.enforcement) {
      const enfDate = parseDate(e.date);
      if (!enfDate) continue;
      const days = daysUntil(enfDate);
      events.push({
        id: `auto-sdwis-${e.pwsid}-enf-${e.actionType}`,
        title: `DW Enforcement: ${e.actionType}`,
        description: `Drinking water enforcement action for PWS ${e.pwsid}`,
        date: enfDate,
        type: 'enforcement-date',
        category: 'compliance',
        priority: 'high',
        status: days < 0 ? 'overdue' : 'upcoming',
        source: 'auto',
        permitId: e.pwsid,
        daysUntil: days,
      });
    }
  }

  // ── Federal Deadlines ──
  for (const fd of FEDERAL_DEADLINES) {
    const days = daysUntil(fd.date);
    events.push({
      ...fd,
      status: days < 0 ? 'overdue' : 'upcoming',
      daysUntil: days,
    });
  }

  return events;
}
