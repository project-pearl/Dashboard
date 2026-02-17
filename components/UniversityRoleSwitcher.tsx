// ============================================================
// UniversityRoleSwitcher — header dropdown for Researcher ↔ College toggle
// Drop this next to the existing role badge in the header.
// ============================================================
'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, FlaskConical, GraduationCap, Check } from 'lucide-react';

type UniversityRole = 'Researcher' | 'College';

type Props = {
  currentRole: UniversityRole;
  onRoleChange: (role: UniversityRole) => void;
};

const ROLES: { id: UniversityRole; label: string; desc: string; icon: typeof FlaskConical }[] = [
  { id: 'Researcher', label: 'Scientist / Researcher', desc: 'Full access: publications, grants, methodology, peer benchmarks', icon: FlaskConical },
  { id: 'College', label: 'College Student', desc: 'Learning paths, study groups, lab templates, internships', icon: GraduationCap },
];

export function UniversityRoleSwitcher({ currentRole, onRoleChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = ROLES.find(r => r.id === currentRole)!;
  const Icon = current.icon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors gap-1.5"
      >
        <Icon className="h-3.5 w-3.5" />
        {current.id === 'College' ? '🎓 College Research' : '🔬 Researcher'}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">View Mode</div>
          </div>
          {ROLES.map(role => {
            const RIcon = role.icon;
            const isActive = role.id === currentRole;
            return (
              <button
                key={role.id}
                onClick={() => { onRoleChange(role.id); setOpen(false); }}
                className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-purple-50' : 'hover:bg-slate-50'
                }`}
              >
                <RIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isActive ? 'text-purple-600' : 'text-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium ${isActive ? 'text-purple-700' : 'text-slate-700'}`}>
                    {role.label}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-snug">{role.desc}</div>
                </div>
                {isActive && <Check className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />}
              </button>
            );
          })}
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
            <div className="text-[9px] text-slate-400">
              Switching views changes visible sections and their order. All data remains accessible.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
