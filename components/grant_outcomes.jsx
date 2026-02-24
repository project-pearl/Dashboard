import { useState } from "react";

const grantData = [
  {
    id: 1,
    program: "Chesapeake Bay TMDL",
    source: "EPA / Multi-State Partnership",
    region: "Region 3 (MD, VA, PA, WV, DE, DC)",
    invested: 15000000000,
    investedLabel: "$15B",
    timeframe: "2000–2024",
    duration: "24 years",
    pollutants: ["Nitrogen", "Phosphorus", "Sediment"],
    results: [
      { metric: "Nitrogen reduction", value: "45.5M lbs/yr", pct: "15.3%", target: "25% by 2025", progress: 59 },
      { metric: "Phosphorus reduction", value: "3.7M lbs/yr", pct: "21.8%", target: "24% by 2025", progress: 92 },
      { metric: "Sediment reduction", value: "1.44B lbs/yr", pct: "7.6%", target: "20% by 2025", progress: 100 },
    ],
    waterbodies: "92 tidal segments across 64,000 sq mi watershed",
    status: "In Progress",
    statusColor: "#E65100",
    insight: "Largest TMDL ever developed. Wastewater sector met 2025 goals a decade early. Nitrogen from agriculture remains the gap. PIN's grading engine tracks all 92 segments in real time.",
    attainsLink: true,
  },
  {
    id: 2,
    program: "Section 319 — Heron Lake Watershed",
    source: "EPA CWA §319 + State Match",
    region: "Minnesota",
    invested: 211248,
    investedLabel: "$211K",
    timeframe: "1997–2010",
    duration: "13 years",
    pollutants: ["Phosphorus", "TSS"],
    results: [
      { metric: "TSS reduction (First Fulda Lake)", value: "72% decrease", pct: "72%", target: "Meet WQ standard", progress: 100 },
      { metric: "TSS reduction (Second Fulda Lake)", value: "72% decrease", pct: "72%", target: "Meet WQ standard", progress: 100 },
      { metric: "Phosphorus (First Fulda)", value: "45% decrease", pct: "45%", target: "Below impairment", progress: 100 },
      { metric: "Orthophosphorus (North Heron)", value: "94% reduction", pct: "94%", target: "Below impairment", progress: 100 },
    ],
    waterbodies: "3 lakes delisted from 303(d)",
    status: "Fully Restored",
    statusColor: "#2E7D32",
    insight: "One of the highest ROI 319 grants on record. $211K investment achieved 94% orthophosphorus reduction and full delisting of 3 waterbodies. PIN would have flagged the trend reversal years earlier.",
    attainsLink: true,
  },
  {
    id: 3,
    program: "Section 319 — Tyger River Bacteria",
    source: "EPA CWA §319 + Local Partners",
    region: "South Carolina",
    invested: 850000,
    investedLabel: "~$850K",
    timeframe: "2002–2012",
    duration: "10 years",
    pollutants: ["Fecal Coliform Bacteria"],
    results: [
      { metric: "Segments meeting FC standard", value: "4 of 20 restored", pct: "20%", target: "All 20 segments", progress: 20 },
      { metric: "Septic systems repaired", value: "200+ systems", pct: "", target: "Eliminate failing systems", progress: 60 },
      { metric: "Agricultural BMPs installed", value: "Multiple sites", pct: "", target: "Watershed-wide coverage", progress: 55 },
    ],
    waterbodies: "20 impaired segments on Tyger River; 4 fully restored",
    status: "Partial Restoration",
    statusColor: "#E65100",
    insight: "Community-led effort combining septic repairs, ag BMPs, and education. Demonstrates that bacteria impairments require multi-sector coordination — exactly the cross-source view PIN provides.",
    attainsLink: true,
  },
  {
    id: 4,
    program: "CWSRF — National Portfolio",
    source: "EPA Clean Water State Revolving Fund",
    region: "Nationwide (51 programs)",
    invested: 172000000000,
    investedLabel: "$172B",
    timeframe: "1988–2023",
    duration: "35 years",
    pollutants: ["Nutrients", "Sediment", "Bacteria", "Infrastructure"],
    results: [
      { metric: "Assistance agreements", value: "48,900+", pct: "", target: "Ongoing", progress: 100 },
      { metric: "Small community agreements", value: "33,300", pct: "", target: "Populations <10K", progress: 100 },
      { metric: "Federal dollar leverage ratio", value: "$3 returned per $1", pct: "300%", target: "Self-sustaining", progress: 100 },
      { metric: "Rivers/streams restored (319 subset)", value: "12,300 miles", pct: "", target: "Ongoing", progress: 75 },
    ],
    waterbodies: "12,300 miles of rivers + 230,000 acres of lakes improved",
    status: "Ongoing",
    statusColor: "#2E5984",
    insight: "The largest water infrastructure financing mechanism in the US. Every $1 of federal investment returns $3 through loan repayments. PIN connects CWSRF-funded projects to their downstream water quality outcomes for the first time.",
    attainsLink: false,
  },
  {
    id: 5,
    program: "Section 319 — Oneida Lake Phosphorus",
    source: "EPA CWA §319 + NY State + USDA",
    region: "New York",
    invested: 1200000,
    investedLabel: "~$1.2M",
    timeframe: "2000–2008",
    duration: "8 years",
    pollutants: ["Phosphorus"],
    results: [
      { metric: "Phosphorus loading", value: "Steady decline achieved", pct: "", target: "Meet designated use", progress: 100 },
      { metric: "303(d) status", value: "Proposed for delisting", pct: "", target: "Full delisting", progress: 95 },
      { metric: "Ag BMPs implemented", value: "80+ farms enrolled", pct: "", target: "Watershed-wide AEM", progress: 80 },
    ],
    waterbodies: "Oneida Lake (79 sq mi) — proposed delisting 2008",
    status: "Fully Restored",
    statusColor: "#2E7D32",
    insight: "Agricultural Environmental Management approach enrolled 80+ farms voluntarily. Demonstrated that nutrient reduction at scale is possible without regulatory mandates — a model PIN's grant matching engine recommends to similar watersheds.",
    attainsLink: true,
  },
];

