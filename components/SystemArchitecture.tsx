"use client";

import { useState } from "react";

const SystemArchitecture = () => {
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);

  const layers = [
    {
      id: "pin",
      number: "01",
      title: "PIN",
      subtitle: "The Diagnostic Layer",
      status: "OPERATIONAL",
      statusColor: "#0E7C5F",
      description:
        "The PEARL Intelligence Network monitors surface water quality across all 50 states. 565,000+ assessment points. Real-time federal data from USGS, EPA, NOAA, and state agencies. Role-based dashboards for municipalities, regulators, researchers, and educators.",
      tags: [
        "50-state coverage",
        "15-min data resolution",
        "AI-powered analysis",
        "Compliance automation",
        "Cross-jurisdictional benchmarking",
      ],
      accentColor: "#0A6E8A",
      lightBg: "#F0F8FB",
    },
    {
      id: "pearl",
      number: "02",
      title: "PIN Treatment",
      subtitle: "The Treatment Layer",
      status: "PILOT VALIDATED",
      statusColor: "#B8860B",
      description:
        "Modular biofiltration and mechanical treatment deployed at the shoreline. Oyster raceways and progressive mesh screens intercept what land-based BMPs miss. Each unit generates high-frequency treatment data that feeds back into PIN.",
      tags: [
        "Oyster biofiltration",
        "3-stage mechanical filtration",
        "88\u201395% TSS removal",
        "Mobile + fixed deployment",
        "Watershed-scalable",
      ],
      accentColor: "#1B7A4A",
      lightBg: "#F0FAF4",
    },
    {
      id: "quantum",
      number: "03",
      title: "Predictive Intelligence",
      subtitle: "The Forecasting Layer",
      status: "ROADMAP",
      statusColor: "#6B5B95",
      description:
        "430 million water quality observations train predictive models that forecast contamination events before they happen. Know where every waterflow goes, what it carries, and where it will cause disruption. Quantum-ready architecture for national-scale simulation.",
      tags: [
        "430M+ observations",
        "Contaminant transport modeling",
        "Impairment forecasting",
        "Sensor placement optimization",
        "Quantum-ready architecture",
      ],
      accentColor: "#6B5B95",
      lightBg: "#F5F3FA",
    },
  ];

  const phases = [
    {
      id: "current",
      label: "Today",
      sources: 29,
      milestone: "29 Live Sources",
      detail: "USGS, EPA WQP, ATTAINS, SDWIS, NOAA, state portals",
      color: "#0A6E8A",
      fill: 14.5, // 29/200
    },
    {
      id: "phase1",
      label: "Week 2",
      sources: 29,
      milestone: "All Sources Online",
      detail: "Fix 14 offline endpoints \u2014 URL corrections, header fixes",
      color: "#0E7C5F",
      fill: 14.5,
    },
    {
      id: "phase2",
      label: "Month 1",
      sources: 40,
      milestone: "40+ Sources",
      detail: "CDC NWSS, NASA Earthdata, NOAA NDBC/NERRS, Data.gov catalog",
      color: "#1B7A4A",
      fill: 20,
    },
    {
      id: "phase3",
      label: "Month 3",
      sources: 75,
      milestone: "75+ Sources",
      detail: "All 50 state direct portals \u2014 data that never reaches WQP",
      color: "#2D8E5C",
      fill: 37.5,
    },
    {
      id: "phase4",
      label: "Month 4",
      sources: 130,
      milestone: "130+ Sources",
      detail: "AI extraction from 56 state Integrated Reports, CCRs, TMDLs",
      color: "#6B5B95",
      fill: 65,
    },
    {
      id: "phase5",
      label: "Month 6",
      sources: 200,
      milestone: "200+ Sources",
      detail: "Satellite, international benchmarking, emerging datasets",
      color: "#4A3D75",
      fill: 100,
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FAFBFC",
        fontFamily:
          "'Source Sans 3', 'Source Sans Pro', -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#1A2B3C",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Source+Sans+3:wght@300;400;500;600;700&display=swap');

        .arch-hero {
          padding: 80px 40px 60px;
          text-align: center;
          position: relative;
        }

        .arch-hero::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 120px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #0A6E8A, transparent);
        }

        .arch-label {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 3.5px;
          text-transform: uppercase;
          color: #0A6E8A;
          margin-bottom: 20px;
        }

        .arch-title {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(36px, 5vw, 56px);
          font-weight: 400;
          color: #0F2030;
          line-height: 1.15;
          margin: 0 0 16px;
        }

        .arch-title span {
          color: #0A6E8A;
        }

        .arch-subtitle {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 18px;
          font-weight: 300;
          color: #5A6B7C;
          max-width: 520px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .arch-layers {
          max-width: 880px;
          margin: 0 auto;
          padding: 40px 24px 60px;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .arch-connector {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 56px;
          position: relative;
        }

        .arch-connector-line {
          width: 2px;
          height: 100%;
          background: linear-gradient(to bottom, #C8D8E4, #0A6E8A, #C8D8E4);
          position: relative;
        }

        .arch-connector-arrow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }

        .arch-card {
          background: white;
          border: 1px solid #E4EBF0;
          border-radius: 12px;
          padding: 36px 40px;
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: default;
        }

        .arch-card:hover {
          border-color: #C0D4E0;
          box-shadow: 0 8px 32px rgba(10, 110, 138, 0.08), 0 2px 8px rgba(0,0,0,0.04);
          transform: translateY(-2px);
        }

        .arch-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .arch-card-title-group {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .arch-card-number {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Source Sans 3', sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }

        .arch-card-title {
          font-family: 'DM Serif Display', serif;
          font-size: 22px;
          color: #0F2030;
          margin: 0;
        }

        .arch-card-title-sep {
          color: #C0CDD8;
          margin: 0 6px;
          font-weight: 300;
        }

        .arch-card-title-sub {
          font-family: 'Source Sans 3', sans-serif;
          font-weight: 400;
          font-size: 18px;
          color: #5A6B7C;
        }

        .arch-status {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          padding: 5px 14px;
          border-radius: 20px;
          border: 1.5px solid;
          white-space: nowrap;
        }

        .arch-card-desc {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.65;
          color: #4A5B6C;
          margin: 0 0 20px;
          max-width: 700px;
        }

        .arch-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .arch-tag {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 13px;
          font-weight: 500;
          padding: 5px 14px;
          border-radius: 6px;
          border: 1px solid;
          transition: all 0.2s ease;
        }

        .arch-tag:hover {
          transform: translateY(-1px);
        }

        .arch-stat-bar {
          display: flex;
          justify-content: center;
          gap: 48px;
          padding: 40px 24px 0;
          max-width: 880px;
          margin: 0 auto;
          border-top: 1px solid #E4EBF0;
        }

        .arch-stat {
          text-align: center;
        }

        .arch-stat-value {
          font-family: 'DM Serif Display', serif;
          font-size: 32px;
          color: #0A6E8A;
        }

        .arch-stat-label {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #8A9AAC;
          margin-top: 4px;
        }

        .arch-accent-bar {
          position: absolute;
          top: 0;
          left: 24px;
          right: 24px;
          height: 3px;
          border-radius: 0 0 3px 3px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .arch-card:hover .arch-accent-bar {
          opacity: 1;
        }

        /* ── Data Expansion Section ── */

        .expansion-section {
          max-width: 880px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }

        .expansion-header {
          text-align: center;
          padding: 60px 0 48px;
          position: relative;
        }

        .expansion-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 200px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #E4EBF0, transparent);
        }

        .expansion-kpi {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .expansion-kpi-now {
          font-family: 'DM Serif Display', serif;
          font-size: 48px;
          color: #0A6E8A;
          line-height: 1;
        }

        .expansion-kpi-arrow {
          font-size: 24px;
          color: #C0CDD8;
        }

        .expansion-kpi-target {
          font-family: 'DM Serif Display', serif;
          font-size: 48px;
          color: #1B7A4A;
          line-height: 1;
        }

        .expansion-kpi-unit {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #8A9AAC;
        }

        .expansion-desc {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 16px;
          font-weight: 300;
          color: #5A6B7C;
          max-width: 580px;
          margin: 16px auto 0;
          line-height: 1.65;
          text-align: center;
        }

        /* Timeline */

        .timeline {
          position: relative;
          padding: 0;
        }

        .timeline-track {
          position: absolute;
          top: 20px;
          left: 0;
          right: 0;
          height: 4px;
          background: #E8EDF2;
          border-radius: 2px;
          overflow: hidden;
        }

        .timeline-track-fill {
          height: 100%;
          background: linear-gradient(90deg, #0A6E8A, #1B7A4A, #6B5B95);
          border-radius: 2px;
          width: 14.5%;
          transition: width 0.3s ease;
        }

        .timeline-nodes {
          display: flex;
          justify-content: space-between;
          position: relative;
          z-index: 1;
        }

        .timeline-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 140px;
          cursor: default;
          transition: transform 0.2s ease;
        }

        .timeline-node:hover {
          transform: translateY(-2px);
        }

        .timeline-dot {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Serif Display', serif;
          font-size: 16px;
          color: white;
          font-weight: 400;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          position: relative;
          z-index: 2;
        }

        .timeline-dot-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid;
          opacity: 0.2;
        }

        .timeline-label {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #8A9AAC;
          margin-top: 16px;
        }

        .timeline-milestone {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #1A2B3C;
          margin-top: 6px;
          text-align: center;
        }

        .timeline-detail {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 12px;
          font-weight: 400;
          color: #8A9AAC;
          margin-top: 4px;
          text-align: center;
          line-height: 1.4;
          max-width: 130px;
        }

        /* Problem statement */

        .problem-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 48px;
        }

        .problem-card {
          background: white;
          border: 1px solid #E4EBF0;
          border-radius: 10px;
          padding: 20px 24px;
          transition: all 0.3s ease;
        }

        .problem-card:hover {
          border-color: #C0D4E0;
          box-shadow: 0 4px 16px rgba(10, 110, 138, 0.06);
        }

        .problem-card-source {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #0A6E8A;
          margin-bottom: 6px;
        }

        .problem-card-issue {
          font-family: 'Source Sans 3', sans-serif;
          font-size: 14px;
          font-weight: 400;
          color: #4A5B6C;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .timeline-nodes {
            flex-wrap: wrap;
            gap: 24px;
            justify-content: center;
          }
          .timeline-track { display: none; }
          .expansion-kpi-now, .expansion-kpi-target { font-size: 36px; }
          .problem-strip { grid-template-columns: 1fr; }
        }

        @media (max-width: 640px) {
          .arch-card { padding: 24px; }
          .arch-card-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .arch-stat-bar { gap: 24px; flex-wrap: wrap; }
          .arch-tags { gap: 6px; }
        }
      `}</style>

      {/* Hero */}
      <div className="arch-hero">
        <div className="arch-label">System Architecture</div>
        <h1 className="arch-title">
          Diagnose and treat. <span>One platform.</span>
        </h1>
        <p className="arch-subtitle">
          The only integrated system that identifies where waterways are failing
          and deploys physical infrastructure to fix them.
        </p>
      </div>

      {/* Stats bar */}
      <div className="arch-stat-bar">
        {[
          { value: "430M+", label: "Observations" },
          { value: "565K", label: "Assessment Points" },
          { value: "50", label: "States Covered" },
          { value: "29", label: "Live Sources" },
        ].map((stat) => (
          <div className="arch-stat" key={stat.label}>
            <div className="arch-stat-value">{stat.value}</div>
            <div className="arch-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Layer cards */}
      <div className="arch-layers">
        {layers.map((layer, i) => (
          <div key={layer.id}>
            {i > 0 && (
              <div className="arch-connector">
                <div className="arch-connector-line">
                  <div className="arch-connector-arrow">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                    >
                      <path
                        d="M5 2L5 8M5 8L2.5 5.5M5 8L7.5 5.5"
                        stroke="#0A6E8A"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            <div
              className="arch-card"
              onMouseEnter={() => setHoveredLayer(layer.id)}
              onMouseLeave={() => setHoveredLayer(null)}
              style={{
                background:
                  hoveredLayer === layer.id ? layer.lightBg : "white",
              }}
            >
              <div
                className="arch-accent-bar"
                style={{ background: layer.accentColor }}
              />

              <div className="arch-card-header">
                <div className="arch-card-title-group">
                  <div
                    className="arch-card-number"
                    style={{ background: layer.accentColor }}
                  >
                    {layer.number}
                  </div>
                  <h2 className="arch-card-title">
                    {layer.title}
                    <span className="arch-card-title-sep">&mdash;</span>
                    <span className="arch-card-title-sub">
                      {layer.subtitle}
                    </span>
                  </h2>
                </div>
                <div
                  className="arch-status"
                  style={{
                    color: layer.statusColor,
                    borderColor: layer.statusColor + "40",
                    background: layer.statusColor + "0A",
                  }}
                >
                  {layer.status}
                </div>
              </div>

              <p className="arch-card-desc">{layer.description}</p>

              <div className="arch-tags">
                {layer.tags.map((tag) => (
                  <span
                    key={tag}
                    className="arch-tag"
                    style={{
                      color: layer.accentColor,
                      borderColor: layer.accentColor + "30",
                      background: layer.accentColor + "08",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Data Source Expansion ── */}
      <div className="expansion-section">
        <div className="expansion-header">
          <div className="arch-label">Data Source Expansion</div>
          <div className="expansion-kpi">
            <span className="expansion-kpi-now">29</span>
            <span className="expansion-kpi-arrow">&rarr;</span>
            <span className="expansion-kpi-target">200+</span>
            <span className="expansion-kpi-unit">sources</span>
          </div>
          <p className="expansion-desc">
            The national water quality data landscape encompasses 200+ discrete sources
            spanning federal agencies, 56 state and territorial programs, satellite systems,
            and thousands of published regulatory documents. PIN is systematically onboarding
            every one.
          </p>
        </div>

        {/* Timeline */}
        <div className="timeline">
          <div className="timeline-track">
            <div className="timeline-track-fill" />
          </div>
          <div className="timeline-nodes">
            {phases.map((phase) => (
              <div className="timeline-node" key={phase.id}>
                <div className="timeline-dot" style={{ background: phase.color }}>
                  <div className="timeline-dot-ring" style={{ borderColor: phase.color }} />
                  {phase.sources}
                </div>
                <div className="timeline-label">{phase.label}</div>
                <div className="timeline-milestone">{phase.milestone}</div>
                <div className="timeline-detail">{phase.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* The problem: why this matters */}
        <div className="problem-strip">
          {[
            { source: "ATTAINS", issue: "Assessments are 2\u20134 years old by the time they reach the database" },
            { source: "WQP", issue: "430M+ records but massive temporal gaps \u2014 some stations silent since 2018" },
            { source: "SDWIS", issue: "Violation data lags actual events by months" },
            { source: "State Reports", issue: "12 states still on 2022 cycle, using data from 2020 or earlier" },
            { source: "ICIS / ECHO", issue: "Discharge monitoring takes 6\u201312 months to appear" },
            { source: "State Portals", issue: "Contain data never submitted to federal systems" },
          ].map((p) => (
            <div className="problem-card" key={p.source}>
              <div className="problem-card-source">{p.source}</div>
              <div className="problem-card-issue">{p.issue}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemArchitecture;
