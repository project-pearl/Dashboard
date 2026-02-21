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
    subtitle: 'PEARL Intelligence Network',
    headline: 'Explore Your Watershed',
    description:
      'Hands-on water quality learning powered by real EPA data. Discover what\'s in your local waterways and why it matters.',
    accentColor: 'text-emerald-400',
  },
  state: {
    image: '/images/heroes/Aerial.png',
    subtitle: 'PEARL Intelligence Network',
    headline: 'Statewide Water Intelligence',
    description:
      'Comprehensive watershed monitoring, compliance tracking, and assessment analytics across every waterbody in your jurisdiction.',
    accentColor: 'text-cyan-400',
  },
  ms4: {
    image: '/images/heroes/MS4.png',
    subtitle: 'PEARL Intelligence Network',
    headline: 'Municipal Stormwater Compliance',
    description:
      'Track BMP performance, monitor outfall discharge, and streamline MS4 permit reporting with real-time water quality data.',
    accentColor: 'text-amber-400',
  },
  esg: {
    image: '/images/heroes/Industrial.png',
    subtitle: 'PEARL Intelligence Network',
    headline: 'Water Risk & ESG Performance',
    description:
      'Quantify water risk exposure, benchmark facility performance, and generate audit-ready sustainability disclosures.',
    accentColor: 'text-emerald-400',
  },
  university: {
    image: '/images/heroes/Research.png',
    subtitle: 'PEARL Intelligence Network',
    headline: 'Water Quality Research Hub',
    description:
      'Access nationwide water quality datasets, publish findings, and collaborate across institutions with integrated research tools.',
    accentColor: 'text-violet-400',
  },
  national: {
    image: '/images/heroes/NCC.png',
    subtitle: 'PEARL Intelligence Network',
    headline: 'National Command Center',
    description:
      'Real-time water quality intelligence across 565,000+ monitoring points in every state. Federal-scale oversight, watershed-level precision.',
    accentColor: 'text-blue-400',
  },
  ngo: {
    image: '/oyster-restoration.png',
    subtitle: 'PEARL Intelligence Network',
    headline: 'Watershed Conservation Hub',
    description:
      'Advocacy-ready data, grant matching, and restoration intelligence to protect the waterways your community depends on.',
    accentColor: 'text-emerald-400',
  },
  pearl: {
    image: '/underwater.png',
    subtitle: 'PEARL Intelligence Network',
    headline: 'Pearl Command Center',
    description:
      'Deployment tracking, fleet performance, and field diagnostics across all active PEARL units.',
    accentColor: 'text-rose-400',
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
    <div className={`relative w-full overflow-hidden rounded-2xl cursor-default select-none ${className}`} onDoubleClick={onDoubleClick}>
      {/* Background image */}
      <div className="relative h-[280px] sm:h-[320px] lg:h-[360px] w-full">
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
          <span
            className={`text-xs sm:text-sm font-bold uppercase tracking-[0.2em] ${config.accentColor} mb-2 sm:mb-3`}
          >
            {config.subtitle}
          </span>

          {/* Headline */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white leading-tight max-w-2xl">
            {config.headline}
          </h1>

          {/* Description */}
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-white/80 max-w-xl leading-relaxed">
            {config.description}
          </p>
        </div>
      </div>
    </div>
  );
}
