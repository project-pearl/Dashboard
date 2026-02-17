'use client';
// StormEventTable.tsx
import { StormEvent } from '@/lib/types';
import { CloudRain, TrendingDown, TrendingUp } from 'lucide-react';

interface StormEventTableProps {
  events: StormEvent[];
  selectedEventId: string;
  onSelectEvent: (id: string) => void;
}

export function StormEventTable({ events, selectedEventId, onSelectEvent }: StormEventTableProps) {
  if (!events || events.length === 0) {
    return <div className="text-sm text-slate-500 text-center py-8">No storm events recorded for this region.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <CloudRain className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Storm Event Monitoring</h3>
        </div>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{events.length} event{events.length !== 1 ? 's' : ''} recorded</span>
      </div>
      <div className="text-xs text-slate-500 px-1">Select an event to view detailed influent/effluent data and PEARL treatment performance.</div>
      <div className="overflow-x-auto rounded-xl border-2 border-blue-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-50 border-b border-blue-200">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">Event</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">Date</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">Rainfall</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">TSS Removal</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">TN Removal</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">TP Removal</th>
          </tr>
        </thead>
        <tbody>
          {events.map(event => {
            const isSelected = event.id === selectedEventId;
            const tss = event.removalEfficiencies?.TSS ?? 0;
            const tn = event.removalEfficiencies?.TN ?? 0;
            const tp = event.removalEfficiencies?.TP ?? 0;
            const pctColor = (v: number) => v >= 80 ? 'text-green-700 font-bold' : v >= 60 ? 'text-amber-700 font-bold' : 'text-red-700 font-bold';
            return (
              <tr
                key={event.id}
                onClick={() => onSelectEvent(event.id)}
                className={`border-b border-slate-100 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <CloudRain className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`font-medium ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{event.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{event.date.toLocaleDateString()}</td>
                <td className="px-4 py-2.5 text-right text-slate-600">{event.rainfall}</td>
                <td className={`px-4 py-2.5 text-right ${pctColor(tss)}`}>{tss.toFixed(1)}%</td>
                <td className={`px-4 py-2.5 text-right ${pctColor(tn)}`}>{tn.toFixed(1)}%</td>
                <td className={`px-4 py-2.5 text-right ${pctColor(tp)}`}>{tp.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}
