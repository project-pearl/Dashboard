'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ExternalLink, Mail } from 'lucide-react';
import { getStateGrants, STATE_AUTHORITIES } from '@/lib/stateWaterData';
import type { GrantOpportunity } from '@/lib/stateWaterData';

interface Grant {
  name: string;
  agency: string;
  amount: string;
  amountMax: number;
  fit: 'High' | 'Good' | 'Review';
  deadline: string;
  filing_date?: string;
  description: string;
  url: string;
  badge?: string;
}

interface GrantOpportunityMatcherProps {
  regionId: string;
  removalEfficiencies: Record<string, number>;
  alertsCount: number;
  userRole?: string;
  stateAbbr?: string;
}

// ─── Derive state abbreviation from regionId ──────────────────────────────────

const PREFIX_MAP: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', dc: 'DC', florida: 'FL',
  georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN',
  iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME',
  maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  newhampshire: 'NH', newjersey: 'NJ', newmexico: 'NM', newyork: 'NY',
  northcarolina: 'NC', northdakota: 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', rhodeisland: 'RI', southcarolina: 'SC', southdakota: 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', westvirginia: 'WV', wisconsin: 'WI', wyoming: 'WY',
};

function getStateFromRegion(regionId: string): string {
  if (regionId.includes('chesapeake')) return 'MD';
  const prefix = regionId.split('_')[0];
  return PREFIX_MAP[prefix] || 'MD';
}

// ─── State names for display ──────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',
  DE:'Delaware',DC:'Washington DC',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',
  IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
  MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',
  NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',
  NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',
  RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',
  VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};

// ─── Convert stateWaterData grants → local Grant interface ────────────────────

function mapStateGrant(g: GrantOpportunity): Grant {
  return {
    name: g.name,
    agency: g.source,
    amount: g.amount,
    amountMax: g.maxAmount * 1000, // stateWaterData stores in thousands
    fit: g.fit === 'high' ? 'High' : g.fit === 'medium' ? 'Good' : 'Review',
    deadline: g.deadline || 'Rolling / Check agency',
    description: g.description,
    url: g.url,
  };
}

// ─── Role-specific NATIONAL grants (not state-dependent) ──────────────────────

const NATIONAL_MS4_GRANTS: Grant[] = [
  {
    name: 'NOAA Transformational Habitat Restoration & Coastal Resilience (BIL)',
    agency: 'NOAA / Bipartisan Infrastructure Law',
    amount: '$750K–$10M (typical: $4M–$6M)',
    amountMax: 10000000,
    url: 'https://www.fisheries.noaa.gov/grant/transformational-habitat-restoration-and-coastal-resilience-grants',
    fit: 'High',
    deadline: 'Annual – Spring (FY26 expected Fall 2025)',
    description: 'Oyster-based water quality + coastal resilience with measurable outcomes. Strong fit when paired with sanctuary/municipal partners and Justice40 benefits. PEARL = living infrastructure + continuous monitoring.',
    badge: 'BIL - $10M Max',
  },
  {
    name: 'NFWF National Coastal Resilience Fund (NCRF)',
    agency: 'National Fish & Wildlife Foundation',
    amount: '$1M–$10M (no hard cap)',
    amountMax: 10000000,
    url: 'https://www.nfwf.org/programs/national-coastal-resilience-fund',
    fit: 'High',
    deadline: 'Annual – Winter',
    description: 'Nature-based solutions (oyster reefs, living shorelines) that reduce flood risk and improve habitat. Match not required (encouraged). PEARL vessel-mounted oyster modules qualify as nature-based infrastructure.',
    badge: 'BIL - No Match Required',
  },
  {
    name: 'EDA Build Back Better Regional Challenge - Implementation',
    agency: 'Economic Development Administration / U.S. Dept of Commerce',
    amount: '$2M–$20M+ (construction awards)',
    amountMax: 20000000,
    url: 'https://www.eda.gov/funding/programs/american-rescue-plan/build-back-better',
    fit: 'Good',
    deadline: 'Rolling until funds exhausted',
    description: 'Port/harbor water-quality infrastructure, workforce training around marine restoration tech. Requires disaster-designation nexus and economic development case (jobs, private co-investment). PEARL = blue economy jobs + infrastructure.',
    badge: 'Economic Development',
  },
  {
    name: 'NSF SBIR Phase I / II',
    agency: 'National Science Foundation',
    amount: '$275K / $1.5M',
    amountMax: 1500000,
    url: 'https://www.nsf.gov/eng/iip/sbir/',
    fit: 'High',
    deadline: 'Rolling',
    description: 'Technology innovation for water treatment. Three provisional patents and Milton FL pilot validation make this a strong match.',
    badge: 'Pilot Validated',
  },
  {
    name: 'NOAA Habitat Restoration — Community-based',
    agency: 'NOAA Restoration Center',
    amount: '$100K–$5M',
    amountMax: 5000000,
    url: 'https://www.fisheries.noaa.gov/grant/noaa-community-based-restoration-program',
    fit: 'High',
    deadline: 'Annual – varies',
    description: 'Coastal ecosystem restoration. Oyster integration strengthens the application. Nature-based solutions with monitoring data preferred.',
  },
];

