import { WaterQualityData, DataMode } from './types';
import { EJMetrics } from './ejImpact';

export type AlertSeverity = 'info' | 'caution' | 'severe';
export type AlertType =
  | 'low-do'
  | 'severe-low-do'
  | 'high-nutrients'
  | 'severe-nutrients'
  | 'storm-event'
  | 'poor-bmp'
  | 'high-turbidity'
  | 'high-tss'
  | 'salinity-anomaly';

export interface WaterQualityAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  parameter: string;
  value: number;
  threshold: string;
  timestamp: Date;
  recommendations?: string[];
  isEJArea?: boolean;
}

export function detectWaterQualityAlerts(
  data: WaterQualityData,
  dataMode: DataMode = 'ambient',
  removalEfficiencies?: {
    TSS: number;
    TN: number;
    TP: number;
    turbidity: number;
    DO: number;
  },
  ejMetrics?: EJMetrics
): WaterQualityAlert[] {
  const alerts: WaterQualityAlert[] = [];
  const timestamp = new Date();
  const isEJArea = ejMetrics?.isEJArea || false;
  const ejSuffix = isEJArea ? ' in EJ-designated area' : '';

  const doValue = data.parameters.DO.value;
  const tnValue = data.parameters.TN.value;
  const tpValue = data.parameters.TP.value;
  const turbidityValue = data.parameters.turbidity.value;
  const tssValue = data.parameters.TSS.value;
  const salinityValue = data.parameters.salinity.value;

  if (doValue < 4) {
    const recommendations = [
      'Deploy emergency aeration if available',
      'Notify fisheries management and environmental agencies',
      'Increase monitoring frequency to hourly',
      'Document conditions for incident reporting'
    ];
    if (isEJArea) {
      recommendations.push('Prioritize this EJ area for immediate intervention');
    }

    alerts.push({
      id: 'severe-low-do',
      type: 'severe-low-do',
      severity: 'severe',
      title: 'Severe Hypoxia Risk',
      message: `Dissolved oxygen critically low${ejSuffix} – potential stress to fish and shellfish with immediate fish kill risk${isEJArea ? ', affecting overburdened community' : ''}`,
      parameter: 'Dissolved Oxygen',
      value: doValue,
      threshold: '< 4 mg/L',
      timestamp,
      recommendations,
      isEJArea
    });
  } else if (doValue < 5) {
    const recommendations = [
      'Monitor DO trends closely',
      'Check for upstream nutrient or organic loading',
      'Consider increased water circulation if possible'
    ];
    if (isEJArea) {
      recommendations.push('Consider prioritizing BMPs in this EJ area');
    }

    alerts.push({
      id: 'low-do',
      type: 'low-do',
      severity: 'caution',
      title: 'Low Dissolved Oxygen',
      message: `DO below optimal${ejSuffix} – potential stress to fish and shellfish${isEJArea ? ' with disproportionate impact on overburdened community' : ''}`,
      parameter: 'Dissolved Oxygen',
      value: doValue,
      threshold: '< 5 mg/L',
      timestamp,
      recommendations,
      isEJArea
    });
  }

  if (tnValue > 1.5 || tpValue > 1.0) {
    const recommendations = [
      'Investigate upstream nutrient sources immediately',
      'Increase algal bloom monitoring (chlorophyll-a)',
      'Alert water quality managers and TMDL coordinators',
      'Document for potential MS4 violation investigation'
    ];
    if (isEJArea) {
      recommendations.push('Prioritize nutrient reduction BMPs in this EJ-designated area');
    }

    alerts.push({
      id: 'severe-nutrients',
      type: 'severe-nutrients',
      severity: 'severe',
      title: 'Severe Nutrient Loading',
      message: `Extreme nutrient levels detected${ejSuffix} – increased risk to aquatic life from algal blooms and hypoxia${tnValue > 1.5 ? ` (TN: ${tnValue.toFixed(2)} mg/L)` : ''}${tpValue > 1.0 ? ` (TP: ${tpValue.toFixed(2)} mg/L)` : ''}${isEJArea ? ', potential disproportionate impact on overburdened community' : ''}`,
      parameter: tnValue > 1.5 && tpValue > 1.0 ? 'TN & TP' : tnValue > 1.5 ? 'Total Nitrogen' : 'Total Phosphorus',
      value: tnValue > 1.5 ? tnValue : tpValue,
      threshold: tnValue > 1.5 ? 'TN > 1.5 mg/L' : 'TP > 1.0 mg/L',
      timestamp,
      recommendations,
      isEJArea
    });
  } else if (tnValue > 1.0 || tpValue > 0.5) {
    const recommendations = [
      'Monitor for signs of algal growth',
      'Review recent rainfall and runoff events',
      'Check upstream BMP performance'
    ];
    if (isEJArea) {
      recommendations.push('Consider targeting BMPs in this EJ area for grant opportunities');
    }

    alerts.push({
      id: 'high-nutrients',
      type: 'high-nutrients',
      severity: 'caution',
      title: 'Elevated Nutrients',
      message: `Elevated nutrient levels${ejSuffix} – increased risk to aquatic life from algal blooms${tnValue > 1.0 ? ` (TN: ${tnValue.toFixed(2)} mg/L)` : ''}${tpValue > 0.5 ? ` (TP: ${tpValue.toFixed(2)} mg/L)` : ''}${isEJArea ? ', may affect overburdened community' : ''}`,
      parameter: tnValue > 1.0 && tpValue > 0.5 ? 'TN & TP' : tnValue > 1.0 ? 'Total Nitrogen' : 'Total Phosphorus',
      value: tnValue > 1.0 ? tnValue : tpValue,
      threshold: tnValue > 1.0 ? 'TN > 1.0 mg/L' : 'TP > 0.5 mg/L',
      timestamp,
      recommendations,
      isEJArea
    });
  }

  if (dataMode === 'influent-effluent' || dataMode === 'storm-event') {
    if (turbidityValue > 50) {
      const recommendations = [
        'Check filter media and sediment traps',
        'Assess downstream sedimentation',
        'Review settling time and flow rates'
      ];
      if (isEJArea) {
        recommendations.push('Consider erosion control upgrades for EJ benefits');
      }

      alerts.push({
        id: 'high-turbidity',
        type: 'high-turbidity',
        severity: 'caution',
        title: 'High Turbidity',
        message: `Turbidity elevated${ejSuffix} – may affect submerged aquatic vegetation and aquatic habitat${isEJArea ? ', potential impact on overburdened community' : ''}`,
        parameter: 'Turbidity',
        value: turbidityValue,
        threshold: '> 50 NTU',
        timestamp,
        recommendations,
        isEJArea
      });
    }

    if (tssValue > 100) {
      const recommendations = [
        'Verify BMP sediment removal capacity',
        'Check for bypass or short-circuiting',
        'Document for permit compliance reporting'
      ];
      if (isEJArea) {
        recommendations.push('Prioritize sediment control in this EJ area');
      }

      alerts.push({
        id: 'high-tss',
        type: 'high-tss',
        severity: 'caution',
        title: 'High Total Suspended Solids',
        message: `TSS elevated${ejSuffix} – may impact filter-feeding organisms and potential NPDES permit exceedance${isEJArea ? ', affecting overburdened community' : ''}`,
        parameter: 'Total Suspended Solids',
        value: tssValue,
        threshold: '> 100 mg/L',
        timestamp,
        recommendations,
        isEJArea
      });
    }
  }

  if (salinityValue < 5 || salinityValue > 25) {
    alerts.push({
      id: 'salinity-anomaly',
      type: 'salinity-anomaly',
      severity: 'caution',
      title: 'Salinity Anomaly',
      message: `Salinity outside typical estuarine range (${salinityValue.toFixed(1)} ppt)`,
      parameter: 'Salinity',
      value: salinityValue,
      threshold: salinityValue < 5 ? '< 5 ppt' : '> 25 ppt',
      timestamp,
      recommendations: [
        salinityValue < 5
          ? 'Verify freshwater influx or recent heavy rainfall'
          : 'Check for saltwater intrusion or reduced freshwater flow',
        'Monitor impacts on salinity-sensitive species',
        'Review tidal and flow data'
      ]
    });
  }

  if (removalEfficiencies && (dataMode === 'removal-efficiency' || dataMode === 'storm-event')) {
    const tssRemoval = removalEfficiencies.TSS;
    const tnRemoval = removalEfficiencies.TN;
    const tpRemoval = removalEfficiencies.TP;

    if (tssRemoval < 70 || tnRemoval < 60 || tpRemoval < 60) {
      const lowPerformance = [];
      if (tssRemoval < 70) lowPerformance.push(`TSS: ${tssRemoval.toFixed(1)}%`);
      if (tnRemoval < 60) lowPerformance.push(`TN: ${tnRemoval.toFixed(1)}%`);
      if (tpRemoval < 60) lowPerformance.push(`TP: ${tpRemoval.toFixed(1)}%`);

      alerts.push({
        id: 'poor-bmp',
        type: 'poor-bmp',
        severity: 'caution',
        title: 'Low BMP Removal Efficiency',
        message: `BMP underperforming – ${lowPerformance.join(', ')} removal`,
        parameter: 'BMP Performance',
        value: Math.min(tssRemoval, tnRemoval, tpRemoval),
        threshold: '< 70% (TSS) or < 60% (nutrients)',
        timestamp,
        recommendations: [
          'Schedule BMP inspection and maintenance',
          'Check for sediment accumulation or media saturation',
          'Verify hydraulic residence time',
          'Consider capacity assessment if chronic issue'
        ]
      });
    }
  }

  return alerts;
}

export function getAlertColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'severe':
      return 'bg-red-100 border-red-400 text-red-900';
    case 'caution':
      return 'bg-yellow-100 border-yellow-400 text-yellow-900';
    case 'info':
      return 'bg-blue-100 border-blue-400 text-blue-900';
    default:
      return 'bg-gray-100 border-gray-400 text-gray-900';
  }
}

export function getAlertBadgeColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'severe':
      return 'bg-red-600 text-white';
    case 'caution':
      return 'bg-yellow-600 text-white';
    case 'info':
      return 'bg-blue-600 text-white';
    default:
      return 'bg-gray-600 text-white';
  }
}

export function getAlertIcon(severity: AlertSeverity): string {
  switch (severity) {
    case 'severe':
      return 'text-red-700';
    case 'caution':
      return 'text-yellow-700';
    case 'info':
      return 'text-blue-700';
    default:
      return 'text-gray-700';
  }
}
