// =============================================================
// Resolution Planner v5 — Scope-Driven (National / Region / State)
// PEARL Intelligence Network (PIN)
//
// No wizard. No checkboxes. One click generates a plan based on
// the user's role and the current scope level. Refine iteratively
// with natural language prompts.
// =============================================================

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { BrandedPDFGenerator } from '@/lib/brandedPdfGenerator';

// ── Types ──

export type UserRole = "federal" | "state" | "ms4" | "ms4_utility" | "corporate" | "university" | "ngo" | "k12" | "infrastructure" | "admin";

export type PlannerScope = 'national' | 'region' | 'state';

export interface NationalContext {
  totalStates: number;
  totalWaterbodies: number;
  totalImpaired: number;
  averageScore: number;
  highAlertStates: number;
  topCauses: { cause: string; count: number }[];
  worstStates: { abbr: string; score: number; impaired: number }[];
}

export interface RegionContext {
  regionId: number;
  regionName: string;
  hq: string;
  states: string[];
  totalWaterbodies: number;
  totalImpaired: number;
  averageScore: number;
  topCauses: { cause: string; count: number }[];
  stateBreakdown: { abbr: string; score: number; impaired: number }[];
}

export interface StateContext {
  abbr: string;
  name: string;
  epaRegion: number;
  totalWaterbodies: number;
  assessed: number;
  impaired: number;
  score: number;
  grade: string;
  cat5: number; cat4a: number; cat4b: number; cat4c: number;
  topCauses: { cause: string; count: number }[];
}

export type ScopeContext =
  | { scope: 'national'; data: NationalContext }
  | { scope: 'region';   data: RegionContext }
  | { scope: 'state';    data: StateContext };

