'use client';

import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { getParameterStatus } from '@/lib/mockData';
import { WaterQualityParameter } from '@/lib/types';

interface RemovalEfficiencyGaugeProps {
  parameterName: string;
  influentValue: number;
  effluentValue: number;
  efficiency: number;
  unit: string;
  effluentParameter: WaterQualityParameter;
}

export function RemovalEfficiencyGauge({
  parameterName,
  influentValue,
  effluentValue,
  efficiency,
  unit,
  effluentParameter
}: RemovalEfficiencyGaugeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col items-center space-y-3 animate-pulse">
        <div className="h-48 w-full bg-slate-200 rounded-lg"></div>
        <div className="h-6 w-32 bg-slate-200 rounded"></div>
      </div>
    );
  }

  const parameterType = effluentParameter.type;
  const valueIncreased = effluentValue > influentValue;
  const percentChange = ((effluentValue - influentValue) / influentValue) * 100;

  const effluentStatus = getParameterStatus(effluentValue, effluentParameter);

  const getStatusColor = () => {
    if (effluentStatus === 'green') return 'bg-green-100 text-green-800 border-green-300';
    if (effluentStatus === 'yellow') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (effluentStatus === 'orange') return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getArrowColor = () => {
    if (effluentStatus === 'green') return 'text-green-600';
    if (effluentStatus === 'yellow') return 'text-yellow-600';
    if (effluentStatus === 'orange') return 'text-orange-600';
    return 'text-red-600';
  };

  const getPerformanceLabel = () => {
    if (effluentStatus === 'green') return 'Excellent';
    if (effluentStatus === 'yellow') return 'Good';
    if (effluentStatus === 'orange') return 'Fair';
    return 'Needs Improvement';
  };

  const getChangeLabel = () => {
    if (parameterType === 'range-based' || parameterType === 'decreasing-bad') {
      return valueIncreased ? 'Increase' : 'Decrease';
    }
    return valueIncreased ? 'Increase' : 'Removal';
  };

  const getMetricLabel = () => {
    if (parameterType === 'range-based' || parameterType === 'decreasing-bad') {
      return 'Change';
    }
    return valueIncreased ? 'Increase' : 'Removal';
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl border-2 hover:shadow-lg transition-all duration-300">
      <h3 className="font-semibold text-lg text-center">{parameterName}</h3>

      <div className={`rounded-full p-4 border-4 ${getStatusColor()}`}>
        <div className="text-center">
          <div className="text-4xl font-bold mb-1">
            {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
          </div>
          <div className="text-xs font-medium uppercase">
            Change
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {valueIncreased ? (
          <TrendingUp className={`h-5 w-5 ${getArrowColor()}`} />
        ) : (
          <TrendingDown className={`h-5 w-5 ${getArrowColor()}`} />
        )}
        <span className={`text-sm font-semibold ${getArrowColor()}`}>
          {getPerformanceLabel()}
        </span>
      </div>

      <div className="w-full space-y-2 text-xs bg-white rounded-lg p-3 border">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Influent:</span>
          <span className="font-semibold">{influentValue.toFixed(2)} {unit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Effluent:</span>
          <span className="font-semibold">{effluentValue.toFixed(2)} {unit}</span>
        </div>
        <div className="flex justify-between pt-2 border-t">
          <span className="text-muted-foreground">{getChangeLabel()}:</span>
          <span className="font-bold text-blue-700">
            {valueIncreased ? '+' : '-'}{Math.abs(effluentValue - influentValue).toFixed(2)} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}
