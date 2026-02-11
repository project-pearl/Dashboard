import { TimeSeriesPoint, WaterQualityData } from './types';

export interface DetectedStormEvent {
  detected: boolean;
  timestamp: Date;
  triggerType: 'primary' | 'supporting' | 'combined';
  triggers: {
    tss?: { increase: number; absolute: number; threshold: string };
    turbidity?: { increase: number; threshold: string };
    tn?: { increase: number; threshold: string };
    tp?: { increase: number; threshold: string };
    do?: { decrease: number; threshold: string };
  };
  severity: 'high' | 'moderate' | 'low';
  description: string;
  recommendations: string[];
}

export function detectStormEvent(
  influentData: WaterQualityData,
  timeWindowHours: number = 6
): DetectedStormEvent | null {
  const tssHistory = influentData.parameters.TSS.history;
  const turbidityHistory = influentData.parameters.turbidity.history;
  const tnHistory = influentData.parameters.TN.history;
  const tpHistory = influentData.parameters.TP.history;
  const doHistory = influentData.parameters.DO.history;

  if (!tssHistory || tssHistory.length < 2) {
    return null;
  }

  // TODO: Replace rule-based detection with ML anomaly detection or OpenAI analysis of time series
  // Future enhancement: Use machine learning models to detect complex storm patterns, predict
  // event severity, and provide predictive maintenance recommendations based on historical data

  const now = new Date();
  const windowStart = new Date(now.getTime() - timeWindowHours * 60 * 60 * 1000);

  const recentPoints = tssHistory.filter(p => p.timestamp >= windowStart);
  if (recentPoints.length < 2) {
    return null;
  }

  const triggers: DetectedStormEvent['triggers'] = {};
  let triggerCount = 0;
  let isPrimaryTrigger = false;
  let isSupportingTrigger = false;

  const baselineTSS = recentPoints[0].value;
  const currentTSS = recentPoints[recentPoints.length - 1].value;
  const tssIncrease = ((currentTSS - baselineTSS) / baselineTSS) * 100;
  const tssAbsoluteIncrease = currentTSS - baselineTSS;

  if (tssIncrease >= 200 || tssAbsoluteIncrease >= 150) {
    triggers.tss = {
      increase: tssIncrease,
      absolute: tssAbsoluteIncrease,
      threshold: tssIncrease >= 200 ? '>200% increase' : '>150 mg/L spike'
    };
    isPrimaryTrigger = true;
    triggerCount++;
  }

  if (turbidityHistory && turbidityHistory.length >= 2) {
    const recentTurbidity = turbidityHistory.filter(p => p.timestamp >= windowStart);
    if (recentTurbidity.length >= 2) {
      const baselineTurbidity = recentTurbidity[0].value;
      const currentTurbidity = recentTurbidity[recentTurbidity.length - 1].value;
      const turbidityIncrease = ((currentTurbidity - baselineTurbidity) / baselineTurbidity) * 100;

      if (turbidityIncrease >= 100) {
        triggers.turbidity = {
          increase: turbidityIncrease,
          threshold: '>100% increase'
        };
        isSupportingTrigger = true;
        triggerCount++;
      }
    }
  }

  if (tnHistory && tnHistory.length >= 2) {
    const recentTN = tnHistory.filter(p => p.timestamp >= windowStart);
    if (recentTN.length >= 2) {
      const baselineTN = recentTN[0].value;
      const currentTN = recentTN[recentTN.length - 1].value;
      const tnIncrease = ((currentTN - baselineTN) / baselineTN) * 100;

      if (tnIncrease >= 50) {
        triggers.tn = {
          increase: tnIncrease,
          threshold: '>50% increase'
        };
        isSupportingTrigger = true;
        triggerCount++;
      }
    }
  }

  if (tpHistory && tpHistory.length >= 2) {
    const recentTP = tpHistory.filter(p => p.timestamp >= windowStart);
    if (recentTP.length >= 2) {
      const baselineTP = recentTP[0].value;
      const currentTP = recentTP[recentTP.length - 1].value;
      const tpIncrease = ((currentTP - baselineTP) / baselineTP) * 100;

      if (tpIncrease >= 50) {
        triggers.tp = {
          increase: tpIncrease,
          threshold: '>50% increase'
        };
        isSupportingTrigger = true;
        triggerCount++;
      }
    }
  }

  if (doHistory && doHistory.length >= 2) {
    const recentDO = doHistory.filter(p => p.timestamp >= windowStart);
    if (recentDO.length >= 2) {
      const baselineDO = recentDO[0].value;
      const currentDO = recentDO[recentDO.length - 1].value;
      const doDecrease = ((baselineDO - currentDO) / baselineDO) * 100;

      if (doDecrease >= 30) {
        triggers.do = {
          decrease: doDecrease,
          threshold: '>30% decrease'
        };
        isSupportingTrigger = true;
        triggerCount++;
      }
    }
  }

  if (!isPrimaryTrigger && triggerCount < 2) {
    return null;
  }

  let severity: 'high' | 'moderate' | 'low' = 'low';
  if (isPrimaryTrigger && triggerCount >= 3) {
    severity = 'high';
  } else if (isPrimaryTrigger || triggerCount >= 3) {
    severity = 'moderate';
  }

  const triggerType = isPrimaryTrigger && isSupportingTrigger ? 'combined' :
                      isPrimaryTrigger ? 'primary' : 'supporting';

  let description = 'Stormwater event detected: ';
  const triggerDescriptions: string[] = [];

  if (triggers.tss) {
    triggerDescriptions.push(`Influent TSS spiked ${triggers.tss.increase.toFixed(0)}% (${triggers.tss.absolute.toFixed(0)} mg/L increase)`);
  }
  if (triggers.turbidity) {
    triggerDescriptions.push(`Turbidity increased ${triggers.turbidity.increase.toFixed(0)}%`);
  }
  if (triggers.tn) {
    triggerDescriptions.push(`Total Nitrogen increased ${triggers.tn.increase.toFixed(0)}%`);
  }
  if (triggers.tp) {
    triggerDescriptions.push(`Total Phosphorus increased ${triggers.tp.increase.toFixed(0)}%`);
  }
  if (triggers.do) {
    triggerDescriptions.push(`Dissolved Oxygen dropped ${triggers.do.decrease.toFixed(0)}%`);
  }

  description += triggerDescriptions.join(', ');

  const recommendations: string[] = [];

  if (severity === 'high') {
    recommendations.push('Activate high-flow monitoring protocols');
    recommendations.push('Verify BMP bypass systems are not engaged');
    recommendations.push('Increase sampling frequency for MS4 documentation');
  } else if (severity === 'moderate') {
    recommendations.push('Monitor BMP performance closely during event');
    recommendations.push('Prepare MS4 storm event documentation');
  }

  if (triggers.tss) {
    recommendations.push('Inspect sediment traps and pretreatment forebays');
  }
  if (triggers.tn || triggers.tp) {
    recommendations.push('Document nutrient loading for TMDL reporting');
  }
  if (triggers.do) {
    recommendations.push('Monitor downstream DO levels for aquatic life impacts');
  }

  return {
    detected: true,
    timestamp: recentPoints[recentPoints.length - 1].timestamp,
    triggerType,
    triggers,
    severity,
    description,
    recommendations
  };
}

