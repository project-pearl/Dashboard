'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { MockDataBadge } from './MockDataBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Star,
  Filter,
  Users,
  Timer,
  Printer,
  Shuffle,
  BookOpen,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Info,
} from 'lucide-react';
import { getEcoScore, getEcoData } from '@/lib/ecologicalSensitivity';
import { getEJScore, getEJData } from '@/lib/ejVulnerability';

// ── Props ───────────────────────────────────────────────────────────────────

interface DebateTopicsPanelProps {
  stateAbbr: string;
  stateName: string;
  isTeacher?: boolean;
}

// ── Types ───────────────────────────────────────────────────────────────────

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
type Category = 'Infrastructure' | 'PFAS' | 'Env. Justice' | 'Ag Runoff' | 'Climate' | 'Drinking Water' | 'Wetland Protection' | 'Stormwater';

interface DebateTopic {
  id: number;
  question: (state: string) => string;
  category: Category;
  difficulty: Difficulty;
  gradeRange: string;
  intro: (state: string, ecoScore: number, ejScore: number) => string;
  pros: string[];
  cons: string[];
  vocabulary: string[];
  dataSource: string;
}

// ── Topic Data ──────────────────────────────────────────────────────────────

const DEBATE_TOPICS: DebateTopic[] = [
  {
    id: 1,
    question: (s) => `Should ${s} spend more on replacing lead pipes or upgrading stormwater systems?`,
    category: 'Infrastructure',
    difficulty: 'Beginner',
    gradeRange: '6-8',
    intro: (s, eco, ej) =>
      `${s} faces aging water infrastructure. With an ecological sensitivity score of ${eco}/100 and an environmental justice score of ${ej}/100, the state must choose how to allocate limited funds between lead service line replacement and stormwater management upgrades.`,
    pros: [
      'Lead pipe replacement directly protects children\'s health and brain development',
      'Federal funding (LCRR) prioritizes lead removal, maximizing matching funds',
      'Removing lead pipes eliminates a permanent contamination source',
    ],
    cons: [
      'Stormwater flooding causes billions in property damage annually',
      'Green stormwater infrastructure provides habitat and climate co-benefits',
      'Stormwater upgrades protect entire communities vs. individual service lines',
      'Climate change is increasing flood frequency, making stormwater more urgent',
    ],
    vocabulary: ['Lead service line', 'LCRR (Lead and Copper Rule Revisions)', 'Stormwater runoff', 'Green infrastructure', 'Combined sewer overflow'],
    dataSource: 'EPA Lead and Copper Rule, NOAA flood data',
  },
  {
    id: 2,
    question: (s) => `Should ${s} ban all PFAS in consumer products?`,
    category: 'PFAS',
    difficulty: 'Advanced',
    gradeRange: '9-12',
    intro: (s, eco, ej) =>
      `PFAS "forever chemicals" have been detected in water supplies across ${s}. With an EJ vulnerability score of ${ej}/100, disadvantaged communities may bear disproportionate exposure. A statewide ban would affect industries, consumers, and water treatment costs.`,
    pros: [
      'PFAS persist in the environment indefinitely — stopping the source is the only permanent fix',
      'Removing PFAS from water is extremely expensive ($40-90M per treatment plant)',
      'PFAS bioaccumulate in humans and are linked to cancer, thyroid disease, and immune effects',
      'Several states have already passed partial PFAS bans with bipartisan support',
    ],
    cons: [
      'PFAS are used in critical applications (firefighting foam, medical devices, semiconductors)',
      'A total ban could raise consumer costs and disrupt manufacturing',
      'Safer alternatives don\'t exist yet for all PFAS applications',
      'Targeted regulation of high-risk PFAS may be more practical than a blanket ban',
    ],
    vocabulary: ['PFAS (per- and polyfluoroalkyl substances)', 'Bioaccumulation', 'Maximum Contaminant Level (MCL)', 'Forever chemicals', 'AFFF (firefighting foam)'],
    dataSource: 'EPA PFAS Strategic Roadmap, ATSDR ToxFAQs',
  },
  {
    id: 3,
    question: (s) => `Should ${s} require extra water quality monitoring in low-income areas?`,
    category: 'Env. Justice',
    difficulty: 'Intermediate',
    gradeRange: '7-10',
    intro: (s, eco, ej) =>
      `Environmental justice data shows ${s} has a vulnerability score of ${ej}/100. Studies indicate that low-income and minority communities often experience higher rates of water quality violations. Should the state mandate additional monitoring in these areas?`,
    pros: [
      'Low-income communities historically receive less infrastructure investment',
      'More monitoring data enables faster response to contamination events',
      'Environmental justice is a federal priority under Executive Order 14008',
      'Data transparency empowers communities to advocate for themselves',
    ],
    cons: [
      'Additional monitoring costs could strain already tight municipal budgets',
      'Targeting by income could stigmatize communities and lower property values',
      'Universal monitoring standards ensure equal treatment under the law',
    ],
    vocabulary: ['Environmental justice', 'EJScreen', 'Safe Drinking Water Act', 'Compliance monitoring', 'Disparate impact'],
    dataSource: 'EPA EJScreen, CDC Social Vulnerability Index',
  },
  {
    id: 4,
    question: (s) => `Should farmers in ${s} be required to create mandatory buffer zones along streams?`,
    category: 'Ag Runoff',
    difficulty: 'Intermediate',
    gradeRange: '7-10',
    intro: (s, eco, _ej) =>
      `Agricultural runoff is a leading cause of water impairment in ${s}, with an ecological sensitivity score of ${eco}/100. Riparian buffer zones — vegetated strips along waterways — can filter nutrients and sediment, but require taking productive farmland out of use.`,
    pros: [
      'Buffers reduce nitrogen and phosphorus runoff by 50-85%',
      'Riparian zones provide critical habitat for pollinators and wildlife',
      'Reduced nutrient loading helps prevent harmful algal blooms downstream',
      'USDA programs (CRP, EQIP) can compensate farmers for buffer establishment',
    ],
    cons: [
      'Mandatory buffers take productive land out of farming, reducing income',
      'Small farms may face disproportionate economic burden',
      'Voluntary programs have achieved significant enrollment without mandates',
    ],
    vocabulary: ['Riparian buffer', 'Nonpoint source pollution', 'Nutrient loading', 'CRP (Conservation Reserve Program)', 'Harmful algal bloom'],
    dataSource: 'USDA NRCS, EPA 303(d) impaired waters list',
  },
  {
    id: 5,
    question: (s) => `Should ${s} prioritize green infrastructure over traditional concrete solutions?`,
    category: 'Climate',
    difficulty: 'Advanced',
    gradeRange: '9-12',
    intro: (s, eco, _ej) =>
      `As climate change intensifies storms across ${s} (eco sensitivity: ${eco}/100), cities must decide between traditional "gray" infrastructure (pipes, concrete channels) and "green" alternatives (rain gardens, permeable pavement, constructed wetlands).`,
    pros: [
      'Green infrastructure provides co-benefits: habitat, cooling, air quality, aesthetics',
      'Distributed green solutions are more resilient to extreme weather than centralized systems',
      'Green infrastructure can be 3-6x more cost-effective per gallon managed over its lifecycle',
      'Nature-based solutions sequester carbon, addressing climate change root causes',
    ],
    cons: [
      'Gray infrastructure has proven engineering standards with predictable performance',
      'Green infrastructure requires more land area in already-dense urban settings',
      'Maintenance of green systems requires specialized ecological knowledge',
      'Performance varies seasonally and may be insufficient during extreme events',
    ],
    vocabulary: ['Green infrastructure', 'Gray infrastructure', 'Permeable pavement', 'Bioswale', 'Low Impact Development (LID)'],
    dataSource: 'EPA Green Infrastructure Modeling Toolkit, NOAA climate projections',
  },
  {
    id: 6,
    question: (_s) => `Should stricter drinking water standards be enacted even if they raise water bills?`,
    category: 'Drinking Water',
    difficulty: 'Beginner',
    gradeRange: '6-8',
    intro: (s, _eco, ej) =>
      `Tighter drinking water regulations in ${s} would require utilities to install advanced treatment technology. While this improves public health, the costs are passed to ratepayers. With an EJ score of ${ej}/100, affordability is a key concern.`,
    pros: [
      'Stricter standards prevent long-term health costs that far exceed treatment costs',
      'Children and pregnant women are especially vulnerable to contaminants',
      'Technology improvements become cheaper as they scale across utilities',
    ],
    cons: [
      'Water affordability is already a crisis — 1 in 3 households struggle with bills',
      'Small and rural utilities lack the tax base to fund upgrades',
      'Diminishing returns: ultra-low limits may cost billions for marginal health gains',
      'Rate increases can push vulnerable residents toward unregulated private wells',
    ],
    vocabulary: ['Maximum Contaminant Level (MCL)', 'Treatment technology', 'Water affordability', 'Rate structure', 'Cross-subsidization'],
    dataSource: 'EPA Safe Drinking Water Act, AWWA rate surveys',
  },
  {
    id: 7,
    question: (s) => `Should ${s} prevent all new construction in wetland areas?`,
    category: 'Wetland Protection',
    difficulty: 'Intermediate',
    gradeRange: '7-10',
    intro: (s, eco, _ej) =>
      `Wetlands in ${s} provide flood control, water filtration, and biodiversity habitat. With an ecological score of ${eco}/100, the state's ecosystems face development pressure. The 2023 Sackett v. EPA ruling narrowed federal wetland protections, shifting responsibility to states.`,
    pros: [
      'Wetlands filter pollutants naturally, saving millions in treatment costs',
      'Wetland loss increases flood damage — each acre stores 1-1.5 million gallons',
      'Wetlands support 40% of threatened and endangered species',
      'Once destroyed, wetlands take decades or centuries to restore',
    ],
    cons: [
      'Construction bans limit housing supply and raise costs in growing areas',
      'Mitigation banking allows developers to create replacement wetlands elsewhere',
      'Some low-quality wetlands provide minimal ecological function',
    ],
    vocabulary: ['Wetland delineation', 'Section 404 permit', 'Mitigation banking', 'Sackett v. EPA', 'Ecosystem services'],
    dataSource: 'USFWS National Wetlands Inventory, EPA wetland monitoring',
  },
  {
    id: 8,
    question: (_s) => `Should homeowners pay stormwater fees based on the amount of pavement on their property?`,
    category: 'Stormwater',
    difficulty: 'Beginner',
    gradeRange: '6-8',
    intro: (s, _eco, ej) =>
      `Impervious surfaces like driveways, roofs, and parking lots create stormwater runoff that overwhelms sewer systems in ${s}. An impervious-area fee charges property owners based on their contribution to the problem. With an EJ score of ${ej}/100, fee equity matters.`,
    pros: [
      'Impervious-area fees follow the "polluter pays" principle — fair and transparent',
      'Fees incentivize rain gardens, permeable pavers, and tree planting',
      'Dedicated stormwater revenue funds infrastructure that protects everyone',
    ],
    cons: [
      'Large-lot homeowners and churches/nonprofits may face unexpectedly high fees',
      'Measuring impervious area requires GIS technology that small cities may lack',
      'Fees are politically unpopular — often labeled a "rain tax"',
      'Low-income homeowners may not be able to afford retrofits to reduce their fee',
    ],
    vocabulary: ['Impervious surface', 'Stormwater utility fee', 'Runoff coefficient', 'Rain tax', 'Pervious pavement'],
    dataSource: 'EPA MS4 permits, Western Kentucky University stormwater survey',
  },
];

