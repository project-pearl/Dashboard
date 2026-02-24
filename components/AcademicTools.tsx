// ============================================================
// AcademicTools — College-aware academic resource panel
// Plugs into the existing scaffold slot in UniversityCommandCenter
// ============================================================
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, ExternalLink, ChevronRight, GraduationCap, Beaker, Calculator, FileText } from 'lucide-react';

type Props = {
  userRole: 'Researcher' | 'College';
  regionId?: string;
  stateAbbr: string;
};

// ─── Learning Path definitions ─────────────────────────────────────────────

interface LearningModule {
  id: string;
  title: string;
  level: 'Intro' | 'Intermediate' | 'Advanced';
  duration: string;
  topics: string[];
  pearlIntegration?: string;
}

const LEARNING_PATHS: LearningModule[] = [
  {
    id: 'wq-101',
    title: 'Water Quality Fundamentals',
    level: 'Intro',
    duration: '2 hours',
    topics: ['pH & dissolved oxygen', 'TSS & turbidity', 'Nutrient loading (N & P)', 'Fecal indicator bacteria'],
    pearlIntegration: 'Explore live ALIA sensor data for each parameter',
  },
  {
    id: 'epa-methods',
    title: 'EPA Sampling & Analysis Methods',
    level: 'Intermediate',
    duration: '3 hours',
    topics: ['SM 2540D (TSS)', 'EPA 353.2 (TN)', 'EPA 365.1 (TP)', 'EPA 1603 (E. coli)', 'QA/QC protocols', 'Method detection limits'],
    pearlIntegration: 'Compare your lab results against ALIA continuous monitoring',
  },
  {
    id: 'attains-nav',
    title: 'Navigating EPA ATTAINS Data',
    level: 'Intro',
    duration: '1.5 hours',
    topics: ['Assessment units & categories', '303(d) impaired waters list', 'TMDL basics', 'IR reporting cycles'],
    pearlIntegration: 'Pull real ATTAINS data for your state directly from this dashboard',
  },
  {
    id: 'stats-wq',
    title: 'Statistical Analysis for Water Quality',
    level: 'Intermediate',
    duration: '4 hours',
    topics: ['Normality testing for WQ data', 'Mann-Kendall trend detection', 'Seasonal decomposition', 'Regression modeling for pollutant loading'],
    pearlIntegration: 'Export ALIA datasets to R/Python for hands-on analysis',
  },
  {
    id: 'biofiltration',
    title: 'Oyster Biofiltration Science',
    level: 'Advanced',
    duration: '3 hours',
    topics: ['Crassostrea virginica filtration rates', 'Biofilm ecology', 'Nitrogen assimilation pathways', 'Reef ecosystem services'],
    pearlIntegration: 'Review ALIA pilot data from Milton, FL (88-95% TSS removal)',
  },
  {
    id: 'stormwater',
    title: 'Stormwater Management & MS4 Compliance',
    level: 'Advanced',
    duration: '4 hours',
    topics: ['NPDES permit structure', 'BMP types & effectiveness', 'Impervious surface calculations', 'Green infrastructure design'],
    pearlIntegration: 'Model ALIA deployment scenarios using the ROI calculator',
  },
];

// ─── Lab Report Template stubs ─────────────────────────────────────────────

const LAB_TEMPLATES = [
  { id: 'field-sampling', title: 'Field Sampling Report', desc: 'Chain of custody, GPS coords, field parameters, sample handling', format: 'DOCX / LaTeX' },
  { id: 'wq-analysis', title: 'Water Quality Analysis', desc: 'Parameter results, QA/QC flags, method references, data tables', format: 'DOCX / LaTeX' },
  { id: 'bioassay', title: 'Bioassay / Toxicity Report', desc: 'Test organisms, exposure design, LC50/EC50, statistical analysis', format: 'DOCX / LaTeX' },
  { id: 'sensor-cal', title: 'Sensor Calibration Log', desc: 'Pre/post calibration, drift correction, sensor maintenance record', format: 'CSV / PDF' },
  { id: 'poster', title: 'Research Poster Template', desc: 'Conference poster with PEARL branding, data viz slots, citation blocks', format: 'PPTX / Figma' },
];

// ─── Component ─────────────────────────────────────────────────────────────

