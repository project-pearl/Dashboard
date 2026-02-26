// =============================================================
// Response Planner v6 — Scope-Driven (National / Region / State)
// PEARL Intelligence Network (PIN)
//
// Auto-generates a response plan on mount based on the user's
// role and current scope level. Data reliability assessment
// renders before any action items. Refine iteratively with
// natural language prompts.
// =============================================================

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
// html2pdf.js loaded dynamically in export handler (code-split)

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

export interface DataReliabilityReport {
  overallReliable: boolean;
  staleCaches: string[];
  missingCaches: string[];
  healthyCaches: string[];
  staleStateCount: number;
  totalCacheCount: number;
  loadedCacheCount: number;
  recommendation: string;
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
}

BRANDING RULE: Never reference PIN, PEARL, PEARL Intelligence Network, or any platform-specific branding in the plan content. Recommended actions should reference capabilities generically — "deploy unified water quality intelligence platform" or "establish cross-agency data integration" — not specific products. The plan is the product. The plan should not sell the product.`;

function buildDataReliabilitySection(dr?: DataReliabilityReport): string {
  if (!dr) return '';
  const lines = ['\nDATA RELIABILITY ASSESSMENT:'];
  if (dr.overallReliable) {
    lines.push(`- Status: DATA SUFFICIENT (${dr.loadedCacheCount}/${dr.totalCacheCount} caches loaded)`);
    lines.push(`- Healthy sources: ${dr.healthyCaches.join(', ') || 'none'}`);
  } else {
    lines.push(`- Status: DATA PIPELINE REPAIR NEEDED (${dr.loadedCacheCount}/${dr.totalCacheCount} caches loaded)`);
    if (dr.staleCaches.length > 0) lines.push(`- Stale caches: ${dr.staleCaches.join(', ')}`);
    if (dr.missingCaches.length > 0) lines.push(`- Missing/unloaded caches: ${dr.missingCaches.join(', ')}`);
    lines.push(`- ${dr.staleStateCount} states have stale or missing ATTAINS data`);
    lines.push('- CRITICAL INSTRUCTION: Because the data pipeline is unreliable, the #1 IMMEDIATE ACTION must be "Repair and refresh data pipelines" with specific steps to restore the stale/missing data sources listed above. All subsequent recommendations should note they are based on potentially incomplete data.');
  }
  return lines.join('\n') + '\n';
}

function buildNationalPrompt(ctx: NationalContext, role: UserRole, dataReliability?: DataReliabilityReport): string {
  const rc = ROLE_CONTEXT[role];
  const worstList = ctx.worstStates.map(s => `${s.abbr} (score: ${s.score}, impaired: ${s.impaired.toLocaleString()})`).join(', ');
  const causeList = ctx.topCauses.slice(0, 10).map(c => `${c.cause} (${c.count.toLocaleString()})`).join(', ');

  return `You are a senior water quality engineer generating a National Response Plan.
This plan is produced by the PEARL Intelligence Network (PIN) — an EPA water quality data platform. PIN stands for PEARL Intelligence Network. PEARL stands for Programmable Eco-Adaptive Reef Lattice.

YOUR AUDIENCE: ${rc.label} role with authority over: ${rc.authority}
${buildDataReliabilitySection(dataReliability)}
NATIONAL OVERVIEW:
- ${ctx.totalStates} states reporting
- ${ctx.totalWaterbodies.toLocaleString()} total waterbodies tracked
- ${ctx.totalImpaired.toLocaleString()} impaired waterbodies (Cat 4 + Cat 5)
- ${ctx.highAlertStates} states with high alert levels
- Average national score: ${ctx.averageScore >= 0 ? ctx.averageScore : 'Insufficient data'}

WORST-PERFORMING STATES: ${worstList || 'No state data available'}

TOP CAUSES OF IMPAIRMENT: ${causeList || 'No cause data available'}

PLAN FOCUS: ${rc.planFocus}

Generate a comprehensive National Response Plan. This is a strategic, nationwide plan — identify systemic issues, interstate patterns, regional disparities, and national-level actions. Be specific and actionable. Use regulatory language appropriate for ${rc.label} briefings.

IMPORTANT: Base your analysis only on the data provided above. Do not fabricate statistics.

${JSON_SCHEMA_INSTRUCTION}`;
}

function buildRegionPrompt(ctx: RegionContext, role: UserRole, dataReliability?: DataReliabilityReport): string {
  const rc = ROLE_CONTEXT[role];
  const stateList = ctx.stateBreakdown.map(s => `${s.abbr} (score: ${s.score}, impaired: ${s.impaired.toLocaleString()})`).join(', ');
  const causeList = ctx.topCauses.slice(0, 10).map(c => `${c.cause} (${c.count.toLocaleString()})`).join(', ');

  return `You are a senior water quality engineer generating a Regional Response Plan.