// ── Rubric ──────────────────────────────────────────────────────────────────

const RUBRIC_CRITERIA = [
  { name: 'Evidence Use', levels: ['No evidence cited', 'Mentions data vaguely', 'Cites specific facts/stats', 'Integrates multiple data sources with analysis'] },
  { name: 'Critical Thinking', levels: ['Restates opinion only', 'Identifies one perspective', 'Compares multiple perspectives', 'Evaluates trade-offs and proposes synthesis'] },
  { name: 'Rebuttal Quality', levels: ['No rebuttal attempted', 'Dismisses opposing view', 'Addresses opposing argument', 'Refutes with counter-evidence and logic'] },
  { name: 'Presentation', levels: ['Unclear or off-topic', 'Basic structure, some clarity', 'Well-organized with clear points', 'Compelling delivery with audience awareness'] },
];

const RUBRIC_COLORS = [
  'bg-red-100 text-red-800 border-red-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
];

// ── Timer Rounds ────────────────────────────────────────────────────────────

const DEBATE_ROUNDS = [
  { label: 'Opening Statement', seconds: 180 },
  { label: 'Rebuttal', seconds: 120 },
  { label: 'Closing Argument', seconds: 60 },
];

// ── Category/Difficulty badge colors ────────────────────────────────────────

const CATEGORY_COLORS: Record<Category, string> = {
  Infrastructure: 'bg-slate-100 text-slate-700 border-slate-300',
  PFAS: 'bg-purple-100 text-purple-700 border-purple-300',
  'Env. Justice': 'bg-amber-100 text-amber-700 border-amber-300',
  'Ag Runoff': 'bg-lime-100 text-lime-700 border-lime-300',
  Climate: 'bg-sky-100 text-sky-700 border-sky-300',
  'Drinking Water': 'bg-cyan-100 text-cyan-700 border-cyan-300',
  'Wetland Protection': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  Stormwater: 'bg-indigo-100 text-indigo-700 border-indigo-300',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  Beginner: 'bg-green-100 text-green-700 border-green-300',
  Intermediate: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  Advanced: 'bg-red-100 text-red-700 border-red-300',
};

