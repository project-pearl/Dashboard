// =============================================================
// Federal Resolution Planner — National/Regional Scope
// Sidebar item in Federal Management Center
//
// Features:
//   - Scope selection: EPA Region, State, Watershed, Crisis, Custom
//   - Session persistence (survives refresh)
//   - Saved submissions panel with TTL
//   - Unlimited refinements per plan
//   - Generation limits enforced per tier
//   - Before/after comparison maps with projected score changes
// =============================================================

"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { geoToAbbr, getStatesGeoJSON, CARTO_TILE_URL, CARTO_ATTRIBUTION } from "@/lib/leafletMapUtils";
import type { GeoFeature } from "@/lib/leafletMapUtils";

// Lazy-load Leaflet components (SSR-safe)
const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import("react-leaflet").then(m => m.GeoJSON), { ssr: false });

// ── Types ──

interface ScopeSelection {
  type: "region" | "state" | "watershed" | "crisis" | "custom";
  label: string;
  epaRegion?: number;
  states?: string[];
  hucCode?: string;
  hucLevel?: 2 | 4 | 6 | 8 | 10 | 12;
  crisisId?: string;
  crisisName?: string;
  categories?: string[];
  requireNoTmdl?: boolean;
  pollutants?: string[];
  minEjIndex?: number;
  assessmentUnitCount?: number;
  totalViolations?: number;
  populationAffected?: number;
}

interface SavedPlan {
  id: string;
  scope: ScopeSelection;
  plan: FederalPlanSections;
  createdAt: string;
  updatedAt: string;
  revision: number;
  refineHistory: RefineEntry[];
  expiresAt: string;
}

interface RefineEntry {
  prompt: string;
  timestamp: string;
  revision: number;
}

interface ProjectedScoreChange {
  state: string;
  currentScore: number;
  projectedScore: number;
  keyImprovement: string;
}

interface FederalPlanSections {
  executiveSummary: string;
  scopeAnalysis: string;
  criticalFindings: string;
  interagencyCoordination: string;
  enforcementActions: string;
  actionsImmediate: string[];
  actionsShortTerm: string[];
  actionsLongTerm: string[];
  coBenefits: CoBenefit[];
  budgetEstimate: string;
  regulatoryAuthority: string;
  grantPrograms: string;
  projectedOutcomes: string;
  congressionalBriefing: string;
  projectedScoreChanges?: ProjectedScoreChange[];
}

interface CoBenefit {
  solution: string;
  surfaceWater: string;
  drinkingWater: string;
  wastewater: string;
  groundwater: string;
  stormwater: string;
}

type PlannerView = "scope" | "generating" | "plan" | "history";
type Tier = "starter" | "professional" | "enterprise" | "federal" | "admin";

// ── Constants ──

const EPA_REGIONS: { id: number; name: string; states: string[] }[] = [
  { id: 1, name: "Region 1 — New England", states: ["CT","ME","MA","NH","RI","VT"] },
  { id: 2, name: "Region 2 — NY/NJ/PR/VI", states: ["NJ","NY","PR","VI"] },
  { id: 3, name: "Region 3 — Mid-Atlantic", states: ["DE","DC","MD","PA","VA","WV"] },
  { id: 4, name: "Region 4 — Southeast", states: ["AL","FL","GA","KY","MS","NC","SC","TN"] },
  { id: 5, name: "Region 5 — Great Lakes", states: ["IL","IN","MI","MN","OH","WI"] },
  { id: 6, name: "Region 6 — South Central", states: ["AR","LA","NM","OK","TX"] },
  { id: 7, name: "Region 7 — Midwest", states: ["IA","KS","MO","NE"] },
  { id: 8, name: "Region 8 — Mountains & Plains", states: ["CO","MT","ND","SD","UT","WY"] },
  { id: 9, name: "Region 9 — Pacific Southwest", states: ["AZ","CA","HI","NV","AS","GU"] },
  { id: 10, name: "Region 10 — Pacific Northwest", states: ["AK","ID","OR","WA"] },
];

const TIER_LIMITS: Record<Tier, { dailyPlans: number; retentionDays: number }> = {
  starter:      { dailyPlans: 1,  retentionDays: 1 },
  professional: { dailyPlans: 5,  retentionDays: 7 },
  enterprise:   { dailyPlans: 25, retentionDays: 30 },
  federal:      { dailyPlans: 10, retentionDays: 90 },
  admin:        { dailyPlans: Infinity, retentionDays: Infinity },
};

const CRISIS_EVENTS = [
  { id: "potomac-interceptor-2026", name: "Potomac Interceptor Collapse", region: 3, states: ["DC","MD","VA"], active: true },
  { id: "east-palestine-legacy", name: "East Palestine Derailment (Legacy)", region: 5, states: ["OH","PA"], active: false },
];

