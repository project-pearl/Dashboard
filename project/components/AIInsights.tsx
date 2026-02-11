'use client';

import { useState, useEffect } from 'react';
import { WaterQualityData, DataMode } from '@/lib/types';
import { getParameterStatus, getRemovalStatus } from '@/lib/mockData';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DetectedStormEvent, analyzeStormPerformance } from '@/lib/stormDetection';
import { WaterQualityAlert } from '@/lib/alertDetection';

interface AIInsightsProps {
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
  stormEventName?: string;
  stormRainfall?: string;
  detectedStormEvent?: DetectedStormEvent | null;
  alerts?: WaterQualityAlert[];
  dataSource?: string;
}

export function AIInsights({ data, dataMode = 'ambient', removalEfficiencies, stormEventName, stormRainfall, detectedStormEvent, alerts, dataSource }: AIInsightsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const generateInsights = () => {
    const insights: { text: string; type: 'positive' | 'warning' | 'info' }[] = [];

    if (alerts && alerts.length > 0) {
      alerts.forEach(alert => {
        const sourceNote = dataSource ? ` (data from ${dataSource.includes('Pearl') ? 'Pearl sensors' : 'ambient sources'})` : '';
        insights.push({
          text: `Alert: ${alert.message}${sourceNote}`,
          type: alert.severity === 'severe' ? 'warning' : alert.severity === 'caution' ? 'warning' : 'info'
        });
      });
    }

    if (detectedStormEvent && removalEfficiencies) {
      const analysis = analyzeStormPerformance(detectedStormEvent, {
        TSS: removalEfficiencies.TSS,
        TN: removalEfficiencies.TN,
        TP: removalEfficiencies.TP,
        turbidity: removalEfficiencies.turbidity,
        DO: removalEfficiencies.DO
      });

      analysis.insights.forEach(insight => {
        insights.push({
          text: insight,
          type: analysis.performanceRating === 'excellent' || analysis.performanceRating === 'good' ? 'positive' : 'info'
        });
      });

      analysis.risks.forEach(risk => {
        insights.push({
          text: `Risk: ${risk}`,
          type: 'warning'
        });
      });

      analysis.maintenanceActions.forEach(action => {
        insights.push({
          text: `Recommendation: ${action}`,
          type: 'warning'
        });
      });

      return insights;
    }

    if (dataMode === 'storm-event' && removalEfficiencies) {
      const tssRemoval = removalEfficiencies.TSS;
      const tnRemoval = removalEfficiencies.TN;
      const tpRemoval = removalEfficiencies.TP;
      const turbidityRemoval = removalEfficiencies.turbidity;
      const avgNutrientRemoval = (tnRemoval + tpRemoval) / 2;

      if (tssRemoval >= 90) {
        insights.push({
          text: `Outstanding TSS removal of ${tssRemoval.toFixed(1)}% during ${stormEventName} - BMP sediment control highly effective`,
          type: 'positive'
        });
      } else if (tssRemoval >= 80) {
        insights.push({
          text: `Good TSS removal of ${tssRemoval.toFixed(1)}% meets MS4 target (>80%) - effective sediment capture`,
          type: 'positive'
        });
      } else if (tssRemoval >= 60) {
        insights.push({
          text: `TSS removal of ${tssRemoval.toFixed(1)}% is marginal - consider BMP maintenance or enhancement`,
          type: 'warning'
        });
      } else {
        insights.push({
          text: `Low TSS removal (${tssRemoval.toFixed(1)}%) below MS4 target - inspect sediment traps and filters`,
          type: 'warning'
        });
      }

      if (avgNutrientRemoval >= 80) {
        insights.push({
          text: `Excellent nutrient removal (TN: ${tnRemoval.toFixed(1)}%, TP: ${tpRemoval.toFixed(1)}%) - significant TMDL load reduction documented`,
          type: 'positive'
        });
      } else if (avgNutrientRemoval >= 60) {
        insights.push({
          text: `Adequate nutrient removal averaging ${avgNutrientRemoval.toFixed(1)}% - meets typical MS4 targets`,
          type: 'positive'
        });
      } else {
        insights.push({
          text: `Nutrient removal below target (avg ${avgNutrientRemoval.toFixed(1)}%) - consider biological treatment enhancement`,
          type: 'warning'
        });
      }

      if (turbidityRemoval >= 85) {
        insights.push({
          text: `High turbidity reduction (${turbidityRemoval.toFixed(1)}%) demonstrates effective water clarity improvement`,
          type: 'positive'
        });
      }

      if (stormRainfall) {
        const rainfall = parseFloat(stormRainfall);
        if (rainfall >= 2.5 && tssRemoval >= 85) {
          insights.push({
            text: `BMP performed well during significant ${stormRainfall} rainfall event - validates design capacity`,
            type: 'positive'
          });
        } else if (rainfall >= 2.5 && tssRemoval < 70) {
          insights.push({
            text: `BMP showed reduced performance during heavy ${stormRainfall} event - may be exceeding design capacity`,
            type: 'warning'
          });
        }
      }

      insights.push({
        text: 'Storm event data suitable for MS4 annual report and TMDL compliance documentation',
        type: 'info'
      });

      return insights;
    }

    if ((dataMode === 'influent-effluent' || dataMode === 'removal-efficiency') && removalEfficiencies) {
      const tnStatus = getRemovalStatus(removalEfficiencies.TN);
      const tpStatus = getRemovalStatus(removalEfficiencies.TP);
      const tssStatus = getRemovalStatus(removalEfficiencies.TSS);

      const tssRemoval = removalEfficiencies.TSS;
      if (tssRemoval >= 94) {
        insights.push({
          text: `Excellent ${tssRemoval.toFixed(1)}% TSS removal - strong BMP performance`,
          type: 'positive'
        });
      }

      if (tnStatus === 'green' && removalEfficiencies.TN > 85) {
        insights.push({
          text: `Excellent nitrogen removal of ${removalEfficiencies.TN.toFixed(1)}% - significantly reduces algal bloom risk in bay`,
          type: 'positive'
        });
      } else if (tnStatus === 'red') {
        insights.push({
          text: `Low nitrogen removal (${removalEfficiencies.TN.toFixed(1)}%) - may indicate biological treatment issues`,
          type: 'warning'
        });
      }

      if (tpStatus === 'green' && removalEfficiencies.TP > 85) {
        insights.push({
          text: `Strong phosphorus removal of ${removalEfficiencies.TP.toFixed(1)}% - protecting seagrass habitat`,
          type: 'positive'
        });
      } else if (tpStatus === 'red') {
        insights.push({
          text: `Phosphorus removal only ${removalEfficiencies.TP.toFixed(1)}% - consider chemical treatment enhancement`,
          type: 'warning'
        });
      }

      if (tssStatus === 'green') {
        insights.push({
          text: `TSS removal at ${removalEfficiencies.TSS.toFixed(1)}% - clarification process performing well`,
          type: 'positive'
        });
      } else if (tssStatus === 'yellow' || tssStatus === 'red') {
        insights.push({
          text: `TSS removal only ${removalEfficiencies.TSS.toFixed(1)}% - possible settling tank or filtration issue`,
          type: 'warning'
        });
      }

      if (removalEfficiencies.turbidity >= 85) {
        insights.push({
          text: `High clarity improvement (${removalEfficiencies.turbidity.toFixed(1)}% turbidity reduction) - discharge meets water clarity standards`,
          type: 'positive'
        });
      }

      insights.push({
        text: 'Treatment plant performance monitoring continuous - real-time alerts enabled',
        type: 'info'
      });

      return insights;
    }

    const doStatus = getParameterStatus(data.parameters.DO.value, data.parameters.DO);
    const tpStatus = getParameterStatus(data.parameters.TP.value, data.parameters.TP);
    const tnStatus = getParameterStatus(data.parameters.TN.value, data.parameters.TN);
    const tssStatus = getParameterStatus(data.parameters.TSS.value, data.parameters.TSS);
    const turbidityStatus = getParameterStatus(data.parameters.turbidity.value, data.parameters.turbidity);

    if (data.timeSeries) {
      const doTrend = data.timeSeries.DO;
      const recent = doTrend.slice(-6);
      const older = doTrend.slice(-12, -6);
      const recentAvg = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
      const olderAvg = older.reduce((sum, p) => sum + p.value, 0) / older.length;
      const doChange = ((recentAvg - olderAvg) / olderAvg) * 100;

      if (Math.abs(doChange) > 5) {
        insights.push({
          text: `DO ${doChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(doChange).toFixed(1)}% over the last 6 hours${doChange > 0 ? ' - positive trend' : ' - monitor closely'}`,
          type: doChange > 0 ? 'positive' : 'warning'
        });
      } else {
        insights.push({
          text: 'DO levels remain stable with minimal fluctuation',
          type: 'positive'
        });
      }

      const tpTrend = data.timeSeries.TP;
      const tpRecent = tpTrend.slice(-6);
      const tpOlder = tpTrend.slice(-12, -6);
      const tpRecentAvg = tpRecent.reduce((sum, p) => sum + p.value, 0) / tpRecent.length;
      const tpOlderAvg = tpOlder.reduce((sum, p) => sum + p.value, 0) / tpOlder.length;
      const tpChange = ((tpRecentAvg - tpOlderAvg) / tpOlderAvg) * 100;

      if (tpChange > 10) {
        insights.push({
          text: `Total Phosphorus elevated by ${tpChange.toFixed(1)}% - possible stormwater runoff detected`,
          type: 'warning'
        });
      }
    }

    if (data.parameters.DO.value > 5 && tpStatus !== 'red' && tnStatus !== 'red') {
      insights.push({
        text: 'Low risk of algal bloom - oxygen and nutrients within acceptable ranges',
        type: 'positive'
      });
    } else if (data.parameters.DO.value < 4 || tpStatus === 'red' || tnStatus === 'red') {
      insights.push({
        text: 'Elevated algal bloom risk due to low oxygen or high nutrient levels - recommend monitoring',
        type: 'warning'
      });
    }

    if (tssStatus === 'yellow' || tssStatus === 'red') {
      insights.push({
        text: 'Elevated suspended solids detected - possible recent rainfall or stormwater discharge',
        type: 'warning'
      });
    }

    if (turbidityStatus === 'green' && tssStatus === 'green') {
      insights.push({
        text: 'Water clarity is excellent - favorable conditions for seagrass and marine life',
        type: 'positive'
      });
    }

    if (data.parameters.TP.value > 0.18 && data.parameters.TSS.value > 30) {
      insights.push({
        text: 'Combined phosphorus and sediment elevation suggests potential sewage or agricultural impact',
        type: 'warning'
      });
    }

    insights.push({
      text: 'Next automated sample collection in 4 hours - continuous monitoring active',
      type: 'info'
    });

    return insights;
  };

  const insights = generateInsights();

  const getIcon = (type: string) => {
    if (type === 'positive') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <Brain className="h-4 w-4 text-blue-600" />;
  };

  if (!mounted) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50 border-slate-200 animate-pulse">
          <div className="h-4 w-4 bg-slate-300 rounded"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-300 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => (
        <div
          key={index}
          className={`flex items-start gap-3 p-3 rounded-lg border ${
            insight.type === 'positive'
              ? 'bg-green-50 border-green-200'
              : insight.type === 'warning'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <div className="mt-0.5">{getIcon(insight.type)}</div>
          <p className="text-sm flex-1">{insight.text}</p>
        </div>
      ))}
    </div>
  );
}
