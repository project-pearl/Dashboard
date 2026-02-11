'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { WaterQualityData } from '@/lib/types';

interface RemovalSummaryCardProps {
  influentData: WaterQualityData;
  effluentData: WaterQualityData;
  removalEfficiencies: Record<string, number>;
}

export function RemovalSummaryCard({ influentData, effluentData, removalEfficiencies }: RemovalSummaryCardProps) {
  const parameters = [
    { key: 'DO', name: 'Dissolved Oxygen', type: 'increasing-good' },
    { key: 'turbidity', name: 'Turbidity', type: 'decreasing-good' },
    { key: 'TN', name: 'Total Nitrogen', type: 'decreasing-good' },
    { key: 'TP', name: 'Total Phosphorus', type: 'decreasing-good' },
    { key: 'TSS', name: 'Total Suspended Solids', type: 'decreasing-good' },
    { key: 'salinity', name: 'Salinity', type: 'range-based' }
  ];

  const getPercentageDisplay = (key: string, type: string, efficiency: number) => {
    if (type === 'range-based' && key === 'salinity') {
      const influent = influentData.parameters[key as keyof typeof influentData.parameters].value;
      const effluent = effluentData.parameters[key as keyof typeof effluentData.parameters].value;
      const diff = Math.abs(influent - effluent);
      return {
        text: `${diff.toFixed(2)} ppt change`,
        color: 'text-slate-700',
        bgColor: 'bg-slate-100',
        icon: <Minus className="h-4 w-4" />
      };
    }

    if (type === 'increasing-good') {
      const isPositive = efficiency > 0;
      return {
        text: `${isPositive ? '+' : ''}${efficiency.toFixed(1)}% improvement`,
        color: isPositive ? 'text-green-700' : 'text-red-700',
        bgColor: isPositive ? 'bg-green-100' : 'bg-red-100',
        icon: isPositive ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
      };
    }

    const status = efficiency >= 80 ? 'excellent' : efficiency >= 60 ? 'good' : 'needs-improvement';
    return {
      text: `${efficiency.toFixed(1)}% removal`,
      color: status === 'excellent' ? 'text-green-700' : status === 'good' ? 'text-yellow-700' : 'text-red-700',
      bgColor: status === 'excellent' ? 'bg-green-100' : status === 'good' ? 'bg-yellow-100' : 'bg-red-100',
      icon: <ArrowDown className="h-4 w-4" />
    };
  };

  return (
    <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-white">
      <CardHeader>
        <CardTitle className="text-xl">Treatment Performance Summary</CardTitle>
        <CardDescription>
          Side-by-side comparison showing percentage removal and improvement
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Parameter</TableHead>
                <TableHead className="text-right font-semibold">Influent</TableHead>
                <TableHead className="text-right font-semibold">Effluent</TableHead>
                <TableHead className="text-right font-semibold">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parameters.map(({ key, name, type }) => {
                const influentParam = influentData.parameters[key as keyof typeof influentData.parameters];
                const effluentParam = effluentData.parameters[key as keyof typeof effluentData.parameters];
                const efficiency = removalEfficiencies[key];
                const percentDisplay = getPercentageDisplay(key, type, efficiency);

                return (
                  <TableRow key={key} className="hover:bg-blue-50/50 transition-colors">
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold">{influentParam.value.toFixed(2)}</span>
                      <span className="text-muted-foreground ml-1 text-xs">{influentParam.unit}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold">{effluentParam.value.toFixed(2)}</span>
                      <span className="text-muted-foreground ml-1 text-xs">{effluentParam.unit}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${percentDisplay.bgColor} ${percentDisplay.color}`}>
                          {percentDisplay.icon}
                          {percentDisplay.text}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-xs text-green-700 font-semibold mb-1">EXCELLENT (&gt;80%)</div>
            <div className="text-lg font-bold text-green-900">
              {parameters.filter(({ key, type }) =>
                type === 'decreasing-good' && removalEfficiencies[key] >= 80
              ).length}
            </div>
            <div className="text-xs text-green-600">parameters</div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-xs text-yellow-700 font-semibold mb-1">GOOD (60-80%)</div>
            <div className="text-lg font-bold text-yellow-900">
              {parameters.filter(({ key, type }) =>
                type === 'decreasing-good' && removalEfficiencies[key] >= 60 && removalEfficiencies[key] < 80
              ).length}
            </div>
            <div className="text-xs text-yellow-600">parameters</div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-xs text-red-700 font-semibold mb-1">NEEDS IMPROVEMENT (&lt;60%)</div>
            <div className="text-lg font-bold text-red-900">
              {parameters.filter(({ key, type }) =>
                type === 'decreasing-good' && removalEfficiencies[key] < 60
              ).length}
            </div>
            <div className="text-xs text-red-600">parameters</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
