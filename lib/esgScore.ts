import { WaterQualityData, WaterQualityParameter } from './types';
import { getParameterStatus } from './mockData';
import { EJMetrics } from './ejImpact';

export interface ESGScore {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  components: {
    waterQuality: number;
    pollutantReduction: number;
    riskManagement: number;
    transparency: number;
  };
  waterRiskLevel: 'Low' | 'Medium' | 'High';
  improvementTips: string[];
}

export interface ESGTrendPoint {
  date: Date;
  score: number;
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function calculateWaterQualityScore(data: WaterQualityData): number {
  const parameters = Object.values(data.parameters);
  let totalScore = 0;
  let count = 0;

  parameters.forEach(param => {
    const status = getParameterStatus(param.value, param);
    let paramScore = 0;

    switch (status) {
      case 'green':
        paramScore = 100;
        break;
      case 'yellow':
        paramScore = 75;
        break;
      case 'orange':
        paramScore = 50;
        break;
      case 'red':
        paramScore = 25;
        break;
    }

    totalScore += paramScore;
    count++;
  });

  return count > 0 ? totalScore / count : 0;
}

function calculatePollutantReductionScore(removalEfficiencies?: {
  TSS: number;
  TN: number;
  TP: number;
  turbidity: number;
  DO: number;
}): number {
  if (!removalEfficiencies) {
    return 50;
  }

  const avgRemoval = (
    removalEfficiencies.TSS +
    removalEfficiencies.TN +
    removalEfficiencies.TP +
    removalEfficiencies.turbidity
  ) / 4;

  return Math.min(100, avgRemoval);
}

function calculateRiskManagementScore(
  data: WaterQualityData,
  ejMetrics?: EJMetrics,
  alertCount: number = 0
): number {
  let score = 100;

  if (alertCount > 0) {
    score -= alertCount * 10;
  }

  if (ejMetrics?.isEJArea) {
    const parameters = Object.values(data.parameters);
    const hasIssues = parameters.some(param => {
      const status = getParameterStatus(param.value, param);
      return status === 'orange' || status === 'red';
    });

    if (hasIssues) {
      score -= 15;
    }
  }

  const doValue = data.parameters.DO.value;
  if (doValue < 4) {
    score -= 20;
  } else if (doValue < 5) {
    score -= 10;
  }

  return Math.max(0, score);
}

function calculateTransparencyScore(isPublicView: boolean, hasReporting: boolean = true): number {
  let score = 70;

  if (isPublicView) {
    score += 20;
  }

  if (hasReporting) {
    score += 10;
  }

  return score;
}

export function calculateESGScore(
  data: WaterQualityData,
  removalEfficiencies?: {
    TSS: number;
    TN: number;
    TP: number;
    turbidity: number;
    DO: number;
  },
  ejMetrics?: EJMetrics,
  alertCount: number = 0,
  isPublicView: boolean = false
): ESGScore {
  const waterQuality = calculateWaterQualityScore(data);
  const pollutantReduction = calculatePollutantReductionScore(removalEfficiencies);
  const riskManagement = calculateRiskManagementScore(data, ejMetrics, alertCount);
  const transparency = calculateTransparencyScore(isPublicView, true);

  const overall = Math.round(
    waterQuality * 0.4 +
    pollutantReduction * 0.3 +
    riskManagement * 0.2 +
    transparency * 0.1
  );

  const grade = getGrade(overall);

  let waterRiskLevel: 'Low' | 'Medium' | 'High' = 'Low';
  if (alertCount > 2 || (ejMetrics?.isEJArea && waterQuality < 70)) {
    waterRiskLevel = 'High';
  } else if (alertCount > 0 || waterQuality < 80) {
    waterRiskLevel = 'Medium';
  }

  const improvementTips: string[] = [];

  if (pollutantReduction < 80 && removalEfficiencies) {
    const lowestParam = Object.entries(removalEfficiencies)
      .filter(([key]) => key !== 'DO')
      .sort((a, b) => a[1] - b[1])[0];

    if (lowestParam) {
      const improvement = Math.round((80 - lowestParam[1]) / 5) * 5;
      const scoreGain = Math.round(improvement * 0.3);
      improvementTips.push(
        `${improvement}% more ${lowestParam[0]} removal would raise sustainability score by ~${scoreGain} points`
      );
    }
  }

  if (waterQuality < 90) {
    const parameters = Object.values(data.parameters);
    const poorParams = parameters.filter(p => {
      const status = getParameterStatus(p.value, p);
      return status === 'orange' || status === 'red';
    });

    if (poorParams.length > 0) {
      improvementTips.push(
        `Improving ${poorParams[0].name} to target range could increase score by 8-12 points`
      );
    }
  }

  if (alertCount > 0) {
    improvementTips.push(
      `Resolving active water quality alerts would improve risk score by ${alertCount * 10} points`
    );
  }

  if (!isPublicView) {
    improvementTips.push(
      'Enabling Public Transparency View adds 20 points to transparency score'
    );
  }

  if (ejMetrics?.isEJArea && waterQuality < 80) {
    improvementTips.push(
      'Prioritizing improvements in this EJ area enhances sustainability standing and grant eligibility'
    );
  }

  return {
    overall,
    grade,
    components: {
      waterQuality: Math.round(waterQuality),
      pollutantReduction: Math.round(pollutantReduction),
      riskManagement: Math.round(riskManagement),
      transparency: Math.round(transparency)
    },
    waterRiskLevel,
    improvementTips
  };
}

export function generateESGTrendData(baseScore: number): ESGTrendPoint[] {
  const points: ESGTrendPoint[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);

    const variation = Math.random() * 10 - 5;
    const trend = (11 - i) * 0.5;
    const score = Math.min(100, Math.max(0, baseScore + variation + trend));

    points.push({
      date,
      score: Math.round(score)
    });
  }