const CATEGORIES = [
  { value: "5", label: "Category 5 — Impaired, TMDL needed", color: "#c0392b" },
  { value: "4a", label: "Category 4a — TMDL completed", color: "#e67e22" },
  { value: "4b", label: "Category 4b — Other controls", color: "#f39c12" },
  { value: "3", label: "Category 3 — Insufficient data", color: "#7f8c8d" },
];

const POLLUTANT_GROUPS = [
  "Nutrients (N/P)", "Bacteria/Pathogens", "Metals/Heavy Metals", "PFAS/PFOA",
  "Sediment/TSS", "Dissolved Oxygen", "Temperature", "pH", "Pesticides",
  "Microplastics", "Emerging Contaminants",
];

// ── Score-to-color helper ──

function scoreToColor(score: number | undefined): string {
  if (score === undefined || score < 0) return "#9ca3af"; // gray
  if (score < 60) return "#ef4444"; // red
  if (score < 70) return "#f97316"; // orange
  if (score < 80) return "#eab308"; // yellow
  if (score < 90) return "#84cc16"; // light green
  return "#22c55e"; // green
}

const SCORE_LEGEND = [
  { label: "90+", color: "#22c55e" },
  { label: "80–89", color: "#84cc16" },
  { label: "70–79", color: "#eab308" },
  { label: "60–69", color: "#f97316" },
  { label: "<60", color: "#ef4444" },
  { label: "N/A", color: "#9ca3af" },
];

// ── Session Persistence ──

const SESSION_KEY = "pin_federal_planner_session";
const SAVED_KEY = "pin_federal_planner_saved";

function saveSession(data: { scope: ScopeSelection | null; plan: FederalPlanSections | null; revision: number; history: RefineEntry[] }) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch {}
}

function loadSession(): { scope: ScopeSelection | null; plan: FederalPlanSections | null; revision: number; history: RefineEntry[] } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getSavedPlans(): SavedPlan[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const plans: SavedPlan[] = JSON.parse(raw);
    const now = new Date().toISOString();
    return plans.filter(p => p.expiresAt > now);
  } catch { return []; }
}

function savePlanToStorage(plan: SavedPlan) {
  const plans = getSavedPlans().filter(p => p.id !== plan.id);
  plans.unshift(plan);
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(plans.slice(0, 50))); } catch {}
}

function deleteSavedPlan(id: string) {
  const plans = getSavedPlans().filter(p => p.id !== id);
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(plans)); } catch {}
}

function getPlansGeneratedToday(): number {
  const plans = getSavedPlans();
  const today = new Date().toISOString().slice(0, 10);
  return plans.filter(p => p.createdAt.slice(0, 10) === today).length;
}

// ── Scope Summary ──

function scopeSummary(s: ScopeSelection): string {
  switch (s.type) {
    case "region": return `EPA Region ${s.epaRegion} (${s.states?.join(", ")})`;
    case "state": return `${s.states?.join(", ")}`;
    case "watershed": return `HUC-${s.hucLevel}: ${s.hucCode}`;
    case "crisis": return s.crisisName || "Crisis Event";
    case "custom": return s.label;
    default: return s.label;
  }
}

// ── Prompt Builder ──

