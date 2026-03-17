'use client';

import React, { useState, useMemo, useEffect, useCallback, useTransition, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { canAccessRoute } from '@/lib/roleRoutes';
import { getLensesForHref, type LensDef } from '@/lib/lensRegistry';
import { useAdminState, STATE_ABBR_TO_NAME } from '@/lib/adminStateContext';
// Core navigation icons - kept for immediate use
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  LayoutDashboard,
  MapPin,
  // Nav-group icons used in buildNavGroups
  Landmark,
  Map,
  Building2,
  Factory,
  Microscope,
  TrendingUp,
  Search,
  FlaskConical,
  GraduationCap,
  BookOpen,
  Leaf,
  Crown,
  FileCheck,
  // Icons used directly in sidebar JSX
  Home,
  Zap,
  Settings,
  Mail,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LazyIcon, preloadIconBundle } from '@/lib/iconLoader';

// Lens icon names for lazy loading
export const LENS_ICON_NAMES: Record<string, string> = {
  // ── Shared / Federal ───────────────────────────────────────────────────────
  overview: 'LayoutDashboard',
  briefing: 'Sparkles',
  compliance: 'ShieldCheck',
  'water-quality': 'Waves',
  infrastructure: 'Building2',
  monitoring: 'Activity',
  trends: 'TrendingUp',
  policy: 'Scale',
  contaminants: 'Biohazard',
  'public-health': 'Biohazard',
  'habitat-ecology': 'TreePine',
  'agricultural-nps': 'Sprout',
  'disaster-emergency': 'AlertTriangle',
  'military-installations': 'Shield',
  'fire-air-quality': 'Flame',
  scorecard: 'Trophy',
  reports: 'FileText',
  interagency: 'Network',
  funding: 'Banknote',
  full: 'LayoutDashboard',
  // ── State ──────────────────────────────────────────────────────────────────
  coverage: 'Activity',
  programs: 'Landmark',
  ms4oversight: 'CloudRain',
  habitat: 'TreePine',
  agriculture: 'Sprout',
  disaster: 'AlertTriangle',
  tmdl: 'Waves',
  permits: 'FileCheck',
  // ── Local Government ───────────────────────────────────────────────────────
  'political-briefing': 'Megaphone',
  stormwater: 'CloudRain',
  'ej-equity': 'Users',
  emergency: 'AlertTriangle',
  // ── MS4 ────────────────────────────────────────────────────────────────────
  'receiving-waters': 'Waves',
  'stormwater-bmps': 'Wrench',
  'tmdl-compliance': 'BarChart3',
  'mcm-manager': 'ClipboardList',
  // ── Utility ────────────────────────────────────────────────────────────────
  'source-receiving': 'Droplets',
  'treatment-process': 'Gauge',
  laboratory: 'Microscope',
  'permit-limits': 'FileCheck',
  'asset-management': 'Wrench',
  // ── Site Intelligence ────────────────────────────────────────────────────────
  developer: 'HardHat',
  'real-estate': 'MapPin',
  legal: 'Scale',
  consultant: 'Search',
  lender: 'Banknote',
  appraiser: 'BarChart3',
  'title-company': 'FileCheck',
  construction: 'Hammer',
  'ma-due-diligence': 'Search',
  'energy-utilities': 'Zap',
  'private-equity': 'DollarSign',
  'corporate-facilities': 'Building2',
  'municipal-econ-dev': 'Landmark',
  brownfield: 'Layers',
  mining: 'Hammer',
  // ── ESG / Sustainability ───────────────────────────────────────────────────
  'water-stewardship': 'Droplets',
  'facility-operations': 'Factory',
  'esg-reporting': 'FileCheck',
  'supply-chain-risk': 'Link2',
  'supply-chain': 'Link2',
  // ── Biotech / Pharma ──────────────────────────────────────────────────────
  'process-water': 'Droplets',
  'discharge-effluent': 'Waves',
  'gmp-quality': 'ClipboardList',
  // contaminants already mapped above
  // ── Investor ──────────────────────────────────────────────────────
  'portfolio-risk': 'BarChart3',
  'water-stress': 'Droplets',
  'esg-disclosure': 'FileCheck',
  'climate-resilience': 'CloudRain',
  'financial-impact': 'DollarSign',
  'due-diligence': 'Search',
  // ── University ─────────────────────────────────────────────────────────────
  'research-monitoring': 'Microscope',
  'campus-stormwater': 'CloudRain',
  'watershed-partnerships': 'Handshake',
  'grants-publications': 'BookOpen',
  // ── NGO ────────────────────────────────────────────────────────────────────
  'watershed-health': 'Waves',
  'restoration-projects': 'TreePine',
  advocacy: 'Scale',
  'volunteer-program': 'Heart',
  // ── K-12 ───────────────────────────────────────────────────────────────────
  'outdoor-classroom': 'TreePine',
  'student-monitoring': 'Beaker',
  'drinking-water-safety': 'GlassWater',
  debate: 'MessageSquare',
  games: 'Gamepad2',
  // ── Site Intelligence ─────────────────────────────────────────────────────
  environment: 'TreePine',
  species: 'Leaf',
  risk: 'AlertTriangle',
  forecast: 'TrendingUp',
  // ── PEARL ─────────────────────────────────────────────────────────────────
  operations: 'Settings',
  restoration: 'TreePine',
  opportunities: 'HandCoins',
  grants: 'DollarSign',
  proposals: 'FileText',
  scenarios: 'FlaskConical',
  predictions: 'Target',
  'scenario-planner': 'Calculator',
  'budget-planner': 'BarChart3',
  investigation: 'Search',
  users: 'Users',
  alerts: 'Bell',
  // ── Aqua-Lo ───────────────────────────────────────────────────────────────
  push: 'Network',
  qaqc: 'ClipboardList',
  audit: 'FileText',
  // ── Laboratory Partner ────────────────────────────────────────────────────
  'wq-overview': 'LayoutDashboard',
  'impairment-map': 'Map',
  'monitoring-gaps': 'AlertTriangle',
  'param-trends': 'TrendingUp',
  'my-clients': 'Users',
  // ── Training ─────────────────────────────────────────────────────────────
  training: 'GraduationCap',
};

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  accent: string;       // active text color
  accentBg: string;     // active background
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function buildNavGroups(stateCode: string): NavGroup[] { return [
  {
    title: 'Government',
    items: [
      { label: 'Federal', href: '/dashboard/federal', icon: Landmark, accent: 'text-blue-700', accentBg: 'bg-blue-50 border-blue-200' },
      { label: 'State', href: `/dashboard/state/${stateCode}`, icon: Map, accent: 'text-cyan-700', accentBg: 'bg-cyan-50 border-cyan-200' },
      { label: 'Local', href: '/dashboard/local/default', icon: Building2, accent: 'text-purple-700', accentBg: 'bg-purple-50 border-purple-200' },
    ],
  },
  {
    title: 'Industry',
    items: [
      { label: 'Sustainability', href: '/dashboard/esg', icon: Factory, accent: 'text-emerald-700', accentBg: 'bg-emerald-50 border-emerald-200' },
      { label: 'Biotech / Pharma', href: '/dashboard/biotech', icon: Microscope, accent: 'text-violet-700', accentBg: 'bg-violet-50 border-violet-200' },
      { label: 'Investor', href: '/dashboard/investor', icon: TrendingUp, accent: 'text-amber-700', accentBg: 'bg-amber-50 border-amber-200' },
      { label: 'Site Intelligence', href: '/dashboard/site-intelligence', icon: Search, accent: 'text-amber-700', accentBg: 'bg-amber-50 border-amber-200' },
    ],
  },
  {
    title: 'Science',
    items: [
      { label: 'AQUA-LO', href: '/dashboard/aqua-lo', icon: FlaskConical, accent: 'text-teal-700', accentBg: 'bg-teal-50 border-teal-200' },
      { label: 'University', href: '/dashboard/university', icon: GraduationCap, accent: 'text-violet-700', accentBg: 'bg-violet-50 border-violet-200' },
    ],
  },
  {
    title: 'Education',
    items: [
      { label: 'K-12', href: '/dashboard/k12', icon: BookOpen, accent: 'text-emerald-700', accentBg: 'bg-emerald-50 border-emerald-200' },
    ],
  },
  {
    title: 'Conservation',
    items: [
      { label: 'NGO', href: '/dashboard/ngo', icon: Leaf, accent: 'text-emerald-700', accentBg: 'bg-emerald-50 border-emerald-200' },
    ],
  },
  {
    title: 'PEARL',
    items: [
      { label: 'PEARL Admin', href: '/dashboard/pearl', icon: Crown, accent: 'text-purple-700', accentBg: 'bg-purple-50 border-purple-200' },
    ],
  },
]; }

