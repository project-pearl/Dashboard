// ─── Drag-and-Drop Section Layout Configuration ────────────────────────────
// Unified types, default section orders, and Supabase persistence for
// the admin layout editor across all management centers.

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
  lensControlled?: boolean; // FMC only — visibility driven by ViewLens
}

export type CCKey = 'K12' | 'State' | 'MS4' | 'Sustainability' | 'NGO' | 'University' | 'FMC' | 'NCC'
  | 'Utility' | 'Infrastructure' | 'Insurance' | 'Agriculture' | 'AQUA-LO' | 'LabPartner';

// ─── Default Section Orders ────────────────────────────────────────────────

export const DEFAULT_SECTIONS = {
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
    // ── Shared / multi-lens sections ──
    { id: 'regprofile',          label: 'Water Health Dashboard',          order: 0,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'datareport',          label: 'Data Report Card',               order: 1,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'insights',            label: 'AI Insights Engine',             order: 2,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'alertfeed',           label: 'Statewide Alert Feed',           order: 3,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'map-grid',            label: 'Map & Waterbody List',           order: 4,  visible: true, defaultExpanded: true,  lensControlled: true, compound: true },
    { id: 'detail',              label: 'Waterbody Detail',               order: 5,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'top10',               label: 'Top 5 Worsening / Improving',   order: 6,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'ms4jurisdictions',    label: 'MS4 Jurisdictions',              order: 7,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'icis',                label: 'NPDES Compliance & Enforcement', order: 8,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'sdwis',               label: 'Drinking Water (SDWIS)',         order: 9,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'groundwater',         label: 'Groundwater Monitoring (NWIS)',  order: 10, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'exporthub',           label: 'Data Export Hub',                order: 11, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'grants',              label: 'Grant Opportunities',            order: 12, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'trends-dashboard',    label: 'Trends & Forecasting',          order: 13, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Overview (View 1) ──
    { id: 'operational-health',  label: 'Operational Health Bar',         order: 14, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'quick-access',        label: 'Quick Access Grid',             order: 15, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── AI Briefing (View 2) ──
    { id: 'briefing-actions',    label: 'Action Required',               order: 16, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'briefing-changes',    label: 'What Changed Overnight',        order: 17, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'briefing-pulse',      label: 'Program Pulse',                 order: 18, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'briefing-stakeholder', label: 'Stakeholder Watch',            order: 19, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Resolution Planner (View 3) ──
    { id: 'resolution-planner',  label: 'Resolution Plan Workspace',     order: 20, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Policy Tracker (View 5) ──
    { id: 'policy-federal',      label: 'Federal Actions Affecting State', order: 21, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'policy-state',        label: 'State Regulatory Actions',      order: 22, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'policy-epa',          label: 'EPA Oversight Status',          order: 23, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Compliance (View 6) ──
    { id: 'compliance-permits',  label: 'Permit Compliance Management',  order: 24, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'compliance-assessment', label: 'Assessment & Listing Mgmt',  order: 25, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'compliance-dwp',      label: 'Drinking Water Program',       order: 26, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'compliance-ms4',      label: 'MS4 Program Oversight',        order: 27, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'compliance-analytics', label: 'Compliance Analytics',        order: 28, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Water Quality (View 7) ──
    { id: 'wq-standards',        label: 'Standards Applied',            order: 29, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'wq-assessment',       label: 'Assessment Workspace',         order: 30, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'wq-aqualo',           label: 'Aqua-Lo Integration',          order: 31, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'wq-stations',         label: 'Enhanced Station Data',        order: 32, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Public Health (View 8) ──
    { id: 'ph-contaminants',     label: 'Contaminant Tracking',         order: 33, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ph-health-coord',     label: 'State Health Coordination',    order: 34, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ph-lab-capacity',     label: 'State Lab Capacity',           order: 35, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Habitat (View 9) ──
    { id: 'hab-bioassessment',   label: 'Bioassessment Program',        order: 36, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'hab-401cert',         label: 'Section 401 Certification',    order: 37, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'hab-wildlife',        label: 'State Wildlife Coordination',  order: 38, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Agriculture (View 10) ──
    { id: 'ag-319',              label: '319 Program Management',       order: 39, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ag-wbp',              label: 'Watershed-Based Plans',        order: 40, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ag-nutrient',         label: 'Nutrient Reduction Strategy',  order: 41, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ag-partners',         label: 'Agricultural Partner Mgmt',    order: 42, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Infrastructure (View 11) ──
    { id: 'infra-srf',           label: 'SRF Administration',           order: 43, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-capital',       label: 'Capital Improvement Planning', order: 44, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-construction',  label: 'Construction Project Tracker', order: 45, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-green',         label: 'Green Infrastructure',         order: 46, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Monitoring (View 12) ──
    { id: 'mon-network',         label: 'State Monitoring Network',     order: 47, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-data-mgmt',       label: 'Data Management Operations',   order: 48, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-optimization',    label: 'Network Optimization',         order: 49, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-continuous',      label: 'Continuous Monitoring',         order: 50, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Disaster (View 13) ──
    { id: 'disaster-active',     label: 'Active Incidents',             order: 51, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-response',   label: 'State Response Operations',    order: 52, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-spill',      label: 'Spill Reporting',              order: 53, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-prep',       label: 'Preparedness',                 order: 54, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── TMDL (View 14) ──
    { id: 'tmdl-status',         label: 'TMDL Program Status',          order: 55, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-303d',           label: '303(d) List Management',       order: 56, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-workspace',      label: 'TMDL Development Workspace',   order: 57, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-implementation', label: 'Implementation Tracking',      order: 58, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-restoration',    label: 'Watershed Restoration',        order: 59, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-epa',            label: 'EPA Coordination',             order: 60, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Scorecard (View 15) ──
    { id: 'sc-self-assessment',  label: 'State Self-Assessment',        order: 61, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-watershed',        label: 'Watershed Scorecards',         order: 62, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-peer',             label: 'Peer Comparison',              order: 63, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-epa-ppa',          label: 'EPA Performance Partnership',  order: 64, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Reports (View 16) ──
    { id: 'rpt-ir-workspace',    label: 'Integrated Report Workspace',  order: 65, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rpt-regulatory',      label: 'Regulatory Reports',           order: 66, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rpt-adhoc',           label: 'Ad-Hoc Reports',               order: 67, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Permits (View 17) ──
    { id: 'perm-status',         label: 'Permitting Operations Status', order: 68, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-inventory',      label: 'Permit Inventory',             order: 69, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-pipeline',       label: 'Permit Development Pipeline',  order: 70, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-dmr',            label: 'DMR & Compliance Monitoring',  order: 71, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-inspection',     label: 'Inspection Management',        order: 72, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-enforcement',    label: 'Enforcement Pipeline',         order: 73, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-general',        label: 'General Permits & Coverage',   order: 74, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Funding (View 18) ──
    { id: 'fund-active',         label: 'My Active Grants',             order: 75, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-srf',            label: 'SRF Fund Management',          order: 76, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-pipeline',       label: 'Opportunity Pipeline',         order: 77, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-passthrough',    label: 'Pass-Through Grants',          order: 78, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-analytics',      label: 'Financial Analytics',          order: 79, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Always visible ──
    { id: 'disclaimer',          label: 'Platform Disclaimer',          order: 80, visible: true, defaultExpanded: true,  lensControlled: true },
  ],

  MS4: [
    { id: 'identity',       label: 'Jurisdiction Identity',         order: 0,  visible: true, defaultExpanded: true },
    { id: 'insights',       label: 'AI Insights Engine',            order: 1,  visible: true, defaultExpanded: true },
    { id: 'quickactions',   label: 'Quick Actions',                 order: 2,  visible: true, defaultExpanded: true },
    { id: 'alertfeed',      label: 'Alert Feed',                    order: 3,  visible: true, defaultExpanded: false },
    { id: 'map-grid',       label: 'Map & Waterbody List',          order: 4,  visible: true, defaultExpanded: true, compound: true },
    { id: 'detail',         label: 'Waterbody Detail',              order: 5,  visible: true, defaultExpanded: true },
    { id: 'icis',           label: 'NPDES Compliance & Enforcement', order: 6,  visible: true, defaultExpanded: false },
    { id: 'sdwis',          label: 'Drinking Water (SDWIS)',        order: 7,  visible: true, defaultExpanded: false },
    { id: 'fineavoidance',  label: 'Fine Avoidance Calculator',     order: 8,  visible: true, defaultExpanded: true },
    { id: 'boundaryalerts', label: 'Watershed Boundary Alerts',    order: 9,  visible: true, defaultExpanded: false },
    { id: 'mdeexport',      label: 'MDE Annual Reporting',          order: 10, visible: true, defaultExpanded: true },
    { id: 'tmdl',           label: 'TMDL Compliance',               order: 11, visible: true, defaultExpanded: true },
    { id: 'nutrientcredits', label: 'Nutrient Credit Tracking',     order: 12, visible: true, defaultExpanded: true },
    { id: 'stormsim',       label: 'Storm Event Simulations',       order: 13, visible: true, defaultExpanded: true },
    { id: 'economics',      label: 'Compliance Economics',          order: 14, visible: true, defaultExpanded: true },
    { id: 'top10',          label: 'Top 10 Priority Waterbodies',   order: 15, visible: true, defaultExpanded: false },
    { id: 'exporthub',      label: 'Data Export Hub',               order: 16, visible: true, defaultExpanded: true },
    { id: 'grants',         label: 'Grant Opportunities',           order: 17, visible: true, defaultExpanded: true },
    { id: 'provenance',     label: 'Data Provenance & Chain of Custody', order: 18, visible: true, defaultExpanded: true },
    { id: 'trends-dashboard', label: 'Trends & Forecasting',        order: 19, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 20, visible: true, defaultExpanded: true },
  ],

  Sustainability: [
    { id: 'summary',        label: 'Sustainability Summary',        order: 0,  visible: true, defaultExpanded: true },
    { id: 'kpis',           label: 'KPI Cards',                     order: 1,  visible: true, defaultExpanded: true },
    { id: 'map-grid',       label: 'Map & Facility List',           order: 2,  visible: true, defaultExpanded: true, compound: true },
    { id: 'insights',       label: 'AI Insights Engine',            order: 3,  visible: true, defaultExpanded: true },
    { id: 'impact',         label: 'Environmental Impact',          order: 4,  visible: true, defaultExpanded: true },
    { id: 'chesbay',        label: 'Chesapeake Bay Watershed',      order: 5,  visible: true, defaultExpanded: true },
    { id: 'sustainability', label: 'Corporate Sustainability',      order: 6,  visible: true, defaultExpanded: true },
    { id: 'disclosure',     label: 'Sustainability Disclosure',     order: 7,  visible: true, defaultExpanded: true },
    { id: 'supplychain',    label: 'Supply Chain Analysis',         order: 8,  visible: true, defaultExpanded: true },
    { id: 'economic',       label: 'Economic Performance',          order: 9,  visible: true, defaultExpanded: true },
    { id: 'shareholder',    label: 'Shareholder Engagement',        order: 10, visible: true, defaultExpanded: true },
    { id: 'benchmark',      label: 'Benchmarking',                  order: 11, visible: true, defaultExpanded: true },
    { id: 'compliance',     label: 'Regulatory Compliance',         order: 12, visible: true, defaultExpanded: true },
    { id: 'brand',          label: 'Brand & Reputation',            order: 13, visible: true, defaultExpanded: true },
    { id: 'groundwater',    label: 'Groundwater & Aquifer Risk',    order: 14, visible: true, defaultExpanded: false },
    { id: 'grants',         label: 'Grant Opportunities',           order: 15, visible: true, defaultExpanded: true },
    { id: 'trends-dashboard', label: 'Trends & Forecasting',       order: 16, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 17, visible: true, defaultExpanded: true },
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
    { id: 'trends-dashboard', label: 'Trends & Forecasting',   order: 11, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'disclaimer',  label: 'Platform Disclaimer',          order: 12, visible: true, defaultExpanded: true },
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
    { id: 'trends-dashboard', label: 'Trends & Forecasting',   order: 13, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'disclaimer',  label: 'Platform Disclaimer',          order: 14, visible: true, defaultExpanded: true },
  ],

  FMC: [
    { id: 'usmap',              label: 'US Map',                      order: 0,  visible: true, defaultExpanded: true, compound: true, lensControlled: true },
    { id: 'impairmentprofile',  label: 'Impairment Profile',          order: 1,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'ai-water-intelligence', label: 'AI Water Intelligence',     order: 2,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'national-briefing',  label: 'National Intelligence Briefing', order: 3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'aiinsights',         label: 'AI Insights (Combined)',       order: 4,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'networkhealth',      label: 'Network Health Score',        order: 5,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'nationalimpact',     label: 'National Impact Counter',     order: 6,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'priorityqueue',      label: 'Priority Action Queue',       order: 7,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'coveragegaps',       label: 'Coverage Gaps',               order: 8,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'situation',          label: 'Situation Summary',           order: 9,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'top10',              label: 'Top 10 Worsening / Improving', order: 10, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'statebystatesummary', label: 'State-by-State Table',       order: 11, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'icis',               label: 'NPDES National Enforcement',  order: 12, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'sdwis',              label: 'Drinking Water (SDWIS)',      order: 13, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'groundwater',        label: 'Groundwater Monitoring',      order: 14, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'sla',                label: 'SLA Compliance',              order: 15, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-kpis',     label: 'Scorecard KPIs',              order: 16, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-grades',   label: 'State Grades',                order: 17, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-rankings', label: 'Top / Bottom States',         order: 18, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-trends',   label: 'Trend Cards',                 order: 19, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'reports-hub',        label: 'Federal Reports',             order: 20, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'trends-dashboard',   label: 'Trends & Projections',        order: 21, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'policy-tracker',     label: 'Policy & Regulatory Tracker', order: 22, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'contaminants-tracker', label: 'Emerging Contaminants',     order: 23, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'interagency-hub',    label: 'Cross-Agency Coordination',   order: 24, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'funding-landscape',  label: 'Funding & Grant Landscape',   order: 25, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'funding-deadlines', label: 'Upcoming Funding Deadlines',   order: 26, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'funding-state',    label: 'State Funding Snapshot',        order: 27, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'funding-matrix',   label: 'Impairment-to-Program Matrix',  order: 28, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'grant-outcomes',   label: 'Historical Grant Outcomes',     order: 29, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'funding-gap',      label: 'Funding Gap Analysis',          order: 30, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'waterbody-card',    label: 'State Waterbody Card',        order: 31, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'resolution-planner', label: 'Resolution Planner',         order: 32, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'federal-planner',    label: 'Federal Resolution Planner',  order: 33, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'disclaimer',         label: 'Platform Disclaimer',         order: 34, visible: true, defaultExpanded: true, lensControlled: true },
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
    { id: 'groundwater',   label: 'Groundwater & Subsidence Risk',  order: 6,  visible: true, defaultExpanded: false },
    { id: 'underwriting',   label: 'Underwriting Tools',            order: 7,  visible: true, defaultExpanded: false },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 8,  visible: true, defaultExpanded: true },
  ],

  Agriculture: [
    { id: 'nutrients',      label: 'Nutrient Management',           order: 0,  visible: true, defaultExpanded: true },
    { id: 'irrigation',     label: 'Irrigation Efficiency',         order: 1,  visible: true, defaultExpanded: true },
    { id: 'runoff',         label: 'Runoff Modeling',                order: 2,  visible: true, defaultExpanded: true },
    { id: 'credits',        label: 'Nutrient Credit Trading',       order: 3,  visible: true, defaultExpanded: true },
    { id: 'bmp',            label: 'BMP Inventory',                  order: 4,  visible: true, defaultExpanded: true },
    { id: 'soilhealth',     label: 'Soil & Water Conservation',     order: 5,  visible: true, defaultExpanded: true },
    { id: 'groundwater',   label: 'Groundwater Monitoring',         order: 6,  visible: true, defaultExpanded: true },
    { id: 'conservation',   label: 'Conservation Programs',         order: 7,  visible: true, defaultExpanded: false },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 8,  visible: true, defaultExpanded: true },
  ],

  'AQUA-LO': [
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

  LabPartner: [
    { id: 'wq-overview',     label: 'State WQ Overview',            order: 0,  visible: true, defaultExpanded: true },
    { id: 'impairment-map',  label: 'Impairment Map',               order: 1,  visible: true, defaultExpanded: true, compound: true },
    { id: 'monitoring-gaps', label: 'Monitoring Gaps',               order: 2,  visible: true, defaultExpanded: true },
    { id: 'param-trends',    label: 'Parameter Trends',              order: 3,  visible: true, defaultExpanded: true },
    { id: 'my-clients',      label: 'My Clients',                    order: 4,  visible: true, defaultExpanded: true },
    { id: 'disclaimer',      label: 'Platform Disclaimer',           order: 5,  visible: true, defaultExpanded: true },
  ],
} satisfies Record<Exclude<CCKey, 'NCC'>, SectionDefinition[]> as Record<CCKey, SectionDefinition[]>;

// Backward-compat: NCC alias for legacy persisted layouts
DEFAULT_SECTIONS.NCC = DEFAULT_SECTIONS.FMC;

// ─── Supabase Persistence ──────────────────────────────────────────────────

export async function fetchLayout(
  role: UserRole,
  ccKey: CCKey,
): Promise<SectionDefinition[] | null> {
  // Try requested key first, fall back to NCC for legacy data
  const { data, error } = await supabase
    .from('role_layouts')
    .select('sections')
    .eq('role', role)
    .eq('cc_key', ccKey)
    .maybeSingle();

  if (!error && data) return data.sections as SectionDefinition[];

  // Fallback: if ccKey is FMC, try legacy NCC rows
  if (ccKey === 'FMC') {
    const { data: legacy } = await supabase
      .from('role_layouts')
      .select('sections')
      .eq('role', role)
      .eq('cc_key', 'NCC')
      .maybeSingle();
    if (legacy) return legacy.sections as SectionDefinition[];
  }

  return null;
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
