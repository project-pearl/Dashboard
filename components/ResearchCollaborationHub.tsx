// ============================================================
// ResearchCollaborationHub — role-aware collaboration panel
// Researcher: co-investigator directory, dataset sharing, inter-institutional tools
// College: find advisors, join research groups, discover datasets
// ============================================================
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Users, BookOpen, Database, ExternalLink, Mail, Award } from 'lucide-react';

type Props = {
  userRole: 'Researcher' | 'College';
  stateAbbr?: string;
};

interface ResearcherProfile {
  id: string;
  name: string;
  institution: string;
  department: string;
  focus: string[];
  activeStudies: number;
  sharedDatasets: number;
  orcid?: string;
  acceptingStudents: boolean;
  pearlPartner: boolean;
}

// ─── Mock researcher directory ─────────────────────────────────────────────

const RESEARCHERS: ResearcherProfile[] = [
  {
    id: 'r-1', name: 'Dr. Erik Schott', institution: 'UMCES',
    department: 'Chesapeake Biological Lab', focus: ['oyster pathology', 'aquaculture', 'shellfish biology'],
    activeStudies: 3, sharedDatasets: 7, orcid: '0000-0002-xxxx-xxxx',
    acceptingStudents: true, pearlPartner: true,
  },
  {
    id: 'r-2', name: 'Dr. Sarah Chen', institution: 'University of Maryland',
    department: 'Environmental Science & Technology', focus: ['stormwater BMPs', 'nutrient dynamics', 'watershed modeling'],
    activeStudies: 2, sharedDatasets: 4, orcid: '0000-0001-xxxx-xxxx',
    acceptingStudents: true, pearlPartner: false,
  },
  {
    id: 'r-3', name: 'Dr. James Rivera', institution: 'Virginia Tech',
    department: 'Biological Systems Engineering', focus: ['biofiltration', 'ecological engineering', 'water treatment'],
    activeStudies: 4, sharedDatasets: 9, orcid: '0000-0003-xxxx-xxxx',
    acceptingStudents: false, pearlPartner: true,
  },
  {
    id: 'r-4', name: 'Dr. Lisa Park', institution: 'Towson University',
    department: 'Environmental Science', focus: ['urban hydrology', 'green infrastructure', 'community monitoring'],
    activeStudies: 1, sharedDatasets: 3, orcid: '0000-0001-yyyy-yyyy',
    acceptingStudents: true, pearlPartner: false,
  },
  {
    id: 'r-5', name: 'Dr. Amir Hassan', institution: 'Johns Hopkins University',
    department: 'Environmental Health & Engineering', focus: ['microplastics', 'emerging contaminants', 'sensor technology'],
    activeStudies: 5, sharedDatasets: 12,
    acceptingStudents: true, pearlPartner: true,
  },
];

// ─── Active Studies mock data ──────────────────────────────────────────────

interface ActiveStudy {
  id: string;
  title: string;
  pi: string;
  institution: string;
  waterbodies: string[];
  status: 'recruiting' | 'active' | 'completed';
  dataSharing: 'open' | 'restricted' | 'private';
  pearlData: boolean;
}

