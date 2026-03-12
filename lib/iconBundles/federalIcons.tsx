'use client';

import {
  Landmark,
  Shield,
  Activity,
  FileText,
  Trophy,
  TrendingUp,
  Scale,
  Sparkles,
  ShieldCheck,
  Waves,
  BarChart3,
  Gauge,
  HardHat,
  DollarSign,
  Users,
  AlertTriangle,
  Bell,
  Wrench,
  FileCheck,
  RadioTower,
} from 'lucide-react';

// Federal-specific icons mapping
const federalIconMap = {
  // Government/Federal
  Landmark,
  Shield,
  ShieldCheck,
  Scale,

  // Monitoring/Data
  Activity,
  BarChart3,
  Gauge,
  TrendingUp,
  Waves,

  // Reports/Documents
  FileText,
  FileCheck,

  // Achievements/Quality
  Trophy,
  Sparkles,

  // Alerts/Communication
  AlertTriangle,
  Bell,
  RadioTower,

  // Infrastructure/Operations
  HardHat,
  Wrench,

  // People/Resources
  Users,
  DollarSign,
};

interface FederalIconsProps {
  iconName: string;
  className?: string;
}

export function federalIcons({ iconName, className }: FederalIconsProps) {
  const IconComponent = federalIconMap[iconName as keyof typeof federalIconMap];

  if (!IconComponent) {
    // Fallback icon or placeholder
    return <div className={`${className} bg-slate-200 dark:bg-slate-700 rounded`} />;
  }

  return <IconComponent className={className} aria-hidden="true" />;
}

// Export available icon names for this bundle
export const availableFederalIcons = Object.keys(federalIconMap);

// Preload function for this bundle
export function preloadFederalIcons() {
  return import('lucide-react').then(() => federalIconMap);
}