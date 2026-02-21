// ─── Drag-and-Drop Section Layout Configuration ────────────────────────────
// Unified types, default section orders, and Supabase persistence for
// the admin layout editor across all command centers.

import { supabase } from './supabase';
import type { UserRole } from './authTypes';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SectionDefinition {
  id: string;               // matches existing id="section-{name}" DOM attributes
  label: string;            // human-readable name shown in drag handle
  order: number;            // sort position (0-based, lower = higher)
  visible: boolean;         // whether section renders
  defaultExpanded: boolean; // initial collapsed/expanded state
  compound?: boolean;       // true for map+list grid (moves as one block)
  lensControlled?: boolean; // NCC only — visibility driven by ViewLens
}

export type CCKey = 'K12' | 'State' | 'MS4' | 'ESG' | 'NGO' | 'University' | 'NCC'
  | 'Utility' | 'Infrastructure' | 'Insurance' | 'Agriculture' | 'SampleChain';

// ─── Default Section Orders ────────────────────────────────────────────────

export const DEFAULT_SECTIONS: Record<CCKey, SectionDefinition[]> = {
  K12: [
    { id: 'wildlife',    label: 'Wildlife Impact',              order: 0,  visible: true, defaultExpanded: true },
    { id: 'regprofile',  label: 'Water Health Dashboard',       order: 1,  visible: true, defaultExpanded: true },
    { id: 'insights',    label: 'AI Insights Engine',           order: 2,  visible: true, defaultExpanded: true },
    { id: 'alertfeed',   label: 'Statewide Alert Feed',         order: 3,  visible: true, defaultExpanded: false },
    { id: 'map-grid',    label: 'Map & Waterbody List',         order: 4,  visible: true, defaultExpanded: true, compound: true },
    { id: 'detail',      label: 'Waterbody Detail',             order: 5,  visible: true, defaultExpanded: true },
    { id: 'top10',       label: 'Top 5 Worsening / Improving',  order: 6,  visible: true, defaultExpanded: false },
    { id: 'learning',    label: 'Student Learning Mode',        order: 7,  visible: true, defaultExpanded: true },
    { id: 'projects',    label: 'Science Fair & STEM Projects', order: 8,  visible: true, defaultExpanded: true },
    { id: 'fieldreport', label: 'Field Report & Data Export',   order: 9,  visible: true, defaultExpanded: true },
    { id: 'eduhub',      label: 'K-12 Educational Hub',         order: 10, visible: true, defaultExpanded: true },
    { id: 'teacher',     label: 'Teacher Resources',            order: 11, visible: true, defaultExpanded: true },
    { id: 'grants',      label: 'Grant Opportunities',          order: 12, visible: true, defaultExpanded: true },
    { id: 'goodbye',     label: 'Community Celebration',        order: 13, visible: true, defaultExpanded: true },
    { id: 'disclaimer',  label: 'Platform Disclaimer',          order: 14, visible: true, defaultExpanded: true },
  ],

  State: [
    { id: 'regprofile',  label: 'Water Health Dashboard',       order: 0,  visible: true, defaultExpanded: true },
    { id: 'insights',    label: 'AI Insights Engine',           order: 1,  visible: true, defaultExpanded: true },
    { id: 'alertfeed',   label: 'Statewide Alert Feed',         order: 2,  visible: true, defaultExpanded: false },
    { id: 'map-grid',    label: 'Map & Waterbody List',         order: 3,  visible: true, defaultExpanded: true, compound: true },
    { id: 'detail',      label: 'Waterbody Detail',             order: 4,  visible: true, defaultExpanded: true },
    { id: 'top10',       label: 'Top 5 Worsening / Improving',  order: 5,  visible: true, defaultExpanded: false },
    { id: 'ms4jurisdictions', label: 'MS4 Jurisdictions',       order: 6,  visible: true, defaultExpanded: true },
    { id: 'exporthub',   label: 'Data Export Hub',              order: 7,  visible: true, defaultExpanded: true },
    { id: 'grants',      label: 'Grant Opportunities',          order: 8,  visible: true, defaultExpanded: true },
    { id: 'disclaimer',  label: 'Platform Disclaimer',          order: 9,  visible: true, defaultExpanded: true },
  ],

  MS4: [
    { id: 'identity',       label: 'Jurisdiction Identity',         order: 0,  visible: true, defaultExpanded: true },
    { id: 'insights',       label: 'AI Insights Engine',            order: 1,  visible: true, defaultExpanded: true },
    { id: 'quickactions',   label: 'Quick Actions',                 order: 2,  visible: true, defaultExpanded: true },
    { id: 'alertfeed',      label: 'Alert Feed',                    order: 3,  visible: true, defaultExpanded: false },
    { id: 'map-grid',       label: 'Map & Waterbody List',          order: 4,  visible: true, defaultExpanded: true, compound: true },
    { id: 'detail',         label: 'Waterbody Detail',              order: 5,  visible: true, defaultExpanded: true },
    { id: 'fineavoidance',  label: 'Fine Avoidance Calculator',     order: 6,  visible: true, defaultExpanded: true },
    { id: 'mdeexport',      label: 'MDE Annual Reporting',          order: 7,  visible: true, defaultExpanded: true },
    { id: 'tmdl',           label: 'TMDL Compliance',               order: 8,  visible: true, defaultExpanded: true },
    { id: 'nutrientcredits', label: 'Nutrient Credit Tracking',     order: 9,  visible: true, defaultExpanded: true },
    { id: 'stormsim',       label: 'Storm Event Simulations',       order: 10, visible: true, defaultExpanded: true },
    { id: 'economics',      label: 'Compliance Economics',          order: 11, visible: true, defaultExpanded: true },
    { id: 'top10',          label: 'Top 10 Priority Waterbodies',   order: 12, visible: true, defaultExpanded: false },
    { id: 'exporthub',      label: 'Data Export Hub',               order: 13, visible: true, defaultExpanded: true },
    { id: 'grants',         label: 'Grant Opportunities',           order: 14, visible: true, defaultExpanded: true },
    { id: 'provenance',     label: 'Data Provenance & Chain of Custody', order: 15, visible: true, defaultExpanded: true },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 16, visible: true, defaultExpanded: true },
  ],

  ESG: [
    { id: 'summary',        label: 'ESG Summary',                   order: 0,  visible: true, defaultExpanded: true },
    { id: 'kpis',           label: 'KPI Cards',                     order: 1,  visible: true, defaultExpanded: true },
    { id: 'map-grid',       label: 'Map & Facility List',           order: 2,  visible: true, defaultExpanded: true, compound: true },
    { id: 'insights',       label: 'AI Insights Engine',            order: 3,  visible: true, defaultExpanded: true },
    { id: 'impact',         label: 'Environmental Impact',          order: 4,  visible: true, defaultExpanded: true },
    { id: 'chesbay',        label: 'Chesapeake Bay Watershed',      order: 5,  visible: true, defaultExpanded: true },
    { id: 'sustainability', label: 'Corporate Sustainability',      order: 6,  visible: true, defaultExpanded: true },
    { id: 'disclosure',     label: 'ESG Disclosure',                order: 7,  visible: true, defaultExpanded: true },
    { id: 'supplychain',    label: 'Supply Chain Analysis',         order: 8,  visible: true, defaultExpanded: true },
    { id: 'economic',       label: 'Economic Performance',          order: 9,  visible: true, defaultExpanded: true },
    { id: 'shareholder',    label: 'Shareholder Engagement',        order: 10, visible: true, defaultExpanded: true },
    { id: 'benchmark',      label: 'Benchmarking',                  order: 11, visible: true, defaultExpanded: true },
    { id: 'compliance',     label: 'Regulatory Compliance',         order: 12, visible: true, defaultExpanded: true },
    { id: 'brand',          label: 'Brand & Reputation',            order: 13, visible: true, defaultExpanded: true },
    { id: 'grants',         label: 'Grant Opportunities',           order: 14, visible: true, defaultExpanded: true },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 15, visible: true, defaultExpanded: true },
  ],

  NGO: [
    { id: 'regprofile',  label: 'Region Profile',               order: 0,  visible: true, defaultExpanded: true },
    { id: 'insights',    label: 'AI Insights Engine',            order: 1,  visible: true, defaultExpanded: true },
    { id: 'alertfeed',   label: 'Alert Feed',                   order: 2,  visible: true, defaultExpanded: false },
    { id: 'map-grid',    label: 'Map & Waterbody List',         order: 3,  visible: true, defaultExpanded: true, compound: true },
    { id: 'detail',      label: 'Waterbody Detail',             order: 4,  visible: true, defaultExpanded: true },
    { id: 'top10',       label: 'Top 5 Worsening / Improving',  order: 5,  visible: true, defaultExpanded: false },
    { id: 'volunteer',   label: 'Volunteer Monitoring',         order: 6,  visible: true, defaultExpanded: true },
    { id: 'community',   label: 'Community Engagement',         order: 7,  visible: true, defaultExpanded: true },
    { id: 'policy',      label: 'Policy Recommendations',       order: 8,  visible: true, defaultExpanded: true },
    { id: 'partners',    label: 'Partner Organizations',        order: 9,  visible: true, defaultExpanded: true },
    { id: 'grants',      label: 'Grant Opportunities',          order: 10, visible: true, defaultExpanded: true },
    { id: 'disclaimer',  label: 'Platform Disclaimer',          order: 11, visible: true, defaultExpanded: true },
  ],

  University: [
    { id: 'regprofile',  label: 'Region Profile',               order: 0,  visible: true, defaultExpanded: true },
    { id: 'alertfeed',   label: 'Alert Feed',                   order: 1,  visible: true, defaultExpanded: false },
    { id: 'insights',    label: 'AI Insights Engine',            order: 2,  visible: true, defaultExpanded: true },
    { id: 'map-grid',    label: 'Map & Waterbody List',         order: 3,  visible: true, defaultExpanded: true, compound: true },
    { id: 'detail',      label: 'Waterbody Detail',             order: 4,  visible: true, defaultExpanded: true },
    { id: 'top10',       label: 'Top 5 Worsening / Improving',  order: 5,  visible: true, defaultExpanded: false },
    { id: 'research',    label: 'Research Collaboration Hub',   order: 6,  visible: true, defaultExpanded: true },
    { id: 'manuscript',  label: 'Manuscript & Publication',     order: 7,  visible: true, defaultExpanded: true },
    { id: 'academic',    label: 'Academic Tools',               order: 8,  visible: true, defaultExpanded: true },
    { id: 'methodology', label: 'Data Integrity & Methodology', order: 9,  visible: true, defaultExpanded: true },
    { id: 'datasets',    label: 'Dataset Catalog',              order: 10, visible: true, defaultExpanded: true },
    { id: 'exporthub',   label: 'Data Export Hub',              order: 11, visible: true, defaultExpanded: true },
    { id: 'grants',      label: 'Grant Opportunities',          order: 12, visible: true, defaultExpanded: true },
    { id: 'disclaimer',  label: 'Platform Disclaimer',          order: 13, visible: true, defaultExpanded: true },
  ],

  NCC: [
    { id: 'usmap',              label: 'US Map',                      order: 0,  visible: true, defaultExpanded: true, compound: true },
    { id: 'impairmentprofile',  label: 'Impairment Profile',          order: 1,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'aiinsights',         label: 'AI Insights',                 order: 2,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'networkhealth',      label: 'Network Health Score',        order: 3,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'nationalimpact',     label: 'National Impact Counter',     order: 4,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'priorityqueue',      label: 'Priority Action Queue',       order: 5,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'coveragegaps',       label: 'Coverage Gaps',               order: 6,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'situation',          label: 'Situation Summary',           order: 7,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'top10',              label: 'Top 10 Worsening / Improving', order: 8, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'statebystatesummary', label: 'State-by-State Table',       order: 9,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'sla',                label: 'SLA Compliance',              order: 10, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'disclaimer',         label: 'Platform Disclaimer',         order: 11, visible: true, defaultExpanded: true },
  ],

  Utility: [
    { id: 'compliance',     label: 'Compliance Overview',           order: 0,  visible: true, defaultExpanded: true },
    { id: 'contaminants',   label: 'Contaminant Tracker',           order: 1,  visible: true, defaultExpanded: true },
    { id: 'treatment',      label: 'Treatment Process Monitor',     order: 2,  visible: true, defaultExpanded: true },
    { id: 'violations',     label: 'SDWA Violations',               order: 3,  visible: true, defaultExpanded: true },
    { id: 'ccr',            label: 'Consumer Confidence Report',    order: 4,  visible: true, defaultExpanded: true },
    { id: 'capital',        label: 'Capital Planning',              order: 5,  visible: true, defaultExpanded: true },
    { id: 'distribution',   label: 'Distribution System',           order: 6,  visible: true, defaultExpanded: false },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 7,  visible: true, defaultExpanded: true },
  ],

  Infrastructure: [
    { id: 'projects',       label: 'Capital Project Tracker',       order: 0,  visible: true, defaultExpanded: true },
    { id: 'greeninfra',     label: 'Green Infrastructure Map',      order: 1,  visible: true, defaultExpanded: true },
    { id: 'capacity',       label: 'Stormwater Capacity Analysis',  order: 2,  visible: true, defaultExpanded: true },
    { id: 'funding',        label: 'Funding Pipeline',              order: 3,  visible: true, defaultExpanded: true },
    { id: 'lifecycle',      label: 'Asset Lifecycle',               order: 4,  visible: true, defaultExpanded: true },
    { id: 'resilience',     label: 'Climate Resilience',            order: 5,  visible: true, defaultExpanded: false },
    { id: 'reporting',      label: 'Infrastructure Reporting',      order: 6,  visible: true, defaultExpanded: false },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 7,  visible: true, defaultExpanded: true },
  ],

  Insurance: [
    { id: 'floodrisk',      label: 'Flood Risk Assessment',         order: 0,  visible: true, defaultExpanded: true },
    { id: 'contamination',  label: 'Contamination Analysis',        order: 1,  visible: true, defaultExpanded: true },
    { id: 'duediligence',   label: 'Portfolio Due Diligence',       order: 2,  visible: true, defaultExpanded: true },
    { id: 'propertyvalue',  label: 'Property Value Impact',         order: 3,  visible: true, defaultExpanded: true },
    { id: 'regulatory',     label: 'Regulatory Exposure',           order: 4,  visible: true, defaultExpanded: true },
    { id: 'claims',         label: 'Claims Intelligence',           order: 5,  visible: true, defaultExpanded: true },
    { id: 'underwriting',   label: 'Underwriting Tools',            order: 6,  visible: true, defaultExpanded: false },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 7,  visible: true, defaultExpanded: true },
  ],

  Agriculture: [
    { id: 'nutrients',      label: 'Nutrient Management',           order: 0,  visible: true, defaultExpanded: true },
    { id: 'irrigation',     label: 'Irrigation Efficiency',         order: 1,  visible: true, defaultExpanded: true },
    { id: 'runoff',         label: 'Runoff Modeling',                order: 2,  visible: true, defaultExpanded: true },
    { id: 'credits',        label: 'Nutrient Credit Trading',       order: 3,  visible: true, defaultExpanded: true },
    { id: 'bmp',            label: 'BMP Inventory',                  order: 4,  visible: true, defaultExpanded: true },
    { id: 'soilhealth',     label: 'Soil & Water Conservation',     order: 5,  visible: true, defaultExpanded: true },
    { id: 'conservation',   label: 'Conservation Programs',         order: 6,  visible: true, defaultExpanded: false },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 7,  visible: true, defaultExpanded: true },
  ],

  SampleChain: [
    { id: 'intake',         label: 'Sample Intake Queue',           order: 0,  visible: true, defaultExpanded: true },
    { id: 'qaqc',           label: 'QA/QC Dashboard',               order: 1,  visible: true, defaultExpanded: true },
    { id: 'methods',        label: 'Method Registry',               order: 2,  visible: true, defaultExpanded: true },
    { id: 'coc',            label: 'Chain of Custody',              order: 3,  visible: true, defaultExpanded: true },
    { id: 'inventory',      label: 'Inventory Management',          order: 4,  visible: true, defaultExpanded: true },
    { id: 'reporting',      label: 'Reporting Engine',              order: 5,  visible: true, defaultExpanded: true },
    { id: 'calibration',    label: 'Equipment Calibration',         order: 6,  visible: true, defaultExpanded: false },
    { id: 'audits',         label: 'Audit Trail',                   order: 7,  visible: true, defaultExpanded: false },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 8,  visible: true, defaultExpanded: true },
  ],
};

// ─── Supabase Persistence ──────────────────────────────────────────────────

export async function fetchLayout(
  role: UserRole,
  ccKey: CCKey,
): Promise<SectionDefinition[] | null> {
  const { data, error } = await supabase
    .from('role_layouts')
    .select('sections')
    .eq('role', role)
    .eq('cc_key', ccKey)
    .maybeSingle();

  if (error || !data) return null;
  return data.sections as SectionDefinition[];
}

export async function saveLayout(
  role: UserRole,
  ccKey: CCKey,
  sections: SectionDefinition[],
  adminUid: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('role_layouts')
    .upsert(
      {
        role,
        cc_key: ccKey,
        sections,
        updated_at: new Date().toISOString(),
        updated_by: adminUid,
      },
      { onConflict: 'role,cc_key' },
    );

  return !error;
}
