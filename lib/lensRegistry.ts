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
    { id: 'trends', label: 'Trends & Projections' },
    { id: 'policy', label: 'Policy Tracker' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'water-quality', label: 'Water Quality' },
    { id: 'public-health', label: 'Public Health & Contaminants' },
    { id: 'infrastructure', label: 'Infrastructure' },
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'disaster-emergency', label: 'Disaster & Emergency' },
    { id: 'scorecard', label: 'Scorecard' },
    { id: 'reports', label: 'Reports' },
    { id: 'interagency', label: 'Cross-Agency' },
    { id: 'funding', label: 'Funding & Grants' },

  ],
  // ── State (18 items) ───────────────────────────────────────────────────────
  '/dashboard/state': [
    { id: 'overview',       label: 'Overview' },
    { id: 'briefing',       label: 'AI Briefing' },
    { id: 'trends',         label: 'Trends & Projections' },
    { id: 'policy',         label: 'Policy Tracker' },
    { id: 'compliance',     label: 'Compliance' },
    { id: 'water-quality',  label: 'Water Quality' },
    { id: 'public-health',  label: 'Public Health & Contaminants' },
    { id: 'habitat',        label: 'Habitat & Ecology' },
    { id: 'agriculture',    label: 'Agricultural & Nonpoint Source' },
    { id: 'infrastructure', label: 'Infrastructure' },
    { id: 'monitoring',     label: 'Monitoring' },
    { id: 'disaster',       label: 'Disaster & Emergency' },
    { id: 'tmdl',           label: 'TMDL & Restoration' },
    { id: 'scorecard',      label: 'Scorecard' },
    { id: 'reports',        label: 'Reports' },
    { id: 'permits',        label: 'Permits & Enforcement' },
    { id: 'funding',        label: 'Funding & Grants' },
  ],
  // ── Municipal Utility (18 items) ───────────────────────────────────────────
  '/dashboard/utility': [
    { id: 'overview',           label: 'Overview' },
    { id: 'briefing',           label: 'AI Briefing' },
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
  // ── Site & Property Intelligence (17 lenses) ──────────────────────────────
  '/dashboard/infrastructure': [
    { id: 'overview', label: 'Dashboard' },
    { id: 'developer', label: 'Developer' },
    { id: 'real-estate', label: 'Real Estate' },
    { id: 'legal', label: 'Legal' },
    { id: 'consultant', label: 'Consultant' },
    { id: 'lender', label: 'Lender' },
    { id: 'appraiser', label: 'Appraiser' },
    { id: 'title-company', label: 'Title Company' },
    { id: 'construction', label: 'Construction' },
    { id: 'ma-due-diligence', label: 'M&A Due Diligence' },
    { id: 'energy-utilities', label: 'Energy & Utilities' },
    { id: 'private-equity', label: 'Private Equity' },
    { id: 'corporate-facilities', label: 'Corporate Facilities' },
    { id: 'municipal-econ-dev', label: 'Municipal Econ Dev' },
    { id: 'brownfield', label: 'Brownfield' },
    { id: 'mining', label: 'Mining' },
  ],
  // ── Corporate ESG / Sustainability (8 items) ───────────────────────────────
  '/dashboard/esg': [
    { id: 'overview',            label: 'Executive Overview' },
    { id: 'esg-reporting',       label: 'ESG Reporting & Disclosure' },
    { id: 'facility-operations', label: 'Facility Operations' },
    { id: 'compliance',          label: 'Compliance & Risk' },
    { id: 'policy',              label: 'Policy & Regulatory' },
    { id: 'public-health',       label: 'Emerging Contaminants' },
    { id: 'supply-chain',        label: 'Supply Chain' },
    { id: 'trends',              label: 'Trends & Outlook' },
  ],
  // ── University / Research (18 items) ───────────────────────────────────────
  '/dashboard/university': [
    { id: 'overview',                label: 'Overview' },
    { id: 'briefing',                label: 'AI Briefing' },
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
  // ── Aqua-LO Laboratory (5 items) ────────────────────────────────────────────
  '/dashboard/aqua-lo': [
    { id: 'overview', label: 'Dashboard' },
    { id: 'push',     label: 'Submit Data' },
    { id: 'qaqc',     label: 'QA/QC' },
    { id: 'audit',    label: 'Audit Trail' },
    { id: 'reports',  label: 'Reports' },
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
