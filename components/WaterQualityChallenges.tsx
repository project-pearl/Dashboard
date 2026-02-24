'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Context = 'k12-student' | 'k12-teacher' | 'academic' | 'ngo';

interface WaterQualityChallengesProps {
  context: Context;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Challenge data – context-specific content for each threat          */
/* ------------------------------------------------------------------ */

interface ChallengeBase {
  id: string;
  emoji: string;
  studentTitle: string;
  academicTitle: string;
  ngoTitle: string;
  studentDesc: string;
  teacherScientific: string;
  teacherNGSS: string;
  teacherQuestion: string;
  academicDesc: string;
  academicScale: string;
  academicGap: string;
  ngoDesc: string;
  ngoPopulation: string;
  ngoEJ: string;
  ngoAction: string;
  ngoGrant: string;
  pearlCallout: string;
}

const CHALLENGES: ChallengeBase[] = [
  {
    id: 'nutrient',
    emoji: '🧪',
    studentTitle: 'Too Many Nutrients',
    academicTitle: 'Nutrient Pollution & Eutrophication',
    ngoTitle: 'Nutrient Pollution Crisis',
    studentDesc:
      'When extra fertilizer washes into rivers and lakes, it feeds algae that grow out of control. These algae blooms use up oxygen and can make water unsafe for fish and people.',
    teacherScientific:
      'Excess nitrogen (N) and phosphorus (P) from agricultural runoff, wastewater discharge, and atmospheric deposition drive eutrophication—leading to hypoxic "dead zones" and harmful algal blooms (HABs).',
    teacherNGSS: 'ESS3.C, LS2.B, MS-ESS3-3',
    teacherQuestion:
      'How might reducing fertilizer use upstream affect dissolved oxygen levels downstream?',
    academicDesc:
      'Anthropogenic nutrient loading remains the primary driver of freshwater and coastal eutrophication, with cascading effects on dissolved oxygen, biodiversity, and potable water supplies.',
    academicScale: '~50% of U.S. streams show elevated N/P beyond EPA thresholds',
    academicGap:
      'Real-time nutrient flux modeling that integrates land-use change with in-stream sensor networks',
    ngoDesc:
      'Nutrient pollution fuels toxic algal blooms that close beaches, contaminate drinking water, and devastate aquatic ecosystems—disproportionately harming communities with fewer resources to respond.',
    ngoPopulation: '100M+ Americans rely on waterways impaired by nutrient pollution',
    ngoEJ:
      'Low-income and rural communities often bear the highest exposure to contaminated well water and lack early-warning systems.',
    ngoAction:
      'Advocate for nutrient management plans and support watershed-level monitoring programs.',
    ngoGrant: 'EPA 319(h), USDA EQIP, state NPS grants',
    pearlCallout:
      'ALIA sensors track nitrate and phosphate in real time so communities can spot blooms early.',
  },
  {
    id: 'sediment',
    emoji: '🏔️',
    studentTitle: 'Muddy Water Problems',
    academicTitle: 'Sediment Loading & Erosion',
    ngoTitle: 'Sediment & Erosion Damage',
    studentDesc:
      "Dirt and soil washing into streams makes the water cloudy. Fish can't see, plants can't grow, and the mud buries the rocks where insects and baby fish live.",
    teacherScientific:
      'Accelerated erosion from deforestation, construction, and agriculture increases total suspended solids (TSS), reducing light penetration, smothering benthic habitats, and transporting adsorbed pollutants.',
    teacherNGSS: 'ESS2.A, ESS3.C, MS-ESS2-2',
    teacherQuestion:
      'What land-use changes in a watershed could increase or decrease sediment load?',
    academicDesc:
      'Excessive sedimentation degrades aquatic habitat, impairs water treatment infrastructure, and serves as a vector for phosphorus, heavy metals, and hydrophobic organic contaminants.',
    academicScale: '~1.5 billion tons of sediment eroded annually in U.S. agricultural lands',
    academicGap:
      'High-resolution sediment provenance tracking using environmental DNA and isotope tracing',
    ngoDesc:
      'Erosion smothers aquatic habitats and clogs waterways, destroying the ecosystems that communities depend on for clean water, food, and recreation.',
    ngoPopulation: '40%+ of assessed U.S. water bodies list sediment as a leading impairment',
    ngoEJ:
      'Communities near active construction and agricultural zones face compounded sediment exposure with limited regulatory enforcement.',
    ngoAction:
      'Push for stronger erosion and sediment control ordinances; fund riparian buffer restoration.',
    ngoGrant: 'NRCS CRP, EPA 319(h), state erosion control funds',
    pearlCallout:
      'ALIA turbidity sensors detect sediment spikes after storms and construction activity.',
  },
  {
    id: 'bacteria',
    emoji: '🦠',
    studentTitle: 'Invisible Germs in Water',
    academicTitle: 'Microbial Contamination & Pathogen Loading',
    ngoTitle: 'Bacteria & Pathogen Threats',
    studentDesc:
      'Tiny germs like bacteria can hide in water that looks perfectly clean. They come from animal waste, broken sewers, and stormwater, and they can make people very sick.',
    teacherScientific:
      'Fecal indicator bacteria (E. coli, enterococci), protozoa (Cryptosporidium, Giardia), and viruses enter waterways via CSOs, failing septic systems, and agricultural runoff, posing acute public health risks.',
    teacherNGSS: 'LS2.A, ESS3.C, MS-LS2-4',
    teacherQuestion:
      'Why might pathogen levels spike after a heavy rainstorm, and what infrastructure failures contribute?',
    academicDesc:
      'Waterborne pathogen transmission via combined sewer overflows, agricultural runoff, and aging infrastructure remains a critical public health vector, complicated by antimicrobial resistance.',
    academicScale: '~7.2M Americans get sick annually from waterborne pathogens (CDC est.)',
    academicGap:
      'Rapid, field-deployable molecular diagnostics for source-tracking viable pathogens in real time',
    ngoDesc:
      'Bacterial contamination from aging sewers, livestock operations, and septic failures threatens drinking water and recreational access for millions.',
    ngoPopulation: '2M+ Americans lack access to safe running water or indoor plumbing',
    ngoEJ:
      'Tribal nations, rural communities, and environmental justice areas face chronic sewage infrastructure underinvestment.',
    ngoAction:
      'Support infrastructure funding for underserved communities; demand transparent water quality reporting.',
    ngoGrant: 'EPA WIIN Act, SRF loans, Indian Health Service sanitation funds',
    pearlCallout:
      'ALIA continuously monitors indicator bacteria levels so health warnings can go out fast.',
  },
  {
    id: 'stormwater',
    emoji: '🌧️',
    studentTitle: 'Stormwater Runoff',
    academicTitle: 'Urban Stormwater Runoff & Nonpoint Source Pollution',
    ngoTitle: 'Stormwater Flooding & Pollution',
    studentDesc:
      'When rain falls on roads and parking lots, it picks up oil, trash, and chemicals. This dirty water rushes into streams without being cleaned first.',
    teacherScientific:
      'Impervious surfaces in urbanized watersheds accelerate surface runoff, increasing pollutant transport (hydrocarbons, metals, thermal pollution) and peak discharge while reducing baseflow recharge.',
    teacherNGSS: 'ESS3.C, ESS2.C, MS-ESS3-3',
    teacherQuestion:
      'How does increasing impervious surface area in a city change the hydrograph of a nearby stream?',
    academicDesc:
      'Urbanization-driven increases in impervious cover fundamentally alter watershed hydrology, elevating contaminant flux, peak discharge, and thermal stress while suppressing groundwater recharge.',
    academicScale: '~75% of urban waterways exceed one or more pollutant benchmarks post-storm',
    academicGap:
      'Integrated green-gray infrastructure optimization models validated with continuous sensor data',
    ngoDesc:
      'Stormwater runoff is the fastest-growing source of water pollution in the U.S., flooding neighborhoods and flushing toxic contaminants into local waterways.',
    ngoPopulation: '~860 communities still operate combined sewer systems that overflow during storms',
    ngoEJ:
      'Flood-prone neighborhoods are disproportionately low-income communities of color with the least access to green infrastructure.',
    ngoAction:
      'Champion green infrastructure investment and equitable stormwater utility fee structures.',
    ngoGrant: 'EPA Green Infrastructure grants, FEMA BRIC, state MS4 compliance funds',
    pearlCallout:
      'ALIA tracks flow rates and pollutant surges during storms so cities can respond in real time.',
  },
  {
    id: 'microplastics',
    emoji: '🔬',
    studentTitle: "Tiny Plastics You Can't See",
    academicTitle: 'Microplastics & Contaminants of Emerging Concern',
    ngoTitle: 'Microplastics & Emerging Contaminants',
    studentDesc:
      'Pieces of plastic smaller than a grain of sand are showing up everywhere—in rivers, lakes, and even drinking water. Scientists are still figuring out how they affect our health.',
    teacherScientific:
      'Microplastics (<5 mm), PFAS ("forever chemicals"), pharmaceuticals, and endocrine disruptors represent contaminants of emerging concern (CECs) that resist conventional water treatment processes.',
    teacherNGSS: 'ESS3.C, PS1.B, MS-ESS3-3',
    teacherQuestion:
      'Why are microplastics and PFAS particularly difficult to remove from water, and what makes them "forever" chemicals?',
    academicDesc:
      'Microplastics and PFAS represent a paradigm shift in water quality management—persistent, bioaccumulative, and inadequately addressed by conventional treatment, with poorly understood synergistic toxicology.',
    academicScale: '~94% of U.S. tap water samples contain microplastic fibers (Orb Media)',
    academicGap:
      'Standardized quantification methods and long-term epidemiological data linking CEC exposure to health outcomes',
    ngoDesc:
      'Microplastics and "forever chemicals" like PFAS are contaminating drinking water nationwide. Communities near industrial sites and military bases face the most severe exposure.',
    ngoPopulation: '110M+ Americans may have PFAS in their drinking water',
    ngoEJ:
      'PFAS contamination clusters around military bases, industrial facilities, and landfills often sited near disadvantaged communities.',
    ngoAction:
      'Demand enforceable PFAS limits, fund advanced filtration for affected communities, and support right-to-know legislation.',
    ngoGrant: 'EPA PFAS Strategic Roadmap funding, DWSRF, DOD remediation funds',
    pearlCallout:
      'ALIA helps researchers track where emerging contaminants concentrate in watersheds.',
  },
];

/* ------------------------------------------------------------------ */
/*  Palette helpers                                                    */
/* ------------------------------------------------------------------ */

const PALETTES = {
  'k12-student': {
    wrapper: 'bg-gradient-to-br from-amber-50 to-sky-50',
    card: 'border-amber-200 bg-white hover:shadow-md',
    heading: 'text-sky-900',
    subheading: 'text-amber-700',
    body: 'text-slate-700',
    callout: 'bg-sky-50 border-sky-200 text-sky-800',
    calloutLabel: 'text-sky-700',
    badge: 'bg-amber-100 text-amber-800',
    title: 'text-sky-800',
  },
  'k12-teacher': {
    wrapper: 'bg-gradient-to-br from-amber-50 to-sky-50',
    card: 'border-amber-200 bg-white hover:shadow-md',
    heading: 'text-sky-900',
    subheading: 'text-amber-700',
    body: 'text-slate-700',
    callout: 'bg-sky-50 border-sky-200 text-sky-800',
    calloutLabel: 'text-sky-700',
    badge: 'bg-amber-100 text-amber-800',
    title: 'text-sky-800',
    standard: 'bg-amber-50 border-amber-200 text-amber-800',
    question: 'bg-sky-50 border-sky-200 text-sky-800',
  },
  academic: {
    wrapper: 'bg-gradient-to-br from-violet-50 to-indigo-50',
    card: 'border-indigo-200 bg-white hover:shadow-md',
    heading: 'text-indigo-900',
    subheading: 'text-violet-700',
    body: 'text-slate-700',
    callout: 'bg-violet-50 border-violet-200 text-violet-800',
    calloutLabel: 'text-violet-700',
    badge: 'bg-indigo-100 text-indigo-800',
    title: 'text-indigo-800',
    stat: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    gap: 'bg-violet-50 border-violet-200 text-violet-800',
  },
  ngo: {
    wrapper: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    card: 'border-teal-200 bg-white hover:shadow-md',
    heading: 'text-teal-900',
    subheading: 'text-emerald-700',
    body: 'text-slate-700',
    callout: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    calloutLabel: 'text-emerald-700',
    badge: 'bg-teal-100 text-teal-800',
    title: 'text-teal-800',
    stat: 'bg-teal-50 border-teal-200 text-teal-800',
    ej: 'bg-amber-50 border-amber-200 text-amber-800',
    action: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    grant: 'bg-teal-50 border-teal-200 text-teal-800',
  },
} as const;

const SECTION_TITLES: Record<Context, string> = {
  'k12-student': 'Top 5 Threats to Our Water',
  'k12-teacher': 'Top 5 U.S. Water Quality Challenges',
  academic: 'Principal Threats to U.S. Water Quality',
  ngo: 'Critical Water Quality Threats Demanding Action',
};

/* ------------------------------------------------------------------ */
/*  Per-context card renderers                                         */
/* ------------------------------------------------------------------ */

function StudentCard({ c, p }: { c: ChallengeBase; p: typeof PALETTES['k12-student'] }) {
  return (
    <div className={cn('rounded-xl border-2 p-4 transition-all', p.card)}>
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0" role="img" aria-label={c.studentTitle}>
          {c.emoji}
        </span>
        <div className="space-y-2">
          <h3 className={cn('text-base font-bold', p.title)}>{c.studentTitle}</h3>
          <p className={cn('text-sm leading-relaxed', p.body)}>{c.studentDesc}</p>
          <div className={cn('rounded-lg border px-3 py-2 text-xs', p.callout)}>
            <span className={cn('font-semibold', p.calloutLabel)}>What ALIA does: </span>
            {c.pearlCallout}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherCard({ c, p }: { c: ChallengeBase; p: typeof PALETTES['k12-teacher'] }) {
  return (
    <div className={cn('rounded-xl border-2 p-4 transition-all', p.card)}>
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0" role="img" aria-label={c.studentTitle}>
          {c.emoji}
        </span>
        <div className="space-y-2">
          <h3 className={cn('text-base font-bold', p.title)}>{c.studentTitle}</h3>
          <p className={cn('text-sm leading-relaxed', p.body)}>{c.studentDesc}</p>

          <div className={cn('rounded-lg border px-3 py-2 text-xs', p.standard)}>
            <span className={cn('font-semibold', p.calloutLabel)}>Scientific context: </span>
            {c.teacherScientific}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', p.badge)}>
              NGSS {c.teacherNGSS}
            </span>
          </div>

          <div className={cn('rounded-lg border px-3 py-2 text-xs', p.question)}>
            <span className={cn('font-semibold', p.calloutLabel)}>Discussion: </span>
            {c.teacherQuestion}
          </div>

          <div className={cn('rounded-lg border px-3 py-2 text-xs', p.callout)}>
            <span className={cn('font-semibold', p.calloutLabel)}>What ALIA does: </span>
            {c.pearlCallout}
          </div>
        </div>
      </div>
    </div>
  );
}

function AcademicCard({ c, p }: { c: ChallengeBase; p: typeof PALETTES['academic'] }) {
  return (
    <div className={cn('rounded-xl border-2 p-4 transition-all', p.card)}>
      <div className="space-y-3">
        <h3 className={cn('text-sm font-bold uppercase tracking-wide', p.title)}>
          {c.academicTitle}
        </h3>
        <p className={cn('text-sm leading-relaxed', p.body)}>{c.academicDesc}</p>

        <div className={cn('rounded-lg border px-3 py-2 text-xs', p.stat)}>
          <span className={cn('font-semibold', p.calloutLabel)}>Current Scale: </span>
          {c.academicScale}
        </div>

        <div className={cn('rounded-lg border px-3 py-2 text-xs', p.gap)}>
          <span className={cn('font-semibold', p.calloutLabel)}>Key Research Gap: </span>
          {c.academicGap}
        </div>
      </div>
    </div>
  );
}

function NgoCard({ c, p }: { c: ChallengeBase; p: typeof PALETTES['ngo'] }) {
  return (
    <div className={cn('rounded-xl border-2 p-4 transition-all', p.card)}>
      <div className="space-y-3">
        <h3 className={cn('text-sm font-bold uppercase tracking-wide', p.title)}>
          {c.ngoTitle}
        </h3>
        <p className={cn('text-sm leading-relaxed', p.body)}>{c.ngoDesc}</p>

        <div className={cn('rounded-lg border px-3 py-2 text-xs', p.stat)}>
          <span className={cn('font-semibold', p.calloutLabel)}>Affected: </span>
          {c.ngoPopulation}
        </div>

        <div className={cn('rounded-lg border px-3 py-2 text-xs', p.ej)}>
          <span className="font-semibold text-amber-700">EJ Dimension: </span>
          {c.ngoEJ}
        </div>

        <div className={cn('rounded-lg border px-3 py-2 text-xs', p.action)}>
          <span className={cn('font-semibold', p.calloutLabel)}>How You Can Act: </span>
          {c.ngoAction}
        </div>

        <div className={cn('rounded-lg border px-3 py-2 text-xs', p.grant)}>
          <span className={cn('font-semibold', p.calloutLabel)}>Grant Alignment: </span>
          {c.ngoGrant}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function WaterQualityChallenges({ context, className }: WaterQualityChallengesProps) {
  const p = PALETTES[context];

  return (
    <section className={cn('rounded-2xl p-5 sm:p-6', p.wrapper, className)}>
      <h2 className={cn('text-lg font-bold mb-4', p.heading)}>{SECTION_TITLES[context]}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CHALLENGES.map((c) => {
          switch (context) {
            case 'k12-student':
              return <StudentCard key={c.id} c={c} p={PALETTES['k12-student']} />;
            case 'k12-teacher':
              return <TeacherCard key={c.id} c={c} p={PALETTES['k12-teacher']} />;
            case 'academic':
              return <AcademicCard key={c.id} c={c} p={PALETTES['academic']} />;
            case 'ngo':
              return <NgoCard key={c.id} c={c} p={PALETTES['ngo']} />;
          }
        })}
      </div>
    </section>
  );
}
