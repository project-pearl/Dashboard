/**
 * Generate Master Briefing DOCX — PIN Dashboard
 * Run: node scripts/generate-master-briefing.mjs
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, TableRow, TableCell, Table, WidthType,
  BorderStyle, ShadingType, PageBreak, TabStopPosition, TabStopType,
  Header, Footer, ImageRun
} from "docx";
import { writeFileSync } from "fs";

/* ── helpers ──────────────────────────────────────────────── */
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text, bold: true, size: 32, font: "Calibri" })] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, bold: true, size: 26, font: "Calibri" })] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 }, children: [new TextRun({ text, bold: true, size: 22, font: "Calibri" })] });
const p = (...runs) => new Paragraph({ spacing: { after: 120 }, children: runs });
const t = (text, opts = {}) => new TextRun({ text, size: 21, font: "Calibri", ...opts });
const bold = (text) => t(text, { bold: true });
const italic = (text) => t(text, { italics: true });
const bullet = (text, level = 0) => new Paragraph({ bullet: { level }, spacing: { after: 60 }, children: [t(text)] });
const bulletBold = (label, rest, level = 0) => new Paragraph({ bullet: { level }, spacing: { after: 60 }, children: [bold(label), t(rest)] });

function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shading ? { type: ShadingType.SOLID, color: opts.shading } : undefined,
    children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [t(text, { bold: !!opts.bold, size: opts.size || 20 })] })],
  });
}

function headerCell(text, width) {
  return cell(text, { bold: true, shading: "1B3A5C", width });
}

function tableRow(cells) { return new TableRow({ children: cells }); }

function simpleTable(headers, rows, widths) {
  const hdrCells = headers.map((h, i) =>
    new TableCell({
      width: widths ? { size: widths[i], type: WidthType.PERCENTAGE } : undefined,
      shading: { type: ShadingType.SOLID, color: "1B3A5C" },
      children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [t(h, { bold: true, size: 20, color: "FFFFFF" })] })],
    })
  );
  const dataRows = rows.map((row) =>
    new TableRow({
      children: row.map((val, i) =>
        new TableCell({
          width: widths ? { size: widths[i], type: WidthType.PERCENTAGE } : undefined,
          children: [new Paragraph({ spacing: { before: 30, after: 30 }, children: [t(String(val), { size: 19 })] })],
        })
      ),
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: hdrCells }), ...dataRows],
  });
}

