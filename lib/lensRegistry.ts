// lib/lensRegistry.ts
// Centralized lens metadata for sidebar navigation.
// Keyed by href prefix (matched via startsWith).

export interface LensDef {
  id: string;
  label: string;
}

export const LENS_REGISTRY: Record<string, LensDef[]> = {
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
  '/dashboard/state': [
    { id: 'compliance', label: 'Compliance' },
    { id: 'coverage', label: 'Coverage' },
    { id: 'ms4oversight', label: 'MS4 Oversight' },
    { id: 'programs', label: 'Programs' },
    { id: 'trends', label: 'Trends & Forecasting' },
    { id: 'full', label: 'Full Overview' },
  ],
  '/dashboard/ms4': [
    { id: 'overview', label: 'Overview' },
    { id: 'trends', label: 'Trends & Forecasting' },
  ],
  '/dashboard/esg': [
    { id: 'overview', label: 'Overview' },
    { id: 'disclosure', label: 'Disclosure' },
    { id: 'risk', label: 'Risk' },
    { id: 'impact', label: 'Impact' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'trends', label: 'Trends & Forecasting' },
  ],
  '/dashboard/ngo': [
    { id: 'overview', label: 'Overview' },
    { id: 'trends', label: 'Trends & Forecasting' },
  ],
  '/dashboard/university': [
    { id: 'data-analysis', label: 'Data Analysis' },
    { id: 'field-study', label: 'Field Study' },
    { id: 'publication', label: 'Publication' },
    { id: 'trends', label: 'Trends & Forecasting' },
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