function buildFederalPrompt(scope: ScopeSelection): string {
  const cats = scope.categories?.length ? scope.categories.join(", ") : "all categories";
  const polls = scope.pollutants?.length ? scope.pollutants.join(", ") : "all pollutants";
  const statesList = scope.states?.length ? scope.states.join(", ") : "all states in scope";

  return `You are a senior EPA water quality strategist generating a Federal Resolution Plan.

YOUR AUDIENCE: Federal EPA leadership with CWA enforcement authority, TMDL approval, interstate coordination, emergency declarations, and funding allocation powers.

SCOPE: ${scopeSummary(scope)}
States in Scope: ${statesList}
Assessment Units in Scope: ${scope.assessmentUnitCount?.toLocaleString() || "multiple"}
Active Violations: ${scope.totalViolations?.toLocaleString() || "unknown"}
Population Affected: ${scope.populationAffected?.toLocaleString() || "unknown"}
Categories Included: ${cats}
Pollutants of Concern: ${polls}
${scope.requireNoTmdl ? "FILTER: Only assessment units WITHOUT established TMDLs" : ""}
${scope.minEjIndex ? `EJ Index Minimum: ${scope.minEjIndex}/100` : ""}
${scope.crisisName ? `ACTIVE CRISIS: ${scope.crisisName}` : ""}

Generate a comprehensive Federal Resolution Plan for this scope. This is a REGIONAL/NATIONAL plan, not a single-waterbody plan. Address the full portfolio of impairments across the scope. Be specific about which federal authorities apply, which agencies must coordinate, and what enforcement escalation looks like.

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "executiveSummary": "2-3 paragraph executive summary suitable for an Assistant Administrator briefing. Scope, severity, key findings, recommended federal response posture.",
  "scopeAnalysis": "Statistical profile of the scope: how many Cat 5 vs 4a vs 3, dominant pollutants, worst-performing subwatersheds, TMDL coverage gaps, data staleness issues.",
  "criticalFindings": "Top 3-5 findings that demand immediate federal attention. Specific. Cite waterbody categories, violation counts, EJ concerns.",
  "interagencyCoordination": "Which federal agencies (EPA offices, USGS, NOAA, USACE, FEMA, HUD, NRCS) must be involved, what each contributes, coordination mechanism (task force, MOU, joint enforcement).",
  "enforcementActions": "Specific CWA enforcement options: administrative orders, consent decrees, civil penalties, emergency powers. Map to the violations in scope.",
  "actionsImmediate": ["0-30 day federal actions"],
  "actionsShortTerm": ["1-6 month actions"],
  "actionsLongTerm": ["1-5 year strategic actions"],
  "coBenefits": [{"solution":"name","surfaceWater":"impact","drinkingWater":"impact","wastewater":"impact","groundwater":"impact","stormwater":"impact"}],
  "budgetEstimate": "Planning-level federal investment estimate by action tier. Reference comparable programs/precedents.",
  "regulatoryAuthority": "Applicable CWA sections (303(d), 402, 404, 319, 311), Safe Drinking Water Act provisions, state delegation status, federal backstop triggers.",
  "grantPrograms": "Specific federal programs: CWSRF, DWSRF, EPA 319(h), WIFIA, Chesapeake Bay Program, NOAA, FEMA BRIC. Eligibility, typical ranges, next deadlines.",
  "projectedOutcomes": "Measurable outcomes at 1yr, 3yr, 5yr if plan is executed. Assessment unit reclassifications, violation reductions, population protected, TMDL completions.",
  "congressionalBriefing": "2-3 paragraph summary suitable for congressional notification. Policy implications, appropriations needs, constituent impact.",
  "projectedScoreChanges": [{"state":"XX","currentScore":55,"projectedScore":72,"keyImprovement":"Primary improvement driver for this state"}]
}

IMPORTANT: The projectedScoreChanges array MUST include one entry for each state in scope (${statesList}). currentScore should be a realistic 0-100 water quality score, projectedScore should reflect realistic improvements from the plan. Be conservative — most improvements should be 5-20 points.`;
}

function buildFederalRefinePrompt(scope: ScopeSelection, currentPlan: FederalPlanSections, refinement: string): string {
  const statesList = scope.states?.length ? scope.states.join(", ") : "all states in scope";

  return `You previously generated a Federal Resolution Plan for scope: ${scopeSummary(scope)}.

CURRENT PLAN SUMMARY:
- Exec Summary: ${currentPlan.executiveSummary.slice(0, 300)}...
- Critical Findings: ${currentPlan.criticalFindings.slice(0, 200)}...
- Actions: ${currentPlan.actionsImmediate.length} immediate, ${currentPlan.actionsShortTerm.length} short-term, ${currentPlan.actionsLongTerm.length} long-term
- Solutions: ${currentPlan.coBenefits.map(c => c.solution).join(", ")}

USER REFINEMENT: "${refinement}"

Revise the COMPLETE plan per the user's request. Return the full updated JSON, same structure as before. Do not fabricate data sources.

Respond ONLY with valid JSON:
{
  "executiveSummary": "...", "scopeAnalysis": "...", "criticalFindings": "...",
  "interagencyCoordination": "...", "enforcementActions": "...",
  "actionsImmediate": ["..."], "actionsShortTerm": ["..."], "actionsLongTerm": ["..."],
  "coBenefits": [{"solution":"...","surfaceWater":"...","drinkingWater":"...","wastewater":"...","groundwater":"...","stormwater":"..."}],
  "budgetEstimate": "...", "regulatoryAuthority": "...", "grantPrograms": "...",
  "projectedOutcomes": "...", "congressionalBriefing": "...",
  "projectedScoreChanges": [{"state":"XX","currentScore":55,"projectedScore":72,"keyImprovement":"..."}]
}

IMPORTANT: The projectedScoreChanges array MUST include one entry for each state in scope (${statesList}). Adjust scores based on the refinement.`;
}

// ── Co-Benefits Matrix ──