const NATIONAL_NGO_GRANTS: Grant[] = [
  {
    name: 'NOAA Transformational Habitat Restoration (BIL)',
    agency: 'NOAA / Bipartisan Infrastructure Law',
    amount: '$750K–$10M',
    amountMax: 10000000,
    url: 'https://www.fisheries.noaa.gov/grant/transformational-habitat-restoration-and-coastal-resilience-grants',
    fit: 'High',
    deadline: 'Annual – Spring',
    description: 'Large-scale habitat restoration with measurable outcomes. Oyster biofiltration + continuous monitoring aligns with BIL priorities for nature-based infrastructure.',
    badge: 'BIL',
  },
  {
    name: 'NFWF National Coastal Resilience Fund',
    agency: 'National Fish & Wildlife Foundation',
    amount: '$1M–$10M',
    amountMax: 10000000,
    url: 'https://www.nfwf.org/programs/national-coastal-resilience-fund',
    fit: 'High',
    deadline: 'Annual – Winter',
    description: 'Nature-based flood risk reduction and habitat restoration. No match required. PEARL living infrastructure approach is a strong fit.',
  },
  {
    name: 'NFWF Five Star & Urban Waters Restoration',
    agency: 'National Fish & Wildlife Foundation',
    amount: '$20K–$50K',
    amountMax: 50000,
    url: 'https://www.nfwf.org/programs/five-star-and-urban-waters-restoration-grant-program',
    fit: 'High',
    deadline: 'Annual – Spring',
    description: 'On-the-ground restoration and community stewardship for urban waterways. Hands-on volunteer engagement. PEARL monitoring at restoration sites provides measurable outcomes.',
  },
  {
    name: 'EPA Environmental Education Grants',
    agency: 'EPA Office of Environmental Education',
    amount: '$50K–$100K',
    amountMax: 100000,
    url: 'https://www.epa.gov/education/grants',
    fit: 'Good',
    deadline: 'Annual – varies',
    description: 'Environmental education and community engagement. PEARL STEM educational integration with water quality data aligns with EPA education priorities.',
  },
];

