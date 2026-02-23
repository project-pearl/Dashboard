// =============================================================
// Resolution Planner v4 — One-Click + Conversational Refine
// PEARL Intelligence Network (PIN)
//
// No wizard. No checkboxes. One click generates a plan based on
// the user's role and the waterbody's data. Refine iteratively
// with natural language prompts.
// =============================================================

"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// ── Types ──

export type UserRole = "federal" | "state" | "ms4" | "ms4_utility" | "corporate" | "university" | "ngo" | "k12" | "infrastructure" | "admin";

export interface WaterbodyContext {
  name: string;
  assessmentUnitId: string;
  state: string;
  grade: string;
  severity: string;
  category: string;
  listing303d: boolean;
  tmdlEstablished: boolean;
  tmdlPollutants: string[];
  cwaAuthority: string;
  parametersExceeding: { name: string; value: number; threshold: number; unit: string }[];
  ms4Permits: { permitteeName: string; phase: string }[];
  npdesDischargers: { facilityName: string; majorMinor: string; status: string }[];
  drinkingWaterSystems: number;
  populationServed: number;
  activeViolations: number;
  sdwisViolations: number;
  ejIndex: number;
  ecologicalSensitivity: number;
  trendDirection: string;
  dataGaps: string[];
  watershed: string;
  huc12: string;
  epaRegion: number;
  // Data provenance — deterministic, from the platform's caches
  dataSources: DataSource[];
}

export interface DataSource {
  name: string;       // e.g. "EPA ATTAINS"
  dataset: string;    // e.g. "Integrated Report Assessment Units"
  lastUpdated: string; // ISO date
  recordCount: number;
}

export interface ResolutionPlan {
  generatedAt: string;
  waterbody: string;
  role: UserRole;
  revision: number;
  sections: PlanSections;
}

export interface PlanSections {
  situationAssessment: string;
  rootCauses: string;
  stakeholders: string;
  actionsImmediate: string[];
  actionsShortTerm: string[];
  actionsLongTerm: string[];
  coBenefits: CoBenefit[];
  costRange: string;
  regulatoryPath: string;
  grantOpportunities: string;
  projectedOutcomes: string;
}

export interface CoBenefit {
  solution: string;
  surfaceWater: string;
  drinkingWater: string;
  wastewater: string;
  groundwater: string;
  stormwater: string;
}

export interface RefineMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ── Role Context ──

const ROLE_CONTEXT: Record<UserRole, {
  label: string;
  authority: string;
  planFocus: string;
}> = {
  federal: {
    label: "Federal",
    authority: "CWA enforcement, TMDL approval, interstate coordination, funding allocation, emergency declarations",
    planFocus: "Federal oversight actions, inter-agency coordination, enforcement escalation, national program alignment. Include cost estimates, grant programs, and regulatory pathway. Frame actions within federal authority under CWA §303(d), §402, §404, and §319. Identify which federal agencies should be involved and what specific action each should take."
  },
  state: {
    label: "State",
    authority: "TMDL development, permit issuance, state water quality standards, integrated reporting, state revolving fund allocation",
    planFocus: "State regulatory actions, TMDL development timeline, permit conditions, state funding mechanisms. Focus on what the state agency can directly control and implement. Include coordination needs with federal EPA and local MS4s."
  },
  ms4: {
    label: "MS4",
    authority: "Stormwater management, BMP implementation, MS4 permit compliance, local ordinances, capital improvement programs",
    planFocus: "Stormwater BMPs, green infrastructure, permit compliance actions, capital project prioritization. Focus on what the MS4 can build, fund, and enforce locally. Include upstream/downstream coordination needs."
  },
  ms4_utility: {
    label: "Municipal Utility",
    authority: "Drinking water treatment, wastewater treatment, distribution system management, capital planning, rate setting",
    planFocus: "Treatment upgrades, source water protection, infrastructure investment, compliance with SDWIS and NPDES permits. Focus on utility-scale actions and capital planning timelines."
  },
  corporate: {
    label: "Corporate/ESG",
    authority: "Voluntary commitments, ESG reporting, corporate water stewardship, supply chain water risk",
    planFocus: "Corporate water stewardship opportunities, ESG alignment, voluntary investment options, partnership frameworks with government. Frame as business risk mitigation and value creation."
  },
  university: {
    label: "University/Research",
    authority: "Monitoring capacity, research grants, citizen science, workforce development",
    planFocus: "Research priorities, monitoring gaps that need study, grant-fundable projects, student engagement opportunities, data collection partnerships."
  },
  ngo: {
    label: "NGO",
    authority: "Advocacy, community organizing, grant-funded restoration, monitoring, litigation",
    planFocus: "Advocacy priorities, community engagement strategy, grant-fundable restoration projects, monitoring partnerships, legal leverage points."
  },
  k12: {
    label: "K-12 Education",
    authority: "Environmental education, school-based monitoring, community awareness",
    planFocus: "Educational opportunities, student monitoring projects, curriculum connections, community awareness campaigns."
  },
  infrastructure: {
    label: "Infrastructure",
    authority: "Design, engineering, construction, O&M of water infrastructure",
    planFocus: "Engineering solutions, infrastructure assessment, design criteria, construction phasing, O&M requirements."
  },
  admin: {
    label: "Administrator",
    authority: "Full platform access, cross-role coordination",
    planFocus: "Comprehensive multi-stakeholder plan covering federal, state, and local actions. Include all perspectives."
  },
};