function CoBenefitsMatrix({ benefits }: { benefits: CoBenefit[] }) {
  if (!benefits?.length) return null;
  const cols = [
    { key: "surfaceWater", label: "Surface", icon: "~" },
    { key: "drinkingWater", label: "Drinking", icon: "D" },
    { key: "wastewater", label: "Waste", icon: "W" },
    { key: "groundwater", label: "Ground", icon: "G" },
    { key: "stormwater", label: "Storm", icon: "S" },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-1.5 pr-2 font-bold text-gray-500 uppercase tracking-wide text-[10px]">Solution</th>
            {cols.map(c => (
              <th key={c.key} className="text-center py-1.5 px-1.5 font-bold text-gray-500 uppercase tracking-wide text-[10px]">
                <span className="block text-sm font-mono">{c.icon}</span>{c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {benefits.map((b, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-1.5 pr-2 font-semibold text-gray-700 text-xs">{b.solution}</td>
              {cols.map(c => (
                <td key={c.key} className="py-1.5 px-1.5 text-gray-600 text-center text-xs">{(b as any)[c.key] || "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Before/After Comparison Maps ──

function BeforeAfterMaps({
  stateRollup,
  projectedChanges,
  scopeStates,
}: {
  stateRollup: Array<{ abbr: string; score: number; canGradeState: boolean }>;
  projectedChanges: ProjectedScoreChange[];
  scopeStates: string[];
}) {
  const geoData = useMemo(() => getStatesGeoJSON(), []);
  const scopeSet = useMemo(() => new Set(scopeStates.map(s => s.toUpperCase())), [scopeStates]);

  const projectedMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of projectedChanges) m.set(c.state.toUpperCase(), c.projectedScore);
    return m;
  }, [projectedChanges]);

  const currentScoreMap = useMemo(() => {
    const m = new Map<string, number>();
    // Use projected currentScore if available (from AI), fallback to stateRollup
    for (const c of projectedChanges) m.set(c.state.toUpperCase(), c.currentScore);
    for (const s of stateRollup) {
      if (!m.has(s.abbr) && s.canGradeState) m.set(s.abbr, s.score);
    }
    return m;
  }, [stateRollup, projectedChanges]);

  const beforeStyle = useCallback((feature: any) => {
    const abbr = geoToAbbr(feature as GeoFeature);
    const inScope = abbr ? scopeSet.has(abbr) : false;
    const score = abbr ? currentScoreMap.get(abbr) : undefined;
    return {
      fillColor: inScope ? scoreToColor(score) : "#d1d5db",
      fillOpacity: inScope ? 0.7 : 0.3,
      color: "#fff",
      weight: 1,
    };
  }, [scopeSet, currentScoreMap]);

  const afterStyle = useCallback((feature: any) => {
    const abbr = geoToAbbr(feature as GeoFeature);
    const inScope = abbr ? scopeSet.has(abbr) : false;
    const score = abbr && inScope ? projectedMap.get(abbr) : undefined;
    return {
      fillColor: inScope ? scoreToColor(score) : "#d1d5db",
      fillOpacity: inScope ? 0.7 : 0.3,
      color: "#fff",
      weight: 1,
    };
  }, [scopeSet, projectedMap]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2 text-center">Before — Current Scores</h4>
          <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 280 }}>
            <MapContainer
              center={[39.8, -98.5]}
              zoom={3}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              attributionControl={false}
            >
              <TileLayer url={CARTO_TILE_URL} attribution={CARTO_ATTRIBUTION} />
              <GeoJSON data={geoData as any} style={beforeStyle} />
            </MapContainer>
          </div>
        </div>
        <div>
          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2 text-center">After — Projected Scores</h4>
          <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 280 }}>
            <MapContainer
              center={[39.8, -98.5]}
              zoom={3}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              attributionControl={false}
            >
              <TileLayer url={CARTO_TILE_URL} attribution={CARTO_ATTRIBUTION} />
              <GeoJSON data={geoData as any} style={afterStyle} />
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Shared legend */}
      <div className="flex items-center justify-center gap-3 mt-3">
        {SCORE_LEGEND.map(s => (
          <div key={s.label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Score change table */}
      {projectedChanges.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-1 font-bold text-gray-500 uppercase text-[10px]">State</th>
                <th className="text-center py-1 font-bold text-gray-500 uppercase text-[10px]">Current</th>
                <th className="text-center py-1 font-bold text-gray-500 uppercase text-[10px]">Projected</th>
                <th className="text-center py-1 font-bold text-gray-500 uppercase text-[10px]">Change</th>
                <th className="text-left py-1 font-bold text-gray-500 uppercase text-[10px]">Key Improvement</th>
              </tr>
            </thead>
            <tbody>
              {projectedChanges.map((c, i) => {
                const delta = c.projectedScore - c.currentScore;
                return (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 font-semibold text-gray-700">{c.state}</td>
                    <td className="py-1 text-center">
                      <span className="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style={{ backgroundColor: scoreToColor(c.currentScore) }} />
                      {c.currentScore}
                    </td>
                    <td className="py-1 text-center">
                      <span className="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style={{ backgroundColor: scoreToColor(c.projectedScore) }} />
                      {c.projectedScore}
                    </td>
                    <td className={`py-1 text-center font-bold ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {delta > 0 ? "+" : ""}{delta}
                    </td>
                    <td className="py-1 text-gray-600 text-[11px]">{c.keyImprovement}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

interface FederalResolutionPlannerProps {
  userTier: Tier;
  userId: string;
  stateRollup: Array<{ abbr: string; score: number; canGradeState: boolean }>;
}

export default function FederalResolutionPlanner({ userTier, userId, stateRollup }: FederalResolutionPlannerProps) {
  // ── State ──
  const [view, setView] = useState<PlannerView>("scope");
  const [scope, setScope] = useState<ScopeSelection | null>(null);
  const [plan, setPlan] = useState<FederalPlanSections | null>(null);
  const [revision, setRevision] = useState(0);
  const [refineHistory, setRefineHistory] = useState<RefineEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refineInput, setRefineInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  // Scope builder state
  const [scopeType, setScopeType] = useState<ScopeSelection["type"]>("region");
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["5"]);
  const [requireNoTmdl, setRequireNoTmdl] = useState(false);
  const [selectedPollutants, setSelectedPollutants] = useState<string[]>([]);
  const [selectedCrisis, setSelectedCrisis] = useState<string | null>(null);
  const [hucCode, setHucCode] = useState("");
  const [minEj, setMinEj] = useState(0);

  const refineRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const limits = TIER_LIMITS[userTier];
  const plansToday = getPlansGeneratedToday();
  const atLimit = plansToday >= limits.dailyPlans;

  // ── Session Restore ──
  useEffect(() => {
    const session = loadSession();
    if (session?.plan && session?.scope) {
      setScope(session.scope);
      setPlan(session.plan);
      setRevision(session.revision);
      setRefineHistory(session.history);
      setView("plan");
    }
    setSavedPlans(getSavedPlans());
  }, []);

  // ── Session Save ──
  useEffect(() => {
    if (plan && scope) {
      saveSession({ scope, plan, revision, history: refineHistory });
    }
  }, [plan, scope, revision, refineHistory]);

  // Auto-scroll refine history
  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [refineHistory]);

  // ── Build Scope ──
  const buildScope = useCallback((): ScopeSelection => {
    const base: ScopeSelection = {
      type: scopeType,
      label: "",
      categories: selectedCategories,
      requireNoTmdl,
      pollutants: selectedPollutants,
      minEjIndex: minEj || undefined,
    };

    switch (scopeType) {
      case "region": {
        const region = EPA_REGIONS.find(r => r.id === selectedRegion);
        return { ...base, label: region?.name || "", epaRegion: selectedRegion!, states: region?.states || [] };
      }
      case "state":
        return { ...base, label: selectedStates.join(", "), states: selectedStates };
      case "watershed":
        return { ...base, label: `HUC ${hucCode}`, hucCode, hucLevel: (hucCode.length as any) };
      case "crisis": {
        const crisis = CRISIS_EVENTS.find(c => c.id === selectedCrisis);
        return { ...base, label: crisis?.name || "", crisisId: selectedCrisis!, crisisName: crisis?.name, epaRegion: crisis?.region, states: crisis?.states };
      }
      case "custom":
        return { ...base, label: "Custom Filter", states: selectedStates };
      default:
        return base;
    }
  }, [scopeType, selectedRegion, selectedStates, selectedCategories, requireNoTmdl, selectedPollutants, selectedCrisis, hucCode, minEj]);

  // ── Generate ──
  const generate = useCallback(async () => {
    if (atLimit) return;
    const s = buildScope();
    // Simulate resolving scope stats (in production: API call to Supabase/ATTAINS)
    s.assessmentUnitCount = Math.floor(Math.random() * 5000) + 200;
    s.totalViolations = Math.floor(Math.random() * 300) + 20;
    s.populationAffected = Math.floor(Math.random() * 2000000) + 50000;

    setScope(s);
    setGenerating(true);
    setError(null);
    setView("generating");

    try {
      const response = await fetch("/api/ai/resolution-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildFederalPrompt(s) }),
      });
      const data = await response.json();
      const text = data.text || '';
      if (!text) throw new Error(data.error || "Empty AI response");
      const sections = JSON.parse(text.replace(/```json|```/g, "").trim());

      setPlan(sections);
      setRevision(1);
      setRefineHistory([]);
      setView("plan");

      // Save to storage
      const id = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setActivePlanId(id);
      const expiresAt = new Date(Date.now() + limits.retentionDays * 86400000).toISOString();
      const saved: SavedPlan = { id, scope: s, plan: sections, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 1, refineHistory: [], expiresAt };
      savePlanToStorage(saved);
      setSavedPlans(getSavedPlans());
    } catch (e: any) {
      setError(e.message || "Generation failed");
      setView("scope");
    } finally {
      setGenerating(false);
    }
  }, [buildScope, atLimit, limits]);

  // ── Refine ──
  const refine = useCallback(async () => {
    if (!refineInput.trim() || !plan || !scope) return;
    const prompt = refineInput.trim();
    setRefineInput("");
    setRefining(true);

    const entry: RefineEntry = { prompt, timestamp: new Date().toISOString(), revision: revision + 1 };
    setRefineHistory(prev => [...prev, entry]);

    try {
      const response = await fetch("/api/ai/resolution-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildFederalRefinePrompt(scope, plan, prompt) }),
      });
      const data = await response.json();
      const text = data.text || '';
      if (!text) throw new Error(data.error || "Empty response");
      const sections = JSON.parse(text.replace(/```json|```/g, "").trim());
      setPlan(sections);
      setRevision(prev => prev + 1);

      // Update saved plan
      if (activePlanId) {
        const saved = getSavedPlans().find(p => p.id === activePlanId);
        if (saved) {
          saved.plan = sections;
          saved.revision = revision + 1;
          saved.updatedAt = new Date().toISOString();
          saved.refineHistory = [...refineHistory, entry];
          savePlanToStorage(saved);
          setSavedPlans(getSavedPlans());
        }
      }
    } catch (e: any) {
      setRefineHistory(prev => [...prev, { prompt: `[!] Refine failed: ${e.message}`, timestamp: new Date().toISOString(), revision }]);
    } finally {
      setRefining(false);
      refineRef.current?.focus();
    }
  }, [refineInput, plan, scope, revision, refineHistory, activePlanId]);

  // ── Restore Saved Plan ──
  const restorePlan = useCallback((saved: SavedPlan) => {
    setScope(saved.scope);
    setPlan(saved.plan);
    setRevision(saved.revision);
    setRefineHistory(saved.refineHistory);
    setActivePlanId(saved.id);
    setView("plan");
  }, []);

  // ═══════════════════════════════════════
  // RENDER: SCOPE BUILDER
  // ═══════════════════════════════════════
  if (view === "scope") {
    return (
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">Federal Resolution Planner</h1>
          <p className="text-sm text-gray-500 mt-1">National and regional scope analysis · {limits.dailyPlans === Infinity ? "Unlimited" : `${plansToday}/${limits.dailyPlans}`} plans used today</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Scope Type + Config */}
          <div className="col-span-2 space-y-4">
            {/* Scope Type */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Scope Type</h3>
              <div className="flex gap-2">
                {(["region","state","watershed","crisis","custom"] as const).map(t => (
                  <button key={t} onClick={() => setScopeType(t)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${scopeType === t ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
                    {t === "region" ? "EPA Region" : t === "state" ? "State(s)" : t === "watershed" ? "Watershed" : t === "crisis" ? "Crisis Event" : "Custom"}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Config */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              {scopeType === "region" && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Select EPA Region</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {EPA_REGIONS.map(r => (
                      <button key={r.id} onClick={() => { setSelectedRegion(r.id); setSelectedStates(r.states); }}
                        className={`text-left px-3 py-2 rounded-lg text-xs transition-all ${selectedRegion === r.id ? "bg-blue-50 border-blue-400 border text-blue-800" : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
                        <span className="font-bold">{r.name}</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">{r.states.join(", ")}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {scopeType === "crisis" && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Active & Recent Crisis Events</h3>
                  <div className="space-y-2">
                    {CRISIS_EVENTS.map(c => (
                      <button key={c.id} onClick={() => setSelectedCrisis(c.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all ${selectedCrisis === c.id ? "bg-red-50 border-red-400 border" : "bg-gray-50 border border-gray-200 hover:bg-gray-100"}`}>
                        <div className="flex items-center gap-2">
                          {c.active && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                          <span className="font-bold text-gray-800">{c.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">Region {c.region} · {c.states.join(", ")}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {scopeType === "state" && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Select State(s)</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {EPA_REGIONS.flatMap(r => r.states).sort().map(s => (
                      <button key={s} onClick={() => setSelectedStates(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${selectedStates.includes(s) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {scopeType === "watershed" && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Watershed HUC Code</h3>
                  <input value={hucCode} onChange={e => setHucCode(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    placeholder="Enter HUC code (2-12 digits)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <p className="text-[10px] text-gray-400 mt-1">HUC-2 (region) through HUC-12 (subwatershed). Longer = narrower scope.</p>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Assessment Filters</h3>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">Impairment Categories</p>
                  <div className="flex gap-2">
                    {CATEGORIES.map(c => (
                      <button key={c.value} onClick={() => setSelectedCategories(prev => prev.includes(c.value) ? prev.filter(x => x !== c.value) : [...prev, c.value])}
                        className={`px-2.5 py-1.5 rounded text-xs transition-all ${selectedCategories.includes(c.value)
                          ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        style={selectedCategories.includes(c.value) ? { backgroundColor: c.color } : {}}>
                        Cat {c.value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="no-tmdl" checked={requireNoTmdl} onChange={e => setRequireNoTmdl(e.target.checked)} className="rounded" />
                  <label htmlFor="no-tmdl" className="text-xs text-gray-600">Only waterbodies <span className="font-bold">without</span> established TMDLs</label>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">Pollutants of Concern</p>
                  <div className="flex flex-wrap gap-1.5">
                    {POLLUTANT_GROUPS.map(p => (
                      <button key={p} onClick={() => setSelectedPollutants(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                        className={`px-2 py-1 rounded text-[11px] transition-all ${selectedPollutants.includes(p) ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{p}</button>
                    ))}
                  </div>
                </div>

                {minEj > 0 && <p className="text-xs text-gray-500">EJ Index minimum: {minEj}/100</p>}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Environmental Justice Minimum</p>
                  <input type="range" min={0} max={100} value={minEj} onChange={e => setMinEj(parseInt(e.target.value))}
                    className="w-full accent-purple-600" />
                  <div className="flex justify-between text-[10px] text-gray-400"><span>No filter</span><span>EJ 50+</span><span>EJ 100</span></div>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            {error && <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

            <button onClick={generate} disabled={atLimit}
              className={`w-full py-4 rounded-lg text-sm font-bold transition-all ${atLimit ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"}`}>
              {atLimit ? `Daily limit reached (${limits.dailyPlans} plans). Upgrade for more.` : "Generate Federal Resolution Plan"}
            </button>
          </div>

          {/* Right: Saved Plans */}
          <div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Recent Plans</h3>
                <span className="text-[10px] text-gray-400">{limits.retentionDays}d retention</span>
              </div>
              {savedPlans.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No saved plans yet</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {savedPlans.map(sp => (
                    <button key={sp.id} onClick={() => restorePlan(sp)}
                      className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-all group">
                      <div className="flex items-start justify-between">
                        <div className="text-xs font-semibold text-gray-700 group-hover:text-blue-700">{sp.scope.label || scopeSummary(sp.scope)}</div>
                        <button onClick={e => { e.stopPropagation(); deleteSavedPlan(sp.id); setSavedPlans(getSavedPlans()); }}
                          className="text-gray-300 hover:text-red-400 text-xs">x</button>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        Rev {sp.revision} · {sp.refineHistory.length} refines · {new Date(sp.updatedAt).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Expires {new Date(sp.expiresAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // RENDER: GENERATING
  // ═══════════════════════════════════════
  if (view === "generating") {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6" />
        <h2 className="text-lg font-bold text-gray-700 mb-2">Analyzing Federal Scope</h2>
        <p className="text-sm text-gray-500">{scope ? scopeSummary(scope) : "Building scope..."}</p>
        <p className="text-xs text-gray-400 mt-2">Synthesizing across {scope?.assessmentUnitCount?.toLocaleString() || "multiple"} assessment units. This may take 60-90 seconds for regional scope.</p>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // RENDER: PLAN
  // ═══════════════════════════════════════
  if (view === "plan" && plan && scope) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col" style={{ maxHeight: "calc(100vh - 80px)" }}>
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-t-xl px-6 py-4 text-white flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-wide font-medium">
                Federal Resolution Plan · Revision {revision}
              </p>
              <h2 className="text-lg font-bold mt-1">{scope.label || scopeSummary(scope)}</h2>
              <p className="text-blue-200 text-xs mt-0.5">
                {scope.assessmentUnitCount?.toLocaleString()} assessment units · {scope.totalViolations} violations · {scope.populationAffected?.toLocaleString()} people affected
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs">Print</button>
              <button onClick={() => { setView("scope"); }} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs">New</button>
              <button onClick={() => setView("scope")} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs">Close</button>
            </div>
          </div>
        </div>

        {/* Scrollable Plan Content */}
        <div className="flex-1 overflow-y-auto bg-white border-x border-gray-200 p-6 space-y-5">

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Executive Summary</h3>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-blue-50 border border-blue-200 rounded-lg p-4">{plan.executiveSummary}</div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Scope Analysis</h3>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{plan.scopeAnalysis}</div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Critical Findings</h3>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-red-50 border border-red-200 rounded-lg p-4">{plan.criticalFindings}</div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Interagency Coordination</h3>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{plan.interagencyCoordination}</div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Enforcement Actions</h3>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-orange-50 border border-orange-200 rounded-lg p-4">{plan.enforcementActions}</div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Recommended Actions</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <h4 className="text-[10px] font-bold text-red-700 uppercase mb-2">Immediate (0-30d)</h4>
                <ul className="space-y-1">{plan.actionsImmediate.map((a, i) => (
                  <li key={i} className="text-xs text-red-800"><span className="font-bold mr-1">{i+1}.</span>{a}</li>
                ))}</ul>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <h4 className="text-[10px] font-bold text-orange-700 uppercase mb-2">Short-Term (1-6mo)</h4>
                <ul className="space-y-1">{plan.actionsShortTerm.map((a, i) => (
                  <li key={i} className="text-xs text-orange-800"><span className="font-bold mr-1">{i+1}.</span>{a}</li>
                ))}</ul>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-[10px] font-bold text-blue-700 uppercase mb-2">Long-Term (1-5yr)</h4>
                <ul className="space-y-1">{plan.actionsLongTerm.map((a, i) => (
                  <li key={i} className="text-xs text-blue-800"><span className="font-bold mr-1">{i+1}.</span>{a}</li>
                ))}</ul>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Co-Benefits Across Water Domains</h3>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <CoBenefitsMatrix benefits={plan.coBenefits} />
            </div>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <section>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Budget Estimate</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 whitespace-pre-wrap">{plan.budgetEstimate}</div>
            </section>
            <section>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Regulatory Authority</h3>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-800 whitespace-pre-wrap">{plan.regulatoryAuthority}</div>
            </section>
          </div>

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Grant & Funding Programs</h3>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 whitespace-pre-wrap">{plan.grantPrograms}</div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Projected Outcomes</h3>
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-800 whitespace-pre-wrap">{plan.projectedOutcomes}</div>
          </section>

          {/* Before/After Comparison Maps */}
          {(plan.projectedScoreChanges?.length ?? 0) > 0 && scope.states?.length && (
            <section>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Projected Impact — Before vs. After</h3>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <BeforeAfterMaps
                  stateRollup={stateRollup}
                  projectedChanges={plan.projectedScoreChanges!}
                  scopeStates={scope.states}
                />
              </div>
            </section>
          )}

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Congressional Briefing Summary</h3>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{plan.congressionalBriefing}</div>
          </section>

          <div className="pt-3 border-t border-gray-200 text-[10px] text-gray-400">
            Generated by PEARL Intelligence Network (PIN). Informational only — not an official regulatory determination, legal opinion, or engineering design. Verify with primary agency data before action.
          </div>
        </div>

        {/* Refine Bar — pinned bottom */}
        <div className="flex-shrink-0 border border-gray-200 border-t-0 rounded-b-xl bg-white">
          {refineHistory.length > 0 && (
            <div ref={historyRef} className="max-h-28 overflow-y-auto px-4 pt-3 space-y-1.5">
              {refineHistory.map((r, i) => (
                <div key={i} className={`text-xs px-3 py-1 rounded-lg ${r.prompt.startsWith("[!]") ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-800"} max-w-[85%] ml-auto`}>
                  {r.prompt} <span className="text-[10px] opacity-50">rev {r.revision}</span>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-3 flex gap-2">
            <input ref={refineRef} value={refineInput} onChange={e => setRefineInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !refining) refine(); }}
              placeholder='Refine: "Focus on EJ communities" or "Add FEMA coordination" or "Increase urgency"'
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              disabled={refining} />
            <button onClick={refine} disabled={!refineInput.trim() || refining}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${refineInput.trim() && !refining ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
              {refining ? "Refining..." : "Refine"}
            </button>
          </div>
          <div className="px-4 pb-2 flex justify-between text-[10px] text-gray-400">
            <span>Refinements are unlimited and don&apos;t count toward your daily plan limit</span>
            <span>Plan auto-saved · Expires {activePlanId ? new Date(getSavedPlans().find(p => p.id === activePlanId)?.expiresAt || "").toLocaleDateString() : "—"}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
