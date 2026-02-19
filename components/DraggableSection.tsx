'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import type { ReactNode } from 'react';

interface DraggableSectionProps {
  id: string;
  children: ReactNode;
  isEditMode: boolean;
  isVisible: boolean;
  label: string;
  onToggleVisibility: (id: string) => void;
}

export function DraggableSection({
  id,
  children,
  isEditMode,
  isVisible,
  label,
  onToggleVisibility,
}: DraggableSectionProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`section-wrap-${id}`}
      className={`relative ${!isVisible ? 'opacity-40 border-2 border-dashed border-slate-300 rounded-xl' : ''}`}
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
      {children}
    </div>
  );
}
