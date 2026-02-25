'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import UserMenu from '@/components/UserMenu';
import { Bell, Radio } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  ms4: 'MS4',
  esg: 'Sustainability',
  k12: 'K-12 Education',
  university: 'University Research',
  ngo: 'NGO Conservation',
  utility: 'Municipal Utility',
  infrastructure: 'Infrastructure',
  insurance: 'Insurance & Risk',
  agriculture: 'Agriculture',
  'aqua-lo': 'AQUA-LO',
  'lab-partner': 'Laboratory Partner',
};

const ROUTE_ACCENTS: Record<string, string> = {
  federal: 'text-blue-600',
  state: 'text-cyan-600',
  ms4: 'text-amber-600',
  esg: 'text-emerald-600',
  k12: 'text-emerald-600',
  university: 'text-violet-600',
  ngo: 'text-emerald-600',
  utility: 'text-sky-600',
  infrastructure: 'text-slate-600',
  insurance: 'text-indigo-600',
  agriculture: 'text-lime-600',
  'aqua-lo': 'text-teal-600',
  'lab-partner': 'text-cyan-600',
};

export function DashboardHeader() {
  const pathname = usePathname();

  // Build breadcrumb from path
  const segments = pathname.split('/').filter(Boolean);
  const routeKey = segments[1] || '';
  const routeLabel = ROUTE_LABELS[routeKey] || routeKey;
  const accentColor = ROUTE_ACCENTS[routeKey] || 'text-blue-600';
  const subParam = segments[2]; // e.g. stateCode or permitId

  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm dark:bg-[rgba(14,22,45,0.9)] dark:backdrop-blur-xl dark:border-[rgba(58,189,176,0.12)]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm ml-12 lg:ml-0">
        <span className="text-slate-400 font-medium">Dashboard</span>
        {routeLabel && (
          <>
            <span className="text-slate-300">/</span>
            <span className={`${accentColor} font-semibold`}>{routeLabel}</span>
          </>
        )}
        {subParam && (
          <>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 font-medium">{subParam.toUpperCase()}</span>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Live status */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
          <Radio className="w-3 h-3 animate-pulse" />
          <span className="font-semibold">Live Data</span>
        </div>

        {/* Notification bell */}
        <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600">
          <Bell className="w-4 h-4" />
        </button>

        {/* User menu */}
        <UserMenu />
      </div>
    </header>
  );
}