export function analyzeStormPerformance(
  detectedEvent: DetectedStormEvent,
  removalEfficiencies: {
    TSS: number;
    TN: number;
    TP: number;
    turbidity: number;
    DO: number;
  }
): {
  performanceRating: 'excellent' | 'good' | 'marginal' | 'poor';
  insights: string[];
  risks: string[];
  maintenanceActions: string[];
} {
  const insights: string[] = [];
  const risks: string[] = [];
  const maintenanceActions: string[] = [];

  const tssRemoval = removalEfficiencies.TSS;
  const tnRemoval = removalEfficiencies.TN;
  const tpRemoval = removalEfficiencies.TP;
  const turbidityRemoval = removalEfficiencies.turbidity;

  let performanceRating: 'excellent' | 'good' | 'marginal' | 'poor' = 'good';

  if (tssRemoval >= 90 && tnRemoval >= 75 && tpRemoval >= 75) {
    performanceRating = 'excellent';
    insights.push(`BMP achieved outstanding ${tssRemoval.toFixed(1)}% TSS removal during stormwater event — strong sediment control validated`);
    insights.push('Performance exceeds MS4/NPDES standards for high-flow conditions');
  } else if (tssRemoval >= 80 && tnRemoval >= 60 && tpRemoval >= 60) {
    performanceRating = 'good';
    insights.push(`BMP achieved ${tssRemoval.toFixed(1)}% TSS removal — meets MS4 target during event`);
    insights.push('Nutrient removal adequate for TMDL compliance');
  } else if (tssRemoval >= 60 || (tnRemoval >= 50 && tpRemoval >= 50)) {
    performanceRating = 'marginal';
    insights.push(`BMP removal efficiency marginal: TSS ${tssRemoval.toFixed(1)}%, TN ${tnRemoval.toFixed(1)}%, TP ${tpRemoval.toFixed(1)}%`);
    maintenanceActions.push('Schedule BMP inspection within 7 days');
  } else {
    performanceRating = 'poor';
    insights.push(`Critical: BMP underperforming during storm event — TSS removal only ${tssRemoval.toFixed(1)}%`);
    maintenanceActions.push('URGENT: Inspect BMP immediately for bypass or short-circuiting');
  }

  if (tssRemoval < 75) {
    risks.push('Elevated sediment discharge may violate NPDES permit limits');
    maintenanceActions.push('Check sediment basin capacity and clean if >50% full');
  }

  if (tnRemoval < 75 || tpRemoval < 75) {
    risks.push('Elevated nutrients in effluent may increase algal bloom potential downstream');
    if (tpRemoval < 70) {
      maintenanceActions.push(`Review BMP maintenance — TP removal efficiency was ${tpRemoval.toFixed(1)}%`);
      maintenanceActions.push('Consider P-sorption media enhancement or replacement');
    }
  }

  if (turbidityRemoval < 80) {
    risks.push('Poor turbidity reduction indicates potential filter media saturation');
    maintenanceActions.push('Inspect and possibly replace filter media in treatment train');
  }

  if (detectedEvent.severity === 'high' && performanceRating === 'excellent') {
    insights.push('BMP design capacity validated — performed well under high-intensity storm conditions');
  } else if (detectedEvent.severity === 'high' && performanceRating !== 'excellent') {
    risks.push('BMP may be undersized or exceeding design capacity during high-intensity events');
    maintenanceActions.push('Consider capacity assessment and potential BMP expansion');
  }

  insights.push('This storm event provides valuable data for MS4 annual reporting and TMDL load calculations');

  return {
    performanceRating,
    insights,
    risks,
    maintenanceActions
  };
}