const NATIONAL_K12_GRANTS: Grant[] = [
  {
    name: 'NSF Discovery Research PreK-12 (DRK-12)',
    agency: 'National Science Foundation',
    amount: '$300K–$3M',
    amountMax: 3000000,
    url: 'https://www.nsf.gov/funding/pgm_summ.jsp?pims_id=500047',
    fit: 'High',
    deadline: 'Annual – November',
    description: 'STEM education research using real environmental data. PEARL live water quality dashboards = real-time science in classrooms.',
    badge: 'STEM Education',
  },
  {
    name: 'NOAA B-WET (Bay Watershed Education & Training)',
    agency: 'NOAA Office of Education',
    amount: '$50K–$200K',
    amountMax: 200000,
    url: 'https://www.noaa.gov/office-education/bwet',
    fit: 'High',
    deadline: 'Annual – varies by region',
    description: 'Hands-on, place-based watershed education. PEARL monitoring stations as outdoor classroom sensors for real-time data collection.',
    badge: 'Watershed Education',
  },
  {
    name: 'EPA Environmental Education Grants',
    agency: 'EPA Office of Environmental Education',
    amount: '$50K–$100K',
    amountMax: 100000,
    url: 'https://www.epa.gov/education/grants',
    fit: 'Good',
    deadline: 'Annual – varies',
    description: 'Environmental education promoting awareness and stewardship. PEARL dashboards create interactive learning experiences.',
  },
  {
    name: 'Captain Planet Foundation - ecoSTEM Grants',
    agency: 'Captain Planet Foundation',
    amount: '$500–$2,500',
    amountMax: 2500,
    url: 'https://captainplanetfoundation.org/grants/',
    fit: 'High',
    deadline: 'Rolling – quarterly review',
    description: 'Hands-on STEM projects with environmental focus. Water quality monitoring classroom activities directly eligible.',
  },
  {
    name: 'Project WET Foundation',
    agency: 'Project WET Foundation',
    amount: '$500–$5,000',
    amountMax: 5000,
    url: 'https://www.projectwet.org/',
    fit: 'Good',
    deadline: 'Rolling',
    description: 'Water education programs and curriculum. PEARL real-time data enhances existing Project WET curricula.',
  },
];

const NATIONAL_COLLEGE_GRANTS: Grant[] = [
  {
    name: 'NSF REU Sites — Environmental Engineering',
    agency: 'National Science Foundation',
    amount: 'Stipend + travel ($6K–$8K/student)',
    amountMax: 500000,
    url: 'https://www.nsf.gov/funding/pgm_summ.jsp?pims_id=5517',
    fit: 'High',
    deadline: 'Annual – February/October',
    description: 'Undergraduate research opportunities in environmental engineering and water quality. PEARL monitoring generates publishable datasets for student projects.',
    badge: 'Undergrad Research',
  },
  {
    name: 'NSF GRFP — Graduate Research Fellowship',
    agency: 'National Science Foundation',
    amount: '$37,000/yr stipend + $16,000 COE (3 years)',
    amountMax: 159000,
    url: 'https://www.nsfgrfp.org/',
    fit: 'High',
    deadline: 'Annual – October',
    description: 'Premier graduate fellowship. Environmental engineering, marine biology, and water quality research topics all eligible. PEARL data supports thesis/dissertation research.',
    badge: 'Graduate Fellowship',
  },
  {
    name: 'EPA STAR Graduate Fellowship',
    agency: 'EPA Office of Research & Development',
    amount: '$50K/yr (up to 3 years)',
    amountMax: 150000,
    url: 'https://www.epa.gov/research-fellowships/science-achieve-results-star',
    fit: 'High',
    deadline: 'Annual – varies',
    description: 'Graduate fellowships for environmental science research. Water quality monitoring technology and biofiltration are priority research areas.',
  },
  {
    name: 'Udall Foundation Scholarship',
    agency: 'Morris K. Udall Foundation',
    amount: 'Up to $7,000',
    amountMax: 7000,
    url: 'https://www.udall.gov/OurPrograms/Scholarship/Scholarship.aspx',
    fit: 'Good',
    deadline: 'Annual – March',
    description: 'Undergrad scholarships for students pursuing environmental careers. Involvement with PEARL strengthens applications.',
  },
];

