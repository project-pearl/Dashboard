'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, ExternalLink, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';

interface GrantOpportunityMatcherProps {
  regionId: string;
  removalEfficiencies: Record<string, number>;
  alertsCount: number;
}

interface Grant {
  id: string;
  name: string;
  agency: string;
  amount: string;
  deadline: string;
  matchScore: number;
  requirements: string[];
  url: string;
  status: 'open' | 'closing-soon' | 'upcoming';
  deadlineDate?: Date;
  daysRemaining?: number | null;
}

export function GrantOpportunityMatcher({
  regionId,
  removalEfficiencies,
  alertsCount
}: GrantOpportunityMatcherProps) {

  const isChesapeake = regionId.includes('maryland') || regionId.includes('dc');
  const isCoastal = regionId.includes('florida') || regionId.includes('california');

  const hasHighPerformance = removalEfficiencies.TSS >= 85 && removalEfficiencies.TN >= 75;
  const hasCompliance = alertsCount <= 2;

  const calculateDaysRemaining = (deadlineStr: string): number | null => {
    if (deadlineStr.toLowerCase().includes('rolling')) {
      return null;
    }
    try {
      const deadline = new Date(deadlineStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = deadline.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return null;
    }
  };

  const getGrantStatus = (daysRemaining: number | null | undefined): 'open' | 'closing-soon' | 'upcoming' => {
    if (daysRemaining === null || daysRemaining === undefined) return 'open';
    if (daysRemaining < 90) return 'closing-soon';
    return 'open';
  };

  const grants: Grant[] = [
    ...(isChesapeake ? [{
      id: 'cbp-2026',
      name: 'Chesapeake Bay Program Implementation Grant',
      agency: 'EPA Chesapeake Bay Program',
      amount: '$150,000 - $500,000',
      deadline: 'April 15, 2026',
      matchScore: 95,
      requirements: [
        'Urban stormwater BMP implementation',
        'Real-time water quality monitoring',
        'Nutrient reduction documentation (your TN removal: ' + removalEfficiencies.TN.toFixed(1) + '%)',
      ],
      url: 'https://www.epa.gov/chesapeake-bay-tmdl',
      status: 'open' as const,
      deadlineDate: new Date('April 15, 2026'),
      daysRemaining: calculateDaysRemaining('April 15, 2026')
    }] : []),

    {
      id: 'epa-wetlands',
      name: 'Wetland Program Development Grant',
      agency: 'EPA Office of Water',
      amount: '$75,000 - $1,000,000',
      deadline: 'March 30, 2026',
      matchScore: hasHighPerformance ? 88 : 72,
      requirements: [
        'Water quality monitoring systems',
        'Constructed wetland BMPs',
        'Data-driven adaptive management',
      ],
      url: 'https://www.epa.gov/wetlands/wetland-program-development-grants',
      status: 'open' as const,
      deadlineDate: new Date('March 30, 2026'),
      daysRemaining: calculateDaysRemaining('March 30, 2026')
    },

    ...(isCoastal ? [{
      id: 'noaa-coastal',
      name: 'NOAA Coastal Resilience Grant',
      agency: 'NOAA Office for Coastal Management',
      amount: '$250,000 - $2,000,000',
      deadline: 'May 20, 2026',
      matchScore: 85,
      requirements: [
        'Coastal water quality monitoring',
        'Nature-based infrastructure',
        'Community engagement and public data',
      ],
      url: 'https://coast.noaa.gov/funding',
      status: 'open' as const,
      deadlineDate: new Date('May 20, 2026'),
      daysRemaining: calculateDaysRemaining('May 20, 2026')
    }] : []),

    {
      id: 'nfwf-stormwater',
      name: 'National Fish and Wildlife Foundation - Stormwater Innovation',
      agency: 'NFWF / EPA Partnership',
      amount: '$100,000 - $750,000',
      deadline: 'June 1, 2026',
      matchScore: hasHighPerformance ? 92 : 78,
      requirements: [
        'Green infrastructure implementation',
        'Performance monitoring with documented removal rates',
        '1:1 match requirement (in-kind accepted)',
      ],
      url: 'https://www.nfwf.org',
      status: 'open' as const,
      deadlineDate: new Date('June 1, 2026'),
      daysRemaining: calculateDaysRemaining('June 1, 2026')
    },

    {
      id: 'water-infrastructure',
      name: 'Clean Water State Revolving Fund (CWSRF)',
      agency: 'State Environmental Agency',
      amount: 'Up to $5,000,000',
      deadline: 'Rolling applications',
      matchScore: hasCompliance ? 90 : 65,
      requirements: [
        'MS4 permit compliance',
        'Demonstrated pollutant reduction (TSS: ' + removalEfficiencies.TSS.toFixed(1) + '%)',
        'Asset management plan',
      ],
      url: 'https://www.epa.gov/cwsrf',
      status: 'open' as const,
      daysRemaining: null
    },

    {
      id: 'thriving-communities',
      name: 'EPA Thriving Communities Grantmaking Program',
      agency: 'EPA Environmental Justice',
      amount: '$500,000 - $5,000,000',
      deadline: 'August 12, 2026',
      matchScore: 80,
      requirements: [
        'Disadvantaged community benefits',
        'Water quality improvements',
        'Community partnership',
      ],
      url: 'https://www.epa.gov/environmentaljustice/thriving-communities-grantmaking-program',
      status: 'open' as const,
      deadlineDate: new Date('August 12, 2026'),
      daysRemaining: calculateDaysRemaining('August 12, 2026')
    },

    {
      id: 'esg-water-stewardship',
      name: 'Corporate ESG Water Stewardship Partnership',
      agency: 'Private Sector / NGO Collaboration',
      amount: '$50,000 - $300,000',
      deadline: 'September 30, 2026',
      matchScore: hasHighPerformance ? 88 : 70,
      requirements: [
        'ESG reporting framework (GRI/SASB)',
        'Documented water quality metrics',
        'Public transparency and data sharing',
        'Quantified environmental impact',
      ],
      url: 'https://www.unglobalcompact.org/take-action/action/water-stewardship',
      status: 'open' as const,
      deadlineDate: new Date('September 30, 2026'),
      daysRemaining: calculateDaysRemaining('September 30, 2026')
    },

    {
      id: 'sustainable-development',
      name: 'UN Sustainable Development Goals - Water Action',
      agency: 'International Development Partners',
      amount: '$100,000 - $1,000,000',
      deadline: 'October 15, 2026',
      matchScore: hasCompliance && hasHighPerformance ? 85 : 68,
      requirements: [
        'SDG 6 (Clean Water) alignment',
        'ESG performance documentation',
        'Multi-stakeholder partnerships',
        'Measurable impact metrics',
      ],
      url: 'https://sdgs.un.org/goals/goal6',
      status: 'open' as const,
      deadlineDate: new Date('October 15, 2026'),
      daysRemaining: calculateDaysRemaining('October 15, 2026')
    },
  ];

  const grantsWithDynamicStatus = grants.map(grant => ({
    ...grant,
    status: getGrantStatus(grant.daysRemaining)
  }));

  const sortedGrants = grantsWithDynamicStatus.sort((a, b) => {
    if (!a.deadlineDate && !b.deadlineDate) return b.matchScore - a.matchScore;
    if (!a.deadlineDate) return 1;
    if (!b.deadlineDate) return -1;
    return a.deadlineDate.getTime() - b.deadlineDate.getTime();
  });

  return (
    <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <Gift className="h-6 w-6" />
          Grant Opportunity Matcher
        </CardTitle>
        <CardDescription>
          Funding opportunities matched to your water quality performance and location
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-white p-4 rounded-lg border-2 border-amber-300 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-amber-600">
                {sortedGrants.filter(g => g.matchScore >= 80).length} High Matches
              </div>
              <div className="text-sm text-slate-600">
                Total potential funding: ${(sortedGrants.filter(g => g.matchScore >= 80).length * 500).toFixed(0)}K+
              </div>
            </div>
            {hasHighPerformance && hasCompliance && (
              <div className="text-right">
                <Badge className="bg-green-600 text-white">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Strong Candidate
                </Badge>
                <div className="text-xs text-slate-600 mt-1">
                  High performance + compliance
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {sortedGrants.map((grant) => (
            <div
              key={grant.id}
              className={`bg-white p-4 rounded-lg border-2 ${
                grant.matchScore >= 90 ? 'border-green-300' :
                grant.matchScore >= 80 ? 'border-blue-300' :
                'border-slate-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900">{grant.name}</h4>
                    {grant.status === 'closing-soon' && (
                      <Badge variant="destructive" className="text-xs">
                        Closing Soon
                      </Badge>
                    )}
                    {grant.status === 'upcoming' && (
                      <Badge variant="secondary" className="text-xs">
                        Upcoming
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">{grant.agency}</div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${
                    grant.matchScore >= 90 ? 'text-green-600' :
                    grant.matchScore >= 80 ? 'text-blue-600' :
                    'text-amber-600'
                  }`}>
                    {grant.matchScore}%
                  </div>
                  <div className="text-xs text-slate-600">match</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div className="flex items-center gap-1 text-slate-700">
                  <DollarSign className="h-3 w-3" />
                  <span className="font-semibold">{grant.amount}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  <Calendar className="h-3 w-3" />
                  <span>{grant.deadline}</span>
                </div>
              </div>

              <div className="space-y-1 mb-3">
                {grant.requirements.map((req, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{req}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 hover:bg-blue-50"
                onClick={() => window.open(grant.url, '_blank')}
              >
                <ExternalLink className="h-3 w-3" />
                View Grant Details & Apply
              </Button>
            </div>
          ))}
        </div>

        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mt-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-2">Application Tip</h4>
          <p className="text-xs text-slate-600">
            Your Pearl real-time monitoring data provides strong evidence for grant applications.
            Use the MS4 Report Generator to create documentation showing:
            {' '}<span className="font-semibold">
              {removalEfficiencies.TSS.toFixed(1)}% TSS removal,
              {' '}{removalEfficiencies.TN.toFixed(1)}% nitrogen reduction,
            </span> and continuous compliance monitoring. This data significantly strengthens
            funding applications compared to traditional quarterly sampling.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
