'use client';

import Image from 'next/image';

export interface HeroBannerConfig {
  image: string;
  subtitle: string;
  headline: string;
  description: string;
  accentColor: string; // Tailwind text color class for subtitle
  gradientFrom?: string; // Optional custom gradient
}

// ─── Per-CC hero configs ───────────────────────────────────────────
export const heroConfigs: Record<string, HeroBannerConfig> = {
  k12: {
    image: '/images/heroes/K12.png',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'Explore Your Watershed',
    description:
      'Hands-on water quality learning powered by real EPA data. Discover what\'s in your local waterways and why it matters.',
    accentColor: 'text-emerald-400',
  },
  state: {
    image: '/images/heroes/Aerial.png',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'Statewide Water Intelligence',
    description:
      'Comprehensive watershed monitoring, compliance tracking, and assessment analytics across every waterbody in your jurisdiction.',
    accentColor: 'text-cyan-400',
  },
  esg: {
    image: '/images/heroes/Industrial.png',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'Water Risk & Sustainability Performance',
    description:
      'Quantify water risk exposure, benchmark facility performance, and generate audit-ready sustainability disclosures.',
    accentColor: 'text-emerald-400',
  },
  university: {
    image: '/images/heroes/Research.png',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'Water Quality Research Hub',
    description:
      'Access nationwide water quality datasets, publish findings, and collaborate across institutions with integrated research tools.',
    accentColor: 'text-violet-400',
  },
  national: {
    image: '/images/heroes/NCC.png',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'Federal Management Center',
    description:
      'Real-time water quality intelligence across 565,000+ monitoring points in every state. Federal-scale oversight, watershed-level precision.',
    accentColor: 'text-blue-400',
  },
  ngo: {
    image: '/oyster-restoration.png',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'Watershed Conservation Hub',
    description:
      'Advocacy-ready data, grant matching, and restoration intelligence to protect the waterways your community depends on.',
    accentColor: 'text-emerald-400',
  },
  pearl: {
    image: '/images/heroes/underwater-pearl.jpg',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'PIN Management Center',
    description:
      'Deployment tracking, fleet performance, and field diagnostics across all active PIN units.',
    accentColor: 'text-rose-400',
  },
  utility: {
    image: '/images/heroes/Industrial.png',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'Municipal Water Utility',
    description:
      'Compliance monitoring, treatment optimization, and contaminant tracking for public water systems.',
    accentColor: 'text-sky-400',
  },
  infrastructure: {
    image: '/images/heroes/MS4.png',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'Site & Property Intelligence',
    description:
      'Location-based water quality risk assessment, regulatory exposure, and environmental due diligence for any US property.',
    accentColor: 'text-slate-400',
  },
  insurance: {
    image: '/images/heroes/Aerial.png',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'Water Risk Intelligence',
    description:
      'Flood risk assessment, contamination analysis, and portfolio due diligence for informed underwriting decisions.',
    accentColor: 'text-indigo-400',
  },
  agriculture: {
    image: '/images/heroes/Aerial.png',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'Agricultural Water Management',
    description:
      'Nutrient tracking, irrigation optimization, and conservation credit management for sustainable agriculture.',
    accentColor: 'text-lime-400',
  },
  'aqua-lo': {
    image: '/images/heroes/Research.png',
    subtitle: 'PIN — PEARL Intelligence Network',
    headline: 'AQUA-LO Laboratory',
    description:
      'Full-spectrum laboratory information management — sample intake, QA/QC, methods, and chain of custody.',
    accentColor: 'text-teal-400',
  },
};

// ─── Component ─────────────────────────────────────────────────────
interface HeroBannerProps {
  role: string;
  className?: string;
  children?: React.ReactNode;
  onDoubleClick?: () => void;
}

export default function HeroBanner({ role, className = '', children, onDoubleClick }: HeroBannerProps) {
  const config = heroConfigs[role];
  if (!config) return null;

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl cursor-default select-none ${className}`} style={{ border: '1px solid var(--border-subtle)' }} onDoubleClick={onDoubleClick}>
      {/* Background image */}
      <div className="relative h-[160px] sm:h-[180px] lg:h-[200px] w-full">
        <Image
          src={config.image}
          alt={config.headline}
          fill
          className="object-cover"
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1400px"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30" />

        {/* Top-right controls overlay */}
        {children && (
          <div className="absolute top-4 right-4 sm:top-5 sm:right-6 flex items-center gap-2 z-10">
            {children}
          </div>
        )}

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10 lg:px-14">
          {/* Subtitle label */}
          <div className="mb-1.5 sm:mb-2">
            <span
              className={`inline-flex items-center gap-1.5 w-fit text-sm sm:text-base font-extrabold uppercase tracking-[0.18em] ${config.accentColor}`}
              style={{ textShadow: '0 0 12px currentColor, 0 0 24px currentColor' }}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse" style={{ boxShadow: '0 0 6px currentColor' }} />
              {config.subtitle}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-tight max-w-2xl">
            {config.headline}
          </h1>

          {/* Description */}
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-white/80 max-w-xl leading-relaxed">
            {config.description}
          </p>
        </div>
      </div>
    </div>
  );
}
