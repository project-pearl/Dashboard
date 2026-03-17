import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, PageBreak,
} from 'docx';
import { writeFileSync } from 'fs';
import { join } from 'path';

// ── Helpers ─────────────────────────────────────────────────────────────────
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 300, after: 120 } });
}
function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [new TextRun({ text, size: 22, ...opts })],
  });
}
function bold(text, opts = {}) {
  return new TextRun({ text, bold: true, size: 22, ...opts });
}
function normal(text, opts = {}) {
  return new TextRun({ text, size: 22, ...opts });
}
function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60 },
    children: [normal(text)],
  });
}
function bulletBold(label, desc) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [bold(label), normal(desc)],
  });
}

function tableRow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map(text => new TableCell({
      width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
      shading: isHeader ? { type: ShadingType.SOLID, color: '2B3A67', fill: '2B3A67' } : undefined,
      children: [new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [new TextRun({
          text: String(text),
          bold: isHeader,
          size: 20,
          color: isHeader ? 'FFFFFF' : '333333',
        })],
      })],
    })),
  });
}

function simpleTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
    rows: [tableRow(headers, true), ...rows.map(r => tableRow(r))],
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 80 }, children: [] });
}

// ── Document ────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'PEARL Intelligence Network',
  title: 'PIN Force Protection Capabilities Report',
  description: 'PEARL Intelligence Network capabilities for military force protection',
  sections: [{
    properties: {
      page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
    },
    children: [
      // ── Title Page ──────────────────────────────────────────────
      new Paragraph({ spacing: { before: 2400 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'PEARL Intelligence Network (PIN)', bold: true, size: 48, color: '2B3A67' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'Force Protection Capabilities Report', size: 32, color: '555555' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 24, color: '888888' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: 'CLASSIFICATION: UNCLASSIFIED // FOR OFFICIAL USE ONLY', bold: true, size: 22, color: '8B0000' })],
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // ── Executive Summary ───────────────────────────────────────
      heading('Executive Summary'),
      para('The PEARL Intelligence Network (PIN) is an AI-powered intelligence assistant embedded in the national water quality dashboard. For military commanders and force protection officers, PIN provides environmental threat awareness, PFAS contamination tracking at installations, vulnerability posture scoring for nearby water infrastructure, and situational awareness through NTAS monitoring.'),
      para('PIN accesses 80+ live data caches spanning water quality, PFAS contamination, infrastructure vulnerability, climate hazards, health metrics, and compliance data. Responses are generated using GPT-4o with strict rules preventing fabrication \u2014 every answer is grounded in actual platform data, not speculation.'),
      spacer(),

      // ── Section 1 ───────────────────────────────────────────────
      heading('1. What is PIN?'),
      para('PIN stands for PEARL Intelligence Network. It is an AI-powered conversational question-and-answer system that provides military personnel with data-grounded intelligence about environmental conditions affecting installations, water supply security, and force health protection.'),
      spacer(),
      new Paragraph({ spacing: { after: 120 }, children: [bold('Key Capabilities for Force Protection:')] }),
      bullet('Environmental threat scoring for military installations and U.S. embassies'),
      bullet('PFAS contamination tracking across 50+ DoD installations with drinking water exceedance monitoring'),
      bullet('Vulnerability posture scoring for water utilities near military bases (derived from compliance gaps and SCADA indicators)'),
      bullet('NTAS threat level monitoring (DHS National Terrorism Advisory System)'),
      bullet('At-risk facility alerting with composite environmental threat scoring (fire, AQI, burn pits, wind exposure)'),
      bullet('Cross-domain spatial correlation analysis linking water contamination to health outcomes near installations'),
      spacer(),
      new Paragraph({ spacing: { after: 120 }, children: [bold('What PIN does NOT provide:')] }),
      bullet('PIN does not provide real-time cyber threat detection or intrusion alerts'),
      bullet('PIN does not connect to classified threat intelligence feeds'),
      bullet('The CISA context in PIN is a general advisory reminder, not a live CISA alert feed'),
      bullet('Cyber risk scores reflect vulnerability posture (compliance gaps, system complexity), not active threat intelligence'),
      spacer(),

      // ── Section 2 ───────────────────────────────────────────────
      heading('2. Military-Specific Intelligence Domains'),

      heading('2.1 PFAS Contamination at Military Installations', HeadingLevel.HEADING_2),
      para('PIN monitors PFAS (per- and polyfluoroalkyl substances) contamination at military installations through three dedicated data sources:'),
      bulletBold('DoD PFAS Assessment Cache: ', 'Tracks 50 high-profile military installations with PFAS assessments. Data includes PFAS detection status, drinking water exceedances, investigation phase, and installation-level risk profiles.'),
      bulletBold('DoD PFAS Investigation Sites Cache: ', 'Monitors active and completed PFAS investigation sites with spatial data cross-referenced against the military installations geolocation database.'),
      bulletBold('EPA PFAS Analytics Cache: ', 'Broader ECHO PFAS facility tracking beyond UCMR5, including facilities near military installations.'),
      spacer(),
      para('When a military user asks "What PFAS issues affect bases?", PIN detects the PFAS domain with a military boost, retrieves DoD PFAS data for the relevant state or nationally, and lists installations with PFAS detections, drinking water exceedances, and investigation phases.'),
      spacer(),

      heading('2.2 Water Infrastructure Vulnerability Posture', HeadingLevel.HEADING_2),
      para('PIN computes a vulnerability posture score for water and wastewater systems near military installations. This is a derived score, not real-time threat intelligence. It reflects how exposed a utility is to risk based on observable compliance and operational indicators.'),
      spacer(),
      new Paragraph({ spacing: { after: 120 }, children: [bold('Scoring Factors:')] }),
      simpleTable(
        ['Factor', 'Source', 'What It Measures'],
        [
          ['Recent Violations', 'SDWIS', 'Drinking water violation history'],
          ['SNC Status', 'ECHO', 'Significant non-compliance flag'],
          ['Missing DMRs', 'ECHO', 'Discharge monitoring report gaps'],
          ['Overdue Inspections', 'ECHO', 'Inspection schedule compliance'],
          ['SCADA Indicators', 'Derived', 'Whether system uses supervisory control'],
          ['System Complexity', 'Derived', 'Size and interconnection complexity'],
          ['Military Proximity', 'Geospatial', 'Distance to nearest installation'],
        ],
      ),
      spacer(),
      para('Risk levels are categorized as low, medium, high, or critical. PIN surfaces systems rated high or critical that are near military installations. This helps force protection officers identify which nearby water systems have the weakest compliance and operational posture \u2014 but it does not detect active cyber intrusions or attacks.'),
      spacer(),

      heading('2.3 NTAS Threat Level Monitoring', HeadingLevel.HEADING_2),
      para('PIN integrates the National Terrorism Advisory System (NTAS) from DHS with feed checks every 30 minutes:'),
      bullet('Green: No active advisory (baseline)'),
      bullet('Blue: NTAS Bulletin in effect (general awareness)'),
      bullet('Amber: Elevated threat (credible threat against the US)'),
      bullet('Red: Imminent threat (credible, specific, and impending)'),
      spacer(),
      para('During an active advisory, PIN recommends coordinating with installation security and force protection offices, sharing advisory status with chain of command, and adjusting facility readiness posture as appropriate.'),
      spacer(),

      heading('2.4 At-Risk Facility Environmental Alerting', HeadingLevel.HEADING_2),
      para('PIN monitors military installations and U.S. embassies for environmental threats via a composite scoring system (0\u2013100):'),
      spacer(),
      simpleTable(
        ['Factor', 'Max Points', 'Data Source'],
        [
          ['Fire Proximity', '40', 'NASA FIRMS hotspot detection'],
          ['AQI Severity', '30', 'AirNow (CONUS) / WAQI-AQICN (embassies)'],
          ['Burn Pit History', '15', 'PACT Act documented sites'],
          ['Wind Exposure', '15', 'NDBC buoy wind data + smoke trajectory'],
        ],
      ),
      spacer(),
      new Paragraph({ spacing: { after: 120 }, children: [bold('Severity Thresholds:')] }),
      bulletBold('RED (\u226560, CRITICAL): ', 'Immediate force protection action required'),
      bulletBold('AMBER (\u226540, ELEVATED): ', 'Heightened monitoring and coordination'),
      bulletBold('YELLOW (\u226520, MODERATE): ', 'Awareness and contingency planning'),
      bulletBold('GREEN (<20): ', 'Normal parameters'),
      spacer(),

      // ── Section 3 ───────────────────────────────────────────────
      heading('3. How PIN Works for Military Users'),

      heading('3.1 Role-Aware Intelligence', HeadingLevel.HEADING_2),
      para('PIN uses a dedicated Federal+Military role profile. The system prompt instructs: "You are PIN, a water infrastructure security assistant for a military installation commander. Prioritize base water supply threats, PFAS proximity to installations, CISA cyber advisories for water SCADA systems, and force readiness impacts. Flag threats within 10 miles of federal installations."'),
      spacer(),

      heading('3.2 Domain Detection with Military Boost', HeadingLevel.HEADING_2),
      para('When a military user asks a question, PIN\'s domain detection engine applies score boosts:'),
      bullet('Military domain keywords (military, base, installation, dod, army, navy, air force, marine, defense, cyber): +4 boost'),
      bullet('PFAS domain: +2 boost (PFAS is highly relevant to military installations due to AFFF firefighting foam)'),
      para('This ensures that even generic questions from military users surface installation-relevant data first.'),
      spacer(),

      heading('3.3 Suggested Questions', HeadingLevel.HEADING_2),
      para('PIN presents role-specific question prompts for military users:'),
      bullet('"Are there threats to any installations?"'),
      bullet('"What PFAS issues affect bases?"'),
      bullet('"What CISA advisories affect water infrastructure?"'),
      bullet('"What is the compliance posture across installations?"'),
      spacer(),

      heading('3.4 CISA Context (Advisory Language)', HeadingLevel.HEADING_2),
      para('For military users, PIN includes a standing advisory reminder in every response: "CISA advisory posture: Monitor water/wastewater SCADA systems for active cyber threats." This is general guidance language \u2014 it is not sourced from a live CISA API feed. It serves as a persistent reminder for military users to maintain SCADA awareness.'),
      spacer(),

      heading('3.5 Multi-Turn Conversation', HeadingLevel.HEADING_2),
      para('PIN maintains conversation context across up to 10 messages (5 Q&A exchanges), allowing military users to drill into specifics across sequential questions.'),
      spacer(),

      // ── Section 4 ───────────────────────────────────────────────
      heading('4. Data Sources Accessible for Force Protection'),

      heading('4.1 Direct Military Data Sources', HeadingLevel.HEADING_2),
      simpleTable(
        ['Source', 'Cache Module', 'Coverage'],
        [
          ['DoD PFAS Assessments', 'dodPfasCache', '50 installations, state summaries, phase breakdown'],
          ['DoD PFAS Investigation Sites', 'dodPfasSitesCache', 'Active investigation sites with spatial data'],
          ['Vulnerability Posture Scoring', 'cyberRiskCache', 'Derived compliance-gap scores for water utilities'],
          ['NTAS Threat Level', 'Real-time DHS feed', 'Terrorism advisory status (30-min refresh)'],
          ['At-Risk Facilities', 'Composite scoring', 'Fire, AQI, burn pit, wind exposure'],
          ['Military Installations', 'military-installations.json', 'Geolocated installation database'],
        ],
      ),
      spacer(),

      heading('4.2 Cross-Referenced Sources (80+ caches)', HeadingLevel.HEADING_2),
      simpleTable(
        ['Domain', 'Key Sources', 'Force Protection Relevance'],
        [
          ['Water Quality', 'ATTAINS, WQP, WQX', 'Drinking water quality near installations'],
          ['Compliance', 'SDWIS, ECHO, NPDES', 'Installation water system violations'],
          ['Health', 'CDC WONDER, Hospitals, HPSA', 'Health outcomes near contaminated installations'],
          ['Climate', 'USDM Drought, FEMA, NWS', 'Flood/drought impacts on installation water supply'],
          ['Real-time', 'USGS Streamflow, AQI', 'Real-time environmental conditions'],
          ['Infrastructure', 'USACE Dams, Reservoirs', 'Dam safety near installations'],
          ['Superfund', 'SEMS, CERCLA', 'Active cleanup sites at/near installations'],
          ['Severe Weather', 'SWDI, NEXRAD QPE', 'Severe weather threats to installations'],
        ],
      ),
      spacer(),

      // ── Section 5 ───────────────────────────────────────────────
      heading('5. Spatial Correlation Analysis'),
      para('PIN performs automated compound risk analysis using spatial proximity. These correlations identify co-located risks \u2014 they do not prove causation.'),
      spacer(),
      bulletBold('PFAS \u00d7 Healthcare Deserts: ', 'Identifies installations where PFAS contamination overlaps with healthcare professional shortage areas, meaning affected personnel and families may lack nearby medical resources.'),
      bulletBold('Flood \u2192 Drinking Water Risk: ', 'Links flood events to downstream drinking water systems, flagging installations at risk of waterborne contamination after severe weather.'),
      bulletBold('Discharge \u2192 Impairment: ', 'Connects NPDES discharge violations to downstream impairment data, identifying where upstream discharges may affect installation water supplies.'),
      bulletBold('Dam Cascade Risk: ', 'Identifies installations downstream of aging or at-risk dams.'),
      bulletBold('Drought \u00d7 Reservoir \u00d7 Violations: ', 'Correlates drought conditions with reservoir levels and compliance violations to identify installations facing simultaneous water scarcity and quality issues.'),
      spacer(),

      // ── Section 6 ───────────────────────────────────────────────
      heading('6. Data Integrity Safeguards'),
      para('PIN enforces 7 strict rules to prevent intelligence fabrication:'),
      bullet('1. IMPAIRED waterbodies are always \u2264 ASSESSED (dimensional sanity check)'),
      bullet('2. Data monitoring score \u2260 water quality grade'),
      bullet('3. Never invent metrics not present in source data'),
      bullet('4. For national questions, cite 4\u20136 diverse states for balance'),
      bullet('5. Correlations show "co-located" risks, not "caused by" relationships'),
      bullet('6. No trend claims without time-series data'),
      bullet('7. "Violations on record" = cumulative, not necessarily active'),
      spacer(),
      para('Every PIN response includes source attribution badges indicating which data sources were queried, providing transparency and auditability.'),
      spacer(),

      // ── Section 7 ───────────────────────────────────────────────
      heading('7. Limitations'),
      para('Force protection officers should be aware of the following limitations:'),
      bullet('Vulnerability posture scores are derived from public compliance data (ECHO, SDWIS, FRS). They measure how exposed a water system appears based on compliance gaps and operational indicators, not whether an active cyber attack is underway.'),
      bullet('The CISA advisory context is a static reminder to maintain SCADA vigilance. PIN does not pull from a live CISA alert feed or classified threat databases.'),
      bullet('PFAS data reflects assessment snapshots. Investigation phases and detection statuses may lag behind real-world conditions by days to weeks.'),
      bullet('At-risk facility scores depend on NASA FIRMS and AirNow/WAQI data availability. Satellite overpasses and monitor density affect coverage.'),
      bullet('Correlation analysis identifies spatial proximity only. Co-location of two risk factors does not prove a causal relationship.'),
      spacer(),

      // ── Section 8 ───────────────────────────────────────────────
      heading('8. Summary'),
      para('PIN provides military commanders and force protection officers with an AI-powered intelligence layer that transforms raw environmental data from 80+ public sources into actionable force protection intelligence. Its military-boosted domain detection, PFAS installation tracking, vulnerability posture scoring, and composite environmental threat scoring support installation readiness and soldier safety decisions.'),
      para('PIN\'s strength is synthesizing large volumes of environmental and compliance data into concise, role-aware answers grounded in actual data. It does not replace classified intelligence systems or real-time cyber threat monitoring \u2014 it complements them with environmental situational awareness that those systems do not cover.'),
      spacer(),
      spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [new TextRun({ text: 'This report is produced by the PEARL Intelligence Network (PIN).', italics: true, size: 20, color: '888888' })],
      }),
    ],
  }],
});

const outPath = join(process.cwd(), 'PIN_Force_Protection_Report.docx');
const buffer = await Packer.toBuffer(doc);
writeFileSync(outPath, buffer);
console.log(`Written to ${outPath}`);
