import { WaterQualityParameter } from './types';
import { getParameterStatus } from './mockData';

export interface EJMetrics {
  isEJArea: boolean;
  locationName: string;
  percentLowIncome: number;
  percentMinority: number;
  ejIndexScore: number;
  dataSource: string;
  state: string;
}

export interface EJImpactAssessment {
  status: 'attention' | 'standard' | 'benefit';
  message: string;
  recommendations: string[];
}

export function getEJMetricsForLocation(locationName: string, regionId: string): EJMetrics {
  const ejRegions: Record<string, Partial<EJMetrics>> = {
    'maryland_middle_branch': {
      isEJArea: true,
      percentLowIncome: 42,
      percentMinority: 68,
      ejIndexScore: 78,
      dataSource: 'EPA EJScreen 2023',
      state: 'MD'
    },
    'maryland_inner_harbor': {
      isEJArea: true,
      percentLowIncome: 38,
      percentMinority: 63,
      ejIndexScore: 74,
      dataSource: 'EPA EJScreen 2023',
      state: 'MD'
    },
    'dc_anacostia': {
      isEJArea: true,
      percentLowIncome: 35,
      percentMinority: 71,
      ejIndexScore: 76,
      dataSource: 'EPA EJScreen 2023',
      state: 'DC'
    }
  };

  const defaultMetrics: EJMetrics = {
    isEJArea: false,
    locationName,
    percentLowIncome: 0,
    percentMinority: 0,
    ejIndexScore: 0,
    dataSource: 'Not available',
    state: 'Other'
  };

  const metrics = ejRegions[regionId];
  if (!metrics) {
    return defaultMetrics;
  }

  return {
    locationName,
    isEJArea: metrics.isEJArea || false,
    percentLowIncome: metrics.percentLowIncome || 0,
    percentMinority: metrics.percentMinority || 0,
    ejIndexScore: metrics.ejIndexScore || 0,
    dataSource: metrics.dataSource || 'Not available',
    state: metrics.state || 'Other'
  };
}

export function assessEJImpact(
  parameter: WaterQualityParameter,
  ejMetrics: EJMetrics
): EJImpactAssessment | null {
  if (!ejMetrics.isEJArea) {
    return null;
  }

  const status = getParameterStatus(parameter.value, parameter);
  const paramName = parameter.name;

  if (status === 'red' || status === 'orange') {
    if (paramName.includes('Dissolved Oxygen') || paramName.includes('DO')) {
      return {
        status: 'attention',
        message: `Low dissolved oxygen in EJ-designated area — potential disproportionate impact on overburdened community`,
        recommendations: [
          'Prioritize aeration and circulation improvements in this area',
          'Consider this location for EJ-focused grant opportunities',
          'Document improvements for EJ benefit reporting'
        ]
      };
    }

    if (paramName.includes('Nitrogen') || paramName.includes('Phosphorus') ||
        paramName.includes('TN') || paramName.includes('TP')) {
      return {
        status: 'attention',
        message: `Elevated nutrients (${parameter.value.toFixed(2)} ${parameter.unit}) in EJ-designated area — BMP improvements could reduce exposure risk`,
        recommendations: [
          'Prioritize nutrient reduction BMPs in this watershed',
          'Target green infrastructure investments for EJ benefits',
          'Track improvements for environmental justice reporting'
        ]
      };
    }

    if (paramName.includes('Turbidity') || paramName.includes('TSS')) {
      return {
        status: 'attention',
        message: `Elevated sediment in EJ-designated area — potential impact on overburdened community`,
        recommendations: [
          'Prioritize sediment control measures in this area',
          'Consider erosion control upgrades for EJ benefits',
          'Document for environmental justice compliance'
        ]
      };
    }
  } else if (status === 'green') {
    if (paramName.includes('Dissolved Oxygen') || paramName.includes('DO')) {
      return {
        status: 'benefit',
        message: `Good water quality in EJ-designated area — supports environmental justice goals`,
        recommendations: [
          'Maintain current BMP performance',
          'Document success for EJ benefit reporting',
          'Share best practices with neighboring communities'
        ]
      };
    }

    if (paramName.includes('Nitrogen') || paramName.includes('Phosphorus') ||
        paramName.includes('TN') || paramName.includes('TP')) {
      return {
        status: 'benefit',
        message: `Low nutrient levels in EJ-designated area — supports environmental justice goals`,
        recommendations: [
          'Maintain current nutrient management practices',
          'Document for EJ benefit and grant reporting',
          'Consider as model for other EJ areas'
        ]
      };
    }
  }

  return {
    status: 'standard',
    message: `Water quality monitoring in EJ-designated area — continued improvements may reduce risk`,
    recommendations: [
      'Continue regular monitoring',
      'Consider additional BMPs to improve conditions',
      'Track progress for environmental justice reporting'
    ]
  };
}

export function getEJAlertContext(parameterName: string, isEJArea: boolean): string | null {
  if (!isEJArea) {
    return null;
  }

  if (parameterName.includes('Dissolved Oxygen') || parameterName.includes('DO')) {
    return 'potential disproportionate impact on overburdened community';
  }

  if (parameterName.includes('Nitrogen') || parameterName.includes('Phosphorus') ||
      parameterName.includes('TN') || parameterName.includes('TP')) {
    return 'potential disproportionate impact on EJ-designated area';
  }

  if (parameterName.includes('Turbidity') || parameterName.includes('TSS')) {
    return 'potential impact on overburdened community';
  }

  return 'potential impact on EJ-designated area';
}
