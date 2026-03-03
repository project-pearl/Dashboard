'use client';

import React, { useState, useMemo, type ReactNode } from 'react';
import { Search } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  CappedList — Shared wrapper for vertical lists                    */
/*                                                                    */
/*  Shows maxVisible items, with scrollable overflow for the rest.    */
/*  Includes an optional real-time search filter.                     */
/* ------------------------------------------------------------------ */

interface CappedListProps<T> {
  items: T[];
  maxVisible?: number;              // default 5
  searchable?: boolean;             // default true
  searchPlaceholder?: string;       // default "Search by name..."
  /** Extract the searchable string from an item (for filtering) */
  getSearchText: (item: T) => string;
  /** Render a single item */
  renderItem: (item: T, index: number) => ReactNode;
  /** Key extractor */
  getKey: (item: T, index: number) => string;
  className?: string;
}

export function CappedList<T>({
  items,
  maxVisible = 5,
  searchable = true,
  searchPlaceholder = 'Search by name...',
  getSearchText,
  renderItem,
  getKey,
  className = '',
}: CappedListProps<T>) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(item => getSearchText(item).toLowerCase().includes(q));
  }, [items, search, getSearchText]);

  const visible = filtered.slice(0, maxVisible);
  const overflow = filtered.slice(maxVisible);
  const hasOverflow = overflow.length > 0;

  return (
    <div className={className}>
      {searchable && items.length > maxVisible && (
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none bg-white"
          />
        </div>
      )}

      {/* Visible items */}
      {visible.map((item, i) => (
        <React.Fragment key={getKey(item, i)}>
          {renderItem(item, i)}
        </React.Fragment>
      ))}

      {/* Scrollable overflow */}
      {hasOverflow && (
        <div className="max-h-[200px] overflow-y-auto border-t border-slate-100 mt-1 pt-1">
          {overflow.map((item, i) => (
            <React.Fragment key={getKey(item, maxVisible + i)}>
              {renderItem(item, maxVisible + i)}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Empty search state */}
      {searchable && search && filtered.length === 0 && (
        <div className="text-center py-3 text-xs text-slate-400">
          No results for &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
}