const NATIONAL_SCIENTIST_GRANTS: Grant[] = [
  {
    name: 'NSF CBET — Environmental Engineering',
    agency: 'National Science Foundation',
    amount: '$300K–$500K (3 years)',
    amountMax: 500000,
    url: 'https://new.nsf.gov/funding/opportunities/environmental-engineering',
    fit: 'High',
    deadline: 'Rolling (target dates Feb & Sept)',
    description: 'Core NSF funding for environmental engineering research. Biofiltration, water treatment innovation, and monitoring technology all within scope.',
    badge: 'Core NSF',
  },
  {
    name: 'NOAA Sea Grant — National Strategic Investments',
    agency: 'NOAA Sea Grant',
    amount: '$100K–$300K/yr',
    amountMax: 900000,
    url: 'https://seagrant.noaa.gov/funding/',
    fit: 'High',
    deadline: 'Annual – varies by state Sea Grant program',
    description: 'Coastal and marine research with applied focus. Water quality, aquaculture innovation, and habitat restoration are priority areas. PEARL bridges research and application.',
  },
  {
    name: 'EPA ORD Water Research Grants',
    agency: 'EPA Office of Research & Development',
    amount: '$200K–$800K',
    amountMax: 800000,
    url: 'https://www.epa.gov/research-grants',
    fit: 'High',
    deadline: 'Annual – varies by topic area',
    description: 'Research on innovative water quality monitoring, treatment technologies, and nutrient management. PEARL continuous monitoring data supports research proposals.',
  },
  {
    name: 'USGS Water Resources Research Act',
    agency: 'USGS / State Water Resources Research Institutes',
    amount: '$25K–$250K',
    amountMax: 250000,
    url: 'https://water.usgs.gov/wrri/',
    fit: 'Good',
    deadline: 'Annual – varies by state',
    description: 'State-level water research through WRRI network. Each state has an affiliated research institute. PEARL monitoring partnerships eligible.',
  },
  {
    name: 'NSF SBIR/STTR Phase I',
    agency: 'National Science Foundation',
    amount: '$275K (Phase I) / $1.5M (Phase II)',
    amountMax: 1500000,
    url: 'https://www.nsf.gov/eng/iip/sbir/',
    fit: 'High',
    deadline: 'Rolling',
    description: 'Technology commercialization for water treatment innovation. Three PEARL provisional patents and Milton FL pilot data = strong Phase I/II candidate.',
    badge: 'Pilot Validated',
  },
];

const NATIONAL_CORPORATE_GRANTS: Grant[] = [
  {
    name: 'EPA Water Finance Center — WIFIA',
    agency: 'EPA',
    amount: '$5M–$100M+ (loans)',
    amountMax: 100000000,
    url: 'https://www.epa.gov/wifia',
    fit: 'Good',
    deadline: 'Rolling – Letters of Interest',
    description: 'Water Infrastructure Finance and Innovation Act. Low-interest federal loans for water quality infrastructure. ESG-aligned investment vehicle.',
    badge: 'Infrastructure Finance',
  },
  {
    name: 'NFWF Corporate Conservation Partnerships',
    agency: 'National Fish & Wildlife Foundation',
    amount: '$50K–$500K',
    amountMax: 500000,
    url: 'https://www.nfwf.org/who-we-are/corporate-partners',
    fit: 'High',
    deadline: 'Ongoing partnership model',
    description: 'Corporate-funded conservation matching. ESG reporting integration, biodiversity credits, and water quality impact metrics from PEARL data.',
  },
  {
    name: 'World Wildlife Fund - Project Finance for Permanence',
    agency: 'WWF',
    amount: 'Varies (partnership model)',
    amountMax: 5000000,
    url: 'https://www.worldwildlife.org/',
    fit: 'Good',
    deadline: 'By invitation',
    description: 'Large-scale conservation finance. PEARL monitoring provides verification data for nature-based ESG investments.',
  },
];

// ─── MD-specific grants (only show for MD regions) ────────────────────────────

