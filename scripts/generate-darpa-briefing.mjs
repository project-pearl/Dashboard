/**
 * Generate DARPA-Aligned Briefing DOCX — PIN Sentinel
 * Focused on BAA HR001126S0003 / Michael Feasel
 * Run: node scripts/generate-darpa-briefing.mjs
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, TableRow, TableCell, Table, WidthType,
  ShadingType,
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
  creator: "Local Seafood Projects Inc. (PIN)",
  title: "PIN Sentinel — DARPA BTO Briefing",
  description: "Technical briefing aligned to BAA HR001126S0003",
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
          new TextRun({ text: "PIN SENTINEL", bold: true, size: 56, font: "Calibri", color: "1B3A5C" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
          new TextRun({ text: "Multi-Source Threat Detection", size: 32, font: "Calibri", color: "4A90D9" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new TextRun({ text: "for Water Security & Force Protection", size: 32, font: "Calibri", color: "4A90D9" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [
          new TextRun({ text: "Technical Briefing \u2014 BAA HR001126S0003", size: 24, font: "Calibri", italics: true, color: "666666" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
          t("March 2026", { size: 24 }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
          t("CONFIDENTIAL", { size: 20, bold: true, color: "CC0000" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [
          t("Local Seafood Projects Inc. (PIN)", { size: 22 }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
          t("Technical POC: Douglas Hood  |  doug@pinwater.org", { size: 20, color: "555555" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
          t("Abstract submitted per BAA HR001126S0003 Attachment A", { size: 18, italics: true, color: "888888" }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [
          t("SAM.gov Active  |  NAICS 541714  |  OT-P Accelerated Award Option (<$2M)", { size: 18, color: "888888" }),
        ]}),
      ],
    },

    /* ══════════════════ 1. EXECUTIVE SUMMARY ══════════════════ */
    {
      children: [
        h1("1. Executive Summary"),
        p(
          t("PIN Sentinel is a "),
          bold("real-time, multi-source threat detection and classification system"),
          t(" for water security and military force protection. It fuses anomaly signals from "),
          bold("12 data adapters"),
          t(" at "),
          bold("5-minute resolution"),
          t(", scores HUC-8 watersheds using compound pattern recognition with multipliers up to 3.5\u00D7, detects coordinated multi-site events via HUC-6/8 spatial clustering, and classifies incidents as attack vs. benign with "),
          bold("perfect precision and recall (F1 = 1.0)"),
          t(" across 6 validated scenarios."),
        ),
        p(t("")),
        p(
          t("The system was built to address BAA HR001126S0003 topic areas in "),
          bold("Security, Safety & Surveillance"),
          t(" (primary), "),
          bold("Machine Learning & AI"),
          t(" (secondary), and "),
          bold("Agricultural & Environmental"),
          t(" (tertiary). Since submitting our abstract, PIN has been extended with two new threat domains \u2014 "),
          bold("air quality and wildfire"),
          t(" \u2014 at the direct request of a retired U.S. Air Force Colonel seeking to protect deployed service members. These additions demonstrate the architectural extensibility described in our original proposal and strengthen the force protection mission."),
        ),
        p(t("")),
        h3("Key Metrics"),
        simpleTable(
          ["Metric", "Value"],
          [
            ["Detection resolution", "5 minutes (200,000\u00D7 vs. EPA 2\u20135 year cycle)"],
            ["Source adapters", "12 (water) + 2 new (fire, air) = 14 total"],
            ["Compound threat patterns", "11 named configurations, 1.5\u20133.5\u00D7 multipliers"],
            ["Spatial coverage", "All 50 states + DC, 565,000 EPA assessment units"],
            ["Validated scenarios", "6/6 passed"],
            ["Precision / Recall / F1", "1.0 / 1.0 / 1.0"],
            ["Mean detection latency", "2 ms"],
            ["Codebase", "193,000+ lines production TypeScript"],
            ["Award requested", "OT-P Accelerated (<$2M, 30-day award)"],
          ],
          [50, 50],
        ),
      ],
    },

    /* ══════════════════ 2. BAA ALIGNMENT ══════════════════ */
    {
      children: [
        h1("2. BAA Topic Alignment (Since Abstract)"),
        p(
          t("Our abstract addressed three topic areas from HR001126S0003. Below is a status update on each alignment claim, reflecting work completed since submission."),
        ),
        p(t("")),
        h3("Primary: Security, Safety & Surveillance"),
        p(
          italic("\"Developing ML, AI approaches, and advanced data analytics for the rapid analysis, interpretation, identification, attribution, origin tracing, of large-scale, disparate biological and environmental surveillance data streams...\""),
        ),
        p(t("")),
        p(
          bold("Status: Strengthened. "),
          t("At abstract submission, Sentinel fused 11 source adapters across water quality data. The system now fuses "),
          bold("14 adapters spanning three threat domains"),
          t(" (water, air, fire). The same Welford/EWMA baseline, BED probability accumulation, and compound pattern scoring architecture described in the abstract now processes fire detection signals (NASA FIRMS VIIRS/MODIS satellite, every 4 hours) and air quality data (AQI monitoring stations, every 30 minutes) alongside the original water quality pipeline. No architectural changes were required \u2014 two new adapter modules were added to the existing ingest framework."),
        ),
        p(t("")),
        p(
          italic("\"Developing novel sensing, surveillance, and processing technologies (including in-situ and remote modalities) to detect, identify, monitor, and analyze weak biological signals...\""),
        ),
        p(t("")),
        p(
          bold("Status: Extended to remote sensing. "),
          t("The abstract described field-grade multi-parameter sondes for in-situ monitoring at DoD-adjacent sites. PIN now also ingests "),
          bold("NASA FIRMS satellite remote sensing"),
          t(" for fire detection and correlates active fire hotspots with downstream water infrastructure \u2014 adding a remote sensing modality to complement the in-situ sonde capability."),
        ),
        p(t("")),
        p(
          italic("\"...enabling source attribution across watershed networks.\""),
        ),
        p(t("")),
        p(
          bold("Status: Unchanged. "),
          t("HUC-8 spatial correlation engine with flow-time lag detection remains the core attribution mechanism. Back-validated against the Potomac Interceptor infrastructure failure event as described in the abstract."),
        ),
        p(t("")),
        h3("Secondary: Machine Learning & AI"),
        p(
          italic("\"Developing ML and AI-enabled technologies to improve the accuracy, precision, and efficiency of warfighter decision-making...including for real-time threat assessment and response planning.\""),
        ),
        p(t("")),
        p(
          bold("Status: Strengthened. "),
          t("The role-contextualized AI query layer now covers additional force protection scenarios. AI-generated Response Plans (as demonstrated in the Patuxent River scenario in our abstract) now incorporate "),
          bold("cross-domain threat intelligence"),
          t(" \u2014 a response plan triggered by a water anomaly now includes air quality conditions and nearby fire activity in its situational awareness package. The AI layer uses OpenAI gpt-4o-mini for natural-language threat summaries calibrated to the operator's role (commander, DPW staff, water operator, DoD PM, AEC analyst)."),
        ),
        p(t("")),
        h3("Tertiary: Agricultural & Environmental"),
        p(
          italic("\"Understanding and addressing emerging threats to global food, water, and ecosystem stability...\""),
        ),
        p(t("")),
        p(
          bold("Status: Significantly expanded. "),
          t("PIN now monitors 14 proprietary composite indices across water, air, and fire domains. The addition of wildfire monitoring directly addresses ecosystem stability \u2014 fires are among the largest drivers of watershed degradation, sediment loading, and downstream contamination. The platform tracks fire-to-water cascade effects (ash runoff \u2192 turbidity spikes \u2192 water quality degradation) as quantified threat chains."),
        ),
      ],
    },

    /* ══════════════════ 3. WHY AIR & FIRE ══════════════════ */
    {
      children: [
        h1("3. Post-Abstract Expansion: Air & Fire Domains"),
        p(
          t("Since submitting the abstract, PIN has been extended from a water-only threat detection system to a "),
          bold("tri-domain platform covering water, air, and fire"),
          t(". This section explains why, how, and what it means for the BAA mission."),
        ),
        p(t("")),
        h3("The Origin: An Operator Asked"),
        p(
          t("A "),
          bold("retired U.S. Air Force Colonel"),
          t(" contacted the PIN team with a specific operational requirement: protect deployed service members from air quality threats at overseas installations. The need was immediate. PIN did not wait for a contract, a formal requirement document, or permission. The team saw a force protection gap and built the capability."),
        ),
        p(t("")),
        p(
          t("This is how PIN operates. The water security system you evaluated in our abstract was also built this way \u2014 driven by operator need, not by committee. The air quality expansion validates a key claim from our proposal: "),
          bold("the architecture is extensible"),
          t(". Adding a new threat domain required writing one new adapter module and one new cache module. The entire Sentinel scoring pipeline, coordination detection, classification engine, and alert dispatch system worked without modification."),
        ),
        p(t("")),
        h3("Why Fire Followed Naturally"),
        p(t("Once air quality was in the pipeline, fire was the obvious next step. The three domains are physically connected:")),
        p(t("")),
        bullet("Wildfire degrades air quality (smoke, particulates) \u2014 direct threat to personnel"),
        bullet("Wildfire deposits ash into watersheds \u2014 sediment loading, turbidity spikes, contamination"),
        bullet("Drought (already tracked in water domain) raises fire risk \u2014 predictive linkage"),
        bullet("Fire near water infrastructure (treatment plants, intake points) is a force protection concern"),
        p(t("")),
        p(
          t("PIN now ingests "),
          bold("NASA FIRMS satellite data"),
          t(" (VIIRS and MODIS sensors) every 4 hours and correlates active fire detections with downstream watersheds and proximate water infrastructure. Fire is a first-class adapter in the Sentinel pipeline."),
        ),
        p(t("")),
        h3("What This Means for the BAA Mission"),
        p(t("The tri-domain expansion strengthens \u2014 not dilutes \u2014 the BAA alignment:")),
        p(t("")),
        bulletBold("More surveillance data streams: ", "The BAA asks for \"rapid analysis of large-scale, disparate biological and environmental surveillance data streams.\" PIN now fuses 14 adapters across 3 domains, not 11 from 1 domain."),
        bulletBold("Remote sensing modality: ", "The BAA asks for \"including in-situ and remote modalities.\" NASA FIRMS is a satellite remote sensing source \u2014 adding a modality the original abstract referenced only for future work."),
        bulletBold("Cross-domain cascade detection: ", "Fire \u2192 air \u2192 water impact chains are exactly the kind of \"secondary effects on the environment\" the BAA's biological threat language targets."),
        bulletBold("Operational validation: ", "A real Air Force officer identified a real gap. PIN filled it. This is the kind of \"warfighter decision-making\" outcome the BAA's ML/AI topic area describes."),
      ],
    },

    /* ══════════════════ 4. SENTINEL ARCHITECTURE ══════════════════ */
    {
      children: [
        h1("4. Sentinel Detection Pipeline"),
        p(
          t("The Sentinel pipeline architecture is unchanged from the abstract. All 6 phases operate as described. The adapter count has grown from 11 to 14 with the addition of FIRMS Fire, Air Quality, and HAB adapters."),
        ),
        p(t("")),
        h3("Phase 1 \u2014 Ingest (every 5 min)"),
        bullet("14 adapters read from caches and live APIs"),
        bullet("Push ChangeEvent records into a 48-hour rolling queue"),
        bullet("Water adapters: USGS NWIS-IV, NWS Alerts, NWPS Flood, ATTAINS, CDC NWSS, ECHO, BEACON Beach, SSO/CSO, CO-OPS Tidal, HAB"),
        bullet("Fire adapter: NASA FIRMS (VIIRS + MODIS satellite, every 4 hours)"),
        bullet("Air adapter: AQI monitoring stations (every 30 minutes)"),
        p(t("")),
        h3("Phase 2 \u2014 Scoring (every 5 min)"),
        p(t("Per-station, per-parameter scoring using the pipeline described in the abstract:")),
        p(t("")),
        bulletBold("Baseline: ", "Welford online algorithm (warmup) \u2192 EWMA adaptive update (2,880-sample window, ~30 days at 15-min cadence)"),
        bulletBold("Z-Score: ", "z = (value \u2212 \u03BC) / \u03C3 per-parameter per-station"),
        bulletBold("BED Probability: ", "P(event) = 1 \u2212 (1 \u2212 min(p, 0.999))^streak"),
        bulletBold("Compound Score: ", "score = rawTotal \u00D7 max(patternMultiplier), final 0\u20131"),
        p(t("")),
        h3("11 Named Compound Patterns"),
        simpleTable(
          ["Pattern ID", "Source Combination", "Multiplier"],
          [
            ["bio-threat-correlation", "CDC NWSS + USGS IV / SSO-CSO / NPDES", "3.5\u00D7"],
            ["potomac-crisis", "Multi-source Potomac watershed", "3.0\u00D7"],
            ["spreading-contamination", "USGS IV multi-HUC + NPDES", "2.8\u00D7"],
            ["predicted-infrastructure-failure", "ATTAINS + USGS IV + DMR", "2.5\u00D7"],
            ["hab-wq-correlation", "HAB alert + USGS IV parameters", "2.5\u00D7"],
            ["infrastructure-stress", "NPDES DMR + USGS IV", "2.2\u00D7"],
            ["flood-prediction-cascade", "NOAA NWS + USGS IV surge", "2.2\u00D7"],
            ["regulatory-escalation", "ATTAINS 303d + DMR violations", "2.0\u00D7"],
            ["beach-pathogen-wq", "Beach closure + USGS IV pathogens", "2.0\u00D7"],
            ["airborne-public-health", "CDC + USGS + wastewater", "1.8\u00D7"],
            ["enforcement-cascade", "Multi-permit DMR pattern", "1.5\u00D7"],
          ],
          [30, 48, 22],
        ),
        p(t("")),
        h3("Phase 3 \u2014 Coordination Detection"),
        bullet("HUC-6 spatial clustering \u2192 HUC-8 adjacency expansion"),
        bullet("Temporal tightness scoring weights cluster size, parameter breadth, and co-occurrence"),
        bullet("Coordination score > 0.6 triggers CRITICAL alert"),
        bullet("Designed to detect coordinated multi-site attacks on water infrastructure"),
        p(t("")),
        h3("Phase 4 \u2014 Classification"),
        bullet("Confounder-aware: rainfall, flood, seasonal, covariance reduce scores"),
        bullet("Attack signals: CHEMICAL_DUMP, BIO_MARKER_SPIKE boost scores"),
        bullet("likely_attack (>0.7) / possible_attack (0.4\u20130.7) / likely_benign (<0.4)"),
        bullet("Back-validated against historical Potomac Interceptor failure event"),
        p(t("")),
        h3("Phase 5 \u2014 NWSS Wastewater-to-WQ Correlation"),
        bullet("Links CDC NWSS wastewater pathogen spikes to downstream water quality anomalies"),
        bullet("72-hour correlation window accounts for flow time and processing delay"),
        bullet("Directly addresses BAA language on \"emerging pathogens\" and \"secondary effects\""),
        p(t("")),
        h3("Phase 6 \u2014 Alert Dispatch (offset +2 min)"),
        bullet("13 trigger types evaluate every 5 minutes"),
        bullet("Email (Resend) and Slack webhook dispatch"),
        bullet("Per-site throttling prevents alert fatigue"),
        bullet("AI-generated response plans for CRITICAL events (role-contextualized)"),
      ],
    },

    /* ══════════════════ 5. CANARY COMPARISON ══════════════════ */
    {
      children: [
        h1("5. PIN Sentinel vs. EPA CANARY-EDS"),
        p(
          t("PIN extends EPA/Sandia CANARY-EDS from single-station event detection to "),
          bold("multi-source, multi-site, network-scale threat intelligence"),
          t(". The following comparison reflects the system's current state:"),
        ),
        p(t("")),
        simpleTable(
          ["Capability", "CANARY-EDS", "PIN Sentinel"],
          [
            ["Baseline algorithm", "MVNN / BED", "Welford + EWMA + BED"],
            ["Adaptive baseline", "Static window", "Continuous EWMA drift tracking"],
            ["Multi-site correlation", "Single station only", "HUC-6/8 clustering + adjacency"],
            ["Cross-source fusion", "Water only", "14 adapters: water + fire + air"],
            ["Named threat patterns", "None", "11 configs, 1.5\u20133.5\u00D7 multipliers"],
            ["Wastewater-WQ fusion", "None", "CDC NWSS + USGS IV (72h window)"],
            ["Fire detection", "None", "NASA FIRMS VIIRS/MODIS satellite"],
            ["Air quality monitoring", "None", "Real-time AQI (30-min cadence)"],
            ["Coordination detection", "None", "HUC-6 spatial clustering"],
            ["Attack classification", "None", "Confounder-aware, rule-based"],
            ["Adaptive model learning", "None", "EWMA continuous baseline update"],
            ["AI response plans", "None", "Role-contextualized, installation-specific"],
            ["Open source", "LGPL/Apache", "Proprietary"],
          ],
          [25, 30, 45],
        ),
        p(t("")),
        p(
          italic("CANARY-EDS comparison based on published EPA/Sandia documentation (Klise et al. 2008; Hart et al. 2007). PIN extends CANARY's single-station BED logic to multi-source, multi-site, multi-domain, network-scale detection."),
        ),
      ],
    },

    /* ══════════════════ 6. PATUXENT SCENARIO ══════════════════ */
    {
      children: [
        h1("6. Force Protection Scenario: Patuxent River"),
        p(
          t("The following scenario was included in our abstract submission (Technical Paper 2 of 3). It demonstrates PIN Sentinel's end-to-end detection, classification, and response planning for a coordinated water infrastructure attack affecting military installations."),
        ),
        p(t("")),
        h3("Detection"),
        simpleTable(
          ["Parameter", "Value"],
          [
            ["PIN detection time", "04:33 EST"],
            ["Anomaly score", "0.94 / 1.00"],
            ["Correlated sites", "3 HUC-8 (Patuxent watershed)"],
            ["Classification", "CRITICAL \u2014 COORDINATED EVENT"],
          ],
          [35, 65],
        ),
        p(t("")),
        h3("Parameters Triggered"),
        bullet("Conductivity +340% | Turbidity +280% | ORP \u221252% | Temp +8.4\u00B0C | DO \u221238%"),
        bullet("Simultaneous multi-site spike, HUC-8 adjacency correlated"),
        bullet("Weather confounders ruled out: <0.02\" precipitation, wind NW 6 mph"),
        p(t("")),
        h3("Installations at Risk"),
        bulletBold("NAS Patuxent River: ", "Primary intake from Patuxent River \u2014 plume ETA 6h 20min"),
        bulletBold("Fort Meade: ", "Supplemental supply from same watershed"),
        bulletBold("USNA Annapolis: ", "Bay intake \u2014 lower risk (180:1 dilution) but tidal reversal window 07:15\u201309:45 EST"),
        bulletBold("Personnel exposure: ", "12,400 across three installations"),
        p(t("")),
        h3("AI-Generated Commander Action Plan"),
        p(bold("Immediate (0\u201330 min):")),
        bullet("Activate emergency water shutoff at NAS Patuxent River intake"),
        bullet("Notify Installation Emergency Management, Medical, and Public Works"),
        bullet("Initiate bottled water protocol for all 12,400 personnel"),
        bullet("Contact CISA Water Sector (888-282-0870) and NRC Operations Center (301-816-5100)"),
        p(t("")),
        p(bold("Short-term (30 min\u20133 hrs):")),
        bullet("Activate alternate water supply from pre-positioned reserves"),
        bullet("Coordinate with MD Emergency Management Agency (MEMA)"),
        bullet("Request Army Environmental Command rapid response team"),
        bullet("Issue Force Protection WARNORD \u2014 restrict to confirmed-safe sources"),
        p(t("")),
        p(bold("Sustained (3\u201372 hrs):")),
        bullet("Sentinel provides automated 5-min plume updates \u2014 no manual monitoring required"),
        bullet("Do not restore Patuxent intake until NOMINAL across all 3 HUC-8 sites for 48 continuous hours"),
        bullet("Submit DoD Water Security Incident Report to AEC within 24 hours"),
        p(t("")),
        p(
          bold("PIN detected this event through water quality data alone \u2014 "),
          t("no external intelligence feed was required. External confirmation (Calvert Cliffs nuclear plant cyber intrusion) arrived ~13 minutes after PIN's independent alert."),
        ),
      ],
    },

    /* ══════════════════ 7. VALIDATION ══════════════════ */
    {
      children: [
        h1("7. Validation Results"),
        p(t("")),
        simpleTable(
          ["Metric", "Value"],
          [
            ["Scenarios tested", "6 / 6 passed"],
            ["Precision", "1.0"],
            ["Recall", "1.0"],
            ["F1 Score", "1.0"],
            ["Mean detection latency", "2 ms"],
            ["Back-validation event", "Potomac Interceptor infrastructure failure"],
            ["Spatial coverage", "All 50 states + DC"],
            ["EPA assessment units covered", "565,000"],
            ["Datapoints fused", "430M+"],
          ],
          [45, 55],
        ),
      ],
    },

    /* ══════════════════ 8. SUPPORTING INFRASTRUCTURE ══════════════════ */
    {
      children: [
        h1("8. Supporting Infrastructure"),
        p(
          t("Sentinel does not operate in isolation. It is the threat-detection core of a broader platform that provides the data pipeline, caching, persistence, and operator interface. Key supporting capabilities:"),
        ),
        p(t("")),
        h3("Data Pipeline"),
        bulletBold("54 automated cron jobs ", "on staggered schedules (3 AM\u201311 PM UTC)"),
        bulletBold("49 cache modules ", "with grid-based spatial indexing at 0.1\u00B0 (~11 km) resolution"),
        bulletBold("Two-tier persistence: ", "local disk + Vercel Blob for cold-start survival"),
        bulletBold("Build locks: ", "12-minute auto-clear prevents stuck rebuilds"),
        bulletBold("Empty-data guards: ", "skip writes on 0 records to preserve last-good data"),
        p(t("")),
        h3("Operator Interface"),
        bulletBold("16 role-based dashboards: ", "Each role sees only the intelligence relevant to their function"),
        bulletBold("Military-specific views: ", "Federal dashboard with isMilitary sub-type for installation commanders"),
        bulletBold("230+ lens views: ", "Sidebar-driven navigation tailored to each role"),
        bulletBold("AI briefings: ", "Role-contextualized, generated every 6 hours; urgent briefings every 2 hours"),
        bulletBold("AskPIN chatbot: ", "Natural-language Q&A embedded in every dashboard"),
        p(t("")),
        h3("Security Posture"),
        bulletBold("NIST 800-53 Rev 5: ", "Full control mapping documented"),
        bulletBold("Authentication: ", "Supabase Auth with JWT; 16-role RBAC with 3-tier admin levels"),
        bulletBold("CSRF / CSP: ", "Double-submit cookie pattern; nonce-based Content Security Policy"),
        bulletBold("SAST / SBOM: ", "Semgrep (daily + CI), npm audit (daily), CycloneDX SBOM"),
        bulletBold("Incident response: ", "Documented procedures; Sentry error tracking (client + server + edge)"),
        p(t("")),
        h3("Technology Stack"),
        simpleTable(
          ["Layer", "Technology"],
          [
            ["Framework", "Next.js 15 (App Router), TypeScript 5.2"],
            ["Detection engine", "Custom Sentinel pipeline (TypeScript, 193K+ LOC)"],
            ["AI / LLM", "OpenAI gpt-4o-mini (direct REST)"],
            ["Database", "Supabase (PostgreSQL)"],
            ["Maps", "Mapbox GL JS 3.x"],
            ["Cache persistence", "Vercel Blob (cross-instance) + local disk"],
            ["Deployment", "Vercel (serverless)"],
            ["Monitoring", "Sentry + Slack webhooks + Cron Health Dashboard"],
          ],
          [25, 75],
        ),
      ],
    },

    /* ══════════════════ 9. WHAT WE'RE ASKING FOR ══════════════════ */
    {
      children: [
        h1("9. Award Request & Next Steps"),
        p(t("")),
        simpleTable(
          ["Item", "Detail"],
          [
            ["Award mechanism", "OT-P \u2014 Accelerated Award Option"],
            ["Award amount", "<$2M"],
            ["Award timeline", "30-day award"],
            ["SAM.gov", "Active"],
            ["NAICS", "541714"],
            ["Entity", "Local Seafood Projects Inc. (PIN)"],
            ["Technical POC", "Douglas Hood, doug@pinwater.org"],
            ["Other submissions", "Not submitted to any other solicitation"],
          ],
          [30, 70],
        ),
        p(t("")),
        h3("What Has Changed Since Abstract Submission"),
        p(t("")),
        simpleTable(
          ["Capability", "At Abstract", "Current"],
          [
            ["Threat domains", "Water only", "Water + Fire + Air"],
            ["Source adapters", "11", "14"],
            ["Compound patterns", "11", "11 (unchanged)"],
            ["Remote sensing", "Described as future", "NASA FIRMS operational"],
            ["Validation", "6/6, F1=1.0", "6/6, F1=1.0 (unchanged)"],
            ["Operator demand signal", "Internal development", "retired AF Colonel requested air quality for force protection abroad"],
            ["Architecture extensibility", "Claimed", "Demonstrated \u2014 2 new domains, 0 core changes"],
            ["LOC", "193,000+", "Growing \u2014 production system under active development"],
          ],
          [28, 32, 40],
        ),
        p(t("")),
        h3("Context: How This Was Built"),
        p(
          t("PIN Sentinel was built by "),
          bold("one person in a basement in Hampstead, Maryland"),
          t(". 193,000+ lines of production TypeScript. 14 live data adapters. 54 automated cron jobs. 49 cache modules. 16 role-based dashboards. F1=1.0 across 6 validated scenarios. A retired Air Force Colonel reached out about force protection \u2014 the air quality domain was built and deployed within weeks."),
        ),
        p(t("")),
        p(
          t("That is what the prototype phase produced. But a prototype built by one person in a basement is not the same as a system ready for DoD deployment. The detection engine works. The math is proven. The pipeline runs in production 24/7. What it needs now is:"),
        ),
        p(t("")),
        bullet("A support staff to maintain, monitor, and extend the system"),
        bullet("Engineering polish before hardening \u2014 the kind of fit-and-finish that one developer skips when shipping at speed"),
        bullet("Physical sensors in the water, proving the full loop from field to Sentinel to commander alert"),
        bullet("Sprint staffing to complete the BAA deliverables on a 30-day timeline"),
        p(t("")),
        h3("Budget & Milestone Schedule \u2014 60 Days to Fielded Capability"),
        p(
          t("This is not a research grant. It is a "),
          bold("transition sprint"),
          t(" to take a proven, one-person prototype to a staffed, polished, sensor-equipped, field-validated system. Total period of performance: "),
          bold("60 days, 4 milestones, <$2M"),
          t("."),
        ),
        p(t("")),

        h2("Milestone 1 \u2014 Sprint Team Standup & Platform Polish"),
        p(bold("Weeks 1\u20132  |  $480,000  |  Payment on completion")),
        p(t("")),
        simpleTable(
          ["Line Item", "Cost", "Detail"],
          [
            ["Sprint team recruitment & onboarding", "$180,000", "3 engineers (full-stack, DevOps, QA) \u00D7 2 months. Hired as contractors for the sprint window."],
            ["Platform polish & hardening", "$160,000", "Test coverage expansion, CI/CD pipeline hardening, documentation, operational runbooks, code review of 193K LOC for deployment readiness."],
            ["Infrastructure & tooling", "$80,000", "Staging environment, DoD-aligned cloud infrastructure, monitoring upgrades, security scanning toolchain."],
            ["Project management & coordination", "$60,000", "Sprint planning, DARPA reporting, milestone tracking, vendor coordination for sonde procurement."],
          ],
          [30, 12, 58],
        ),
        p(t("")),
        p(bold("Deliverables:")),
        bullet("Sprint team operational and onboarded to the codebase"),
        bullet("Platform polish complete: test coverage >90%, CI/CD hardened, operational runbooks written"),
        bullet("Staging environment deployed on DoD-aligned infrastructure"),
        bullet("Sonde hardware procurement initiated (long-lead item)"),
        p(t("")),

        h2("Milestone 2 \u2014 Sonde Adapter & Flow Routing"),
        p(bold("Weeks 3\u20134  |  $390,000  |  Payment on completion")),
        p(t("")),
        simpleTable(
          ["Line Item", "Cost", "Detail"],
          [
            ["Sonde-to-Sentinel adapter development", "$120,000", "Real-time telemetry ingestion module: sonde data \u2192 Sentinel ChangeEvent \u2192 scoring pipeline. New adapter joins the existing 14."],
            ["Flow-time velocity routing upgrade", "$110,000", "Replace HUC-8 adjacency-based plume routing with live USGS gauge flow-velocity calculations. Improves ETA from hours-level to minutes-level."],
            ["Sonde hardware procurement", "$100,000", "6\u20138 multi-parameter sondes (DO, pH, turbidity, conductivity, ORP, temperature). YSI EXO2 or equivalent field-grade units."],
            ["Sprint team labor (weeks 3\u20134)", "$60,000", "Continued engineering sprint: adapter integration, flow routing, integration testing."],
          ],
          [30, 12, 58],
        ),
        p(t("")),
        p(bold("Deliverables:")),
        bullet("Sonde adapter operational in Sentinel pipeline (tested against simulated telemetry)"),
        bullet("Flow-time velocity routing live with real USGS gauge data"),
        bullet("Sonde hardware received, bench-tested, and calibrated"),
        bullet("Integration test: simulated sonde data \u2192 Sentinel score \u2192 classification \u2192 alert"),
        p(t("")),

        h2("Milestone 3 \u2014 Field Deployment & Sensor Validation"),
        p(bold("Weeks 5\u20137  |  $580,000  |  Payment on completion")),
        p(t("")),
        simpleTable(
          ["Line Item", "Cost", "Detail"],
          [
            ["Site selection & permitting", "$60,000", "Coordinate with DoD installation DPW for site access. Select 2\u20133 DoD-adjacent monitoring locations (priority: Patuxent River watershed)."],
            ["Sonde deployment & telemetry", "$140,000", "Physical installation, cellular/satellite telemetry setup, power (solar/battery), weatherproofing, anti-tamper enclosures."],
            ["End-to-end field validation", "$120,000", "Controlled test events at deployed sites. Validate: sonde detects anomaly \u2192 telemetry transmits \u2192 Sentinel scores \u2192 classification runs \u2192 commander alert dispatches."],
            ["DoD protocol refinement", "$80,000", "Refine AI response plans for DoD-specific protocols, installation types, chain-of-command notification procedures."],
            ["Sprint team labor (weeks 5\u20137)", "$120,000", "Field deployment support, telemetry debugging, Sentinel adapter tuning, validation test execution."],
            ["Travel & field operations", "$60,000", "Travel to deployment sites, field technician support, equipment transport."],
          ],
          [30, 12, 58],
        ),
        p(t("")),
        p(bold("Deliverables:")),
        bullet("6\u20138 sondes physically deployed and reporting real-time data to Sentinel"),
        bullet("End-to-end validation complete: field sensor \u2192 threat score \u2192 commander alert"),
        bullet("AI response plans refined for DoD installation protocols"),
        bullet("Validation report documenting detection accuracy, latency, and false-positive rate from live field data"),
        p(t("")),

        h2("Milestone 4 \u2014 Final Validation, Documentation & Transition"),
        p(bold("Week 8  |  $440,000  |  Payment on completion")),
        p(t("")),
        simpleTable(
          ["Line Item", "Cost", "Detail"],
          [
            ["Extended field validation", "$100,000", "7-day continuous monitoring period. Document system performance under real-world conditions: weather, diurnal cycles, upstream activity."],
            ["DoD hardening assessment", "$80,000", "IL-4/IL-5 gap analysis, ATO documentation package, security control mapping (NIST 800-53 already documented)."],
            ["OCONUS air quality scoping", "$60,000", "Architecture design for extending AQI monitoring to overseas installations per retired AF Colonel's requirement. Deliverable: technical plan, not implementation."],
            ["Final documentation & reporting", "$80,000", "DARPA final report, system architecture documentation, operator manual, maintenance procedures, source code escrow."],
            ["Sprint team closeout & knowledge transfer", "$60,000", "Knowledge transfer to sustaining support team, documentation of all sprint-period changes, handoff procedures."],
            ["Contingency & materials reserve", "$60,000", "Replacement sondes, unexpected telemetry costs, additional field visits, unforeseen technical issues."],
          ],
          [30, 12, 58],
        ),
        p(t("")),
        p(bold("Deliverables:")),
        bullet("7-day continuous field validation report with performance metrics"),
        bullet("DoD hardening gap analysis and ATO documentation package"),
        bullet("OCONUS air quality extension technical plan"),
        bullet("Complete DARPA final report and system documentation"),
        bullet("All source code, documentation, and operational procedures delivered"),
        p(t("")),

        h3("Budget Summary"),
        simpleTable(
          ["Milestone", "Timeline", "Amount", "Cumulative"],
          [
            ["M1: Team Standup & Polish", "Weeks 1\u20132", "$480,000", "$480,000"],
            ["M2: Sonde Adapter & Flow Routing", "Weeks 3\u20134", "$390,000", "$870,000"],
            ["M3: Field Deployment & Validation", "Weeks 5\u20137", "$580,000", "$1,450,000"],
            ["M4: Final Validation & Transition", "Week 8", "$440,000", "$1,890,000"],
            ["TOTAL", "60 days", "$1,890,000", ""],
          ],
          [32, 18, 20, 20],
        ),
        p(t("")),
        p(
          bold("Note on cash flow: "),
          t("Milestone 1 includes sonde procurement initiation (long-lead item). We request that M1 payment be released promptly on completion to fund hardware acquisition before M2 begins. Sprint team labor costs are front-loaded by design \u2014 the team must be in place from day 1."),
        ),
        p(t("")),

        h3("What DARPA Gets at Day 60"),
        p(t("")),
        bullet("PIN Sentinel upgraded from solo prototype to team-supported, production-hardened system"),
        bullet("6\u20138 multi-parameter sondes deployed at DoD-adjacent sites, reporting live to Sentinel"),
        bullet("Proven end-to-end: physical sensor \u2192 anomaly detection \u2192 threat scoring \u2192 classification \u2192 commander alert"),
        bullet("Flow-time velocity routing operational with live USGS gauge data"),
        bullet("AI response plans calibrated to DoD installation protocols"),
        bullet("DoD hardening gap analysis and ATO package ready for next phase"),
        bullet("Technical plan for OCONUS air quality extension"),
        bullet("Complete documentation, source code escrow, and transition package"),
        p(t("")),
        p(
          bold("Bottom line: "),
          t("$1.89M over 60 days takes PIN Sentinel from a one-person proof-of-concept with F1=1.0 on federal API data to a "),
          bold("staffed, polished, sensor-equipped, field-validated system"),
          t(" with sondes in the water and commanders receiving alerts. The detection engine is built. This funding puts it in the field."),
        ),
        p(t("")),
        p(t("")),
        p(
          italic("Full proposal available upon DARPA invitation. All algorithms cited are implemented in production TypeScript codebase (193,000+ lines). This document reflects work completed through March 2026 by a single developer. Period of performance: 60 days from award."),
        ),
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
const outPath = "C:\\Users\\Doug\\Downloads\\PIN-Sentinel-DARPA-Briefing-March-2026.docx";
writeFileSync(outPath, buffer);
console.log("Written: " + outPath);
