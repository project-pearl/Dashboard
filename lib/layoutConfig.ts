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
  | 'Utility' | 'Infrastructure' | 'Insurance' | 'Agriculture' | 'AQUA-LO';

// ─── Default Section Orders ────────────────────────────────────────────────

export const DEFAULT_SECTIONS = {
  K12: [
    // ── Shared / multi-lens sections ──
    { id: 'wildlife',    label: 'Wildlife Impact',              order: 0,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'warr-metrics',  label: 'WARR Metrics Strip',  order: 0.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-analyze',  label: 'WARR Analyze Zone',   order: 0.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-respond',  label: 'WARR Respond Zone',   order: 0.3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-resolve',  label: 'WARR Resolve Zone',   order: 0.4, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'regprofile',  label: 'Water Health Dashboard',       order: 1,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'insights',    label: 'AI Insights Engine',           order: 2,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'alertfeed',   label: 'Statewide Alert Feed',         order: 3,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'map-grid',    label: 'Map & Waterbody List',         order: 4,  visible: true, defaultExpanded: true,  lensControlled: true, compound: true },
    { id: 'detail',      label: 'Waterbody Detail',             order: 5,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'top10',       label: 'Top 5 Worsening / Improving',  order: 6,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'learning',    label: 'Student Learning Mode',        order: 7,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'projects',    label: 'Science Fair & STEM Projects', order: 8,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fieldreport', label: 'Field Report & Data Export',   order: 9,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'eduhub',      label: 'K-12 Educational Hub',         order: 10, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'teacher',     label: 'Teacher Resources',            order: 11, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'grants',      label: 'Grant Opportunities',          order: 12, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'goodbye',     label: 'Community Celebration',        order: 13, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'trends-dashboard', label: 'Trends & Forecasting',   order: 14, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Shared panels ──
    { id: 'resolution-planner',  label: 'Resolution Plan Workspace',     order: 15, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'restoration-planner', label: 'Restoration Planner',          order: 16, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'contaminants-tracker', label: 'Emerging Contaminants',        order: 17, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'sdwis',               label: 'Drinking Water (SDWIS)',        order: 17, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'reports-hub',         label: 'Reports Hub',                   order: 18, visible: true, defaultExpanded: true, lensControlled: true },
    // ── K-12 exclusive panels ──
    { id: 'outdoor-classroom-panel',     label: 'Outdoor Classroom',           order: 19, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'student-monitoring-panel',    label: 'Student Monitoring Tools',    order: 20, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'student-upload-panel',        label: 'Student Data Uploads',        order: 21, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'drinking-water-safety-panel', label: 'Drinking Water Safety',      order: 22, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'location-report', label: 'Location Water Quality Report', order: 23, visible: true, defaultExpanded: false, lensControlled: true },
    // ── Always visible ──
    { id: 'disclaimer',  label: 'Platform Disclaimer',          order: 24, visible: true, defaultExpanded: true,  lensControlled: true },
  ],

  State: [
    // ── Shared / multi-lens sections ──
    { id: 'regprofile',          label: 'Water Health Dashboard',          order: 0,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'datareport',          label: 'Data Report Card',               order: 1,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'warr-metrics',  label: 'WARR Metrics Strip',  order: 1.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-analyze',  label: 'WARR Analyze Zone',   order: 1.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-respond',  label: 'WARR Respond Zone',   order: 1.3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-resolve',  label: 'WARR Resolve Zone',   order: 1.4, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'insights',            label: 'AI Insights Engine',             order: 2,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'alertfeed',           label: 'Statewide Alert Feed',           order: 3,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'map-grid',            label: 'Map & Waterbody List',           order: 4,  visible: true, defaultExpanded: true,  lensControlled: true, compound: true },
    { id: 'detail',              label: 'Waterbody Detail',               order: 5,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'top10',               label: 'Top 5 Worsening / Improving',   order: 6,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'ms4jurisdictions',    label: 'MS4 Jurisdictions',              order: 7,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'icis',                label: 'NPDES Compliance & Enforcement', order: 8,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'sdwis',               label: 'Drinking Water (SDWIS)',         order: 9,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'groundwater',         label: 'Groundwater Monitoring (WDFN)',  order: 10, visible: true, defaultExpanded: false, lensControlled: true },
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
    // ── Emergency Response / Resolution Planner (View 3) ──
    { id: 'fed-emergency-overview', label: 'National Emergency Overview', order: 19.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'fed-active-incidents', label: 'Active Incidents',              order: 19.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'fed-spill-tracker',   label: 'Federal Spill Tracker',         order: 19.3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'resolution-planner',  label: 'Resolution Plan Workspace',     order: 20, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'restoration-planner', label: 'Restoration Planner',           order: 21, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Policy Tracker (View 5) ──
    { id: 'policy-federal',      label: 'Federal Actions Affecting State', order: 22, visible: true, defaultExpanded: true,  lensControlled: true },
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
    { id: 'hab-ecoscore',           label: 'State Eco Score',              order: 34, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'hab-attainment',         label: 'Habitat & Ecological Sensitivity', order: 35, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'hab-bioassessment',      label: 'Bioassessment Program',        order: 36, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'hab-impairment-causes',  label: 'Habitat Impairment Causes',    order: 36.5, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'hab-wildlife',           label: 'Threatened & Endangered Species', order: 37, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'hab-401cert',            label: 'Section 401 Certification',    order: 38, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Agriculture (View 10) ──
    { id: 'ag-319',              label: '319 Program Management',       order: 39, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ag-wbp',              label: 'Watershed-Based Plans',        order: 40, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ag-nutrient',         label: 'Nutrient Reduction Strategy',  order: 41, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ag-partners',         label: 'Agricultural Partner Mgmt',    order: 42, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ag-nps-breakdown',    label: 'NPS Pollution Breakdown',      order: 43, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ag-bmp-effectiveness',label: 'BMP Effectiveness',            order: 44, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ag-nps-tmdl',         label: 'NPS-Specific TMDL Progress',  order: 45, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ag-nps-funding',      label: 'NPS Funding & Grants',        order: 46, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Infrastructure (View 11) ──
    { id: 'infra-srf',           label: 'SRF Program',           order: 47, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-capital',       label: 'Capital Improvement Planning', order: 48, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-construction',  label: 'Construction Project Tracker', order: 49, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-green',         label: 'Green Infrastructure',         order: 50, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Monitoring (View 12) ──
    { id: 'mon-network',         label: 'State Monitoring Network',     order: 51, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-data-mgmt',       label: 'Data Management Operations',   order: 52, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-optimization',    label: 'Network Optimization',         order: 53, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-continuous',      label: 'Continuous Monitoring',         order: 54, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-latency',         label: 'Data Latency Tracker',         order: 55, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-report-card',     label: 'Data Report Card',             order: 56, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-source-health',   label: 'Source Health Registry',       order: 57, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Disaster (View 13) ──
    { id: 'disaster-active',     label: 'Active Incidents',             order: 58, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-response',   label: 'State Response Operations',    order: 59, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-spill',      label: 'Spill Reporting',              order: 60, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-prep',       label: 'Preparedness',                 order: 61, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-cascade',    label: 'Cross-Agency Alert Correlation', order: 62, visible: true, defaultExpanded: true, lensControlled: true },
    // ── TMDL (View 14) ──
    { id: 'tmdl-status',         label: 'TMDL Program Status',          order: 63, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-303d',           label: '303(d) List Management',       order: 64, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-workspace',      label: 'TMDL Development Workspace',   order: 65, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-implementation', label: 'Implementation Tracking',      order: 66, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-restoration',    label: 'Watershed Restoration',        order: 67, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-epa',            label: 'EPA Coordination',             order: 68, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-completion-trend', label: 'TMDL Completion Trend',      order: 68.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'tmdl-cause-breakdown',  label: 'Impairment Cause Breakdown', order: 68.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'tmdl-delisting-stories', label: 'Delisting Success Stories', order: 68.3, visible: true, defaultExpanded: true, lensControlled: true },
    // ── Scorecard (View 15) ──
    { id: 'sc-self-assessment',  label: 'State Self-Assessment',        order: 69, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-watershed',        label: 'Watershed Scorecards',         order: 70, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-peer',             label: 'Peer Comparison',              order: 71, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-epa-ppa',          label: 'EPA Performance Partnership',  order: 72, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Reports (View 16) ──
    { id: 'rpt-ir-workspace',    label: 'Integrated Report Workspace',  order: 73, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rpt-regulatory',      label: 'Regulatory Reports',           order: 74, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rpt-adhoc',           label: 'Ad-Hoc Reports',               order: 75, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Permits (View 17) ──
    { id: 'perm-status',         label: 'Permitting Operations Status', order: 76, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-inventory',      label: 'Permit Inventory',             order: 77, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-pipeline',       label: 'Permit Development Pipeline',  order: 78, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-dmr',            label: 'DMR & Compliance Monitoring',  order: 79, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-inspection',     label: 'Inspection Management',        order: 80, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-enforcement',    label: 'Enforcement Pipeline',         order: 81, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'perm-general',        label: 'General Permits & Coverage',   order: 82, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Funding (View 18) ──
    { id: 'fund-active',         label: 'My Active Grants',             order: 83, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-srf',            label: 'SRF Program',                  order: 84, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-pipeline',       label: 'Opportunity Pipeline',         order: 85, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-passthrough',    label: 'Pass-Through Grants',          order: 86, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-analytics',      label: 'Financial Analytics',          order: 87, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'location-report',     label: 'Location Water Quality Report', order: 88, visible: true, defaultExpanded: false, lensControlled: true },
    // ── Always visible ──
    { id: 'disclaimer',          label: 'Platform Disclaimer',          order: 89, visible: true, defaultExpanded: true,  lensControlled: true },
  ],

  MS4: [
    // ── Shared / multi-lens sections ──
    { id: 'identity',            label: 'Jurisdiction Identity',            order: 0,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'warr-metrics',  label: 'WARR Metrics Strip',  order: 0.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-analyze',  label: 'WARR Analyze Zone',   order: 0.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-respond',  label: 'WARR Respond Zone',   order: 0.3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-resolve',  label: 'WARR Resolve Zone',   order: 0.4, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'insights',            label: 'AI Insights Engine',               order: 1,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'alertfeed',           label: 'Alert Feed',                       order: 2,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'map-grid',            label: 'Map & Waterbody List',             order: 3,  visible: true, defaultExpanded: true,  lensControlled: true, compound: true },
    { id: 'detail',              label: 'Waterbody Detail',                 order: 4,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'top10',               label: 'Top 10 Priority Waterbodies',      order: 5,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'icis',                label: 'NPDES Compliance & Enforcement',   order: 6,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'sdwis',               label: 'Drinking Water (SDWIS)',           order: 7,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'exporthub',           label: 'Data Export Hub',                  order: 8,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'grants',              label: 'Grant Opportunities',              order: 9,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'trends-dashboard',    label: 'Trends & Forecasting',             order: 10, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fineavoidance',       label: 'Fine Avoidance Calculator',        order: 11, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'quickactions',        label: 'Quick Actions',                    order: 12, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Overview (View 1) ──
    { id: 'operational-health',  label: 'Operational Health Bar',            order: 13, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'quick-access',        label: 'Quick Access Grid',                order: 14, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── AI Briefing (View 2) ──
    { id: 'briefing-actions',    label: 'Action Required',                  order: 15, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'briefing-changes',    label: 'What Changed Overnight',           order: 16, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'briefing-pulse',      label: 'Program Pulse',                    order: 17, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'briefing-stakeholder', label: 'Stakeholder Watch',               order: 18, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Resolution Planner (View 3) ──
    { id: 'resolution-planner',  label: 'Resolution Plan Workspace',        order: 19, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'restoration-planner', label: 'Restoration Planner',              order: 20, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Policy Tracker (View 5) ──
    { id: 'policy-federal',      label: 'Federal Actions Affecting MS4',    order: 21, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'policy-state',        label: 'State Regulatory Actions',         order: 21, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'policy-epa',          label: 'EPA Oversight Status',             order: 22, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Compliance (View 6) ──
    { id: 'compliance-permits',  label: 'Permit Compliance Management',     order: 23, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'compliance-assessment', label: 'Assessment & Listing Mgmt',      order: 24, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'compliance-ms4',      label: 'MS4 Permit Conditions',            order: 25, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'compliance-analytics', label: 'Compliance Analytics',            order: 26, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Water Quality (View 7) ──
    { id: 'wq-standards',        label: 'Standards Applied',                order: 27, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'wq-assessment',       label: 'Assessment Workspace',             order: 28, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'wq-stations',         label: 'Enhanced Station Data',            order: 29, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'wq-stormwater',       label: 'Stormwater Quality Monitoring',    order: 30, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Public Health (View 8) ──
    { id: 'ph-contaminants',     label: 'Contaminant Tracking',             order: 31, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ph-health-coord',     label: 'Health Department Coordination',   order: 32, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ph-advisories',       label: 'Public Advisories & Notifications', order: 33, visible: true, defaultExpanded: true, lensControlled: true },
    // ── Receiving Waters (View 9) ★ ──
    { id: 'rw-map',              label: 'Receiving Water Map',              order: 34, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rw-profiles',         label: 'Waterbody Profiles',               order: 35, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rw-upstream',         label: 'Upstream Source Analysis',          order: 36, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rw-monitoring',       label: 'Receiving Water Monitoring',       order: 37, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rw-impairment',       label: 'Impairment Analysis',              order: 38, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Stormwater BMPs (View 10) ★ ──
    { id: 'bmp-inventory',       label: 'BMP Inventory',                    order: 39, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'bmp-details',         label: 'BMP Detail Cards',                 order: 40, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'bmp-analytics',       label: 'BMP Performance Analytics',        order: 41, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'bmp-maintenance',     label: 'Maintenance Schedule',             order: 42, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'bmp-planning',        label: 'BMP Planning & Siting',            order: 43, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Infrastructure (View 11) ──
    { id: 'infra-srf',           label: 'SRF Program',               order: 44, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-capital',       label: 'Capital Improvement Planning',     order: 45, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-construction',  label: 'Construction Project Tracker',     order: 46, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-green',         label: 'Green Infrastructure',             order: 47, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Monitoring (View 12) ──
    { id: 'mon-network',         label: 'Monitoring Network',               order: 48, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-data-mgmt',       label: 'Data Management Operations',       order: 49, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-optimization',    label: 'Network Optimization',             order: 50, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mon-continuous',      label: 'Continuous Monitoring',            order: 51, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Disaster (View 13) ──
    { id: 'disaster-active',     label: 'Active Incidents',                 order: 52, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-response',   label: 'MS4 Response Operations',          order: 53, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-spill',      label: 'Spill Reporting',                  order: 54, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-prep',       label: 'Preparedness',                     order: 55, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── TMDL Compliance (View 14) ★ ──
    { id: 'tmdl-inventory',      label: 'TMDL Inventory',                   order: 56, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-loading',        label: 'Pollutant Loading Analysis',       order: 57, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-pathways',       label: 'Compliance Pathways',              order: 58, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-docs',           label: 'TMDL Documentation',               order: 59, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tmdl-wla',            label: 'Wasteload Allocations',            order: 60, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Scorecard (View 15) ──
    { id: 'sc-permit-score',     label: 'Permit Compliance Score',          order: 61, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-bmp-performance',  label: 'BMP Performance Score',            order: 62, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-peer',             label: 'Peer Comparison',                  order: 63, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-trends',           label: 'Trend Cards',                      order: 64, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Reports (View 16) ──
    { id: 'rpt-annual',          label: 'Annual Report Builder',            order: 65, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rpt-mde-export',      label: 'MDE Export Tools',                 order: 66, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rpt-regulatory',      label: 'Regulatory Reports',               order: 67, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rpt-adhoc',           label: 'Ad-Hoc Reports',                   order: 68, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── MCM Program Manager (View 17) ★ ──
    { id: 'mcm-dashboard',       label: 'MCM Dashboard',                    order: 69, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mcm-1',               label: 'MCM 1: Public Education',          order: 70, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mcm-2',               label: 'MCM 2: Public Involvement',        order: 71, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mcm-3',               label: 'MCM 3: Illicit Discharge Detection', order: 72, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'mcm-4',               label: 'MCM 4: Construction Site Runoff',  order: 73, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mcm-5',               label: 'MCM 5: Post-Construction Mgmt',   order: 74, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mcm-6',               label: 'MCM 6: Pollution Prevention',     order: 75, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Funding (View 18) ──
    { id: 'fund-active',         label: 'My Active Grants',                 order: 76, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-srf',            label: 'SRF Program',                      order: 76.1, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-pipeline',       label: 'Opportunity Pipeline',             order: 77, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-stormwater',     label: 'Stormwater Funding Programs',      order: 78, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-analytics',      label: 'Financial Analytics',              order: 79, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Legacy preserved ──
    { id: 'boundaryalerts',      label: 'Watershed Boundary Alerts',        order: 80, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'nutrientcredits',     label: 'Nutrient Credit Tracking',         order: 81, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'stormsim',            label: 'Storm Event Simulations',          order: 82, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'economics',           label: 'Compliance Economics',             order: 83, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'mdeexport',           label: 'MDE Annual Reporting',             order: 84, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'provenance',          label: 'Data Provenance & Chain of Custody', order: 85, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'location-report',     label: 'Location Water Quality Report',    order: 86, visible: true, defaultExpanded: false, lensControlled: true },
    // ── Always visible ──
    { id: 'disclaimer',          label: 'Platform Disclaimer',              order: 87, visible: true, defaultExpanded: true,  lensControlled: true },
  ],

  Sustainability: [
    // ── Shared / multi-lens sections ──
    { id: 'summary',        label: 'Sustainability Summary',        order: 0,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'warr-metrics',  label: 'WARR Metrics Strip',  order: 0.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-analyze',  label: 'WARR Analyze Zone',   order: 0.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-respond',  label: 'WARR Respond Zone',   order: 0.3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-resolve',  label: 'WARR Resolve Zone',   order: 0.4, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'kpis',           label: 'KPI Cards',                     order: 1,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'map-grid',       label: 'Map & Facility List',           order: 2,  visible: true, defaultExpanded: true,  lensControlled: true, compound: true },
    { id: 'insights',       label: 'AI Insights Engine',            order: 3,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'impact',         label: 'Environmental Impact',          order: 4,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'chesbay',        label: 'Chesapeake Bay Watershed',      order: 5,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sustainability', label: 'Corporate Sustainability',      order: 6,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disclosure',     label: 'Sustainability Disclosure',     order: 7,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'supplychain',    label: 'Supply Chain Analysis',         order: 8,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'economic',       label: 'Economic Performance',          order: 9,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'shareholder',    label: 'Shareholder Engagement',        order: 10, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'benchmark',      label: 'Benchmarking',                  order: 11, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'compliance',     label: 'Regulatory Compliance',         order: 12, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'brand',          label: 'Brand & Reputation',            order: 13, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'groundwater',    label: 'Groundwater & Aquifer Risk',    order: 14, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'grants',         label: 'Grant Opportunities',           order: 15, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'trends-dashboard', label: 'Trends & Forecasting',       order: 16, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Shared panels ──
    { id: 'resolution-planner',    label: 'Resolution Plan Workspace',     order: 17, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'restoration-planner',   label: 'Restoration Planner',           order: 18, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'policy-tracker',        label: 'Policy & Regulatory Tracker',   order: 19, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'contaminants-tracker',  label: 'Emerging Contaminants',         order: 20, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'icis',                  label: 'NPDES Compliance & Enforcement',order: 20, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'sdwis',                 label: 'Drinking Water (SDWIS)',        order: 21, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'disaster-emergency-panel', label: 'Disaster & Emergency',      order: 22, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-kpis',        label: 'Scorecard KPIs',               order: 23, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-grades',      label: 'Scorecard Grades',             order: 24, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'reports-hub',           label: 'Reports Hub',                   order: 25, visible: true, defaultExpanded: true, lensControlled: true },
    // ── ESG exclusive panels ──
    { id: 'water-stewardship-panel',  label: 'Water Stewardship',         order: 26, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'facility-operations-panel', label: 'Facility Operations',      order: 27, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'esg-reporting-panel',      label: 'ESG Reporting',             order: 28, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'supply-chain-risk-panel',  label: 'Supply Chain Risk',         order: 29, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'location-report',          label: 'Location Water Quality Report', order: 30, visible: true, defaultExpanded: false, lensControlled: true },
    // ── Always visible ──
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 31, visible: true, defaultExpanded: true,  lensControlled: true },
  ],

  NGO: [
    // ── Shared / multi-lens sections ──
    { id: 'regprofile',  label: 'Region Profile',               order: 0,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'warr-metrics',  label: 'WARR Metrics Strip',  order: 0.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-analyze',  label: 'WARR Analyze Zone',   order: 0.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-respond',  label: 'WARR Respond Zone',   order: 0.3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-resolve',  label: 'WARR Resolve Zone',   order: 0.4, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'insights',    label: 'AI Insights Engine',            order: 1,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'alertfeed',   label: 'Alert Feed',                   order: 2,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'map-grid',    label: 'Map & Waterbody List',         order: 3,  visible: true, defaultExpanded: true,  lensControlled: true, compound: true },
    { id: 'detail',      label: 'Waterbody Detail',             order: 4,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'top10',       label: 'Top 5 Worsening / Improving',  order: 5,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'volunteer',   label: 'Volunteer Monitoring',         order: 6,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'community',   label: 'Community Engagement',         order: 7,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'policy',      label: 'Policy Recommendations',       order: 8,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'partners',    label: 'Partner Organizations',        order: 9,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'grants',      label: 'Grant Opportunities',          order: 10, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'trends-dashboard', label: 'Trends & Forecasting',   order: 11, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Shared panels ──
    { id: 'resolution-planner',    label: 'Resolution Plan Workspace',     order: 12, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'restoration-planner',   label: 'Restoration Planner',           order: 13, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'policy-tracker',        label: 'Policy & Regulatory Tracker',   order: 14, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'contaminants-tracker',  label: 'Emerging Contaminants',         order: 15, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'icis',                  label: 'NPDES Compliance & Enforcement',order: 15, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'sdwis',                 label: 'Drinking Water (SDWIS)',        order: 16, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'groundwater',           label: 'Groundwater Monitoring (WDFN)', order: 17, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'disaster-emergency-panel', label: 'Disaster & Emergency',      order: 18, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-kpis',        label: 'Scorecard KPIs',               order: 19, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-grades',      label: 'Scorecard Grades',             order: 20, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'reports-hub',           label: 'Reports Hub',                   order: 21, visible: true, defaultExpanded: true, lensControlled: true },
    // ── NGO exclusive panels ──
    { id: 'watershed-health-panel',      label: 'Watershed Health',              order: 22, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'restoration-projects-panel',  label: 'Restoration Projects',          order: 23, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'advocacy-panel',              label: 'Advocacy Center',               order: 24, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'volunteer-program-panel',     label: 'Volunteer Program Management',  order: 25, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'citizen-reporting-panel',     label: 'Citizen Reporting',             order: 26, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'location-report',            label: 'Location Water Quality Report', order: 27, visible: true, defaultExpanded: false, lensControlled: true },
    // ── Always visible ──
    { id: 'disclaimer',  label: 'Platform Disclaimer',          order: 28, visible: true, defaultExpanded: true,  lensControlled: true },
  ],

  University: [
    // ── Shared / multi-lens sections ──
    { id: 'regprofile',  label: 'Region Profile',               order: 0,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'warr-metrics',  label: 'WARR Metrics Strip',  order: 0.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-analyze',  label: 'WARR Analyze Zone',   order: 0.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-respond',  label: 'WARR Respond Zone',   order: 0.3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-resolve',  label: 'WARR Resolve Zone',   order: 0.4, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'alertfeed',   label: 'Alert Feed',                   order: 1,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'insights',    label: 'AI Insights Engine',            order: 2,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'map-grid',    label: 'Map & Waterbody List',         order: 3,  visible: true, defaultExpanded: true,  lensControlled: true, compound: true },
    { id: 'detail',      label: 'Waterbody Detail',             order: 4,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'top10',       label: 'Top 5 Worsening / Improving',  order: 5,  visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'research',    label: 'Research Collaboration Hub',   order: 6,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'manuscript',  label: 'Manuscript & Publication',     order: 7,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'academic',    label: 'Academic Tools',               order: 8,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'methodology', label: 'Data Integrity & Methodology', order: 9,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'datasets',    label: 'Dataset Catalog',              order: 10, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'exporthub',   label: 'Data Export Hub',              order: 11, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'grants',      label: 'Grant Opportunities',          order: 12, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'trends-dashboard', label: 'Trends & Forecasting',   order: 13, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Shared panels ──
    { id: 'resolution-planner',    label: 'Resolution Plan Workspace',     order: 14, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'restoration-planner',   label: 'Restoration Planner',           order: 15, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'policy-tracker',        label: 'Policy & Regulatory Tracker',   order: 16, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'contaminants-tracker',  label: 'Emerging Contaminants',         order: 16, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'icis',                  label: 'NPDES Compliance & Enforcement',order: 17, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'sdwis',                 label: 'Drinking Water (SDWIS)',        order: 18, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'groundwater',           label: 'Groundwater Monitoring (WDFN)', order: 19, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'disaster-emergency-panel', label: 'Disaster & Emergency',      order: 20, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-kpis',        label: 'Scorecard KPIs',               order: 21, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-grades',      label: 'Scorecard Grades',             order: 22, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'reports-hub',           label: 'Reports Hub',                   order: 23, visible: true, defaultExpanded: true, lensControlled: true },
    // ── University exclusive panels ──
    { id: 'campus-stormwater-panel',      label: 'Campus Stormwater',            order: 24, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'watershed-partnerships-panel', label: 'Watershed Partnerships',       order: 25, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'location-report',             label: 'Location Water Quality Report', order: 26, visible: true, defaultExpanded: false, lensControlled: true },
    // ── Always visible ──
    { id: 'disclaimer',  label: 'Platform Disclaimer',          order: 27, visible: true, defaultExpanded: true,  lensControlled: true },
  ],

  FMC: [
    { id: 'usmap',              label: 'US Map',                      order: 0,  visible: true, defaultExpanded: true, compound: true, lensControlled: true },
    { id: 'warr-metrics',       label: 'WARR Metrics Strip',          order: 0.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-analyze',       label: 'WARR Analyze Zone',           order: 0.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-respond',       label: 'WARR Respond Zone',           order: 0.3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-resolve',       label: 'WARR Resolve Zone',           order: 0.4, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'situation',          label: 'Situation Summary',           order: 1,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'impairmentprofile',  label: 'Waterbody & Impairment Profile', order: 2,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'ai-water-intelligence', label: 'PIN Insights',              order: 3,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'national-briefing',  label: 'National Intelligence Briefing', order: 4, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'sentinel-briefing',  label: 'Sentinel System Health',      order: 5,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'briefing-actions',    label: 'Action Required',               order: 5.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'briefing-changes',    label: 'What Changed Overnight',        order: 5.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'briefing-pulse',      label: 'Program Pulse',                 order: 5.3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'briefing-stakeholder', label: 'Stakeholder Watch',            order: 5.4, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'aiinsights',         label: 'AI Insights (Combined)',       order: 6,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'wq-domain-tabs',     label: 'Water Quality Domain Tabs',   order: 6.5, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'networkhealth',      label: 'Network Health Score',        order: 7,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'nationalimpact',     label: 'National Treatment Impact',   order: 8,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'priorityqueue',      label: 'Priority Action Queue',       order: 9,  visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'coveragegaps',       label: 'Coverage Gaps',               order: 10, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'top10',              label: 'Top 10 Worsening / Improving', order: 11, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'statebystatesummary', label: 'State-by-State Table',       order: 12, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'icis',               label: 'NPDES National Enforcement',  order: 13, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'sdwis',              label: 'Drinking Water (SDWIS)',      order: 14, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'groundwater',        label: 'Groundwater Monitoring',      order: 15, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'sla',                label: 'SLA Compliance',              order: 16, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-kpis',     label: 'Scorecard KPIs',              order: 17, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-grades',   label: 'State Grades',                order: 18, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-rankings', label: 'Top / Bottom States',         order: 19, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-choropleth', label: 'Grade Choropleth',           order: 19.5, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'scorecard-trends',   label: 'Trend Cards',                 order: 20, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'reports-hub',        label: 'Federal Reports',             order: 21, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'trends-dashboard',   label: 'Trends & Projections',        order: 22, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'policy-tracker',     label: 'Policy & Regulatory Tracker', order: 23, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'contaminants-tracker', label: 'Emerging Contaminants',     order: 24, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'sentinel-alerts-placeholder', label: 'Sentinel Alerts (Coming Soon)', order: 24.5, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'interagency-hub',    label: 'Cross-Agency Coordination',   order: 25, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'data-latency',       label: 'Data Freshness Tracker',      order: 25.5, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'funding-landscape',  label: 'Funding & Grant Landscape',   order: 26, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'funding-deadlines', label: 'Upcoming Funding Deadlines',   order: 27, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'funding-state',    label: 'State Funding Snapshot',        order: 28, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'funding-matrix',   label: 'Impairment-to-Program Matrix',  order: 29, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'grant-outcomes',   label: 'Historical Grant Outcomes',     order: 30, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'funding-gap',      label: 'Funding Gap Analysis',          order: 31, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'resolution-planner', label: 'Resolution Planner',         order: 32, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'restoration-planner', label: 'Restoration Planner',       order: 33, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'habitat-ecology',    label: 'Habitat & Ecology',           order: 34, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'agricultural-nps',   label: 'Agricultural & NPS',          order: 36, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'disaster-emergency', label: 'Disaster & Emergency',        order: 37, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'military-installations', label: 'Military Installations',  order: 38, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'waterfront-exposure', label: 'Waterfront Value Exposure',  order: 39, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'fund-srf',           label: 'SRF Program',                 order: 39.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'infra-capital',      label: 'Capital Improvement Planning', order: 39.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'infra-construction', label: 'Construction Project Tracker', order: 39.3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'infra-green',        label: 'Green Infrastructure',        order: 39.4, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'location-report',    label: 'Location Water Quality Report', order: 40, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'disclaimer',         label: 'Platform Disclaimer',         order: 41, visible: true, defaultExpanded: true, lensControlled: true },
  ],

  Utility: [
    // ── Shared / multi-lens sections ──
    { id: 'system-status',          label: 'System Status Hero',               order: 0,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'warr-metrics',       label: 'WARR Metrics Strip',             order: 0.1, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-analyze',       label: 'WARR Analyze Zone',              order: 0.2, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-respond',       label: 'WARR Respond Zone',              order: 0.3, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'warr-resolve',       label: 'WARR Resolve Zone',              order: 0.4, visible: true, defaultExpanded: true, lensControlled: true },
    { id: 'operational-stats',      label: 'Operational Quick Stats',          order: 1,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'compliance-calendar',    label: 'Compliance Calendar Strip',        order: 2,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'weather-source',         label: 'Weather & Source Conditions',      order: 3,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'alerts-notifications',   label: 'Alerts & Notifications',          order: 4,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'quick-access',           label: 'Quick Access Grid',               order: 5,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disclaimer',             label: 'Platform Disclaimer',             order: 6,  visible: true, defaultExpanded: true,  lensControlled: true },
    // ── AI Briefing (View 2) ──
    { id: 'briefing-plant',         label: 'Plant Status',                    order: 7,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'briefing-compliance',    label: 'Compliance Status',               order: 8,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'briefing-system',        label: 'System Watch',                    order: 9,  visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'briefing-business',      label: 'Business & Planning',            order: 10, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Resolution Planner (View 3) ──
    { id: 'resolution-planner',     label: 'Resolution Plan Workspace',       order: 11, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Trends & Projections (View 4) ──
    { id: 'trends-treatment',       label: 'Treatment Performance Trends',    order: 12, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'trends-flow',            label: 'Flow & Capacity Trends',          order: 13, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'trends-water-loss',      label: 'Water Loss & Efficiency',         order: 14, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'trends-collection',      label: 'Collection System Trends',        order: 15, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'trends-financial',       label: 'Financial Trends',                order: 16, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Policy Tracker (View 5) ──
    { id: 'policy-operations',      label: 'Regulations Affecting Operations',order: 17, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'policy-permits',         label: 'Permit & Standard Changes',       order: 18, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'policy-funding-rules',   label: 'Funding & Program Rule Changes',  order: 19, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Compliance (View 6) ──
    { id: 'comp-dashboard',         label: 'Compliance Dashboard',            order: 20, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'comp-effluent',          label: 'Effluent Compliance (WW)',        order: 21, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'comp-drinking-water',    label: 'Drinking Water Compliance',       order: 22, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'comp-dmr',               label: 'DMR & Reporting',                 order: 23, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'comp-violations',        label: 'Violation Management',            order: 24, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'comp-pretreatment',      label: 'Pretreatment Program',            order: 25, visible: true, defaultExpanded: false, lensControlled: true },
    // ── Water Quality (View 7) ──
    { id: 'wq-source',              label: 'Source Water Quality',            order: 26, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'wq-process',             label: 'Treatment Process WQ',           order: 27, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'wq-finished',            label: 'Finished Water / Effluent',      order: 28, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'wq-special',             label: 'Special Monitoring',              order: 29, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'wq-aqualo',              label: 'Aqua-Lo Integration',             order: 30, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Public Health & Contaminants (View 8) ──
    { id: 'ph-dw-health',           label: 'Drinking Water Health Compliance',order: 31, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ph-lead-copper',         label: 'Lead & Copper Program',           order: 32, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ph-pfas',                label: 'PFAS & Emerging Contaminants',    order: 33, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ph-pathogen',            label: 'Pathogen Control',                order: 34, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'ph-effluent-impact',     label: 'Effluent Public Health Impact',   order: 35, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Source & Receiving Waters (View 9 — utility-exclusive) ──
    { id: 'sr-source-status',       label: 'Source Water Status',             order: 36, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sr-protection',          label: 'Source Water Protection',         order: 37, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sr-threats',             label: 'Source Water Threats',            order: 38, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sr-monitoring',          label: 'Source Water Monitoring',         order: 39, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sr-receiving-status',    label: 'Receiving Water Status',          order: 40, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sr-discharge-impact',    label: 'Discharge Impact Analysis',       order: 41, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sr-regulatory-nexus',    label: 'Regulatory Nexus',                order: 42, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Treatment & Process (View 10 — utility-exclusive) ──
    { id: 'tp-dw-process-flow',     label: 'DW Process Flow Diagram',        order: 43, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tp-dw-performance',      label: 'DW Process Performance',         order: 44, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tp-dw-chemical',         label: 'DW Chemical Management',         order: 45, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tp-dw-filter',           label: 'DW Filter Management',           order: 46, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tp-ww-process-flow',     label: 'WW Process Flow Diagram',        order: 47, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tp-ww-performance',      label: 'WW Process Performance',         order: 48, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tp-ww-solids',           label: 'WW Solids Management',           order: 49, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tp-ww-chemical',         label: 'WW Chemical Management',         order: 50, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tp-energy',              label: 'Energy Management',               order: 51, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'tp-optimization',        label: 'Process Optimization',            order: 52, visible: true, defaultExpanded: false, lensControlled: true },
    // ── Infrastructure (View 11) ──
    { id: 'infra-system-map',       label: 'System Overview Map',             order: 53, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-plant',            label: 'Treatment Plant Infrastructure', order: 54, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-distribution',     label: 'Distribution / Collection',      order: 55, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-pump-stations',    label: 'Pump Stations',                   order: 56, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'infra-storage',          label: 'Storage',                          order: 57, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Laboratory & Sampling (View 12 — utility-exclusive) ──
    { id: 'lab-tracking',           label: 'Sample Tracking',                 order: 58, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'lab-results',            label: 'Results Management',              order: 59, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'lab-qaqc',               label: 'QA/QC Program',                   order: 60, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'lab-regulatory',         label: 'Regulatory Monitoring Compliance',order: 61, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'lab-management',         label: 'Lab Management',                  order: 62, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'lab-aqualo',             label: 'Aqua-Lo LIMS Dashboard',          order: 63, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Disaster & Emergency (View 13) ──
    { id: 'disaster-active',        label: 'Active Emergencies',              order: 64, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-response',      label: 'Emergency Response Operations',  order: 65, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-vulnerability', label: 'Vulnerability Assessment',       order: 66, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-recovery',      label: 'Event Recovery',                  order: 67, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'disaster-resilience',    label: 'Climate Resilience',              order: 68, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Permit Limits & Compliance (View 14 — utility-exclusive) ──
    { id: 'pl-effluent-limits',     label: 'Effluent Limits Table',           order: 69, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'pl-dw-standards',        label: 'Drinking Water Standards',        order: 70, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'pl-special-conditions',  label: 'Special Conditions',              order: 71, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'pl-renewal',             label: 'Permit Renewal Preparation',      order: 72, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'pl-derivation',          label: 'Limit Derivation Understanding', order: 73, visible: true, defaultExpanded: false, lensControlled: true },
    // ── Scorecard (View 15) ──
    { id: 'sc-regulatory',          label: 'Regulatory Compliance Score',     order: 74, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-operational',         label: 'Operational Performance Score',   order: 75, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-infrastructure',      label: 'Infrastructure Health Score',     order: 76, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-financial',           label: 'Financial Health Score',           order: 77, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-customer',            label: 'Customer Service Score',           order: 78, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'sc-benchmarking',        label: 'Peer Benchmarking',               order: 79, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Reports (View 16) ──
    { id: 'rpt-dmr',                label: 'DMR Generation',                  order: 80, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rpt-ccr',                label: 'Consumer Confidence Report',      order: 81, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rpt-operational',        label: 'Operational Reports',             order: 82, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rpt-regulatory',         label: 'Regulatory Reports',              order: 83, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'rpt-financial',          label: 'Financial Reports',               order: 84, visible: true, defaultExpanded: true,  lensControlled: true },
    // ── Asset Management (View 17 — utility-exclusive) ──
    { id: 'am-inventory',           label: 'Asset Inventory',                 order: 85, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'am-condition',           label: 'Condition Assessment',            order: 86, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'am-maintenance',         label: 'Maintenance Management',          order: 87, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'am-risk',                label: 'Risk-Based Prioritization',       order: 88, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'am-capital',             label: 'Capital Planning',                order: 89, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'am-lifecycle',           label: 'Lifecycle Cost Analysis',          order: 90, visible: true, defaultExpanded: false, lensControlled: true },
    // ── Funding & Grants (View 18) ──
    { id: 'fund-srf',               label: 'SRF Loan Portfolio',              order: 91, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-federal',           label: 'Federal Funding Programs',        order: 92, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-revenue',           label: 'Revenue & Rate Planning',         order: 93, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-debt',              label: 'Debt Management',                 order: 94, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'fund-capital-strategy',  label: 'Capital Funding Strategy',        order: 95, visible: true, defaultExpanded: true,  lensControlled: true },
    { id: 'location-report',       label: 'Location Water Quality Report',  order: 96, visible: true, defaultExpanded: false, lensControlled: true },
    { id: 'disclaimer',            label: 'Platform Disclaimer',            order: 97, visible: true, defaultExpanded: true,  lensControlled: true },
  ],

  Infrastructure: [
    { id: 'projects',       label: 'Capital Project Tracker',       order: 0,  visible: true, defaultExpanded: true },
    { id: 'greeninfra',     label: 'Green Infrastructure Map',      order: 1,  visible: true, defaultExpanded: true },
    { id: 'capacity',       label: 'Stormwater Capacity Analysis',  order: 2,  visible: true, defaultExpanded: true },
    { id: 'funding',        label: 'Funding Pipeline',              order: 3,  visible: true, defaultExpanded: true },
    { id: 'lifecycle',      label: 'Asset Lifecycle',               order: 4,  visible: true, defaultExpanded: true },
    { id: 'resilience',     label: 'Climate Resilience',            order: 5,  visible: true, defaultExpanded: false },
    { id: 'reporting',      label: 'Infrastructure Reporting',      order: 6,  visible: true, defaultExpanded: false },
    { id: 'location-report', label: 'Location Water Quality Report', order: 7, visible: true, defaultExpanded: false },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 8,  visible: true, defaultExpanded: true },
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
    { id: 'location-report', label: 'Location Water Quality Report', order: 8, visible: true, defaultExpanded: false },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 9,  visible: true, defaultExpanded: true },
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
    { id: 'location-report', label: 'Location Water Quality Report', order: 8, visible: true, defaultExpanded: false },
    { id: 'disclaimer',     label: 'Platform Disclaimer',           order: 9,  visible: true, defaultExpanded: true },
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
    { id: 'wq-overview',     label: 'State WQ Overview',             order: 8,  visible: true, defaultExpanded: true },
    { id: 'impairment-map',  label: 'Impairment Map',               order: 9,  visible: true, defaultExpanded: true, compound: true },
    { id: 'monitoring-gaps', label: 'Monitoring Gaps',               order: 10, visible: true, defaultExpanded: true },
    { id: 'param-trends',    label: 'Parameter Trends',              order: 11, visible: true, defaultExpanded: true },
    { id: 'my-clients',      label: 'My Clients',                    order: 12, visible: true, defaultExpanded: true },
    { id: 'location-report', label: 'Location Water Quality Report', order: 13, visible: true, defaultExpanded: false },
    { id: 'disclaimer',      label: 'Platform Disclaimer',           order: 14, visible: true, defaultExpanded: true },
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