const ACTIVE_STUDIES: ActiveStudy[] = [
  {
    id: 'study-1', title: 'Oyster Biofiltration Efficacy in Urban Stormwater Outfalls',
    pi: 'Dr. Erik Schott', institution: 'UMCES', waterbodies: ['Back River', 'Middle Branch'],
    status: 'active', dataSharing: 'open', pearlData: true,
  },
  {
    id: 'study-2', title: 'Nutrient Loading Trends in Chesapeake Bay Tributaries (2020-2026)',
    pi: 'Dr. Sarah Chen', institution: 'UMD', waterbodies: ['Patuxent River', 'Severn River', 'Chester River'],
    status: 'active', dataSharing: 'open', pearlData: false,
  },
  {
    id: 'study-3', title: 'MS4 BMP Cost-Effectiveness Meta-Analysis',
    pi: 'Dr. James Rivera', institution: 'Virginia Tech', waterbodies: ['James River - Lower', 'Elizabeth River'],
    status: 'recruiting', dataSharing: 'restricted', pearlData: true,
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

export function ResearchCollaborationHub({ userRole, stateAbbr }: Props) {
  const [tab, setTab] = useState<'directory' | 'studies' | 'datasets'>('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const isCollege = userRole === 'College';

  const filteredResearchers = RESEARCHERS.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.institution.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.focus.some(f => f.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const studyStatusStyle = (s: ActiveStudy['status']) => {
    switch (s) {
      case 'recruiting': return 'bg-green-100 text-green-700 border-green-200';
      case 'active': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed': return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-3">
      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-1">
        {[
          { id: 'directory' as const, label: isCollege ? '🔍 Find Advisors' : '👥 Co-Investigators', icon: Users },
          { id: 'studies' as const, label: '📋 Active Studies', icon: BookOpen },
          { id: 'datasets' as const, label: '📊 Shared Datasets', icon: Database },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
              tab === t.id
                ? 'bg-purple-50 text-purple-700 border border-b-0 border-purple-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Directory Tab ── */}
      {tab === 'directory' && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, institution, or research focus..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          {isCollege && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 text-[10px] text-purple-700">
              💡 <strong>Tip:</strong> Look for researchers marked <Badge variant="outline" className="text-[8px] h-3.5 bg-green-50 text-green-600 border-green-200 mx-0.5">Accepting Students</Badge> — they may have openings for research assistants or thesis advisors.
            </div>
          )}

          {filteredResearchers.map(r => (
            <div key={r.id} className="bg-white rounded-lg border border-slate-200 p-3 hover:border-purple-300 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    {r.name}
                    {r.pearlPartner && <Badge variant="outline" className="text-[8px] h-3.5 bg-emerald-50 text-emerald-600 border-emerald-200">🦪 PEARL</Badge>}
                    {r.acceptingStudents && isCollege && <Badge variant="outline" className="text-[8px] h-3.5 bg-green-50 text-green-600 border-green-200">Accepting Students</Badge>}
                  </div>
                  <div className="text-[10px] text-slate-500">{r.institution} — {r.department}</div>
                </div>
                <div className="flex gap-1">
                  {r.orcid && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="ORCID Profile">
                      <Award className="h-3 w-3 text-green-600" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Contact">
                    <Mail className="h-3 w-3 text-blue-600" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mt-1.5">
                {r.focus.map(f => (
                  <span key={f} className="px-1.5 py-0.5 rounded text-[9px] bg-purple-50 text-purple-600 border border-purple-100">{f}</span>
                ))}
              </div>

              <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                <span>{r.activeStudies} active {r.activeStudies === 1 ? 'study' : 'studies'}</span>
                <span>{r.sharedDatasets} shared datasets</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Active Studies Tab ── */}
      {tab === 'studies' && (
        <div className="space-y-2">
          {ACTIVE_STUDIES.map(study => (
            <div key={study.id} className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between mb-1">
                <div className="text-xs font-semibold text-slate-800 flex-1">{study.title}</div>
                <Badge variant="outline" className={`text-[9px] h-4 flex-shrink-0 ml-2 ${studyStatusStyle(study.status)}`}>
                  {study.status}
                </Badge>
              </div>
              <div className="text-[10px] text-slate-500">{study.pi} · {study.institution}</div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {study.waterbodies.map(wb => (
                  <span key={wb} className="px-1.5 py-0.5 rounded text-[9px] bg-blue-50 text-blue-600 border border-blue-100">{wb}</span>
                ))}
                {study.pearlData && <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100">🦪 Uses PEARL data</span>}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] text-slate-400">Data sharing: <strong>{study.dataSharing}</strong></span>
                {study.status === 'recruiting' && isCollege && (
                  <Button variant="outline" size="sm" className="text-[10px] h-5 px-2 ml-auto border-green-200 text-green-600 hover:bg-green-50">
                    Apply to Join
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Shared Datasets Tab ── */}
      {tab === 'datasets' && (
        <div className="space-y-2">
          <div className="text-[10px] text-slate-500 italic">
            Shared datasets from PEARL-affiliated researchers and partner institutions.
            {isCollege && ' Filter by your coursework topics to find relevant data.'}
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
            <Database className="h-6 w-6 text-slate-300 mx-auto mb-2" />
            <div className="text-xs text-slate-500">Dataset catalog coming soon</div>
            <div className="text-[10px] text-slate-400">Integration with DataONE, Hydroshare, and PEARL data platform</div>
          </div>
        </div>
      )}
    </div>
  );
}