// ── Helper: featured topic rotates weekly ───────────────────────────────────

function getWeekOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function DebateTopicsPanel({ stateAbbr, stateName, isTeacher = false }: DebateTopicsPanelProps) {
  // ── State data ──────────────────────────────────────────────────────────
  const ecoScore = useMemo(() => getEcoScore(stateAbbr), [stateAbbr]);
  const ejScore = useMemo(() => getEJScore(stateAbbr), [stateAbbr]);

  // ── Featured topic (rotates weekly) ─────────────────────────────────────
  const featuredIdx = getWeekOfYear() % DEBATE_TOPICS.length;
  const featured = DEBATE_TOPICS[featuredIdx];

  // ── Filters ─────────────────────────────────────────────────────────────
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'All'>('All');
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());

  const filteredTopics = useMemo(() => {
    return DEBATE_TOPICS.filter((t) => {
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      if (difficultyFilter !== 'All' && t.difficulty !== difficultyFilter) return false;
      return true;
    });
  }, [categoryFilter, difficultyFilter]);

  const toggleExpanded = useCallback((id: number) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Debate Setup (teacher) ──────────────────────────────────────────────
  const [teamA, setTeamA] = useState('Team Pro');
  const [teamB, setTeamB] = useState('Team Con');
  const [roundIdx, setRoundIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DEBATE_ROUNDS[0].seconds);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [assigned, setAssigned] = useState(false);

  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0) setTimerRunning(false);
  }, [timeLeft]);

  const resetTimer = useCallback(() => {
    setTimerRunning(false);
    setTimeLeft(DEBATE_ROUNDS[roundIdx].seconds);
  }, [roundIdx]);

  const nextRound = useCallback(() => {
    const next = (roundIdx + 1) % DEBATE_ROUNDS.length;
    setRoundIdx(next);
    setTimeLeft(DEBATE_ROUNDS[next].seconds);
    setTimerRunning(false);
  }, [roundIdx]);

  const randomizeTeams = useCallback(() => {
    const adjectives = ['Water', 'River', 'Ocean', 'Lake', 'Storm', 'Rain', 'Aqua', 'Coral'];
    const nouns = ['Hawks', 'Dolphins', 'Otters', 'Eagles', 'Turtles', 'Herons', 'Salmon', 'Beavers'];
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    setTeamA(`${pick(adjectives)} ${pick(nouns)}`);
    setTeamB(`${pick(adjectives)} ${pick(nouns)}`);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const categories: Category[] = ['Infrastructure', 'PFAS', 'Env. Justice', 'Ag Runoff', 'Climate', 'Drinking Water', 'Wetland Protection', 'Stormwater'];
  const difficulties: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

  // ═════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* ── Card 1: Topic of the Week ────────────────────────────────────── */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-400" />
              <CardTitle className="text-lg">Topic of the Week</CardTitle>
              <MockDataBadge />
            </div>
            {isTeacher && (
              <Button
                size="sm"
                variant={assigned ? 'outline' : 'default'}
                onClick={() => setAssigned(!assigned)}
                className="gap-1.5"
              >
                {assigned ? <CheckCircle className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                {assigned ? 'Assigned' : 'Assign to Class'}
              </Button>
            )}
          </div>
          <CardDescription>A new water policy debate topic each week, contextualized for {stateName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-xs border ${CATEGORY_COLORS[featured.category]}`}>{featured.category}</Badge>
            <Badge className={`text-xs border ${DIFFICULTY_COLORS[featured.difficulty]}`}>{featured.difficulty}</Badge>
            <Badge variant="outline" className="text-xs">Grades {featured.gradeRange}</Badge>
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            {featured.question(stateName)}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {featured.intro(stateName, ecoScore, ejScore)}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
              <h4 className="text-xs font-bold text-green-800 uppercase tracking-wide mb-2">Pro Arguments</h4>
              <ul className="space-y-1">
                {featured.pros.map((p, i) => (
                  <li key={i} className="text-xs text-green-900 flex gap-1.5">
                    <span className="text-green-500 mt-0.5 shrink-0">+</span>{p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
              <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide mb-2">Con Arguments</h4>
              <ul className="space-y-1">
                {featured.cons.map((c, i) => (
                  <li key={i} className="text-xs text-red-900 flex gap-1.5">
                    <span className="text-red-500 mt-0.5 shrink-0">&minus;</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {isTeacher && (
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> Vocabulary: {featured.vocabulary.join(', ')}</span>
              <span className="flex items-center gap-1"><Info className="h-3.5 w-3.5" /> Source: {featured.dataSource}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Card 2: All Topics ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">All Debate Topics</CardTitle>
            <MockDataBadge />
          </div>
          <CardDescription>Browse and filter water policy debate topics by category and difficulty</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-gray-400" />
              <select
                className="text-xs border rounded px-2 py-1 bg-white"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as Category | 'All')}
              >
                <option value="All">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                className="text-xs border rounded px-2 py-1 bg-white"
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value as Difficulty | 'All')}
              >
                <option value="All">All Difficulties</option>
                {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <span className="text-xs text-gray-400">{filteredTopics.length} topic{filteredTopics.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Topic cards */}
          <div className="grid grid-cols-1 gap-3">
            {filteredTopics.map((topic) => {
              const isOpen = expandedTopics.has(topic.id);
              return (
                <div key={topic.id} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleExpanded(topic.id)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={`text-2xs border ${CATEGORY_COLORS[topic.category]}`}>{topic.category}</Badge>
                        <Badge className={`text-2xs border ${DIFFICULTY_COLORS[topic.difficulty]}`}>{topic.difficulty}</Badge>
                        <span className="text-2xs text-gray-400">Grades {topic.gradeRange}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {topic.question(stateName)}
                      </p>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-2" />}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 border-t bg-gray-50/50 space-y-3">
                      <p className="text-xs text-gray-600 pt-3 leading-relaxed">
                        {topic.intro(stateName, ecoScore, ejScore)}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="rounded border border-green-200 bg-green-50/50 p-2.5">
                          <h5 className="text-2xs font-bold text-green-800 uppercase tracking-wide mb-1.5">Pro</h5>
                          <ul className="space-y-1">
                            {topic.pros.map((p, i) => (
                              <li key={i} className="text-xs text-green-900 flex gap-1">
                                <span className="text-green-500 shrink-0">+</span>{p}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded border border-red-200 bg-red-50/50 p-2.5">
                          <h5 className="text-2xs font-bold text-red-800 uppercase tracking-wide mb-1.5">Con</h5>
                          <ul className="space-y-1">
                            {topic.cons.map((c, i) => (
                              <li key={i} className="text-xs text-red-900 flex gap-1">
                                <span className="text-red-500 shrink-0">&minus;</span>{c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {isTeacher && (
                        <div className="space-y-1 text-xs text-gray-500">
                          <div className="flex items-start gap-1">
                            <BookOpen className="h-3 w-3 mt-0.5 shrink-0" />
                            <span><strong>Vocabulary:</strong> {topic.vocabulary.join(', ')}</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <Info className="h-3 w-3 mt-0.5 shrink-0" />
                            <span><strong>Data source:</strong> {topic.dataSource}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredTopics.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">No topics match the selected filters.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Card 3: Discussion Rubric ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg">Discussion Rubric</CardTitle>
            </div>
            {isTeacher && (
              <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            )}
          </div>
          <CardDescription>4-criteria scoring rubric for structured debates (1-4 points each)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b font-semibold text-gray-700 w-32">Criteria</th>
                  <th className="text-center p-2 border-b font-semibold text-gray-700">1 — Beginning</th>
                  <th className="text-center p-2 border-b font-semibold text-gray-700">2 — Developing</th>
                  <th className="text-center p-2 border-b font-semibold text-gray-700">3 — Proficient</th>
                  <th className="text-center p-2 border-b font-semibold text-gray-700">4 — Advanced</th>
                </tr>
              </thead>
              <tbody>
                {RUBRIC_CRITERIA.map((criterion) => (
                  <tr key={criterion.name} className="border-b last:border-0">
                    <td className="p-2 font-semibold text-gray-800">{criterion.name}</td>
                    {criterion.levels.map((desc, lvl) => (
                      <td key={lvl} className="p-2">
                        <div className={`rounded px-2 py-1.5 border text-center ${RUBRIC_COLORS[lvl]}`}>
                          {desc}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 4: Debate Setup ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" />
            <CardTitle className="text-lg">Debate Setup</CardTitle>
          </div>
          <CardDescription>
            {isTeacher
              ? 'Randomize teams, set timer rounds, and manage the debate flow'
              : 'View your team assignment and debate timer'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Teams */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full text-center rounded-lg border-2 border-green-300 bg-green-50 p-3">
              <span className="text-2xs uppercase tracking-wider text-green-600 font-bold">Pro</span>
              <p className="text-sm font-semibold text-green-800 mt-1">{teamA}</p>
            </div>
            <span className="text-xs font-bold text-gray-400">VS</span>
            <div className="flex-1 w-full text-center rounded-lg border-2 border-red-300 bg-red-50 p-3">
              <span className="text-2xs uppercase tracking-wider text-red-600 font-bold">Con</span>
              <p className="text-sm font-semibold text-red-800 mt-1">{teamB}</p>
            </div>
          </div>
          {isTeacher && (
            <div className="flex justify-center">
              <Button size="sm" variant="outline" onClick={randomizeTeams} className="gap-1.5">
                <Shuffle className="h-3.5 w-3.5" /> Randomize Teams
              </Button>
            </div>
          )}

          {/* Timer */}
          <div className="rounded-lg border bg-gray-50 p-4 text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Timer className="h-4 w-4 text-gray-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {DEBATE_ROUNDS[roundIdx].label}
              </span>
              <span className="text-xs text-gray-400">
                (Round {roundIdx + 1}/{DEBATE_ROUNDS.length})
              </span>
            </div>
            <p className={`text-4xl font-mono font-bold ${timeLeft <= 10 && timeLeft > 0 ? 'text-red-600 animate-pulse' : 'text-gray-800'}`}>
              {formatTime(timeLeft)}
            </p>
            {isTeacher ? (
              <div className="flex justify-center gap-2">
                <Button
                  size="sm"
                  variant={timerRunning ? 'outline' : 'default'}
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="gap-1.5"
                >
                  {timerRunning ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Start</>}
                </Button>
                <Button size="sm" variant="outline" onClick={resetTimer} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
                <Button size="sm" variant="outline" onClick={nextRound} className="gap-1.5">
                  Next Round
                </Button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                {timerRunning ? 'Timer is running...' : timeLeft === 0 ? 'Time\'s up!' : 'Waiting for teacher to start timer'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
