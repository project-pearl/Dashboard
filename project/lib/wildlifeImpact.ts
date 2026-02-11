import { WaterQualityParameter } from './types';
import { getParameterStatus } from './mockData';

export interface WildlifeImpact {
  text: string;
  status: 'supportive' | 'caution' | 'risk';
}

export function getWildlifeImpact(parameter: WaterQualityParameter): WildlifeImpact {
  const status = getParameterStatus(parameter.value, parameter);
  const value = parameter.value;

  if (parameter.name.includes('Dissolved Oxygen') || parameter.name.includes('DO')) {
    if (status === 'red') {
      return {
        text: 'May cause stress to fish and shellfish',
        status: 'risk'
      };
    } else if (status === 'yellow') {
      return {
        text: 'Below optimal for sensitive aquatic life',
        status: 'caution'
      };
    } else {
      return {
        text: 'Supports healthy fish and shellfish',
        status: 'supportive'
      };
    }
  }

  if (parameter.name.includes('Turbidity')) {
    if (status === 'red' || status === 'orange') {
      return {
        text: 'May limit light for submerged aquatic vegetation',
        status: 'risk'
      };
    } else if (status === 'yellow') {
      return {
        text: 'Reduced clarity may affect SAV growth',
        status: 'caution'
      };
    } else {
      return {
        text: 'Supports light penetration for SAV',
        status: 'supportive'
      };
    }
  }

  if (parameter.name.includes('Nitrogen') || parameter.name.includes('TN')) {
    if (status === 'red' || status === 'orange') {
      return {
        text: 'Elevated algal bloom risk to aquatic life',
        status: 'risk'
      };
    } else if (status === 'yellow') {
      return {
        text: 'Increased risk of algal blooms',
        status: 'caution'
      };
    } else {
      return {
        text: 'Lowers algal bloom risk to aquatic life',
        status: 'supportive'
      };
    }
  }

  if (parameter.name.includes('Phosphorus') || parameter.name.includes('TP')) {
    if (status === 'red' || status === 'orange') {
      return {
        text: 'Elevated algal bloom risk to aquatic life',
        status: 'risk'
      };
    } else if (status === 'yellow') {
      return {
        text: 'Increased risk of algal blooms',
        status: 'caution'
      };
    } else {
      return {
        text: 'Lowers algal bloom risk to aquatic life',
        status: 'supportive'
      };
    }
  }

  if (parameter.name.includes('TSS') || parameter.name.includes('Suspended Solids')) {
    if (status === 'red' || status === 'orange') {
      return {
        text: 'May impact filter-feeding organisms',
        status: 'risk'
      };
    } else if (status === 'yellow') {
      return {
        text: 'Elevated sediment load for aquatic habitat',
        status: 'caution'
      };
    } else {
      return {
        text: 'Supports clear water for aquatic habitat',
        status: 'supportive'
      };
    }
  }

  if (parameter.name.includes('Salinity')) {
    const greenMin = parameter.thresholds.green.min || 0;
    const greenMax = parameter.thresholds.green.max || 0;

    if (value < greenMin || value > greenMax) {
      return {
        text: 'Outside optimal range for estuarine species',
        status: 'risk'
      };
    } else if (status === 'yellow') {
      return {
        text: 'May affect salinity-sensitive species',
        status: 'caution'
      };
    } else {
      return {
        text: 'Supports diverse estuarine species',
        status: 'supportive'
      };
    }
  }

  return {
    text: 'Monitoring for ecosystem health',
    status: 'supportive'
  };
}

export function getWildlifeAlertContext(parameterName: string, isLow: boolean = false): string {
  if (parameterName.includes('Dissolved Oxygen') || parameterName.includes('DO')) {
    return isLow
      ? 'potential stress to fish and shellfish'
      : 'supporting aquatic life';
  }

  if (parameterName.includes('Nitrogen') || parameterName.includes('Phosphorus') ||
      parameterName.includes('TN') || parameterName.includes('TP')) {
    return 'increased risk to aquatic life from algal blooms';
  }

  if (parameterName.includes('Turbidity')) {
    return 'potential impact on submerged aquatic vegetation';
  }

  if (parameterName.includes('TSS') || parameterName.includes('Suspended Solids')) {
    return 'potential impact on filter-feeding organisms and habitat';
  }

  return 'potential impact on aquatic ecosystem';
}