export function AcademicTools({ userRole, regionId, stateAbbr }: Props) {
  const [activePath, setActivePath] = useState<string | null>(null);
  const isCollege = userRole === 'College';

  const levelColor = (level: string) => {
    switch (level) {
      case 'Intro': return 'bg-green-100 text-green-800 border-green-200';
      case 'Intermediate': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Advanced': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Quick Links / Getting Started ── */}
      {isCollege && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-5 w-5 text-emerald-700" />
            <span className="text-sm font-bold text-emerald-800">Welcome, Student Researcher</span>
          </div>
          <p className="text-xs text-emerald-700 leading-relaxed mb-3">
            This dashboard gives you access to the same real-time water quality data used by professional researchers and state agencies.
            Start with the learning pathways below, then explore live data for <strong>{stateAbbr}</strong> waterbodies.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-100">
              <BookOpen className="h-3 w-3 mr-1" /> Start Learning Path
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-100">
              <Beaker className="h-3 w-3 mr-1" /> Lab Report Templates
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-100">
              <Calculator className="h-3 w-3 mr-1" /> Stats Toolkit
            </Button>
          </div>
        </div>
      )}

      {/* ── Learning Pathways ── */}
      <div>
        <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          📚 {isCollege ? 'Learning Pathways' : 'Curriculum & Teaching Modules'}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {LEARNING_PATHS.map(mod => (
            <div
              key={mod.id}
              className={`rounded-lg border p-3 cursor-pointer transition-all ${
                activePath === mod.id
                  ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30'
              }`}
              onClick={() => setActivePath(activePath === mod.id ? null : mod.id)}
            >
              <div className="flex items-start justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-800">{mod.title}</span>
                <Badge variant="outline" className={`text-[9px] h-4 ${levelColor(mod.level)}`}>{mod.level}</Badge>
              </div>
              <div className="text-[10px] text-slate-500 mb-1">⏱ {mod.duration}</div>

              {activePath === mod.id && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="text-[10px] text-slate-600 font-medium">Topics covered:</div>
                  <div className="flex flex-wrap gap-1">
                    {mod.topics.map(t => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-600">{t}</span>
                    ))}
                  </div>
                  {mod.pearlIntegration && (
                    <div className="text-[10px] text-emerald-700 bg-emerald-50 rounded p-1.5 mt-1">
                      🦪 <strong>ALIA Integration:</strong> {mod.pearlIntegration}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Lab Report Templates (College priority) ── */}
      {isCollege && (
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2">🧪 Lab Report Templates</div>
          <div className="space-y-1.5">
            {LAB_TEMPLATES.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-white rounded-lg border border-slate-200 p-2.5 hover:border-blue-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-800">{t.title}</div>
                  <div className="text-[10px] text-slate-500">{t.desc}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className="text-[9px] text-slate-400">{t.format}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <FileText className="h-3 w-3 text-blue-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Researcher: Teaching tools ── */}
      {!isCollege && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <div className="text-xs font-semibold text-indigo-800 mb-1">🏫 Teaching Integration</div>
          <p className="text-[10px] text-indigo-700 leading-relaxed">
            Assign ALIA datasets to student groups, create custom assessment rubrics tied to waterbody data,
            and track student progress through learning modules. Export classroom-ready CSV subsets with metadata.
          </p>
        </div>
      )}

      {/* ── Quick Reference: EPA Method IDs ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="text-xs font-semibold text-amber-800 mb-1.5">⚗️ Quick Reference: EPA-Approved Methods</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          {[
            { param: 'TSS', method: 'SM 2540D' },
            { param: 'TN', method: 'EPA 353.2' },
            { param: 'TP', method: 'EPA 365.1' },
            { param: 'DO', method: 'SM 4500-O' },
            { param: 'E. coli', method: 'EPA 1603' },
            { param: 'pH', method: 'SM 4500-H+B' },
            { param: 'Turbidity', method: 'EPA 180.1' },
            { param: 'Conductivity', method: 'SM 2510B' },
          ].map(m => (
            <div key={m.param} className="bg-white rounded border border-amber-100 px-2 py-1.5 text-center">
              <div className="text-[10px] font-bold text-amber-900">{m.param}</div>
              <div className="text-[9px] text-amber-600">{m.method}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
