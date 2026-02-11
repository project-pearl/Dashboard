'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { calculateOverallScore, applyRegionThresholds, calculateRemovalEfficiency, getRemovalStatus, getRegionMockData } from '@/lib/mockData';
import { TimeMode, DataMode } from '@/lib/types';
import { StormEventTable } from '@/components/StormEventTable';
import { StormDetectionBanner } from '@/components/StormDetectionBanner';
import { WaterQualityAlerts } from '@/components/WaterQualityAlerts';
import { DataSourceDisclaimer } from '@/components/DataSourceDisclaimer';
import { DataSourceFooter } from '@/components/DataSourceFooter';
import { detectStormEvent } from '@/lib/stormDetection';
import { detectWaterQualityAlerts } from '@/lib/alertDetection';
import { getEJMetricsForLocation } from '@/lib/ejImpact';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Droplets, GitCompare, MapPin, CloudRain, FileText, Eye, EyeOff, Coins, BarChart3, BookOpen, Share2, Copy, Check, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertsBanner } from '@/components/AlertsBanner';
import { TrendsChart } from '@/components/TrendsChart';
import { AIInsights } from '@/components/AIInsights';
import { RemovalSummaryCard } from '@/components/RemovalSummaryCard';
import { calculateRemovalDisplay } from '@/lib/removalCalculations';
import { regionsConfig, getRegionById, isChesapeakeBayRegion } from '@/lib/regionsConfig';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const WaterQualityGauge = dynamic(
  () => import('@/components/WaterQualityGauge').then((mod) => mod.WaterQualityGauge),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center space-y-3">
        <Skeleton className="h-56 w-full rounded-lg" />
        <Skeleton className="h-5 w-32 mx-auto" />
        <Skeleton className="h-4 w-40 mx-auto" />
        <Skeleton className="h-6 w-20 mx-auto rounded-full" />
      </div>
    ),
  }
);

const RemovalEfficiencyGauge = dynamic(
  () => import('@/components/RemovalEfficiencyGauge').then((mod) => mod.RemovalEfficiencyGauge),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center space-y-3">
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    ),
  }
);

const ROISavingsCalculator = dynamic(
  () => import('@/components/ROISavingsCalculator').then((mod) => mod.ROISavingsCalculator),
  { ssr: false }
);

const PeerBenchmarking = dynamic(
  () => import('@/components/PeerBenchmarking').then((mod) => mod.PeerBenchmarking),
  { ssr: false }
);

const GrantOpportunityMatcher = dynamic(
  () => import('@/components/GrantOpportunityMatcher').then((mod) => mod.GrantOpportunityMatcher),
  { ssr: false }
);

const NutrientCreditsTrading = dynamic(
  () => import('@/components/NutrientCreditsTrading').then((mod) => mod.NutrientCreditsTrading),
  { ssr: false }
);

const TMDLProgressAndReportGenerator = dynamic(
  () => import('@/components/TMDLProgressAndReportGenerator').then((mod) => mod.TMDLProgressAndReportGenerator),
  { ssr: false }
);

const WeatherOverlay = dynamic(
  () => import('@/components/WeatherOverlay').then((mod) => mod.WeatherOverlay),
  { ssr: false }
);

const WildlifeImpactDisclaimer = dynamic(
  () => import('@/components/WildlifeImpactDisclaimer').then((mod) => mod.WildlifeImpactDisclaimer),
  { ssr: false }
);

const EnvironmentalJusticeImpact = dynamic(
  () => import('@/components/EnvironmentalJusticeImpact').then((mod) => mod.EnvironmentalJusticeImpact),
  { ssr: false }
);

const ESGImpactReporting = dynamic(
  () => import('@/components/ESGImpactReporting').then((mod) => mod.ESGImpactReporting),
  { ssr: false }
);

const ManuscriptGenerator = dynamic(
  () => import('@/components/ManuscriptGenerator').then((mod) => mod.ManuscriptGenerator),
  { ssr: false }
);

