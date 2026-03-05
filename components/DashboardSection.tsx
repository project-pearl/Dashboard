'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  detailsHref?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  accent?: string; // e.g. 'blue', 'emerald', 'amber'
}

export function DashboardSection({
  title,
  subtitle,
  defaultExpanded = true,
  detailsHref,
  children,
  className = '',
  icon,
  accent = 'blue',
}: DashboardSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const accentStyles: Record<string, { icon: string; link: string; header: string }> = {
    blue: { icon: 'text-blue-600', link: 'text-blue-600 hover:text-blue-700', header: 'bg-gradient-to-r from-blue-50 to-sky-50' },
    emerald: { icon: 'text-emerald-600', link: 'text-emerald-600 hover:text-emerald-700', header: 'bg-gradient-to-r from-emerald-50 to-teal-50' },
    amber: { icon: 'text-amber-600', link: 'text-amber-700 hover:text-amber-800', header: 'bg-gradient-to-r from-amber-50 to-orange-50' },
    purple: { icon: 'text-purple-600', link: 'text-purple-600 hover:text-purple-700', header: 'bg-gradient-to-r from-purple-50 to-fuchsia-50' },
    red: { icon: 'text-red-600', link: 'text-red-600 hover:text-red-700', header: 'bg-gradient-to-r from-red-50 to-rose-50' },
    slate: { icon: 'text-slate-600', link: 'text-slate-600 hover:text-slate-700', header: 'bg-gradient-to-r from-slate-50 to-gray-50' },
  };
  const colors = accentStyles[accent] ?? accentStyles.blue;

  return (
    <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm ${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${colors.header} hover:brightness-[0.99]`}
      >
        <div className="flex items-center gap-3">
          {icon && <span className={colors.icon}>{icon}</span>}
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {detailsHref && (
          <a
            href={detailsHref}
            onClick={(e) => e.stopPropagation()}
            className={`text-xs font-medium transition-colors ${colors.link}`}
          >
            View Details &rarr;
          </a>
        )}
      </button>
      {expanded && <div className="px-5 pb-5 border-t border-slate-100">{children}</div>}
    </div>
  );
}