const MD_SPECIFIC_GRANTS: Grant[] = [
  {
    name: 'MIPS — Maryland Industrial Partnerships',
    agency: 'Maryland Technology Development Corporation',
    amount: '$75K–$150K',
    amountMax: 150000,
    url: 'https://www.tedcomd.com/',
    fit: 'High',
    deadline: 'Rolling – Quarterly Reviews',
    description: 'University-industry collaborative R&D. Dual-application validation (stormwater + aquaculture) with UMCES or UMD partner. 50/50 cost share required.',
    badge: 'Research Partnership',
  },
  {
    name: 'TEDCO Maryland Innovation Initiative',
    agency: 'Maryland TEDCO',
    amount: '$100K–$500K',
    amountMax: 500000,
    url: 'https://www.tedcomd.com/funding/marylands-innovation-initiative',
    fit: 'High',
    deadline: 'Quarterly Application Cycles',
    description: 'Technology commercialization for Maryland companies. Water quality optimization, AI/ML deployment prediction.',
    badge: 'Tech Innovation',
  },
  {
    name: 'Chesapeake Oyster Innovation Award',
    agency: 'Chesapeake Bay Trust & Chesapeake Oyster Alliance',
    amount: '$50K–$150K',
    amountMax: 150000,
    url: 'https://cbtrust.org/grants/chesapeake-oyster-innovation/',
    fit: 'High',
    deadline: 'Annual',
    description: 'Innovation in oyster restoration technology. PEARL biofiltration monitoring integration with oyster reef establishment = direct alignment.',
    badge: 'Oyster Innovation',
  },
  {
    name: 'MARBIDCO Ag/Aquaculture Stewardship',
    agency: 'MARBIDCO',
    amount: '$10K–$100K',
    amountMax: 100000,
    url: 'https://marbidco.maryland.gov/',
    fit: 'Good',
    deadline: 'Rolling',
    description: 'Agricultural best management practices in rural Maryland counties. PEARL monitoring at ag-urban interface for nutrient tracking.',
  },
];

// ─── Build grants for a given state and role ──────────────────────────────────

function buildGrantsForRole(stateAbbr: string, role: string): Grant[] {
  // Start with state-specific grants from stateWaterData.ts
  const stateGrants = getStateGrants(stateAbbr).map(mapStateGrant);

  // Add role-specific national grants
  let roleGrants: Grant[] = [];
  switch (role) {
    case 'MS4':
    case 'State':
    case 'Federal':
      roleGrants = [...NATIONAL_MS4_GRANTS];
      break;
    case 'NGO':
      roleGrants = [...NATIONAL_NGO_GRANTS];
      break;
    case 'K12':
      roleGrants = [...NATIONAL_K12_GRANTS];
      break;
    case 'College':
      roleGrants = [...NATIONAL_COLLEGE_GRANTS];
      break;
    case 'Researcher':
      roleGrants = [...NATIONAL_SCIENTIST_GRANTS];
      break;
    case 'Corporate':
      roleGrants = [...NATIONAL_CORPORATE_GRANTS];
      break;
    default:
      roleGrants = [...NATIONAL_MS4_GRANTS];
  }

  // Add MD-specific grants only for MD regions
  if (stateAbbr === 'MD') {
    roleGrants.push(...MD_SPECIFIC_GRANTS);
  }

  // Merge: role grants first, then state grants, dedup by name
  const seen = new Set<string>();
  const merged: Grant[] = [];
  for (const g of [...roleGrants, ...stateGrants]) {
    const key = g.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(g);
    }
  }

  // Sort: High first, then Good, then Review
  const fitOrder = { High: 0, Good: 1, Review: 2 };
  merged.sort((a, b) => fitOrder[a.fit] - fitOrder[b.fit]);

  return merged;
}

// ─── Economic context by state ────────────────────────────────────────────────

