// components/TierBadge.tsx
// Data confidence tier badge — shield (T1), beaker (T2), people (T3), eye (T4)
'use client';

import type { DataConfidenceTier } from '@/lib/useWaterData';
import { TIER_META } from '@/lib/useWaterData';

interface TierBadgeProps {
  tier: DataConfidenceTier;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  compact?: boolean;
}

const SIZE_CONFIG = {
  xs: { icon: 10, text: 'text-[9px]',  gap: 'gap-0.5', px: 'px-1',   py: 'py-0' },
  sm: { icon: 12, text: 'text-[10px]', gap: 'gap-0.5', px: 'px-1',   py: 'py-0' },
  md: { icon: 14, text: 'text-xs',     gap: 'gap-1',   px: 'px-1.5', py: 'py-0.5' },
  lg: { icon: 16, text: 'text-sm',     gap: 'gap-1',   px: 'px-2',   py: 'py-0.5' },
} as const;

// Shield with checkmark — Tier 1 Regulatory
function ShieldIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1L2 3.5V7.5C2 11.08 4.56 14.36 8 15C11.44 14.36 14 11.08 14 7.5V3.5L8 1Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Beaker with bubbles — Tier 2 Research
function BeakerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2V6L3 12.5C2.7 13.2 3.2 14 4 14H12C12.8 14 13.3 13.2 13 12.5L10 6V2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <line x1="5" y1="2" x2="11" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="7" cy="10" r="0.8" fill="currentColor" />
      <circle cx="9.5" cy="8.5" r="0.6" fill="currentColor" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

// People with hands — Tier 3 Community
function PeopleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5.5" cy="5" r="1.8" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" />
      <circle cx="10.5" cy="5" r="1.8" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" />
      <path d="M2 13C2 10.8 3.3 9 5.5 9C6.6 9 7.4 9.4 8 10C8.6 9.4 9.4 9 10.5 9C12.7 9 14 10.8 14 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3.5 11.5L2 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M12.5 11.5L14 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// Eye with question mark — Tier 4 Observational
function EyeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 8C1.5 8 4 3.5 8 3.5C12 3.5 14.5 8 14.5 8C14.5 8 12 12.5 8 12.5C4 12.5 1.5 8 1.5 8Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
      <text x="8" y="9.5" textAnchor="middle" fontSize="4.5" fontWeight="bold" fill="currentColor">?</text>
    </svg>
  );
}

const TIER_ICONS: Record<DataConfidenceTier, React.FC<{ size: number }>> = {
  1: ShieldIcon,
  2: BeakerIcon,
  3: PeopleIcon,
  4: EyeIcon,
};

export function TierBadge({ tier, size = 'sm', showLabel = false, compact = false }: TierBadgeProps) {
  const meta = TIER_META[tier];
  const cfg = SIZE_CONFIG[size];
  const Icon = TIER_ICONS[tier];
  const title = `Tier ${tier}: ${meta.label} — ${meta.description}`;

  if (compact) {
    return (
      <span className={`inline-flex items-center ${meta.color}`} title={title}>
        <Icon size={cfg.icon} />
      </span>
    );
  }

  return (
    <a
      href="/tools/data-provenance#tiers"
      className={`inline-flex items-center ${cfg.gap} ${cfg.px} ${cfg.py} rounded-full ${meta.bgColor} ${meta.color} ${cfg.text} font-medium leading-none whitespace-nowrap hover:opacity-80 transition-opacity`}
      title={title}
    >
      <Icon size={cfg.icon} />
      {showLabel ? meta.label : `T${tier}`}
    </a>
  );
}
