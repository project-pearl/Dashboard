// ============================================================
// InternshipBoard — College-only career & internship panel
// Water quality, environmental science, and PEARL-adjacent
// internship and career opportunities.
// ============================================================
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, MapPin, Clock, ExternalLink, Filter, Star } from 'lucide-react';

type Props = {
  stateAbbr: string;
};

interface Listing {
  id: string;
  title: string;
  org: string;
  type: 'internship' | 'fellowship' | 'co-op' | 'entry-level';
  location: string;
  remote: boolean;
  deadline: string;
  tags: string[];
  pearlRelevant: boolean;
  description: string;
  url?: string;
}

// ─── Mock listings (replace with API/CMS) ──────────────────────────────────

const LISTINGS: Listing[] = [
  {
    id: 'int-1', title: 'Water Quality Monitoring Intern', org: 'Chesapeake Bay Foundation',
    type: 'internship', location: 'Annapolis, MD', remote: false,
    deadline: '2026-03-15', tags: ['field work', 'WQ monitoring', 'Chesapeake Bay'],
    pearlRelevant: true, description: 'Assist with water quality sampling and data analysis across Bay tributaries. Exposure to real-time sensor networks and ATTAINS reporting.',
  },
  {
    id: 'int-2', title: 'Environmental Data Science Co-op', org: 'Biohabitats',
    type: 'co-op', location: 'Baltimore, MD', remote: false,
    deadline: '2026-04-01', tags: ['data science', 'GIS', 'ecological restoration'],
    pearlRelevant: true, description: 'Support ecological restoration projects with spatial analysis, water quality data processing, and client-facing dashboards.',
  },
  {
    id: 'int-3', title: 'NOAA Hollings Scholarship', org: 'NOAA',
    type: 'fellowship', location: 'Nationwide', remote: false,
    deadline: '2026-01-31', tags: ['oceanography', 'coastal science', 'federal'],
    pearlRelevant: false, description: 'Full scholarship + summer internship at a NOAA facility. Research in marine science, coastal resilience, or atmospheric science.',
  },
  {
    id: 'int-4', title: 'EPA Pathways Intern', org: 'U.S. EPA Region 3',
    type: 'internship', location: 'Philadelphia, PA', remote: true,
    deadline: '2026-05-01', tags: ['EPA', 'NPDES', 'regulatory'],
    pearlRelevant: true, description: 'Support NPDES permit reviews and MS4 compliance tracking. Exposure to ATTAINS data management and 303(d) listing process.',
  },
  {
    id: 'int-5', title: 'Stormwater Engineering Intern', org: 'Local Seafood Projects Inc.',
    type: 'internship', location: 'Maryland / Remote', remote: true,
    deadline: 'Rolling', tags: ['PEARL', 'stormwater', 'biofiltration', 'startup'],
    pearlRelevant: true, description: 'Work directly on Project PEARL — deploy and monitor oyster biofiltration units, analyze real-time water quality data, and contribute to MS4 compliance documentation.',
  },
  {
    id: 'int-6', title: 'Aquatic Ecology Research Assistant', org: 'UMCES',
    type: 'entry-level', location: 'Solomons, MD', remote: false,
    deadline: '2026-03-30', tags: ['ecology', 'research', 'field work'],
    pearlRelevant: false, description: 'Support ongoing Chesapeake Bay monitoring programs. Lab analysis, field sampling, and data entry for long-term ecological datasets.',
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

export function InternshipBoard({ stateAbbr }: Props) {
  const [filter, setFilter] = useState<'all' | 'pearl' | 'internship' | 'fellowship'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = LISTINGS.filter(l => {
    if (filter === 'pearl') return l.pearlRelevant;
    if (filter === 'internship') return l.type === 'internship';
    if (filter === 'fellowship') return l.type === 'fellowship';
    return true;
  });

  const typeStyle = (type: Listing['type']) => {
    switch (type) {
      case 'internship': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'fellowship': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'co-op': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'entry-level': return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-slate-400" />
        {(['all', 'pearl', 'internship', 'fellowship'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
              filter === f
                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200'
            }`}
          >
            {f === 'all' ? 'All Opportunities' :
             f === 'pearl' ? '🦪 PEARL-Related' :
             f === 'internship' ? 'Internships' : 'Fellowships'}
          </button>
        ))}
        <span className="text-[10px] text-slate-400 ml-auto">{filtered.length} opportunities</span>
      </div>

      {/* Listings */}
      <div className="space-y-2">
        {filtered.map(listing => (
          <div
            key={listing.id}
            className={`bg-white rounded-lg border p-3 transition-all cursor-pointer ${
              listing.pearlRelevant ? 'border-emerald-200 hover:border-emerald-400' : 'border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => setExpandedId(expandedId === listing.id ? null : listing.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  {listing.pearlRelevant && <Star className="h-3 w-3 text-emerald-500 fill-emerald-500 flex-shrink-0" />}
                  {listing.title}
                </div>
                <div className="text-[10px] text-slate-600 font-medium mt-0.5">{listing.org}</div>
              </div>
              <Badge variant="outline" className={`text-[9px] h-4 flex-shrink-0 ${typeStyle(listing.type)}`}>
                {listing.type}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 mt-1.5">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {listing.location} {listing.remote && '(Remote OK)'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Deadline: {listing.deadline}
              </span>
            </div>

            {expandedId === listing.id && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                <p className="text-[10px] text-slate-600 leading-relaxed mb-2">{listing.description}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {listing.tags.map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-50 text-slate-500 border border-slate-100">
                      {tag}
                    </span>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="text-[10px] h-6 border-blue-200 text-blue-600 hover:bg-blue-50">
                  <ExternalLink className="h-3 w-3 mr-1" /> View Full Listing
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* PEARL internship callout */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-3">
        <div className="text-xs font-semibold text-emerald-800 mb-1">🦪 Intern with Project PEARL</div>
        <p className="text-[10px] text-emerald-700 leading-relaxed">
          We're always looking for motivated students interested in water quality, aquaculture, data science, or environmental engineering.
          PEARL interns get hands-on experience with real deployment sites, sensor networks, and regulatory compliance workflows.
          Contact <span className="font-medium">careers@project-pearl.org</span> with your CV and research interests.
        </p>
      </div>
    </div>
  );
}
