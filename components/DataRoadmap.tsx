"use client";

import React, { useState } from "react";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */

interface Source {
  name: string;
  dataType: string;
  status: "live" | "offline" | "new" | "planned";
  records?: string;
  loe?: string;
  fix?: string;
}

interface Phase {
  id: string;
  number: string;
  title: string;
  timeline: string;
  targetSources: string;
  description: string;
  color: string;
  lightBg: string;
  sources: Source[];
}

/* ═══════════════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════════════ */

const STATUS_CONFIG = {
  live:    { label: "LIVE",    color: "#0E7C5F", bg: "#0E7C5F0A", border: "#0E7C5F40" },
  offline: { label: "OFFLINE", color: "#C4420A", bg: "#C4420A0A", border: "#C4420A40" },
  new:     { label: "NEW",     color: "#0A6E8A", bg: "#0A6E8A0A", border: "#0A6E8A40" },
  planned: { label: "PLANNED", color: "#6B5B95", bg: "#6B5B950A", border: "#6B5B9540" },
};

const phases: Phase[] = [
  {
    id: "current",
    number: "00",
    title: "Current State",
    timeline: "Today",
    targetSources: "29 Sources (15 Live)",
    description: "PIN connects to 29 data sources spanning USGS, EPA, NOAA, state portals, and regional programs. 15 are returning live data; 14 are offline due to endpoint errors, URL changes, or missing headers.",
    color: "#0A6E8A",
    lightBg: "#F0F8FB",
    sources: [
      { name: "USGS Real-Time (IV)", dataType: "Stream flow, gage height, DO, temp", status: "live", records: "~13,000 active sites" },
      { name: "USGS Daily Values", dataType: "Daily stats from continuous monitors", status: "live", records: "1.9M+ sites" },
      { name: "USGS Groundwater", dataType: "Well levels, aquifer data", status: "live", records: "850K+ sites" },
      { name: "EPA WQP", dataType: "Unified portal: 1,000+ orgs", status: "live", records: "430M+ records" },
      { name: "EPA ATTAINS", dataType: "Assessment units, impairments, TMDLs", status: "live", records: "565K units" },
      { name: "EPA SDWIS", dataType: "Drinking water systems, violations", status: "live", records: "150K systems" },
      { name: "NOAA CO-OPS", dataType: "Tidal stations, water level, temp", status: "live", records: "210+ stations" },
      { name: "Chesapeake Bay Program", dataType: "Bay monitoring, nutrients, DO", status: "live", records: "20M+ records" },
      { name: "Blue Water Baltimore", dataType: "Harbor bacteria, nutrients", status: "live", records: "Water Reporter API" },
      { name: "CA CEDEN", dataType: "California surface water monitoring", status: "live", records: "10K+ sites" },
      { name: "TX TCEQ", dataType: "Texas surface water quality", status: "live", records: "5M+ records" },
      { name: "EJScreen", dataType: "Environmental justice screening", status: "live", records: "Census tract level" },
      { name: "CBP DataHub", dataType: "Chesapeake watershed detail", status: "live", records: "Multiple endpoints" },
      { name: "ICIS-NPDES", dataType: "Discharge permits, violations", status: "offline", records: "400K+ permits", fix: "HTTP 404 — verify Envirofacts table names" },
      { name: "ICIS DMR", dataType: "Discharge monitoring measurements", status: "offline", records: "Monthly per permit", fix: "HTTP 404 — correct table name" },
      { name: "ECHO Facilities", dataType: "CWA compliance status", status: "offline", records: "Facility-level", fix: "HTTP 404 — fix URL params" },
      { name: "EPA FRS", dataType: "Facility locations, NPDES links", status: "offline", records: "All NPDES", fix: "HTTP 404 — verify table name" },
      { name: "PFAS / UCMR", dataType: "PFAS screening data", status: "offline", records: "National UCMR", fix: "HTTP 406 — add Accept header" },
      { name: "NPS Water Quality", dataType: "National Park monitoring", status: "offline", records: "11M results", fix: "HTTP 406 — add Accept header" },
      { name: "NY Open Data", dataType: "New York state WQ", status: "offline", fix: "HTTP 404 — find Socrata dataset ID" },
      { name: "NJ Open Data", dataType: "New Jersey state WQ", status: "offline", fix: "HTTP 404 — find Socrata dataset ID" },
      { name: "PA Open Data", dataType: "Pennsylvania state WQ", status: "offline", fix: "HTTP 404 — find Socrata dataset ID" },
      { name: "VA Open Data", dataType: "Virginia state WQ", status: "offline", fix: "HTTP 404 — find Socrata dataset ID" },
      { name: "MD DNR ERDDAP", dataType: "Maryland tidal continuous monitoring", status: "offline", fix: "HTTP 400 — fix tabledap query" },
      { name: "Monitor My Watershed", dataType: "Citizen science sensor network", status: "offline", fix: "HTTP 404 — verify API path" },
      { name: "FL DBHYDRO", dataType: "South Florida water management", status: "offline", records: "35M+ records", fix: "Fetch fail — add retry logic" },
      { name: "State Portal (generic)", dataType: "State-level discovery", status: "offline", fix: "Fetch fail — per-state URL config" },
      { name: "CDC NWSS", dataType: "Wastewater pathogen surveillance", status: "offline", fix: "Not wired — Socrata endpoint ready" },
      { name: "ICIS Enforcement", dataType: "Enforcement actions", status: "offline", fix: "Not wired — Envirofacts table" },
    ],
  },
  {
    id: "phase1",
    number: "01",
    title: "Fix Offline Sources",
    timeline: "Week 1\u20132",
    targetSources: "29/29 Online",
    description: "Every source already in the codebase returns live data. URL corrections, header fixes, endpoint verification. No new architecture needed. ~20 hours total LOE.",
    color: "#0E7C5F",
    lightBg: "#F0FAF4",
    sources: [
      { name: "ICIS-NPDES", dataType: "Discharge permits + violations", status: "offline", loe: "2 hrs", fix: "Verify Envirofacts table names at data.epa.gov/efservice/" },
      { name: "ICIS DMR", dataType: "Monthly discharge measurements", status: "offline", loe: "2 hrs", fix: "Correct table name, add state filter" },
      { name: "ECHO Facilities", dataType: "CWA compliance status", status: "offline", loe: "1 hr", fix: "Fix URL params for cwa_rest_services" },
      { name: "FRS WWTPs", dataType: "Treatment plant locations", status: "offline", loe: "1 hr", fix: "Verify FRS_PROGRAM_FACILITY table" },
      { name: "PFAS / UCMR", dataType: "National PFAS screening", status: "offline", loe: "2 hrs", fix: "Check UCMR table name, add Accept header" },
      { name: "NPS Water Quality", dataType: "Park-specific monitoring", status: "offline", loe: "1 hr", fix: "Add Accept: application/json header" },
      { name: "NY / NJ / PA / VA Open Data", dataType: "State water quality (Socrata)", status: "offline", loe: "4 hrs", fix: "Find correct dataset IDs from state portals" },
      { name: "MD DNR ERDDAP", dataType: "Maryland tidal real-time", status: "offline", loe: "2 hrs", fix: "Fix tabledap query format, verify dataset ID" },
      { name: "Monitor My Watershed", dataType: "Citizen science sensors", status: "offline", loe: "2 hrs", fix: "Verify EnviroDIY API path" },
      { name: "FL DBHYDRO", dataType: "South Florida 35M+ records", status: "offline", loe: "1 hr", fix: "Add retry logic for intermittent FL DEP servers" },
      { name: "State Portal (generic)", dataType: "50 state portals", status: "offline", loe: "2 hrs", fix: "Per-state URL configuration" },
    ],
  },
  {
    id: "phase2",
    number: "02",
    title: "New Federal Sources",
    timeline: "Week 3\u20134",
    targetSources: "40+ Sources",
    description: "Sources identified in the national manifest not yet in the codebase. All public, no-auth APIs. Each requires a new fetch handler and registry entry. ~38 hours total LOE.",
    color: "#0A6E8A",
    lightBg: "#F0F8FB",
    sources: [
      { name: "CDC NWSS", dataType: "Wastewater pathogens (COVID, flu, RSV)", status: "new", loe: "3 hrs", records: "National treatment plants" },
      { name: "NASA Earthdata CMR", dataType: "Satellite chlorophyll-a, SST, turbidity", status: "new", loe: "4 hrs", records: "Global catalog" },
      { name: "Data.gov Catalog", dataType: "1,798+ water quality datasets (meta-index)", status: "new", loe: "4 hrs", records: "Source discovery engine" },
      { name: "EWG Tap Water", dataType: "50,000+ utility profiles, contaminant results", status: "new", loe: "6 hrs", records: "National utilities" },
      { name: "NOAA NDBC", dataType: "1,300+ ocean/lake buoys, waves, wind, temp", status: "new", loe: "4 hrs", records: "Coastal monitoring" },
      { name: "NOAA NERRS", dataType: "29 estuarine research reserves, continuous", status: "new", loe: "4 hrs", records: "Estuarine reference" },
      { name: "EPA NARS", dataType: "National probabilistic surveys", status: "new", loe: "3 hrs", records: "Rivers, lakes, coast" },
      { name: "USACE", dataType: "Lock/dam water quality, reservoir data", status: "new", loe: "4 hrs", records: "Corps infrastructure" },
      { name: "US Desalination", dataType: "Municipal desal plants, capacity", status: "new", loe: "2 hrs", records: "Data.gov" },
      { name: "NEWTS", dataType: "Brackish water treatment for energy", status: "new", loe: "2 hrs", records: "USGS/DOE" },
      { name: "Tribal WQP", dataType: "100+ tribal org submissions", status: "new", loe: "2 hrs", records: "WQP org filter" },
    ],
  },
  {
    id: "phase3",
    number: "03",
    title: "All 50 State Direct Portals",
    timeline: "Month 2\u20133",
    targetSources: "75+ Sources",
    description: "Every state environmental agency publishes water quality data through their own portal. Some data never reaches WQP. Direct integration catches what federal systems miss. ~120 hours across all 50 states.",
    color: "#2D8E5C",
    lightBg: "#F0FAF4",
    sources: [
      { name: "Tier 1: 10 states", dataType: "Socrata/open API portals \u2014 wire directly", status: "new", loe: "~2 hrs each", records: "MD, VA, PA, NY, NJ, FL, CA, TX, OH, MI" },
      { name: "Tier 2: 20 states", dataType: "Downloadable CSV/Excel \u2014 scheduled scrape + parse", status: "new", loe: "~3 hrs each", records: "IL, NC, GA, WA, MN, and 15 more" },
      { name: "Tier 3: 15 states", dataType: "Already in WQP \u2014 verify freshness", status: "planned", loe: "~1 hr each", records: "Cross-check vs WQP pull dates" },
      { name: "Tier 4: 5 states + territories", dataType: "Limited online data \u2014 manual outreach or FOIA", status: "planned", loe: "~1 hr each", records: "Flag for partnership" },
    ],
  },
  {
    id: "phase4",
    number: "04",
    title: "State Integrated Report Extraction",
    timeline: "Month 3\u20134",
    targetSources: "130+ Sources",
    description: "States publish Integrated Reports (305(b)/303(d)) every 2 years containing data 12\u201318 months fresher than ATTAINS. AI-powered extraction turns thousands of PDFs into structured data with full citation. ~100 hours.",
    color: "#6B5B95",
    lightBg: "#F5F3FA",
    sources: [
      { name: "56 Integrated Reports", dataType: "Assessment data fresher than ATTAINS", status: "planned", loe: "20 hrs collect, 40 hrs extract", records: "56 state/territory PDFs" },
      { name: "Consumer Confidence Reports", dataType: "Annual drinking water test results per utility", status: "planned", loe: "Phased", records: "~50,000 reports nationally" },
      { name: "TMDL Documents", dataType: "Load allocations, monitoring data, targets", status: "planned", loe: "Phased", records: "Thousands nationally" },
      { name: "Stormwater Annual Reports", dataType: "Outfall monitoring, BMP performance per MS4", status: "planned", loe: "Phased", records: "Thousands nationally" },
      { name: "HAB Reports", dataType: "Cyanotoxin concentrations, bloom locations", status: "planned", loe: "Phased", records: "Seasonal per state" },
      { name: "Fish Consumption Advisories", dataType: "Contaminant levels in tissue as WQ proxy", status: "planned", loe: "Phased", records: "Annual per state" },
    ],
  },
  {
    id: "phase5",
    number: "05",
    title: "Satellite, International & Emerging",
    timeline: "Month 4\u20136",
    targetSources: "200+ Sources",
    description: "Satellite remote sensing fills spatial gaps where no ground monitoring exists. International datasets enable benchmarking. Emerging sources from academia, citizen science, and industrial self-monitoring round out coverage. ~80 hours.",
    color: "#4A3D75",
    lightBg: "#F3F0FA",
    sources: [
      { name: "NASA Earthdata (MODIS/Landsat)", dataType: "Chlorophyll-a, SST, turbidity raster", status: "planned", loe: "12 hrs", records: "Global coverage" },
      { name: "NOAA CoastWatch", dataType: "Ocean color, sea surface temperature", status: "planned", loe: "8 hrs", records: "Gridded raster" },
      { name: "Sentinel-2/3 (ESA)", dataType: "Higher resolution water quality indices", status: "planned", loe: "12 hrs", records: "Free, global" },
      { name: "GEMStat (UN)", dataType: "Global water quality from 100+ countries", status: "planned", loe: "6 hrs", records: "International benchmark" },
      { name: "HydroShare", dataType: "Published academic monitoring datasets", status: "planned", loe: "8 hrs", records: "University research" },
      { name: "Citizen Science Networks", dataType: "ALLARM, Izaak Walton League, state volunteer programs", status: "planned", loe: "10 hrs", records: "Quality-flagged" },
      { name: "TRI (Toxics Release Inventory)", dataType: "Industrial self-monitoring, partially via Envirofacts", status: "planned", loe: "4 hrs", records: "National facilities" },
      { name: "USDA NRCS", dataType: "Agricultural runoff, edge-of-field monitoring", status: "planned", loe: "6 hrs", records: "Conservation practice data" },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

const DataRoadmap: React.FC = () => {
  const [expandedPhase, setExpandedPhase] = useState<string | null>("current");

  const totalLive = 15;
  const totalSources = 29;
  const targetSources = 200;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FAFBFC",
        fontFamily: "'Source Sans 3', 'Source Sans Pro', -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#1A2B3C",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Source+Sans+3:wght@300;400;500;600;700&display=swap');

        .rm-hero {
          padding: 100px 40px 64px;
          text-align: center;
          position: relative;
          background: linear-gradient(180deg, #FAFBFC 0%, #F4F7FA 100%);
        }

        .rm-hero::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 160px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #0A6E8A, transparent);
        }

        .rm-label {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 3.5px;
          text-transform: uppercase;
          color: #0A6E8A;
          margin-bottom: 24px;
        }

        .rm-title {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(32px, 5vw, 52px);
          font-weight: 400;
          color: #0F2030;
          line-height: 1.15;
          margin: 0 0 16px;
        }

        .rm-title span { color: #0A6E8A; }

        .rm-subtitle {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 18px;
          font-weight: 300;
          color: #5A6B7C;
          max-width: 640px;
          margin: 0 auto;
          line-height: 1.65;
        }

        /* KPI strip */
        .rm-kpi-strip {
          display: flex;
          justify-content: center;
          gap: 48px;
          padding: 48px 24px 0;
          max-width: 960px;
          margin: 0 auto;
        }

        .rm-kpi { text-align: center; }

        .rm-kpi-value {
          font-family: 'DM Serif Display', serif;
          font-size: 40px;
          line-height: 1;
        }

        .rm-kpi-label {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #8A9AAC;
          margin-top: 8px;
        }

        /* Progress bar */
        .rm-progress-wrap {
          max-width: 640px;
          margin: 40px auto 0;
          padding: 0 24px;
        }

        .rm-progress-labels {
          display: flex;
          justify-content: space-between;
          font-family: 'Source Sans 3', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: #8A9AAC;
          margin-bottom: 8px;
        }

        .rm-progress-track {
          height: 8px;
          background: #E8EDF2;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }

        .rm-progress-fill {
          height: 100%;
          border-radius: 4px;
          background: linear-gradient(90deg, #0A6E8A, #1B7A4A);
          transition: width 1s ease-out;
        }

        .rm-progress-markers {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          padding: 0 2px;
        }

        .rm-progress-marker {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 10px;
          font-weight: 600;
          color: #B0BDCA;
        }

        /* Phase cards */
        .rm-phases {
          max-width: 960px;
          margin: 0 auto;
          padding: 56px 24px 80px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .rm-phase {
          background: white;
          border: 1px solid #E4EBF0;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }

        .rm-phase:hover {
          border-color: #C0D4E0;
          box-shadow: 0 4px 20px rgba(10, 110, 138, 0.06);
        }

        .rm-phase-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 32px;
          gap: 16px;
        }

        .rm-phase-left {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 0;
        }

        .rm-phase-number {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Source Sans 3', sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }

        .rm-phase-info { flex: 1; min-width: 0; }

        .rm-phase-title {
          font-family: 'DM Serif Display', serif;
          font-size: 20px;
          color: #0F2030;
          margin: 0 0 2px;
        }

        .rm-phase-meta {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: #8A9AAC;
        }

        .rm-phase-right {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-shrink: 0;
        }

        .rm-phase-target {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 13px;
          font-weight: 600;
          padding: 5px 14px;
          border-radius: 20px;
          white-space: nowrap;
        }

        .rm-phase-chevron {
          width: 20px;
          height: 20px;
          transition: transform 0.3s ease;
          color: #B0BDCA;
        }

        .rm-phase-chevron.open {
          transform: rotate(180deg);
        }

        /* Phase body */
        .rm-phase-body {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .rm-phase-body.open {
          max-height: 2000px;
        }

        .rm-phase-content {
          padding: 0 32px 28px;
          border-top: 1px solid #F0F3F6;
        }

        .rm-phase-desc {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.65;
          color: #4A5B6C;
          margin: 20px 0;
          max-width: 720px;
        }

        /* Source table */
        .rm-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Source Sans 3', sans-serif;
        }

        .rm-table th {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #8A9AAC;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid #E4EBF0;
        }

        .rm-table td {
          font-size: 14px;
          color: #3A4B5C;
          padding: 12px;
          border-bottom: 1px solid #F4F6F8;
          vertical-align: top;
        }

        .rm-table tr:last-child td {
          border-bottom: none;
        }

        .rm-table tr:hover td {
          background: #FAFBFC;
        }

        .rm-table-name {
          font-weight: 600;
          color: #1A2B3C;
        }

        .rm-table-status {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 12px;
          border: 1.5px solid;
          display: inline-block;
          white-space: nowrap;
        }

        .rm-table-fix {
          font-size: 13px;
          color: #6A7B8C;
          font-style: italic;
        }

        /* Bottom CTA */
        .rm-cta {
          text-align: center;
          padding: 0 24px 80px;
          max-width: 640px;
          margin: 0 auto;
        }

        .rm-cta-line {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, #E4EBF0, transparent);
          margin-bottom: 48px;
        }

        .rm-cta p {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 16px;
          font-weight: 300;
          color: #5A6B7C;
          line-height: 1.65;
          margin: 0 0 24px;
        }

        .rm-cta-btn {
          display: inline-block;
          padding: 14px 36px;
          font-family: 'Source Sans 3', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: white;
          background: #0A6E8A;
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
        }

        .rm-cta-btn:hover {
          background: #085A72;
          box-shadow: 0 4px 16px rgba(10, 110, 138, 0.2);
          transform: translateY(-1px);
        }

        @media (max-width: 768px) {
          .rm-kpi-strip { gap: 24px; flex-wrap: wrap; }
          .rm-kpi-value { font-size: 32px; }
          .rm-phase-header { padding: 20px 20px; flex-wrap: wrap; }
          .rm-phase-content { padding: 0 20px 20px; }
          .rm-phase-right { width: 100%; justify-content: flex-end; }
          .rm-table { font-size: 13px; }
          .rm-table th, .rm-table td { padding: 8px; }
        }
      `}</style>

      <PublicHeader />

      {/* Hero */}
      <div className="rm-hero">
        <div className="rm-label">Data Source Roadmap</div>
        <h1 className="rm-title">
          From 29 sources to <span>200+</span>
        </h1>
        <p className="rm-subtitle">
          The national water quality data landscape encompasses 200+ discrete sources
          spanning federal agencies, 56 state and territorial programs, satellite systems,
          and thousands of published regulatory documents. This is the plan to connect them all.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="rm-kpi-strip">
        {[
          { value: "29", label: "Sources Today", color: "#0A6E8A" },
          { value: "75+", label: "90-Day Target", color: "#1B7A4A" },
          { value: "150+", label: "6-Month Target", color: "#6B5B95" },
          { value: "200+", label: "Full Landscape", color: "#4A3D75" },
        ].map((kpi) => (
          <div className="rm-kpi" key={kpi.label}>
            <div className="rm-kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="rm-kpi-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="rm-progress-wrap">
        <div className="rm-progress-labels">
          <span>{totalLive} live of {totalSources} wired</span>
          <span>Target: {targetSources}+</span>
        </div>
        <div className="rm-progress-track">
          <div
            className="rm-progress-fill"
            style={{ width: `${(totalLive / targetSources) * 100}%` }}
          />
        </div>
        <div className="rm-progress-markers">
          <span className="rm-progress-marker">0</span>
          <span className="rm-progress-marker">40</span>
          <span className="rm-progress-marker">75</span>
          <span className="rm-progress-marker">130</span>
          <span className="rm-progress-marker">200</span>
        </div>
      </div>

      {/* Phase accordion */}
      <div className="rm-phases">
        {phases.map((phase) => {
          const isOpen = expandedPhase === phase.id;
          return (
            <div
              key={phase.id}
              className="rm-phase"
              style={isOpen ? { borderColor: phase.color + "40" } : undefined}
            >
              <div
                className="rm-phase-header"
                onClick={() => setExpandedPhase(isOpen ? null : phase.id)}
              >
                <div className="rm-phase-left">
                  <div className="rm-phase-number" style={{ background: phase.color }}>
                    {phase.number}
                  </div>
                  <div className="rm-phase-info">
                    <div className="rm-phase-title">{phase.title}</div>
                    <div className="rm-phase-meta">{phase.timeline}</div>
                  </div>
                </div>
                <div className="rm-phase-right">
                  <div
                    className="rm-phase-target"
                    style={{
                      color: phase.color,
                      background: phase.color + "0A",
                      border: `1.5px solid ${phase.color}40`,
                    }}
                  >
                    {phase.targetSources}
                  </div>
                  <svg
                    className={`rm-phase-chevron ${isOpen ? "open" : ""}`}
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <div className={`rm-phase-body ${isOpen ? "open" : ""}`}>
                <div className="rm-phase-content">
                  <p className="rm-phase-desc">{phase.description}</p>

                  <table className="rm-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Data Type</th>
                        <th>Status</th>
                        {phase.sources.some(s => s.records) && <th>Coverage</th>}
                        {phase.sources.some(s => s.loe) && <th>LOE</th>}
                        {phase.sources.some(s => s.fix) && <th>Action Required</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {phase.sources.map((source) => {
                        const sc = STATUS_CONFIG[source.status];
                        return (
                          <tr key={source.name}>
                            <td className="rm-table-name">{source.name}</td>
                            <td>{source.dataType}</td>
                            <td>
                              <span
                                className="rm-table-status"
                                style={{ color: sc.color, borderColor: sc.border, background: sc.bg }}
                              >
                                {sc.label}
                              </span>
                            </td>
                            {phase.sources.some(s => s.records) && (
                              <td>{source.records || "\u2014"}</td>
                            )}
                            {phase.sources.some(s => s.loe) && (
                              <td>{source.loe || "\u2014"}</td>
                            )}
                            {phase.sources.some(s => s.fix) && (
                              <td className="rm-table-fix">{source.fix || "\u2014"}</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="rm-cta">
        <div className="rm-cta-line" />
        <p>
          PIN is the first platform to unify all of it, show exactly where the gaps are,
          and fill them with fresher data from state reports, mobile sensors, and lab results.
        </p>
        <Link href="/treatment" className="rm-cta-btn">
          Learn About the Technology &rarr;
        </Link>
      </div>

      <footer style={{ padding: '32px 24px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>&copy; {new Date().getFullYear()} Local Seafood Projects Inc. All rights reserved.</p>
        <p style={{ fontSize: '10px', color: '#94a3b8', opacity: 0.7, marginTop: '4px' }}>Project Pearl&trade;, Pearl&trade;, ALIA&trade;, and AQUA-LO&trade; are trademarks of Local Seafood Projects.</p>
      </footer>
    </div>
  );
};

export default DataRoadmap;
