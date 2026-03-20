'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';

interface StakeholderWatchCardProps {
  jurisdiction: string;
  stateName: string;
  entityType: 'state' | 'local' | 'federal';
}

export default function StakeholderWatchCard({ jurisdiction, stateName }: StakeholderWatchCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Stakeholder Watch — {stateName}
        </CardTitle>
        <CardDescription>Water quality advocacy and policy tracking</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Active Issues', value: 3, icon: AlertTriangle, color: 'text-red-600' },
            { label: 'Organizations', value: 8, icon: Users, color: 'text-blue-600' },
            { label: 'High Impact', value: 2, icon: TrendingUp, color: 'text-amber-600' },
            { label: 'This Month', value: 5, icon: Calendar, color: 'text-green-600' }
          ].map(stat => (
            <div key={stat.label} className="bg-slate-50 rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-2xs font-semibold text-slate-500 uppercase">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="text-center py-8 text-slate-500">
          <p className="text-sm">Stakeholder activity monitoring</p>
        </div>
      </CardContent>
    </Card>
  );
}
