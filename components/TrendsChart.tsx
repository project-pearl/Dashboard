'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WaterQualityData } from '@/lib/types';
import { format } from 'date-fns';

interface TrendsChartProps {
  data: WaterQualityData;
}

export function TrendsChart({ data }: TrendsChartProps) {
  if (!data.timeSeries) return null;

  const chartData = data.timeSeries.DO.map((point, index) => ({
    timestamp: point.timestamp,
    DO: point.value,
    Turbidity: data.timeSeries!.turbidity[index]?.value || 0,
    TN: data.timeSeries!.TN[index]?.value || 0,
    TP: data.timeSeries!.TP[index]?.value || 0,
    TSS: data.timeSeries!.TSS[index]?.value || 0,
    Salinity: data.timeSeries!.salinity[index]?.value || 0,
  }));

  const formatXAxis = (timestamp: any) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold mb-2">
            {format(new Date(payload[0].payload.timestamp), 'MMM d, HH:mm')}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value.toFixed(2)}{' '}
              {entry.name === 'DO' ? 'mg/L' :
               entry.name === 'Turbidity' ? 'NTU' :
               entry.name === 'Salinity' ? 'ppt' : 'mg/L'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatXAxis}
          tick={{ fontSize: 12 }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line type="monotone" dataKey="DO" stroke="#3b82f6" strokeWidth={2} dot={false} name="DO (mg/L)" />
        <Line type="monotone" dataKey="Turbidity" stroke="#f97316" strokeWidth={2} dot={false} name="Turbidity (NTU)" />
        <Line type="monotone" dataKey="TN" stroke="#10b981" strokeWidth={2} dot={false} name="TN (mg/L)" />
        <Line type="monotone" dataKey="TP" stroke="#a855f7" strokeWidth={2} dot={false} name="TP (mg/L)" />
        <Line type="monotone" dataKey="TSS" stroke="#92400e" strokeWidth={2} dot={false} name="TSS (mg/L)" />
        <Line type="monotone" dataKey="Salinity" stroke="#0891b2" strokeWidth={2} dot={false} name="Salinity (ppt)" />
      </LineChart>
    </ResponsiveContainer>
  );
}
