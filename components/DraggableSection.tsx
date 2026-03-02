'use client';

import { useCallback, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Minus, ChevronDown } from 'lucide-react';
import type { ReactNode, MouseEvent } from 'react';

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

// Interactive elements that should not trigger collapse
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [data-no-collapse]';

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

  const canCollapse = !isEditMode && !NO_COLLAPSE.has(id);

  // Click card heading (h3 / CardTitle or its CardHeader parent) to collapse
  const handleHeaderClick = useCallback((e: MouseEvent) => {
    if (!canCollapse) return;
    const target = e.target as HTMLElement;
    // Don't interfere with interactive elements inside the header
    if (target.closest(INTERACTIVE)) return;
    // Only trigger on CardTitle (<h3>) or its CardHeader container (parent div with p-6)
    const isTitle = !!target.closest('h3');
    const isHeader = !isTitle && target.closest('[class*="p-6"]')?.querySelector('h3') != null;
    if (isTitle || isHeader) {
      setCollapsed(prev => !prev);
    }
  }, [canCollapse]);

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
            className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg bg-white shadow-md border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all dark:bg-[#0D1526] dark:border-[rgba(58,189,176,0.12)]"
            title={`Drag to reorder: ${label}`}
          >
            <GripVertical className="h-4 w-4 text-slate-400" />
          </button>
          <button
            onClick={() => onToggleVisibility(id)}
            className="p-1.5 rounded-lg bg-white shadow-md border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all dark:bg-[#0D1526] dark:border-[rgba(58,189,176,0.12)]"
            title={isVisible ? `Hide: ${label}` : `Show: ${label}`}
          >
            {isVisible
              ? <Eye className="h-3.5 w-3.5 text-slate-500" />
              : <EyeOff className="h-3.5 w-3.5 text-slate-300" />}
          </button>
        </div>
      )}
      {/* Collapse toggle — top-right, visible on hover or when collapsed */}
      {canCollapse && (
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
      {collapsed && canCollapse ? (
        <button
          onClick={() => setCollapsed(false)}
          className="w-full py-2 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between transition-colors dark:bg-[rgba(14,22,45,0.85)] dark:border-[rgba(58,189,176,0.12)]"
        >
          <span className="text-sm font-medium text-slate-500">{label}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      ) : (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div onClick={handleHeaderClick} className={canCollapse ? '[&_h3]:cursor-pointer' : ''}>
          {children}
        </div>
      )}
    </div>
  );
}
