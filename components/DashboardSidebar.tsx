'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { canAccessRoute } from '@/lib/roleRoutes';
import { getLensesForHref, type LensDef } from '@/lib/lensRegistry';
import { useAdminState, STATE_ABBR_TO_NAME } from '@/lib/adminStateContext';
import {
  Building2,
  Map,
  CloudRain,
  Droplets,
  Factory,
  Shield,
  Sprout,
  FlaskConical,
  GraduationCap,
  BookOpen,
  Leaf,
  Landmark,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Home,
  Settings,
  Menu,
  X,
  LayoutDashboard,
  Sparkles,
  ShieldCheck,
  Waves,
  Activity,
  FileText,
  Trophy,
  TrendingUp,
  Scale,
  Biohazard,
  Network,
  Banknote,
  Crown,
  Zap,
  ClipboardList,
  // Additional icons for expanded lens registries
  RadioTower,
  Wrench,
  FileCheck,
  AlertTriangle,
  Bell,
  Gauge,
  HardHat,
  DollarSign,
  Download,
  Users,
  Heart,
  Search,
  Beaker,
  MapPin,
  BarChart3,
  Hammer,
  Clock,
  Link2,
  Layers,
  TreePine,
  Microscope,
  Handshake,
  GlassWater,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Icons for lens items when rendered as top-level nav (single-role mode)
const LENS_ICONS: Record<string, LucideIcon> = {
  // ── Shared / Federal ───────────────────────────────────────────────────────
  overview: LayoutDashboard,
  briefing: Sparkles,
  compliance: ShieldCheck,
  'water-quality': Waves,
  infrastructure: Building2,
  monitoring: Activity,
  trends: TrendingUp,
  policy: Scale,
  contaminants: Biohazard,
  'public-health': Biohazard,
  'habitat-ecology': TreePine,
  'agricultural-nps': Sprout,
  'disaster-emergency': AlertTriangle,
  'military-installations': Shield,
  scorecard: Trophy,
  reports: FileText,
  interagency: Network,
  funding: Banknote,
  planner: ClipboardList,
  full: LayoutDashboard,
  // ── State ──────────────────────────────────────────────────────────────────
  coverage: Activity,
  programs: Landmark,
  ms4oversight: CloudRain,
  habitat: TreePine,
  agriculture: Sprout,
  disaster: AlertTriangle,
  tmdl: Waves,
  permits: FileCheck,
  // ── MS4 ────────────────────────────────────────────────────────────────────
  'receiving-waters': Waves,
  'stormwater-bmps': Wrench,
  'tmdl-compliance': BarChart3,
  'mcm-manager': ClipboardList,
  // ── Utility ────────────────────────────────────────────────────────────────
  'source-receiving': Droplets,
  'treatment-process': Gauge,
  laboratory: Microscope,
  'permit-limits': FileCheck,
  'asset-management': Wrench,
  // ── Infrastructure ─────────────────────────────────────────────────────────
  'asset-condition': Wrench,
  'failure-risk': AlertTriangle,
  capacity: BarChart3,
  'discharge-permits': FileCheck,
  'capital-projects': HardHat,
  'regulatory-timeline': Clock,
  // ── ESG / Sustainability ───────────────────────────────────────────────────
  'water-stewardship': Droplets,
  'facility-operations': Factory,
  'esg-reporting': FileCheck,
  'supply-chain-risk': Link2,
  // ── University ─────────────────────────────────────────────────────────────
  'research-monitoring': Microscope,
  'campus-stormwater': CloudRain,
  'watershed-partnerships': Handshake,
  'grants-publications': BookOpen,
  // ── NGO ────────────────────────────────────────────────────────────────────
  'watershed-health': Waves,
  'restoration-projects': TreePine,
  advocacy: Scale,
  'volunteer-program': Heart,
  // ── K-12 ───────────────────────────────────────────────────────────────────
  'outdoor-classroom': TreePine,
  'student-monitoring': Beaker,
  'drinking-water-safety': GlassWater,
  // ── Insurance ──────────────────────────────────────────────────────────────
  'exposure-mapping': Map,
  claims: DollarSign,
  'flood-contamination': Layers,
  'portfolio-risk': Shield,
  'regulatory-changes': Scale,
  // ── Agriculture ────────────────────────────────────────────────────────────
  'nutrient-loading': FlaskConical,
  runoff: CloudRain,
  bmp: Wrench,
  'watershed-impact': Waves,
  'soil-groundwater': Sprout,
  'conservation-funding': Banknote,
  // ── Laboratory Partner ────────────────────────────────────────────────────
  'wq-overview': LayoutDashboard,
  'impairment-map': Map,
  'monitoring-gaps': AlertTriangle,
  'param-trends': TrendingUp,
  'my-clients': Users,
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

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Government',
    items: [
      { label: 'Federal', href: '/dashboard/federal', icon: Landmark, accent: 'text-blue-700', accentBg: 'bg-blue-50 border-blue-200' },
      { label: 'State', href: '/dashboard/state/MD', icon: Map, accent: 'text-cyan-700', accentBg: 'bg-cyan-50 border-cyan-200' },
      { label: 'Municipal Utility', href: '/dashboard/ms4/default', icon: CloudRain, accent: 'text-amber-700', accentBg: 'bg-amber-50 border-amber-200' },
      { label: 'Municipal Utility', href: '/dashboard/utility/default', icon: Droplets, accent: 'text-sky-700', accentBg: 'bg-sky-50 border-sky-200' },
      { label: 'Infrastructure', href: '/dashboard/infrastructure', icon: Building2, accent: 'text-slate-700', accentBg: 'bg-slate-100 border-slate-300' },
    ],
  },
  {
    title: 'Industry',
    items: [
      { label: 'Sustainability', href: '/dashboard/esg', icon: Factory, accent: 'text-emerald-700', accentBg: 'bg-emerald-50 border-emerald-200' },
      { label: 'Insurance', href: '/dashboard/insurance', icon: Shield, accent: 'text-indigo-700', accentBg: 'bg-indigo-50 border-indigo-200' },
      { label: 'Agriculture', href: '/dashboard/agriculture', icon: Sprout, accent: 'text-lime-700', accentBg: 'bg-lime-50 border-lime-200' },
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
    title: 'Tools',
    items: [
      { label: 'Water Tools', href: '/tools/water-quality-lookup', icon: Search, accent: 'text-sky-700', accentBg: 'bg-sky-50 border-sky-200' },
      { label: 'Data Provenance', href: '/tools/data-provenance', icon: FileCheck, accent: 'text-cyan-700', accentBg: 'bg-cyan-50 border-cyan-200' },
      { label: 'Data Export Hub', href: '/tools/data-export', icon: Download, accent: 'text-blue-700', accentBg: 'bg-blue-50 border-blue-200' },
      { label: 'Report Builder', href: '/tools/reports', icon: FileText, accent: 'text-slate-700', accentBg: 'bg-slate-100 border-slate-300' },
      { label: 'Templates', href: '/tools/templates', icon: ClipboardList, accent: 'text-amber-700', accentBg: 'bg-amber-50 border-amber-200' },
      { label: 'API Docs', href: '/tools/api', icon: BookOpen, accent: 'text-indigo-700', accentBg: 'bg-indigo-50 border-indigo-200' },
      { label: 'Methodology', href: '/tools/methodology', icon: Beaker, accent: 'text-teal-700', accentBg: 'bg-teal-50 border-teal-200' },
    ],
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLensParam = searchParams.get('lens');
  const { user } = useAuth();
  const router = useRouter();
  const [adminState, setAdminState] = useAdminState();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  // Filter nav groups to only show links the user's role can access
  const filteredGroups = useMemo(() => {
    if (!user) return NAV_GROUPS;
    return NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccessRoute(user, item.href)),
      }))
      .filter((group) => group.items.length > 0);
  }, [user]);

  // Single-role detection: exactly 1 accessible role across all groups
  const allAccessibleItems = useMemo(() => filteredGroups.flatMap(g => g.items), [filteredGroups]);
  const isSingleRole = allAccessibleItems.length === 1;
  const singleRoleItem = isSingleRole ? allAccessibleItems[0] : null;
  const singleRoleLenses = singleRoleItem ? getLensesForHref(singleRoleItem.href) : null;

  const isActive = useCallback((href: string) => {
    if (href === '/dashboard/federal') return pathname === '/dashboard/federal';
    return pathname.startsWith(href.replace('/default', '').replace('/MD', ''));
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
    const lenses = getLensesForHref(item.href);

    // No lenses → flat link (unchanged)
    if (!lenses) {
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          title={collapsed ? item.label : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
            active
              ? `${item.accentBg} ${item.accent} font-semibold border shadow-sm`
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Icon className={`w-4 h-4 flex-shrink-0 ${active ? item.accent : 'text-slate-400'}`} />
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
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${active ? item.accent : 'text-slate-400'}`} />
          </Link>
          {/* Flyout popover on hover */}
          <div className="hidden group-hover:block absolute left-full top-0 ml-2 z-50 min-w-[160px] bg-white dark:bg-[#0D1526] border border-slate-200 dark:border-[rgba(58,189,176,0.12)] rounded-lg shadow-lg py-1.5">
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-700 border-b border-slate-100">
              {item.label}
            </div>
            {lenses.map((lens) => (
              <Link
                key={lens.id}
                href={`${item.href}?lens=${lens.id}`}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-1.5 text-xs transition-colors ${
                  isLensActive(item.href, lens.id)
                    ? `${item.accent} font-semibold bg-slate-50`
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {lens.label}
              </Link>
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
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}>
          <Link
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2 flex-1 min-w-0"
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${active ? item.accent : 'text-slate-400'}`} />
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
          <div className="ml-4 pl-3 border-l border-slate-200 mt-0.5 space-y-0.5">
            {lenses.map((lens) => {
              const lensActive = isLensActive(item.href, lens.id);
              return (
                <Link
                  key={lens.id}
                  href={`${item.href}?lens=${lens.id}`}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-1.5 rounded-md text-xs transition-all ${
                    lensActive
                      ? `${item.accent} font-semibold bg-slate-50`
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {lens.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const sidebar = (
    <div className={`flex flex-col h-full bg-white dark:bg-[#0D1526] border-r border-slate-200 dark:border-[rgba(58,189,176,0.12)] transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className="p-4 flex items-center justify-center border-b border-slate-200 dark:border-[rgba(58,189,176,0.12)]">
        {collapsed ? (
          <Image src="/Pearl-Logo-alt.png" alt="PIN" width={32} height={32} className="rounded-lg flex-shrink-0" />
        ) : (
          <Image src="/Logo_Pearl_as_Headline.JPG" alt="PIN" width={180} height={40} className="object-contain" />
        )}
      </div>

      {/* Home link */}
      <div className="px-2 pt-3">
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-slate-100 ${
            pathname === '/' ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-500'
          }`}
        >
          <Home className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Home</span>}
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {isSingleRole && singleRoleItem && singleRoleLenses ? (
          /* ── Single-role mode: lenses as top-level nav items ── */
          <div className="space-y-0.5">
            {singleRoleLenses.map((lens) => {
              const LensIcon = LENS_ICONS[lens.id] || LayoutDashboard;
              const lensActive = isLensActive(singleRoleItem.href, lens.id)
                || (lens.id === 'overview' && isActive(singleRoleItem.href) && !currentLensParam);
              return (
                <Link
                  key={lens.id}
                  href={`${singleRoleItem.href}?lens=${lens.id}`}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? lens.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    lensActive
                      ? `${singleRoleItem.accentBg} ${singleRoleItem.accent} font-semibold border shadow-sm`
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <LensIcon className={`w-4 h-4 flex-shrink-0 ${lensActive ? singleRoleItem.accent : 'text-slate-400'}`} />
                  {!collapsed && <span className="truncate">{lens.label}</span>}
                </Link>
              );
            })}
          </div>
        ) : (
          /* ── Admin / multi-role mode: grouped roles with expandable lenses ── */
          filteredGroups.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
        <div className="border-t border-slate-200 dark:border-[rgba(58,189,176,0.12)] px-2 py-3 space-y-0.5">
          {!collapsed ? (
            <div className="px-3 mb-1.5 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admin</div>
              <div className="text-[10px] font-medium text-slate-500">Viewing as</div>
              <select
                value={adminState}
                onChange={(e) => {
                  const next = e.target.value;
                  setAdminState(next);
                  if (pathname.startsWith('/dashboard/state/')) {
                    router.push(`/dashboard/state/${next}`);
                  }
                }}
                className="w-full text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-[rgba(58,189,176,0.15)] bg-white dark:bg-[#0D1526] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
              >
                {Object.entries(STATE_ABBR_TO_NAME).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                  <option key={abbr} value={abbr}>{abbr} — {name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-0.5 px-1 mb-1" title={`${STATE_ABBR_TO_NAME[adminState] || adminState} (${adminState})`}>
              <MapPin className="w-4 h-4 text-purple-500" />
              <span className="text-[9px] font-bold text-purple-600">{adminState}</span>
            </div>
          )}
          <Link
            href="/dashboard/admin"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? 'Pearl Admin Center' : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              pathname === '/dashboard/admin'
                ? 'bg-purple-50 border-purple-200 text-purple-700 font-semibold border shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Crown className={`w-4 h-4 flex-shrink-0 ${pathname === '/dashboard/admin' ? 'text-purple-700' : 'text-slate-400'}`} />
            {!collapsed && <span className="truncate">Pearl Admin Center</span>}
          </Link>
          <Link
            href="/dashboard/breakpoint"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? 'Breakpoint' : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              pathname === '/dashboard/breakpoint'
                ? 'bg-orange-50 border-orange-200 text-orange-700 font-semibold border shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Zap className={`w-4 h-4 flex-shrink-0 ${pathname === '/dashboard/breakpoint' ? 'text-orange-700' : 'text-slate-400'}`} />
            {!collapsed && <span className="truncate">Breakpoint</span>}
          </Link>
        </div>
      )}

      {/* Bottom section */}
      <div className="border-t border-slate-200 dark:border-[rgba(58,189,176,0.12)] p-3 space-y-2">
        <Link
          href="/account"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        {!collapsed && user && !isSingleRole && (
          <div className="px-3 py-2">
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {user.role}
            </span>
          </div>
        )}
        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center w-full py-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-white dark:bg-[#0D1526] shadow-md border border-slate-200 dark:border-[rgba(58,189,176,0.12)]"
      >
        <Menu className="w-5 h-5 text-slate-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 z-20 p-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
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
