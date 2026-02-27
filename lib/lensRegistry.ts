// lib/lensRegistry.ts
// Centralized lens metadata for sidebar navigation.
// Keyed by href prefix (matched via startsWith).

export interface LensDef {
  id: string;
  label: string;
}

export const LENS_REGISTRY: Record<string, LensDef[]> = {
  // ── Federal (18 items) ─────────────────────────────────────────────────────
  '/dashboard/federal': [
    { id: 'overview', label: 'Overview' },
    { id: 'briefing', label: 'AI Briefing' },
    { id: 'planner', label: 'Response Planner' },
    { id: 'trends', label: 'Trends & Projections' },
    { id: 'policy', label: 'Policy Tracker' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'water-quality', label: 'Water Quality' },
    { id: 'public-health', label: 'Public Health & Contaminants' },
    { id: 'infrastructure', label: 'Infrastructure' },
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'scorecard', label: 'Scorecard' },
    { id: 'reports', label: 'Reports' },
    { id: 'interagency', label: 'Cross-Agency' },
    { id: 'funding', label: 'Funding & Grants' },
  ],
  // ── State (18 items) ───────────────────────────────────────────────────────
  '/dashboard/state': [
    { id: 'overview',       label: 'Overview' },
    { id: 'briefing',       label: 'AI Briefing' },
    { id: 'planner',        label: 'Response Planner' },
    { id: 'trends',         label: 'Trends & Projections' },
    { id: 'policy',         label: 'Policy Tracker' },
    { id: 'compliance',     label: 'Compliance' },
    { id: 'water-quality',  label: 'Water Quality' },
    { id: 'public-health',  label: 'Public Health & Contaminants' },
    { id: 'habitat',        label: 'Habitat & Ecology' },
    { id: 'agriculture',    label: 'Agricultural & Nonpoint Source' },
    { id: 'infrastructure', label: 'Infrastructure' },
    { id: 'monitoring',     label: 'Monitoring' },
    { id: 'disaster',       label: 'Disaster & Emergency Response' },
    { id: 'tmdl',           label: 'TMDL & Restoration' },
    { id: 'scorecard',      label: 'Scorecard' },
    { id: 'reports',        label: 'Reports' },
    { id: 'permits',        label: 'Permits & Enforcement' },
    { id: 'funding',        label: 'Funding & Grants' },
  ],
  // ── MS4 / Municipal (18 items) ─────────────────────────────────────────────
  '/dashboard/ms4': [
    { id: 'overview',          label: 'Overview' },
    { id: 'briefing',          label: 'AI Briefing' },
    { id: 'planner',           label: 'Response Planner' },
    { id: 'trends',            label: 'Trends & Projections' },
    { id: 'policy',            label: 'Policy Tracker' },
    { id: 'compliance',        label: 'Compliance' },
    { id: 'water-quality',     label: 'Water Quality' },
    { id: 'public-health',     label: 'Public Health & Contaminants' },
    { id: 'receiving-waters',  label: 'Receiving Waters' },
    { id: 'stormwater-bmps',   label: 'Stormwater BMPs' },
    { id: 'infrastructure',    label: 'Infrastructure' },
    { id: 'monitoring',        label: 'Monitoring' },
    { id: 'disaster',          label: 'Disaster & Emergency Response' },
    { id: 'tmdl-compliance',   label: 'TMDL Compliance' },
    { id: 'scorecard',         label: 'Scorecard' },
    { id: 'reports',           label: 'Reports' },
    { id: 'mcm-manager',       label: 'MCM Program Manager' },
    { id: 'funding',           label: 'Funding & Grants' },
  ],
  // ── Municipal Utility (18 items) ───────────────────────────────────────────
  '/dashboard/utility': [
    { id: 'overview',           label: 'Overview' },
    { id: 'briefing',           label: 'AI Briefing' },
    { id: 'planner',            label: 'Response Planner' },
    { id: 'trends',             label: 'Trends & Projections' },
    { id: 'policy',             label: 'Policy Tracker' },
    { id: 'compliance',         label: 'Compliance' },
    { id: 'water-quality',      label: 'Water Quality' },
    { id: 'public-health',      label: 'Public Health & Contaminants' },
    { id: 'source-receiving',   label: 'Source & Receiving Waters' },
    { id: 'treatment-process',  label: 'Treatment & Process' },
    { id: 'infrastructure',     label: 'Infrastructure' },
    { id: 'laboratory',         label: 'Laboratory & Sampling' },
    { id: 'disaster',           label: 'Disaster & Emergency' },
    { id: 'permit-limits',      label: 'Permit Limits & Compliance' },
    { id: 'scorecard',          label: 'Scorecard' },
    { id: 'reports',            label: 'Reports' },
    { id: 'asset-management',   label: 'Asset Management' },
    { id: 'funding',            label: 'Funding & Grants' },
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
  // ── Corporate ESG / Sustainability (18 items) ──────────────────────────────
  '/dashboard/esg': [
    { id: 'overview',            label: 'Overview' },
    { id: 'briefing',            label: 'AI Briefing' },
    { id: 'planner',             label: 'Response Planner' },
    { id: 'trends',              label: 'Trends & Projections' },
    { id: 'policy',              label: 'Policy Tracker' },
    { id: 'compliance',          label: 'Compliance' },
    { id: 'water-quality',       label: 'Water Quality' },
    { id: 'public-health',       label: 'Public Health & Contaminants' },
    { id: 'water-stewardship',   label: 'Water Stewardship' },
    { id: 'facility-operations', label: 'Facility Operations' },
    { id: 'infrastructure',      label: 'Infrastructure' },
    { id: 'monitoring',          label: 'Monitoring' },
    { id: 'disaster-emergency',  label: 'Disaster & Emergency' },
    { id: 'esg-reporting',       label: 'ESG Reporting' },
    { id: 'scorecard',           label: 'Scorecard' },
    { id: 'reports',             label: 'Reports' },
    { id: 'supply-chain-risk',   label: 'Supply Chain Risk' },
    { id: 'funding',             label: 'Funding & Grants' },
  ],
  // ── University / Research (18 items) ───────────────────────────────────────
  '/dashboard/university': [
    { id: 'overview',                label: 'Overview' },
    { id: 'briefing',                label: 'AI Briefing' },
    { id: 'planner',                 label: 'Response Planner' },
    { id: 'trends',                  label: 'Trends & Projections' },
    { id: 'policy',                  label: 'Policy Tracker' },
    { id: 'compliance',              label: 'Compliance' },
    { id: 'water-quality',           label: 'Water Quality' },
    { id: 'public-health',           label: 'Public Health & Contaminants' },
    { id: 'research-monitoring',     label: 'Research & Monitoring' },
    { id: 'campus-stormwater',       label: 'Campus Stormwater' },
    { id: 'infrastructure',          label: 'Infrastructure' },
    { id: 'monitoring',              label: 'Monitoring' },
    { id: 'disaster-emergency',      label: 'Disaster & Emergency' },
    { id: 'watershed-partnerships',  label: 'Watershed Partnerships' },
    { id: 'scorecard',               label: 'Scorecard' },
    { id: 'reports',                 label: 'Reports' },
    { id: 'grants-publications',     label: 'Grants & Publications' },
    { id: 'funding',                 label: 'Funding & Grants' },
  ],
  // ── NGO / Conservation (18 items) ──────────────────────────────────────────
  '/dashboard/ngo': [
    { id: 'overview',              label: 'Overview' },
    { id: 'briefing',              label: 'AI Briefing' },
    { id: 'planner',               label: 'Response Planner' },
    { id: 'trends',                label: 'Trends & Projections' },
    { id: 'policy',                label: 'Policy Tracker' },
    { id: 'compliance',            label: 'Compliance' },
    { id: 'water-quality',         label: 'Water Quality' },
    { id: 'public-health',         label: 'Public Health & Contaminants' },
    { id: 'watershed-health',      label: 'Watershed Health' },
    { id: 'restoration-projects',  label: 'Restoration Projects' },
    { id: 'infrastructure',        label: 'Infrastructure' },
    { id: 'monitoring',            label: 'Monitoring' },
    { id: 'disaster-emergency',    label: 'Disaster & Emergency' },
    { id: 'advocacy',              label: 'Advocacy' },
    { id: 'scorecard',             label: 'Scorecard' },
    { id: 'reports',               label: 'Reports' },
    { id: 'volunteer-program',     label: 'Volunteer Program' },
    { id: 'citizen-reporting',     label: 'Citizen Reporting' },
    { id: 'funding',               label: 'Funding & Grants' },
  ],
  // ── K-12 Education (12 items) ──────────────────────────────────────────────
  '/dashboard/k12': [
    { id: 'overview',               label: 'Overview' },
    { id: 'briefing',               label: 'AI Briefing' },
    { id: 'planner',                label: 'Response Planner' },
    { id: 'trends',                 label: 'Trends & Projections' },
    { id: 'compliance',             label: 'Compliance' },
    { id: 'water-quality',          label: 'Water Quality' },
    { id: 'public-health',          label: 'Public Health & Contaminants' },
    { id: 'outdoor-classroom',      label: 'Outdoor Classroom' },
    { id: 'student-monitoring',     label: 'Student Monitoring' },
    { id: 'student-uploads',        label: 'Student Uploads' },
    { id: 'drinking-water-safety',  label: 'Drinking Water Safety' },
    { id: 'reports',                label: 'Reports' },
    { id: 'funding',                label: 'Funding & Grants' },
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