This plan is produced by the PEARL Intelligence Network (PIN) — an EPA water quality data platform. PIN stands for PEARL Intelligence Network. PEARL stands for Programmable Eco-Adaptive Reef Lattice.

YOUR AUDIENCE: ${rc.label} role with authority over: ${rc.authority}
${buildDataReliabilitySection(dataReliability)}
EPA ${ctx.regionName.toUpperCase()} (HQ: ${ctx.hq}):
- Covers states: ${ctx.states.join(', ')}
- ${ctx.totalWaterbodies.toLocaleString()} total waterbodies tracked
- ${ctx.totalImpaired.toLocaleString()} impaired waterbodies (Cat 4 + Cat 5)
- Average regional score: ${ctx.averageScore >= 0 ? ctx.averageScore : 'Insufficient data'}

STATE BREAKDOWN: ${stateList || 'No state data available'}

TOP CAUSES OF IMPAIRMENT: ${causeList || 'No cause data available'}

PLAN FOCUS: ${rc.planFocus}

Generate a comprehensive Regional Response Plan for EPA ${ctx.regionName}. Focus on intra-regional coordination, state-to-state disparities, shared watershed issues, and region-specific regulatory actions. Be specific and actionable.

IMPORTANT: Base your analysis only on the data provided above. Do not fabricate statistics.

${JSON_SCHEMA_INSTRUCTION}`;
}

function buildStatePrompt(ctx: StateContext, role: UserRole, dataReliability?: DataReliabilityReport): string {
  const rc = ROLE_CONTEXT[role];
  const causeList = ctx.topCauses.slice(0, 10).map(c => `${c.cause} (${c.count.toLocaleString()})`).join(', ');

  return `You are a senior water quality engineer generating a State Response Plan.
This plan is produced by the PEARL Intelligence Network (PIN) — an EPA water quality data platform. PIN stands for PEARL Intelligence Network. PEARL stands for Programmable Eco-Adaptive Reef Lattice.

YOUR AUDIENCE: ${rc.label} role with authority over: ${rc.authority}
${buildDataReliabilitySection(dataReliability)}
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

Generate a comprehensive State Response Plan for ${ctx.name}. Focus on state-specific regulatory actions, priority waterbodies, TMDL development, permit conditions, and coordination with EPA Region ${ctx.epaRegion}. Be specific and actionable.

IMPORTANT: Base your analysis only on the data provided above. Do not fabricate statistics.

${JSON_SCHEMA_INSTRUCTION}`;
}

// ── Scope-Aware Initial Prompt Router ──

function buildInitialPrompt(ctx: ScopeContext, role: UserRole, scenarioContext?: string, dataReliability?: DataReliabilityReport): string {
  let prompt: string;
  switch (ctx.scope) {
    case 'national': prompt = buildNationalPrompt(ctx.data, role, dataReliability); break;
    case 'region':   prompt = buildRegionPrompt(ctx.data, role, dataReliability); break;
    case 'state':    prompt = buildStatePrompt(ctx.data, role, dataReliability); break;
  }
  if (scenarioContext) {
    prompt = prompt.replace(
      JSON_SCHEMA_INSTRUCTION,
      `SCENARIO CONTEXT (use this to frame the situation assessment and narrative):\n${scenarioContext}\n\n${JSON_SCHEMA_INSTRUCTION}`
    );
  }
  return prompt;
}

// ── Scope-Aware Refine Prompt ──

function buildRefinePrompt(
  ctx: ScopeContext,
  role: UserRole,
  currentPlan: PlanSections,
  refinement: string
): string {
  const scopeLabel = getScopeLabel(ctx);
  return `You previously generated a Response Plan for ${scopeLabel} for a ${ROLE_CONTEXT[role].label} user.

CURRENT PLAN (summarized):
- Situation: ${currentPlan.situationAssessment.slice(0, 300)}...
- Actions: ${currentPlan.actionsImmediate.length} immediate, ${currentPlan.actionsShortTerm.length} short-term, ${currentPlan.actionsLongTerm.length} long-term
- Solutions with co-benefits: ${currentPlan.coBenefits.map(c => c.solution).join(", ")}

USER REFINEMENT REQUEST: "${refinement}"

