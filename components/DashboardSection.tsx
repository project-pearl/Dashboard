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

  const accentBorder = `border-l-${accent}-500`;

  return (
    <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm ${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && <span className={`text-${accent}-600`}>{icon}</span>}
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
            className={`text-xs text-${accent}-600 hover:text-${accent}-700 font-medium transition-colors`}
          >
            View Details &rarr;
          </a>
        )}
      </button>
      {expanded && <div className="px-5 pb-5 border-t border-slate-100">{children}</div>}
    </div>
  );
}
