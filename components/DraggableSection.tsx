'use client';

import { useCallback, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Minus, ChevronDown, HelpCircle } from 'lucide-react';
import { haptic } from '@/lib/haptic';
import type { ReactNode, MouseEvent } from 'react';
import { AskPinPopover } from './AskPinPopover';

export interface DraggableSectionProps {
  id: string;
  children: ReactNode;
  isEditMode: boolean;
  isVisible: boolean;
  label: string;
  onToggleVisibility: (id: string) => void;
  userRole?: string;
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
  userRole,
}: DraggableSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [askPinOpen, setAskPinOpen] = useState(false);
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

  // Only the primary section title should toggle collapse.
  const handleHeaderClick = useCallback((e: MouseEvent) => {
    if (!canCollapse) return;
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE)) return;
    const container = e.currentTarget as HTMLElement;
    const clickedTitle = target.closest('h3');
    if (!clickedTitle) return;
    const primaryTitle = container.querySelector('h3');
    if (primaryTitle && clickedTitle === primaryTitle) {
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
            onPointerDown={() => haptic('light')}
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
      {/* Ask PIN — always visible; Collapse — hover-only */}
      {canCollapse && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            onClick={() => setAskPinOpen(v => !v)}
            className={`p-1 rounded-md border shadow-sm transition-all hover:border-blue-300 hover:shadow ${
              askPinOpen
                ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/40'
                : 'border-slate-200 dark:border-slate-600 bg-white/90 dark:bg-slate-800/90'
            }`}
            title="Ask PIN"
          >
            <HelpCircle className="h-3.5 w-3.5 text-blue-400" />
          </button>
          <button
            onClick={() => setCollapsed(prev => !prev)}
            className={`p-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white/90 dark:bg-slate-800/90 shadow-sm transition-all hover:border-blue-300 hover:shadow ${
              collapsed ? 'opacity-100' : 'opacity-0 group-hover/section:opacity-100'
            }`}
            title={collapsed ? `Expand: ${label}` : `Minimize: ${label}`}
          >
            {collapsed
              ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              : <Minus className="h-3.5 w-3.5 text-slate-400" />}
          </button>
        </div>
      )}
      {askPinOpen && (
        <AskPinPopover sectionId={id} label={label} userRole={userRole || 'Federal'} onClose={() => setAskPinOpen(false)} />
      )}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div onClick={handleHeaderClick} className={canCollapse ? '[&_h3]:cursor-pointer' : ''}>
        <div
          aria-expanded={!collapsed}
          className={collapsed && canCollapse ? 'max-h-14 overflow-hidden' : ''}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
