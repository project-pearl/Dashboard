// ============================================================
// PEARL Intelligence Network — University Research Management Center — Role-Based View Configuration
// Controls which sections are visible, their order, and 
// default expanded state for Researcher vs College roles.
// ============================================================

export type UniversityRole = 'Researcher' | 'College';

export interface SectionConfig {
  id: string;
  label: string;
  icon: string;
  /** Show in this role's view */
  visible: boolean;
  /** Default expanded state */
  defaultExpanded: boolean;
  /** Priority-based ordering (lower = higher) */
  order: number;
  /** Optional badge/tag shown next to section title */
  badge?: string;
}

type ViewConfig = Record<string, SectionConfig>;

// ─── Section IDs match existing id="section-{key}" in UniversityCommandCenter ──

const SHARED_SECTIONS = [
  'overview',       // State map + waterbody table
  'waterbody',      // Selected waterbody detail card
  'waterquality',   // Water quality trends & charts
  'restoration',    // Restoration plan / PEARL deployment
  'research',       // Research Collaboration Hub
  'methodology',    // Data Integrity & Methodology
  'datasets',       // Dataset Catalog & Export
  'grants',         // Research Funding Opportunities
  'manuscript',     // Manuscript & Publication Tools
  'academic',       // Academic Tools (College) / Teaching Resources (Researcher)
  'peerBenchmark',  // Peer Benchmarking
  'forecast',       // Forecast Chart
  'bayImpact',      // Bay Impact Counter
  // College-only
  'studyGroups',    // Study Group Hub (College only)
  'labReports',     // Lab Report Templates (College only)
  'learningPaths',  // Learning Pathways (College only)
  'internships',    // Internship & Career Board (College only)
] as const;

export type SectionId = typeof SHARED_SECTIONS[number];

// ─── Researcher View ─────────────────────────────────────────────────────────

export const RESEARCHER_VIEW: ViewConfig = {
  overview:       { id: 'overview',       label: 'State Overview & Waterbody Map',     icon: '🗺️', visible: true,  defaultExpanded: true,  order: 1 },
  waterbody:      { id: 'waterbody',      label: 'Waterbody Detail',                   icon: '💧', visible: true,  defaultExpanded: true,  order: 2 },
  waterquality:   { id: 'waterquality',   label: 'Water Quality Trends',               icon: '📈', visible: true,  defaultExpanded: true,  order: 3 },
  restoration:    { id: 'restoration',    label: 'Restoration & ALIA Deployment',     icon: '🦪', visible: true,  defaultExpanded: true,  order: 4 },
  methodology:    { id: 'methodology',    label: 'Data Integrity & Methodology',       icon: '⚗️', visible: true,  defaultExpanded: false, order: 5 },
  datasets:       { id: 'datasets',       label: 'Dataset Catalog & Research Export',  icon: '📦', visible: true,  defaultExpanded: false, order: 6 },
  manuscript:     { id: 'manuscript',     label: 'Manuscript & Publication Tools',     icon: '📝', visible: true,  defaultExpanded: false, order: 7 },
  research:       { id: 'research',       label: 'Research Collaboration Hub',         icon: '🔬', visible: true,  defaultExpanded: false, order: 8 },
  grants:         { id: 'grants',         label: 'Research Funding Opportunities',     icon: '🎓', visible: true,  defaultExpanded: false, order: 9 },
  peerBenchmark:  { id: 'peerBenchmark',  label: 'Peer Benchmarking',                  icon: '📊', visible: true,  defaultExpanded: false, order: 10 },
  forecast:       { id: 'forecast',       label: 'Trend Forecast',                     icon: '🔮', visible: true,  defaultExpanded: false, order: 11 },
  bayImpact:      { id: 'bayImpact',      label: 'Bay Impact Counter',                 icon: '🌊', visible: true,  defaultExpanded: false, order: 12 },
  academic:       { id: 'academic',       label: 'Academic & Teaching Resources',      icon: '🎓', visible: true,  defaultExpanded: false, order: 13 },
  // Hidden for Researcher
  studyGroups:    { id: 'studyGroups',    label: 'Study Groups',                       icon: '👥', visible: false, defaultExpanded: false, order: 99 },
  labReports:     { id: 'labReports',     label: 'Lab Reports',                        icon: '🧪', visible: false, defaultExpanded: false, order: 99 },
  learningPaths:  { id: 'learningPaths',  label: 'Learning Pathways',                  icon: '🛤️', visible: false, defaultExpanded: false, order: 99 },
  internships:    { id: 'internships',    label: 'Internships & Careers',              icon: '💼', visible: false, defaultExpanded: false, order: 99 },
};

