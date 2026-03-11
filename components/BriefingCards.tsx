'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Scale, ChevronDown } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type BriefingEntityType =
  | 'local' | 'ms4' | 'utility' | 'k12' | 'ngo'
  | 'university' | 'esg' | 'biotech' | 'investor';

export interface BriefingCardProps {
  entityType: BriefingEntityType;
  entityName?: string;
  stateAbbr?: string;
}

/* ------------------------------------------------------------------ */
/*  Mock-data generators                                               */
/* ------------------------------------------------------------------ */

interface ChangeItem { id: string; time: string; change: string; detail: string }
interface StakeItem  { id: string; type: string; detail: string; status: string; expandDetail: string }

const changesData: Record<BriefingEntityType, (n: string, st: string) => { title: string; subtitle: string; items: ChangeItem[]; source: string }> = {
  local: (n, st) => ({
    title: `What Changed Overnight — ${n}`,
    subtitle: `New data, alerts, and status changes for ${n} since your last session`,
    items: [
      { id: 'loc-chg-1', time: '2:14 AM', change: `MS4 permit status update: stormwater discharge monitoring report submitted for ${n}`, detail: `Quarterly DMR for ${n} MS4 Phase II permit submitted to ${st} DEQ. All parameters within limits. Next submission due Q3 2026.` },
      { id: 'loc-chg-2', time: '3:45 AM', change: `SDWIS alert: 1 community water system in ${n} flagged for monitoring violation`, detail: `System: ${n} Water Authority. Missed quarterly coliform sampling window. Tier 2 public notice required within 30 days.` },
      { id: 'loc-chg-3', time: '5:30 AM', change: `Watershed impairment update: 2 stream segments near ${n} added to 303(d) list`, detail: `Rock Creek and Mill Branch added for bacteria impairment. TMDL development expected within 18 months. May affect local development approvals.` },
      { id: 'loc-chg-4', time: '6:00 AM', change: `Stormwater incident report: sanitary sewer overflow reported in ${n} downtown district`, detail: `SSO at Pump Station #3 — approximately 2,500 gallons. Cause: grease blockage. Contained within 4 hours. ${st} DEQ notified per permit requirements.` },
    ],
    source: `AI analysis of EPA ECHO, SDWIS, ATTAINS, and ${st} DEQ overnight data for ${n}`,
  }),

  ms4: (n, st) => ({
    title: `What Changed Overnight — ${n}`,
    subtitle: `Permit compliance and stormwater updates for ${n}`,
    items: [
      { id: 'ms4-chg-1', time: '2:30 AM', change: `Permit compliance deadline approaching: Annual report due in 45 days for ${n} MS4`, detail: `FY2026 annual report due Apr 15. MCM 3 (IDDE) and MCM 6 (pollution prevention) sections still require data compilation.` },
      { id: 'ms4-chg-2', time: '3:45 AM', change: `BMP inspection backlog: 12 post-construction BMPs overdue for routine inspection in ${n}`, detail: `6 bioretention, 4 permeable pavement, 2 underground detention. Oldest overdue: 47 days. Inspection crew capacity: 4/day.` },
      { id: 'ms4-chg-3', time: '5:15 AM', change: `Stormwater monitoring results: 2 outfalls exceed benchmark values in ${n}`, detail: `Outfall 14 (TSS: 142 mg/L, benchmark: 100) and Outfall 22 (E. coli: 520 CFU/100mL, benchmark: 235). Follow-up sampling required within 30 days.` },
      { id: 'ms4-chg-4', time: '6:00 AM', change: `MCM status change: ${st} approved ${n} revised IDDE program plan`, detail: `Revised IDDE plan accepted. Key change: expanded dry-weather screening schedule from annual to semi-annual for priority outfalls.` },
    ],
    source: `AI analysis of ${st} stormwater permitting data, EPA ECHO, and ${n} inspection records`,
  }),

  utility: (_n, st) => ({
    title: 'What Changed Overnight',
    subtitle: 'Treatment plant data, compliance updates, and infrastructure alerts',
    items: [
      { id: 'util-chg-1', time: '1:45 AM', change: `Treatment plant alarm: turbidity spike at WTP Filter #3 — auto-backwash initiated`, detail: `Raw water turbidity rose from 2.1 to 8.7 NTU due to upstream storm event. Filter #3 backwashed at 01:52. Finished water remained below 0.3 NTU throughout.` },
      { id: 'util-chg-2', time: '3:30 AM', change: `SDWIS compliance update: quarterly lead/copper 90th percentile results posted for ${st}`, detail: `90th percentile lead: 8.2 ppb (action level: 15). 90th percentile copper: 0.92 ppm (action level: 1.3). Both within compliance. Next sampling: Sep 2026.` },
      { id: 'util-chg-3', time: '5:00 AM', change: `Source water alert: USGS gage shows 40% flow increase in source river`, detail: `Gage 01589000 — flow increased from 320 cfs to 450 cfs overnight. Elevated turbidity and potential taste-and-odor event. Enhanced monitoring recommended.` },
      { id: 'util-chg-4', time: '6:15 AM', change: `Infrastructure alert: distribution pressure drop detected in Zone 3`, detail: `Pressure at monitoring point DZ3-07 dropped from 62 psi to 48 psi. Possible main break or high-demand event. Field crew dispatched for investigation.` },
    ],
    source: `SCADA historian, EPA SDWIS, USGS NWIS, and distribution system monitoring`,
  }),

  k12: (_n, st) => ({
    title: 'What Changed Overnight',
    subtitle: `School water safety updates and environmental data for ${st}`,
    items: [
      { id: 'k12-chg-1', time: '2:00 AM', change: `Lead and copper testing results: 2 ${st} school districts posted new fixture-level data`, detail: `District A: 3 of 42 fixtures above 15 ppb action level (cafeteria sink, Room 204 fountain, gym fountain). Remediation plan required within 60 days.` },
      { id: 'k12-chg-2', time: '4:15 AM', change: `SDWIS alert: boil water advisory issued for school service area in ${st}`, detail: `Water system serving Jefferson Elementary and Lincoln Middle School issued 24-hour precautionary boil water notice due to main break. Bottled water provided.` },
      { id: 'k12-chg-3', time: '5:30 AM', change: `State guidance update: ${st} published revised school drinking water testing protocol`, detail: `New protocol requires first-draw and 30-second flush samples at all drinking and cooking outlets. Testing frequency increased to annual for schools built before 1988.` },
      { id: 'k12-chg-4', time: '6:00 AM', change: `Watershed data refresh: student monitoring site on Deer Creek shows elevated bacteria`, detail: `E. coli at student monitoring site DC-03 measured 410 CFU/100mL (recreational standard: 235). Likely related to recent livestock access. Good teaching moment for NPS pollution.` },
    ],
    source: `EPA SDWIS, ${st} DEQ school testing program, student monitoring network, USGS`,
  }),

  ngo: (n, st) => ({
    title: `What Changed Overnight — ${n || st}`,
    subtitle: `Conservation intelligence and watershed updates`,
    items: [
      { id: 'ngo-chg-1', time: '2:14 AM', change: `ATTAINS update: 5 new impairment listings in ${st} priority watersheds`, detail: `3 nutrient impairments, 1 bacteria, 1 sediment. Watersheds: Upper Patapsco (2), Gunpowder Falls (2), Loch Raven (1). Advocacy opportunity for TMDL acceleration.` },
      { id: 'ngo-chg-2', time: '3:45 AM', change: `Species observation: rare freshwater mussel detected in ${st} restoration project area`, detail: `Dwarf wedgemussel (Alasmidonta heterodon) documented by volunteer survey team. Federally endangered. May strengthen habitat protection arguments for Mill Creek corridor.` },
      { id: 'ngo-chg-3', time: '5:00 AM', change: `Restoration milestone: stream bank stabilization project in ${st} met 80% completion`, detail: `Phase 2 of Deer Creek restoration — 1,200 linear feet stabilized. Volunteer hours: 340. Sediment reduction estimated at 45 tons/year. Final phase begins Apr 2026.` },
      { id: 'ngo-chg-4', time: '6:00 AM', change: `Enforcement action: EPA issued NOV to major discharger in ${st} priority watershed`, detail: `Industrial facility in Upper Patapsco watershed cited for repeated TN exceedances. Consent decree negotiations expected. Monitor for potential NGO intervention opportunity.` },
    ],
    source: `EPA ATTAINS, ECHO, ${st} DNR species database, and restoration project tracking`,
  }),

  university: (_n, st) => ({
    title: 'What Changed Overnight',
    subtitle: `Campus and research watershed data updates`,
    items: [
      { id: 'uni-chg-1', time: '2:00 AM', change: `Campus stormwater data: 3 monitoring points show elevated TSS after yesterday's storm`, detail: `Campus outfalls SW-01 (TSS: 89 mg/L), SW-04 (TSS: 112 mg/L), and SW-07 (TSS: 76 mg/L) exceeded campus BMP design targets. Green infrastructure performance review recommended.` },
      { id: 'uni-chg-2', time: '3:30 AM', change: `Research watershed alert: USGS gage in study area shows record-low baseflow for ${st}`, detail: `Gage 01589330 — baseflow at 12 cfs, lowest on record for this date. Drought index worsening. May affect ongoing nutrient transport study sampling schedule.` },
      { id: 'uni-chg-3', time: '5:15 AM', change: `Campus NPDES compliance report: quarterly DMR data compiled and ready for PI review`, detail: `All 8 permitted parameters within limits. BOD trending upward (65% of limit vs. 52% last quarter). Lab QA/QC flags: none. Submission deadline: Mar 15.` },
      { id: 'uni-chg-4', time: '6:00 AM', change: `Grant deadline approaching: NSF Hydrologic Sciences proposal due in 14 days`, detail: `NSF 26-501 — Environmental Sustainability program. Budget: $450K/3yr. Co-PI letter of support from ${st} DEQ still pending. Draft manuscript on preliminary data should be submitted first.` },
    ],
    source: `Campus SCADA, USGS NWIS, EPA ECHO, NSF grants.gov, and research lab data systems`,
  }),

  esg: (_n, _st) => ({
    title: 'What Changed Overnight',
    subtitle: 'ESG compliance, water risk, and regulatory updates across portfolio',
    items: [
      { id: 'esg-chg-1', time: '2:14 AM', change: 'Facility discharge data: 2 portfolio facilities reported effluent limit exceedances overnight', detail: 'Baltimore Processing (TN: 12.3 mg/L vs. 10 mg/L limit) and Cambridge Seafood (TSS: 45 mg/L vs. 30 mg/L limit). Both within 30-day average compliance but daily max exceeded.' },
      { id: 'esg-chg-2', time: '3:45 AM', change: 'Compliance status change: Portfolio facility returned to Significant Non-Compliance in ECHO', detail: 'Southeast Distribution Center (GA0045678) re-flagged for SNC due to missed DMR submission. Facility manager notified. 30-day cure window per consent decree.' },
      { id: 'esg-chg-3', time: '5:30 AM', change: 'Supply chain water risk: WRI Aqueduct updated water stress scores for 3 supplier regions', detail: 'Supplier regions in Central Valley CA (+0.3), North China Plain (+0.2), and São Paulo (+0.1) all showed increased water stress. Portfolio exposure: $12M annual procurement.' },
      { id: 'esg-chg-4', time: '6:00 AM', change: 'Regulatory update: SEC proposed enhanced water risk disclosure requirements for ESG filings', detail: 'Proposed rule would require facility-level water withdrawal, discharge, and recycling data in annual ESG reports. Comment period: 60 days. May affect 2027 reporting cycle.' },
    ],
    source: 'EPA ECHO, WRI Aqueduct, SEC EDGAR, and portfolio compliance monitoring systems',
  }),

  biotech: (_n, _st) => ({
    title: 'What Changed Overnight',
    subtitle: 'Process water, compliance, and pharma regulatory updates',
    items: [
      { id: 'bio-chg-1', time: '1:30 AM', change: 'Process water quality alert: USP purified water system TOC trending upward at RTP facility', detail: 'TOC at PW-Loop-3: 0.42 ppm (alert limit: 0.45, action limit: 0.50). Trend: +0.08 ppm over 7 days. Preemptive carbon bed regeneration recommended.' },
      { id: 'bio-chg-2', time: '3:00 AM', change: 'Effluent monitoring: API discharge at NJ facility within limits but trending toward 80% threshold', detail: 'Acetaminophen metabolite at Outfall 001: 0.38 µg/L (permit limit: 0.50). 30-day rolling average: 0.35 µg/L. Source investigation recommended if trend continues.' },
      { id: 'bio-chg-3', time: '4:45 AM', change: 'GMP finding: FDA 483 observation at Indianapolis facility cites water system qualification gap', detail: 'Observation: Annual water system requalification protocol not executed within calendar year. CAPA plan required within 15 business days. No product impact assessed.' },
      { id: 'bio-chg-4', time: '6:00 AM', change: 'Pharma contaminant data: USGS published new occurrence data for 12 pharmaceutical compounds', detail: 'Study covers 150 WWTP effluents nationwide. 3 compounds detected above provisional screening levels. Industry comment period on proposed monitoring requirements opens next month.' },
    ],
    source: 'Process LIMS, EPA ECHO/DMR, FDA CDER inspection database, USGS pharmaceutical monitoring',
  }),

  investor: (_n, _st) => ({
    title: 'What Changed Overnight',
    subtitle: 'Portfolio water risk, compliance, and ESG intelligence',
    items: [
      { id: 'inv-chg-1', time: '2:00 AM', change: 'Portfolio company compliance: 3 holdings received new ECHO enforcement flags overnight', detail: 'AquaTech Industries (effluent violation), Coastal Processing Inc (missed DMR), and GreenField Chemicals (SNC designation). Combined portfolio exposure: $45M. Risk scores updated.' },
      { id: 'inv-chg-2', time: '3:30 AM', change: 'Water stress change: WRI Aqueduct reclassified 2 portfolio facility regions from High to Extremely High', detail: 'Affected: Phoenix manufacturing campus and Central Valley distribution hub. Annual water procurement cost impact: +$2.1M estimated. Transition risk score increased.' },
      { id: 'inv-chg-3', time: '5:00 AM', change: 'Regulatory action: EPA proposed new PFAS discharge limits affecting 4 portfolio companies', detail: 'Proposed rule: PFAS effluent guidelines for industrial categories. 4 holdings in chemical manufacturing and metal finishing sectors affected. Compliance cost estimate: $8-12M.' },
      { id: 'inv-chg-4', time: '6:15 AM', change: 'ESG rating shift: MSCI downgraded water management score for 2 portfolio companies', detail: 'Downgraded: Pacific Cement (B→CCC) and MidAtlantic Paper (BBB→BB). Primary factors: water intensity metrics, lack of reduction targets, and regulatory violations.' },
    ],
    source: 'EPA ECHO, WRI Aqueduct, MSCI ESG, Bloomberg terminal, and portfolio monitoring systems',
  }),
};

