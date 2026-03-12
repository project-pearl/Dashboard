'use client';

import { lazy, Suspense } from 'react';
import type { LucideIcon } from 'lucide-react';

// Icon placeholder component for loading states
function IconPlaceholder({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <div className={`${className} bg-slate-200 dark:bg-slate-700 rounded animate-pulse`} />
  );
}

// Core icons that are always needed (navigation, basic UI)
const coreIcons = {
  ChevronLeft: lazy(() => import('lucide-react').then(m => ({ default: m.ChevronLeft }))),
  ChevronRight: lazy(() => import('lucide-react').then(m => ({ default: m.ChevronRight }))),
  ChevronDown: lazy(() => import('lucide-react').then(m => ({ default: m.ChevronDown }))),
  Menu: lazy(() => import('lucide-react').then(m => ({ default: m.Menu }))),
  X: lazy(() => import('lucide-react').then(m => ({ default: m.X }))),
  LayoutDashboard: lazy(() => import('lucide-react').then(m => ({ default: m.LayoutDashboard }))),
  MapPin: lazy(() => import('lucide-react').then(m => ({ default: m.MapPin }))),
};

// Role-specific icon bundles
const roleIconBundles = {
  federal: lazy(() => import('./iconBundles/federalIcons').then(m => m.federalIcons)),
  state: lazy(() => import('./iconBundles/stateIcons').then(m => m.stateIcons)),
  local: lazy(() => import('./iconBundles/localIcons').then(m => m.localIcons)),
  esg: lazy(() => import('./iconBundles/esgIcons').then(m => m.esgIcons)),
  biotech: lazy(() => import('./iconBundles/biotechIcons').then(m => m.biotechIcons)),
  university: lazy(() => import('./iconBundles/universityIcons').then(m => m.universityIcons)),
  k12: lazy(() => import('./iconBundles/k12Icons').then(m => m.k12Icons)),
};

interface LazyIconProps {
  name: string;
  role?: keyof typeof roleIconBundles;
  className?: string;
  fallback?: React.ComponentType<any>;
}

export function LazyIcon({
  name,
  role,
  className = "w-4 h-4",
  fallback: Fallback = IconPlaceholder
}: LazyIconProps) {
  // Check core icons first
  const CoreIconComponent = coreIcons[name as keyof typeof coreIcons];

  if (CoreIconComponent) {
    return (
      <Suspense fallback={<Fallback className={className} />}>
        <CoreIconComponent className={className} aria-hidden="true" />
      </Suspense>
    );
  }

  // If not core, need role-specific bundle
  if (!role) {
    return <Fallback className={className} />;
  }

  // Lazy load role-specific icons
  const RoleIconBundle = roleIconBundles[role];

  return (
    <Suspense fallback={<Fallback className={className} />}>
      <RoleIconBundle iconName={name} className={className} />
    </Suspense>
  );
}

// Cache for loaded icon bundles
const loadedBundles = new Map<string, any>();

// Preload icons for a specific role
export async function preloadIconBundle(role: keyof typeof roleIconBundles) {
  if (loadedBundles.has(role)) {
    return loadedBundles.get(role);
  }

  try {
    const bundle = await roleIconBundles[role]();
    loadedBundles.set(role, bundle);
    return bundle;
  } catch (error) {
    console.warn(`Failed to preload icon bundle for ${role}:`, error);
    return null;
  }
}

// Get available role-based icon names
export function getAvailableIcons(role?: keyof typeof roleIconBundles): string[] {
  const coreIconNames = Object.keys(coreIcons);

  if (!role) {
    return coreIconNames;
  }

  // For now, return a placeholder - this would be populated by the actual bundles
  return [...coreIconNames, 'Building2', 'Map', 'Factory', 'Shield', 'FlaskConical', 'GraduationCap'];
}