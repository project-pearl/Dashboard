/* ═══════════════════════════════════════════════════════════════════════════
   Staffing Calculator — Pure function module (no React)
   ═══════════════════════════════════════════════════════════════════════════ */

import type { NGO, CommunityEvent } from '@/components/treatment/treatmentData';
import { OPEX_TEAM_YEAR } from '@/components/treatment/treatmentData';

export const VOLUNTEER_HOURLY_RATE = 29.95; // Independent Sector national average

export interface StaffingResult {
  restorationStaff: number;
  annualStaffCost: number;
  partnerFteOffset: number;
  volunteerFteOffset: number;
  volunteerHoursYear: number;
  volunteerCostOffset: number;
  netStaffNeeded: number;
  netAnnualCost: number;
}

/** Estimate annual volunteer hours from event frequency */
function estimateHoursPerYear(freq: string, volunteers: number): number {
  // Hours per occurrence × occurrences per year
  const hoursPerOccurrence = 4; // average cleanup/event day
  let occurrences: number;
  switch (freq) {
    case 'Monthly':      occurrences = 12; break;
    case 'Quarterly':    occurrences = 4;  break;
    case 'Bi-annual':
    case 'Semi-annual':  occurrences = 2;  break;
    case 'Annual':       occurrences = 1;  break;
    default:             occurrences = 2;  break;
  }
  return volunteers * hoursPerOccurrence * occurrences;
}

export function calculateStaffing(
  selectedModuleCount: number,
  pinUnits: number,
  selectedNGOs: NGO[],
  selectedEvents: CommunityEvent[],
  _timelineYrs: number,
): StaffingResult {
  // Base staff: 1 per 8 modules + 1 per 12 PIN units
  const restorationStaff =
    Math.ceil(selectedModuleCount / 8) +
    (pinUnits > 0 ? Math.ceil(pinUnits / 12) : 0);

  const annualStaffCost = restorationStaff * OPEX_TEAM_YEAR;

  // Partner in-kind → FTE equivalence
  const partnerValue = selectedNGOs.reduce((s, n) => s + n.value, 0);
  const partnerFteOffset = partnerValue / OPEX_TEAM_YEAR;

  // Volunteer hours → cost offset → FTE
  const volunteerHoursYear = selectedEvents.reduce(
    (s, ev) => s + estimateHoursPerYear(ev.freq, ev.volunteers),
    0,
  );
  const volunteerCostOffset = volunteerHoursYear * VOLUNTEER_HOURLY_RATE;
  const volunteerFteOffset = volunteerCostOffset / OPEX_TEAM_YEAR;

  const netStaffNeeded = Math.max(0, restorationStaff - partnerFteOffset - volunteerFteOffset);
  const netAnnualCost = netStaffNeeded * OPEX_TEAM_YEAR;

  return {
    restorationStaff,
    annualStaffCost,
    partnerFteOffset,
    volunteerFteOffset,
    volunteerHoursYear,
    volunteerCostOffset,
    netStaffNeeded,
    netAnnualCost,
  };
}
