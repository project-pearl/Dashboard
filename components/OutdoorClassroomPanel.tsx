'use client';

import { useMemo, useState } from 'react';
import { MockDataBadge } from './MockDataBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TreePine,
  Sun,
  MapPin,
  Binoculars,
  BookOpen,
  CloudSun,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  ExternalLink,
  Microscope,
} from 'lucide-react';

// ── Props ───────────────────────────────────────────────────────────────────

interface OutdoorClassroomPanelProps {
  stateAbbr: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const OUTDOOR_SITES = [
  { id: 1, name: 'Riverside Nature Trail', type: 'Stream Study', distance: '0.3 mi', rating: 'Excellent', features: ['Water testing access', 'Wildlife observation', 'Picnic area'] },
  { id: 2, name: 'Community Wetland Preserve', type: 'Wetland Lab', distance: '1.2 mi', rating: 'Good', features: ['Boardwalk trail', 'Bird blinds', 'Plant ID stations'] },
  { id: 3, name: 'Lake Overlook Education Center', type: 'Lake Study', distance: '2.5 mi', rating: 'Excellent', features: ['Boat launch', 'Water sampling dock', 'Indoor classroom'] },
  { id: 4, name: 'Storm Drain Discovery Park', type: 'Urban Watershed', distance: '0.8 mi', rating: 'Good', features: ['Rain garden', 'Storm drain stenciling', 'Runoff models'] },
  { id: 5, name: 'Woodland Creek Outdoor Lab', type: 'Forest Ecology', distance: '3.1 mi', rating: 'Fair', features: ['Canopy walkway', 'Soil testing area', 'Macroinvertebrate sampling'] },
];

const FIELD_TRIP_CHECKLIST = [
  { task: 'Submit field trip request form', done: true },
  { task: 'Obtain parent/guardian permission slips', done: true },
  { task: 'Check water testing kit supplies', done: false },
  { task: 'Review safety protocols with students', done: false },
  { task: 'Confirm transportation arrangements', done: true },
  { task: 'Prepare nature journal materials', done: false },
  { task: 'Download species ID guides for the area', done: false },
  { task: 'Pack first aid kit and emergency contacts', done: true },
];

const SPECIES_GUIDES = [
  { name: 'Freshwater Macroinvertebrates', category: 'Aquatic', url: 'https://natureforward.org/creek-critters/', icon: '🦐' },
  { name: 'Common Riparian Plants', category: 'Plants', url: '#', icon: '🌿' },
  { name: 'Wetland Bird Species', category: 'Birds', url: '#', icon: '🦆' },
  { name: 'Stream Fish Identification', category: 'Fish', url: '#', icon: '🐟' },
  { name: 'Amphibians & Reptiles', category: 'Herps', url: '#', icon: '🐸' },
];

const CITIZEN_SCIENCE_TOOLS = [
  {
    name: 'Creek Critters',
    org: 'Nature Forward',
    url: 'https://natureforward.org/creek-critters/',
    description: 'Free app for identifying 30+ aquatic macroinvertebrates and generating stream health reports. Students find organisms, ID them with visual keys, and submit findings to the Clean Water Hub.',
    tags: ['iOS', 'Android', 'Free'],
  },
  {
    name: 'Clean Water Hub',
    org: 'Izaak Walton League',
    url: 'https://cleanwaterhub.org/',
    description: 'National volunteer monitoring database. Submit water quality observations and stream health data from Creek Critters or manual sampling.',
    tags: ['Data Sharing', 'Free'],
  },
];

const JOURNAL_PROMPTS = [
  'Sketch the stream and label 3 things you observe about the water flow.',
  'What sounds do you hear near the water? List at least 5.',
  'Find 3 different types of leaves near the stream bank. Draw and describe each one.',
  'How does the water look, smell, and feel? Use descriptive words.',
  'If you were a fish living here, what would your day be like? Write a short story.',
  'Draw a food web using organisms you observed today.',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function ratingColor(rating: string): string {
  if (rating === 'Excellent') return 'bg-emerald-100 text-emerald-700';
  if (rating === 'Good') return 'bg-blue-100 text-blue-700';
  return 'bg-amber-100 text-amber-700';
}

// ── Component ───────────────────────────────────────────────────────────────

export function OutdoorClassroomPanel({ stateAbbr }: OutdoorClassroomPanelProps) {
  const [expandedSite, setExpandedSite] = useState<number | null>(null);
  const [showAllPrompts, setShowAllPrompts] = useState(false);

  const completedTasks = useMemo(
    () => FIELD_TRIP_CHECKLIST.filter((t) => t.done).length,
    [],
  );
  const totalTasks = FIELD_TRIP_CHECKLIST.length;
  const completionPct = Math.round((completedTasks / totalTasks) * 100);

  const visiblePrompts = showAllPrompts ? JOURNAL_PROMPTS : JOURNAL_PROMPTS.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <TreePine className="w-3.5 h-3.5" />
        <span>
          Outdoor Classroom Resources — {stateAbbr || 'All States'}
          <MockDataBadge />
        </span>
      </div>

      {/* ── Section 1: Nearby Outdoor Classroom Sites ──────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin size={16} className="text-emerald-600" />
            Nearby Outdoor Classroom Sites
            <Badge variant="secondary" className="ml-1 text-2xs">
              {OUTDOOR_SITES.length} locations
            </Badge>
          </CardTitle>
          <CardDescription>
            Field study locations near your school — click a site for details!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {OUTDOOR_SITES.map((site) => {
              const isExpanded = expandedSite === site.id;
              return (
                <div
                  key={site.id}
                  className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setExpandedSite(isExpanded ? null : site.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin size={14} className="text-emerald-600 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 truncate">{site.name}</span>
                      <Badge className={`text-2xs ${ratingColor(site.rating)}`}>{site.rating}</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-2xs text-slate-500">{site.distance}</span>
                      <Badge variant="secondary" className="text-2xs">{site.type}</Badge>
                      {isExpanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-2xs text-slate-500 uppercase tracking-wide mb-1">Available Features</p>
                      <div className="flex flex-wrap gap-1">
                        {site.features.map((f) => (
                          <Badge key={f} variant="outline" className="text-2xs text-slate-600">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Field Trip Planning Checklist ───────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun size={16} className="text-amber-500" />
            Field Trip Planning Checklist
            <Badge className={`ml-1 text-2xs ${completionPct === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {completedTasks}/{totalTasks} complete
            </Badge>
          </CardTitle>
          <CardDescription>
            Track your preparation progress before heading outdoors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
              <span>Progress</span>
              <span className="font-semibold text-slate-700">{completionPct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${completionPct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            {FIELD_TRIP_CHECKLIST.map((item) => (
              <div key={item.task} className="flex items-center gap-2 text-xs">
                <CheckCircle
                  size={14}
                  className={item.done ? 'text-emerald-500' : 'text-slate-300'}
                />
                <span className={item.done ? 'text-slate-500 line-through' : 'text-slate-700'}>
                  {item.task}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Species Identification Guides & Weather ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Binoculars size={16} className="text-blue-600" />
              Species ID Guides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SPECIES_GUIDES.map((guide) => {
                const isExternal = guide.url !== '#';
                const Tag = isExternal ? 'a' : 'div';
                return (
                  <Tag
                    key={guide.name}
                    {...(isExternal ? { href: guide.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="flex items-center gap-2 rounded-md border border-slate-200 p-2 hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <span className="text-base">{guide.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{guide.name}</p>
                      <p className="text-2xs text-slate-400">{guide.category}</p>
                    </div>
                    {isExternal ? <ExternalLink size={12} className="text-blue-500 shrink-0" /> : <BookOpen size={12} className="text-blue-500 shrink-0" />}
                  </Tag>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CloudSun size={16} className="text-sky-500" />
              Weather & Safety
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <CloudSun size={20} className="text-sky-600" />
                <div>
                  <p className="text-sm font-bold text-sky-800">72°F — Partly Cloudy</p>
                  <p className="text-2xs text-sky-600">Great conditions for outdoor learning!</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-2xs">
                <div className="rounded bg-white p-1.5 border border-sky-100">
                  <p className="font-bold text-sky-700">5 mph</p>
                  <p className="text-slate-500">Wind</p>
                </div>
                <div className="rounded bg-white p-1.5 border border-sky-100">
                  <p className="font-bold text-sky-700">Low</p>
                  <p className="text-slate-500">UV Index</p>
                </div>
                <div className="rounded bg-white p-1.5 border border-sky-100">
                  <p className="font-bold text-sky-700">0%</p>
                  <p className="text-slate-500">Rain</p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                <span className="text-slate-700">Air quality: Good (AQI 32)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                <span className="text-slate-700">No severe weather alerts</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                <span className="text-slate-700">Trail conditions: Dry and passable</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 3b: Community Science Tools ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Microscope size={16} className="text-teal-600" />
            Community Science Tools
          </CardTitle>
          <CardDescription>
            Free apps and platforms for student-driven water monitoring and data sharing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {CITIZEN_SCIENCE_TOOLS.map((tool) => (
              <a
                key={tool.name}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-teal-200 bg-teal-50/50 p-3 hover:bg-teal-50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-teal-800">{tool.name}</span>
                      <ExternalLink size={10} className="text-teal-400 group-hover:text-teal-600 transition-colors shrink-0" />
                    </div>
                    <p className="text-2xs text-teal-600 mb-1">{tool.org}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{tool.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {tool.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-2xs bg-teal-100 text-teal-700 border-teal-200">{tag}</Badge>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Nature Journaling Prompts ──────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen size={16} className="text-violet-600" />
            Nature Journaling Prompts
            <Badge variant="secondary" className="ml-1 text-2xs">
              {JOURNAL_PROMPTS.length} prompts
            </Badge>
          </CardTitle>
          <CardDescription>
            Use these prompts to guide student observations and writing during outdoor activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {visiblePrompts.map((prompt, idx) => (
              <div key={idx} className="flex items-start gap-2 rounded-md border border-violet-100 bg-violet-50 p-2.5">
                <span className="text-xs font-bold text-violet-600 mt-0.5 shrink-0">#{idx + 1}</span>
                <p className="text-xs text-violet-800">{prompt}</p>
              </div>
            ))}
          </div>
          {JOURNAL_PROMPTS.length > 3 && (
            <button
              onClick={() => setShowAllPrompts((p) => !p)}
              className="mt-3 w-full text-center text-xs text-violet-600 hover:text-violet-800 font-medium py-1.5 rounded-md hover:bg-violet-50 transition-colors"
            >
              {showAllPrompts ? 'Show fewer prompts' : `Show all ${JOURNAL_PROMPTS.length} prompts`}
              {showAllPrompts ? (
                <ChevronUp size={12} className="inline ml-1" />
              ) : (
                <ChevronDown size={12} className="inline ml-1" />
              )}
            </button>
          )}
          <p className="text-2xs text-slate-400 mt-2 flex items-center gap-1">
            <Info size={10} />
            Prompts aligned with NGSS Earth &amp; Space Science and Life Science standards.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