// ─── College Student View ────────────────────────────────────────────────────
// Reorders to surface learning + collaboration first, hides advanced research
// tools, and adds student-specific sections.

export const COLLEGE_VIEW: ViewConfig = {
  overview:       { id: 'overview',       label: 'State Overview & Waterbody Map',     icon: '🗺️', visible: true,  defaultExpanded: true,  order: 1 },
  waterbody:      { id: 'waterbody',      label: 'Waterbody Detail',                   icon: '💧', visible: true,  defaultExpanded: true,  order: 2 },
  waterquality:   { id: 'waterquality',   label: 'Water Quality Trends',               icon: '📈', visible: true,  defaultExpanded: true,  order: 3 },
  // College-first sections
  academic:       { id: 'academic',       label: 'Academic Tools & Learning Resources',icon: '🎓', visible: true,  defaultExpanded: true,  order: 4, badge: 'Start Here' },
  learningPaths:  { id: 'learningPaths',  label: 'Learning Pathways',                  icon: '🛤️', visible: true,  defaultExpanded: true,  order: 5, badge: 'New' },
  studyGroups:    { id: 'studyGroups',    label: 'Study Groups & Lab Partners',        icon: '👥', visible: true,  defaultExpanded: false, order: 6 },
  labReports:     { id: 'labReports',     label: 'Lab Report Templates',               icon: '🧪', visible: true,  defaultExpanded: false, order: 7 },
  // Data access (simplified)
  datasets:       { id: 'datasets',       label: 'Datasets for Coursework',            icon: '📦', visible: true,  defaultExpanded: false, order: 8 },
  research:       { id: 'research',       label: 'Find Advisors & Research Groups',    icon: '🔬', visible: true,  defaultExpanded: false, order: 9 },
  internships:    { id: 'internships',    label: 'Internships & Career Board',         icon: '💼', visible: true,  defaultExpanded: false, order: 10, badge: 'New' },
  // Still available but deprioritized
  restoration:    { id: 'restoration',    label: 'Restoration & ALIA Deployment',     icon: '🦪', visible: true,  defaultExpanded: false, order: 11 },
  bayImpact:      { id: 'bayImpact',      label: 'Bay Impact Counter',                 icon: '🌊', visible: true,  defaultExpanded: false, order: 12 },
  forecast:       { id: 'forecast',       label: 'Trend Forecast',                     icon: '🔮', visible: true,  defaultExpanded: false, order: 13 },
  // Hidden for College (too advanced)
  methodology:    { id: 'methodology',    label: 'Data Integrity & Methodology',       icon: '⚗️', visible: false, defaultExpanded: false, order: 99 },
  manuscript:     { id: 'manuscript',     label: 'Manuscript & Publication Tools',     icon: '📝', visible: false, defaultExpanded: false, order: 99 },
  grants:         { id: 'grants',         label: 'Research Funding Opportunities',     icon: '🎓', visible: false, defaultExpanded: false, order: 99 },
  peerBenchmark:  { id: 'peerBenchmark',  label: 'Peer Benchmarking',                  icon: '📊', visible: false, defaultExpanded: false, order: 99 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getViewConfig(role: UniversityRole): ViewConfig {
  return role === 'College' ? COLLEGE_VIEW : RESEARCHER_VIEW;
}

/** Returns visible section IDs sorted by order */
export function getVisibleSections(role: UniversityRole): SectionConfig[] {
  const config = getViewConfig(role);
  return Object.values(config)
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order);
}

/** Returns default expanded state map for initializing useState */
export function getDefaultExpandedState(role: UniversityRole): Record<string, boolean> {
  const config = getViewConfig(role);
  return Object.fromEntries(
    Object.entries(config).map(([key, val]) => [key, val.defaultExpanded])
  );
}

/** Check if a section is visible for the given role */
export function isSectionVisible(role: UniversityRole, sectionId: string): boolean {
  const config = getViewConfig(role);
  return config[sectionId]?.visible ?? false;
}

/** Get the display label for a section (role-aware) */
export function getSectionLabel(role: UniversityRole, sectionId: string): string {
  const config = getViewConfig(role);
  return config[sectionId]?.label ?? sectionId;
}
