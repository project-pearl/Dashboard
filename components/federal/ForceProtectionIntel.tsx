'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, AlertTriangle, CheckCircle, Clock, Target } from 'lucide-react';

interface ForceProtectionIntelProps {
  className?: string;
}

export default function ForceProtectionIntel({ className }: ForceProtectionIntelProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          Force Protection Intelligence
        </CardTitle>
        <CardDescription>Security threat assessment for water infrastructure</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Threat Level', value: 'ELEVATED', icon: AlertTriangle, color: 'text-amber-600' },
            { label: 'Assets Secured', value: '94%', icon: CheckCircle, color: 'text-green-600' },
            { label: 'Active Monitoring', value: '24/7', icon: Clock, color: 'text-blue-600' },
            { label: 'Risk Score', value: '72/100', icon: Target, color: 'text-orange-600' }
          ].map(stat => (
            <div key={stat.label} className="bg-slate-50 rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-2xs font-semibold text-slate-500 uppercase">{stat.label}</span>
              </div>
              <div className="text-lg font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="text-center py-8 text-slate-500">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Force protection monitoring active</p>
        </div>
      </CardContent>
    </Card>
  );
}
