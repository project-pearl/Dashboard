'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Droplets, Shield, Activity, MapPin,
  ArrowRight, BarChart3, Zap, Database, Building2,
  GraduationCap, Globe, Eye,
  Search, Waves, Beaker, Microscope, ShieldCheck, LineChart,
  ChevronDown, ExternalLink, FileText, Landmark, Factory, Leaf, HardHat, Settings, FlaskConical,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';

// ─── Animated counter ───────────────────────────────────────────────────────

function Counter({ target, suffix = '', duration = 2000 }: {
  target: number; suffix?: string; duration?: number;
}) {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || target === 0) return;
    let frame: number;
    const start = performance.now();
    function step(now: number) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * target));
      if (p < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [visible, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

function LivePulse() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
}

// ─── Data ───────────────────────────────────────────────────────────────────

const PLATFORM_STATS = [
  { value: 7000, suffix: '+', label: 'MS4s Nationwide', icon: Building2 },
  { value: 50, suffix: '', label: 'States Monitored', icon: Globe },
  { value: 565000, suffix: '+', label: 'Monitoring Points Nationwide', icon: Droplets },
  { value: 15, suffix: 'min', label: 'Data Resolution', icon: Activity },
];

const DATA_FEEDS = [
  { name: 'EPA ATTAINS', desc: 'National assessment & impairment database', icon: Database, color: 'from-blue-600 to-blue-800' },
  { name: 'USGS NWIS', desc: 'Real-time streamflow & water quality gauges', icon: Activity, color: 'from-emerald-600 to-teal-800' },
  { name: 'Water Quality Portal', desc: 'Multi-agency monitoring results', icon: Search, color: 'from-violet-600 to-purple-800' },
  { name: 'NOAA CO-OPS', desc: 'Tidal & oceanographic observations', icon: Waves, color: 'from-cyan-600 to-sky-800' },
  { name: 'EJScreen', desc: 'Environmental justice mapping overlays', icon: ShieldCheck, color: 'from-amber-600 to-orange-800' },
  { name: 'ALIA Sensors (In Development)', desc: 'Proprietary continuous monitoring network — hardware integration in progress', icon: Zap, color: 'from-rose-600 to-red-800' },
];

const STAKEHOLDER_TRACKS = [
  {
    role: 'Municipal Operators',
    icon: Building2,
    accent: 'text-cyan-400',
    accentBg: 'bg-cyan-400/10 border-cyan-400/20',
    headline: 'MS4 compliance without the complexity',
    points: [
      'Automated permit reporting for any state',
      'TMDL progress tracking with live BMP performance',
      'Nutrient credit documentation and ROI analysis',
      'Storm event capture with real-time removal metrics',
    ],
  },
  {
    role: 'State & Federal Agencies',
    icon: Shield,
    accent: 'text-blue-400',
    accentBg: 'bg-blue-400/10 border-blue-400/20',
    headline: 'Every waterbody. Every jurisdiction. One view.',
    points: [
      'Statewide ATTAINS assessment dashboard',
      'Cross-jurisdiction benchmarking and peer comparison',
      'Impaired waterbody prioritization with EJ overlays',
      'Real-time compliance status across all permittees',
    ],
  },
  {
    role: 'Research / Academic',
    icon: Microscope,
    accent: 'text-violet-400',
    accentBg: 'bg-violet-400/10 border-violet-400/20',
    headline: 'Continuous high-frequency data for real science',
    points: [
      '15-minute interval sensor data with QAPP-grade QA/QC',
      'Multi-source data fusion: USGS + WQP + ALIA sensors',
      'Bulk export, API access, and citation-ready formats',
      'Manuscript collaboration tools and DOI registration',
    ],
  },
  {
    role: 'Corporate & ESG',
    icon: LineChart,
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-400/10 border-emerald-400/20',
    headline: 'Quantified water impact for ESG disclosure',
    points: [
      'GRI 303 and SASB aligned water impact scoring',
      'Portfolio-wide environmental risk assessment',
      'Grant eligibility matching and funding opportunities',
      'Stakeholder-ready reports with verified metrics',
    ],
  },
  {
    role: 'K-12 & Education',
    icon: GraduationCap,
    accent: 'text-amber-400',
    accentBg: 'bg-amber-400/10 border-amber-400/20',
    headline: 'Turn local waterways into living classrooms',
    points: [
      'NGSS-aligned lesson plans with real sensor data',
      'Interactive watershed exploration tools',
      'Student field study modules and data journals',
      'Connections to real scientists and restoration projects',
    ],
  },
];

const DIFFERENTIATORS = [
  {
    icon: Beaker,
    title: 'ALIA Treatment Platform',
    desc: 'Modular, deployable water treatment powered by oyster biofiltration and engineered media. 88-95% TSS removal, 93.8% bacteria reduction \u2014 field validated.',
  },
  {
    icon: Zap,
    title: 'Real-Time Intelligence',
    desc: 'Not quarterly grab samples. Continuous 15-minute monitoring that catches what snapshots miss \u2014 storm pulses, diurnal cycles, emerging trends.',
  },
  {
    icon: Database,
    title: 'Federal Data Integration',
    desc: 'ATTAINS, USGS NWIS, WQP, NOAA CO-OPS, EJScreen \u2014 all normalized, cross-referenced, and queryable from a single platform.',
  },
  {
    icon: Microscope,
    title: 'AQUA-Lo Laboratory Intelligence',
    desc: 'Full-spectrum LIMS for water quality labs \u2014 sample intake, chain of custody, QA/QC workflows, method management, and audit-ready reporting in one system.',
  },
  {
    icon: BarChart3,
    title: 'Compliance Automation',
    desc: 'One-click MS4 annual reports, automated TMDL tracking, nutrient credit calculation. What used to take weeks now takes minutes.',
  },
  {
    icon: Shield,
    title: 'Closed-Loop Verification',
    desc: 'PIN detects the problem, ALIA treats it, AQUA-Lo validates the results, PIN documents the outcome. Detection to resolution in a single platform.',
  },
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface PublicLandingProps {
  onSignIn: () => void;
  onExploreState?: (stateAbbr: string) => void;
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

export function PublicLanding({ onSignIn }: PublicLandingProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Instrument Sans', 'DM Sans', system-ui, sans-serif" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ═══ NAVBAR ═══ */}
      <PublicHeader />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0">
          <Image src="/marsh-waterfront.jpeg" alt="" fill className="object-cover" priority sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950/30" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pb-12 sm:pb-20 pt-24 sm:pt-32 w-full">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 mb-6 sm:mb-8">
                <LivePulse />
                <span className="text-xs font-semibold text-emerald-300 tracking-wide">Live data from 50 states</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-[1.1] tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Your water data is scattered across a dozen systems.
              </h1>
              <p className="mt-4 sm:mt-5 text-base sm:text-lg lg:text-xl text-slate-300 leading-relaxed max-w-2xl font-light">
                Manual reporting. Siloed databases. Quarterly grab samples that miss everything between visits.
                There&rsquo;s a better way &mdash; one platform that connects EPA datasets, live sensors, and
                treatment verification into decision-ready intelligence.
              </p>

              <div className="mt-8 sm:mt-10 flex flex-wrap gap-3 sm:gap-4">
                <button onClick={onSignIn} className="group inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-semibold text-slate-900 bg-white rounded-full hover:bg-slate-100 transition-all shadow-2xl shadow-black/20">
                  Explore the Platform <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <a href="#technology" className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium text-white/90 border border-white/20 rounded-full hover:bg-white/10 transition-all backdrop-blur-sm">
                  <Eye className="h-4 w-4" /> Learn More
                </a>
              </div>
            </div>

            {/* Hero video */}
            <div className={`mt-4 lg:mt-0 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900/80 border border-white/[0.12] shadow-2xl backdrop-blur-sm">
                <video
                  className="absolute inset-0 w-full h-full object-cover"
                  src="https://ifpen1a3kqxzhzkj.public.blob.vercel-storage.com/videos/pin-unifying-water-intelligence.mp4"
                  controls
                  playsInline
                  preload="metadata"
                  poster=""
                />
              </div>
            </div>
          </div>

          <div className={`mt-8 lg:mt-4 text-center transition-all duration-1000 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            <ChevronDown className="h-6 w-6 text-white/40 animate-bounce mx-auto" />
          </div>
        </div>
      </section>

      {/* ═══ CASE STUDY CALLOUT ═══ */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              What if PEARL ALIA had been there?
            </h2>
            <p className="mt-3 text-base sm:text-lg text-slate-400 italic">Aquatic Life Improvement Accelerator</p>
          </div>
          <p className="text-lg text-slate-300 leading-relaxed text-center max-w-3xl mx-auto mb-10">
            In January 2026, a collapsed sewer line dumped 200+ million gallons of raw sewage into the Potomac River &mdash; one of the largest spills in U.S. history. No independent monitoring detected it. No treatment intercepted it.
          </p>
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/60 to-slate-800/60 p-8 backdrop-blur-sm">
            <p className="text-lg sm:text-xl text-white font-semibold leading-relaxed text-center">
              In our first pilot, PEARL ALIA achieved <span className="text-cyan-400">93.8% E. coli reduction</span> and <span className="text-cyan-400">90-95% TSS removal</span> &mdash; without even targeting bacteria. Imagine that technology deployed at every overflow point.
            </p>
          </div>
          <div className="mt-10 text-center">
            <a
              href="mailto:doug@project-pearl.org?subject=PEARL Demo Request"
              className="group inline-flex items-center gap-3 px-8 py-4 text-base font-semibold text-slate-900 bg-white rounded-full hover:bg-slate-100 transition-all shadow-2xl shadow-black/30"
            >
              Request a Demo <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* ═══ TRUST SIGNALS ═══ */}
      <section className="py-10 bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-6">
            Powered by Authoritative Federal Data
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {[
              { name: 'EPA', full: 'Environmental Protection Agency', datasets: 'ATTAINS + EJScreen' },
              { name: 'USGS', full: 'U.S. Geological Survey', datasets: 'NWIS Real-Time Gauges' },
              { name: 'NOAA', full: 'National Oceanic & Atmospheric Administration', datasets: 'CO-OPS + NDBC Buoys' },
              { name: 'WQP', full: 'Water Quality Portal', datasets: 'Multi-Agency Monitoring' },
            ].map(agency => (
              <div key={agency.name} className="flex items-center gap-3 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <span className="text-xs font-black text-slate-600">{agency.name}</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-slate-700 leading-tight">{agency.full}</p>
                  <p className="text-[10px] text-slate-400">{agency.datasets}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-slate-400 mt-5">
            430M+ federal datapoints aggregated &middot; 565,000+ assessment units &middot; Field validated in Milton, FL (Jan 2025)
          </p>
        </div>
      </section>

      {/* ═══ PLATFORM SCALE ═══ */}
      <section id="platform" className="relative bg-white py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.06) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-cyan-600 mb-3">National Scale</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Built for the complexity of U.S. water
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {PLATFORM_STATS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="text-center p-8 rounded-2xl bg-slate-50 border border-slate-200">
                  <Icon className="h-6 w-6 text-cyan-600 mx-auto mb-4" />
                  <div className="text-4xl sm:text-5xl font-bold text-slate-900 mb-2 tabular-nums">
                    <Counter target={s.value} suffix={s.suffix} />
                  </div>
                  <div className="text-sm text-slate-500 font-medium">{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ DATA SOURCES ═══ */}
      <section id="data" className="py-24 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-cyan-400 mb-3">Integrated Data</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Six federal and proprietary data streams. One unified view.
            </h2>
            <p className="text-slate-300 leading-relaxed">
              We don&#39;t just aggregate data &mdash; we normalize, cross-reference, and contextualize it.
              Every measurement is traceable to its source, QA/QC verified, and available through a single API.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DATA_FEEDS.map((feed, i) => {
              const Icon = feed.icon;
              return (
                <div key={i} className="group relative p-6 rounded-2xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300 cursor-default overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${feed.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${feed.color} mb-4`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">{feed.name}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{feed.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ THE TECHNOLOGY — barge hero ═══ */}
      <section id="technology" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-slate-400 mb-3">The ALIA Difference</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Not another dashboard.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">A new category of water intelligence.</span>
              </h2>
              <p className="text-slate-600 leading-relaxed mb-8">
                Every ALIA unit is a modular treatment platform and high-frequency data node with 8 monitoring points. Paired with AQUA-Lo, our laboratory information management system, every sample is tracked from intake to audit-ready report &mdash; transforming environmental restoration into verified, actionable intelligence.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-xl bg-slate-50">
                  <div className="text-2xl font-bold text-slate-900">90-95%</div>
                  <div className="text-xs text-slate-500 mt-1">TSS Removal</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-slate-50">
                  <div className="text-2xl font-bold text-slate-900">93.8%</div>
                  <div className="text-xs text-slate-500 mt-1">E. Coli Reduction</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-slate-50">
                  <div className="text-2xl font-bold text-slate-900">4-Stage</div>
                  <div className="text-xs text-slate-500 mt-1">Treatment Process</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <Image src="/pearl-barge.jpg" alt="ALIA modular treatment barge" width={700} height={400} className="rounded-2xl shadow-2xl" />
              <div className="absolute -bottom-4 -right-4 bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-3 hidden sm:block">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Field Validated</div>
                <div className="text-sm font-bold text-slate-900">Milton, FL &mdash; Jan 2026</div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {DIFFERENTIATORS.map((d, i) => {
              const Icon = d.icon;
              return (
                <div key={i} className="group p-8 rounded-2xl border-2 border-slate-100 hover:border-cyan-200 bg-gradient-to-br from-white to-slate-50/50 transition-all duration-300">
                  <div className="flex items-start gap-5">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center group-hover:bg-cyan-600 transition-colors duration-300">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{d.title}</h3>
                      <p className="text-slate-500 leading-relaxed text-[15px]">{d.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <Link href="/treatment" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
              Deep dive into the treatment technology <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ STAKEHOLDERS ═══ */}
      <section id="stakeholders" className="py-24 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-cyan-400 mb-3">Built For You</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              One platform. Every stakeholder in the water quality ecosystem.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {STAKEHOLDER_TRACKS.map((track, i) => {
              const Icon = track.icon;
              return (
                <div key={i} className="group p-7 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.15] transition-all duration-300 cursor-pointer" onClick={onSignIn}>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-5 ${track.accentBg} ${track.accent}`}>
                    <Icon className="h-3.5 w-3.5" /> {track.role}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-4 leading-snug">{track.headline}</h3>
                  <ul className="space-y-3">
                    {track.points.map((point, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm text-slate-400">
                        <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${track.accent.replace('text-', 'bg-')}`} />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <div className={`mt-6 flex items-center gap-2 text-sm font-semibold ${track.accent} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    Get started <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ MODULAR ECOSYSTEM ═══ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-cyan-600 mb-3">Modular Architecture</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              12 purpose-built command centers. 87 analytical lenses.
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">
              Every user gets a workspace designed for their role &mdash; from MS4 coordinators to federal analysts to K-12 teachers. Pick your center, choose your lenses, see exactly what matters to you.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { icon: Landmark, name: 'National Command', desc: 'Federal-scale oversight across all 50 states', accent: 'bg-blue-50 border-blue-200 text-blue-700' },
              { icon: Shield, name: 'State Command', desc: 'Statewide ATTAINS dashboards and TMDL tracking', accent: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
              { icon: Building2, name: 'MS4 Command', desc: 'Permit compliance, BMP performance, storm events', accent: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
              { icon: Factory, name: 'Utility Command', desc: 'Infrastructure monitoring and discharge tracking', accent: 'bg-teal-50 border-teal-200 text-teal-700' },
              { icon: LineChart, name: 'ESG Command', desc: 'GRI 303 & SASB aligned water impact scoring', accent: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { icon: Microscope, name: 'University Command', desc: 'Research tools, data export, and manuscript support', accent: 'bg-violet-50 border-violet-200 text-violet-700' },
              { icon: Leaf, name: 'NGO Command', desc: 'Conservation impact tracking and grant matching', accent: 'bg-green-50 border-green-200 text-green-700' },
              { icon: GraduationCap, name: 'K-12 Command', desc: 'NGSS-aligned lessons with real sensor data', accent: 'bg-amber-50 border-amber-200 text-amber-700' },
              { icon: HardHat, name: 'Infrastructure', desc: 'Asset monitoring and capacity planning', accent: 'bg-orange-50 border-orange-200 text-orange-700' },
              { icon: FlaskConical, name: 'AQUA-Lo LIMS', desc: 'Lab management from intake to audit-ready report', accent: 'bg-pink-50 border-pink-200 text-pink-700' },
              { icon: Beaker, name: 'PEARL ALIA', desc: 'Treatment hardware monitoring and verification', accent: 'bg-rose-50 border-rose-200 text-rose-700' },
              { icon: Settings, name: 'Admin Center', desc: 'User management, permissions, and system config', accent: 'bg-slate-50 border-slate-300 text-slate-700' },
            ].map((center) => {
              const Icon = center.icon;
              const [bg, border, text] = center.accent.split(' ');
              return (
                <div key={center.name} className={`p-5 rounded-xl border ${bg} ${border} transition-all hover:shadow-md cursor-default`}>
                  <Icon className={`h-5 w-5 ${text} mb-3`} />
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{center.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{center.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ NEXT CHAPTER — partnership CTA bridge ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-cyan-950 to-slate-50">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(6,182,212,.4) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(59,130,246,.3) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(20,184,166,.2) 0%, transparent 60%)' }} />
        {/* Wave SVG divider — below content, not overlapping */}
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ height: '60px' }}>
          <path d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,80 1440,60 L1440,120 L0,120Z" fill="rgb(249,250,251)" />
          <path d="M0,80 C320,40 640,100 960,60 C1200,30 1360,70 1440,80 L1440,120 L0,120Z" fill="rgb(249,250,251)" opacity="0.5" />
        </svg>
        <div className="relative z-10 max-w-3xl mx-auto px-6 lg:px-8 pt-16 sm:pt-24 pb-28 sm:pb-32 text-center">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-cyan-400 mb-4">The Next Chapter</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Partnership &amp; Discovery
          </h2>
          <p className="text-slate-300 leading-relaxed max-w-xl mx-auto text-[15px]">
            Project PEARL is more than a technology &mdash; it is a platform for collaboration. We are seeking scientific partners, research institutions, and foundational investors to help scale our impact and unlock the next wave of discoveries in marine restoration.
          </p>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-24 bg-gradient-to-br from-slate-50 via-white to-cyan-50">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Water quality data should work as hard as you do.
          </h2>
          <p className="text-lg text-slate-600 mb-10 max-w-xl mx-auto">
            Whether you manage stormwater permits, regulate a state&#39;s waters, or research
            aquatic ecosystems &mdash; PEARL puts actionable intelligence at your fingertips.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={onSignIn} className="group inline-flex items-center gap-3 px-8 py-4 text-base font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20">
              Request Access <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="mailto:doug@project-pearl.org?subject=PEARL%20Platform%20Inquiry" className="inline-flex items-center gap-2 px-8 py-4 text-base font-medium text-slate-700 border-2 border-slate-200 rounded-full hover:border-slate-300 hover:bg-white transition-all">
              Talk to Our Team
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-slate-950 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-5 gap-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-4 mb-4">
                <Image src="/Logo_Pearl_with_reef.jpg" alt="PEARL" width={120} height={120} className="object-contain rounded-lg opacity-90" />
              </div>
              <p className="text-sm text-slate-500 leading-relaxed max-w-sm mb-4">
                PEARL Intelligence Network (PIN) &mdash; Proactive Engineering for Aquatic Rehabilitation &amp; Legacy.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <LivePulse />
                <span className="text-xs text-emerald-400/70 font-medium">Systems operational</span>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold tracking-[0.15em] uppercase text-slate-400 mb-4">Dashboards</h4>
              <ul className="space-y-3 text-sm text-slate-500">
                <li><span className="hover:text-white cursor-pointer transition-colors" onClick={onSignIn}>MS4 Compliance</span></li>
                <li><span className="hover:text-white cursor-pointer transition-colors" onClick={onSignIn}>State Dashboard</span></li>
                <li><span className="hover:text-white cursor-pointer transition-colors" onClick={onSignIn}>Federal Overview</span></li>
                <li><span className="hover:text-white cursor-pointer transition-colors" onClick={onSignIn}>Research Tools</span></li>
                <li><span className="hover:text-white cursor-pointer transition-colors" onClick={onSignIn}>ESG Reporting</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold tracking-[0.15em] uppercase text-slate-400 mb-4">About</h4>
              <ul className="space-y-3 text-sm text-slate-500">
                <li><Link href="/treatment" className="hover:text-white transition-colors">Our Technology</Link></li>
                <li><Link href="/story" className="hover:text-white transition-colors">Our Story</Link></li>
                <li><Link href="/methodology" className="hover:text-white transition-colors">Methodology</Link></li>
                <li><Link href="/explore" className="hover:text-white transition-colors">Explore Data</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold tracking-[0.15em] uppercase text-slate-400 mb-4">Resources</h4>
              <ul className="space-y-3 text-sm text-slate-500">
                <li><a href="https://www.epa.gov/npdes/stormwater-discharges-municipal-sources" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors inline-flex items-center gap-1">MS4 Regulations <ExternalLink className="h-3 w-3" /></a></li>
                <li><a href="https://www.epa.gov/waterdata/attains" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors inline-flex items-center gap-1">EPA ATTAINS <ExternalLink className="h-3 w-3" /></a></li>
                <li><a href="https://waterdata.usgs.gov/nwis" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors inline-flex items-center gap-1">USGS NWIS <ExternalLink className="h-3 w-3" /></a></li>
                <li><a href="mailto:doug@project-pearl.org" className="hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">&copy; {new Date().getFullYear()} PEARL. All rights reserved.</p>
            <p className="text-xs text-slate-600">Patent Pending &middot; Built in Maryland</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