export function DashboardSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLensParam = searchParams.get('lens');
  const { user } = useAuth();
  const router = useRouter();
  const [adminState, setAdminState] = useAdminState();
  /** Filter out lenses gated to states the user isn't viewing. */
  const filterGatedLenses = useCallback((lenses: LensDef[] | null) => {
    if (!lenses) return null;
    return lenses.filter((l) => {
      if (l.gateStates && !l.gateStates.has(adminState)) return false;
      if (l.gateMilitary && !user?.isMilitary && user?.role !== 'Pearl' && !user?.isSuperAdmin) return false;
      if (l.id === 'users' && user?.adminLevel === 'none' && user?.role !== 'Pearl') return false;
      if (l.id === 'alerts' && !(user?.isSuperAdmin || user?.role === 'Pearl')) return false;
      return true;
    });
  }, [adminState, user]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Swipe-to-close gesture for mobile sidebar (#11)
  const touchStartX = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -60) setMobileOpen(false); // swipe left to close
  }, []);

  // Save last-visited lens to localStorage (#49)
  useEffect(() => {
    if (pathname && pathname !== '/') {
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const lens = sp?.get('lens');
      const key = 'pin-last-visited';
      const val = lens ? `${pathname}?lens=${lens}` : pathname;
      try { localStorage.setItem(key, val); } catch {}
    }
  }, [pathname, searchParams]);

  // Navigate to a lens — uses replace for same-page, push for cross-page, wrapped in startTransition
  const navigateToLens = useCallback((itemHref: string, lensId: string) => {
    setMobileOpen(false);
    const target = `${itemHref}?lens=${lensId}`;
    const isSamePage = pathname.startsWith(itemHref.replace(/\/[^/]+$/, '')) || pathname === itemHref;
    startTransition(() => {
      if (isSamePage) {
        router.replace(target, { scroll: false });
      } else {
        router.push(target);
      }
    });
  }, [pathname, router]);

  // Build nav groups with dynamic state code for the State link
  const NAV_GROUPS = useMemo(() => buildNavGroups(adminState), [adminState]);

  // Filter nav groups to only show links the user's role can access
  const filteredGroups = useMemo(() => {
    if (!user) return NAV_GROUPS;
    return NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccessRoute(user, item.href)),
      }))
      .filter((group) => group.items.length > 0);
  }, [user, NAV_GROUPS]);

  // Single-role detection: exactly 1 accessible role across all groups
  const allAccessibleItems = useMemo(() => filteredGroups.flatMap(g => g.items), [filteredGroups]);
  const isSingleRole = allAccessibleItems.length === 1;
  const singleRoleItem = isSingleRole ? allAccessibleItems[0] : null;
  const singleRoleLenses = singleRoleItem ? filterGatedLenses(getLensesForHref(singleRoleItem.href)) : null;

  const isActive = useCallback((href: string) => {
    if (href === '/dashboard/federal') return pathname === '/dashboard/federal';
    // Strip dynamic segments (/MD, /VA, /default, etc.) to get the base prefix
    const base = href.replace(/\/[^/]+$/, '');
    return pathname.startsWith(base);
  }, [pathname]);

  // Auto-expand the currently active role on mount and route change
  useEffect(() => {
    for (const group of filteredGroups) {
      for (const item of group.items) {
        if (isActive(item.href) && getLensesForHref(item.href)) {
          setExpandedRoles((prev) => {
            if (prev.has(item.href)) return prev;
            const next = new Set(prev);
            next.add(item.href);
            return next;
          });
        }
      }
    }
  }, [pathname, filteredGroups, isActive]);

  const toggleExpanded = (href: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const isLensActive = (itemHref: string, lensId: string) => {
    return isActive(itemHref) && currentLensParam === lensId;
  };

  // Render a single nav item — either flat link or expandable tree node
  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    const lenses = filterGatedLenses(getLensesForHref(item.href));

    // No lenses → flat link (unchanged)
    if (!lenses || lenses.length === 0) {
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          title={collapsed ? item.label : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
            active
              ? `${item.accentBg} ${item.accent} font-semibold border shadow-sm`
              : 'text-pin-text-secondary hover:bg-pin-primary-light hover:text-pin-text-bright'
          }`}
        >
          <Icon className={`w-4 h-4 flex-shrink-0 ${active ? item.accent : 'text-pin-text-dim'}`} />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>
      );
    }

    const isExpanded = expandedRoles.has(item.href);

    // Collapsed mode → icon with flyout popover on hover
    if (collapsed) {
      return (
        <div key={item.href} className="relative group">
          <Link
            href={item.href}
            title={item.label}
            className={`flex items-center justify-center px-3 py-2 rounded-lg text-sm transition-all ${
              active
                ? `${item.accentBg} ${item.accent} font-semibold border shadow-sm`
                : 'text-pin-text-secondary hover:bg-pin-primary-light hover:text-pin-text-bright'
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${active ? item.accent : 'text-pin-text-dim'}`} />
          </Link>
          {/* Flyout popover on hover */}
          <div className="hidden group-hover:block absolute left-full top-0 ml-2 z-50 min-w-[160px] bg-white dark:bg-[#0D1526] border border-pin-border-default rounded-lg shadow-lg py-1.5">
            <div className="px-3 py-1.5 text-pin-xs font-semibold text-pin-text-primary border-b border-pin-border-default">
              {item.label}
            </div>
            {lenses.map((lens) => (
              <button
                key={lens.id}
                onClick={() => navigateToLens(item.href, lens.id)}
                className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  isLensActive(item.href, lens.id)
                    ? `${item.accent} font-semibold bg-pin-primary-light`
                    : 'text-pin-text-secondary hover:bg-pin-primary-light hover:text-pin-text-bright'
                }`}
              >
                {lens.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Expanded mode → tree node with chevron + sub-items
    return (
      <div key={item.href}>
        {/* Parent row */}
        <div className={`flex items-center rounded-lg text-sm transition-all ${
          active
            ? `${item.accentBg} ${item.accent} font-semibold border shadow-sm`
            : 'text-pin-text-secondary hover:bg-pin-primary-light hover:text-pin-text-bright'
        }`}>
          <Link
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2 flex-1 min-w-0"
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${active ? item.accent : 'text-pin-text-dim'}`} />
            <span className="truncate">{item.label}</span>
          </Link>
          <button
            onClick={() => toggleExpanded(item.href)}
            className="px-2 py-2 flex-shrink-0 hover:bg-black/5 rounded-r-lg transition-colors"
            aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
          </button>
        </div>
        {/* Sub-items */}
        {isExpanded && (
          <div
            className="ml-4 pl-3 border-l border-pin-border-default mt-0.5 space-y-0.5"
            role="group"
            aria-label={`${item.label} lenses`}
            onKeyDown={(e) => {
              const btns = e.currentTarget.querySelectorAll<HTMLButtonElement>('button');
              const idx = Array.from(btns).indexOf(e.target as HTMLButtonElement);
              if (idx < 0) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); btns[Math.min(idx + 1, btns.length - 1)]?.focus(); }
              if (e.key === 'ArrowUp') { e.preventDefault(); btns[Math.max(idx - 1, 0)]?.focus(); }
              if (e.key === 'Escape') { e.preventDefault(); toggleExpanded(item.href); }
            }}
          >
            {lenses.map((lens) => {
              const lensActive = isLensActive(item.href, lens.id);
              return (
                <button
                  key={lens.id}
                  onClick={() => navigateToLens(item.href, lens.id)}
                  aria-current={lensActive ? 'page' : undefined}
                  className={`block w-full text-left px-3 py-1.5 rounded-md text-xs transition-all min-h-[44px] flex items-center ${
                    lensActive
                      ? `${item.accent} font-semibold bg-pin-primary-light`
                      : 'text-pin-text-secondary hover:bg-pin-primary-light hover:text-pin-text-primary'
                  }`}
                >
                  {lens.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const sidebar = (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className={`flex flex-col h-full bg-white dark:bg-[#0D1526] border-r border-pin-border-default transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}
    >
      {/* Logo */}
      <div className="p-4 flex items-center justify-center border-b border-pin-border-default">
        {collapsed ? (
          <Image src="/Pearl-Logo-alt.png" alt="PIN" width={32} height={32} className="rounded-lg flex-shrink-0" />
        ) : (
          <Image src="/Pearl-Intelligence-Network.png" alt="PIN" width={180} height={40} className="object-contain" />
        )}
      </div>

      {/* Home link */}
      <div className="px-2 pt-3">
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-pin-sm font-medium transition-colors hover:bg-pin-primary-light ${
            pathname === '/' ? 'bg-pin-primary-light text-pin-text-bright font-semibold' : 'text-pin-text-secondary'
          }`}
        >
          <Home className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Home</span>}
        </Link>
      </div>

      {/* Pending navigation indicator */}
      {isPending && (
        <div className="mx-3 mb-1">
          <div className="h-0.5 bg-pin-border-default rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Nav groups */}
      <nav aria-label="Dashboard navigation" className={`flex-1 overflow-y-auto px-2 py-3 space-y-4 ${isPending ? 'opacity-70 pointer-events-none' : ''}`}>
        {isSingleRole && singleRoleItem && singleRoleLenses ? (
          /* ── Single-role mode: lenses as top-level nav items ── */
          <div className="space-y-0.5">
            {singleRoleLenses.map((lens) => {
              const iconName = LENS_ICON_NAMES[lens.id] || 'LayoutDashboard';
              const lensActive = isLensActive(singleRoleItem.href, lens.id)
                || (lens.id === 'overview' && isActive(singleRoleItem.href) && !currentLensParam);
              return (
                <button
                  key={lens.id}
                  onClick={() => navigateToLens(singleRoleItem.href, lens.id)}
                  title={collapsed ? lens.label : undefined}
                  aria-current={lensActive ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all w-full text-left min-h-[44px] ${
                    lensActive
                      ? `${singleRoleItem.accentBg} ${singleRoleItem.accent} font-semibold border shadow-sm`
                      : 'text-pin-text-secondary hover:bg-pin-primary-light hover:text-pin-text-bright'
                  }`}
                >
                  <LazyIcon
                    name={iconName}
                    role="federal"
                    className={`w-4 h-4 flex-shrink-0 ${lensActive ? singleRoleItem.accent : 'text-pin-text-dim'}`}
                  />
                  {!collapsed && <span className="truncate">{lens.label}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          /* ── Admin / multi-role mode: grouped roles with expandable lenses ── */
          filteredGroups.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <div className="px-3 mb-1.5 text-pin-xs font-semibold uppercase tracking-[0.06em] text-pin-text-dim">
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => renderNavItem(item))}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* Admin section — Pearl / admin users only */}
      {user && (user.role === 'Pearl' || user.isAdmin) && (
        <div className="border-t border-pin-border-default px-2 py-3 space-y-0.5">
          {!collapsed ? (
            <div className="px-3 mb-1.5 space-y-1">
              <div className="text-pin-xs font-semibold uppercase tracking-[0.06em] text-pin-text-dim">Admin</div>
              <label htmlFor="admin-state-selector" className="text-pin-xs font-medium text-pin-text-secondary">Viewing as</label>
              <select
                id="admin-state-selector"
                value={adminState}
                onChange={(e) => {
                  const next = e.target.value;
                  setAdminState(next);
                  if (pathname.startsWith('/dashboard/state/')) {
                    router.push(`/dashboard/state/${next}`);
                  }
                }}
                aria-label="Select state to view as administrator"
                className="w-full text-pin-xs px-2 py-1.5 rounded-pin-md border border-pin-border-default bg-white dark:bg-[#0D1526] text-pin-text-primary focus:outline-none focus:ring-1 focus:ring-pin-primary"
              >
                {Object.entries(STATE_ABBR_TO_NAME).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                  <option key={abbr} value={abbr}>{abbr} — {name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-0.5 px-1 mb-1" title={`${STATE_ABBR_TO_NAME[adminState] || adminState} (${adminState})`}>
              <MapPin className="w-4 h-4 text-purple-500" />
              <span className="text-2xs font-bold text-purple-600">{adminState}</span>
            </div>
          )}
          <Link
            href="/dashboard/breakpoint"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? 'Breakpoint' : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              pathname === '/dashboard/breakpoint'
                ? 'bg-orange-50 border-orange-200 text-orange-700 font-semibold border shadow-sm'
                : 'text-pin-text-secondary hover:bg-pin-primary-light hover:text-pin-text-bright'
            }`}
          >
            <Zap className={`w-4 h-4 flex-shrink-0 ${pathname === '/dashboard/breakpoint' ? 'text-orange-700' : 'text-pin-text-dim'}`} />
            {!collapsed && <span className="truncate">Breakpoint</span>}
          </Link>
          <Link
            href="/dashboard/outreach"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? 'Outreach' : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              pathname.startsWith('/dashboard/outreach')
                ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold border shadow-sm dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300'
                : 'text-pin-text-secondary hover:bg-pin-primary-light hover:text-pin-text-bright'
            }`}
          >
            <Mail className={`w-4 h-4 flex-shrink-0 ${pathname.startsWith('/dashboard/outreach') ? 'text-blue-700 dark:text-blue-300' : 'text-pin-text-dim'}`} />
            {!collapsed && <span className="truncate">Outreach</span>}
          </Link>
        </div>
      )}

      {/* Bottom section */}
      <div className="border-t border-pin-border-default p-3 space-y-2">
        <Link
          href="/dashboard/data-provenance"
          onClick={() => setMobileOpen(false)}
          title={collapsed ? 'Data Provenance' : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === '/dashboard/data-provenance'
              ? 'bg-cyan-50 border-cyan-200 text-cyan-700 font-semibold border shadow-sm'
              : 'text-pin-text-secondary hover:bg-pin-primary-light hover:text-pin-text-primary'
          }`}
        >
          <FileCheck className={`w-4 h-4 flex-shrink-0 ${pathname === '/dashboard/data-provenance' ? 'text-cyan-700' : ''}`} />
          {!collapsed && <span>Data Provenance</span>}
        </Link>
        <Link
          href="/account"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-pin-sm font-medium text-pin-text-secondary hover:bg-pin-primary-light hover:text-pin-text-primary transition-colors"
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        {!collapsed && user && !isSingleRole && (
          <div className="px-3 py-2">
            <span className="text-2xs font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {user.role}
            </span>
          </div>
        )}
        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden lg:flex items-center justify-center w-full py-1.5 rounded-lg text-pin-text-dim hover:bg-pin-primary-light hover:text-pin-text-secondary transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-white dark:bg-[#0D1526] shadow-md border border-pin-border-default min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <Menu className="w-5 h-5 text-pin-text-primary" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div
            className="relative z-10 h-full shadow-2xl"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-pin-primary-light text-pin-text-secondary hover:bg-pin-border-default min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block h-full flex-shrink-0">
        {sidebar}
      </div>
    </>
  );
}
