'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface KPICard {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  delta?: number;       // percentage change
  status?: 'good' | 'warning' | 'critical';
}

interface KPIStripProps {
  cards: KPICard[];
  className?: string;
}

const statusStyles: Record<string, { border: string; iconBg: string; iconColor: string }> = {
  good: { border: 'border-l-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  warning: { border: 'border-l-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
  critical: { border: 'border-l-red-500', iconBg: 'bg-red-50', iconColor: 'text-red-600' },
};

const defaultStyle = { border: 'border-l-blue-500', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' };

export function KPIStrip({ cards, className = '' }: KPIStripProps) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 ${className}`}>
      {cards.map((card) => {
        const Icon = card.icon;
        const style = card.status ? statusStyles[card.status] : defaultStyle;
        return (
          <div
            key={card.label}
            className={`bg-white border border-slate-200 border-l-4 ${style.border} rounded-xl p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-8 h-8 rounded-lg ${style.iconBg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${style.iconColor}`} />
              </div>
              {card.delta !== undefined && (
                <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  card.delta > 0 ? 'text-emerald-700 bg-emerald-50' : card.delta < 0 ? 'text-red-700 bg-red-50' : 'text-slate-500 bg-slate-100'
                }`}>
                  {card.delta > 0 ? <TrendingUp className="w-3 h-3" /> :
                   card.delta < 0 ? <TrendingDown className="w-3 h-3" /> :
                   <Minus className="w-3 h-3" />}
                  {Math.abs(card.delta)}%
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-slate-900 leading-none tracking-tight">
              {card.value}
              {card.unit && <span className="text-xs font-normal text-slate-400 ml-1">{card.unit}</span>}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {card.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