const stakeholderData: Record<BriefingEntityType, (n: string, st: string) => { title: string; subtitle: string; items: StakeItem[]; source: string }> = {
  local: (n, _st) => ({
    title: `Stakeholder Watch — ${n}`,
    subtitle: `Community engagement and stakeholder activity in ${n}`,
    items: [
      { id: 'loc-stk-1', type: 'Resident Complaint', detail: `3 new water quality complaints filed via ${n} 311 system this week`, status: 'Review Needed', expandDetail: `Complaints: discolored water on Oak St (2 reports), low pressure on Elm Ave (1 report). Public works dispatched for Oak St. Elm Ave likely related to Zone 3 pressure drop.` },
      { id: 'loc-stk-2', type: 'Local Media', detail: `${n} Gazette published editorial on aging water infrastructure funding gap`, status: 'Monitoring', expandDetail: `Editorial cites ASCE infrastructure report card and local rate study. Recommends council approve SRF loan application. Generally favorable tone but highlights affordability concerns.` },
      { id: 'loc-stk-3', type: 'City Council', detail: `Council work session on stormwater utility fee increase scheduled for next Tuesday`, status: 'Prepare Briefing', expandDetail: `Proposed 6% fee increase to fund MS4 permit compliance. Council members requesting cost-benefit analysis and comparison with peer jurisdictions. 3 of 7 members expressed concern.` },
    ],
    source: `AI analysis of ${n} 311 system, local media monitoring, and council agenda tracking`,
  }),

  ms4: (n, st) => ({
    title: `Stakeholder Watch — ${n}`,
    subtitle: `Regulatory and community engagement for ${n} MS4 program`,
    items: [
      { id: 'ms4-stk-1', type: 'Permitting Authority', detail: `${st} DEQ scheduling annual MS4 audit for ${n} — 60-day notice period`, status: 'Prepare', expandDetail: `Audit focus areas: IDDE program effectiveness, post-construction BMP oversight, and public education metrics. Document compilation should begin immediately.` },
      { id: 'ms4-stk-2', type: 'Public Works', detail: `Public works requesting coordination on 3 capital projects affecting stormwater infrastructure`, status: 'Action Needed', expandDetail: `Projects: Main St reconstruction (relocating 2 outfalls), Park Ave green street (new bioretention), and Highway 40 widening (increased impervious area mitigation).` },
      { id: 'ms4-stk-3', type: 'Environmental Group', detail: `Local watershed group requesting MS4 program data for annual State of the Streams report`, status: 'Respond', expandDetail: `Requesting: outfall screening results, BMP inspection reports, and illicit discharge investigation outcomes. Public records request filed. Response due in 10 business days.` },
    ],
    source: `AI analysis of ${st} DEQ correspondence, interagency coordination, and public records requests`,
  }),

  utility: (_n, _st) => ({
    title: 'Stakeholder Watch',
    subtitle: 'Regulatory, customer, and community engagement updates',
    items: [
      { id: 'util-stk-1', type: 'PUC/Rate Commission', detail: 'Public utility commission rate case hearing scheduled — proposed 8% increase under review', status: 'Prepare Testimony', expandDetail: 'Hearing date: Mar 20. Commission staff recommends 5.5% (vs. 8% requested). Key disputed items: infrastructure replacement rate, pension costs, and PFAS treatment capital.' },
      { id: 'util-stk-2', type: 'Customer Advisory', detail: '47 customer complaints received this month — 60% related to billing, 25% to taste/odor', status: 'Review', expandDetail: 'Billing complaints spike correlated with new meter reading technology deployment in Zone 2. Taste/odor complaints from Zone 4 — geosmin detected at source water intake.' },
      { id: 'util-stk-3', type: 'EPA Region', detail: 'EPA Region scheduling sanitary survey — 90-day advance notification received', status: 'Prepare', expandDetail: 'Comprehensive sanitary survey per SDWA requirements. Focus areas: source water protection, treatment adequacy, distribution system integrity, and operator certification compliance.' },
    ],
    source: 'PUC docket, customer CRM, EPA Region correspondence, and regulatory calendar',
  }),

  k12: (_n, st) => ({
    title: 'Stakeholder Watch',
    subtitle: `School water safety stakeholder engagement for ${st}`,
    items: [
      { id: 'k12-stk-1', type: 'Parents / PTA', detail: `PTA requesting detailed lead testing results for all drinking water fixtures`, status: 'Response Needed', expandDetail: `Request prompted by recent media coverage of school lead testing in neighboring district. Prepare parent-friendly summary of results, remediation actions, and testing schedule.` },
      { id: 'k12-stk-2', type: 'School Board', detail: `Board agenda item: approve $180K for drinking water fountain replacements across 6 schools`, status: 'Prepare Materials', expandDetail: `Replacement of 48 non-filtered fountains with bottle-fill stations with NSF 53 lead-reducing filters. Prioritized by fixture age and test results. Installation timeline: summer 2026.` },
      { id: 'k12-stk-3', type: 'Health Department', detail: `${st} health department issued updated guidance on school water testing communication`, status: 'Review', expandDetail: `New guidance requires plain-language notification to parents within 5 business days of receiving results above action level. Template letters and FAQ provided. Effective immediately.` },
    ],
    source: `AI analysis of PTA communications, school board agenda, and ${st} health department bulletins`,
  }),

  ngo: (_n, st) => ({
    title: `Stakeholder Watch — ${st}`,
    subtitle: 'Donor, partner, and government agency engagement updates',
    items: [
      { id: 'ngo-stk-1', type: 'Donor Relations', detail: 'Major foundation grant report due in 30 days — interim impact metrics required', status: 'Action Needed', expandDetail: 'Chesapeake Watershed Foundation — $250K grant for riparian restoration. Metrics needed: acres restored, volunteer hours, water quality improvement data, and community engagement numbers.' },
      { id: 'ngo-stk-2', type: 'Partner Org', detail: `${st} conservation coalition requesting joint comment letter on proposed nutrient trading rule`, status: 'Review Draft', expandDetail: `Coalition of 8 NGOs preparing joint comment. Key positions: support for trading framework but concerns about offset ratios and monitoring requirements. Draft review by Mar 10.` },
      { id: 'ngo-stk-3', type: 'Government Agency', detail: `${st} DNR inviting NGO input on 5-year watershed implementation plan update`, status: 'Upcoming', expandDetail: `Stakeholder workshop scheduled Mar 25. NGO representation requested for: prioritization criteria, community engagement strategy, and volunteer monitoring data integration.` },
    ],
    source: `AI analysis of donor reporting, NGO coalition communications, and ${st} agency engagement`,
  }),

  university: (_n, st) => ({
    title: 'Stakeholder Watch',
    subtitle: 'Research partners, campus, and regulatory engagement',
    items: [
      { id: 'uni-stk-1', type: 'Research Partners', detail: `Multi-university consortium requesting data sharing agreement for ${st} watershed study`, status: 'Legal Review', expandDetail: `3-university consortium (lead: State U) seeking access to 5 years of continuous monitoring data. MOU and data use agreement drafted. IP provisions need review before signing.` },
      { id: 'uni-stk-2', type: 'Campus Facilities', detail: 'Facilities management requesting stormwater BMP maintenance budget increase for FY2027', status: 'Support', expandDetail: 'Current budget: $85K/year. Requested: $120K/year. Justification: 4 new bioretention installations, aging permeable pavement needing vacuuming, and new MS4 permit requirements.' },
      { id: 'uni-stk-3', type: 'Regulatory Agency', detail: `${st} DEQ requesting campus participation in nutrient monitoring pilot program`, status: 'Evaluate', expandDetail: `Pilot: enhanced nutrient monitoring at campus outfalls using continuous sensors. DEQ provides equipment, university provides installation and data management. 2-year commitment.` },
    ],
    source: `AI analysis of research consortium communications, campus facilities requests, and ${st} DEQ correspondence`,
  }),

  esg: (_n, _st) => ({
    title: 'Stakeholder Watch',
    subtitle: 'Investor, regulatory, and NGO engagement updates',
    items: [
      { id: 'esg-stk-1', type: 'Investors', detail: 'Institutional investors requesting enhanced water stewardship disclosures for proxy season', status: 'Response Needed', expandDetail: '3 institutional investors (combined 8.2% ownership) submitted pre-proxy engagement letters. Key asks: facility-level water stress data, TCFD-aligned water scenario analysis, and TNFD pilot disclosure. Response deadline: Mar 15.' },
      { id: 'esg-stk-2', type: 'Rating Agency', detail: 'MSCI scheduled ESG rating review — water management score under enhanced scrutiny', status: 'Prepare Data', expandDetail: 'Annual review cycle. MSCI analyst requesting: updated water withdrawal data, efficiency improvements, recycling rates, and regulatory compliance history. Data package due Mar 22.' },
      { id: 'esg-stk-3', type: 'NGO Watchdog', detail: 'Environmental advocacy group published water discharge report mentioning 2 portfolio facilities', status: 'Monitoring', expandDetail: 'Chesapeake Bay Foundation report highlights industrial contributors. Baltimore Processing and Cambridge Seafood Plant mentioned. Report recommends enhanced monitoring. Communications team assessing response.' },
    ],
    source: 'AI analysis of investor relations, ESG rating agencies, media monitoring, and NGO publications',
  }),

  biotech: (_n, _st) => ({
    title: 'Stakeholder Watch',
    subtitle: 'Regulatory, investor, and community engagement updates',
    items: [
      { id: 'bio-stk-1', type: 'FDA / EPA', detail: 'FDA CDER pre-approval inspection scheduled for RTP Biologics — water system qualification in scope', status: 'Prepare', expandDetail: 'Inspection window: Apr 14-18. Water system qualification documentation, trending data, and CAPA history for WFI and PW systems must be current. Pre-inspection readiness review recommended Mar 15.' },
      { id: 'bio-stk-2', type: 'Investors', detail: 'Board sustainability committee requesting water risk metrics for quarterly ESG update', status: 'Compile Data', expandDetail: 'Metrics requested: water intensity per unit of production, recycling rate, NPDES compliance rate, and pharmaceutical compound discharge monitoring results. Due to committee by Mar 18.' },
      { id: 'bio-stk-3', type: 'Community Advisory', detail: 'Community advisory panel meeting scheduled — agenda includes facility discharge transparency', status: 'Prepare Presentation', expandDetail: 'Quarterly CAP meeting Mar 12. Community members requesting plain-language explanation of discharge monitoring reports and pharmaceutical compound levels. Prepare visual aids and FAQ.' },
    ],
    source: 'AI analysis of FDA inspection database, investor relations, and community advisory panel communications',
  }),

  investor: (_n, _st) => ({
    title: 'Stakeholder Watch',
    subtitle: 'Portfolio company, regulatory, and LP engagement updates',
    items: [
      { id: 'inv-stk-1', type: 'Portfolio Company', detail: '2 portfolio companies requesting guidance on new PFAS disclosure requirements', status: 'Advisory Needed', expandDetail: 'AquaTech Industries and Coastal Processing seeking interpretation of proposed EPA PFAS reporting rule. Both have potential PFAS exposure in manufacturing processes. Legal and compliance advisory call scheduled.' },
      { id: 'inv-stk-2', type: 'ESG Rating Agency', detail: 'Sustainalytics requesting updated portfolio-level water risk data for annual assessment', status: 'Compile Data', expandDetail: 'Annual ESG risk rating review. Requesting: aggregated water withdrawal, discharge, recycling metrics across all holdings. Deadline: Mar 25. Last year score: 22.4 (Medium Risk).' },
      { id: 'inv-stk-3', type: 'LP Advisory', detail: 'Limited partners requesting water risk integration update for annual investor meeting', status: 'Prepare Deck', expandDetail: 'Annual LP meeting Apr 5. ESG committee requesting: portfolio water risk heat map, regulatory compliance trends, and water-related capex across holdings. 15-minute presentation slot allocated.' },
    ],
    source: 'AI analysis of portfolio company correspondence, ESG rating agencies, and LP communications',
  }),
};

