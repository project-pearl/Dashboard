// lib/lensRegistry.ts
// Centralized lens metadata for sidebar navigation.
// Keyed by href prefix (matched via startsWith).

export interface LensDef {
  id: string;
  label: string;
}

export const LENS_REGISTRY: Record<string, LensDef[]> = {
  // ── Federal (14 items) ─────────────────────────────────────────────────────
  '/dashboard/federal': [
    { id: 'overview', label: 'Overview' },
    { id: 'briefing', label: 'AI Briefing' },
    { id: 'planner', label: 'Resolution Planner' },
    { id: 'trends', label: 'Trends & Projections' },
    { id: 'policy', label: 'Policy Tracker' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'water-quality', label: 'Water Quality' },
    { id: 'infrastructure', label: 'Infrastructure' },
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'contaminants', label: 'Emerging Contaminants' },
    { id: 'scorecard', label: 'Scorecard' },
    { id: 'reports', label: 'Reports' },
    { id: 'interagency', label: 'Cross-Agency' },
    { id: 'funding', label: 'Funding & Grants' },
  ],
  // ── State (6 items) ────────────────────────────────────────────────────────
  '/dashboard/state': [
    { id: 'compliance', label: 'Compliance' },
    { id: 'coverage', label: 'Coverage' },
    { id: 'ms4oversight', label: 'MS4 Oversight' },
    { id: 'programs', label: 'Programs' },
    { id: 'trends', label: 'Trends & Forecasting' },
    { id: 'full', label: 'Full Overview' },
  ],
  // ── MS4 / Municipal (10 items) ─────────────────────────────────────────────
  '/dashboard/ms4': [
    { id: 'overview', label: 'Dashboard' },
    { id: 'briefing', label: 'AI Briefing' },
    { id: 'permit-compliance', label: 'Permit Compliance' },
    { id: 'monitoring-stations', label: 'Monitoring Stations' },
    { id: 'bmp-tracking', label: 'BMP Tracking' },
    { id: 'annual-report', label: 'Annual Report Builder' },
    { id: 'waterbody-status', label: 'Waterbody Status' },
    { id: 'upstream-alerts', label: 'Upstream Alerts' },
    { id: 'funding', label: 'Funding & Grants' },
    { id: 'scorecard', label: 'Scorecard' },
  ],
  // ── Municipal Utility (9 items) ────────────────────────────────────────────
  '/dashboard/utility': [
    { id: 'overview', label: 'Dashboard' },
    { id: 'briefing', label: 'AI Briefing' },
    { id: 'source-water', label: 'Source Water Quality' },
    { id: 'treatment', label: 'Treatment Performance' },
    { id: 'distribution', label: 'Distribution Monitoring' },
    { id: 'sdwis', label: 'SDWIS Compliance' },
    { id: 'infrastructure-risk', label: 'Infrastructure Risk' },
    { id: 'ccr', label: 'Consumer Confidence Report' },
    { id: 'alerts', label: 'Alerts' },
  ],
  // ── Infrastructure (8 items) ───────────────────────────────────────────────
  '/dashboard/infrastructure': [
    { id: 'overview', label: 'Dashboard' },
    { id: 'briefing', label: 'AI Briefing' },
    { id: 'asset-condition', label: 'Asset Condition' },
    { id: 'failure-risk', label: 'Failure Risk Assessment' },
    { id: 'capacity', label: 'Capacity Planning' },
    { id: 'discharge-permits', label: 'Discharge Permits (NPDES)' },
    { id: 'capital-projects', label: 'Capital Projects' },
    { id: 'regulatory-timeline', label: 'Regulatory Timeline' },
  ],
  // ── Corporate ESG / Sustainability (9 items) ───────────────────────────────
  '/dashboard/esg': [
    { id: 'overview', label: 'Dashboard' },
    { id: 'briefing', label: 'AI Briefing' },
    { id: 'risk', label: 'Facility Risk Portfolio' },
    { id: 'discharge-compliance', label: 'Discharge Compliance' },
    { id: 'supply-chain', label: 'Supply Chain Water Risk' },
    { id: 'disclosure', label: 'ESG Reporting (GRI/CDP/SASB)' },
    { id: 'impact', label: 'Watershed Impact Score' },
    { id: 'compliance', label: 'Regulatory Exposure' },
    { id: 'benchmarking', label: 'Benchmarking' },
  ],
  // ── University / Research (9 items) ────────────────────────────────────────
  '/dashboard/university': [
    { id: 'overview', label: 'Dashboard' },
    { id: 'briefing', label: 'AI Briefing' },
    { id: 'data-analysis', label: 'Research Explorer' },
    { id: 'data-download', label: 'Data Download (API/CSV)' },
    { id: 'field-study', label: 'Watershed Studies' },
    { id: 'trends', label: 'Trend Analysis' },
    { id: 'student-projects', label: 'Student Projects' },
    { id: 'publication', label: 'Publication Support' },
    { id: 'campus-water', label: 'Campus Water Quality' },
  ],
  // ── NGO / Conservation (9 items) ───────────────────────────────────────────
  '/dashboard/ngo': [
    { id: 'overview', label: 'Dashboard' },
    { id: 'briefing', label: 'AI Briefing' },
    { id: 'watershed-health', label: 'Watershed Health' },
    { id: 'restoration', label: 'Restoration Tracker' },
    { id: 'advocacy', label: 'Advocacy Intelligence' },
    { id: 'community-alerts', label: 'Community Alerts' },
    { id: 'volunteer', label: 'Volunteer Monitoring' },
    { id: 'funding', label: 'Funding & Grants' },
    { id: 'impact-reporting', label: 'Impact Reporting' },
  ],
  // ── K-12 Education (7 items) ───────────────────────────────────────────────
  '/dashboard/k12': [
    { id: 'overview', label: 'Dashboard' },
    { id: 'briefing', label: 'AI Briefing' },
    { id: 'my-watershed', label: "My School's Watershed" },
    { id: 'explorer', label: 'Water Quality Explorer' },
    { id: 'lesson-plans', label: 'Lesson Plans & STEM' },
    { id: 'class-projects', label: 'Class Projects' },
    { id: 'data-collection', label: 'Data Collection' },
  ],
  // ── Insurance / Risk (8 items) ─────────────────────────────────────────────
  '/dashboard/insurance': [
    { id: 'overview', label: 'Dashboard' },
    { id: 'briefing', label: 'AI Briefing' },
    { id: 'exposure-mapping', label: 'Exposure Mapping' },
    { id: 'claims', label: 'Claims Correlation' },
    { id: 'infrastructure-risk', label: 'Infrastructure Risk Index' },
    { id: 'flood-contamination', label: 'Flood & Contamination Overlay' },
    { id: 'portfolio-risk', label: 'Portfolio Risk Score' },
    { id: 'regulatory-changes', label: 'Regulatory Change Tracker' },
  ],
  // ── Laboratory Partner (5 items) ───────────────────────────────────────────
  '/dashboard/lab-partner': [
    { id: 'wq-overview',     label: 'State WQ Overview' },
    { id: 'impairment-map',  label: 'Impairment Map' },
    { id: 'monitoring-gaps', label: 'Monitoring Gaps' },
    { id: 'param-trends',    label: 'Parameter Trends' },
    { id: 'my-clients',      label: 'My Clients' },
  ],
  // ── Agriculture (9 items) ──────────────────────────────────────────────────
  '/dashboard/agriculture': [
    { id: 'overview', label: 'Dashboard' },
    { id: 'briefing', label: 'AI Briefing' },
    { id: 'nutrient-loading', label: 'Nutrient Loading' },
    { id: 'runoff', label: 'Runoff Monitoring' },
    { id: 'bmp', label: 'Best Management Practices' },
    { id: 'watershed-impact', label: 'Watershed Impact' },
    { id: 'compliance', label: 'Compliance (CAFO/NPDES)' },
    { id: 'soil-groundwater', label: 'Soil & Groundwater' },
    { id: 'conservation-funding', label: 'Conservation Funding' },
  ],
};

/** Get lenses for a given sidebar href, or null if none registered. */
export function getLensesForHref(href: string): LensDef[] | null {
  for (const prefix of Object.keys(LENS_REGISTRY)) {
    if (href.startsWith(prefix)) {
      return LENS_REGISTRY[prefix];
    }
  }
  return null;
}

/** Check if a lens ID is valid for a given href. */
export function isValidLens(href: string, id: string): boolean {
  const lenses = getLensesForHref(href);
  if (!lenses) return false;
  return lenses.some((l) => l.id === id);
}
