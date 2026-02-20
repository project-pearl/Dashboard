'use client';

import { useState, useEffect, type ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Pencil, Save, RotateCcw, X } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import {
  type SectionDefinition,
  type CCKey,
  DEFAULT_SECTIONS,
  fetchLayout,
  saveLayout,
} from '@/lib/layoutConfig';

// ─── Props ──────────────────────────────────────────────────────────────────

interface LayoutEditorRenderProps {
  sections: SectionDefinition[];
  isEditMode: boolean;
  onToggleVisibility: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  collapsedSections: Record<string, boolean>;
}

interface LayoutEditorProps {
  ccKey: CCKey;
  children: (props: LayoutEditorRenderProps) => ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function LayoutEditor({ ccKey, children }: LayoutEditorProps) {
  const { user } = useAuth();

  // Section order + visibility
  const [sections, setSections] = useState<SectionDefinition[]>(
    () => DEFAULT_SECTIONS[ccKey],
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [snapshot, setSnapshot] = useState<SectionDefinition[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Collapse state (replaces per-CC inline collapsedSections)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    DEFAULT_SECTIONS[ccKey].forEach(s => {
      if (!s.defaultExpanded) defaults[s.id] = true;
    });
    return defaults;
  });

  // Load saved layout from Supabase on mount
  useEffect(() => {
    if (!user) return;
    fetchLayout(user.role, ccKey).then(saved => {
      if (saved) {
        setSections(saved);
        // Re-derive collapsed state from saved definitions
        const collapsed: Record<string, boolean> = {};
        saved.forEach(s => {
          if (!s.defaultExpanded) collapsed[s.id] = true;
        });
        setCollapsedSections(collapsed);
      }
    }).catch(() => { /* table empty or unreachable — keep defaults */ });
  }, [user, ccKey]);

  // ── DnD sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id);
      const newIndex = prev.findIndex(s => s.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      return reordered.map((s, i) => ({ ...s, order: i }));
    });
  }

  // ── Edit mode controls ──
  function startEdit() {
    setSnapshot(sections.map(s => ({ ...s })));
    setIsEditMode(true);
  }

  function cancelEdit() {
    if (snapshot) setSections(snapshot);
    setSnapshot(null);
    setIsEditMode(false);
  }

  async function saveEdit() {
    if (!user) return;
    setSaving(true);
    await saveLayout(user.role, ccKey, sections, user.uid);
    setSaving(false);
    setSnapshot(null);
    setIsEditMode(false);
  }

  function resetToDefaults() {
    setSections(DEFAULT_SECTIONS[ccKey].map((s, i) => ({ ...s, order: i })));
  }

  // ── Section toggles ──
  function toggleVisibility(id: string) {
    setSections(prev =>
      prev.map(s => (s.id === id ? { ...s, visible: !s.visible } : s)),
    );
  }

  function toggleCollapse(id: string) {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const isAdmin = user?.isAdmin ?? false;

  return (
    <>
      {/* Floating admin toolbar */}
      {isAdmin && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-white/95 backdrop-blur-sm border-2 border-blue-300 rounded-xl shadow-lg px-4 py-2.5">
          {!isEditMode ? (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors"
            >
              <Pencil className="h-4 w-4" /> Edit Layout
            </button>
          ) : (
            <>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-900 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" /> {saving ? 'Saving\u2026' : 'Save'}
              </button>
              <div className="w-px h-5 bg-slate-200" />
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
              <div className="w-px h-5 bg-slate-200" />
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </>
          )}
        </div>
      )}

      {/* DnD context wrapping the section list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {typeof children === 'function' ? children({
            sections,
            isEditMode,
            onToggleVisibility: toggleVisibility,
            onToggleCollapse: toggleCollapse,
            collapsedSections,
          }) : (
            <div className="p-4 bg-red-100 text-red-700 rounded-lg">
              <div className="font-bold">LayoutEditor Error: children is {typeof children}</div>
              <pre className="text-xs mt-1">{String(children)}</pre>
            </div>
          )}
        </SortableContext>
      </DndContext>
    </>
  );
}