export interface ResolutionPlan {
  generatedAt: string;
  scopeLabel: string;
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

// ── Scope Helpers ──

function getScopeLabel(ctx: ScopeContext): string {
  switch (ctx.scope) {
    case 'national': return 'National Water Quality';
    case 'region':   return `EPA Region ${ctx.data.regionId} — ${ctx.data.hq}`;
    case 'state':    return `${ctx.data.name} (${ctx.data.abbr})`;
  }
}

function getScopeSubtitle(ctx: ScopeContext): string {
  switch (ctx.scope) {
    case 'national': return `${ctx.data.totalStates} states · ${ctx.data.totalWaterbodies.toLocaleString()} waterbodies · ${ctx.data.totalImpaired.toLocaleString()} impaired`;
    case 'region':   return `${ctx.data.states.join(', ')} · ${ctx.data.totalWaterbodies.toLocaleString()} waterbodies · ${ctx.data.totalImpaired.toLocaleString()} impaired`;
    case 'state':    return `EPA Region ${ctx.data.epaRegion} · ${ctx.data.totalWaterbodies.toLocaleString()} waterbodies · Grade ${ctx.data.grade}`;
  }
}

// ── Scope Summary Badge ──

function ScopeSummaryBadge({ scopeContext }: { scopeContext: ScopeContext }) {
  const { scope, data } = scopeContext;

  const stats: { label: string; value: string }[] = [];
  if (scope === 'national') {
    const d = data as NationalContext;
    stats.push(
      { label: 'States', value: String(d.totalStates) },
      { label: 'Waterbodies', value: d.totalWaterbodies.toLocaleString() },
      { label: 'Impaired', value: d.totalImpaired.toLocaleString() },
      { label: 'High-Alert States', value: String(d.highAlertStates) },
    );
  } else if (scope === 'region') {
    const d = data as RegionContext;
    stats.push(
      { label: 'States', value: String(d.states.length) },
      { label: 'Waterbodies', value: d.totalWaterbodies.toLocaleString() },
      { label: 'Impaired', value: d.totalImpaired.toLocaleString() },
      { label: 'Avg Score', value: d.averageScore >= 0 ? String(d.averageScore) : 'N/A' },
    );
  } else {
    const d = data as StateContext;
    stats.push(
      { label: 'Waterbodies', value: d.totalWaterbodies.toLocaleString() },
      { label: 'Assessed', value: d.assessed.toLocaleString() },
      { label: 'Impaired', value: d.impaired.toLocaleString() },
      { label: 'Grade', value: d.grade },
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
        {scope === 'national' ? 'National' : scope === 'region' ? 'Regional' : 'State'} Scope
      </p>
      <div className="flex flex-wrap gap-3">
        {stats.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-600">
            <span className="font-medium text-gray-800">{s.value}</span>
            <span className="text-gray-400">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Scope-Specific Prompt Builders ──

const JSON_SCHEMA_INSTRUCTION = `Respond ONLY with valid JSON, no markdown, no backticks:
{
  "situationAssessment": "2-3 paragraphs: what is wrong, how bad, who is affected, why this demands attention now.",
  "rootCauses": "What is causing the impairments. Cite specific patterns, regions, infrastructure failures from the data.",
  "stakeholders": "Who must be involved. For each: name/office, their authority, and the specific action they should take.",
  "actionsImmediate": ["0-30 day actions appropriate to the role's authority"],
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
  "costRange": "Planning-level cost estimates by action tier. Use ranges. Reference comparable programs.",
  "regulatoryPath": "Regulatory framework, enforcement options, compliance timeline.",
  "grantOpportunities": "Specific federal and state programs: name, typical range, eligibility, next deadline if known.",
  "projectedOutcomes": "What improves and by when if this plan is executed. Quantify where possible."
}`;

function buildNationalPrompt(ctx: NationalContext, role: UserRole): string {
  const rc = ROLE_CONTEXT[role];
  const worstList = ctx.worstStates.map(s => `${s.abbr} (score: ${s.score}, impaired: ${s.impaired.toLocaleString()})`).join(', ');
  const causeList = ctx.topCauses.slice(0, 10).map(c => `${c.cause} (${c.count.toLocaleString()})`).join(', ');

  return `You are a senior water quality engineer generating a National Resolution Plan.

YOUR AUDIENCE: ${rc.label} role with authority over: ${rc.authority}

NATIONAL OVERVIEW:
- ${ctx.totalStates} states reporting
- ${ctx.totalWaterbodies.toLocaleString()} total waterbodies tracked
- ${ctx.totalImpaired.toLocaleString()} impaired waterbodies (Cat 4 + Cat 5)
- ${ctx.highAlertStates} states with high alert levels
- Average national score: ${ctx.averageScore >= 0 ? ctx.averageScore : 'Insufficient data'}

WORST-PERFORMING STATES: ${worstList || 'No state data available'}

TOP CAUSES OF IMPAIRMENT: ${causeList || 'No cause data available'}

PLAN FOCUS: ${rc.planFocus}

Generate a comprehensive National Resolution Plan. This is a strategic, nationwide plan — identify systemic issues, interstate patterns, regional disparities, and national-level actions. Be specific and actionable. Use regulatory language appropriate for ${rc.label} briefings.

IMPORTANT: Base your analysis only on the data provided above. Do not fabricate statistics.

${JSON_SCHEMA_INSTRUCTION}`;
}

function buildRegionPrompt(ctx: RegionContext, role: UserRole): string {
  const rc = ROLE_CONTEXT[role];
  const stateList = ctx.stateBreakdown.map(s => `${s.abbr} (score: ${s.score}, impaired: ${s.impaired.toLocaleString()})`).join(', ');
  const causeList = ctx.topCauses.slice(0, 10).map(c => `${c.cause} (${c.count.toLocaleString()})`).join(', ');

  return `You are a senior water quality engineer generating a Regional Resolution Plan.

YOUR AUDIENCE: ${rc.label} role with authority over: ${rc.authority}

EPA ${ctx.regionName.toUpperCase()} (HQ: ${ctx.hq}):
- Covers states: ${ctx.states.join(', ')}
- ${ctx.totalWaterbodies.toLocaleString()} total waterbodies tracked
- ${ctx.totalImpaired.toLocaleString()} impaired waterbodies (Cat 4 + Cat 5)
- Average regional score: ${ctx.averageScore >= 0 ? ctx.averageScore : 'Insufficient data'}

STATE BREAKDOWN: ${stateList || 'No state data available'}

TOP CAUSES OF IMPAIRMENT: ${causeList || 'No cause data available'}

PLAN FOCUS: ${rc.planFocus}

Generate a comprehensive Regional Resolution Plan for EPA ${ctx.regionName}. Focus on intra-regional coordination, state-to-state disparities, shared watershed issues, and region-specific regulatory actions. Be specific and actionable.

IMPORTANT: Base your analysis only on the data provided above. Do not fabricate statistics.

${JSON_SCHEMA_INSTRUCTION}`;
}

function buildStatePrompt(ctx: StateContext, role: UserRole): string {
  const rc = ROLE_CONTEXT[role];
  const causeList = ctx.topCauses.slice(0, 10).map(c => `${c.cause} (${c.count.toLocaleString()})`).join(', ');

  return `You are a senior water quality engineer generating a State Resolution Plan.

YOUR AUDIENCE: ${rc.label} role with authority over: ${rc.authority}

STATE: ${ctx.name} (${ctx.abbr}) — EPA Region ${ctx.epaRegion}
- ${ctx.totalWaterbodies.toLocaleString()} total waterbodies
- ${ctx.assessed.toLocaleString()} assessed
- ${ctx.impaired.toLocaleString()} impaired (Cat 4 + Cat 5)
- Score: ${ctx.score >= 0 ? ctx.score : 'N/A'} | Grade: ${ctx.grade}
- Category 5 (needs TMDL): ${ctx.cat5.toLocaleString()}
- Category 4a (TMDL established): ${ctx.cat4a.toLocaleString()}
- Category 4b (alternative controls): ${ctx.cat4b.toLocaleString()}
- Category 4c (pollution not caused by pollutant): ${ctx.cat4c.toLocaleString()}

TOP CAUSES OF IMPAIRMENT: ${causeList || 'No cause data available'}

PLAN FOCUS: ${rc.planFocus}

Generate a comprehensive State Resolution Plan for ${ctx.name}. Focus on state-specific regulatory actions, priority waterbodies, TMDL development, permit conditions, and coordination with EPA Region ${ctx.epaRegion}. Be specific and actionable.

IMPORTANT: Base your analysis only on the data provided above. Do not fabricate statistics.

${JSON_SCHEMA_INSTRUCTION}`;
}

// ── Scope-Aware Initial Prompt Router ──

function buildInitialPrompt(ctx: ScopeContext, role: UserRole): string {
  switch (ctx.scope) {
    case 'national': return buildNationalPrompt(ctx.data, role);
    case 'region':   return buildRegionPrompt(ctx.data, role);
    case 'state':    return buildStatePrompt(ctx.data, role);
  }
}

// ── Scope-Aware Refine Prompt ──

function buildRefinePrompt(
  ctx: ScopeContext,
  role: UserRole,
  currentPlan: PlanSections,
  refinement: string
): string {
  const scopeLabel = getScopeLabel(ctx);
  return `You previously generated a Resolution Plan for ${scopeLabel} for a ${ROLE_CONTEXT[role].label} user.

CURRENT PLAN (summarized):
- Situation: ${currentPlan.situationAssessment.slice(0, 300)}...
- Actions: ${currentPlan.actionsImmediate.length} immediate, ${currentPlan.actionsShortTerm.length} short-term, ${currentPlan.actionsLongTerm.length} long-term
- Solutions with co-benefits: ${currentPlan.coBenefits.map(c => c.solution).join(", ")}

USER REFINEMENT REQUEST: "${refinement}"

Revise the plan according to the user's request. Return the COMPLETE updated plan in the same JSON structure. Do not fabricate data sources or statistics.

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
  scopeContext: ScopeContext;
  userRole: UserRole;
  onClose?: () => void;
}

export default function ResolutionPlanner({ scopeContext, userRole, onClose }: ResolutionPlannerProps) {
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
  const scopeLabel = getScopeLabel(scopeContext);
  const scopeSubtitle = getScopeSubtitle(scopeContext);

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
          prompt: buildInitialPrompt(scopeContext, userRole),
        }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const text = typeof data.text === 'string' ? data.text : data.content?.map((i: any) => i.type === "text" ? i.text : "").filter(Boolean).join("\n");
      if (!text) throw new Error("Empty response from AI");
      const sections = JSON.parse(text.replace(/```json|```/g, "").trim());
      setPlan({
        generatedAt: new Date().toISOString(),
        scopeLabel,
        role: userRole,
        revision: 1,
        sections,
      });
    } catch (e: any) {
      setError(e.message || "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  }, [scopeContext, userRole, scopeLabel]);

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
          prompt: buildRefinePrompt(scopeContext, userRole, plan.sections, userMsg),
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
  }, [refineInput, plan, scopeContext, userRole]);

  // ── What-will-be-analyzed description ──
  const analysisDescription = (() => {
    switch (scopeContext.scope) {
      case 'national': {
        const d = scopeContext.data;
        return `A national resolution plan tailored to your ${roleCtx.label} role, analyzing ${d.totalStates} states with ${d.totalImpaired.toLocaleString()} impaired waterbodies. The plan will identify systemic issues, interstate patterns, and national-level actions including situation assessment, root cause analysis, stakeholder mapping, phased actions, co-benefits, cost estimates, regulatory pathway, and grant opportunities.`;
      }
      case 'region': {
        const d = scopeContext.data;
        return `A regional resolution plan for EPA ${d.regionName} (HQ: ${d.hq}), covering ${d.states.join(', ')}. Analyzing ${d.totalImpaired.toLocaleString()} impaired waterbodies across ${d.states.length} states. The plan will address intra-regional coordination, shared watershed issues, and region-specific regulatory actions.`;
      }
      case 'state': {
        const d = scopeContext.data;
        return `A state resolution plan for ${d.name} (${d.abbr}), EPA Region ${d.epaRegion}. Analyzing ${d.impaired.toLocaleString()} impaired waterbodies (Cat 5: ${d.cat5.toLocaleString()}, Cat 4a: ${d.cat4a.toLocaleString()}, Cat 4b: ${d.cat4b.toLocaleString()}) out of ${d.assessed.toLocaleString()} assessed. The plan will include state-specific regulatory actions, priority waterbodies, and TMDL development timelines.`;
      }
    }
  })();

  // ── Pre-generation State ──
  if (!plan && !generating) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-wide font-medium">Resolution Planner</p>
              <h2 className="text-xl font-bold mt-1">{scopeLabel}</h2>
              <p className="text-blue-200 text-sm">{scopeSubtitle}</p>
            </div>
            {onClose && <button onClick={onClose} className="text-blue-200 hover:text-white">&#x2715;</button>}
          </div>
        </div>

        <div className="p-6">
          <ScopeSummaryBadge scopeContext={scopeContext} />

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-5">
            <h3 className="text-sm font-bold text-blue-900 mb-2">What this will generate</h3>
            <p className="text-sm text-blue-800 leading-relaxed">{analysisDescription}</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5 text-xs text-gray-600">
            <p className="font-semibold text-gray-700 mb-1">After generation, you can refine:</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <span className="px-2 py-1 bg-white rounded border border-gray-200">&quot;Focus more on environmental justice&quot;</span>
              <span className="px-2 py-1 bg-white rounded border border-gray-200">&quot;What if we double the budget?&quot;</span>
              <span className="px-2 py-1 bg-white rounded border border-gray-200">&quot;Prioritize Cat 5 waterbodies&quot;</span>
              <span className="px-2 py-1 bg-white rounded border border-gray-200">&quot;Add green infrastructure solutions&quot;</span>
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
          <h2 className="text-xl font-bold mt-1">{scopeLabel}</h2>
        </div>
        <div className="p-12 text-center">
          <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-sm font-semibold text-gray-700">Analyzing {scopeContext.scope}-level data...</p>
          <p className="text-xs text-gray-400 mt-2">
            Generating {roleCtx.label}-specific resolution plan for {scopeLabel}. This takes 30-60 seconds.
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
            <h2 className="text-xl font-bold mt-1">{plan!.scopeLabel}</h2>
            <p className="text-blue-200 text-sm">{new Date(plan!.generatedAt).toLocaleString()}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={async () => {
              if (!plan) return;
              const pdf = new BrandedPDFGenerator();
              await pdf.loadLogo();
              pdf.initialize();
              pdf.addTitle(`Resolution Plan — ${plan.scopeLabel}`);
              pdf.addMetadata('Role', roleCtx.label);
              pdf.addMetadata('Revision', String(plan.revision));
              pdf.addMetadata('Generated', new Date(plan.generatedAt).toLocaleString());
              pdf.addSpacer(5);
              pdf.addSubtitle('Situation Assessment');
              pdf.addText(plan.sections.situationAssessment);
              pdf.addSpacer(3);
              pdf.addSubtitle('Root Causes');
              pdf.addText(plan.sections.rootCauses);
              pdf.addSpacer(3);
              pdf.addSubtitle('Stakeholders & Responsibilities');
              pdf.addText(plan.sections.stakeholders);
              pdf.addSpacer(3);
              pdf.addSubtitle('Recommended Actions — Immediate (0-30 days)');
              plan.sections.actionsImmediate.forEach((a, i) => pdf.addText(`${i + 1}. ${a}`, { indent: 2 }));
              pdf.addSpacer(2);
              pdf.addSubtitle('Recommended Actions — Short-Term (1-6 months)');
              plan.sections.actionsShortTerm.forEach((a, i) => pdf.addText(`${i + 1}. ${a}`, { indent: 2 }));
              pdf.addSpacer(2);
              pdf.addSubtitle('Recommended Actions — Long-Term (6+ months)');
              plan.sections.actionsLongTerm.forEach((a, i) => pdf.addText(`${i + 1}. ${a}`, { indent: 2 }));
              pdf.addSpacer(3);
              if (plan.sections.coBenefits.length > 0) {
                pdf.addSubtitle('Co-Benefits Across Water Domains');
                pdf.addTable(
                  ['Solution', 'Surface Water', 'Drinking Water', 'Wastewater', 'Groundwater', 'Stormwater'],
                  plan.sections.coBenefits.map(b => [b.solution, b.surfaceWater || '—', b.drinkingWater || '—', b.wastewater || '—', b.groundwater || '—', b.stormwater || '—'])
                );
              }
              pdf.addSubtitle('Cost Range');
              pdf.addText(plan.sections.costRange);
              pdf.addSpacer(3);
              pdf.addSubtitle('Regulatory Pathway');
              pdf.addText(plan.sections.regulatoryPath);
              pdf.addSpacer(3);
              pdf.addSubtitle('Grant & Funding Opportunities');
              pdf.addText(plan.sections.grantOpportunities);
              pdf.addSpacer(3);
              pdf.addSubtitle('Projected Outcomes');
              pdf.addText(plan.sections.projectedOutcomes);
              pdf.addSpacer(5);
              pdf.addDivider();
              pdf.addText('Generated by PEARL Intelligence Network (PIN). Informational only — not an official regulatory determination, legal opinion, or engineering design. All cost estimates are planning-level approximations. Verify with primary agency data and qualified professionals before implementation.', { fontSize: 8 });
              const safeLabel = plan.scopeLabel.replace(/[^a-zA-Z0-9]/g, '_');
              const dateStr = new Date().toISOString().slice(0, 10);
              pdf.download(`PEARL_Resolution_Plan_${safeLabel}_${dateStr}.pdf`);
            }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-white/30 text-blue-900 font-semibold hover:bg-blue-50 rounded text-sm shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export PDF
            </button>
            <button onClick={() => { setPlan(null); setHistory([]); }} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm">New Plan</button>
            {onClose && <button onClick={onClose} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm">Close</button>}
          </div>
        </div>
      </div>

      {/* Scrollable Plan Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 print:overflow-visible">

        <ScopeSummaryBadge scopeContext={scopeContext} />

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
