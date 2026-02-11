'use client';

import { StormEvent } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { getStormRemovalStatus } from '@/lib/mockData';

interface StormEventTableProps {
  event: StormEvent;
}

export function StormEventTable({ event }: StormEventTableProps) {
  const parameters = ['DO', 'turbidity', 'TN', 'TP', 'TSS', 'salinity'] as const;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm font-medium text-blue-900">Event Date</div>
            <div className="text-lg font-semibold">{event.date.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-blue-900">Duration</div>
            <div className="text-lg font-semibold">{event.duration}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-blue-900">Total Rainfall</div>
            <div className="text-lg font-semibold">{event.rainfall}</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold">Parameter</TableHead>
              <TableHead className="font-bold text-center">Influent (Raw Runoff)</TableHead>
              <TableHead className="font-bold text-center">Effluent (Treated)</TableHead>
              <TableHead className="font-bold text-center">Reduction</TableHead>
              <TableHead className="font-bold text-center">% Removal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parameters.map((param) => {
              const influentParam = event.influent.parameters[param];
              const effluentParam = event.effluent.parameters[param];
              const reduction = Math.abs(influentParam.value - effluentParam.value);
              const efficiency = event.removalEfficiencies[param];
              const status = getStormRemovalStatus(efficiency);

              const getBadgeColor = () => {
                if (status === 'green') return 'bg-green-100 text-green-800 border-green-300';
                if (status === 'yellow') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
                return 'bg-red-100 text-red-800 border-red-300';
              };

              return (
                <TableRow key={param}>
                  <TableCell className="font-medium">{influentParam.name}</TableCell>
                  <TableCell className="text-center">
                    <span className="text-red-700 font-semibold">
                      {influentParam.value.toFixed(2)} {influentParam.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-green-700 font-semibold">
                      {effluentParam.value.toFixed(2)} {effluentParam.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {param === 'DO' ? (
                        <>
                          <ArrowUp className="h-4 w-4 text-green-600" />
                          <span className="font-semibold text-green-700">
                            +{reduction.toFixed(2)} {influentParam.unit}
                          </span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-blue-700">
                            -{reduction.toFixed(2)} {influentParam.unit}
                          </span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`${getBadgeColor()} border font-bold text-base px-3 py-1`}>
                      {efficiency.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
        <div className="text-sm font-medium text-green-900 mb-2">
          BMP Performance Summary
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-gray-600">Avg. Removal:</span>
            <span className="font-bold text-green-700 ml-2">
              {Object.values(event.removalEfficiencies)
                .slice(1, 5)
                .reduce((a, b) => a + b, 0) / 4}
              %
            </span>
          </div>
          <div>
            <span className="text-gray-600">TSS Removal:</span>
            <span className="font-bold text-green-700 ml-2">
              {event.removalEfficiencies.TSS.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-gray-600">Nutrient Removal:</span>
            <span className="font-bold text-green-700 ml-2">
              {((event.removalEfficiencies.TN + event.removalEfficiencies.TP) / 2).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
