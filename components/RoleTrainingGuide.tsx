'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getLensesForHref } from '@/lib/lensRegistry';
import { ROLE_TRAINING, type RoleTrainingData } from '@/lib/trainingContent';
import { LENS_ICON_NAMES } from '@/components/DashboardSidebar';
import { LazyIcon } from '@/lib/iconLoader';
import {
  GraduationCap,
  CheckCircle,
  Circle,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  ArrowRight,
  LayoutDashboard,
  HelpCircle,
} from 'lucide-react';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

interface Props {
  rolePath: string;
}

export default function RoleTrainingGuide({ rolePath }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const training: RoleTrainingData | undefined = ROLE_TRAINING[rolePath];

  // ── Progress tracking via localStorage ──
  const storageKey = `pin-training-deploy:${rolePath}`;
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [expandedTips, setExpandedTips] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCompleted(safeParse(window.localStorage.getItem(storageKey), {}));
  }, [storageKey]);

  const toggleStep = useCallback((stepId: string) => {
    setCompleted(prev => {
      const next = { ...prev, [stepId]: !prev[stepId] };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return next;
    });
  }, [storageKey]);

  const toggleTip = useCallback((title: string) => {
    setExpandedTips(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  }, []);

  // Navigate to a lens
  const goToLens = useCallback((lensId: string) => {
    const base = pathname.split('?')[0];
    router.push(`${base}?lens=${lensId}`);
  }, [pathname, router]);

  if (!training) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Training content is not yet available for this role.</p>
      </div>
    );
  }

  // Get lenses for this role (excluding 'training' itself)
  const lenses = (getLensesForHref(rolePath) || []).filter(l => l.id !== 'training');

  // Completion stats
  const totalSteps = training.gettingStarted.length;
  const completedCount = training.gettingStarted.filter(s => completed[s.id]).length;
  const pct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ── */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-6 text-white shadow-lg">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-white/20 p-2.5 backdrop-blur-sm">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold mb-1">{training.roleLabel} — Deployment Training</h2>
            <p className="text-sm text-white/90 leading-relaxed">{training.welcome}</p>
            <p className="text-xs text-white/70 mt-2 leading-relaxed">{training.overview}</p>
          </div>
        </div>
      </div>

      {/* ── Getting Started Checklist ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">Getting Started</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-500">{pct}%</span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {training.gettingStarted.map((step) => {
            const done = !!completed[step.id];
            return (
              <button
                key={step.id}
                onClick={() => toggleStep(step.id)}
                className="w-full flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
              >
                {done ? (
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Circle className="w-4.5 h-4.5 text-slate-300 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {step.title}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{step.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lens Guide Grid ── */}
      {lenses.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800">Your Dashboard Lenses</h3>
            <p className="text-xs text-slate-500 mt-0.5">Click any lens to navigate directly to it.</p>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {lenses.map((lens) => {
              const iconName = LENS_ICON_NAMES[lens.id] || 'LayoutDashboard';
              const guide = training.lensGuides[lens.id];
              return (
                <button
                  key={lens.id}
                  onClick={() => goToLens(lens.id)}
                  className="group flex flex-col text-left rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm p-4 transition-all"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="rounded-md bg-slate-100 group-hover:bg-blue-50 p-1.5 transition-colors">
                      <LazyIcon name={iconName} className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700 transition-colors">
                      {lens.label}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 ml-auto transition-colors" />
                  </div>
                  {guide ? (
                    <>
                      <p className="text-xs text-slate-500 leading-relaxed mb-2">{guide.summary}</p>
                      <ul className="space-y-1">
                        {guide.keyFeatures.map((f, i) => (
                          <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                            <span className="inline-block w-1 h-1 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Explore {lens.label} for detailed analysis and data.</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tips Section ── */}
      {training.tips.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800">Tips & Best Practices</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {training.tips.map((tip) => {
              const isOpen = expandedTips.has(tip.title);
              return (
                <button
                  key={tip.title}
                  onClick={() => toggleTip(tip.title)}
                  className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-slate-700">{tip.title}</span>
                  </div>
                  {isOpen && (
                    <p className="text-xs text-slate-500 mt-2 ml-5.5 leading-relaxed">{tip.body}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Help Footer ── */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-3 flex items-center gap-3">
        <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-500">
          Need more help? Click the <span className="font-medium text-slate-600">?</span> icon on any card header to access per-card training modules via CardAssistBar.
        </p>
      </div>
    </div>
  );
}
