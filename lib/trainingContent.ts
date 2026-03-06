// lib/trainingContent.ts
// Role-specific training / onboarding content for the Deployment Training lens.

export interface GettingStartedStep {
  id: string;
  title: string;
  description: string;
}

export interface LensGuide {
  summary: string;
  keyFeatures: string[];
}

export interface TrainingTip {
  title: string;
  body: string;
}

export interface RoleTrainingData {
  roleLabel: string;
  welcome: string;
  overview: string;
  gettingStarted: GettingStartedStep[];
  lensGuides: Record<string, LensGuide>;
  tips: TrainingTip[];
}

export const ROLE_TRAINING: Record<string, RoleTrainingData> = {
  // ── Federal ─────────────────────────────────────────────────────────────────
  '/dashboard/federal': {
    roleLabel: 'Federal Water Quality Manager',
    welcome: 'Welcome to the Federal Water Quality Dashboard — your national command center for environmental oversight.',
    overview:
      'This dashboard aggregates real-time data from EPA, USGS, ATTAINS, SDWIS, and ICIS to give you a comprehensive view of water quality across all 50 states. Use lenses to focus on specific domains like compliance, infrastructure, or monitoring gaps.',
    gettingStarted: [
      { id: 'nav', title: 'Navigate lenses', description: 'Use the sidebar to switch between Overview, Compliance, Water Quality, and other focused views.' },
      { id: 'map', title: 'Explore the national map', description: 'Click states on the map to drill into regional data. Use overlays to visualize hotspots, EJ areas, and coverage gaps.' },
      { id: 'briefing', title: 'Read your AI Briefing', description: 'The AI Briefing lens summarizes overnight changes, new violations, and trending issues across all data sources.' },
      { id: 'scorecard', title: 'Review the Scorecard', description: 'The Scorecard grades each state on compliance, monitoring, and water quality — ideal for congressional briefings.' },
      { id: 'export', title: 'Generate reports', description: 'Use the Reports lens to export data in formats suitable for interagency memos and public communications.' },
    ],
    lensGuides: {
      overview: { summary: 'National situation map with overnight changes and stakeholder activity.', keyFeatures: ['Interactive US map with state-level drill-down', 'Overnight change indicators', 'Constituent concern tracking'] },
      briefing: { summary: 'AI-generated summary of all federal data sources.', keyFeatures: ['Daily narrative synthesis', 'Action-required items', 'Cross-source correlation'] },
      'political-briefing': { summary: 'Talking points, funding optics, EJ exposure, and agenda suggestions.', keyFeatures: ['Ready-made talking points', 'Funding wins & risks', 'Media-ready grades'] },
      compliance: { summary: 'NPDES enforcement and drinking water violations.', keyFeatures: ['Active violations tracker', 'Enforcement pipeline', 'Priority intervention queue'] },
      'water-quality': { summary: 'ATTAINS assessments, impaired waterbodies, and WQP trends.', keyFeatures: ['Domain tabs (surface, ground, drinking, coastal)', 'Impairment profiles', 'State-by-state summary'] },
      monitoring: { summary: 'Coverage gaps, network health, and data freshness.', keyFeatures: ['SLA compliance tracking', 'Sentinel monitoring alerts', 'Data latency dashboard'] },
      scorecard: { summary: 'Graded performance metrics across all states.', keyFeatures: ['KPI scorecards', 'Choropleth rankings', 'Trend analysis'] },
    },
    tips: [
      { title: 'Start with the Briefing', body: 'The AI Briefing gives you a 2-minute overview of what changed overnight — perfect for morning stand-ups.' },
      { title: 'Use overlays strategically', body: 'Layer EJ, hotspot, and coverage overlays on the map to identify intersecting risk zones.' },
      { title: 'Export for stakeholders', body: 'The Reports lens formats data for congressional inquiries, interagency memos, and public comment responses.' },
    ],
  },

  // ── State ───────────────────────────────────────────────────────────────────
  '/dashboard/state': {
    roleLabel: 'State Environmental Agency',
    welcome: 'Welcome to the State Water Quality Dashboard — your statewide environmental intelligence hub.',
    overview:
      'Monitor water quality, compliance, and infrastructure across your state using data from EPA, USGS, ATTAINS, and state-specific sources. Each lens focuses on a specific regulatory or operational domain.',
    gettingStarted: [
      { id: 'state', title: 'Confirm your state', description: 'Your dashboard auto-loads data for your assigned state. Admins can switch states using the selector in the sidebar.' },
      { id: 'overview', title: 'Check the Overview', description: 'The Overview lens shows your operational health bar, quick-access grid, and statewide alert feed.' },
      { id: 'compliance', title: 'Review compliance', description: 'The Compliance lens combines NPDES enforcement, SDWIS violations, and permit status into one view.' },
      { id: 'tmdl', title: 'Track TMDLs', description: 'The TMDL & Restoration lens shows active restoration projects and impaired waterbody prioritization.' },
      { id: 'reports', title: 'Generate state reports', description: 'Export data in formats required for EPA reporting, public notices, and legislative briefings.' },
    ],
    lensGuides: {
      overview: { summary: 'Statewide operational health, quick-access grid, and alert feed.', keyFeatures: ['Operational health bar', 'Quick-access navigation', 'Real-time alert feed'] },
      compliance: { summary: 'NPDES, SDWIS, and enforcement tracking for your state.', keyFeatures: ['Active violation tracking', 'Enforcement pipeline', 'Permit compliance status'] },
      'water-quality': { summary: 'Waterbody assessments, impairment trends, and sampling data.', keyFeatures: ['Interactive waterbody map', 'Impairment cause analysis', 'Trend overlays'] },
      tmdl: { summary: 'TMDL development tracking and restoration project management.', keyFeatures: ['Active TMDL list', 'Restoration progress tracking', 'Priority waterbody ranking'] },
    },
    tips: [
      { title: 'Morning check-in routine', body: 'Start with AI Briefing for overnight changes, then check the alert feed for urgent items requiring action.' },
      { title: 'Drill into problem areas', body: 'Click any waterbody on the map to see its full assessment history, impairment causes, and nearby facilities.' },
      { title: 'Water Quality Trading', body: 'If your state participates in nutrient trading, the WQT lens provides credit tracking and market analysis.' },
    ],
  },

  // ── Local Government ────────────────────────────────────────────────────────
  '/dashboard/local': {
    roleLabel: 'Local Government Water Manager',
    welcome: 'Welcome to the Local Government Dashboard — focused tools for municipal water quality management.',
    overview:
      'Track water quality, stormwater compliance, infrastructure needs, and environmental justice in your jurisdiction. This dashboard connects federal and state data with local priorities.',
    gettingStarted: [
      { id: 'overview', title: 'Review your Overview', description: 'See your jurisdiction\'s water health dashboard, alert feed, and waterbody summary at a glance.' },
      { id: 'stormwater', title: 'Check Stormwater/MS4', description: 'Monitor stormwater permit compliance, BMP effectiveness, and CSO events.' },
      { id: 'ej', title: 'Review EJ & Equity', description: 'Understand environmental justice indicators and vulnerable community exposure in your area.' },
      { id: 'funding', title: 'Find funding', description: 'The Funding & Grants lens matches your projects with eligible federal and state grant programs.' },
    ],
    lensGuides: {
      overview: { summary: 'Local water health dashboard with jurisdiction-level data.', keyFeatures: ['Waterbody health summary', 'Local alert feed', 'Quick navigation'] },
      stormwater: { summary: 'Stormwater and MS4 permit compliance tracking.', keyFeatures: ['BMP status tracking', 'CSO event log', 'Permit requirement checklist'] },
      'ej-equity': { summary: 'Environmental justice screening and equity analysis.', keyFeatures: ['EJ index mapping', 'Vulnerable community identification', 'Exposure analysis'] },
    },
    tips: [
      { title: 'Council meeting prep', body: 'Use the Political Briefing lens for ready-made talking points, constituent concerns, and agenda suggestions.' },
      { title: 'Grant readiness', body: 'The Funding lens pre-matches your water quality challenges with active grant opportunities — keep it bookmarked.' },
    ],
  },

  // ── MS4 / Municipal Stormwater ──────────────────────────────────────────────
  '/dashboard/ms4': {
    roleLabel: 'MS4 Stormwater Program Manager',
    welcome: 'Welcome to the MS4 Stormwater Dashboard — your compliance and BMP management command center.',
    overview:
      'Manage your MS4 permit, track BMP effectiveness, monitor receiving waters, and stay ahead of TMDL compliance deadlines — all from one dashboard.',
    gettingStarted: [
      { id: 'overview', title: 'Check your Overview', description: 'See permit status, BMP health, and receiving water conditions at a glance.' },
      { id: 'bmps', title: 'Manage Stormwater BMPs', description: 'Track installation, maintenance, and performance of all best management practices.' },
      { id: 'receiving', title: 'Monitor receiving waters', description: 'View real-time and trend data for waterbodies that receive your stormwater discharge.' },
      { id: 'mcm', title: 'Use the MCM Manager', description: 'Track Minimum Control Measures for permit compliance documentation.' },
      { id: 'tmdl', title: 'Review TMDL compliance', description: 'Monitor your progress toward TMDL wasteload allocations and reduction targets.' },
    ],
    lensGuides: {
      'stormwater-bmps': { summary: 'BMP inventory, maintenance tracking, and performance metrics.', keyFeatures: ['BMP installation tracker', 'Maintenance scheduling', 'Performance reporting'] },
      'receiving-waters': { summary: 'Real-time monitoring of receiving waterbody conditions.', keyFeatures: ['Water quality trends', 'Exceedance alerts', 'Upstream/downstream comparison'] },
      'mcm-manager': { summary: 'Minimum Control Measure tracking for permit compliance.', keyFeatures: ['MCM checklist', 'Documentation tracker', 'Annual report builder'] },
    },
    tips: [
      { title: 'Annual report preparation', body: 'The MCM Manager lens compiles documentation needed for your annual MS4 permit report.' },
      { title: 'Proactive monitoring', body: 'Set up alerts in the Monitoring lens to catch water quality changes before they become permit violations.' },
      { title: 'TMDL tracking', body: 'The TMDL Compliance lens shows your current load reduction status against your wasteload allocation.' },
    ],
  },

  // ── Municipal Utility ───────────────────────────────────────────────────────
  '/dashboard/utility': {
    roleLabel: 'Municipal Utility Operator',
    welcome: 'Welcome to the Municipal Utility Dashboard — operational intelligence for water and wastewater systems.',
    overview:
      'Monitor treatment processes, permit limits, asset health, and compliance across your utility\'s operations. Integrates SDWIS, ICIS, and real-time monitoring data.',
    gettingStarted: [
      { id: 'overview', title: 'Review your Overview', description: 'See system health, active alerts, and key performance metrics at a glance.' },
      { id: 'treatment', title: 'Monitor treatment processes', description: 'The Treatment & Process lens tracks real-time performance across treatment trains.' },
      { id: 'permit', title: 'Check permit limits', description: 'The Permit Limits lens shows current effluent values against permit thresholds with exceedance alerts.' },
      { id: 'assets', title: 'Manage assets', description: 'Track equipment condition, maintenance schedules, and capital planning in Asset Management.' },
    ],
    lensGuides: {
      'treatment-process': { summary: 'Real-time treatment train performance monitoring.', keyFeatures: ['Process parameter tracking', 'Treatment efficiency metrics', 'Upset condition alerts'] },
      'permit-limits': { summary: 'Effluent limits and compliance status.', keyFeatures: ['Limit vs. actual comparison', 'Exceedance history', 'DMR preparation'] },
      'asset-management': { summary: 'Equipment condition assessment and maintenance planning.', keyFeatures: ['Asset inventory', 'Condition scoring', 'Capital improvement planning'] },
    },
    tips: [
      { title: 'Daily operations check', body: 'Start with Overview for system health, then check Treatment & Process for any operational anomalies.' },
      { title: 'Permit compliance', body: 'The Permit Limits lens highlights parameters approaching limits — address them before they become violations.' },
    ],
  },

  // ── Site Intelligence (Infrastructure) ──────────────────────────────────────
  '/dashboard/infrastructure': {
    roleLabel: 'Site Intelligence Professional',
    welcome: 'Welcome to Site Intelligence — environmental due diligence at your fingertips.',
    overview:
      'Search any US address to get a comprehensive environmental risk profile including water quality, contamination history, regulatory exposure, and EJ screening. Switch lenses to view data through the lens of your profession.',
    gettingStarted: [
      { id: 'search', title: 'Search an address', description: 'Enter any US address in the search bar to pull environmental data from 10+ federal databases.' },
      { id: 'lens', title: 'Select your professional lens', description: 'Switch between Developer, Lender, Legal, Consultant, and other professional lenses to see role-relevant analysis.' },
      { id: 'score', title: 'Review the risk score', description: 'The composite risk score combines water quality, contamination, regulatory, and EJ factors into a single assessment.' },
      { id: 'report', title: 'Export your findings', description: 'Generate a site intelligence report for your records or client deliverables.' },
    ],
    lensGuides: {
      developer: { summary: 'Site water risk and development regulatory analysis.', keyFeatures: ['Stormwater permit requirements', 'Wetland proximity', 'Development constraints'] },
      lender: { summary: 'Collateral risk profile and regulatory encumbrances.', keyFeatures: ['Environmental lien search', 'Compliance status', 'Risk-adjusted valuation'] },
      legal: { summary: 'Litigation risk profile and regulatory history.', keyFeatures: ['Violation history', 'Enforcement actions', 'Liability assessment'] },
    },
    tips: [
      { title: 'Start with Overview', body: 'The Overview lens gives you a balanced risk profile before you drill into any specific professional perspective.' },
      { title: 'Compare multiple sites', body: 'Open multiple browser tabs to compare environmental profiles for different addresses side by side.' },
    ],
  },

  // ── Corporate ESG / Sustainability ──────────────────────────────────────────
  '/dashboard/esg': {
    roleLabel: 'ESG & Sustainability Director',
    welcome: 'Welcome to the ESG & Sustainability Dashboard — water stewardship metrics for corporate leadership.',
    overview:
      'Track your organization\'s water footprint, regulatory compliance, supply chain risk, and ESG disclosure readiness. Designed for sustainability officers and corporate reporting teams.',
    gettingStarted: [
      { id: 'overview', title: 'Review Executive Overview', description: 'See portfolio-level water risk, compliance status, and ESG score at a glance.' },
      { id: 'esg', title: 'Check ESG Reporting', description: 'The ESG Reporting lens aligns your water data with GRI, SASB, CDP, and TCFD frameworks.' },
      { id: 'facility', title: 'Monitor facilities', description: 'Track water use, discharge, and compliance at each facility location.' },
      { id: 'supply', title: 'Assess supply chain', description: 'The Supply Chain lens identifies water-related risks across your supplier network.' },
    ],
    lensGuides: {
      'esg-reporting': { summary: 'Framework-aligned ESG disclosure preparation.', keyFeatures: ['GRI/SASB/CDP alignment', 'Disclosure gap analysis', 'Metric tracking'] },
      'facility-operations': { summary: 'Site-level water use and compliance monitoring.', keyFeatures: ['Water balance tracking', 'Discharge monitoring', 'Compliance status'] },
      'supply-chain': { summary: 'Water risk assessment across your supplier network.', keyFeatures: ['Supplier risk scoring', 'Geographic water stress', 'Engagement tracking'] },
    },
    tips: [
      { title: 'Board reporting', body: 'The Executive Overview aggregates key metrics into a format suitable for board-level sustainability presentations.' },
      { title: 'Disclosure preparation', body: 'Use the ESG Reporting lens to identify gaps in your current disclosures and generate framework-ready data.' },
    ],
  },

  // ── Biotech / Pharma ────────────────────────────────────────────────────────
  '/dashboard/biotech': {
    roleLabel: 'Biotech & Pharma Environmental Manager',
    welcome: 'Welcome to the Biotech/Pharma Dashboard — process water quality and regulatory compliance for life sciences.',
    overview:
      'Monitor process water quality, discharge compliance, pharmaceutical contaminant tracking, and GMP quality systems. Designed for environmental health and safety teams in biotech and pharmaceutical operations.',
    gettingStarted: [
      { id: 'overview', title: 'Review Executive Overview', description: 'See facility-level compliance status, process water quality, and alert summary.' },
      { id: 'process', title: 'Monitor process water', description: 'Track water quality parameters critical to your manufacturing processes.' },
      { id: 'discharge', title: 'Check discharge & effluent', description: 'Monitor discharge parameters against permit limits and pretreatment standards.' },
      { id: 'gmp', title: 'Review GMP & Quality', description: 'The GMP lens tracks water system qualification, validation status, and quality events.' },
    ],
    lensGuides: {
      'process-water': { summary: 'Process water quality monitoring for manufacturing.', keyFeatures: ['Parameter trending', 'Specification compliance', 'Alert thresholds'] },
      'discharge-effluent': { summary: 'Discharge monitoring and permit compliance.', keyFeatures: ['Effluent parameter tracking', 'Permit limit comparison', 'Pretreatment compliance'] },
      'gmp-quality': { summary: 'GMP water system qualification and quality management.', keyFeatures: ['Validation status', 'Quality event tracking', 'Corrective action log'] },
    },
    tips: [
      { title: 'Audit preparation', body: 'The GMP & Quality lens compiles water system documentation needed for FDA and EMA inspections.' },
      { title: 'Contaminant tracking', body: 'Use the Pharma Contaminants lens to monitor emerging contaminants of concern to your industry.' },
    ],
  },

  // ── Investor / Financial ────────────────────────────────────────────────────
  '/dashboard/investor': {
    roleLabel: 'Investor & Financial Analyst',
    welcome: 'Welcome to the Investor Dashboard — water risk intelligence for financial decision-making.',
    overview:
      'Assess portfolio water risk, ESG disclosure readiness, climate resilience, and due diligence factors. Designed for institutional investors, portfolio managers, and financial analysts.',
    gettingStarted: [
      { id: 'overview', title: 'Review Executive Overview', description: 'See portfolio-level water risk exposure, ESG scores, and market trends.' },
      { id: 'portfolio', title: 'Assess portfolio risk', description: 'The Portfolio Risk lens maps water-related financial exposure across holdings.' },
      { id: 'stress', title: 'Check water stress', description: 'Evaluate geographic water stress factors affecting your investment locations.' },
      { id: 'diligence', title: 'Run due diligence', description: 'The Due Diligence lens provides comprehensive environmental screening for new investments.' },
    ],
    lensGuides: {
      'portfolio-risk': { summary: 'Portfolio-level water risk exposure analysis.', keyFeatures: ['Risk heat map', 'Sector comparison', 'Concentration analysis'] },
      'water-stress': { summary: 'Geographic water stress assessment.', keyFeatures: ['Water stress index', 'Supply/demand projections', 'Regulatory risk overlay'] },
      'due-diligence': { summary: 'Environmental due diligence screening.', keyFeatures: ['Multi-source data pull', 'Risk flag summary', 'Comparable analysis'] },
    },
    tips: [
      { title: 'Portfolio screening', body: 'Start with Portfolio Risk for a heat map of water-related exposure, then drill into high-risk holdings.' },
      { title: 'ESG alignment', body: 'The ESG Disclosure lens helps assess whether portfolio companies meet water-related disclosure standards.' },
    ],
  },

  // ── University / Research ───────────────────────────────────────────────────
  '/dashboard/university': {
    roleLabel: 'University Researcher & Campus Manager',
    welcome: 'Welcome to the University Dashboard — research data, campus operations, and watershed partnerships.',
    overview:
      'Access water quality monitoring data, manage campus stormwater, collaborate on watershed partnerships, and find research funding. Built for both researchers and campus sustainability offices.',
    gettingStarted: [
      { id: 'overview', title: 'Check the Overview', description: 'See campus water metrics, active research projects, and partnership status.' },
      { id: 'research', title: 'Explore research data', description: 'The Research & Monitoring lens provides access to regional water quality datasets and trend analysis.' },
      { id: 'campus', title: 'Monitor campus stormwater', description: 'Track BMP performance, green infrastructure, and campus discharge data.' },
      { id: 'grants', title: 'Find grants', description: 'The Grants & Publications lens matches your research focus with active funding opportunities.' },
    ],
    lensGuides: {
      'research-monitoring': { summary: 'Regional water quality datasets and monitoring tools.', keyFeatures: ['Multi-source data access', 'Statistical analysis tools', 'Data export for publications'] },
      'campus-stormwater': { summary: 'Campus stormwater BMP tracking and green infrastructure.', keyFeatures: ['BMP inventory', 'Performance metrics', 'Regulatory compliance'] },
      'watershed-partnerships': { summary: 'Collaborative watershed research and monitoring.', keyFeatures: ['Partner network map', 'Shared data repositories', 'Joint project tracking'] },
    },
    tips: [
      { title: 'Research data export', body: 'Use the Research & Monitoring lens to export water quality datasets in CSV and GeoJSON formats for academic analysis.' },
      { title: 'Student involvement', body: 'The Monitoring lens supports student-led data collection projects — great for field courses and capstone work.' },
    ],
  },

  // ── NGO / Conservation ──────────────────────────────────────────────────────
  '/dashboard/ngo': {
    roleLabel: 'NGO & Conservation Advocate',
    welcome: 'Welcome to the NGO Dashboard — watershed health, advocacy tools, and community engagement.',
    overview:
      'Monitor watershed health, track restoration projects, coordinate volunteers, and build evidence-based advocacy campaigns. Designed for conservation organizations and watershed groups.',
    gettingStarted: [
      { id: 'overview', title: 'Check the Overview', description: 'See watershed health summary, active restoration projects, and volunteer engagement metrics.' },
      { id: 'watershed', title: 'Assess watershed health', description: 'The Watershed Health lens provides ecological indicators, impairment data, and trend analysis.' },
      { id: 'restoration', title: 'Track restoration', description: 'Monitor active restoration projects, milestones, and measurable outcomes.' },
      { id: 'advocacy', title: 'Build your case', description: 'The Advocacy lens compiles data into evidence packages for public comment, media, and policy engagement.' },
      { id: 'volunteer', title: 'Coordinate volunteers', description: 'The Volunteer Program lens helps organize citizen monitoring events and field activities.' },
    ],
    lensGuides: {
      'watershed-health': { summary: 'Ecological health indicators and watershed assessment.', keyFeatures: ['Watershed report cards', 'Impairment cause analysis', 'Trend tracking'] },
      'restoration-projects': { summary: 'Restoration project tracking and outcome measurement.', keyFeatures: ['Project milestone tracking', 'Before/after metrics', 'Success story builder'] },
      advocacy: { summary: 'Evidence-based advocacy tools and data packaging.', keyFeatures: ['Data visualization for media', 'Public comment templates', 'Policy impact analysis'] },
    },
    tips: [
      { title: 'Citizen science', body: 'Use the Citizen Reporting lens to integrate community-submitted water quality observations with official monitoring data.' },
      { title: 'Grant applications', body: 'The Funding lens provides pre-matched grant opportunities — pair with Watershed Health data for compelling applications.' },
    ],
  },

  // ── K-12 Education ──────────────────────────────────────────────────────────
  '/dashboard/k12': {
    roleLabel: 'K-12 Educator',
    welcome: 'Welcome to the K-12 Water Quality Dashboard — bring real environmental data into your classroom.',
    overview:
      'Access age-appropriate water quality data, outdoor classroom activities, student monitoring tools, and STEM project ideas. Designed for teachers and environmental education coordinators.',
    gettingStarted: [
      { id: 'overview', title: 'Explore the Overview', description: 'See your local water health, wildlife impacts, and student-friendly data visualizations.' },
      { id: 'outdoor', title: 'Plan outdoor activities', description: 'The Outdoor Classroom lens provides field-ready lesson plans tied to nearby waterbodies.' },
      { id: 'monitoring', title: 'Set up student monitoring', description: 'Equip students with data collection tools and guided protocols for water testing.' },
      { id: 'uploads', title: 'Submit student data', description: 'Students can upload their field observations and water quality measurements.' },
      { id: 'debate', title: 'Explore debate topics', description: 'The Debate Topics lens frames real water issues as structured classroom debates.' },
    ],
    lensGuides: {
      'outdoor-classroom': { summary: 'Field-ready lesson plans tied to local waterbodies.', keyFeatures: ['Location-based activities', 'Standards alignment', 'Safety guidelines'] },
      'student-monitoring': { summary: 'Guided water quality testing protocols for students.', keyFeatures: ['Step-by-step protocols', 'Data entry forms', 'Results comparison'] },
      'student-uploads': { summary: 'Student field data submission and portfolio.', keyFeatures: ['Photo and data upload', 'Peer review system', 'Portfolio builder'] },
      debate: { summary: 'Structured debate topics using real water quality data.', keyFeatures: ['Pro/con evidence packs', 'Discussion guides', 'Cross-curricular connections'] },
    },
    tips: [
      { title: 'Start with your watershed', body: 'The Overview shows water quality data for your school\'s watershed — use it as a hook for place-based learning.' },
      { title: 'STEM integration', body: 'Combine Student Monitoring data collection with math (statistics), science (chemistry), and social studies (policy) standards.' },
      { title: 'Drinking water focus', body: 'The Drinking Water Safety lens uses SDWIS data to explore lead testing, treatment, and compliance at local schools.' },
    ],
  },

  // ── PEARL Admin ─────────────────────────────────────────────────────────────
  '/dashboard/pearl': {
    roleLabel: 'PEARL Administrator',
    welcome: 'Welcome to PEARL Administration — deployment operations, business intelligence, and system management.',
    overview:
      'Manage PEARL deployments, track prospect pipelines, run scenario planning, and monitor system health. This is the operational command center for PEARL network administration.',
    gettingStarted: [
      { id: 'ops', title: 'Check Operations', description: 'The Operations lens shows deployment health, sensor readings, and maintenance schedules across all units.' },
      { id: 'proposals', title: 'Review proposals', description: 'Track prospect pipeline, generate proposals, and manage the sales funnel.' },
      { id: 'scenarios', title: 'Run What-If scenarios', description: 'Model deployment scenarios, treatment capacity, and financial projections.' },
      { id: 'users', title: 'Manage users', description: 'Approve pending users, manage roles, and configure access permissions.' },
    ],
    lensGuides: {
      operations: { summary: 'Deployment health and sensor monitoring across all PEARL units.', keyFeatures: ['Real-time sensor dashboard', 'Maintenance scheduling', 'Performance metrics'] },
      proposals: { summary: 'Prospect pipeline and proposal generation.', keyFeatures: ['Pipeline management', 'Auto-proposal builder', 'Contract tracking'] },
      'scenario-planner': { summary: 'Deployment scenario modeling and capacity planning.', keyFeatures: ['What-if analysis', 'Coverage optimization', 'ROI projections'] },
    },
    tips: [
      { title: 'Morning ops check', body: 'Start with Operations to see any overnight alerts, sensor anomalies, or maintenance-due units.' },
      { title: 'Pipeline management', body: 'The Proposals lens tracks prospects from initial lead through closed contract — keep it updated for accurate forecasting.' },
    ],
  },

  // ── Admin (same content as PEARL) ───────────────────────────────────────────
  '/dashboard/admin': {
    roleLabel: 'PEARL Administrator',
    welcome: 'Welcome to PEARL Administration — deployment operations, business intelligence, and system management.',
    overview:
      'Manage PEARL deployments, track prospect pipelines, run scenario planning, and monitor system health. This is the operational command center for PEARL network administration.',
    gettingStarted: [
      { id: 'ops', title: 'Check Operations', description: 'The Operations lens shows deployment health, sensor readings, and maintenance schedules across all units.' },
      { id: 'proposals', title: 'Review proposals', description: 'Track prospect pipeline, generate proposals, and manage the sales funnel.' },
      { id: 'scenarios', title: 'Run What-If scenarios', description: 'Model deployment scenarios, treatment capacity, and financial projections.' },
      { id: 'users', title: 'Manage users', description: 'Approve pending users, manage roles, and configure access permissions.' },
    ],
    lensGuides: {
      operations: { summary: 'Deployment health and sensor monitoring across all PEARL units.', keyFeatures: ['Real-time sensor dashboard', 'Maintenance scheduling', 'Performance metrics'] },
      proposals: { summary: 'Prospect pipeline and proposal generation.', keyFeatures: ['Pipeline management', 'Auto-proposal builder', 'Contract tracking'] },
      'scenario-planner': { summary: 'Deployment scenario modeling and capacity planning.', keyFeatures: ['What-if analysis', 'Coverage optimization', 'ROI projections'] },
    },
    tips: [
      { title: 'Morning ops check', body: 'Start with Operations to see any overnight alerts, sensor anomalies, or maintenance-due units.' },
      { title: 'Pipeline management', body: 'The Proposals lens tracks prospects from initial lead through closed contract — keep it updated for accurate forecasting.' },
    ],
  },

  // ── Site Intelligence Detail ────────────────────────────────────────────────
  '/dashboard/site-intelligence': {
    roleLabel: 'Site Intelligence Analyst',
    welcome: 'Welcome to Site Intelligence — detailed environmental profiling for any US location.',
    overview:
      'Get comprehensive environmental, species, contamination, and regulatory data for a specific address or coordinate. Each lens provides a different analytical perspective on the site.',
    gettingStarted: [
      { id: 'overview', title: 'Review the Overview', description: 'See the integrated site profile with risk scores across all environmental categories.' },
      { id: 'environment', title: 'Check Environmental Profile', description: 'Review water quality, soil conditions, and natural features surrounding the site.' },
      { id: 'contamination', title: 'Assess contamination', description: 'The Contamination lens pulls from CERCLIS, TRI, RCRA, and brownfield databases.' },
      { id: 'regulatory', title: 'Review regulatory context', description: 'Understand zoning, permits, and regulatory overlays that affect the site.' },
    ],
    lensGuides: {
      environment: { summary: 'Environmental profile including water, soil, and natural features.', keyFeatures: ['Watershed context', 'Flood zone mapping', 'Water quality data'] },
      contamination: { summary: 'Contamination history from federal databases.', keyFeatures: ['CERCLIS/Superfund search', 'TRI releases', 'Brownfield records'] },
      risk: { summary: 'Aggregated risk summary with composite scoring.', keyFeatures: ['Multi-factor risk score', 'Category breakdown', 'Peer comparison'] },
    },
    tips: [
      { title: 'Phase I ESA support', body: 'The Environmental Profile and Contamination lenses provide data typically gathered during Phase I Environmental Site Assessments.' },
      { title: 'Risk communication', body: 'The Risk Summary lens produces client-ready risk visualizations with supporting data citations.' },
    ],
  },

  // ── Aqua-LO Laboratory ─────────────────────────────────────────────────────
  '/dashboard/aqua-lo': {
    roleLabel: 'Aqua-LO Laboratory Manager',
    welcome: 'Welcome to Aqua-LO — laboratory data management and quality assurance for water quality analysis.',
    overview:
      'Submit analytical results to PIN, manage QA/QC validation workflows, review audit trails, and generate laboratory reports. Designed for environmental laboratories contributing data to the PEARL Intelligence Network.',
    gettingStarted: [
      { id: 'overview', title: 'Check the Overview', description: 'See submission statistics, validation queue status, and QA/QC pass rates.' },
      { id: 'push', title: 'Submit data', description: 'Upload analytical results in batch format for validation and publication to PIN.' },
      { id: 'qaqc', title: 'Review QA/QC', description: 'Manage the validation queue, review flagged results, and approve or reject batches.' },
      { id: 'audit', title: 'Check the Audit Trail', description: 'Full traceability log of all submissions, validations, overrides, and publications.' },
    ],
    lensGuides: {
      push: { summary: 'Batch data submission to PIN.', keyFeatures: ['Drag-and-drop upload', 'Format validation', 'Chain of custody tracking'] },
      qaqc: { summary: 'Quality assurance and validation workflows.', keyFeatures: ['Validation queue', 'Flag review', 'Method compliance checks'] },
      audit: { summary: 'Complete audit trail for regulatory compliance.', keyFeatures: ['Timestamped actions', 'User attribution', 'Override documentation'] },
    },
    tips: [
      { title: 'Batch preparation', body: 'Ensure hold times, chain of custody, and method blanks are documented before submission to avoid QA/QC rejections.' },
      { title: 'Audit readiness', body: 'The Audit Trail lens provides the documentation trail needed for laboratory accreditation inspections.' },
    ],
  },
};
