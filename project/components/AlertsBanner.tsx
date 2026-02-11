'use client';

import { useState, useEffect } from 'react';
import { WaterQualityData, DataMode } from '@/lib/types';
import { getParameterStatus, getRemovalStatus, getStormRemovalStatus } from '@/lib/mockData';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AlertsBannerProps {
  data: WaterQualityData;
  dataMode?: DataMode;
  removalEfficiencies?: {
    DO: number;
    turbidity: number;
    TN: number;
    TP: number;
    TSS: number;
    salinity: number;
  };
}

export function AlertsBanner({ data, dataMode = 'ambient', removalEfficiencies }: AlertsBannerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const alerts: { param: string; status: 'red' | 'orange' | 'yellow'; value: number; unit: string }[] = [];

  if (dataMode === 'storm-event' && removalEfficiencies) {
    const params = [
      { name: 'TSS Removal (Target >80%)', key: 'TSS', value: removalEfficiencies.TSS, unit: '%' },
      { name: 'Nitrogen Removal (Target >60%)', key: 'TN', value: removalEfficiencies.TN, unit: '%' },
      { name: 'Phosphorus Removal (Target >60%)', key: 'TP', value: removalEfficiencies.TP, unit: '%' },
      { name: 'Turbidity Removal', key: 'turbidity', value: removalEfficiencies.turbidity, unit: '%' }
    ];

    params.forEach(param => {
      const status = getStormRemovalStatus(param.value);
      if (status === 'red') {
        alerts.push({ param: param.name, status: 'red', value: param.value, unit: param.unit });
      } else if (status === 'yellow') {
        alerts.push({ param: param.name, status: 'yellow', value: param.value, unit: param.unit });
      }
    });
  } else if (dataMode === 'removal-efficiency' && removalEfficiencies) {
    const params = [
      { name: 'Nitrogen Removal', key: 'TN', value: removalEfficiencies.TN, unit: '%' },
      { name: 'Phosphorus Removal', key: 'TP', value: removalEfficiencies.TP, unit: '%' },
      { name: 'TSS Removal', key: 'TSS', value: removalEfficiencies.TSS, unit: '%' },
      { name: 'Turbidity Removal', key: 'turbidity', value: removalEfficiencies.turbidity, unit: '%' }
    ];

    params.forEach(param => {
      const status = getRemovalStatus(param.value);
      if (status === 'red') {
        alerts.push({ param: param.name, status: 'red', value: param.value, unit: param.unit });
      } else if (status === 'yellow') {
        alerts.push({ param: param.name, status: 'yellow', value: param.value, unit: param.unit });
      }
    });
  } else {
    Object.entries(data.parameters).forEach(([key, param]) => {
      const status = getParameterStatus(param.value, param);
      if (status === 'red') {
        alerts.push({ param: param.name, status: 'red', value: param.value, unit: param.unit });
      } else if (status === 'orange') {
        alerts.push({ param: param.name, status: 'orange', value: param.value, unit: param.unit });
      } else if (status === 'yellow') {
        alerts.push({ param: param.name, status: 'yellow', value: param.value, unit: param.unit });
      }
    });
  }

  if (!mounted) {
    return (
      <Alert className="border-slate-200 bg-slate-50 animate-pulse">
        <div className="h-4 w-4 bg-slate-300 rounded"></div>
        <AlertDescription>
          <div className="h-4 bg-slate-300 rounded w-1/2"></div>
        </AlertDescription>
      </Alert>
    );
  }

  if (alerts.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">
          {dataMode === 'storm-event'
            ? 'BMP Performance Exceeds MS4 Targets'
            : dataMode === 'removal-efficiency'
            ? 'Excellent Treatment Performance'
            : 'All Parameters Healthy'}
        </AlertTitle>
        <AlertDescription className="text-green-700">
          {dataMode === 'storm-event'
            ? 'All removal efficiencies meet or exceed NPDES/MS4 targets. Storm event demonstrates effective BMP performance for permit compliance.'
            : dataMode === 'removal-efficiency'
            ? 'All removal efficiencies exceed 85% - treatment plant performing optimally.'
            : 'All water quality indicators are within optimal ranges. No action required.'}
        </AlertDescription>
      </Alert>
    );
  }

  const hasUnhealthy = alerts.some(a => a.status === 'red');
  const hasElevated = alerts.some(a => a.status === 'orange');
  const hasCaution = alerts.some(a => a.status === 'yellow');

  return (
    <div className="space-y-3">
      {hasUnhealthy && (
        <Alert className="border-red-300 bg-red-50">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-800 font-bold">
            {dataMode === 'storm-event'
              ? 'BMP Performance Below MS4 Target'
              : dataMode === 'removal-efficiency'
              ? 'Treatment Performance Issue'
              : 'Severe: Immediate Attention Required'}
          </AlertTitle>
          <AlertDescription className="text-red-700">
            <div className="mt-2 space-y-1">
              {alerts
                .filter(a => a.status === 'red')
                .map((alert, index) => (
                  <div key={index} className="font-medium">
                    {dataMode === 'storm-event' ? (
                      <>
                        {alert.param} ({alert.value.toFixed(1)}{alert.unit}) below MS4/NPDES targets -
                        {alert.param.includes('TSS') && ' inspect sediment basins, check for short-circuiting'}
                        {alert.param.includes('Nitrogen') && ' review bioretention media, check vegetation health'}
                        {alert.param.includes('Phosphorus') && ' verify filter media capacity, consider P-sorption enhancement'}
                        {alert.param.includes('Turbidity') && ' examine pretreatment forebay, verify settling time'}
                      </>
                    ) : dataMode === 'removal-efficiency' ? (
                      <>
                        {alert.param} ({alert.value.toFixed(1)}{alert.unit}) is below 70% -
                        {alert.param.includes('Nitrogen') && ' check biological treatment system'}
                        {alert.param.includes('Phosphorus') && ' inspect chemical dosing equipment'}
                        {alert.param.includes('TSS') && ' verify clarifier and filtration systems'}
                        {alert.param.includes('Turbidity') && ' examine settling tank performance'}
                      </>
                    ) : (
                      <>
                        {alert.param} ({alert.value.toFixed(2)} {alert.unit}) exceeds safe thresholds - potential risk of
                        {alert.param.includes('Oxygen') && ' hypoxic conditions and fish stress'}
                        {alert.param.includes('Phosphorus') && ' algal bloom or sewage contamination'}
                        {alert.param.includes('Nitrogen') && ' eutrophication and algal growth'}
                        {alert.param.includes('Suspended') && ' reduced water clarity and habitat degradation'}
                        {alert.param.includes('Turbidity') && ' impaired light penetration and seagrass decline'}
                      </>
                    )}
                  </div>
                ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {hasElevated && (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <AlertTitle className="text-orange-800 font-bold">
            Elevated: Increased Monitoring Recommended
          </AlertTitle>
          <AlertDescription className="text-orange-700">
            <div className="mt-2 space-y-1">
              {alerts
                .filter(a => a.status === 'orange')
                .map((alert, index) => (
                  <div key={index}>
                    {alert.param} ({alert.value.toFixed(2)} {alert.unit}) is at elevated levels - schedule regular monitoring and prepare for potential action
                  </div>
                ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {hasCaution && (
        <Alert className="border-yellow-300 bg-yellow-50">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="text-yellow-800 font-bold">
            {dataMode === 'storm-event'
              ? 'BMP Performance Marginal - Consider Maintenance'
              : dataMode === 'removal-efficiency'
              ? 'Treatment Efficiency Below Target'
              : 'Caution: Monitor Closely'}
          </AlertTitle>
          <AlertDescription className="text-yellow-700">
            <div className="mt-2 space-y-1">
              {alerts
                .filter(a => a.status === 'yellow')
                .map((alert, index) => (
                  <div key={index}>
                    {dataMode === 'storm-event' ? (
                      <>
                        {alert.param} ({alert.value.toFixed(1)}{alert.unit}) is between 60-80% - schedule BMP inspection and maintenance
                      </>
                    ) : dataMode === 'removal-efficiency' ? (
                      <>
                        {alert.param} ({alert.value.toFixed(1)}{alert.unit}) is between 70-85% - consider process optimization
                      </>
                    ) : (
                      <>
                        {alert.param} ({alert.value.toFixed(2)} {alert.unit}) is approaching concerning levels - continue monitoring
                      </>
                    )}
                  </div>
                ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