/* ------------------------------------------------------------------ */
/*  WhatChangedOvernight                                               */
/* ------------------------------------------------------------------ */

export function WhatChangedOvernight({ entityType, entityName, stateAbbr }: BriefingCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const name = entityName || stateAbbr || 'Your Organization';
  const st = stateAbbr || 'US';
  const d = changesData[entityType](name, st);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          {d.title}
        </CardTitle>
        <CardDescription>{d.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {d.items.map(c => (
            <div key={c.id}>
              <div
                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:ring-1 hover:ring-purple-300 transition-all"
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              >
                <span className="text-2xs font-mono text-slate-400 whitespace-nowrap mt-0.5">{c.time}</span>
                <span className="text-xs text-slate-700 flex-1">{c.change}</span>
                <ChevronDown size={14} className={`flex-shrink-0 text-slate-400 transition-transform mt-0.5 ${expandedId === c.id ? 'rotate-180' : ''}`} />
              </div>
              {expandedId === c.id && (
                <div className="ml-4 mt-1 rounded-lg border border-purple-200 bg-purple-50/60 p-3">
                  <p className="text-xs text-slate-700">{c.detail}</p>
                  <p className="text-2xs text-purple-600 mt-2 font-medium">Navigate to source data — Coming Soon</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4 italic">Data source: {d.source}</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  StakeholderWatch                                                   */
/* ------------------------------------------------------------------ */

export function StakeholderWatch({ entityType, entityName, stateAbbr }: BriefingCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const name = entityName || stateAbbr || 'Your Organization';
  const st = stateAbbr || 'US';
  const d = stakeholderData[entityType](name, st);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-indigo-600" />
          {d.title}
        </CardTitle>
        <CardDescription>{d.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {d.items.map(s => (
            <div key={s.id}>
              <div
                className="rounded-lg border border-slate-200 p-3 cursor-pointer hover:ring-1 hover:ring-indigo-300 transition-all"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-2xs">{s.type}</Badge>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-2xs">{s.status}</Badge>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedId === s.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                <p className="text-xs text-slate-700">{s.detail}</p>
              </div>
              {expandedId === s.id && (
                <div className="ml-4 mt-1 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
                  <p className="text-xs text-slate-700">{s.expandDetail}</p>
                  <p className="text-2xs text-indigo-600 mt-2 font-medium">Open full context — Coming Soon</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4 italic">Data source: {d.source}</p>
      </CardContent>
    </Card>
  );
}
