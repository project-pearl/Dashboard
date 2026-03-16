import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, TableCell, TableRow, Table,
  WidthType, ShadingType, PageBreak, TabStopPosition, TabStopType,
  convertInchesToTwip,
} from 'docx';
import { writeFileSync } from 'fs';
import { join } from 'path';

const BLUE = '1E40AF';
const TEAL = '0D9488';
const SLATE = '475569';
const LIGHT_GRAY = 'F1F5F9';
const WHITE = 'FFFFFF';

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: BLUE, font: 'Calibri' })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, size: 26, color: TEAL, font: 'Calibri' })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, color: SLATE, font: 'Calibri' })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 20, font: 'Calibri', ...opts })],
  });
}

function bullet(text, opts = {}) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 20, font: 'Calibri', ...opts })],
  });
}

function bulletBold(label, desc) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [
      new TextRun({ text: label + ' ', bold: true, size: 20, font: 'Calibri' }),
      new TextRun({ text: '- ' + desc, size: 20, font: 'Calibri' }),
    ],
  });
}

function subBullet(text) {
  return new Paragraph({
    bullet: { level: 1 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 18, font: 'Calibri', color: SLATE })],
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 80 }, children: [] });
}

function makeTableRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map(text => new TableCell({
      shading: isHeader ? { type: ShadingType.SOLID, color: BLUE, fill: BLUE } : undefined,
      children: [new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [new TextRun({
          text: String(text),
          size: 18,
          font: 'Calibri',
          bold: isHeader,
          color: isHeader ? WHITE : '1E293B',
        })],
      })],
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
    })),
  });
}

function makeTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      makeTableRow(headers, true),
      ...rows.map(r => makeTableRow(r)),
    ],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ─── BUILD DOCUMENT ───

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 20 },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(0.8),
          bottom: convertInchesToTwip(0.8),
          left: convertInchesToTwip(0.9),
          right: convertInchesToTwip(0.9),
        },
      },
    },
    children: [

      // ═══════════════════════════════════════════════════
      // TITLE PAGE
      // ═══════════════════════════════════════════════════
      emptyLine(), emptyLine(), emptyLine(), emptyLine(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'PEARL Intelligence Network', bold: true, size: 48, color: BLUE, font: 'Calibri' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: '(PIN)', bold: true, size: 36, color: TEAL, font: 'Calibri' })],
      }),
      emptyLine(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: 'Complete Technical & Product Handoff Document', size: 24, color: SLATE, font: 'Calibri' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: 'March 13, 2026', size: 22, color: SLATE, font: 'Calibri' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: 'Confidential - Local Seafood Projects Inc.', size: 20, italics: true, color: SLATE, font: 'Calibri' })],
      }),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 1: WHAT IS PIN?
      // ═══════════════════════════════════════════════════
      heading1('PART 1: WHAT IS PIN?'),

      heading2('1.1 Mission'),
      para('PEARL Intelligence Network (PIN) is a real-time environmental intelligence platform that aggregates data from 75+ federal agency APIs into a single dashboard, giving decision-makers at every level of government, industry, and education actionable water quality intelligence.'),
      para('PIN monitors 565,000+ EPA assessment units across 2,456 HUC-8 watersheds, processing 430 million+ federal datapoints to deliver automated alerts, AI-powered analysis, and role-specific decision support.'),

      heading2('1.2 The Problem PIN Solves'),
      para('Water quality data in the United States is fragmented across dozens of federal agencies (EPA, USGS, NOAA, CDC, FEMA, NASA, HHS), each with different APIs, data formats, update frequencies, and access methods. A federal water quality manager today must:'),
      bullet('Manually check 15+ agency websites for updates'),
      bullet('Cross-reference compliance data across EPA ECHO, ICIS, SDWIS, and ATTAINS'),
      bullet('Correlate environmental events (fires, floods, spills) with water quality impacts'),
      bullet('Generate reports that synthesize data from sources that don\'t talk to each other'),
      bullet('React to changes they may not even know about until weeks later'),
      emptyLine(),
      para('PIN eliminates this by doing the aggregation, correlation, alerting, and analysis automatically, 24/7, across every data source simultaneously.'),

      heading2('1.3 What PIN Can Do'),
      heading3('Real-Time Environmental Monitoring'),
      bullet('Continuously ingests data from 75+ federal APIs via 95 scheduled cron jobs'),
      bullet('Updates every 5 minutes for critical sources (streamflow, change detection, alerts)'),
      bullet('Every 30 minutes for weather, air quality, seismic, and precipitation'),
      bullet('Daily for compliance databases (EPA ECHO, ICIS, SDWIS, WQP, TRI)'),
      bullet('Weekly for heavy datasets (RCRA, SEMS, EJScreen, Census ACS)'),

      heading3('AI-Powered Intelligence'),
      bullet('Claude-powered Q&A: ask natural language questions about any water quality topic'),
      bullet('Automated briefing generation: pre-generated insights refreshed every 6 hours'),
      bullet('Resolution planning: AI diagnoses compliance issues and prescribes corrective actions'),
      bullet('Delta detection: only regenerates insights when underlying data actually changes'),

      heading3('PIN Sentinel Change Detection'),
      bullet('3-tier real-time change detection engine monitoring 15+ change sources'),
      bullet('Detects permit violations, toxic releases, disaster declarations, superfund changes'),
      bullet('Behavioral Event Detection (BED) algorithm classifies threat patterns'),
      bullet('Compound pattern recognition: correlates events across multiple agencies'),
      bullet('Automated alert dispatch with throttling and suppression rules'),

      heading3('15 Role-Based Management Centers'),
      bullet('Each role sees a completely different dashboard tailored to their decision-making needs'),
      bullet('259 analytical lenses across all roles'),
      bullet('Drag-to-reorder layout with per-user persistence'),
      bullet('Role-specific grant matching, compliance views, and reporting'),

      heading3('Military & National Security'),
      bullet('Commander Threat Briefs with immediate action items'),
      bullet('Installation risk scoring across fire, air quality, PFAS, flooding, cyber'),
      bullet('Burn pit monitoring with health advisory correlation'),
      bullet('Embassy air quality monitoring (State Department data)'),
      bullet('NTAS threat level integration'),

      heading3('Compliance & Regulatory Intelligence'),
      bullet('NPDES permit tracking (EPA ECHO/ICIS) with violation severity scoring'),
      bullet('Drinking water system monitoring (SDWIS) with health-based violation alerts'),
      bullet('PFAS contamination tracking across military and civilian sites'),
      bullet('Superfund and RCRA hazardous waste site monitoring'),
      bullet('Automated compliance scoring and state-by-state comparison'),

      heading3('Environmental Justice & Public Health'),
      bullet('EJScreen environmental justice index mapping at block-group level'),
      bullet('CDC mortality data correlated with water quality violations'),
      bullet('Hospital capacity and healthcare access near contamination sites'),
      bullet('Waterborne illness outbreak tracking with SDWIS violation correlation'),
      bullet('Social Vulnerability Index (SVI) integration'),

      heading3('Financial & Funding Intelligence'),
      bullet('Live Grants.gov opportunity matching by role and state'),
      bullet('SRF (State Revolving Fund) tracking'),
      bullet('USAspending.gov federal contract analysis'),
      bullet('Funding gap analysis and deadline tracking'),

      heading3('Predictive Capabilities'),
      bullet('7-day and 30-day water quality projections with confidence weighting'),
      bullet('Flood forecasting via NWS and USGS models'),
      bullet('HAB (harmful algal bloom) risk assessment'),
      bullet('Infrastructure failure probability scoring'),

      heading2('1.4 What PIN Cannot Do'),
      para('PIN is NOT:', { bold: true }),
      bullet('A regulatory agency - PIN has no enforcement authority'),
      bullet('A laboratory - PIN does not perform primary field sampling or analysis'),
      bullet('A certified data provider - scores, grades, and alerts are informational, not official EPA/state/federal determinations'),
      bullet('A substitute for professional environmental assessment or legal compliance review'),
      bullet('A guarantee of data accuracy, completeness, or timeliness'),
      bullet('A field inspection tool - PIN is an intelligence/analytics platform, not a mobile inspection workflow'),
      bullet('An offline-capable application - requires internet connectivity'),
      bullet('A SCADA/LIMS system (though AQUA-LO is a companion LIMS product)'),
      emptyLine(),
      para('All PIN data originates from federal agency APIs. PIN aggregates, correlates, and presents this data but does not generate primary measurements. Users should always verify critical decisions against primary agency data sources.'),

      heading2('1.5 The Product Family'),
      bulletBold('PIN', 'Intelligence dashboard (this product) - real-time monitoring, AI analysis, role-based decision support'),
      bulletBold('PEARL ALIA', 'Treatment hardware - diagnosis-to-treatment closed loop (hardware pipeline)'),
      bulletBold('AQUA-LO', 'Laboratory Information Management System (LIMS) - chain-of-custody, QA/QC, data flywheel'),

      heading2('1.6 Trademarks'),
      para('Project Pearl\u2122, Pearl\u2122, ALIA\u2122, and AQUA-LO\u2122 are trademarks of Local Seafood Projects Inc.'),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 2: WHO USES PIN?
      // ═══════════════════════════════════════════════════
      heading1('PART 2: WHO USES PIN?'),
      para('PIN serves 15 distinct user roles, each with a tailored management center, lenses, and data views:'),
      emptyLine(),

      makeTable(
        ['Role', 'Lenses', 'Who They Are', 'What They Need'],
        [
          ['Federal', '21', 'EPA/USGS/NOAA staff, congressional oversight', 'National rollups, interagency coordination, military oversight'],
          ['State', '21', 'State DEQ/DEP water quality managers', 'Statewide compliance, TMDL tracking, permitting, funding'],
          ['Local Government', '19', 'City/county environmental directors', 'Stormwater, EJ equity, emergency response, funding'],
          ['MS4 (Municipal Stormwater)', '22', 'MS4 permit holders, stormwater managers', 'NPDES compliance, BMP tracking, MCM management'],
          ['Municipal Utility', '21', 'Water/wastewater utility operators', 'Treatment process, permit limits, asset management, lab data'],
          ['Corporate/ESG', '13', 'Sustainability officers, ESG reporters', 'Supply chain risk, facility operations, ESG disclosure'],
          ['Biotech/Pharma', '14', 'Process water engineers, GMP quality', 'Process water quality, discharge compliance, contaminant tracking'],
          ['Investor/Financial', '14', 'Portfolio managers, due diligence analysts', 'Water stress exposure, climate resilience, ESG scoring'],
          ['University/Research', '19', 'Faculty researchers, campus facilities', 'Research monitoring, watershed partnerships, grants'],
          ['NGO/Conservation', '22', 'Watershed groups, conservation orgs', 'Restoration projects, advocacy, volunteer programs, citizen science'],
          ['K-12 Education', '18', 'Teachers, students, school administrators', 'Drinking water safety, outdoor classroom, educational games'],
          ['Site Intelligence', '17', 'Real estate developers, environmental consultants', 'Contamination assessment, regulatory risk, brownfield analysis'],
          ['Infrastructure', '8', 'Lenders, appraisers, title companies', 'Environmental due diligence, property risk'],
          ['AQUA-LO', '6', 'Lab technicians, QA/QC managers', 'Sample management, audit trails, reports'],
          ['PEARL Admin', '12', 'PIN system administrators', 'Operations, user management, system health, alerts'],
        ],
      ),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 3: COMPETITIVE POSITION
      // ═══════════════════════════════════════════════════
      heading1('PART 3: COMPETITIVE POSITION'),

      heading2('3.1 What Makes PIN Different'),
      para('PIN competes in the water quality software market against 10 identified competitors. Here is what none of them have:'),
      emptyLine(),
      bulletBold('430M+ federal datapoints', 'aggregated from 75+ agency integrations vs. competitors at 1-5 sources'),
      bulletBold('565,000 assessment units', 'nationwide coverage vs. competitors at site/facility level'),
      bulletBold('9 calibrated watershed scoring dimensions', 'tiered pyramid model for holistic water quality assessment'),
      bulletBold('PIN Sentinel 3-tier detection engine', '15 change sources, BED algorithm, attack classification'),
      bulletBold('AI-powered Resolution Planner', 'diagnoses + prescribes corrective actions, not just documents'),
      bulletBold('15 entity-based management centers', 'from Federal to K-12 in one platform'),
      bulletBold('259 analytical lenses', 'across all roles'),
      bulletBold('2,456 HUC-8 watersheds', 'under continuous surveillance'),
      bulletBold('Predictive modeling', '7-day and 30-day projections with confidence weighting'),
      bulletBold('Treatment hardware pipeline', 'PEARL ALIA closes the diagnosis-to-treatment loop'),
      bulletBold('Integrated LIMS', 'AQUA-LO creates a data flywheel with chain-of-custody'),

      heading2('3.2 Competitor Landscape'),
      makeTable(
        ['Competitor', 'Tier', 'Focus'],
        [
          ['Xylem Vue', 'Enterprise', 'Full-stack water utility platform'],
          ['2NFORM (2NDNATURE)', 'Tier 1 MS4', 'Stormwater management + scenario planning'],
          ['SAMS Stormwater', 'Tier 1 MS4', 'MS4 compliance + mobile inspection'],
          ['SwiftComply', 'Tier 1 MS4', 'Stormwater + FOG compliance'],
          ['ComplianceGo', 'Tier 1 MS4', 'Municipal compliance automation'],
          ['SW\u00B2', 'Tier 1 MS4', 'Stormwater management + route planning'],
          ['NPDESPro', 'Tier 1 MS4', 'NPDES permit management'],
          ['Aquatic Informatics', 'Tier 2 Broad', 'Water data management (Veralto)'],
          ['Locus Technologies', 'Tier 2 Broad', 'EHS/compliance platform'],
          ['KETOS', 'Tier 2 Broad', 'Hardware + software water monitoring'],
        ],
      ),

      heading2('3.3 Key Feature Gaps to Close'),
      makeTable(
        ['Feature', 'Priority', 'Status', 'Why It Matters'],
        [
          ['Esri/ArcGIS Interoperability', 'HIGH', 'Not started', '7/10 competitors have native Esri - table stakes for municipal buyers'],
          ['Automated Compliance Reporting', 'HIGH', 'Partial', 'Every Tier 1 competitor does this'],
          ['SCADA/LIMS Integration', 'HIGH', 'Not started', 'Critical for enterprise utility sales'],
          ['SOC 2 Type II Certification', 'HIGH', 'Not started', 'Required by municipal/utility IT departments'],
          ['Scenario Planning Module', 'MEDIUM', 'Partial', 'Watershed outcome modeling (2NFORM has this)'],
          ['Offline Mobile Capability', 'LOW', 'Deprioritized', 'PIN is analytics, not field inspection'],
        ],
      ),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 4: TECHNOLOGY STACK
      // ═══════════════════════════════════════════════════
      heading1('PART 4: TECHNOLOGY STACK'),

      makeTable(
        ['Layer', 'Technology', 'Version'],
        [
          ['Framework', 'Next.js (App Router)', '15.3'],
          ['Language', 'TypeScript', '5.2'],
          ['Runtime', 'React', '19'],
          ['Styling', 'Tailwind CSS + CSS Variables', '3.3'],
          ['UI Library', 'shadcn/ui (Radix UI primitives)', '-'],
          ['Maps', 'Mapbox GL JS + react-map-gl', '3.18 / 8.1'],
          ['Charts', 'Recharts + ECharts', '2.15 / 6.0'],
          ['Drag & Drop', '@dnd-kit/core + sortable', '6.3 / 10.0'],
          ['Auth', 'Supabase', '2.96'],
          ['Monitoring', 'Sentry', '10.42'],
          ['Rate Limiting', 'Upstash Redis + Ratelimit', '-'],
          ['Email', 'Resend + react-email', '-'],
          ['PDF Export', 'jsPDF + html2pdf.js', '-'],
          ['Hosting', 'Vercel (95 cron jobs)', '-'],
          ['Theme', 'next-themes (class-based dark mode)', '-'],
          ['Forms', 'react-hook-form + zod validation', '-'],
          ['Testing', 'Vitest (unit) + Playwright (e2e)', '-'],
          ['AI', 'Claude API (Anthropic)', '-'],
        ],
      ),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 5: ARCHITECTURE OVERVIEW
      // ═══════════════════════════════════════════════════
      heading1('PART 5: ARCHITECTURE OVERVIEW'),

      heading2('5.1 Data Flow'),
      para('Federal APIs (75+)  \u2192  Cron Jobs (95)  \u2192  Cache Modules (110)  \u2192  API Routes (73)  \u2192  React Components (200+)', { font: 'Consolas', size: 18 }),
      para('Cache modules persist to both local disk (.cache/) and Vercel Blob for cold-start survival across deployments.'),

      heading2('5.2 Cache Persistence Pattern (Universal)'),
      para('Every one of the 110 cache modules follows this identical pattern:'),
      bullet('In-Memory: Map<string, T> with grid-based keys at 0.1-degree resolution (~11km cells)'),
      bullet('Disk: .cache/*.json files (gitignored), loaded via loadFromDisk() / saveToDisk()'),
      bullet('Blob: Vercel Blob REST API (raw fetch, no SDK), loaded via loadCacheFromBlob() / saveCacheToBlob()'),
      bullet('Warm-up: ensureWarmed() exported from each cache - tries disk first, then blob if empty'),
      bullet('Build Locks: _buildInProgress boolean + _buildStartedAt timestamp, auto-clears after 12 minutes'),

      heading3('Critical Rules'),
      bullet('All set*Cache() functions are async - you MUST await them because Vercel kills the process after response'),
      bullet('Empty-data guards: if a rebuild fetches 0 records, it skips set*Cache() to preserve existing good data'),
      bullet('API routes without a request parameter are statically rendered at build - always add export const dynamic = \'force-dynamic\''),

      heading2('5.3 Spatial Indexing'),
      para('Grid-based with 0.1-degree resolution (~11km cells):'),
      bullet('gridKey(lat, lng) returns a string key like "38.9_-77.0"'),
      bullet('neighborKeys(lat, lng) returns 3x3 grid of surrounding keys'),
      bullet('Any location query looks up center cell + 8 neighbors for complete coverage'),

      heading2('5.4 The 110 Cache Modules'),
      para('Organized by indexing strategy:'),
      bulletBold('Grid-based (40+)', 'WQP, SDWIS, ECHO, ICIS, TRI, BEACON, COOPS, PFAS, CAMPD, EJScreen, etc.'),
      bulletBold('State-keyed (45+)', 'ATTAINS, Superfund, RCRA, SEMS, Census ACS, Climate Normals, NWS Alerts, etc.'),
      bulletBold('National aggregate (15+)', 'AI Insights, State Reports, CDC WONDER, FIRMS, Copernicus, etc.'),

      heading2('5.5 Key Infrastructure Files'),
      makeTable(
        ['File', 'Purpose'],
        [
          ['lib/cacheUtils.ts', 'gridKey(), neighborKeys(), disk persistence, delta tracking'],
          ['lib/blobPersistence.ts', 'Vercel Blob save/load (raw REST API, no @vercel/blob SDK)'],
          ['lib/healthDataUtils.ts', 'Health data types, military proximity calculations'],
          ['lib/hhsDataUtils.ts', 'HHS API clients (Socrata, CDC WONDER, Tracking Network, Open FDA)'],
          ['lib/constants.ts', 'ALL_STATES (51), PRIORITY_STATES (19), FIPS mappings'],
          ['lib/layoutConfig.ts', '600+ section definitions with order values for all 15 management centers'],
          ['lib/lensRegistry.ts', 'Role-to-lens metadata for sidebar navigation'],
          ['lib/roleRoutes.ts', 'Role-to-route access control (allowed prefixes per role)'],
          ['lib/watersGeoService.ts', 'EPA WATERS NHD flow navigation (on-demand, 1-hour LRU cache)'],
        ],
      ),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 6: CRON SCHEDULE
      // ═══════════════════════════════════════════════════
      heading1('PART 6: CRON JOB SCHEDULE (95 JOBS)'),

      heading2('6.1 By Frequency'),
      makeTable(
        ['Frequency', 'Count', 'Examples'],
        [
          ['Every 5 min', '4', 'NWIS-IV streamflow, Sentinel poll/score, Alert dispatch'],
          ['Every 10 min', '1', 'Installation threat assessment'],
          ['Every 15 min', '2', 'Burn pit assessment, ATTAINS diff dispatch'],
          ['Every 30 min', '4', 'Air quality, NWPS precipitation, Seismic, ATTAINS'],
          ['Every 4 hrs', '1', 'NASA FIRMS fire detection'],
          ['Every 6 hrs', '6', 'COOPS tides, NWM hydrology, AI insights, NWS forecast'],
          ['Daily', '55+', 'Staggered 3 AM - 11 PM UTC (see schedule below)'],
          ['Weekly (Sun)', '14', 'RCRA, SEMS, EJScreen, Census ACS, Climate Normals'],
          ['Special', '2', 'NWSS (Wed/Sat), NASA STREAM (Sun only)'],
        ],
      ),

      heading2('6.2 Daily Schedule (UTC)'),
      para('All daily cron jobs are staggered across the 24-hour cycle to avoid thundering herd:'),
      emptyLine(),
      makeTable(
        ['Time (UTC)', 'Cron Jobs'],
        [
          ['3:00 AM', 'FEMA disaster declarations'],
          ['3:15', 'Superfund NPL sites'],
          ['3:45', 'CDC WONDER mortality'],
          ['5:00', 'WQP water quality samples (19 priority states)'],
          ['5:30', 'State reports, USACE dams'],
          ['6:00', 'ICIS NPDES compliance'],
          ['6:30', 'Hospital facilities (CMS)'],
          ['7:00', 'SDWIS drinking water systems'],
          ['7:30', 'CDC waterborne illness outbreaks'],
          ['8:00', 'NWIS groundwater levels'],
          ['8:30', 'Environmental health metrics'],
          ['9:00', 'EPA ECHO facility compliance'],
          ['9:45', 'Environmental Tracking Network'],
          ['10:15', 'HealthData.gov (1000+ HHS datasets)'],
          ['10:30', 'Open FDA enforcement/recalls'],
          ['11:00', 'PFAS contamination sites'],
          ['1:45 PM', 'DOD PFAS military sites'],
          ['2:00', 'NDBC buoys, US Drought Monitor'],
          ['6:00', 'TRI toxic releases'],
          ['7:00', 'Grants.gov opportunities'],
          ['8:00', 'CAMPD emissions, NFIP flood claims'],
        ],
      ),

      heading2('6.3 Special Crons (Non-Rebuild)'),
      makeTable(
        ['Route', 'Frequency', 'Purpose'],
        [
          ['sentinel-poll', '5 min', 'Change detection adapters (TRI, NPDES, ECHO, ATTAINS, FEMA)'],
          ['sentinel-score', '5 min', 'Score and aggregate change events'],
          ['dispatch-alerts', '5 min', 'Send pending alert notifications'],
          ['installation-threat-assessment', '10 min', 'Multi-hazard military installation scoring'],
          ['burn-pit-assessment', '15 min', 'Burn pit risk evaluation'],
          ['generate-insights', '6 hrs', 'Pre-generate AI insights for all states/roles'],
          ['generate-urgent-insights', 'Every odd hour', 'Rapid AI insights for urgent changes'],
          ['build-assessments', 'Daily 7:30 PM', 'Installation threat snapshots'],
        ],
      ),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 7: API ROUTES
      // ═══════════════════════════════════════════════════
      heading1('PART 7: API ROUTES (73 ENDPOINTS)'),

      heading2('7.1 AI & Insights'),
      makeTable(
        ['Route', 'Purpose'],
        [
          ['/api/ai/ask-pin', 'General water quality Q&A (Claude API)'],
          ['/api/ai/briefing-qa', 'Briefing-specific Q&A with state/role context'],
          ['/api/ai/resolution-plan', 'AI-generated corrective action plans'],
          ['/api/ai-insights', 'Pre-generated insights (served from cache)'],
          ['/api/ai-categorize', 'LLM categorization of alerts/incidents'],
        ],
      ),

      heading2('7.2 Core Data Queries'),
      makeTable(
        ['Route', 'Purpose'],
        [
          ['/api/location-report', 'Fan-out query: all spatial caches for a lat/lng or ZIP'],
          ['/api/national-summary', 'National rollup (ATTAINS, ICIS, SDWIS, ECHO, PFAS)'],
          ['/api/water-data', 'Multi-source water quality proxy'],
          ['/api/water-risk-score', 'Composite risk scoring algorithm'],
          ['/api/cache-status', 'Unified health status of all 65+ caches'],
          ['/api/source-health', 'API uptime/latency for all data sources'],
        ],
      ),

      heading2('7.3 Environmental Monitoring'),
      makeTable(
        ['Route', 'Purpose'],
        [
          ['/api/air-quality/latest', 'Current AQI readings + trend history'],
          ['/api/fire-aq/installation-risk', 'Fire + AQ risk for military installations'],
          ['/api/firms/latest', 'NASA FIRMS active fire detections'],
          ['/api/flood-forecast', 'NWS flood forecast data'],
          ['/api/installation-threats', 'Multi-hazard threat scoring'],
          ['/api/burn-pit/monitoring', 'Burn pit risk data'],
          ['/api/sentinel-status', 'Sentinel change detection health'],
        ],
      ),

      heading2('7.4 Compliance & Regulatory'),
      makeTable(
        ['Route', 'Purpose'],
        [
          ['/api/icis/national-summary', 'NPDES compliance aggregates'],
          ['/api/pfas/national-summary', 'PFAS contamination aggregates'],
          ['/api/nwis-gw/national-summary', 'Groundwater level aggregates'],
          ['/api/superfund-sites', 'Superfund NPL site lookup'],
          ['/api/fema-declarations', 'Disaster declarations by state'],
          ['/api/tri-releases/emergency-summary', 'Toxic release emergency data'],
        ],
      ),

      heading2('7.5 Alerts, Admin, Uploads'),
      bullet('/api/alerts/* - 8 sub-routes for rule config, recipients, history, suppression, throttling'),
      bullet('/api/admin/* - cron health, user management, baseline seeding'),
      bullet('/api/uploads/* - CSV upload, validation, approval workflow'),
      bullet('/api/invites/* - user invitation creation and resolution'),
      bullet('/api/session/validate - session validation and user context'),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 8: ROLE & LENS SYSTEM
      // ═══════════════════════════════════════════════════
      heading1('PART 8: ROLE & LENS SYSTEM'),

      heading2('8.1 How It Works'),
      para('1. Each user has a role (Federal, State, MS4, etc.) that determines their primary route'),
      para('2. Each role has 6-22 lenses (perspectives/views) defined in lib/lensRegistry.ts'),
      para('3. Each lens maps to a Set of section IDs via LENS_CONFIG in the management center'),
      para('4. Sections are rendered in order defined by lib/layoutConfig.ts (600+ section definitions)'),
      para('5. Users can drag-to-reorder and show/hide sections; layout persists to Supabase'),

      heading2('8.2 Lens Gating Rules'),
      bullet('gateStates: Some lenses only appear for specific states (e.g., nutrient trading)'),
      bullet('gateMilitary: Military lenses restricted to military users, Pearl admin, or super-admin'),
      bullet('Users lens: Requires admin privileges'),
      bullet('Alerts lens: Requires super-admin or Pearl role'),

      heading2('8.3 Sidebar Navigation'),
      bullet('Single-role users: flat lens list (no role tree)'),
      bullet('Multi-role users: expandable role tree with lens sub-items'),
      bullet('Data Provenance: fixed bottom sidebar item (always visible)'),
      bullet('Settings: fixed bottom sidebar item'),
      bullet('Auto-expand active role, save last-visited lens to localStorage'),

      heading2('8.4 Federal Lens Example'),
      makeTable(
        ['Lens', 'Key Sections Shown'],
        [
          ['overview', 'US map, constituent concerns'],
          ['briefing', 'AI intelligence, briefing actions, Q&A'],
          ['compliance', 'Network health, ICIS enforcement, SDWIS drinking water, priority queue'],
          ['water-quality', 'Domain tabs, impairment profile, coverage gaps, USGS stations'],
          ['military-installations', 'NTAS threat, at-risk facilities, commander brief, fire/burn pit, PFAS'],
          ['fire-air-quality', 'Fire/AQ intel, correlation analysis, risk scorecard, AQI trends, weather'],
          ['public-health', 'Contaminants, mortality, healthcare access, outbreaks, env health'],
          ['funding', 'SRF programs, capital projects, deadlines, grants, gap analysis'],
          ['scorecard', 'KPIs, grades, choropleth, state rankings, trends'],
        ],
      ),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 9: UI PATTERNS
      // ═══════════════════════════════════════════════════
      heading1('PART 9: UI COMPONENT PATTERNS'),

      heading2('9.1 Standardized Typography'),
      makeTable(
        ['Element', 'Tailwind Classes'],
        [
          ['Card title', 'text-base font-semibold'],
          ['Metric label', 'text-2xs font-medium text-slate-500 uppercase tracking-wide'],
          ['Metric value', 'text-lg font-bold'],
          ['Supporting text', 'text-xs text-slate-500'],
          ['Section heading', 'text-xs font-semibold uppercase tracking-wide text-slate-600'],
          ['Card header padding', 'pb-3'],
          ['Card content padding', 'pt-0 space-y-3'],
        ],
      ),

      heading2('9.2 Key Shared Components'),
      makeTable(
        ['Component', 'Purpose'],
        [
          ['CappedList', 'Generic scrollable list capped at N items with real-time search filtering'],
          ['DraggableSection', 'Wraps sections for drag-to-reorder, collapse/expand, and Ask PIN help'],
          ['LayoutEditor', 'Admin floating toolbar for section layout management (persists to Supabase)'],
          ['TierBadge', 'Data confidence tier indicator (T1=Federal, T2=State, T3=Community, T4=Derived)'],
          ['DataProvenanceCard', 'Collapsible 4-tier data source catalog'],
          ['PlatformDisclaimer', 'Legal/informational footer (PIN is not a regulatory agency)'],
          ['BrandedPrintBtn', 'Print button with PEARL branding in new window'],
          ['GrantOpportunityMatcher', 'Role-specific grant finder with economic context'],
        ],
      ),

      heading2('9.3 Dark Mode'),
      bullet('next-themes library with class-based dark mode (storage key: "pin-theme")'),
      bullet('Light: white/slate surfaces with subtle pastel gradients'),
      bullet('Dark: deep navy backgrounds (#0A1128, #0D1526) with teal accents'),
      bullet('Custom PIN CSS variables for brand colors (--pin-teal, --pin-status-healthy, etc.)'),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 10: DATA SOURCES
      // ═══════════════════════════════════════════════════
      heading1('PART 10: DATA SOURCES (75+ FEDERAL APIS)'),

      heading2('10.1 Major Agency Integrations'),
      makeTable(
        ['Agency', 'APIs Integrated', 'Cache Count'],
        [
          ['EPA', 'ATTAINS, ECHO, ICIS, SDWIS, FRS, TRI, RCRA, SEMS, PFAS, EJScreen, BEACON, CAMPD', '20+'],
          ['USGS', 'NWIS-IV, NWIS-GW, WQP, OGC, Daily Values, NGWMN, Water Availability', '8'],
          ['NOAA', 'CO-OPS, NWS Alerts, NWS Forecast, NDBC, NCEI, NWM, HEFS, SNOTEL, GLERL', '12'],
          ['CDC', 'WONDER, NWSS, SVI, EJI, Content, data.cdc.gov', '7'],
          ['FEMA', 'Disaster Declarations, NFIP Claims, Hazard Mitigation', '3'],
          ['NASA', 'FIRMS fire detection, CMR satellite, STREAM flood modeling', '3'],
          ['HHS', 'HealthData.gov, Hospitals, MyHealthFinder, ATSDR', '5'],
          ['HRSA', 'Health Facilities, HPSA Designations', '3'],
          ['FDA', 'Open FDA enforcement, MAUDE device events', '2'],
          ['DOD', 'PFAS sites, Installation data', '2'],
          ['USACE', 'Dams, Civil Works Projects', '2'],
          ['Census', 'ACS 5-Year Estimates', '1'],
        ],
      ),

      heading2('10.2 Data Confidence Tiers'),
      makeTable(
        ['Tier', 'Name', 'Examples'],
        [
          ['T1', 'Federal/Regulatory', 'EPA ATTAINS, ECHO, SDWIS, USGS NWIS, EJScreen, NOAA CO-OPS'],
          ['T2', 'State/Academic', 'Chesapeake Bay Program, State DEPs, NERRS'],
          ['T3', 'Community', 'Blue Water Baltimore, Waterkeeper Alliance'],
          ['T4', 'Derived/Observational', 'PIN Composite Indices, AI-generated insights'],
        ],
      ),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 11: INTEGRATION ROADMAP
      // ═══════════════════════════════════════════════════
      heading1('PART 11: INTEGRATION ROADMAP'),
      para('Status: 75 crons built, ~25 slots remaining (Vercel limit: 100/project)'),

      heading2('11.1 Tier 1 - Critical (8 Sources)'),
      makeTable(
        ['Source', 'Agency', 'Purpose'],
        [
          ['WQX 3.0 Modern Endpoint', 'EPA', 'Richer chemical/biological measurements with method metadata'],
          ['USGS STN Flood Event Viewer', 'USGS', 'Rapid-deployment sensor data during named flood events'],
          ['ECHO DMR Violation Details', 'EPA', 'Pollutant-level exceedances with permit limits'],
          ['NOAA HAB Forecasts', 'NOAA', 'Cyanobacteria bloom forecasts (drinking water intake risk)'],
          ['USGS StreamStats', 'USGS', 'Watershed delineation + flow statistics for any point'],
          ['EPA e-DMR Electronic Reporting', 'EPA', 'Permittee self-reported compliance filings'],
          ['CDC PLACES Local Health', 'CDC', 'Census tract-level prevalence for 36 chronic diseases'],
          ['NOAA CoastWatch', 'NOAA', 'Satellite chlorophyll-a/SST at 1km resolution'],
        ],
      ),

      heading2('11.2 Tier 2 - High Value (12 Sources)'),
      bullet('ICIS-Air Compliance (EPA) - atmospheric deposition into water bodies'),
      bullet('SSURGO Soil Survey (USDA) - hydrologic soil groups, runoff prediction'),
      bullet('NADP Atmospheric PFAS (NOAA) - wet/dry PFAS deposition via rain'),
      bullet('MS4 Permit Universe (EPA) - full stormwater permit database'),
      bullet('NLCD Land Cover (USGS) - impervious surface fraction at 30m'),
      bullet('Biosolids (EPA ECHO) - emerging PFAS vector via land application'),
      bullet('CO-OPS Extended Predictions (NOAA) - 30-day tidal + surge forecasts'),
      bullet('Volcano Observatory (USGS) - 169 US volcano alerts (ash impacts water treatment)'),
      bullet('OSHA Water/Wastewater (DOL) - NAICS 2213x inspection records'),
      bullet('SWDI Severe Weather (NOAA) - hail, tornado, lightning infrastructure damage risk'),
      bullet('NASS Livestock (USDA) - county-level CAFO counts (manure N/P loading)'),
      bullet('NASS Crops (USDA) - crop acreage (pesticide/fertilizer loading proxy)'),

      heading2('11.3 Tier 3 - Medium Value (5 Sources)'),
      bullet('Congress.gov Legislation - water quality / PFAS / CWA bill tracking'),
      bullet('PHMSA Pipeline Spills (DOT) - spill incidents with affected waterways'),
      bullet('IEM NEXRAD Radar QPE - real-time radar-derived precipitation'),
      bullet('EPA OPP Pesticide Benchmarks - automated exceedance detection'),
      bullet('Hypoxia Monitoring (NOAA/CBP) - Gulf dead zone + Chesapeake Bay DO'),

      pageBreak(),

      // ═══════════════════════════════════════════════════
      // PART 12: CRITICAL PATTERNS
      // ═══════════════════════════════════════════════════
      heading1('PART 12: CRITICAL PATTERNS & GOTCHAS'),

      para('These are the patterns and pitfalls that anyone working on PIN must understand:'),
      emptyLine(),

      heading3('1. Async Cache Sets'),
      para('All set*Cache() functions are async. You MUST await saveCacheToBlob() because Vercel terminates the process after the response is sent. Forgetting await = data loss.'),

      heading3('2. Static Rendering Trap'),
      para('API routes without a request parameter are statically rendered at build time. Always add: export const dynamic = \'force-dynamic\''),

      heading3('3. WQP Date Format'),
      para('The Water Quality Portal API requires MM-dd-yyyy format (not ISO). Uses resultPhysChem profile for lat/lng.'),

      heading3('4. Build Lock Auto-Clear'),
      para('Build locks auto-clear after 12 minutes. If a cron crashes mid-build, the lock won\'t block the next run forever.'),

      heading3('5. ATTAINS Self-Chaining'),
      para('ATTAINS runs every 30 minutes but only processes 2 states per run, cascading through all 51 states over time. Uses 90-day TTL to determine which states need refresh.'),

      heading3('6. Sentinel Adapter Pattern'),
      para('Each adapter has its own polling interval. The 5-minute sentinel-poll cron iterates all adapters, but each decides independently whether to actually fetch based on its last-poll timestamp.'),

      heading3('7. Insights Debouncing'),
      para('The insights cache debounces disk writes by 10 seconds to prevent thrashing during the 408-call build process.'),

      heading3('8. Delta Detection (signalsHash)'),
      para('A hash is computed from cache state before AI insight generation. If the hash hasn\'t changed, the Claude API call is skipped entirely. Saves significant API costs.'),

      heading3('9. Empty Data Guards'),
      para('Every cron route checks if it fetched 0 records. If so, it skips set*Cache() to preserve existing good blob data rather than overwriting with empty data.'),

      heading3('10. PRIORITY_STATES'),
      para('19 priority states get daily updates for heavy caches (WQP, SDWIS, ECHO, ICIS, NWIS-GW). Remaining states are covered weekly or via ATTAINS self-chaining.'),

      emptyLine(), emptyLine(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [new TextRun({ text: '--- END OF DOCUMENT ---', size: 20, color: SLATE, italics: true, font: 'Calibri' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
        children: [new TextRun({ text: 'Generated by Claude Code for PEARL Intelligence Network', size: 18, color: SLATE, font: 'Calibri' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Document reflects codebase state as of March 13, 2026', size: 18, color: SLATE, font: 'Calibri' })],
      }),
    ],
  }],
});

const outputPath = join('C:', 'Users', 'Doug', 'Downloads', 'PIN-Handoff-Document.docx');
const buffer = await Packer.toBuffer(doc);
writeFileSync(outputPath, buffer);
console.log(`Written to ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
