'use client';

import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { WaterQualityParameter } from '@/lib/types';
import { getParameterStatus } from '@/lib/mockData';
import { getWildlifeImpact } from '@/lib/wildlifeImpact';
import { Droplet, Waves, Thermometer, Fish } from 'lucide-react';

interface WaterQualityGaugeProps {
  parameter: WaterQualityParameter;
  dataSource?: string;
  removalInfo?: {
    text: string;
    color: string;
    bgColor: string;
  };
  wildlifePerspective?: boolean;
}

export function WaterQualityGauge({ parameter, dataSource, removalInfo, wildlifePerspective = false }: WaterQualityGaugeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const status = getParameterStatus(parameter.value, parameter);

  const getWildlifeParameterName = () => {
    if (!wildlifePerspective) return parameter.name;

    if (parameter.name.includes('Dissolved Oxygen') || parameter.name.includes('DO')) {
      return `Oxygen for Us Fish & Shellfish`;
    }
    if (parameter.name.includes('Turbidity')) {
      return `Water Clarity for Our Plants`;
    }
    if (parameter.name.includes('Total Nitrogen') || parameter.name.includes('TN')) {
      return `Nitrogen Nutrients in Our Home`;
    }
    if (parameter.name.includes('Total Phosphorus') || parameter.name.includes('TP')) {
      return `Phosphorus Nutrients in Our Home`;
    }
    if (parameter.name.includes('Suspended Solids') || parameter.name.includes('TSS')) {
      return `Sediment in Our Water`;
    }
    if (parameter.name.includes('Salinity')) {
      return `Saltiness of Our Home`;
    }
    return parameter.name;
  };

  const getWildlifeStatusText = () => {
    if (!wildlifePerspective) return getStatusText();

    if (status === 'green') {
      if (parameter.name.includes('Dissolved Oxygen') || parameter.name.includes('DO')) {
        return "We're breathing easy!";
      }
      if (parameter.name.includes('Turbidity')) {
        return "Light is good for SAV!";
      }
      if (parameter.name.includes('Nitrogen') || parameter.name.includes('Phosphorus')) {
        return "No bloom party today";
      }
      if (parameter.name.includes('Suspended')) {
        return "Water feels clean";
      }
      if (parameter.name.includes('Salinity')) {
        return "Salinity feels right";
      }
      return "Feels great!";
    }
    if (status === 'yellow') {
      return "Getting uncomfortable";
    }
    if (status === 'orange') {
      return "Hard to live here";
    }
    return "Survival is tough";
  };

  const getWildlifeZoneExplanation = () => {
    if (!wildlifePerspective) return getZoneExplanation();

    if (status === 'green') {
      if (parameter.name.includes('Dissolved Oxygen') || parameter.name.includes('DO')) {
        return "Plenty of oxygen for us to breathe - we fish, crabs, and oysters are thriving!";
      }
      if (parameter.name.includes('Turbidity')) {
        return "The water is clear enough for sunlight to reach our underwater grass beds (SAV)";
      }
      if (parameter.name.includes('Nitrogen') || parameter.name.includes('Phosphorus')) {
        return "Nutrient levels are balanced - no algae blooms blocking our sunlight";
      }
      return "Water conditions are perfect for bay life";
    }
    if (status === 'yellow') {
      return "Things are getting harder for us - we're stressed";
    }
    if (status === 'orange') {
      return "Many of us are struggling to survive in these conditions";
    }
    return "These conditions are dangerous for most bay creatures";
  };

  const calculateNeedlePosition = () => {
    const value = parameter.value;
    const hasOrange = parameter.thresholds.orange !== undefined;

    if (parameter.type === 'decreasing-bad') {
      const redMax = parameter.thresholds.red.max || 0;
      const yellowMin = parameter.thresholds.yellow.min || 0;
      const yellowMax = parameter.thresholds.yellow.max || 0;
      const greenMin = parameter.thresholds.green.min || 0;
      const max = parameter.max;

      if (value <= redMax) {
        return (value / redMax) * 33.33;
      } else if (value <= yellowMax) {
        return 33.33 + ((value - yellowMin) / (yellowMax - yellowMin)) * 16.67;
      } else {
        return 50 + ((value - greenMin) / (max - greenMin)) * 50;
      }
    }

    if (parameter.type === 'increasing-bad') {
      const greenMax = parameter.thresholds.green.max || 0;
      const yellowMax = parameter.thresholds.yellow.max || 0;
      const max = parameter.max;

      if (hasOrange) {
        const orangeMax = parameter.thresholds.orange?.max || 0;
        const greenPercent = greenMax / max;
        const yellowPercent = yellowMax / max;
        const orangePercent = orangeMax / max;

        if (value <= greenMax) {
          return (value / max) * 100;
        } else if (value <= yellowMax) {
          return (value / max) * 100;
        } else if (value <= orangeMax) {
          return (value / max) * 100;
        } else {
          return (value / max) * 100;
        }
      }

      if (value <= greenMax) {
        return (value / greenMax) * 33.33;
      } else if (value <= yellowMax) {
        return 33.33 + ((value - greenMax) / (yellowMax - greenMax)) * 33.33;
      } else {
        return 66.67 + ((value - yellowMax) / (max - yellowMax)) * 33.33;
      }
    }

    if (parameter.type === 'range-based') {
      const greenMin = parameter.thresholds.green.min || 0;
      const greenMax = parameter.thresholds.green.max || 0;
      const yellowMin = parameter.thresholds.yellow.min || 0;
      const yellowMax = parameter.thresholds.yellow.max || 0;
      const max = parameter.max;

      return (value / max) * 100;
    }

    return 50;
  };

  const percent = calculateNeedlePosition();

  if (!mounted) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-full h-56 bg-muted animate-pulse rounded-lg" />
        <div className="text-center mt-4">
          <div className="h-5 w-32 bg-muted animate-pulse rounded mx-auto" />
          <div className="h-4 w-40 bg-muted animate-pulse rounded mt-2 mx-auto" />
        </div>
      </div>
    );
  }

  const getStatusText = () => {
    if (status === 'green') return 'Healthy';
    if (status === 'yellow') return 'Caution';
    if (status === 'orange') return 'Elevated';
    return 'Unhealthy';
  };

  const getThresholdText = () => {
    if (parameter.type === 'increasing-bad') {
      return `Optimal: ≤${parameter.thresholds.green.max} ${parameter.unit}`;
    }
    if (parameter.type === 'decreasing-bad') {
      return `Optimal: ≥${parameter.thresholds.green.min} ${parameter.unit}`;
    }
    if (parameter.type === 'range-based') {
      return `Optimal: ${parameter.thresholds.green.min}-${parameter.thresholds.green.max} ${parameter.unit}`;
    }
    return '';
  };

  const getZoneExplanation = () => {
    if (status === 'green') return 'Water quality is within healthy parameters';
    if (status === 'yellow') return 'Approaching concerning levels, monitor closely';
    if (status === 'orange') return 'Elevated levels detected, increased monitoring recommended';
    return 'Exceeds safe thresholds, action recommended';
  };

  const getIcon = () => {
    if (parameter.name.includes('Oxygen') || parameter.name.includes('Salinity')) {
      return <Droplet className="h-4 w-4" />;
    }
    if (parameter.name.includes('Turbidity') || parameter.name.includes('Suspended')) {
      return <Waves className="h-4 w-4" />;
    }
    return <Thermometer className="h-4 w-4" />;
  };

  const getNeedleColor = () => {
    if (status === 'green') return '#10b981';
    if (status === 'yellow') return '#f59e0b';
    if (status === 'orange') return '#fb923c';
    return '#ef4444';
  };

  const getGaugeColors = () => {
    const hasOrange = parameter.thresholds.orange !== undefined;

    if (parameter.type === 'decreasing-bad') {
      return [
        [0.3333, '#ef4444'],
        [0.50, '#f59e0b'],
        [1, '#10b981']
      ];
    }

    if (parameter.type === 'range-based') {
      const greenMin = parameter.thresholds.green.min || 0;
      const greenMax = parameter.thresholds.green.max || 0;
      const yellowMin = parameter.thresholds.yellow.min || 0;
      const yellowMax = parameter.thresholds.yellow.max || 0;
      const redMax = parameter.thresholds.red.max || parameter.max;
      const max = parameter.max;

      const greenStart = greenMin / max;
      const greenEnd = greenMax / max;
      const yellowEnd1 = yellowMin / max;
      const yellowEnd2 = yellowMax / max;

      return [
        [yellowEnd1, '#f59e0b'],
        [greenStart, '#f59e0b'],
        [greenEnd, '#10b981'],
        [yellowEnd2, '#f59e0b'],
        [1, '#ef4444']
      ];
    }

    if (hasOrange) {
      const greenMax = parameter.thresholds.green.max || 0;
      const yellowMax = parameter.thresholds.yellow.max || 0;
      const orangeMax = parameter.thresholds.orange?.max || 0;
      const max = parameter.max;

      return [
        [greenMax / max, '#10b981'],
        [yellowMax / max, '#f59e0b'],
        [orangeMax / max, '#fb923c'],
        [1, '#ef4444']
      ];
    }

    return [
      [0.3333, '#10b981'],
      [0.6667, '#f59e0b'],
      [1, '#ef4444']
    ];
  };

  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 3,
        radius: '85%',
        center: ['50%', '70%'],
        axisLine: {
          lineStyle: {
            width: 18,
            color: getGaugeColors()
          }
        },
        pointer: {
          itemStyle: {
            color: getNeedleColor(),
            shadowColor: 'rgba(0, 0, 0, 0.3)',
            shadowBlur: 8,
            shadowOffsetY: 2
          },
          length: '65%',
          width: 6
        },
        axisTick: {
          distance: -20,
          length: 6,
          lineStyle: {
            color: '#cbd5e1',
            width: 2
          }
        },
        splitLine: {
          distance: -22,
          length: 12,
          lineStyle: {
            color: '#94a3b8',
            width: 3
          }
        },
        axisLabel: {
          show: false
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          color: '#1e293b',
          fontSize: 0,
          offsetCenter: [0, '-10%']
        },
        data: [{ value: Math.min(Math.max(percent, 0), 100) }],
        animationDuration: 1200,
        animationEasing: 'elasticOut'
      }
    ]
  };

  return (
    <div className="flex flex-col items-center transition-all duration-300 hover:scale-[1.02]">
      <div className="w-full" suppressHydrationWarning>
        <ReactECharts option={option} style={{ height: '220px', width: '100%' }} opts={{ renderer: 'svg' }} />
      </div>
      <div className="text-center -mt-4 w-full" suppressHydrationWarning>
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-muted-foreground">{getIcon()}</span>
          <h3 className="font-semibold text-base">{getWildlifeParameterName()}</h3>
        </div>
        <p className="text-3xl font-bold mb-1">
          {parameter.value.toFixed(2)} <span className="text-lg text-muted-foreground font-normal">{parameter.unit}</span>
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          {getThresholdText()}
        </p>
        <div className="flex justify-center">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
              status === 'green'
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : status === 'yellow'
                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                : status === 'orange'
                ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                : 'bg-red-100 text-red-800 hover:bg-red-200'
            }`}
            title={getWildlifeZoneExplanation()}
          >
            {getWildlifeStatusText()}
          </span>
        </div>
        {(() => {
          const wildlifeImpact = getWildlifeImpact(parameter);
          return (
            <div className="mt-2 px-2">
              <div
                className={`flex items-start gap-1.5 text-xs transition-all duration-200 ${
                  wildlifeImpact.status === 'supportive'
                    ? 'text-green-700'
                    : wildlifeImpact.status === 'caution'
                    ? 'text-yellow-700'
                    : 'text-red-700'
                }`}
                title="Wildlife impact indicator based on EPA Chesapeake Bay Program and water quality standards"
              >
                <Fish className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span className="leading-tight">{wildlifeImpact.text}</span>
              </div>
            </div>
          );
        })()}
        {removalInfo && (
          <div className="mt-3 w-full px-2">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${removalInfo.bgColor} ${removalInfo.color} w-full justify-center`}>
              {removalInfo.text}
            </div>
          </div>
        )}
        {dataSource && (
          <div className="mt-2 text-xs text-muted-foreground opacity-60" title={`Data source: ${dataSource}`}>
            Source: {dataSource.includes('Pearl') ? 'Pearl' : 'Ambient'}
          </div>
        )}
      </div>
    </div>
  );
}