export default function Home() {
  const [timeMode, setTimeMode] = useState<TimeMode>('real-time');
  const [dataMode, setDataMode] = useState<DataMode>('ambient');
  const [selectedRegionId, setSelectedRegionId] = useState('florida_escambia');
  const [showComparison, setShowComparison] = useState(false);
  const [selectedStormEventId, setSelectedStormEventId] = useState<string>('storm-1');
  const [stormDetectionDismissed, setStormDetectionDismissed] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [isPublicView, setIsPublicView] = useState(false);
  const [showNutrientCredits, setShowNutrientCredits] = useState(false);
  const [showESG, setShowESG] = useState(false);
  const [showManuscript, setShowManuscript] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userRole, setUserRole] = useState('Municipality / MS4');
  const [wildlifePerspective, setWildlifePerspective] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    setStartDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
    setEndDate(new Date().toISOString().slice(0, 16));

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('view') === 'public') {
        setIsPublicView(true);
        const region = urlParams.get('region');
        if (region) {
          setSelectedRegionId(region);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!isChesapeakeBayRegion(selectedRegionId) && showNutrientCredits) {
      setShowNutrientCredits(false);
    }
  }, [selectedRegionId, showNutrientCredits]);

  useEffect(() => {
    console.log('Rendering for role:', userRole);
    console.log('MS4 Tools visible:', shouldShowMS4Tools());
    console.log('ROI Calculator visible:', shouldShowROICalculator());
    console.log('Grant Matcher visible:', shouldShowGrantMatcher());
  }, [userRole]);

  useEffect(() => {
    console.log('Wildlife Perspective:', wildlifePerspective ? 'ON' : 'OFF');
  }, [wildlifePerspective]);

  const shouldShowMS4Tools = () => {
    return userRole === 'Municipality / MS4';
  };

  const shouldShowNutrientCreditsButton = () => {
    const hideFor = ['K-12 Student / Teacher', 'College Student', 'NGO / Nonprofit'];
    return !hideFor.includes(userRole);
  };

  const shouldShowESGButton = () => {
    return userRole === 'Corporate / ESG' || userRole === 'Municipality / MS4' || userRole === 'Scientist / Researcher';
  };

  const shouldShowManuscriptButton = () => {
    return userRole === 'Scientist / Researcher' || userRole === 'College Student';
  };

  const shouldShowROICalculator = () => {
    return userRole === 'Municipality / MS4' || userRole === 'Corporate / ESG';
  };

  const shouldShowPeerBenchmarking = () => {
    return userRole !== 'K-12 Student / Teacher';
  };

  const shouldShowGrantMatcher = () => {
    return userRole === 'Municipality / MS4' || userRole === 'NGO / Nonprofit';
  };

  const shouldShowEJImpact = () => {
    return userRole !== 'K-12 Student / Teacher';
  };

  const shouldShowAIInsights = () => {
    return userRole !== 'K-12 Student / Teacher';
  };

  const shouldShowTrendsChart = () => {
    return true;
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set(prev).add(alertId));
  };

  const selectedRegion = useMemo(() => getRegionById(selectedRegionId), [selectedRegionId]);

  const regionData = useMemo(() => getRegionMockData(selectedRegionId), [selectedRegionId]);

  const data = useMemo(() => {
    if (!selectedRegion) return regionData.ambient;
    return applyRegionThresholds(regionData.ambient, selectedRegion.thresholds);
  }, [selectedRegion, regionData]);

  const influentData = useMemo(() => {
    return regionData.influent;
  }, [regionData]);

  const effluentData = useMemo(() => {
    return regionData.effluent;
  }, [regionData]);

  const stormEvents = useMemo(() => regionData.storms, [regionData]);

  const removalEfficiencies = useMemo(() => ({
    DO: calculateRemovalEfficiency(influentData.parameters.DO.value, effluentData.parameters.DO.value, 'DO'),
    turbidity: calculateRemovalEfficiency(influentData.parameters.turbidity.value, effluentData.parameters.turbidity.value, 'turbidity'),
    TN: calculateRemovalEfficiency(influentData.parameters.TN.value, effluentData.parameters.TN.value, 'TN'),
    TP: calculateRemovalEfficiency(influentData.parameters.TP.value, effluentData.parameters.TP.value, 'TP'),
    TSS: calculateRemovalEfficiency(influentData.parameters.TSS.value, effluentData.parameters.TSS.value, 'TSS'),
    salinity: calculateRemovalEfficiency(influentData.parameters.salinity.value, effluentData.parameters.salinity.value, 'salinity')
  }), [influentData, effluentData]);

  const selectedStormEvent = useMemo(() => {
    return stormEvents.find(event => event.id === selectedStormEventId) || stormEvents[0];
  }, [selectedStormEventId, stormEvents]);

  const detectedStormEvent = useMemo(() => {
    const hoursDiff = timeMode === 'real-time' ? 24 :
      Math.min(24, (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60));

    return detectStormEvent(influentData, hoursDiff);
  }, [timeMode, startDate, endDate, influentData]);

  useEffect(() => {
    if (stormEvents.length > 0 && !stormEvents.find(e => e.id === selectedStormEventId)) {
      setSelectedStormEventId(stormEvents[0].id);
    }
  }, [stormEvents, selectedStormEventId]);

  useEffect(() => {
    if (detectedStormEvent && !stormDetectionDismissed) {
      console.log('Storm event detected:', detectedStormEvent);
    }
  }, [detectedStormEvent, stormDetectionDismissed]);

  const ejMetrics = useMemo(() => {
    return getEJMetricsForLocation(selectedRegion?.name || '', selectedRegionId);
  }, [selectedRegion, selectedRegionId]);

  const waterQualityAlerts = useMemo(() => {
    const currentData = dataMode === 'ambient' ? data :
                        dataMode === 'storm-event' ? selectedStormEvent.effluent :
                        effluentData;

    const currentRemovalEfficiencies = dataMode === 'storm-event'
      ? selectedStormEvent.removalEfficiencies
      : removalEfficiencies;

    return detectWaterQualityAlerts(currentData, dataMode, currentRemovalEfficiencies, ejMetrics);
  }, [data, dataMode, selectedStormEvent, effluentData, removalEfficiencies, ejMetrics]);

  const overallScore = calculateOverallScore(data);

  const previousPeriodData = useMemo(() => {
    const ambient = regionData.ambient;
    const baseData = {
      ...ambient,
      parameters: {
        DO: { ...ambient.parameters.DO, value: ambient.parameters.DO.value * 1.05 },
        turbidity: { ...ambient.parameters.turbidity, value: ambient.parameters.turbidity.value * 0.83 },
        TN: { ...ambient.parameters.TN, value: ambient.parameters.TN.value * 0.84 },
        TP: { ...ambient.parameters.TP, value: ambient.parameters.TP.value * 0.70 },
        TSS: { ...ambient.parameters.TSS, value: ambient.parameters.TSS.value * 0.66 },
        salinity: { ...ambient.parameters.salinity, value: ambient.parameters.salinity.value * 0.95 }
      }
    };
    if (!selectedRegion) return baseData;
    return applyRegionThresholds(baseData, selectedRegion.thresholds);
  }, [selectedRegion, regionData]);

  const calculateChange = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return change.toFixed(1);
  };

  const exportToCSV = () => {
    const rows = [
      ['Parameter', 'Value', 'Unit', 'Healthy Range', 'Status'],
      ...Object.values(data.parameters).map(param => {
        const status =
          param.type === 'increasing-bad'
            ? `≤${param.thresholds.green.max}`
            : param.type === 'decreasing-bad'
            ? `≥${param.thresholds.green.min}`
            : `${param.thresholds.green.min}-${param.thresholds.green.max}`;

        const condition =
          (param.type === 'increasing-bad' && param.value <= param.thresholds.green.max!) ? 'Healthy' :
          (param.type === 'decreasing-bad' && param.value >= param.thresholds.green.min!) ? 'Healthy' :
          (param.type === 'range-based' && param.value >= param.thresholds.green.min! && param.value <= param.thresholds.green.max!) ? 'Healthy' :
          'Needs Attention';

        return [
          param.name,
          param.value.toFixed(2),
          param.unit,
          status,
          condition
        ];
      })
    ];

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `water-quality-${data.location}-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportStormReport = () => {
    const event = selectedStormEvent;
    const parameters = ['DO', 'turbidity', 'TN', 'TP', 'TSS', 'salinity'] as const;

    const rows = [
      ['STORM EVENT BMP PERFORMANCE REPORT'],
      [''],
      ['Event Name', event.name],
      ['Event Date', event.date.toLocaleString()],
      ['Duration', event.duration],
      ['Total Rainfall', event.rainfall],
      ['Region', selectedRegion?.name || 'Escambia Bay, Florida'],
      [''],
      ['PARAMETER', 'INFLUENT (mg/L or NTU)', 'EFFLUENT (mg/L or NTU)', 'REDUCTION', '% REMOVAL', 'COMPLIANCE'],
      ...parameters.map((param) => {
        const influentParam = event.influent.parameters[param];
        const effluentParam = event.effluent.parameters[param];
        const reduction = Math.abs(influentParam.value - effluentParam.value);
        const efficiency = event.removalEfficiencies[param];
        const compliance = efficiency >= 80 ? 'MEETS TARGET (>80%)' : efficiency >= 60 ? 'MARGINAL (60-80%)' : 'BELOW TARGET (<60%)';

        return [
          influentParam.name,
          `${influentParam.value.toFixed(2)} ${influentParam.unit}`,
          `${effluentParam.value.toFixed(2)} ${effluentParam.unit}`,
          `${reduction.toFixed(2)} ${influentParam.unit}`,
          `${efficiency.toFixed(1)}%`,
          compliance
        ];
      }),
      [''],
      ['SUMMARY STATISTICS'],
      ['Average Removal Efficiency', `${(Object.values(event.removalEfficiencies).slice(1, 5).reduce((a, b) => a + b, 0) / 4).toFixed(1)}%`],
      ['TSS Removal Efficiency', `${event.removalEfficiencies.TSS.toFixed(1)}%`],
      ['Nutrient Removal (TN+TP avg)', `${((event.removalEfficiencies.TN + event.removalEfficiencies.TP) / 2).toFixed(1)}%`],
      [''],
      ['REGULATORY COMPLIANCE NOTES'],
      ['This report supports MS4 permit requirements for BMP performance monitoring.'],
      ['Data demonstrates stormwater load reduction for TMDL compliance documentation.'],
      ['Typical target: >80% TSS removal, >60% nutrient removal per NPDES/MS4 standards.'],
      ['Report generated', new Date().toLocaleString()]
    ];

    const csvContent = rows.map(row => Array.isArray(row) ? row.join(',') : row).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storm-event-report-${event.name.replace(/\s+/g, '-')}-${event.date.toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const createPublicSnapshotLink = () => {
    const region = getRegionById(selectedRegionId);
    const regionSlug = region?.name.replace(/[^a-zA-Z0-9]/g, '') || 'Region';
    const dateSlug = new Date().toISOString().slice(0, 7).replace('-', '');
    const mockShortUrl = `pearl.sh/${regionSlug}-${dateSlug}`;

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${baseUrl}/?view=public&region=${selectedRegionId}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
      }).catch(() => {
        window.open(fullUrl, '_blank');
      });
    } else {
      window.open(fullUrl, '_blank');
    }
  };

  console.log('Rendering view for role:', userRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {!isPublicView && mounted && (
        <div className="fixed top-4 right-4 z-50 hidden lg:block">
          <WeatherOverlay />
        </div>
      )}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col gap-6">
          {isPublicView && (
            <Card className="border-2 border-green-500 bg-gradient-to-r from-green-50 to-emerald-50">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 justify-center">
                  <Share2 className="h-5 w-5 text-green-700" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-green-900">
                      Public View – Data from Project Pearl monitoring
                    </p>
                    <p className="text-xs text-green-700 mt-0.5">
                      Real-time water quality transparency for community stakeholders
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="flex flex-col gap-2">
              <div className="relative w-full max-w-[280px] sm:max-w-[400px] h-[50px] sm:h-[70px]">
                <Image
                  src="/Logo_Pearl_as_Headline.JPG"
                  alt="Project Pearl Logo"
                  fill
                  className="object-contain object-left"
                  priority
                />
              </div>
              <p className="text-sm sm:text-base text-muted-foreground">
                {isPublicView ? 'Community Water Quality Transparency' : 'Water Quality Monitoring Dashboard'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 justify-end">
              <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  {regionsConfig.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!isPublicView && (
                <Tabs value={timeMode} onValueChange={(v) => setTimeMode(v as TimeMode)} className="w-full sm:w-auto">
                  <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="real-time" className="flex-1 sm:flex-none">Real-Time</TabsTrigger>
                    <TabsTrigger value="range" className="flex-1 sm:flex-none">Time Range</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {!isPublicView && (
                <Tabs value={dataMode} onValueChange={(v) => setDataMode(v as DataMode)} className="w-full sm:w-auto">
                  <TabsList className="w-full sm:w-auto grid grid-cols-2 lg:grid-cols-4">
                    <TabsTrigger value="ambient" className="text-xs sm:text-sm">Ambient</TabsTrigger>
                    <TabsTrigger value="influent-effluent" className="text-xs sm:text-sm">In/Effluent</TabsTrigger>
                    <TabsTrigger value="removal-efficiency" className="text-xs sm:text-sm">% Removal</TabsTrigger>
                    <TabsTrigger value="storm-event" className="text-xs sm:text-sm flex items-center gap-1">
                      <CloudRain className="h-3 w-3" />
                      Storm BMP
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {!isPublicView && isChesapeakeBayRegion(selectedRegionId) && shouldShowNutrientCreditsButton() && (
                <Button
                  onClick={() => {
                    setShowNutrientCredits(!showNutrientCredits);
                    if (!showNutrientCredits) {
                      setShowComparison(false);
                      setShowESG(false);
                      setShowManuscript(false);
                    }
                  }}
                  variant={showNutrientCredits ? "default" : "outline"}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Coins className="h-4 w-4" />
                  <span className="sm:inline">Nutrient Credits</span>
                </Button>
              )}

              {!isPublicView && shouldShowESGButton() && (
                <Button
                  onClick={() => {
                    setShowESG(!showESG);
                    if (!showESG) {
                      setShowComparison(false);
                      setShowNutrientCredits(false);
                      setShowManuscript(false);
                    }
                  }}
                  variant={showESG ? "default" : "outline"}
                  className={`gap-2 w-full sm:w-auto ${showESG ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-blue-600 text-blue-600 hover:bg-blue-50'}`}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="sm:inline">ESG Impact</span>
                </Button>
              )}

              {!isPublicView && shouldShowManuscriptButton() && (
                <Button
                  onClick={() => {
                    setShowManuscript(!showManuscript);
                    if (!showManuscript) {
                      setShowComparison(false);
                      setShowNutrientCredits(false);
                      setShowESG(false);
                    }
                  }}
                  variant={showManuscript ? "default" : "outline"}
                  className={`gap-2 w-full sm:w-auto ${showManuscript ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-purple-600 text-purple-600 hover:bg-purple-50'}`}
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="sm:inline">Manuscript</span>
                </Button>
              )}

              {!isPublicView && (
                <Button
                  onClick={() => {
                    setShowComparison(!showComparison);
                    if (!showComparison) {
                      setShowNutrientCredits(false);
                      setShowESG(false);
                      setShowManuscript(false);
                    }
                  }}
                  variant={showComparison ? "default" : "outline"}
                  className="gap-2 w-full sm:w-auto"
                >
                  <GitCompare className="h-4 w-4" />
                  <span className="sm:inline">Compare</span>
                </Button>
              )}

              <Button
                onClick={() => setIsPublicView(!isPublicView)}
                variant={!isPublicView ? "default" : "outline"}
                className="gap-2 w-full sm:w-auto"
              >
                {!isPublicView ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span className="sm:inline">Expert View</span>
              </Button>

              {!isPublicView && (
                <>
                  {dataMode === 'storm-event' ? (
                    <Button onClick={exportStormReport} variant="outline" className="gap-2 w-full sm:w-auto">
                      <FileText className="h-4 w-4" />
                      <span className="sm:inline">Export CSV</span>
                    </Button>
                  ) : (
                    <Button onClick={exportToCSV} variant="outline" className="gap-2 w-full sm:w-auto">
                      <Download className="h-4 w-4" />
                      <span className="sm:inline">Export CSV</span>
                    </Button>
                  )}

                  <Button
                    onClick={createPublicSnapshotLink}
                    variant="default"
                    className="gap-2 w-full sm:w-auto bg-green-600 hover:bg-green-700"
                  >
                    {linkCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    <span className="sm:inline">{linkCopied ? 'Link Copied!' : 'Share Public Link'}</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {!isPublicView && timeMode === 'range' && (
            <Card>
              <CardHeader>
                <CardTitle>Time Range Selection</CardTitle>
                <CardDescription>
                  Select a custom date range to view historical data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="text-sm font-medium">Start Date</label>
                    <input
                      type="datetime-local"
                      className="border rounded-md px-3 py-2 w-full"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="text-sm font-medium">End Date</label>
                    <input
                      type="datetime-local"
                      className="border rounded-md px-3 py-2 w-full"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <Button className="w-full sm:w-auto">Apply Range</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {dataMode === 'storm-event' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="text-sm font-medium text-muted-foreground">Select Storm Event:</div>
              <Select value={selectedStormEventId} onValueChange={setSelectedStormEventId}>
                <SelectTrigger className="w-full sm:w-[400px]">
                  <CloudRain className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Storm Event" />
                </SelectTrigger>
                <SelectContent>
                  {stormEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} - {event.date.toLocaleDateString()} ({event.rainfall})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-blue-900 mb-1">
                  {selectedRegion?.name}
                </h3>
                <p className="text-xs text-blue-700">
                  {selectedRegion?.description}
                </p>
                <p className="text-xs text-blue-600 mt-2 italic">
                  Note: More regions can be added easily later for global deployment
                </p>
              </div>
            </div>
          </div>

          {!isPublicView && mounted && (
            <Card className="border-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white" suppressHydrationWarning>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">User Role Configuration</CardTitle>
                <CardDescription>Customize your dashboard view</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <label className="text-sm font-medium whitespace-nowrap">User Role:</label>
                    <Select
                      value={userRole}
                      onValueChange={(value) => {
                        console.log('Role:', value);
                        setUserRole(value);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[280px]">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Municipality / MS4">Municipality / MS4</SelectItem>
                        <SelectItem value="K-12 Student / Teacher">K-12 Student / Teacher</SelectItem>
                        <SelectItem value="College Student">College Student</SelectItem>
                        <SelectItem value="Scientist / Researcher">Scientist / Researcher</SelectItem>
                        <SelectItem value="Corporate / ESG">Corporate / ESG</SelectItem>
                        <SelectItem value="NGO / Nonprofit">NGO / Nonprofit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🦪🐟</span>
                      <span className="text-sm font-medium text-slate-700">See it from the Bay's Perspective</span>
                    </div>
                    <button
                      onClick={() => setWildlifePerspective(!wildlifePerspective)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        wildlifePerspective ? 'bg-cyan-600' : 'bg-slate-300'
                      }`}
                      role="switch"
                      aria-checked={wildlifePerspective}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          wildlifePerspective ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-2" suppressHydrationWarning>
                    {userRole === 'Municipality / MS4' && (
                      <Card className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-white">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                            Municipal Compliance View
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            <strong>MS4 tools:</strong> Report generator, ROI calculator, nutrient credits trading, grant matcher (coming soon)
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-medium">MS4 Reports</span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md font-medium">ROI Analysis</span>
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md font-medium">Grant Matching</span>
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-md font-medium">Nutrient Credits</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {userRole === 'K-12 Student / Teacher' && (
                      <Card className="border-2 border-cyan-300 bg-gradient-to-r from-cyan-50 to-white">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-cyan-600" />
                            Student Learning Mode 🌊
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            <strong>Welcome!</strong> Green means healthy water — good for fish and plants! Try changing time range to see a storm event.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md font-medium">Water Quality Basics</span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-medium">Interactive Gauges</span>
                            <span className="px-2 py-1 bg-cyan-100 text-cyan-800 text-xs rounded-md font-medium">Storm Events</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {userRole === 'College Student' && (
                      <Card className="border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-white">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-emerald-600" />
                            College Analysis Mode
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            <strong>Explore trends, % removal, and storm data.</strong> Export CSV for projects.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-md font-medium">Data Analysis</span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-medium">CSV Export</span>
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md font-medium">Storm Reports</span>
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-md font-medium">Trend Charts</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {userRole === 'Scientist / Researcher' && (
                      <Card className="border-2 border-violet-300 bg-gradient-to-r from-violet-50 to-white">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-violet-600" />
                            Researcher Mode
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            <strong>Raw data access, statistical summaries, manuscript generator</strong> (coming soon)
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-violet-100 text-violet-800 text-xs rounded-md font-medium">Raw Data</span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-medium">Statistical Analysis</span>
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md font-medium">Manuscript Gen</span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md font-medium">AI Insights</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {userRole === 'Corporate / ESG' && (
                      <Card className="border-2 border-teal-300 bg-gradient-to-r from-teal-50 to-white">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-teal-600" />
                            ESG Viewing Mode
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            <strong>Water Impact Score, risk metrics, sustainability reporting tools</strong> (coming soon)
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs rounded-md font-medium">Impact Score</span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-medium">Risk Metrics</span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md font-medium">ESG Reporting</span>
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-md font-medium">Sustainability</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!isPublicView && mounted && (
            <div suppressHydrationWarning>
              {userRole === 'Municipality / MS4' && (
                <Card className="border-2 border-blue-400 bg-gradient-to-br from-blue-50 via-white to-blue-50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      Municipal Compliance Tools
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700">
                      MS4 reporting, nutrient credits, grants
                    </p>
                  </CardContent>
                </Card>
              )}

              {userRole === 'K-12 Student / Teacher' && (
                <Card className="border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 via-white to-cyan-50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <BookOpen className="h-6 w-6 text-cyan-600" />
                      K-12 Project Ideas 🌟
                    </CardTitle>
                    <CardDescription>
                      Science Fair and STEM projects using real water quality data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-base text-cyan-800 mb-3 flex items-center gap-2">
                        <span className="text-lg">🔬</span> Science Fair Project Ideas
                      </h3>
                      <div className="space-y-4">
                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">How Does a Rainstorm Change Water Quality?</h4>
                          <p className="text-xs text-slate-600 mb-2">Compare water quality before, during, and after storm events. Use Pearl's time controls to see pollutant spikes.</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs rounded">NGSS MS-ESS3-3</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Storm Events Tab</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Do Green Infrastructure Projects Clean Water?</h4>
                          <p className="text-xs text-slate-600 mb-2">Test if rain gardens and bioswales reduce pollutants. Compare influent vs effluent data using % Removal mode.</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs rounded">NGSS MS-ETS1-1</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">% Removal Tab</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Which Pollutant Is Worst After a Storm?</h4>
                          <p className="text-xs text-slate-600 mb-2">Rank pollutants by concentration increase during storms. Export CSV data and create charts for your poster.</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs rounded">NGSS MS-ESS3-4</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Export CSV</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Can We Predict Algal Blooms?</h4>
                          <p className="text-xs text-slate-600 mb-2">Track nitrogen and phosphorus levels to predict when algae will grow. Use Trends Chart to find patterns.</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs rounded">NGSS MS-LS2-3</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Trends & Gauges</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">How Clean Is My Local Water?</h4>
                          <p className="text-xs text-slate-600 mb-2">Compare your region's water quality to EPA standards. Present findings with Pearl's gauges and scores.</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs rounded">NGSS HS-ESS3-4</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Regional Data</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base text-cyan-800 mb-3 flex items-center gap-2">
                        <span className="text-lg">🎯</span> General STEM Project Ideas
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">How Does Rain Affect Water Quality?</h4>
                          <p className="text-xs text-slate-600">Track pollutant changes during rainfall events</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Does Green Infrastructure Work?</h4>
                          <p className="text-xs text-slate-600">Compare water before/after BMPs</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Can We Predict Algal Blooms?</h4>
                          <p className="text-xs text-slate-600">Correlate nutrient levels with algae growth</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">What Happens to Oxygen After a Storm?</h4>
                          <p className="text-xs text-slate-600">Measure dissolved oxygen changes</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Is My Local Water Safe for Wildlife?</h4>
                          <p className="text-xs text-slate-600">Compare pollutants to wildlife thresholds</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">How Effective Are Stormwater BMPs?</h4>
                          <p className="text-xs text-slate-600">Calculate % removal efficiency</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-cyan-100 p-3 rounded-lg border border-cyan-300">
                      <p className="text-xs text-cyan-900">
                        <strong>💡 Pro Tip:</strong> Use Pearl's Export CSV button to download data for graphs. Switch between Ambient, In/Effluent, and % Removal modes to explore different angles!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {userRole === 'College Student' && (
                <Card className="border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-emerald-600" />
                      College Analysis Mode
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700">
                      Explore trends, % removal, export data
                    </p>
                  </CardContent>
                </Card>
              )}

              {userRole === 'Scientist / Researcher' && (
                <Card className="border-2 border-violet-400 bg-gradient-to-br from-violet-50 via-white to-violet-50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-violet-600" />
                      Researcher Mode
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700">
                      Raw data, stats, manuscript tools (coming)
                    </p>
                  </CardContent>
                </Card>
              )}

              {userRole === 'Corporate / ESG' && (
                <Card className="border-2 border-teal-400 bg-gradient-to-br from-teal-50 via-white to-teal-50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-teal-600" />
                      ESG Viewing Mode
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700">
                      Water Impact Score, sustainability reporting (coming)
                    </p>
                  </CardContent>
                </Card>
              )}

              {userRole === 'NGO / Nonprofit' && (
                <Card className="border-2 border-green-400 bg-gradient-to-br from-green-50 via-white to-green-50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <BookOpen className="h-6 w-6 text-green-600" />
                      NGO & Advocacy Project Ideas 🌍
                    </CardTitle>
                    <CardDescription>
                      Eagle Scout and community service projects backed by real data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                        <h4 className="font-semibold text-base text-green-900 mb-2 flex items-center gap-2">
                          <span>🌱</span> Build and Monitor a Rain Garden for Local Water Quality
                        </h4>
                        <p className="text-sm text-slate-700 mb-3">
                          Design and install a rain garden in your community, then track its performance using Pearl's influent/effluent monitoring. Document pollutant removal rates to demonstrate environmental impact.
                        </p>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-green-800">Pearl Support:</span>
                            <p className="text-xs text-slate-600">Use % Removal mode to calculate BMP efficiency. Export baseline and post-installation data for your project report.</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-green-800">Community Impact:</span>
                            <p className="text-xs text-slate-600">Reduces stormwater runoff, improves local water quality, creates wildlife habitat</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-green-800">Getting Started:</span>
                            <p className="text-xs text-slate-600">1) Identify drainage area 2) Baseline water testing 3) Design & build 4) Monitor with Pearl data</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                        <h4 className="font-semibold text-base text-green-900 mb-2 flex items-center gap-2">
                          <span>📢</span> Create a Community Stormwater Awareness Campaign
                        </h4>
                        <p className="text-sm text-slate-700 mb-3">
                          Educate neighbors about stormwater pollution using Pearl's storm event data. Create infographics showing how local water quality changes during rain events.
                        </p>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-green-800">Pearl Support:</span>
                            <p className="text-xs text-slate-600">Use Storm Events tab to show before/after pollution spikes. Export trend charts for educational materials.</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-green-800">Community Impact:</span>
                            <p className="text-xs text-slate-600">Raises awareness, changes behavior, reduces pollution at the source</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-green-800">Getting Started:</span>
                            <p className="text-xs text-slate-600">1) Gather Pearl data 2) Design materials 3) Host info sessions 4) Distribute door hangers</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                        <h4 className="font-semibold text-base text-green-900 mb-2 flex items-center gap-2">
                          <span>💧</span> Install and Track a Simple BMP (Rain Barrel or Bioswale)
                        </h4>
                        <p className="text-sm text-slate-700 mb-3">
                          Partner with schools or parks to install low-cost BMPs like rain barrels. Use Pearl to demonstrate water volume reduction and pollutant capture over time.
                        </p>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-green-800">Pearl Support:</span>
                            <p className="text-xs text-slate-600">Compare ambient vs BMP-treated water. Track seasonal performance and calculate gallons diverted.</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-green-800">Community Impact:</span>
                            <p className="text-xs text-slate-600">Reduces runoff volume, demonstrates green infrastructure benefits, saves water</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-green-800">Getting Started:</span>
                            <p className="text-xs text-slate-600">1) Find partner site 2) Install BMP 3) Baseline testing 4) Monitor with Pearl quarterly</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                        <h4 className="font-semibold text-base text-green-900 mb-2 flex items-center gap-2">
                          <span>🧹</span> Organize a Stream Cleanup & Water Quality Baseline Study
                        </h4>
                        <p className="text-sm text-slate-700 mb-3">
                          Lead a stream cleanup event and establish a baseline water quality study for your watershed. Use Pearl data to identify pollution hotspots and track improvements.
                        </p>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-green-800">Pearl Support:</span>
                            <p className="text-xs text-slate-600">Document pre-cleanup conditions with regional Pearl data. Schedule follow-up monitoring to show improvement.</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-green-800">Community Impact:</span>
                            <p className="text-xs text-slate-600">Removes trash, restores habitat, establishes monitoring program, engages volunteers</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-green-800">Getting Started:</span>
                            <p className="text-xs text-slate-600">1) Scout cleanup site 2) Recruit volunteers 3) Baseline Pearl data 4) Execute cleanup 5) Monitor progress</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                        <h4 className="font-semibold text-base text-green-900 mb-2 flex items-center gap-2">
                          <span>🗺️</span> Develop a Neighborhood Pollution Reporting Map
                        </h4>
                        <p className="text-sm text-slate-700 mb-3">
                          Create an interactive map showing local water quality monitoring sites and pollution sources. Use Pearl data to identify priority areas for community action.
                        </p>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-green-800">Pearl Support:</span>
                            <p className="text-xs text-slate-600">Export CSV data for mapping. Use alerts to flag problem areas. Compare regional data across locations.</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-green-800">Community Impact:</span>
                            <p className="text-xs text-slate-600">Visualizes water quality, identifies problem areas, guides future projects, empowers citizens</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-green-800">Getting Started:</span>
                            <p className="text-xs text-slate-600">1) Gather Pearl data 2) Map monitoring sites 3) Add pollution sources 4) Share via website/social media</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-100 p-3 rounded-lg border border-green-300">
                      <p className="text-xs text-green-900">
                        <strong>🌟 Funding Tip:</strong> These projects qualify for Eagle Scout, Girl Scout Gold Award, service learning hours, and many grant programs. Use Pearl's data export to strengthen your project proposals!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {!isPublicView && mounted && (
            <div className="lg:hidden">
              <WeatherOverlay />
            </div>
          )}

          <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3">
            Showing data from{' '}
            <span className="font-medium text-blue-900" suppressHydrationWarning>
              {mounted && (timeMode === 'real-time'
                ? new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleString()
                : startDate && new Date(startDate).toLocaleString())}
            </span>{' '}
            to{' '}
            <span className="font-medium text-blue-900" suppressHydrationWarning>
              {mounted && (timeMode === 'real-time' ? new Date().toLocaleString() : endDate && new Date(endDate).toLocaleString())}
            </span>
            . Older readings omitted to focus on recent conditions.
          </div>

          {selectedRegion && (
            <DataSourceDisclaimer
              hasPearlData={selectedRegion.hasPearlData}
              dataSource={selectedRegion.dataSource}
              regionName={selectedRegion.name}
            />
          )}

          {isPublicView && (
            <Card className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Eye className="h-8 w-8 text-blue-600" />
                    <div>
                      <h3 className="text-lg font-bold text-blue-900">Public Transparency Mode</h3>
                      <p className="text-sm text-slate-700">
                        Viewing simplified water quality data for community access. Technical features,
                        compliance reports, and professional tools are hidden.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-blue-200">
                    <div className="bg-white/60 rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Droplets className="h-5 w-5 text-blue-600" />
                        <span className="text-xs font-semibold text-blue-900">Water Quality This Year</span>
                      </div>
                      <p className="text-lg font-bold text-blue-900">
                        {removalEfficiencies.TSS.toFixed(0)}% TSS removal
                      </p>
                      <p className="text-xs text-slate-600">Cleaner water for the Bay</p>
                    </div>

                    <div className="bg-white/60 rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <span className="text-xs font-semibold text-blue-900">Overall Score</span>
                      </div>
                      <p className="text-lg font-bold text-blue-900">
                        {overallScore}/100
                      </p>
                      <p className="text-xs text-slate-600">
                        {overallScore >= 85 ? 'Excellent' : overallScore >= 70 ? 'Good' : 'Monitoring'} water quality
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {detectedStormEvent && !stormDetectionDismissed && (
            <StormDetectionBanner
              detectedEvent={detectedStormEvent}
              onDismiss={() => setStormDetectionDismissed(true)}
            />
          )}

          <WaterQualityAlerts
            alerts={waterQualityAlerts}
            onDismiss={handleDismissAlert}
            dismissedAlerts={dismissedAlerts}
          />

          <AlertsBanner
            data={dataMode === 'ambient' ? data : dataMode === 'storm-event' ? selectedStormEvent.effluent : effluentData}
            dataMode={dataMode}
            removalEfficiencies={dataMode === 'storm-event' ? selectedStormEvent.removalEfficiencies : removalEfficiencies}
          />

          {wildlifePerspective && mounted && (
            <Card className="border-2 border-cyan-400 bg-gradient-to-r from-cyan-50 via-blue-50 to-cyan-50 shadow-lg">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">🦪🐟🦀</span>
                  <div>
                    <h3 className="text-lg font-bold text-cyan-900">
                      Hey from the oysters, crabs, and fish in {selectedRegion?.name || 'the Bay'}!
                    </h3>
                    <p className="text-sm text-slate-700 mt-1">
                      Here's how our water feels today. We translated the science stuff into our language so you can see it from our perspective!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {dataMode === 'ambient' && !showComparison && !showNutrientCredits && !showESG && !showManuscript && (
            <Card className="border-2">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl">{data.location}</CardTitle>
                    <CardDescription suppressHydrationWarning>
                      Last updated: {mounted && data.timestamp.toLocaleString()}
                    </CardDescription>
                  </div>
                  <div className="text-center sm:text-right">
                    <div className="text-sm text-muted-foreground mb-1">Overall Score</div>
                    <div
                      className={`text-5xl font-bold ${
                        overallScore >= 80
                          ? 'text-green-600'
                          : overallScore >= 60
                          ? 'text-emerald-600'
                          : overallScore >= 40
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {overallScore}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {overallScore >= 80
                        ? 'Excellent'
                        : overallScore >= 60
                        ? 'Good'
                        : overallScore >= 40
                        ? 'Fair'
                        : 'Poor'}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <Card className="border shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-200">
                    <CardContent className="pt-6">
                      <WaterQualityGauge parameter={data.parameters.DO} dataSource={selectedRegion?.dataSource} wildlifePerspective={wildlifePerspective} />
                    </CardContent>
                  </Card>

                  <Card className="border shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-200">
                    <CardContent className="pt-6">
                      <WaterQualityGauge parameter={data.parameters.turbidity} dataSource={selectedRegion?.dataSource} wildlifePerspective={wildlifePerspective} />
                    </CardContent>
                  </Card>

                  <Card className="border shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-200">
                    <CardContent className="pt-6">
                      <WaterQualityGauge parameter={data.parameters.TN} dataSource={selectedRegion?.dataSource} wildlifePerspective={wildlifePerspective} />
                    </CardContent>
                  </Card>

                  <Card className="border shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-200">
                    <CardContent className="pt-6">
                      <WaterQualityGauge parameter={data.parameters.TP} dataSource={selectedRegion?.dataSource} wildlifePerspective={wildlifePerspective} />
                    </CardContent>
                  </Card>

                  <Card className="border shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-200">
                    <CardContent className="pt-6">
                      <WaterQualityGauge parameter={data.parameters.TSS} dataSource={selectedRegion?.dataSource} wildlifePerspective={wildlifePerspective} />
                    </CardContent>
                  </Card>

                  <Card className="border shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-200">
                    <CardContent className="pt-6">
                      <WaterQualityGauge parameter={data.parameters.salinity} dataSource={selectedRegion?.dataSource} wildlifePerspective={wildlifePerspective} />
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}

          {dataMode === 'ambient' && !showComparison && !showNutrientCredits && !showESG && !showManuscript && !isPublicView && (
            <>
              {userRole !== 'K-12 Student / Teacher' && userRole !== 'College Student' && (
                <TMDLProgressAndReportGenerator
                  regionId={selectedRegionId}
                  removalEfficiencies={removalEfficiencies}
                  stormEvents={stormEvents}
                  alertCount={waterQualityAlerts.length}
                  overallScore={overallScore}
                  dateRange={{
                    start: startDate,
                    end: endDate
                  }}
                />
              )}
              <WildlifeImpactDisclaimer />
              {shouldShowEJImpact() && (
                <EnvironmentalJusticeImpact
                  regionId={selectedRegionId}
                  regionName={selectedRegion?.name || ''}
                  parameters={Object.values(data.parameters)}
                />
              )}
            </>
          )}

          {dataMode === 'influent-effluent' && !showNutrientCredits && !showESG && !showManuscript && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                      Raw Influent
                    </CardTitle>
                    <CardDescription>Incoming wastewater</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(influentData.parameters).map(([key, param]) => (
                        <Card key={key} className="border shadow-lg hover:shadow-xl transition-all">
                          <CardContent className="pt-6">
                            <WaterQualityGauge parameter={param} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-white">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      Treated Effluent
                    </CardTitle>
                    <CardDescription>Discharge to bay - with % removal</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(effluentData.parameters).map(([key, param]) => {
                        const paramKey = key as keyof typeof influentData.parameters;
                        const influentValue = influentData.parameters[paramKey].value;
                        const effluentValue = param.value;
                        const efficiency = removalEfficiencies[paramKey];
                        const removalDisplay = calculateRemovalDisplay(key, influentValue, effluentValue, efficiency);

                        return (
                          <Card key={key} className="border shadow-lg hover:shadow-xl transition-all">
                            <CardContent className="pt-6">
                              <WaterQualityGauge
                                parameter={param}
                                removalInfo={removalDisplay}
                              />
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <RemovalSummaryCard
                influentData={influentData}
                effluentData={effluentData}
                removalEfficiencies={removalEfficiencies}
              />
            </div>
          )}

          {dataMode === 'removal-efficiency' && !showNutrientCredits && !showESG && !showManuscript && (
            <Card className="border-2 border-blue-300">
              <CardHeader>
                <CardTitle className="text-2xl">Treatment Performance Summary</CardTitle>
                <CardDescription>
                  Percentage change from raw influent to treated effluent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <RemovalEfficiencyGauge
                    parameterName="Dissolved Oxygen"
                    influentValue={influentData.parameters.DO.value}
                    effluentValue={effluentData.parameters.DO.value}
                    efficiency={removalEfficiencies.DO}
                    unit="mg/L"
                    effluentParameter={effluentData.parameters.DO}
                  />
                  <RemovalEfficiencyGauge
                    parameterName="Turbidity"
                    influentValue={influentData.parameters.turbidity.value}
                    effluentValue={effluentData.parameters.turbidity.value}
                    efficiency={removalEfficiencies.turbidity}
                    unit="NTU"
                    effluentParameter={effluentData.parameters.turbidity}
                  />
                  <RemovalEfficiencyGauge
                    parameterName="Total Nitrogen"
                    influentValue={influentData.parameters.TN.value}
                    effluentValue={effluentData.parameters.TN.value}
                    efficiency={removalEfficiencies.TN}
                    unit="mg/L"
                    effluentParameter={effluentData.parameters.TN}
                  />
                  <RemovalEfficiencyGauge
                    parameterName="Total Phosphorus"
                    influentValue={influentData.parameters.TP.value}
                    effluentValue={effluentData.parameters.TP.value}
                    efficiency={removalEfficiencies.TP}
                    unit="mg/L"
                    effluentParameter={effluentData.parameters.TP}
                  />
                  <RemovalEfficiencyGauge
                    parameterName="Total Suspended Solids"
                    influentValue={influentData.parameters.TSS.value}
                    effluentValue={effluentData.parameters.TSS.value}
                    efficiency={removalEfficiencies.TSS}
                    unit="mg/L"
                    effluentParameter={effluentData.parameters.TSS}
                  />
                  <RemovalEfficiencyGauge
                    parameterName="Salinity"
                    influentValue={influentData.parameters.salinity.value}
                    effluentValue={effluentData.parameters.salinity.value}
                    efficiency={removalEfficiencies.salinity}
                    unit="ppt"
                    effluentParameter={effluentData.parameters.salinity}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {dataMode === 'storm-event' && !showNutrientCredits && !showESG && !showManuscript && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-100 via-cyan-50 to-blue-100 border-2 border-blue-300 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <CloudRain className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-blue-900 mb-2">
                      Municipal Stormwater BMP Performance Monitoring
                    </h3>
                    <p className="text-sm text-blue-800 leading-relaxed">
                      This view supports MS4 permit requirements for Best Management Practice (BMP) performance monitoring and TMDL load reduction documentation during stormwater events. Data demonstrates pollutant removal efficiency from storm runoff entering the BMP (influent) to treated discharge (effluent).
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <div className="bg-white rounded px-3 py-1 border border-blue-200">
                        <span className="font-semibold text-blue-900">Target:</span>
                        <span className="text-blue-700 ml-2">&gt;80% TSS removal</span>
                      </div>
                      <div className="bg-white rounded px-3 py-1 border border-blue-200">
                        <span className="font-semibold text-blue-900">Target:</span>
                        <span className="text-blue-700 ml-2">&gt;60% nutrient removal</span>
                      </div>
                      <div className="bg-white rounded px-3 py-1 border border-blue-200">
                        <span className="font-semibold text-blue-900">Compliance:</span>
                        <span className="text-blue-700 ml-2">NPDES/MS4 standards</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-white">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                      Influent (Raw Stormwater Runoff)
                    </CardTitle>
                    <CardDescription>
                      Uncontrolled runoff entering BMP - {selectedStormEvent.rainfall} event
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.values(selectedStormEvent.influent.parameters).map((param, idx) => (
                        <Card key={idx} className="border shadow-lg hover:shadow-xl transition-all">
                          <CardContent className="pt-6">
                            <WaterQualityGauge parameter={param} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-white">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      Effluent (BMP Treated Discharge)
                    </CardTitle>
                    <CardDescription>
                      Controlled discharge meeting permit limits
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.values(selectedStormEvent.effluent.parameters).map((param, idx) => (
                        <Card key={idx} className="border shadow-lg hover:shadow-xl transition-all">
                          <CardContent className="pt-6">
                            <WaterQualityGauge parameter={param} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-2 border-blue-300">
                <CardHeader>
                  <CardTitle className="text-xl">Paired Sample Analysis & % Removal Documentation</CardTitle>
                  <CardDescription>
                    Event-specific influent vs effluent comparison for MS4/TMDL reporting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StormEventTable event={selectedStormEvent} />
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white">
                <CardHeader>
                  <CardTitle className="text-xl">BMP Treatment Performance Summary</CardTitle>
                  <CardDescription>
                    Percentage change for each parameter during {selectedStormEvent.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <RemovalEfficiencyGauge
                      parameterName="Dissolved Oxygen"
                      influentValue={selectedStormEvent.influent.parameters.DO.value}
                      effluentValue={selectedStormEvent.effluent.parameters.DO.value}
                      efficiency={selectedStormEvent.removalEfficiencies.DO}
                      unit="mg/L"
                      effluentParameter={selectedStormEvent.effluent.parameters.DO}
                    />
                    <RemovalEfficiencyGauge
                      parameterName="Turbidity"
                      influentValue={selectedStormEvent.influent.parameters.turbidity.value}
                      effluentValue={selectedStormEvent.effluent.parameters.turbidity.value}
                      efficiency={selectedStormEvent.removalEfficiencies.turbidity}
                      unit="NTU"
                      effluentParameter={selectedStormEvent.effluent.parameters.turbidity}
                    />
                    <RemovalEfficiencyGauge
                      parameterName="Total Nitrogen"
                      influentValue={selectedStormEvent.influent.parameters.TN.value}
                      effluentValue={selectedStormEvent.effluent.parameters.TN.value}
                      efficiency={selectedStormEvent.removalEfficiencies.TN}
                      unit="mg/L"
                      effluentParameter={selectedStormEvent.effluent.parameters.TN}
                    />
                    <RemovalEfficiencyGauge
                      parameterName="Total Phosphorus"
                      influentValue={selectedStormEvent.influent.parameters.TP.value}
                      effluentValue={selectedStormEvent.effluent.parameters.TP.value}
                      efficiency={selectedStormEvent.removalEfficiencies.TP}
                      unit="mg/L"
                      effluentParameter={selectedStormEvent.effluent.parameters.TP}
                    />
                    <RemovalEfficiencyGauge
                      parameterName="Total Suspended Solids"
                      influentValue={selectedStormEvent.influent.parameters.TSS.value}
                      effluentValue={selectedStormEvent.effluent.parameters.TSS.value}
                      efficiency={selectedStormEvent.removalEfficiencies.TSS}
                      unit="mg/L"
                      effluentParameter={selectedStormEvent.effluent.parameters.TSS}
                    />
                    <RemovalEfficiencyGauge
                      parameterName="Salinity"
                      influentValue={selectedStormEvent.influent.parameters.salinity.value}
                      effluentValue={selectedStormEvent.effluent.parameters.salinity.value}
                      efficiency={selectedStormEvent.removalEfficiencies.salinity}
                      unit="ppt"
                      effluentParameter={selectedStormEvent.effluent.parameters.salinity}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {showNutrientCredits && !isPublicView && (
            <NutrientCreditsTrading
              stormEvents={stormEvents}
              influentData={influentData}
              effluentData={effluentData}
              removalEfficiencies={removalEfficiencies}
              timeRange={{
                start: new Date(startDate || Date.now() - 7 * 24 * 60 * 60 * 1000),
                end: new Date(endDate || Date.now())
              }}
            />
          )}

          {showESG && !isPublicView && (
            <ESGImpactReporting
              data={data}
              regionName={selectedRegion?.name || ''}
              removalEfficiencies={removalEfficiencies}
              ejMetrics={ejMetrics}
              alertCount={waterQualityAlerts.length}
              isPublicView={isPublicView}
            />
          )}

          {showManuscript && !isPublicView && (
            <ManuscriptGenerator
              data={data}
              regionName={selectedRegion?.name || ''}
              removalEfficiencies={removalEfficiencies}
              isEJArea={ejMetrics?.isEJArea}
            />
          )}

          {dataMode === 'ambient' && showComparison && !showNutrientCredits && !showESG && !showManuscript && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-blue-300">
                <CardHeader>
                  <CardTitle className="text-xl">Current Period</CardTitle>
                  <CardDescription>Most recent readings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(data.parameters).map(([key, param]) => {
                      const prevValue = (previousPeriodData.parameters as any)[key].value;
                      const change = calculateChange(param.value, prevValue);
                      const isWorse =
                        (param.type === 'increasing-bad' && param.value > prevValue) ||
                        (param.type === 'decreasing-bad' && param.value < prevValue);

                      return (
                        <Card key={key} className="border shadow-lg">
                          <CardContent className="pt-6">
                            <WaterQualityGauge parameter={param} />
                            <div className="text-center mt-2">
                              <span
                                className={`text-sm font-semibold ${
                                  isWorse ? 'text-red-600' : 'text-green-600'
                                }`}
                              >
                                {change > '0' ? '+' : ''}
                                {change}%
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-300">
                <CardHeader>
                  <CardTitle className="text-xl">Previous Period</CardTitle>
                  <CardDescription>Comparison baseline (30 days ago)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(previousPeriodData.parameters).map(([key, param]) => (
                      <Card key={key} className="border shadow-lg">
                        <CardContent className="pt-6">
                          <WaterQualityGauge parameter={param} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!isPublicView && !showNutrientCredits && !showESG && !showManuscript && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-xl">Parameter Trends Over Time</CardTitle>
                <CardDescription>
                  {timeMode === 'real-time'
                    ? 'Last 24 hours of continuous monitoring data'
                    : 'Custom time range historical data'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendsChart data={data} />
              </CardContent>
            </Card>
          )}

          {!isPublicView && !showNutrientCredits && !showESG && !showManuscript && shouldShowAIInsights() && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <span className="text-2xl">🤖</span> AI Trends & Predictions
                </CardTitle>
                <CardDescription>
                  Automated analysis based on current readings and recent trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AIInsights
                data={dataMode === 'storm-event' ? selectedStormEvent.effluent : data}
                dataMode={dataMode}
                removalEfficiencies={dataMode === 'storm-event' ? selectedStormEvent.removalEfficiencies : removalEfficiencies}
                stormEventName={dataMode === 'storm-event' ? selectedStormEvent.name : undefined}
                stormRainfall={dataMode === 'storm-event' ? selectedStormEvent.rainfall : undefined}
                detectedStormEvent={detectedStormEvent}
                alerts={waterQualityAlerts}
                dataSource={selectedRegion?.dataSource}
              />
            </CardContent>
          </Card>
          )}

          {!isPublicView && dataMode === 'ambient' && !showNutrientCredits && !showESG && !showManuscript && (
            <div suppressHydrationWarning>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {shouldShowROICalculator() && (
                  <ROISavingsCalculator
                    stormEventsMonitored={stormEvents.length}
                    regionId={selectedRegionId}
                  />
                )}

                {shouldShowPeerBenchmarking() && (
                  <PeerBenchmarking
                    removalEfficiencies={removalEfficiencies}
                    regionId={selectedRegionId}
                  />
                )}
              </div>

              {shouldShowGrantMatcher() && (
                <GrantOpportunityMatcher
                  regionId={selectedRegionId}
                  removalEfficiencies={removalEfficiencies}
                  alertsCount={waterQualityAlerts.filter(a => !dismissedAlerts.has(a.id)).length}
                />
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="font-semibold mb-2">Water Quality Standards - {selectedRegion?.name}</p>
            <p>
              {selectedRegionId === 'florida_escambia' && (
                <>
                  All thresholds align with Florida Administrative Code Chapter 62-302 for Class II/III marine waters.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L for healthy aquatic life; turbidity and nutrient targets based on site-specific
                  natural background levels and estuary-specific numeric nutrient criteria. Data collected via automated monitoring stations
                  with QAPP-certified instrumentation. For technical details, visit{' '}
                  <a href="https://floridadep.gov/water" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    floridadep.gov/water
                  </a>
                </>
              )}
              {selectedRegionId === 'california_sf_bay' && (
                <>
                  Thresholds based on California Regional Water Quality Control Board standards for San Francisco Bay.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L (stricter than federal standards);
                  nutrient criteria align with site-specific Basin Plan objectives and TMDL requirements.
                  Monitoring follows Surface Water Ambient Monitoring Program (SWAMP) protocols.
                </>
              )}
              {selectedRegionId === 'maryland_middle_branch' && (
                <>
                  Thresholds based on Maryland/Chesapeake Bay Program water quality standards for tidal Patapsco River.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L for open-water designated use;
                  nutrient criteria align with Chesapeake Bay TMDL allocations and Maryland's Biological Stressor Policy.
                  Monitoring follows Eyes on the Bay continuous monitoring protocols. See{' '}
                  <a href="https://mde.maryland.gov/programs/water" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    Maryland DNR Water Quality
                  </a>
                </>
              )}
              {selectedRegionId === 'dc_anacostia' && (
                <>
                  Standards based on District of Columbia Water Quality Standards for Class B tidal rivers.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L for aquatic life support;
                  nutrient and TSS criteria support Anacostia River TMDL requirements.
                  Monitoring conducted through DC DOEE ambient network. Pearl deployment planned 2026 Q3.
                </>
              )}
              {selectedRegionId === 'maryland_inner_harbor' && (
                <>
                  Thresholds based on Maryland tidal harbor standards for Class II estuarine waters.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L for seasonal hypoxia prevention;
                  nutrient criteria support Baltimore Harbor improvement goals.
                  Data from Maryland Eyes on the Bay network. Pearl deployment planned 2026 Q4.
                </>
              )}
              {selectedRegionId === 'eu_generic' && (
                <>
                  Standards compliant with EU Water Framework Directive (2000/60/EC) for transitional waters.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L for "Good" ecological status;
                  nutrient and clarity thresholds support achievement of type-specific biological quality elements.
                  Assessment follows Common Implementation Strategy guidance.
                </>
              )}
            </p>
          </div>

          <DataSourceFooter />
        </div>
      </div>
    </div>
  );
}