// ── Deterministic Source Attribution ──
// Sources come from the data layer, NOT from AI

function buildSourceAttribution(wb: WaterbodyContext): string {
  if (wb.dataSources.length === 0) {
    return "Data sources: Unable to determine — verify with primary agency data.";
  }
  return wb.dataSources
    .map(ds => `${ds.name} (${ds.dataset}, ${ds.recordCount.toLocaleString()} records, updated ${new Date(ds.lastUpdated).toLocaleDateString()})`)
    .join(" · ");
}

function SourceBanner({ dataSources }: { dataSources: DataSource[] }) {
  if (dataSources.length === 0) return null;
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Data Sources Informing This Plan</p>
      <div className="flex flex-wrap gap-2">
        {dataSources.map((ds, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-600">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            <span className="font-medium">{ds.name}</span>
            <span className="text-gray-400">· {ds.recordCount.toLocaleString()} records · {new Date(ds.lastUpdated).toLocaleDateString()}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Initial Prompt ──

function buildInitialPrompt(wb: WaterbodyContext, role: UserRole): string {
  const rc = ROLE_CONTEXT[role];

  return `You are a senior water quality engineer generating a Resolution Plan.

YOUR AUDIENCE: ${rc.label} role with authority over: ${rc.authority}

WATERBODY: ${wb.name} | ${wb.assessmentUnitId} | ${wb.state} | EPA Region ${wb.epaRegion}
Watershed: ${wb.watershed} (HUC-12: ${wb.huc12})
Grade: ${wb.grade} | Severity: ${wb.severity} | Trend: ${wb.trendDirection}
303(d): ${wb.listing303d ? "Listed" : "Not listed"} | Category: ${wb.category}
TMDL: ${wb.tmdlEstablished ? `Established (${wb.tmdlPollutants.join(", ")})` : "Needed — Not Established"}
CWA: ${wb.cwaAuthority}
EJ Index: ${wb.ejIndex}/100 | Ecological Sensitivity: ${wb.ecologicalSensitivity}/100

EXCEEDANCES:
${wb.parametersExceeding.map(p => `- ${p.name}: ${p.value} ${p.unit} (limit: ${p.threshold})`).join("\n") || "None recorded"}

JURISDICTION:
MS4: ${wb.ms4Permits.map(p => `${p.permitteeName} (Phase ${p.phase})`).join(", ") || "None"}
NPDES: ${wb.npdesDischargers.map(d => `${d.facilityName} (${d.majorMinor}, ${d.status})`).join(", ") || "None"}
DW Systems: ${wb.drinkingWaterSystems} serving ${wb.populationServed.toLocaleString()} | DW Violations: ${wb.sdwisViolations}
Compliance Violations: ${wb.activeViolations}

DATA GAPS: ${wb.dataGaps.length > 0 ? wb.dataGaps.join("; ") : "None identified"}

VERIFIED DATA SOURCES: ${buildSourceAttribution(wb)}

PLAN FOCUS: ${rc.planFocus}

Generate a comprehensive Resolution Plan. Determine the appropriate resource level, timeline, solutions, and agencies based on the severity of the data above and the user's role/authority. Be specific and actionable. Use regulatory language appropriate for ${rc.label} briefings.

IMPORTANT: Do not fabricate data sources. The verified sources are listed above. Reference them when citing data, but do not invent additional sources.

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "situationAssessment": "2-3 paragraphs: what is wrong, how bad, who is affected, why this demands attention now. Reference specific parameter values and violations from the data.",
  "rootCauses": "What is causing the impairment. Cite specific dischargers, land use patterns, infrastructure failures from the data above.",
  "stakeholders": "Who must be involved. For each: name/office, their authority, and the specific action they should take. Tailored to ${rc.label} role perspective.",
  "actionsImmediate": ["0-30 day actions appropriate to ${rc.label} authority"],
  "actionsShortTerm": ["1-6 month actions"],
  "actionsLongTerm": ["6+ month actions"],
  "coBenefits": [
    {
      "solution": "name of recommended solution",
      "surfaceWater": "impact on surface water quality",
      "drinkingWater": "impact on drinking water safety",
      "wastewater": "impact on wastewater/discharge",
      "groundwater": "impact on groundwater resources",
      "stormwater": "impact on stormwater management"
    }
  ],
  "costRange": "Planning-level cost estimates by action tier. Use ranges. Reference comparable projects.",
  "regulatoryPath": "Regulatory framework, enforcement options, compliance timeline. Mapped to ${rc.label} authority.",
  "grantOpportunities": "Specific federal and state programs: name, typical range, eligibility, next deadline if known.",
  "projectedOutcomes": "What improves and by when if this plan is executed. Quantify: parameter reductions, populations protected, compliance milestones."
}`;
}

// ── Refine Prompt ──

function buildRefinePrompt(
  wb: WaterbodyContext,
  role: UserRole,
  currentPlan: PlanSections,
  refinement: string
): string {
  return `You previously generated a Resolution Plan for ${wb.name} (${wb.state}) for a ${ROLE_CONTEXT[role].label} user.

CURRENT PLAN (summarized):
- Situation: ${currentPlan.situationAssessment.slice(0, 200)}...
- Actions: ${currentPlan.actionsImmediate.length} immediate, ${currentPlan.actionsShortTerm.length} short-term, ${currentPlan.actionsLongTerm.length} long-term
- Solutions with co-benefits: ${currentPlan.coBenefits.map(c => c.solution).join(", ")}

USER REFINEMENT REQUEST: "${refinement}"

VERIFIED DATA SOURCES: ${buildSourceAttribution(wb)}

Revise the plan according to the user's request. Return the COMPLETE updated plan in the same JSON structure. Do not fabricate data sources.

Respond ONLY with valid JSON, same structure as before:
{
  "situationAssessment": "...",
  "rootCauses": "...",
  "stakeholders": "...",
  "actionsImmediate": ["..."],
  "actionsShortTerm": ["..."],
  "actionsLongTerm": ["..."],
  "coBenefits": [{"solution": "...", "surfaceWater": "...", "drinkingWater": "...", "wastewater": "...", "groundwater": "...", "stormwater": "..."}],
  "costRange": "...",
  "regulatoryPath": "...",
  "grantOpportunities": "...",
  "projectedOutcomes": "..."
}`;
}

// ── Co-Benefits Matrix Component ──

function CoBenefitsMatrix({ benefits }: { benefits: CoBenefit[] }) {
  if (!benefits || benefits.length === 0) return null;
  const domains = [
    { key: "surfaceWater", label: "Surface Water", icon: "~" },
    { key: "drinkingWater", label: "Drinking Water", icon: "DW" },
    { key: "wastewater", label: "Wastewater", icon: "WW" },
    { key: "groundwater", label: "Groundwater", icon: "GW" },
    { key: "stormwater", label: "Stormwater", icon: "SW" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-3 font-bold text-gray-500 uppercase tracking-wide">Solution</th>
            {domains.map(d => (
              <th key={d.key} className="text-center py-2 px-2 font-bold text-gray-500 uppercase tracking-wide">
                <span className="block text-base mb-0.5">{d.icon}</span>
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {benefits.map((b, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2.5 pr-3 font-semibold text-gray-700">{b.solution}</td>
              {domains.map(d => (
                <td key={d.key} className="py-2.5 px-2 text-gray-600 text-center">
                  {(b as any)[d.key] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ──

export interface ResolutionPlannerProps {
  waterbody: WaterbodyContext;
  userRole: UserRole;
  onClose?: () => void;
}

export default function ResolutionPlanner({ waterbody, userRole, onClose }: ResolutionPlannerProps) {
  const [plan, setPlan] = useState<ResolutionPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refineInput, setRefineInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [history, setHistory] = useState<RefineMessage[]>([]);
  const refineRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Auto-scroll refine history
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history]);

  const roleCtx = ROLE_CONTEXT[userRole];

  // ── Generate Initial Plan ──
  const generatePlan = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setPlan(null);
    setHistory([]);

    try {
      const response = await fetch("/api/ai/resolution-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildInitialPrompt(waterbody, userRole),
        }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const text = typeof data.text === 'string' ? data.text : data.content?.map((i: any) => i.type === "text" ? i.text : "").filter(Boolean).join("\n");
      if (!text) throw new Error("Empty response from AI");
      const sections = JSON.parse(text.replace(/```json|```/g, "").trim());
      setPlan({
        generatedAt: new Date().toISOString(),
        waterbody: waterbody.name,
        role: userRole,
        revision: 1,
        sections,
      });
    } catch (e: any) {
      setError(e.message || "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  }, [waterbody, userRole]);

  // ── Refine Plan ──
  const refinePlan = useCallback(async () => {
    if (!refineInput.trim() || !plan) return;
    const userMsg = refineInput.trim();
    setRefineInput("");
    setRefining(true);

    setHistory(prev => [...prev, {
      role: "user",
      content: userMsg,
      timestamp: new Date().toISOString(),
    }]);

    try {
      const response = await fetch("/api/ai/resolution-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildRefinePrompt(waterbody, userRole, plan.sections, userMsg),
        }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const text = typeof data.text === 'string' ? data.text : data.content?.map((i: any) => i.type === "text" ? i.text : "").filter(Boolean).join("\n");
      if (!text) throw new Error("Empty response");
      const sections = JSON.parse(text.replace(/```json|```/g, "").trim());
      setPlan(prev => prev ? {
        ...prev,
        generatedAt: new Date().toISOString(),
        revision: prev.revision + 1,
        sections,
      } : null);
      setHistory(prev => [...prev, {
        role: "assistant",
        content: `Plan updated (revision ${plan.revision + 1}). Changes applied based on: "${userMsg}"`,
        timestamp: new Date().toISOString(),
      }]);
    } catch (e: any) {
      setHistory(prev => [...prev, {
        role: "assistant",
        content: `Failed to refine: ${e.message}. Try again.`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setRefining(false);
      refineRef.current?.focus();
    }
  }, [refineInput, plan, waterbody, userRole]);

  // ── Pre-generation State ──
  if (!plan && !generating) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-wide font-medium">Resolution Planner</p>
              <h2 className="text-xl font-bold mt-1">{waterbody.name}</h2>
              <p className="text-blue-200 text-sm">
                {waterbody.state} · {waterbody.assessmentUnitId} · {waterbody.severity} · Grade {waterbody.grade}
              </p>
            </div>
            {onClose && <button onClick={onClose} className="text-blue-200 hover:text-white">✕</button>}
          </div>
        </div>

        <div className="p-6">
          <SourceBanner dataSources={waterbody.dataSources} />

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-5">
            <h3 className="text-sm font-bold text-blue-900 mb-2">What this will generate</h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              A resolution plan tailored to your <span className="font-bold">{roleCtx.label}</span> role, based on {waterbody.dataSources.length} verified data sources
              and {waterbody.parametersExceeding.length} parameter exceedance{waterbody.parametersExceeding.length !== 1 ? "s" : ""} recorded
              for {waterbody.name}. The plan will include situation assessment, root cause analysis, stakeholder mapping,
              phased actions, co-benefits across all five water domains, cost estimates, regulatory pathway, and grant opportunities.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5 text-xs text-gray-600">
            <p className="font-semibold text-gray-700 mb-1">After generation, you can refine:</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <span className="px-2 py-1 bg-white rounded border border-gray-200">&quot;Focus more on environmental justice&quot;</span>
              <span className="px-2 py-1 bg-white rounded border border-gray-200">&quot;What if we double the budget?&quot;</span>
              <span className="px-2 py-1 bg-white rounded border border-gray-200">&quot;Remove USACE, add FEMA involvement&quot;</span>
              <span className="px-2 py-1 bg-white rounded border border-gray-200">&quot;Add living shorelines as a solution&quot;</span>
              <span className="px-2 py-1 bg-white rounded border border-gray-200">&quot;Make this emergency-level urgency&quot;</span>
              <span className="px-2 py-1 bg-white rounded border border-gray-200">&quot;Expand the groundwater section&quot;</span>
            </div>
          </div>

          {error && <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          <button
            onClick={generatePlan}
            className="w-full py-4 bg-blue-600 text-white rounded-lg text-base font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Generate Resolution Plan
          </button>
        </div>
      </div>
    );
  }

  // ── Generating State ──
  if (generating) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-5 text-white">
          <p className="text-blue-200 text-xs uppercase tracking-wide font-medium">Resolution Planner</p>
          <h2 className="text-xl font-bold mt-1">{waterbody.name}</h2>
        </div>
        <div className="p-12 text-center">
          <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-sm font-semibold text-gray-700">Analyzing {waterbody.dataSources.length} data sources...</p>
          <p className="text-xs text-gray-400 mt-2">
            Generating {roleCtx.label}-specific resolution plan for {waterbody.name}.
            Assessing {waterbody.parametersExceeding.length} exceedances across {waterbody.ms4Permits.length + waterbody.npdesDischargers.length} permits.
            This takes 30-60 seconds.
          </p>
        </div>
      </div>
    );
  }

  // ── Plan Display ──
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-4 text-white flex-shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-wide font-medium">
              Resolution Plan · {roleCtx.label} · Revision {plan!.revision}
            </p>
            <h2 className="text-xl font-bold mt-1">{plan!.waterbody}</h2>
            <p className="text-blue-200 text-sm">{new Date(plan!.generatedAt).toLocaleString()}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={() => window.print()} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm">Print</button>
            <button onClick={() => { setPlan(null); setHistory([]); }} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm">New Plan</button>
            {onClose && <button onClick={onClose} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm">Close</button>}
          </div>
        </div>
      </div>

      {/* Scrollable Plan Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 print:overflow-visible">

        <SourceBanner dataSources={waterbody.dataSources} />

        <section>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Situation Assessment</h3>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{plan!.sections.situationAssessment}</div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Root Causes</h3>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{plan!.sections.rootCauses}</div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Stakeholders & Responsibilities</h3>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{plan!.sections.stakeholders}</div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Recommended Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="text-xs font-bold text-red-700 uppercase mb-2">Immediate (0-30 days)</h4>
              <ul className="space-y-1.5">{plan!.sections.actionsImmediate.map((a, i) => (
                <li key={i} className="text-xs text-red-800"><span className="font-bold mr-1">{i+1}.</span>{a}</li>
              ))}</ul>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <h4 className="text-xs font-bold text-orange-700 uppercase mb-2">Short-Term (1-6 months)</h4>
              <ul className="space-y-1.5">{plan!.sections.actionsShortTerm.map((a, i) => (
                <li key={i} className="text-xs text-orange-800"><span className="font-bold mr-1">{i+1}.</span>{a}</li>
              ))}</ul>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-xs font-bold text-blue-700 uppercase mb-2">Long-Term (6+ months)</h4>
              <ul className="space-y-1.5">{plan!.sections.actionsLongTerm.map((a, i) => (
                <li key={i} className="text-xs text-blue-800"><span className="font-bold mr-1">{i+1}.</span>{a}</li>
              ))}</ul>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Co-Benefits Across Water Domains</h3>
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <CoBenefitsMatrix benefits={plan!.sections.coBenefits} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Cost Range</h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 whitespace-pre-wrap">{plan!.sections.costRange}</div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Regulatory Pathway</h3>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800 whitespace-pre-wrap">{plan!.sections.regulatoryPath}</div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Grant & Funding Opportunities</h3>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800 whitespace-pre-wrap">{plan!.sections.grantOpportunities}</div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Projected Outcomes</h3>
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-sm text-sky-800 whitespace-pre-wrap">{plan!.sections.projectedOutcomes}</div>
        </section>

        {/* Disclaimer */}
        <div className="pt-4 border-t border-gray-200 text-xs text-gray-400">
          <p>Generated by PEARL Intelligence Network (PIN). Informational only — not an official regulatory determination, legal opinion, or engineering design. All cost estimates are planning-level approximations. Verify with primary agency data and qualified professionals before implementation.</p>
        </div>
      </div>

      {/* Refine Bar — always visible at bottom */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white print:hidden">
        {/* Refine history */}
        {history.length > 0 && (
          <div ref={historyRef} className="max-h-32 overflow-y-auto px-4 pt-3 space-y-2">
            {history.map((msg, i) => (
              <div key={i} className={`text-xs px-3 py-1.5 rounded-lg max-w-[80%] ${
                msg.role === "user"
                  ? "bg-blue-50 text-blue-800 ml-auto"
                  : "bg-gray-50 text-gray-600"
              }`}>
                {msg.content}
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 flex gap-2">
          <input
            ref={refineRef}
            value={refineInput}
            onChange={e => setRefineInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !refining) refinePlan(); }}
            placeholder='Refine: "Focus on EJ" or "Add emergency urgency" or "What about green infrastructure?"'
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
            disabled={refining}
          />
          <button
            onClick={refinePlan}
            disabled={!refineInput.trim() || refining}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              refineInput.trim() && !refining
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {refining ? "Refining..." : "Refine"}
          </button>
        </div>
      </div>
    </div>
  );
}