function formatCurrency(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function ProgressBar({ value, color }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color || "#2E5984" }}
      />
    </div>
  );
}

function PollutantTag({ name }) {
  const colors = {
    Nitrogen: "bg-amber-100 text-amber-800",
    Phosphorus: "bg-green-100 text-green-800",
    Sediment: "bg-orange-100 text-orange-800",
    TSS: "bg-orange-100 text-orange-800",
    "Fecal Coliform Bacteria": "bg-red-100 text-red-800",
    Bacteria: "bg-red-100 text-red-800",
    Nutrients: "bg-blue-100 text-blue-800",
    Infrastructure: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[name] || "bg-gray-100 text-gray-600"}`}>
      {name}
    </span>
  );
}

function StatusBadge({ status, color }) {
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {status}
    </span>
  );
}

function GrantCard({ grant, isExpanded, onToggle }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <button onClick={onToggle} className="w-full text-left p-4 focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-bold text-gray-900 truncate">{grant.program}</h3>
              <StatusBadge status={grant.status} color={grant.statusColor} />
            </div>
            <p className="text-xs text-gray-500 mb-2">{grant.source} · {grant.region}</p>
            <div className="flex gap-1.5 flex-wrap">
              {grant.pollutants.map((p) => (
                <PollutantTag key={p} name={p} />
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-blue-800">{grant.investedLabel}</div>
            <div className="text-xs text-gray-400">{grant.duration}</div>
            <svg
              className={`w-4 h-4 mx-auto mt-1 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 px-4 pb-4">
          <div className="pt-3 space-y-3">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Measured Outcomes</div>
              <div className="space-y-2.5">
                {grant.results.map((r, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-xs font-medium text-gray-700">{r.metric}</span>
                      <span className="text-xs font-bold text-blue-800">{r.value}</span>
                    </div>
                    {r.progress > 0 && (
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={r.progress}
                          color={r.progress >= 90 ? "#2E7D32" : r.progress >= 50 ? "#E65100" : "#C62828"}
                        />
                        <span className="text-xs text-gray-400 shrink-0 w-8 text-right">{r.progress}%</span>
                      </div>
                    )}
                    {r.target && <div className="text-xs text-gray-400 mt-0.5">Target: {r.target}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">Waterbodies Affected</div>
              <div className="text-xs font-medium text-gray-800">{grant.waterbodies}</div>
            </div>

            <div className="bg-blue-50 border-l-2 border-blue-400 rounded p-2.5">
              <div className="text-xs font-semibold text-blue-900 mb-0.5">PIN Intelligence</div>
              <div className="text-xs text-blue-800">{grant.insight}</div>
            </div>

            {grant.attainsLink && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600 cursor-pointer hover:underline">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                View these waterbodies in PIN
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GrantOutcomes() {
  const [expandedId, setExpandedId] = useState(1);
  const [filter, setFilter] = useState("all");

  const filters = [
    { key: "all", label: "All Programs" },
    { key: "restored", label: "Fully Restored" },
    { key: "progress", label: "In Progress" },
    { key: "region3", label: "Region 3" },
  ];

  const filtered = grantData.filter((g) => {
    if (filter === "restored") return g.status === "Fully Restored";
    if (filter === "progress") return g.status !== "Fully Restored";
    if (filter === "region3") return g.region.includes("Region 3");
    return true;
  });

  const totalInvested = grantData.reduce((s, g) => s + g.invested, 0);
  const fullyRestored = grantData.filter((g) => g.status === "Fully Restored").length;

  return (
    <div className="max-w-3xl mx-auto font-sans">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Historical Grant Outcomes</h2>
        <p className="text-sm text-gray-500">
          Federal water quality investments and their measurable results — tracked through EPA monitoring data, 303(d) listings, and ATTAINS assessment history.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Programs Tracked", value: "5", sub: "Featured results" },
          { label: "Total Invested", value: formatCurrency(totalInvested), sub: "Federal + state + local" },
          { label: "Fully Restored", value: `${fullyRestored}`, sub: "Waterbodies delisted" },
          { label: "Rivers Improved", value: "12,300", sub: "Miles documented" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-blue-800">{s.value}</div>
            <div className="text-xs font-medium text-gray-700">{s.label}</div>
            <div className="text-xs text-gray-400">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-blue-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map((grant) => (
          <GrantCard
            key={grant.id}
            grant={grant}
            isExpanded={expandedId === grant.id}
            onToggle={() => setExpandedId(expandedId === grant.id ? null : grant.id)}
          />
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-5 bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-green-900 mb-1">PIN Connects Grants to Outcomes</div>
            <p className="text-xs text-green-800">
              PIN is the first platform to link federal grant investments directly to waterbody-level water quality outcomes using ATTAINS assessment data, WQP monitoring observations, and 303(d) listing history. Run a Grant Matching Analysis to see which programs align with your impairments.
            </p>
            <button className="mt-2 px-3.5 py-1.5 bg-green-700 text-white text-xs font-semibold rounded hover:bg-green-800 transition-colors">
              Run Grant Matching Analysis
            </button>
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="mt-4 text-xs text-gray-400">
        <p>Data Sources: EPA ATTAINS · EPA NPS Success Stories · Chesapeake Bay Program · CWSRF NIMS · EPA GRTS</p>
        <p className="mt-1">Outcome data reflects published EPA monitoring results and state 303(d) assessments. PIN aggregates these sources but does not certify regulatory compliance.</p>
      </div>
    </div>
  );
}