  return points;
}

export function generateESGReport(
  esgScore: ESGScore,
  regionName: string,
  data: WaterQualityData,
  ejMetrics?: EJMetrics
): string {
  const reportDate = new Date().toLocaleDateString();

  return `SUSTAINABILITY WATER IMPACT REPORT
Generated: ${reportDate}
Location: ${regionName}

=====================================
EXECUTIVE SUMMARY
=====================================

Overall Sustainability Water Impact Score: ${esgScore.overall}/100 (Grade ${esgScore.grade})
Water Risk Level: ${esgScore.waterRiskLevel}

This report provides environmental, social, and governance sustainability metrics
aligned with GRI Standards and SASB Water Sector frameworks.

=====================================
SCORE BREAKDOWN
=====================================

Water Quality Performance: ${esgScore.components.waterQuality}/100 (40% weight)
- Dissolved Oxygen: ${data.parameters.DO.value.toFixed(2)} ${data.parameters.DO.unit}
- Total Nitrogen: ${data.parameters.TN.value.toFixed(2)} ${data.parameters.TN.unit}
- Total Phosphorus: ${data.parameters.TP.value.toFixed(2)} ${data.parameters.TP.unit}
- Turbidity: ${data.parameters.turbidity.value.toFixed(1)} ${data.parameters.turbidity.unit}
- Total Suspended Solids: ${data.parameters.TSS.value.toFixed(1)} ${data.parameters.TSS.unit}

Pollutant Reduction: ${esgScore.components.pollutantReduction}/100 (30% weight)
- BMP effectiveness in reducing nutrient and sediment loads

Risk Management: ${esgScore.components.riskManagement}/100 (20% weight)
- Proactive monitoring and alert response systems
- Environmental justice considerations

Transparency & Reporting: ${esgScore.components.transparency}/100 (10% weight)
- Public data sharing and stakeholder engagement

=====================================
ENVIRONMENTAL JUSTICE
=====================================

${ejMetrics?.isEJArea ?
`EJ-Designated Area: YES
- Low Income Population: ${ejMetrics.percentLowIncome}%
- Minority Population: ${ejMetrics.percentMinority}%
- EJ Index Score: ${ejMetrics.ejIndexScore}
- Data Source: ${ejMetrics.dataSource}

Our organization prioritizes water quality improvements in environmental
justice areas to address disproportionate environmental burdens.` :
`EJ-Designated Area: NO
This location is not currently designated as an EPA EJScreen overburdened
community. We continue monitoring for potential local EJ considerations.`}

=====================================
IMPROVEMENT OPPORTUNITIES
=====================================

${esgScore.improvementTips.map((tip, idx) => `${idx + 1}. ${tip}`).join('\n')}

=====================================
ALIGNMENT WITH FRAMEWORKS
=====================================

GRI 303: Water and Effluents
- 303-1: Water discharge quality monitoring
- 303-2: Management of water-related impacts
- 303-4: Water discharge quality metrics

SASB Water Sector Standards
- Total water discharged: Monitored
- Water quality parameters: ${Object.keys(data.parameters).length} tracked
- Compliance with permits: Active monitoring

=====================================
CERTIFICATION & ATTESTATION
=====================================

This report is based on monitoring data collected through the Project Pearl
water quality management system. Data represents actual measurements and
calculated removal efficiencies from best management practices (BMPs).

For questions or verification, please contact your water quality manager.

Report generated by Project Pearl Sustainability Module
`;
}
