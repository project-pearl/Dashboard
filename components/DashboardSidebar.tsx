'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { canAccessRoute } from '@/lib/roleRoutes';
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
  Home,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
      { label: 'MS4', href: '/dashboard/ms4/default', icon: CloudRain, accent: 'text-amber-700', accentBg: 'bg-amber-50 border-amber-200' },
    ],
  },
  {
    title: 'Utility',
    items: [
      { label: 'Municipal Utility', href: '/dashboard/utility/default', icon: Droplets, accent: 'text-sky-700', accentBg: 'bg-sky-50 border-sky-200' },
      { label: 'Infrastructure', href: '/dashboard/infrastructure', icon: Building2, accent: 'text-slate-700', accentBg: 'bg-slate-100 border-slate-300' },
    ],
  },
  {
    title: 'Industry',
    items: [
      { label: 'Corporate ESG', href: '/dashboard/esg', icon: Factory, accent: 'text-emerald-700', accentBg: 'bg-emerald-50 border-emerald-200' },
      { label: 'Insurance', href: '/dashboard/insurance', icon: Shield, accent: 'text-indigo-700', accentBg: 'bg-indigo-50 border-indigo-200' },
      { label: 'Agriculture', href: '/dashboard/agriculture', icon: Sprout, accent: 'text-lime-700', accentBg: 'bg-lime-50 border-lime-200' },
    ],
  },
  {
    title: 'Science',
    items: [
      { label: 'SampleChain', href: '/dashboard/samplechain', icon: FlaskConical, accent: 'text-teal-700', accentBg: 'bg-teal-50 border-teal-200' },
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
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const isActive = (href: string) => {
    if (href === '/dashboard/federal') return pathname === '/dashboard/federal';
    return pathname.startsWith(href.replace('/default', '').replace('/MD', ''));
  };

  const sidebar = (
    <div className={`flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-slate-200">
        <Image src="/Pearl-Logo-alt.png" alt="PEARL" width={32} height={32} className="rounded-lg flex-shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">PEARL</div>
            <div className="text-[10px] text-slate-400 truncate">Intelligence Network</div>
          </div>
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
        {filteredGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
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
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-slate-200 p-3 space-y-2">
        <Link
          href="/account"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        {!collapsed && user && (
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
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-white shadow-md border border-slate-200"
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
