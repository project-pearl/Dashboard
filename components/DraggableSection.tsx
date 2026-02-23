'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Minus, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface DraggableSectionProps {
  id: string;
  children: ReactNode;
  isEditMode: boolean;
  isVisible: boolean;
  label: string;
  onToggleVisibility: (id: string) => void;
}

// Sections that should not show collapse controls (too small or structural)
const NO_COLLAPSE = new Set(['disclaimer']);

export function DraggableSection({
  id,
  children,
  isEditMode,
  isVisible,
  label,
  onToggleVisibility,
}: DraggableSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Hidden sections don't render in normal mode
  if (!isVisible && !isEditMode) return null;

  const showCollapseBtn = !isEditMode && !NO_COLLAPSE.has(id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`section-wrap-${id}`}
      className={`relative group/section ${!isVisible ? 'opacity-40 border-2 border-dashed border-slate-300 rounded-xl' : ''}`}
    >
      {isEditMode && (
        <div className="absolute -left-11 top-3 flex flex-col gap-1 z-20">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg bg-white shadow-md border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all"
            title={`Drag to reorder: ${label}`}
          >
            <GripVertical className="h-4 w-4 text-slate-400" />
          </button>
          <button
            onClick={() => onToggleVisibility(id)}
            className="p-1.5 rounded-lg bg-white shadow-md border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all"
            title={isVisible ? `Hide: ${label}` : `Show: ${label}`}
          >
            {isVisible
              ? <Eye className="h-3.5 w-3.5 text-slate-500" />
              : <EyeOff className="h-3.5 w-3.5 text-slate-300" />}
          </button>
        </div>
      )}
      {/* Collapse toggle — top-right, visible on hover or when collapsed */}
      {showCollapseBtn && (
        <button
          onClick={() => setCollapsed(prev => !prev)}
          className={`absolute top-2 right-2 z-10 p-1 rounded-md border border-slate-200 bg-white/90 shadow-sm transition-all hover:border-blue-300 hover:shadow ${
            collapsed ? 'opacity-100' : 'opacity-0 group-hover/section:opacity-100'
          }`}
          title={collapsed ? `Expand: ${label}` : `Minimize: ${label}`}
        >
          {collapsed
            ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            : <Minus className="h-3.5 w-3.5 text-slate-400" />}
        </button>
      )}
      {collapsed && showCollapseBtn ? (
        <button
          onClick={() => setCollapsed(false)}
          className="w-full py-2 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between transition-colors"
        >
          <span className="text-sm font-medium text-slate-500">{label}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      ) : (
        children
      )}
    </div>
  );
}