function getEconomicContext(stateAbbr: string): { title: string; items: { label: string; value: string; detail: string }[]; footer: string } | null {
  switch (stateAbbr) {
    case 'MD':
    case 'VA':
    case 'PA':
    case 'DC':
    case 'DE':
      return {
        title: 'Economic Value of Oyster Restoration in Chesapeake Bay',
        items: [
          { label: 'Oyster Reefs Alone', value: '$700K/year', detail: 'Blue crab harvest value (Morgan State research)' },
          { label: 'Oyster + Eelgrass', value: '$5.8M/year', detail: '+ 54 full-time jobs (Morgan State)' },
          { label: 'Mature Reef Systems', value: '$23M/year', detail: '+ 300 jobs in fishing revenue (NOAA)' },
        ],
        footer: 'Funding Context: Maryland/NOAA investing $19M+ ($10M NOAA sanctuary + $9.1M ORP capital) in oyster restoration infrastructure. PEARL monitoring demonstrates water quality improvements that enable this economic value.',
      };
    case 'FL':
      return {
        title: 'Economic Value of Water Quality Restoration in Florida',
        items: [
          { label: 'Coastal Tourism', value: '$67B/year', detail: 'FL ocean economy (NOAA Economics)' },
          { label: 'Commercial Fishing', value: '$17.5B/year', detail: 'Saltwater fishing economic impact (FWC)' },
          { label: 'Springs Tourism', value: '$1.2B/year', detail: 'Visit Florida springs recreation economy' },
        ],
        footer: 'Funding Context: FL DEP investing $2.9B+ in water quality improvement grants. PEARL monitoring validates nutrient reduction for BMAP compliance and protects Florida\'s water-dependent economy.',
      };
    case 'TX':
      return {
        title: 'Economic Value of Water Quality in Texas Coastal Waters',
        items: [
          { label: 'Galveston Bay Oysters', value: '$31M/year', detail: 'TX oyster harvest, 80% from Galveston Bay (TPWD)' },
          { label: 'Coastal Recreation', value: '$8.3B/year', detail: 'TX Gulf Coast tourism (TX GLO)' },
          { label: 'Commercial Fishing', value: '$2.1B/year', detail: 'Seafood industry economic impact (TPWD)' },
        ],
        footer: 'Funding Context: TWDB HB 500 appropriated $1.038B for water infrastructure. RESTORE Act provides additional Gulf restoration funding. PEARL monitoring supports TCEQ CWQMN expansion.',
      };
    case 'LA':
      return {
        title: 'Economic Value of Coastal Restoration in Louisiana',
        items: [
          { label: 'Oyster Harvest', value: '$54M/year', detail: 'LA leads nation in oyster production (LDWF)' },
          { label: 'Commercial Fishing', value: '$2.4B/year', detail: 'Seafood industry dockside + processing (LSU AgCenter)' },
          { label: 'Coastal Protection', value: '$50B+', detail: 'Assets protected by coastal restoration (CPRA)' },
        ],
        footer: 'Funding Context: CPRA Coastal Master Plan commits $50B over 50 years. RESTORE Act + NFWF GEBF provide additional Gulf restoration funding.',
      };
    case 'NY':
      return {
        title: 'Economic Value of Water Quality in New York Waters',
        items: [
          { label: 'NY Harbor Economy', value: '$100B+/year', detail: 'Port of NY/NJ economic activity' },
          { label: 'Long Island Shellfish', value: '$42M/year', detail: 'Shellfish harvest value (NY DEC)' },
          { label: 'Recreation & Tourism', value: '$7.5B/year', detail: 'Coastal tourism and recreation (NYS)' },
        ],
        footer: 'Funding Context: NYC Green City, Clean Waters investing $4.5B in green infrastructure. PEARL monitoring tracks CSO reduction effectiveness.',
      };
    case 'OH':
      return {
        title: 'Economic Value of Water Quality in Ohio — Lake Erie',
        items: [
          { label: 'Lake Erie Tourism', value: '$12.9B/year', detail: 'Tourism economic impact (Ohio Sea Grant)' },
          { label: 'Sport Fishing', value: '$1.4B/year', detail: 'Walleye capital of the world (Lake Erie Charter)' },
          { label: 'HAB Costs Avoided', value: '$65M+/event', detail: 'Toledo water crisis cost estimate (2014)' },
        ],
        footer: 'Funding Context: H2Ohio investing $172M+ in water quality. GLRI provides $300M+/year for Great Lakes restoration.',
      };
    default:
      return null;
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const FIT_COLORS = {
  High:   'bg-green-100 text-green-800 border border-green-200',
  Good:   'bg-blue-100 text-blue-800 border border-blue-200',
  Review: 'bg-slate-100 text-slate-600 border border-slate-200',
};

function formatTotal(grants: Grant[]): string {
  const total = grants.reduce((sum, g) => sum + g.amountMax, 0);
  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(1)}M+`;
  if (total >= 1_000)     return `$${(total / 1_000).toFixed(0)}K+`;
  return total > 0 ? `$${total.toLocaleString()}+` : '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GrantOpportunityMatcher({
  regionId,
  removalEfficiencies,
  alertsCount,
  userRole = 'MS4',
  stateAbbr: stateAbbrProp,
}: GrantOpportunityMatcherProps) {
  const stateAbbr = stateAbbrProp || getStateFromRegion(regionId);
  const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
  const stateAuth = STATE_AUTHORITIES[stateAbbr];

  const grants = buildGrantsForRole(stateAbbr, userRole);
  const highFit = grants.filter(g => g.fit === 'High').length;
  const goodFit = grants.filter(g => g.fit === 'Good').length;
  const totalValue = formatTotal(grants);

  const economicContext = getEconomicContext(stateAbbr);

  return (
    <Card className="border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-900">
          <DollarSign className="h-6 w-6 text-yellow-600" />
          {stateName} Grant Opportunities — PEARL Eligible
          <span className="ml-auto flex items-center gap-2">
            {totalValue && (
              <span className="text-sm font-bold text-yellow-700 bg-yellow-100 border border-yellow-300 px-2.5 py-0.5 rounded-full">
                {totalValue} available
              </span>
            )}
            <span className="text-xs font-semibold text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
              {highFit} High-Fit
            </span>
          </span>
        </CardTitle>
        <CardDescription>
          {userRole === 'College' 
            ? `Educational overview of water quality funding programs in ${stateName} — explore the grant landscape in environmental restoration`
            : `Funding programs matched to your role and PEARL performance data · ${stateAuth?.abbr || stateAbbr} jurisdiction`}
        </CardDescription>
        <div className="flex items-center gap-3 text-xs text-yellow-700 mt-1">
          <span className="flex items-center gap-1">🟢 {highFit} High Fit ({formatTotal(grants.filter(g => g.fit === 'High'))})</span>
          <span className="flex items-center gap-1">🔵 {goodFit} Good Fit</span>
          <span className="flex items-center gap-1">📊 {grants.length} Total Programs</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Economic Context Banner */}
        {economicContext && (userRole === 'MS4' || userRole === 'State' || userRole === 'NGO' || userRole === 'Researcher' || userRole === 'Federal') && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <DollarSign className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-green-900 mb-2">
                  {economicContext.title}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {economicContext.items.map((item, idx) => (
                    <div key={idx} className="bg-white rounded border border-green-200 p-2">
                      <div className="font-semibold text-green-900">{item.label}</div>
                      <div className="text-lg font-bold text-green-700">{item.value}</div>
                      <div className="text-gray-600">{item.detail}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-green-800 mt-2 bg-white/50 rounded p-2 border border-green-200">
                  <strong>Funding Context:</strong> {economicContext.footer}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Educational Banner for College Students */}
        {userRole === 'College' && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <span className="text-xl flex-shrink-0">🎓</span>
              <div>
                <div className="text-sm font-semibold text-blue-900 mb-1">
                  Grant Opportunities &amp; Funding Landscape
                </div>
                <div className="text-xs text-blue-700 leading-relaxed mb-2">
                  Learn about water quality funding sources in this field. Most grants require <b>faculty sponsorship</b> or institutional backing — discuss opportunities with your professor or advisor.
                </div>
                <div className="text-xs text-blue-600 italic">
                  💡 Use cases: Undergraduate research grants (NSF REU), graduate fellowships (NSF GRFP, EPA STAR), capstone project funding, or bringing opportunities to your research advisor.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* High Fit Section */}
        {grants.filter(g => g.fit === 'High').length > 0 && (
          <div className="border-l-4 border-green-400 pl-3 mb-2">
            <div className="text-xs font-bold text-green-700 uppercase tracking-wide flex items-center gap-2">
              <span className="bg-green-100 text-green-800 border border-green-200 px-1.5 py-0.5 rounded text-[10px]">HIGH FIT</span>
              Strong alignment with PEARL technology and {stateName} water quality priorities
            </div>
          </div>
        )}
        
        {grants.filter(g => g.fit === 'High').map((grant) => (
          <div
            key={grant.name}
            className="bg-white rounded-lg border border-yellow-200 p-3 hover:border-yellow-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-slate-900">{grant.name}</span>
                {grant.badge && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 border border-yellow-200 px-1.5 py-0.5 rounded-full font-medium">
                    {grant.badge}
                  </span>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap shrink-0 ${FIT_COLORS[grant.fit]}`}>
                {grant.fit} Fit
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 flex-wrap">
              <span className="font-medium text-slate-700">{grant.agency}</span>
              <span>·</span>
              <span className="font-bold text-green-700">{grant.amount}</span>
              <span>·</span>
              <span>{grant.deadline}</span>
              {grant.filing_date && (
                <>
                  <span>·</span>
                  <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    DUE: {grant.filing_date}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-2.5">{grant.description}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <a href={grant.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-all">
                <ExternalLink className="h-3 w-3" /> View Grant
              </a>
              <a href={`mailto:info@project-pearl.org?subject=Letter of Support Request - ${encodeURIComponent(grant.name)}&body=Hello Project PEARL Team,%0A%0AI am applying for the ${encodeURIComponent(grant.name)} grant and would like to request a Letter of Support from Project PEARL.%0A%0AOrganization:%0AContact Name:%0AProject Description:%0ADeadline:%0A%0AThank you`}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 hover:border-green-300 transition-all">
                <Mail className="h-3 w-3" /> Request Letter of Support
              </a>
            </div>
          </div>
        ))}

        {/* Good Fit / Medium Section */}
        {grants.filter(g => g.fit === 'Good').length > 0 && (
          <div className="border-l-4 border-blue-300 pl-3 mt-4 mb-2">
            <div className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded text-[10px]">GOOD FIT</span>
              Potential alignment — may require additional positioning
            </div>
          </div>
        )}

        {grants.filter(g => g.fit === 'Good').map((grant) => (
          <div
            key={grant.name}
            className="bg-white rounded-lg border border-slate-200 p-3 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-slate-900">{grant.name}</span>
                {grant.badge && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 border border-yellow-200 px-1.5 py-0.5 rounded-full font-medium">
                    {grant.badge}
                  </span>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap shrink-0 ${FIT_COLORS[grant.fit]}`}>
                {grant.fit} Fit
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 flex-wrap">
              <span className="font-medium text-slate-700">{grant.agency}</span>
              <span>·</span>
              <span className="font-bold text-green-700">{grant.amount}</span>
              <span>·</span>
              <span>{grant.deadline}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-2.5">{grant.description}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <a href={grant.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-all">
                <ExternalLink className="h-3 w-3" /> Learn More →
              </a>
            </div>
          </div>
        ))}

        {/* State Agency Contact */}
        {stateAuth && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-3">
            <div className="text-sm font-semibold text-slate-800 mb-1">
              {stateAuth.abbr} State Programs — Additional Matching Funds
            </div>
            <div className="text-xs text-slate-600">
              Contact {stateAuth.primaryContact || 'the water division'} at {stateAuth.name} for state-specific matching fund programs, revolving loan eligibility, and innovation pilot opportunities.
              {stateAuth.website && (
                <> 🔗 <a href={`https://${stateAuth.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{stateAuth.website}</a></>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500 pt-1 border-t border-yellow-200">
          Matched to your role and PEARL water quality data for {stateName}. Deadlines are approximate — verify with each agency before applying. Project PEARL can provide a Letter of Support for any grant listed above.
        </p>
      </CardContent>
    </Card>
  );
}
