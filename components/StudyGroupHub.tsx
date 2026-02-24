// ============================================================
// StudyGroupHub — College-only collaborative learning panel
// Enables students to form study groups, share datasets,
// and coordinate field sampling sessions.
// ============================================================
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, MapPin, Calendar, MessageCircle, Plus, Search } from 'lucide-react';

type Props = {
  stateAbbr: string;
  regionId?: string;
};

interface StudyGroup {
  id: string;
  name: string;
  focus: string;
  institution: string;
  memberCount: number;
  maxMembers: number;
  waterbodies: string[];
  meetingSchedule: string;
  status: 'active' | 'forming' | 'full';
  tags: string[];
}

// ─── Mock data (replace with API) ──────────────────────────────────────────

function getMockGroups(stateAbbr: string): StudyGroup[] {
  const stateGroups: Record<string, StudyGroup[]> = {
    MD: [
      {
        id: 'sg-1', name: 'Bay Biofiltration Lab', focus: 'Oyster filtration rates & water quality',
        institution: 'UMCES - Chesapeake Biological Lab', memberCount: 4, maxMembers: 6,
        waterbodies: ['Patuxent River', 'Back River'], meetingSchedule: 'Tuesdays 2-4pm',
        status: 'active', tags: ['biofiltration', 'oysters', 'TSS'],
      },
      {
        id: 'sg-2', name: 'Urban Stormwater Collective', focus: 'MS4 compliance & green infrastructure',
        institution: 'UMD - Environmental Science', memberCount: 6, maxMembers: 6,
        waterbodies: ['Gwynns Falls', 'Jones Falls', 'Inner Harbor'], meetingSchedule: 'Thursdays 1-3pm',
        status: 'full', tags: ['stormwater', 'MS4', 'urban'],
      },
      {
        id: 'sg-3', name: 'Nutrient Loading Research Group', focus: 'Nitrogen & phosphorus dynamics in tidal systems',
        institution: 'Towson University', memberCount: 2, maxMembers: 5,
        waterbodies: ['Gunpowder Falls', 'Loch Raven'], meetingSchedule: 'Forming — flexible',
        status: 'forming', tags: ['nutrients', 'TN', 'TP', 'tidal'],
      },
    ],
    FL: [
      {
        id: 'sg-4', name: 'Gulf Coast Monitoring Team', focus: 'Coastal water quality & ALIA pilot data',
        institution: 'UWF - Marine Science', memberCount: 3, maxMembers: 5,
        waterbodies: ['Pensacola Bay', 'Escambia River'], meetingSchedule: 'Wednesdays 3-5pm',
        status: 'active', tags: ['coastal', 'ALIA', 'pilot data'],
      },
    ],
    VA: [
      {
        id: 'sg-5', name: 'James River Restoration Group', focus: 'Riparian buffer assessment & WQ monitoring',
        institution: 'Virginia Tech', memberCount: 5, maxMembers: 8,
        waterbodies: ['James River - Lower', 'Elizabeth River'], meetingSchedule: 'Mon/Wed 4-5:30pm',
        status: 'active', tags: ['restoration', 'riparian', 'monitoring'],
      },
    ],
  };
  return stateGroups[stateAbbr] || [];
}

// ─── Component ─────────────────────────────────────────────────────────────

export function StudyGroupHub({ stateAbbr, regionId }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const groups = getMockGroups(stateAbbr);
  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
    g.focus.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusStyle = (status: StudyGroup['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 border-green-200';
      case 'forming': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'full': return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-3">
      {/* Search + Create */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search groups by topic, waterbody, or tag..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus className="h-3 w-3 mr-1" /> New Group
        </Button>
      </div>

      {/* Create form stub */}
      {showCreateForm && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-emerald-800">Create a Study Group</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input placeholder="Group name" className="px-2.5 py-1.5 text-xs border border-emerald-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            <input placeholder="Research focus" className="px-2.5 py-1.5 text-xs border border-emerald-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            <input placeholder="Your institution" className="px-2.5 py-1.5 text-xs border border-emerald-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            <input placeholder="Waterbody/region focus" className="px-2.5 py-1.5 text-xs border border-emerald-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white">Create Group</Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowCreateForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Group listings */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400">
          No study groups found for {stateAbbr}. Be the first to create one!
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map(group => (
            <div key={group.id} className="bg-white rounded-lg border border-slate-200 p-3 hover:border-emerald-300 transition-colors">
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    {group.name}
                    <Badge variant="outline" className={`text-[9px] h-4 ${statusStyle(group.status)}`}>
                      {group.status}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-slate-500">{group.focus}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-6 px-2"
                  disabled={group.status === 'full'}
                >
                  {group.status === 'full' ? 'Full' : 'Join'}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 mt-2">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {group.memberCount}/{group.maxMembers}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {group.institution}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {group.meetingSchedule}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                {group.waterbodies.map(wb => (
                  <span key={wb} className="px-1.5 py-0.5 rounded text-[9px] bg-blue-50 text-blue-600 border border-blue-100">{wb}</span>
                ))}
                {group.tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-50 text-slate-500 border border-slate-100">#{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Field Sampling Coordination */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-xs font-semibold text-blue-800 mb-1">🗓️ Upcoming Field Sampling Sessions</div>
        <p className="text-[10px] text-blue-700 mb-2">
          Coordinate with your study group for joint field sampling. ALIA sensors provide continuous baseline data
          between your sampling events.
        </p>
        <div className="text-[10px] text-blue-500 italic">No upcoming sessions scheduled. Create one from your study group page.</div>
      </div>
    </div>
  );
}
