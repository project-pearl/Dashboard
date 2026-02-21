'use client';

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

type Status = 'good' | 'warning' | 'critical';

interface StatusCardProps {
  title: string;
  description: string;
  status: Status;
  className?: string;
}

const config: Record<Status, { icon: typeof CheckCircle; color: string; bg: string; border: string; iconBg: string }> = {
  good: { icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100' },
  warning: { icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100' },
  critical: { icon: XCircle, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', iconBg: 'bg-red-100' },
};

export function StatusCard({ title, description, status, className = '' }: StatusCardProps) {
  const { icon: Icon, color, bg, border, iconBg } = config[status];
  return (
    <div className={`${bg} border ${border} rounded-xl p-4 flex items-start gap-3 ${className}`}>
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <h4 className={`text-sm font-semibold ${color}`}>{title}</h4>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
