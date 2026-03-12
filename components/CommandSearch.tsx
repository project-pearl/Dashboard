'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { LENS_REGISTRY, type LensDef } from '@/lib/lensRegistry';

interface SearchResult {
  label: string;
  href: string;
  category: string;
}

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Build flat list of all navigable items
  const allItems = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];
    for (const [href, lenses] of Object.entries(LENS_REGISTRY)) {
      const category = href.split('/').pop() || '';
      // Add the role/dashboard itself
      items.push({ label: category.charAt(0).toUpperCase() + category.slice(1) + ' Dashboard', href, category: 'Dashboards' });
      // Add each lens
      for (const lens of lenses) {
        items.push({ label: lens.label, href: `${href}?lens=${lens.id}`, category: category.charAt(0).toUpperCase() + category.slice(1) });
      }
    }
    return items;
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 12);
    const q = query.toLowerCase();
    return allItems
      .filter((item) => item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, allItems]);

  // Reset selection on query change
  useEffect(() => { setSelectedIdx(0); }, [query]);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = useCallback((item: SearchResult) => {
    router.push(item.href);
    setOpen(false);
  }, [router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center pt-[20vh]" role="dialog" aria-modal="true" aria-label="Quick search">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Search panel */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-900 rounded-xl shadow-overlay border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && results[selectedIdx]) { navigate(results[selectedIdx]); }
            }}
            placeholder="Search lenses, dashboards..."
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none"
            aria-label="Search navigation"
          />
          <kbd className="hidden sm:inline text-2xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-600">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-2" role="listbox">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No results found</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.href}
                role="option"
                aria-selected={i === selectedIdx}
                onClick={() => navigate(item)}
                onMouseEnter={() => setSelectedIdx(i)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm transition-colors ${
                  i === selectedIdx
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>{item.label}</span>
                <span className="text-2xs text-slate-400">{item.category}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-2xs text-slate-400 flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600">↵</kbd> Open</span>
          <span><kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
