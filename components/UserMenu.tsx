// components/UserMenu.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={menuRef} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800/60 transition-colors"
        title={`Signed in as ${user.name}`}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white text-xs font-bold shadow-md">
          {user.avatar || user.name.charAt(0)}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-xs font-medium text-gray-200 leading-tight">{user.name}</div>
          <div className="text-[10px] text-gray-500 leading-tight">{user.role}</div>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* User info header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white text-sm font-bold">
                {user.avatar || user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{user.name}</div>
                <div className="text-xs text-gray-400 truncate">{user.title}</div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {user.role}
              </span>
              <span className="text-[11px] text-gray-500 truncate">{user.organization}</span>
            </div>
          </div>

          {/* Session info */}
          <div className="px-4 py-2.5 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Session</span>
              <span className="text-[11px] text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Active
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-gray-500">Default State</span>
              <span className="text-[11px] text-gray-300">{user.state}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-2">
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