/* ── document ─────────────────────────────────────────────── */
const doc = new Document({
  creator: "PIN Dashboard",
  title: "PIN — Master Briefing",
  description: "Comprehensive briefing on the PIN global threat-intelligence platform",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 21 } },
    },
  },
  numbering: {
    config: [{
      reference: "default-bullet",
      levels: [
        { level: 0, format: "bullet", text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: "bullet", text: "\u25E6", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ],
    }],
  },
  sections: [
    /* ══════════════════ COVER PAGE ══════════════════ */
    {
      properties: {},
      children: [
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
          new TextRun({ text: "PIN", bold: true, size: 64, font: "Calibri", color: "1B3A5C" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
          new TextRun({ text: "Global Air, Fire & Water", size: 36, font: "Calibri", color: "4A90D9" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new TextRun({ text: "Threat Intelligence Platform", size: 36, font: "Calibri", color: "4A90D9" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [
          new TextRun({ text: "Master Briefing", size: 28, font: "Calibri", italics: true, color: "666666" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
          t("March 2026", { size: 24 }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
          t("CONFIDENTIAL", { size: 20, bold: true, color: "CC0000" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 2000 }, children: [
          t("Real-time threat detection, environmental intelligence, and regulatory compliance across air quality, wildfire, and water systems \u2014 serving 16 stakeholder roles from federal agencies to K-12 classrooms", { size: 20, italics: true, color: "555555" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [
          t("Prepared by the PIN Engineering Team", { size: 20, color: "888888" }),
        ]}),
      ],
    },

    /* ══════════════════ TABLE OF CONTENTS ══════════════════ */
    {
      children: [
        h1("Table of Contents"),
        p(t("")),
        ...[
          "1.  Executive Summary",
          "2.  What Is PIN? \u2014 A Tri-Domain Threat Intelligence Platform",
          "3.  Platform by the Numbers",
          "4.  The Three Domains: Water, Fire & Air",
          "5.  Data Sources & Integration Pipeline",
          "6.  Role-Based Access & Dashboards",
          "7.  Lens System & Information Architecture",
          "8.  Sentinel Threat-Detection System",
          "9.  AI & Machine-Learning Capabilities",
          "10. Scoring & Analytics Engines",
          "11. Alerting & Notification Framework",
          "12. Security & Compliance Posture",
          "13. Technology Stack",
          "14. Infrastructure & Deployment",
          "15. Recent Major Milestones",
          "16. Roadmap & Future Direction",
        ].map((line) => p(t(line, { size: 22 }))),
      ],
    },

    /* ══════════════════ 1. EXECUTIVE SUMMARY ══════════════════ */
    {
      children: [
        h1("1. Executive Summary"),
        p(
          t("PIN is a "),
          bold("global air, fire, and water threat intelligence platform"),
          t(" that fuses data from over "),
          bold("50 federal and state sources"),
          t(" into a unified operational picture \u2014 updated as frequently as every 5 minutes. It is no longer just a water-quality dashboard. PIN now monitors three interconnected environmental domains:"),
        ),
        p(t("")),
        bulletBold("Water: ", "Stream gauges, drinking water systems, NPDES permits, PFAS contamination, harmful algal blooms, sewer overflows, coastal stations, groundwater, flood forecasts, drought conditions, and wastewater pathogen surveillance"),
        bulletBold("Fire: ", "NASA FIRMS satellite fire detection (VIIRS/MODIS) every 4 hours, fire-to-watershed impact correlation, and infrastructure proximity alerts"),
        bulletBold("Air: ", "Real-time Air Quality Index (AQI) monitoring every 30 minutes, smoke plume tracking, and air-water quality correlation analysis"),
        p(t("")),
        p(
          t("These three domains converge in PIN's "),
          bold("Sentinel threat-detection pipeline"),
          t(" \u2014 a DARPA-evaluated, 6-phase system that ingests anomaly signals from 12 adapters every 5 minutes, scores HUC-8 watersheds, detects coordinated multi-site events, and classifies incidents as attack vs. benign with "),
          bold("perfect precision and recall (F1 = 1.0)"),
          t(". Sentinel treats fire and air quality as first-class threat vectors alongside water contamination."),
        ),
        p(t("")),
        p(
          t("The platform delivers role-tailored intelligence to "),
          bold("16 distinct stakeholder roles"),
          t(" \u2014 from federal agency directors and military installation commanders to state regulators, municipal utilities, K-12 science classes, NGO advocates, and institutional investors \u2014 through "),
          bold("230+ lens views"),
          t(", AI-generated briefings (refreshed every 6 hours), and 13 automated alert triggers. PIN is deployed on Vercel with Supabase authentication, Vercel Blob persistence, and full NIST 800-53 Rev 5 security controls."),
        ),
      ],
    },

    /* ══════════════════ 2. WHAT IS PIN? ══════════════════ */
    {
      children: [
        h1("2. What Is PIN?"),
        p(
          t("PIN (formerly Project PEARL) is a "),
          bold("tri-domain environmental threat intelligence platform"),
          t(" built on Next.js 15. It serves as a unified command center that continuously monitors the intersection of "),
          bold("air quality, wildfire activity, and water systems"),
          t(" across the United States. PIN answers the question: "),
          italic("\"What threats are emerging across our air, fire, and water systems \u2014 who is affected, and what should we do about it?\""),
        ),
        p(t("")),
        h3("The Three Domains"),
        p(t("")),
        p(
          bold("Water"),
          t(" remains PIN's deepest domain \u2014 spanning drinking water safety, surface water quality, NPDES permit compliance, PFAS and emerging contaminants, harmful algal blooms, sewer overflows, flood forecasting, drought monitoring, groundwater levels, coastal tides, and wastewater pathogen surveillance. This domain alone ingests from 30+ federal data sources."),
        ),
        p(t("")),
        p(
          bold("Fire"),
          t(" is monitored via NASA FIRMS satellite imagery (VIIRS and MODIS sensors) every 4 hours. PIN correlates active fire detections with downstream watersheds, water infrastructure proximity, and air quality impacts \u2014 creating an integrated fire-water-air threat picture that no single-domain system provides."),
        ),
        p(t("")),
        p(
          bold("Air"),
          t(" quality is tracked in near real-time (every 30 minutes) through AQI monitoring stations. PIN correlates air quality degradation with wildfire smoke plumes and downstream water quality impacts from ash runoff and atmospheric deposition."),
        ),
        p(t("")),
        h3("Core Mission"),
        bullet("Fuse 50+ federal and state data sources across air, fire, and water into a single, coherent threat picture"),
        bullet("Detect emerging threats in near real-time and alert responsible parties before harm occurs"),
        bullet("Deliver tailored intelligence to 16 stakeholder roles \u2014 from military commanders to 5th-grade science classes"),
        bullet("Score, rank, and forecast environmental risk at the site, watershed, state, and national level"),
        bullet("Track regulatory compliance, enforcement actions, and political accountability"),
        bullet("Surface funding opportunities (grants, federal spending) aligned to each user's jurisdiction"),
        p(t("")),
        h3("Key Differentiators"),
        bulletBold("Tri-domain fusion: ", "Only platform that correlates fire, air quality, and water threats into a unified intelligence picture"),
        bulletBold("Real-time pipeline: ", "54 cron jobs on staggered schedules; fastest data refreshes every 5 minutes"),
        bulletBold("DARPA-evaluated threat detection: ", "Sentinel system achieves perfect precision/recall (F1=1.0) across 6 attack scenarios"),
        bulletBold("Role intelligence: ", "16 roles, 230+ lenses, each with tailored KPIs, AI briefings, and alert rules"),
        bulletBold("Spatial indexing: ", "0.1-degree grid (~11 km) resolution for sub-county granularity across all 50 states + DC"),
        bulletBold("Cold-start resilience: ", "Two-tier cache (disk + Vercel Blob) ensures data survives serverless cold starts"),
      ],
    },

    /* ══════════════════ 3. BY THE NUMBERS ══════════════════ */
    {
      children: [
        h1("3. Platform by the Numbers"),
        p(t("")),
        simpleTable(
          ["Metric", "Count"],
          [
            ["Threat domains (water, fire, air)", "3"],
            ["External data sources integrated", "50+"],
            ["Cache modules (lib/*Cache.ts)", "49"],
            ["Automated cron jobs", "54"],
            ["Non-cron API routes", "40+"],
            ["User roles supported", "16"],
            ["Dashboard route pages", "18"],
            ["Lens views (total across all roles)", "230+"],
            ["React components", "170+"],
            ["Sentinel threat adapters", "12"],
            ["Alert triggers", "13"],
            ["Scoring / analytics engines", "20+"],
            ["Library utility modules", "85+"],
            ["US states & territories covered", "51 (50 + DC)"],
            ["Priority states (deep coverage)", "19"],
            ["Nutrient trading states", "15"],
            ["Cron frequency (fastest)", "Every 5 minutes"],
            ["Grid resolution", "0.1\u00B0 (~11 km)"],
            ["AI briefing refresh", "Every 6 hours"],
            ["Sentinel poll interval", "Every 5 minutes"],
          ],
          [60, 40],
        ),
      ],
    },

    /* ══════════════════ 4. THE THREE DOMAINS ══════════════════ */
    {
      children: [
        h1("4. The Three Domains: Water, Fire & Air"),
        p(
          t("PIN's intelligence is organized around three interconnected environmental domains. Threats in one domain frequently cascade into the others \u2014 a wildfire degrades air quality and deposits ash into watersheds; a drought lowers stream flows, concentrates pollutants, and raises fire risk. PIN is built to detect and track these cascading effects."),
        ),
        p(t("")),
        h3("Water \u2014 The Deepest Domain"),
        p(
          t("Water is PIN's foundational domain, with the broadest data coverage and deepest analytics. It encompasses:"),
        ),
        bullet("Drinking water safety (SDWIS systems, violations, enforcement actions)"),
        bullet("Surface water quality (WQP monitoring stations, ATTAINS assessments, 303(d) impairments)"),
        bullet("NPDES permit compliance (ICIS inspections, violations, penalties via ECHO)"),
        bullet("Emerging contaminants (PFAS sites, Superfund/CERCLA, TRI toxic releases)"),
        bullet("Biological threats (harmful algal blooms via HABSOS, wastewater pathogens via CDC NWSS)"),
        bullet("Hydrological monitoring (USGS stream gauges every 5 min, groundwater levels, daily values)"),
        bullet("Flood forecasting (NWPS, National Water Model, HEFS ensemble forecasts, FEMA declarations)"),
        bullet("Drought tracking (US Drought Monitor, SNOTEL snowpack, flow vulnerability scoring)"),
        bullet("Coastal & marine (CO-OPS tidal stations, NDBC buoys, GLERL Great Lakes data)"),
        bullet("Sewer overflows (SSO/CSO event tracking)"),
        bullet("Beach safety (EPA BEACON advisories and closures)"),
        bullet("Watershed navigation (USGS NLDI network-linked data)"),
        p(t("")),
        h3("Fire \u2014 Satellite-Driven Detection"),
        p(
          t("PIN ingests active fire detections from "),
          bold("NASA FIRMS"),
          t(" (Fire Information for Resource Management System) every 4 hours, using both VIIRS and MODIS satellite sensors. The platform:"),
        ),
        bullet("Maps active fire hotspots relative to water infrastructure, treatment plants, and intake points"),
        bullet("Correlates fire proximity with downstream watershed risk (ash runoff, sediment loading, turbidity spikes)"),
        bullet("Triggers automated alerts when fires are detected near critical water systems"),
        bullet("Feeds fire data into the Sentinel threat pipeline as a first-class adapter"),
        bullet("Provides the dedicated Fire & Air Quality lens with maps, trend charts, correlation cards, and scorecards"),
        p(t("")),
        h3("Air \u2014 Real-Time Quality Monitoring (Operator-Driven)"),
        p(
          t("The air quality domain was added at the direct request of a "),
          bold("retired U.S. Air Force Colonel"),
          t(" who identified an operational need to protect deployed service members from air quality threats abroad. PIN did not wait for a contract or formal authorization \u2014 the team saw the mission need and built the capability. This is how PIN operates: "),
          italic("operator pull, not academic push."),
        ),
        p(t("")),
        p(
          t("PIN now monitors "),
          bold("Air Quality Index (AQI)"),
          t(" data every 30 minutes, treating air quality as both an independent threat domain and a leading indicator for water quality impacts:"),
        ),
        bullet("Real-time AQI station monitoring across all 50 states + DC"),
        bullet("Smoke plume correlation with active FIRMS fire detections"),
        bullet("Air-to-water cascade analysis (atmospheric deposition, acid rain precursors, particulate fallout)"),
        bullet("AQI trend charts and historical comparison"),
        bullet("Feeds into Sentinel as the Air Quality adapter for threat scoring"),
        p(t("")),
        h3("Cross-Domain Correlation"),
        p(
          t("What makes PIN unique is the "),
          bold("correlation across all three domains"),
          t(". Examples of cross-domain intelligence:"),
        ),
        bullet("A wildfire triggers FIRMS detection \u2192 degrades AQI downwind \u2192 ash runoff spikes turbidity at downstream USGS gauges \u2192 ATTAINS assessment worsens \u2192 Sentinel scores the HUC-8 and dispatches coordinated alerts"),
        bullet("Drought (USDM D3+) lowers stream flow (NWIS-IV) \u2192 concentrates pollutants \u2192 triggers HAB bloom (HABSOS) \u2192 beach closure (BEACON) \u2192 public health alert"),
        bullet("CDC NWSS detects pathogen spike in wastewater \u2192 Sentinel correlates with downstream water quality anomaly within 72-hour window \u2192 classified as possible biological threat"),
      ],
    },

    /* ══════════════════ 5. DATA SOURCES ══════════════════ */
    {
      children: [
        h1("5. Data Sources & Integration Pipeline"),
        p(
          t("PIN ingests from a broad portfolio of federal, state, and derived data sources. Each source flows through a dedicated cache module that handles fetching, parsing, grid-based spatial indexing, and two-tier persistence (local disk + Vercel Blob)."),
        ),
        p(t("")),
        h3("EPA Sources"),
        simpleTable(
          ["Source", "Cache Module", "Refresh Rate", "Data Provided"],
          [
            ["ATTAINS", "attainsCache", "Hourly", "Water quality assessments, impairments, TMDLs, 303(d) listings"],
            ["Water Quality Portal (WQP)", "wqpCache", "Daily (5 AM UTC)", "Monitoring station measurements, physical/chemical parameters"],
            ["ICIS-NPDES", "icisCache", "Daily (6 AM UTC)", "NPDES permit compliance, violations, inspections"],
            ["SDWIS", "sdwisCache", "Daily (7 AM UTC)", "Safe Drinking Water systems, violations, enforcement"],
            ["ECHO", "echoCache", "Daily (9 AM UTC)", "Enforcement & compliance history, penalties"],
            ["FRS", "frsCache", "Daily (10 AM UTC)", "Facility Registry \u2014 canonical facility locations"],
            ["PFAS", "pfasCache", "Daily (11 AM UTC)", "PFAS contamination sites and concentrations"],
            ["Superfund/CERCLA", "superfundCache", "Daily (3:15 AM UTC)", "Superfund National Priorities List sites"],
            ["TRI", "triCache", "Daily (6 PM UTC)", "Toxics Release Inventory \u2014 chemical releases"],
            ["BEACON 2.0", "beaconCache", "Daily (4 PM UTC)", "Beach advisories and closures"],
            ["NARS", "narsCache", "Weekly", "National Aquatic Resource Surveys"],
            ["EJScreen", "ejscreenFetch", "On-demand", "Environmental justice screening indicators"],
          ],
          [20, 18, 22, 40],
        ),
        p(t("")),
        h3("USGS Sources"),
        simpleTable(
          ["Source", "Cache Module", "Refresh Rate", "Data Provided"],
          [
            ["NWIS Instantaneous Values", "nwisIvCache", "Every 5 min", "Real-time stream gauge readings (flow, stage, temp)"],
            ["NWIS Groundwater", "nwisGwCache", "Daily (8 AM UTC)", "Groundwater level measurements"],
            ["Daily Values", "usgsDvCache", "Daily (2:30 PM UTC)", "Daily statistical summaries"],
            ["USGS Alerts", "usgsAlertCache", "Every 5 min", "Threshold exceedances at monitored sites"],
            ["NLDI", "API route", "On-demand", "Network Linked Data Index \u2014 watershed navigation"],
          ],
          [22, 18, 20, 40],
        ),
        p(t("")),
        h3("NOAA Sources"),
        simpleTable(
          ["Source", "Cache Module", "Refresh Rate", "Data Provided"],
          [
            ["NWS Alerts", "nwsAlertCache", "Every 10 min", "Weather and flood warnings/watches"],
            ["NWPS", "nwpsCache", "Every 30 min", "National Water Prediction Service flood forecasts"],
            ["National Water Model", "nwmCache", "Every 6 hours", "Hydrological model outputs"],
            ["CO-OPS", "coopsCache", "Every 6 hours", "Coastal/tidal water level stations"],
            ["NDBC", "ndbcCache", "Daily", "National Data Buoy Center \u2014 ocean/lake buoys"],
            ["NCEI", "nceiCache", "Daily", "National Centers for Environmental Information"],
            ["GLERL", "glerlCache", "Daily", "Great Lakes Environmental Research Lab"],
            ["HEFS", "hefsCache", "Every 6.5 hours", "Hydrological Ensemble Forecast System"],
            ["HAB-OFS / HABSOS", "habsosCache", "Daily", "Harmful Algal Bloom observations"],
          ],
          [22, 18, 20, 40],
        ),
        p(t("")),
        h3("Other Federal & Derived Sources"),
        simpleTable(
          ["Source", "Cache Module", "Refresh Rate", "Data Provided"],
          [
            ["NRCS SNOTEL", "snotelCache", "Daily", "Snowpack and precipitation stations"],
            ["US Drought Monitor", "usdmCache", "Daily", "Drought severity classifications (D0\u2013D4)"],
            ["FEMA", "femaCache", "Daily", "Disaster declarations, NFIP flood data"],
            ["CDC NWSS", "cdcNwssCache", "Biweekly", "Wastewater pathogen surveillance (COVID, RSV, etc.)"],
            ["NASA FIRMS", "firmsCache", "Every 4 hours", "Active fire detections (VIIRS/MODIS satellite)"],
            ["NASA CMR", "nasaCmrCache", "Daily", "Common Metadata Repository \u2014 Earth science datasets"],
            ["ERDDAP Satellite", "erddapSatCache", "Daily", "Satellite-derived ocean/lake parameters"],
            ["Air Quality (AQI)", "airQualityCache", "Every 30 min", "Real-time Air Quality Index"],
            ["USFWS IPaC", "ipacCache", "Weekly", "Endangered species & critical habitat"],
            ["USACE", "usaceCache", "Daily", "Army Corps of Engineers infrastructure"],
            ["SAM.gov", "samGovCache", "Weekly", "Federal procurement/contracting data"],
            ["Grants.gov", "grantsGovCache", "Daily", "Federal grant opportunities"],
            ["USASpending.gov", "usaSpendingCache", "Weekly", "Federal water-related spending"],
            ["Data.gov", "dataGovCache", "Weekly", "Water-related open datasets"],
            ["SSO/CSO", "ssoCsoCache", "Daily", "Sanitary/combined sewer overflow events"],
          ],
          [22, 18, 18, 42],
        ),
        p(t("")),
        h3("State-Level Sources"),
        bulletBold("MDE (Maryland): ", "Maryland Department of Environment portal data"),
        bulletBold("CEDEN (California): ", "California Environmental Data Exchange Network"),
        bulletBold("State IR/305(b): ", "State Integrated Report data via stateIRCache"),
        bulletBold("State Portal Adapters: ", "Extensible adapter pattern for additional state portals"),
      ],
    },

    /* ══════════════════ 6. ROLE SYSTEM ══════════════════ */
    {
      children: [
        h1("6. Role-Based Access & Dashboards"),
        p(
          t("PIN supports "),
          bold("16 distinct user roles"),
          t(", each with its own dashboard route, sidebar navigation, lens views, AI briefings, and KPI displays. Roles are divided into "),
          bold("Operator"),
          t(" roles (require admin approval and jurisdiction binding) and "),
          bold("Explorer"),
          t(" roles (instant access on self-signup)."),
        ),
        p(t("")),
        h3("Operator Roles (Admin-Approved)"),
        simpleTable(
          ["Role", "Dashboard Route", "Lens Count", "Key Capabilities"],
          [
            ["Federal", "/dashboard/federal", "21", "National overview, military installations, cross-agency coordination, DARPA sentinel"],
            ["State", "/dashboard/state/[code]", "21", "State-bound compliance, TMDL tracking, nutrient trading, permits & enforcement"],
            ["Local", "/dashboard/local/[id]", "19", "Municipal water quality, stormwater/MS4, EJ & equity, emergency response"],
            ["MS4", "/dashboard/ms4/[permit]", "22", "NPDES stormwater permits, MCM manager, BMP tracking, receiving waters"],
            ["Utility", "/dashboard/utility/[id]", "21", "Treatment & process, permit limits, lab sampling, asset management"],
            ["Corporate / ESG", "/dashboard/esg", "13", "ESG reporting, facility operations, supply chain risk, disclosure frameworks"],
            ["Biotech / Pharma", "/dashboard/biotech", "14", "Process water, GMP quality systems, pharma contaminants, discharge monitoring"],
            ["Investor", "/dashboard/investor", "14", "Portfolio risk, water stress analysis, climate resilience, due diligence"],
            ["Agriculture", "/dashboard/infrastructure", "17", "Site intelligence sub-personas (developer, lender, appraiser, M&A, etc.)"],
            ["Lab (Aqua-LO)", "/dashboard/aqua-lo", "6", "Data submission, QA/QC, audit trail"],
          ],
          [14, 24, 10, 52],
        ),
        p(t("")),
        h3("Explorer Roles (Self-Signup)"),
        simpleTable(
          ["Role", "Dashboard Route", "Lens Count", "Key Capabilities"],
          [
            ["K-12", "/dashboard/k12", "18", "Educational hub, outdoor classroom, student monitoring, games, debate topics"],
            ["University / Research", "/dashboard/university", "19", "Research & monitoring, watershed partnerships, grants & publications"],
            ["NGO / Conservation", "/dashboard/ngo", "22", "Watershed health, restoration projects, advocacy, volunteer programs, citizen reporting"],
            ["Researcher", "/dashboard/university", "19", "Shared with university; research-focused data access"],
          ],
          [18, 24, 10, 48],
        ),
        p(t("")),
        h3("Administrative"),
        bulletBold("Pearl Admin: ", "Full system access \u2014 operations, grants, proposals, what-if scenarios, predictions, budget planner, investigation tools"),
        bulletBold("Admin Tiers: ", "super_admin (full access, hardcoded), role_admin (manage users within role), standard user"),
      ],
    },

    /* ══════════════════ 7. LENS SYSTEM ══════════════════ */
    {
      children: [
        h1("7. Lens System & Information Architecture"),
        p(
          t("Each dashboard role uses a "),
          bold("lens-driven sidebar"),
          t(" that swaps the visible content sections when a user selects a different lens. Lenses are promoted to top-level sidebar items for single-role users, while admin/multi-role users see grouped/expandable navigation. All lens sections are "),
          bold("draggable"),
          t(" via the LayoutEditor, allowing users to reorder their dashboard."),
        ),
        p(t("")),
        h3("Common Lens Categories Across Roles"),
        bulletBold("Intelligence: ", "Overview, AI Briefing, Political Briefing, Trends & Projections"),
        bulletBold("Regulatory: ", "Compliance, Permits & Enforcement, Policy Tracker"),
        bulletBold("Environmental: ", "Water Quality, Public Health & Contaminants, Habitat & Ecology"),
        bulletBold("Operational: ", "Infrastructure, Monitoring, Disaster & Emergency"),
        bulletBold("Financial: ", "Funding & Grants, Scorecard, Reports"),
        bulletBold("Special: ", "Fire & Air Quality, Water Quality Trading (state-gated), Sentinel Monitoring"),
        p(t("")),
        h3("Notable Role-Specific Lenses"),
        bulletBold("Federal \u2014 Military Installations: ", "Gated to isMilitary sub-type; monitors military base water infrastructure"),
        bulletBold("Federal \u2014 Fire & Air Quality: ", "NASA FIRMS fire detection + AQI monitoring with correlation analysis"),
        bulletBold("MS4 \u2014 MCM Manager: ", "Minimum Control Measure tracking per NPDES stormwater permit"),
        bulletBold("K-12 \u2014 Games: ", "Educational games including 'Shuck and Destroy' and PIN Quiz"),
        bulletBold("K-12 \u2014 Outdoor Classroom: ", "Field data collection and student uploads"),
        bulletBold("Investor \u2014 Portfolio Risk: ", "Water risk scoring across investment portfolios"),
        bulletBold("Infrastructure \u2014 Sub-Personas: ", "17 site-intelligence views (developer, real estate, legal, M&A, etc.)"),
      ],
    },

    /* ══════════════════ 8. SENTINEL ══════════════════ */
    {
      children: [
        h1("8. Sentinel Threat-Detection System"),
        p(
          t("Sentinel is PIN's "),
          bold("real-time, tri-domain threat detection and classification pipeline"),
          t(", designed for DARPA evaluation. It ingests anomaly signals across water, fire, and air from 12 data adapters every 5 minutes, scores HUC-8 watersheds, detects coordinated multi-site events, and classifies incidents as attack vs. benign. Fire (FIRMS) and air quality adapters are first-class threat vectors alongside water contamination signals."),
        ),
        p(t("")),
        h3("Pipeline Architecture"),
        p(bold("Phase 1 \u2014 Ingest (every 5 min):")),
        bullet("12 adapters read from caches and live APIs"),
        bullet("Push ChangeEvent records into a 48-hour rolling queue"),
        bullet("Adapters: USGS NWIS-IV, NWS Alerts, NWPS Flood, ATTAINS, CDC NWSS, ECHO, BEACON Beach, SSO/CSO, FIRMS Fire, HAB, CO-OPS Tidal, Air Quality"),
        p(t("")),
        p(bold("Phase 2 \u2014 Scoring (every 5 min):")),
        bullet("Base threat scores with time decay"),
        bullet("6 compound patterns provide up to 3.5x score multiplier"),
        bullet("Geographic correlation: 1.5x bonus for adjacent HUC-8 watershed activity"),
        p(t("")),
        p(bold("Phase 3 \u2014 Coordination Detection:")),
        bullet("HUC-6 spatial clustering identifies coordinated multi-site events"),
        bullet("Coordination score > 0.6 triggers critical-level alert"),
        p(t("")),
        p(bold("Phase 4 \u2014 Classification:")),
        bullet("Rule-based attack vs. benign determination"),
        bullet("Confounders (rainfall, flood, seasonal, covariance) reduce scores"),
        bullet("Attack signals (CHEMICAL_DUMP, BIO_MARKER_SPIKE) boost scores"),
        bullet("likely_attack (>0.7) / possible_attack (0.4\u20130.7) / likely_benign (<0.4)"),
        p(t("")),
        p(bold("Phase 5 \u2014 NWSS Correlation:")),
        bullet("Links wastewater pathogen spikes to downstream water-quality anomalies within a 72-hour window"),
        p(t("")),
        p(bold("Phase 6 \u2014 Alert Dispatch (offset +2 min, every 5 min):")),
        bullet("13 trigger types evaluate and dispatch email/Slack alerts"),
        bullet("Per-site throttling prevents alert fatigue"),
        p(t("")),
        h3("Validation Results"),
        simpleTable(
          ["Metric", "Value"],
          [
            ["Scenarios tested", "6/6 passed"],
            ["Precision", "1.0"],
            ["Recall", "1.0"],
            ["F1 Score", "1.0"],
            ["Mean detection latency", "2 ms"],
          ],
          [50, 50],
        ),
      ],
    },

    /* ══════════════════ 9. AI ══════════════════ */
    {
      children: [
        h1("9. AI & Machine-Learning Capabilities"),
        p(
          t("PIN uses "),
          bold("OpenAI (gpt-4o-mini)"),
          t(" via direct REST API for several intelligence features:"),
        ),
        p(t("")),
        h3("Role-Specific AI Insights"),
        bullet("Generated every 6 hours for 8 roles: Federal, State, MS4, Corporate, K-12, University, Researcher, NGO"),
        bullet("Urgent insights generated every 2 hours for breaking events"),
        bullet("Delta detection via signalsHash prevents regeneration when data hasn't changed"),
        bullet("Semaphore-based concurrency (4 states at a time) with exponential backoff on rate limits"),
        p(t("")),
        h3("AskPIN Chatbot"),
        bullet("Contextual AI Q&A embedded in every dashboard via popover"),
        bullet("Knowledge base in lib/askPinKB.ts provides domain context"),
        bullet("Available at /api/ai/ask-pin"),
        p(t("")),
        h3("Briefing Q&A"),
        bullet("Role-aware conversational Q&A for Federal, Federal+Military, State, Local, and MS4 briefings"),
        bullet("Users can ask follow-up questions about their generated briefings"),
        p(t("")),
        h3("AI Resolution Plans"),
        bullet("Generates actionable remediation plans for compliance violations"),
        bullet("Available at /api/ai/resolution-plan"),
        p(t("")),
        h3("Sentinel LLM Escalation"),
        bullet("Optional (SENTINEL_LLM=true flag) for WATCH and CRITICAL HUC-8 watersheds"),
        bullet("Uses LLM to generate human-readable threat summaries for escalation"),
      ],
    },

    /* ══════════════════ 10. SCORING ENGINES ══════════════════ */
    {
      children: [
        h1("10. Scoring & Analytics Engines"),
        p(t("PIN operates 20+ specialized scoring and analytics engines:")),
        p(t("")),
        simpleTable(
          ["Engine", "Purpose", "Output"],
          [
            ["Water Quality Score", "A+/A/A-...F letter grading from numeric 0\u2013100 score", "Letter grade + color"],
            ["Water Risk Score", "Site-level composite risk incorporating WQ, flood, drought, contamination", "0\u2013100 risk score"],
            ["Ecological Sensitivity", "Habitat/ecosystem sensitivity (80/60/40/20 thresholds)", "Critical/High/Moderate/Low"],
            ["EJ Vulnerability", "Environmental justice scoring (70/50/30 thresholds)", "Severity tier + label"],
            ["Flow Vulnerability", "Watershed flow vulnerability per state", "Per-state risk tier"],
            ["ESG Score", "Corporate ESG water performance composite", "Score + disclosure tier"],
            ["National Summary", "Aggregates all caches into national KPIs (30-min TTL)", "Dashboard-ready KPIs"],
            ["Sentinel Scoring", "HUC-8 threat scores w/ compound patterns & decay", "0\u20131.0 threat score"],
            ["Scenario Engine", "What-if modeling for policy/intervention outcomes", "Projected impact metrics"],
            ["Risk Forecast", "Predictive risk modeling", "Future risk projections"],
            ["Trajectory Engine", "Trend trajectory calculation", "Directional trend vectors"],
            ["Budget Planner", "Water infrastructure budget planning & optimization", "Cost projections"],
            ["Restoration Engine", "Restoration project planning & prioritization", "Project recommendations"],
            ["Portfolio Engine", "Investment portfolio water risk assessment", "Portfolio-level risk"],
            ["EJ Impact", "Environmental justice impact assessment", "Community impact scores"],
            ["Storm Detection", "Storm event identification from sensor data", "Event classification"],
            ["Political Accountability", "Policy/political context scoring", "Accountability metrics"],
          ],
          [20, 45, 35],
        ),
      ],
    },

    /* ══════════════════ 11. ALERTING ══════════════════ */
    {
      children: [
        h1("11. Alerting & Notification Framework"),
        p(
          t("PIN's alerting system evaluates "),
          bold("13 trigger types"),
          t(" every 5 minutes (offset +2 min from Sentinel poll) and dispatches notifications via email (Resend) and Slack webhooks."),
        ),
        p(t("")),
        h3("Alert Triggers"),
        simpleTable(
          ["Trigger", "Source", "Description"],
          [
            ["sentinelTrigger", "Sentinel pipeline", "HUC-8 threat score exceeds threshold"],
            ["usgsTrigger", "USGS alerts", "Stream gauge threshold exceedance"],
            ["deltaTrigger", "Cache deltas", "Significant change detected in any cache"],
            ["nwssTrigger", "CDC NWSS", "Wastewater pathogen spike"],
            ["coordinationTrigger", "Sentinel", "Coordinated multi-site event detected"],
            ["attainsTrigger", "ATTAINS diff", "Assessment status change (new impairment, TMDL)"],
            ["floodForecastTrigger", "NWPS", "Flood forecast threshold exceeded"],
            ["fusionTrigger", "External webhook", "External fusion engine event"],
            ["beaconTrigger", "EPA BEACON", "Beach advisory or closure"],
            ["deploymentTrigger", "Deployment events", "System deployment/health alert"],
            ["firmsTrigger", "NASA FIRMS", "Fire detection near water infrastructure"],
            ["habTrigger", "HABSOS", "Harmful algal bloom detection"],
            ["nwsWeatherTrigger", "NWS", "Severe weather alert affecting water systems"],
          ],
          [22, 18, 60],
        ),
        p(t("")),
        h3("Alert Management Features"),
        bullet("Custom alert rules per user/role/jurisdiction"),
        bullet("Alert suppression rules to prevent fatigue"),
        bullet("Per-site throttling with configurable windows"),
        bullet("Alert history log with full audit trail"),
        bullet("Recipient management with role-based defaults"),
        bullet("Boundary-based geographic alert triggers"),
      ],
    },

    /* ══════════════════ 12. SECURITY ══════════════════ */
    {
      children: [
        h1("12. Security & Compliance Posture"),
        p(
          t("PIN implements "),
          bold("NIST 800-53 Rev 5"),
          t(" security controls with documented compliance mappings."),
        ),
        p(t("")),
        simpleTable(
          ["Control Area", "Implementation"],
          [
            ["Authentication", "Supabase Auth (email/password + magic link); JWT bearer tokens on all admin routes"],
            ["Authorization", "16-role RBAC with 3-tier admin levels (super_admin / role_admin / standard)"],
            ["CSRF Protection", "Middleware double-submit cookie pattern; cron routes exempt via Bearer token"],
            ["Content Security Policy", "Nonce-based CSP in middleware; frame-ancestors 'none'"],
            ["Rate Limiting", "Upstash Redis on all public API routes"],
            ["Input Validation", "Zod schemas on all request bodies"],
            ["Audit Logging", "admin_audit_log + invite_audit_log tables in Supabase"],
            ["Static Analysis (SAST)", "Semgrep (daily + on push/PR via CI)"],
            ["Dependency Audit", "npm audit (daily automated)"],
            ["SBOM", "CycloneDX generated on every CI run"],
            ["Pre-commit Hooks", "Husky + lint-staged (runs related Vitest tests)"],
            ["Secrets Rotation", "Documented rotation schedules in docs/SECRETS_ROTATION.md"],
            ["Error Tracking", "Sentry (client + server + edge)"],
            ["Incident Response", "Documented procedures in docs/INCIDENT_RESPONSE.md"],
          ],
          [25, 75],
        ),
      ],
    },

    /* ══════════════════ 13. TECH STACK ══════════════════ */
    {
      children: [
        h1("13. Technology Stack"),
        p(t("")),
        simpleTable(
          ["Layer", "Technology"],
          [
            ["Framework", "Next.js 15 (App Router)"],
            ["Language", "TypeScript 5.2"],
            ["Authentication", "Supabase (email/password, magic link, JWT)"],
            ["Database", "Supabase (PostgreSQL)"],
            ["Maps", "Mapbox GL JS 3.x + react-map-gl 8"],
            ["Charts", "Recharts 2.x, Apache ECharts 6"],
            ["UI Library", "Radix UI (full suite) + Tailwind CSS 3 + shadcn/ui"],
            ["Drag & Drop", "@dnd-kit/core + sortable"],
            ["AI / LLM", "OpenAI gpt-4o-mini (direct REST)"],
            ["Email", "Resend (alert emails, invite emails)"],
            ["Cache Persistence", "Vercel Blob (cross-instance) + local disk .cache/"],
            ["Rate Limiting", "Upstash Redis"],
            ["Error Tracking", "Sentry (client + server + edge)"],
            ["Performance Monitoring", "Vercel Speed Insights (RUM)"],
            ["Notifications", "Slack webhooks (cron failures)"],
            ["PDF Export", "jsPDF + html2pdf.js"],
            ["Testing", "Vitest (unit/integration), Playwright (e2e), MSW (mocking)"],
            ["CI Hooks", "Husky + lint-staged"],
            ["SBOM", "CycloneDX"],
            ["Deployment", "Vercel (serverless, edge runtime)"],
          ],
          [30, 70],
        ),
      ],
    },

    /* ══════════════════ 14. INFRASTRUCTURE ══════════════════ */
    {
      children: [
        h1("14. Infrastructure & Deployment"),
        p(t("")),
        h3("Vercel Serverless Deployment"),
        bullet("54 cron jobs staggered across the day (3 AM\u201311 PM UTC) to distribute load"),
        bullet("Heavy crons: maxDuration 300s (ATTAINS, WQP, ICIS, SDWIS, Sentinel)"),
        bullet("Light crons: maxDuration 120s (NDBC, USDM, GLERL, etc.)"),
        bullet("Build locks with 12-minute auto-clear prevent stuck rebuilds"),
        bullet("Empty-data guards skip cache writes when 0 records fetched (preserves last-good data)"),
        p(t("")),
        h3("Cache Persistence Architecture"),
        bulletBold("Tier 1 \u2014 Local Disk: ", ".cache/ directory; fastest access; instance-local; lost on cold start"),
        bulletBold("Tier 2 \u2014 Vercel Blob: ", "Shared across all instances; raw REST API (no SDK); survives cold starts"),
        bulletBold("Warm-up: ", "ensureWarmed() on each cache tries disk first, falls back to Blob if empty"),
        bulletBold("Write policy: ", "All set*Cache() functions are async; must await saveCacheToBlob() before response returns"),
        p(t("")),
        h3("Monitoring & Observability"),
        bullet("Cron Health Dashboard: ring buffer tracking success rates, durations, failures for all 54 crons"),
        bullet("Cache Status endpoint: /api/cache-status reports freshness of all 49 caches"),
        bullet("Source Health checks: /api/source-health validates upstream API availability"),
        bullet("Sentry error tracking across client, server, and edge runtimes"),
        bullet("Vercel Speed Insights for Real User Monitoring (RUM)"),
        bullet("Slack webhook alerts for cron failures"),
      ],
    },

    /* ══════════════════ 15. MILESTONES ══════════════════ */
    {
      children: [
        h1("15. Recent Major Milestones"),
        p(t("")),
        h3("Evolution to Tri-Domain Platform"),
        bullet("PIN evolved from a water-quality monitoring dashboard into a global air, fire, and water threat intelligence platform"),
        bullet("Air domain originated from a direct request by a retired U.S. Air Force Colonel to protect soldiers abroad from air quality threats \u2014 built without waiting for contract authorization because the mission demanded it"),
        bullet("Fire domain: NASA FIRMS satellite integration with fire-to-watershed correlation followed naturally \u2014 fire degrades air AND water"),
        bullet("Cross-domain cascade detection: fire \u2192 air \u2192 water impact chains tracked end-to-end"),
        bullet("Sentinel pipeline upgraded to treat fire and air quality as first-class threat adapters alongside water contamination"),
        bullet("The architecture proved extensible enough to add two new threat domains without rebuilding the core pipeline"),
        p(t("")),
        h3("Sentinel Threat Detection (DARPA-Evaluated)"),
        bullet("Built complete 6-phase threat detection pipeline with 12 adapters"),
        bullet("Achieved perfect precision/recall (F1=1.0) across 6 DARPA scenarios"),
        bullet("Added NWSS correlation for wastewater-to-downstream threat linkage"),
        bullet("Coordination detection for multi-site attack identification"),
        p(t("")),
        h3("Fire & Air Quality Lens"),
        bullet("Integrated NASA FIRMS satellite fire detection (every 4 hours)"),
        bullet("Real-time AQI monitoring (every 30 minutes)"),
        bullet("Fire-water quality correlation analysis"),
        bullet("Military-gated sub-lens for Federal role"),
        p(t("")),
        h3("Expanded Data Sources (49 Cache Modules)"),
        bullet("Added NASA CMR, ERDDAP satellite, SNOTEL, HABSOS, GLERL, HEFS, USACE"),
        bullet("Added funding sources: Grants.gov, SAM.gov, USASpending.gov, Data.gov"),
        bullet("Added USFWS IPaC (endangered species & critical habitat)"),
        bullet("Added SSO/CSO sewer overflow monitoring"),
        p(t("")),
        h3("Sidebar-Driven Lens Redesign"),
        bullet("Lenses promoted to top-level sidebar items for single-role users"),
        bullet("Completed for Federal role; State, MS4, and all other roles in progress"),
        bullet("All sections draggable via LayoutEditor with per-role defaults"),
        p(t("")),
        h3("Security Hardening"),
        bullet("Full NIST 800-53 Rev 5 control mapping documented"),
        bullet("Added Semgrep SAST (daily + CI), npm audit (daily), CycloneDX SBOM"),
        bullet("CSRF double-submit cookie pattern in middleware"),
        bullet("Nonce-based Content Security Policy"),
        bullet("Secrets rotation documentation and procedures"),
        p(t("")),
        h3("Data Confidence & Methodology"),
        bullet("Data provenance audit dashboard at /dashboard/data-provenance"),
        bullet("Source lineage tracking for all displayed data"),
        bullet("Methodology page at /methodology for public transparency"),
      ],
    },

    /* ══════════════════ 16. ROADMAP ══════════════════ */
    {
      children: [
        h1("16. Roadmap & Future Direction"),
        p(t("")),
        h3("Near-Term"),
        bullet("Complete sidebar-driven lens redesign for all remaining roles (State, MS4, Local, K-12, ESG, University, NGO, etc.)"),
        bullet("K-12 role: Add 'Games' to sidebar lens items"),
        bullet("Expand state portal adapters beyond Maryland (MDE) and California (CEDEN)"),
        p(t("")),
        h3("Medium-Term"),
        bullet("Esri ArcGIS integration for advanced spatial analysis and mapping"),
        bullet("Additional satellite data sources (Landsat, Sentinel-2 imagery)"),
        bullet("Enhanced ML models for predictive water quality forecasting"),
        bullet("Mobile-responsive dashboard optimization"),
        bullet("Public-facing water quality report cards"),
        p(t("")),
        h3("Long-Term Vision"),
        bullet("Global real-time air, fire, and water threat intelligence network \u2014 every watershed, every airspace, every fire zone"),
        bullet("Cross-agency coordination platform for federal, state, and local environmental threat managers"),
        bullet("Climate adaptation planning tools with multi-domain scenario modeling"),
        bullet("International expansion: partner with allied nations for shared environmental threat intelligence"),
        bullet("Fourth domain exploration: soil/land contamination monitoring and subsurface threat detection"),
        p(t("")),
        p(t("")),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [
          new TextRun({ text: "\u2014 End of Briefing \u2014", size: 22, italics: true, color: "888888" }),
        ]}),
      ],
    },
  ],
});

/* ── write ────────────────────────────────────────────────── */
const buffer = await Packer.toBuffer(doc);
const outPath = "C:\\Users\\Doug\\Downloads\\PIN-Master-Briefing-March-2026.docx";
writeFileSync(outPath, buffer);
console.log("Written: " + outPath);