Revise the plan according to the user's request. Return the COMPLETE updated plan in the same JSON structure. Do not fabricate data sources or statistics.

BRANDING RULE: Never reference PIN, PEARL, PEARL Intelligence Network, or any platform-specific branding in the plan content. Reference capabilities generically — not specific products.

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
  /** Optional scenario narrative injected into the AI prompt (used by What-If Simulator). */
  scenarioContext?: string;
  /** Data reliability report computed from cache-status — drives the reliability banner. */
  dataReliability?: DataReliabilityReport;
  /** When false, delays auto-generation until upstream data (e.g. ATTAINS) has loaded. Defaults to true. */
  dataReady?: boolean;
}

export default function ResolutionPlanner({ scopeContext, userRole, onClose, scenarioContext, dataReliability, dataReady = true }: ResolutionPlannerProps) {
  const [plan, setPlan] = useState<ResolutionPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refineInput, setRefineInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [history, setHistory] = useState<RefineMessage[]>([]);
  const refineRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const hasAutoGenerated = useRef(false);

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
          prompt: buildInitialPrompt(scopeContext, userRole, scenarioContext, dataReliability),
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
  }, [scopeContext, userRole, scopeLabel, dataReliability]);

  // ── Auto-generate once data is ready ──
  useEffect(() => {
    if (!hasAutoGenerated.current && !plan && !generating && dataReady) {
      hasAutoGenerated.current = true;
      generatePlan();
    }
  }, [generatePlan, plan, generating, dataReady]);

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
        return `A national response plan tailored to your ${roleCtx.label} role, analyzing ${d.totalStates} states with ${d.totalImpaired.toLocaleString()} impaired waterbodies. The plan will identify systemic issues, interstate patterns, and national-level actions including situation assessment, root cause analysis, stakeholder mapping, phased actions, co-benefits, cost estimates, regulatory pathway, and grant opportunities.`;
      }
      case 'region': {
        const d = scopeContext.data;
        return `A regional response plan for EPA ${d.regionName} (HQ: ${d.hq}), covering ${d.states.join(', ')}. Analyzing ${d.totalImpaired.toLocaleString()} impaired waterbodies across ${d.states.length} states. The plan will address intra-regional coordination, shared watershed issues, and region-specific regulatory actions.`;
      }
      case 'state': {
        const d = scopeContext.data;
        return `A state response plan for ${d.name} (${d.abbr}), EPA Region ${d.epaRegion}. Analyzing ${d.impaired.toLocaleString()} impaired waterbodies (Cat 5: ${d.cat5.toLocaleString()}, Cat 4a: ${d.cat4a.toLocaleString()}, Cat 4b: ${d.cat4b.toLocaleString()}) out of ${d.assessed.toLocaleString()} assessed. The plan will include state-specific regulatory actions, priority waterbodies, and TMDL development timelines.`;
      }
    }
  })();

  // ── Generating / Pre-generation State (auto-generate fires on mount) ──
  if (!plan) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-wide font-medium">Response Planner</p>
              <h2 className="text-xl font-bold mt-1">{scopeLabel}</h2>
              <p className="text-blue-200 text-sm">{scopeSubtitle}</p>
            </div>
            {onClose && <button onClick={onClose} className="text-blue-200 hover:text-white">&#x2715;</button>}
          </div>
        </div>
        <div className="p-8">
          {/* Data Reliability Banner */}
          {dataReliability && (
            <div className={`rounded-lg p-4 mb-5 border ${dataReliability.overallReliable
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'}`}>
              <h3 className={`text-sm font-bold mb-1 ${dataReliability.overallReliable ? 'text-green-800' : 'text-amber-800'}`}>
                {dataReliability.overallReliable ? 'Data Sources Verified' : 'Data Pipeline Repair Required'}
              </h3>
              <p className={`text-xs ${dataReliability.overallReliable ? 'text-green-700' : 'text-amber-700'}`}>
                {dataReliability.recommendation} — {dataReliability.loadedCacheCount}/{dataReliability.totalCacheCount} caches loaded
              </p>
            </div>
          )}

          {error ? (
            <div className="text-center">
              <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              <button onClick={generatePlan} className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors">
                Retry
              </button>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-sm font-semibold text-gray-700">
                {dataReady ? `Analyzing ${scopeContext.scope}-level data...` : 'Loading data sources...'}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {dataReady
                  ? `Generating ${roleCtx.label}-specific response plan for ${scopeLabel}. This takes 30-60 seconds.`
                  : 'Waiting for ATTAINS and other data sources to finish loading before generating plan.'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Export PDF handler ──
  const handleExportPDF = async () => {
    const el = pdfContentRef.current;
    if (!el || !plan) return;

    // Show pdf-only elements, hide no-pdf elements
    const pdfOnlyEls = el.querySelectorAll<HTMLElement>('.pdf-only');
    const noPdfEls = el.querySelectorAll<HTMLElement>('.no-pdf');
    pdfOnlyEls.forEach(e => e.style.display = 'block');
    noPdfEls.forEach(e => e.style.display = 'none');

    // Temporarily remove scroll constraint so html2canvas captures full content
    const scrollDiv = el.querySelector<HTMLElement>('.plan-scroll-area');
    if (scrollDiv) {
      scrollDiv.style.overflow = 'visible';
      scrollDiv.style.maxHeight = 'none';
    }

    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `PIN_Resolution_Plan_${dateStr}.pdf`;

      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({
        margin: [0.3, 0.4, 0.7, 0.4],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true, windowWidth: 1000 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.action-card', '.domain-table'] },
      }).from(el).toPdf().get('pdf').then((pdf: any) => {
        const totalPages = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();

        // PDF metadata
        pdf.setProperties({
          title: 'PIN Resolution Plan \u2014 AI-Generated Analysis',
          author: 'PEARL Intelligence Network (AI-Generated)',
          subject: 'Decision Support \u2014 Not Regulatory Guidance',
          creator: 'PIN v1.0 \u2014 pinwater.org',
        });

        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);

          // Diagonal watermark
          pdf.saveGraphicsState();
          const gState = new pdf.GState({ opacity: 0.08 });
          pdf.setGState(gState);
          pdf.setFontSize(48);
          pdf.setTextColor(150, 150, 150);
          pdf.text('AI-GENERATED DRAFT', pageWidth / 2, 5.5, { angle: 45, align: 'center' });
          pdf.restoreGraphicsState();

          // Footer disclaimer
          pdf.setFontSize(7);
          pdf.setTextColor(128, 128, 128);
          pdf.text(
            'Generated by PEARL Intelligence Network (PIN) using AI modeling. '
            + 'Not a regulatory determination, legal opinion, or engineering design.',
            0.4, 10.25
          );
          pdf.text(
            'All cost estimates are planning-level approximations. '
            + 'Verify with primary agency data and qualified professionals.',
            0.4, 10.4
          );
          pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 0.4, 10.4, { align: 'right' });
        }
      }).save();
    } finally {
      // Restore visibility and scroll
      pdfOnlyEls.forEach(e => e.style.display = '');
      noPdfEls.forEach(e => e.style.display = '');
      if (scrollDiv) {
        scrollDiv.style.overflow = '';
        scrollDiv.style.maxHeight = '';
      }
    }
  };

  // ── Plan Display ──
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
      {/* === PDF capture area — includes header + content, excludes refine bar === */}
      <div ref={pdfContentRef}>

        {/* PDF-only branded header — hidden on screen, shown during export */}
        <div className="pdf-only" style={{ display: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0A1128, #1B2845)',
            padding: '20px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ color: '#3ABDB0', fontSize: '22px', fontWeight: 800 }}>
                PEARL Intelligence Network
              </div>
              <div style={{ color: 'rgba(180,185,200,0.8)', fontSize: '11px', marginTop: 2 }}>
                National Water Quality Intelligence Platform
              </div>
            </div>
            <div style={{ color: '#D4A56A', fontSize: '12px' }}>
              pinwater.org
            </div>
          </div>
          <div style={{ height: 3, background: '#3ABDB0' }} />
        </div>

        {/* PDF-only AI disclosure banner */}
        <div className="pdf-only" style={{ display: 'none' }}>
          <div style={{
            background: '#FFF3CD',
            borderLeft: '4px solid #D4A017',
            padding: '8px 14px',
            marginBottom: 0,
          }}>
            <div style={{ color: '#664D03', fontSize: '10px', fontWeight: 700 }}>
              {'\u26A0'} AI-GENERATED ANALYSIS
            </div>
            <div style={{ color: '#664D03', fontSize: '9px', marginTop: 2 }}>
              Produced by PIN&apos;s AI modeling engine. Decision-support tool — not an official plan of action.
            </div>
          </div>
        </div>

        {/* Blue title header (captured in PDF) */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-4 text-white flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-wide font-medium">
                Response Plan · {roleCtx.label} · Revision {plan!.revision}
              </p>
              <h2 className="text-xl font-bold mt-1">{plan!.scopeLabel}</h2>
              <p className="text-blue-200 text-sm">{new Date(plan!.generatedAt).toLocaleString()}</p>
            </div>
            <div className="no-pdf flex gap-2 print:hidden">
              <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-white/30 text-blue-900 font-semibold hover:bg-blue-50 rounded text-sm shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export PDF
              </button>
              <button onClick={() => { setPlan(null); setHistory([]); }} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm">New Plan</button>
              {onClose && <button onClick={onClose} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm">Close</button>}
            </div>
          </div>
        </div>

        {/* Scrollable Plan Content */}
        <div className="plan-scroll-area flex-1 overflow-y-auto p-6 space-y-6 print:overflow-visible">

        <ScopeSummaryBadge scopeContext={scopeContext} />

        {/* Data Reliability Banner */}
        {dataReliability && (
          <div className={`rounded-lg p-4 border ${dataReliability.overallReliable
            ? 'bg-green-50 border-green-200'
            : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-start gap-3">
              <span className={`text-lg mt-0.5 ${dataReliability.overallReliable ? 'text-green-600' : 'text-amber-500'}`}>
                {dataReliability.overallReliable ? '\u2713' : '\u26A0'}
              </span>
              <div className="flex-1">
                <h3 className={`text-sm font-bold ${dataReliability.overallReliable ? 'text-green-800' : 'text-amber-800'}`}>
                  {dataReliability.overallReliable ? 'Data Sources Verified' : 'Data Pipeline Repair Required'}
                </h3>
                <p className={`text-xs mt-1 ${dataReliability.overallReliable ? 'text-green-700' : 'text-amber-700'}`}>
                  {dataReliability.loadedCacheCount}/{dataReliability.totalCacheCount} data sources loaded.{' '}
                  {dataReliability.overallReliable
                    ? `Healthy: ${dataReliability.healthyCaches.slice(0, 5).join(', ')}${dataReliability.healthyCaches.length > 5 ? ` +${dataReliability.healthyCaches.length - 5} more` : ''}`
                    : <>
                        {dataReliability.staleCaches.length > 0 && <>Stale: {dataReliability.staleCaches.join(', ')}. </>}
                        {dataReliability.missingCaches.length > 0 && <>Missing: {dataReliability.missingCaches.join(', ')}. </>}
                        Actions below may be based on incomplete data.
                      </>
                  }
                </p>
                <p className="text-[10px] text-gray-500 mt-2 italic">
                  This response plan is based on currently available data. Data accuracy can be improved by updating source parameters and refreshing data pipelines.
                </p>
              </div>
            </div>
          </div>
        )}

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
            <div className="action-card bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="text-xs font-bold text-red-700 uppercase mb-2">Immediate (0-30 days)</h4>
              <ul className="space-y-1.5">{plan!.sections.actionsImmediate.map((a, i) => (
                <li key={i} className="text-xs text-red-800"><span className="font-bold mr-1">{i+1}.</span>{a}</li>
              ))}</ul>
            </div>
            <div className="action-card bg-orange-50 border border-orange-200 rounded-lg p-3">
              <h4 className="text-xs font-bold text-orange-700 uppercase mb-2">Short-Term (1-6 months)</h4>
              <ul className="space-y-1.5">{plan!.sections.actionsShortTerm.map((a, i) => (
                <li key={i} className="text-xs text-orange-800"><span className="font-bold mr-1">{i+1}.</span>{a}</li>
              ))}</ul>
            </div>
            <div className="action-card bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-xs font-bold text-blue-700 uppercase mb-2">Long-Term (6+ months)</h4>
              <ul className="space-y-1.5">{plan!.sections.actionsLongTerm.map((a, i) => (
                <li key={i} className="text-xs text-blue-800"><span className="font-bold mr-1">{i+1}.</span>{a}</li>
              ))}</ul>
            </div>
          </div>
        </section>

        <section className="pdf-page-break">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Co-Benefits Across Water Domains</h3>
          <div className="domain-table bg-teal-50 border border-teal-200 rounded-lg p-4">
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
        <div className="pt-4 border-t border-gray-200 text-xs text-gray-400 space-y-2">
          <p>This response plan is based on currently available data. Data accuracy can be improved by updating source parameters and refreshing data pipelines.</p>
          <p>Generated by PEARL Intelligence Network (PIN). Informational only — not an official regulatory determination, legal opinion, or engineering design. All cost estimates are planning-level approximations. Verify with primary agency data and qualified professionals before implementation.</p>
        </div>
      </div>
      </div>{/* end pdfContentRef capture area */}

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
