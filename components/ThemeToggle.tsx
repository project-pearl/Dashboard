'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-[140px]" />; // prevent layout shift

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
        isDark
          ? 'bg-[rgba(58,189,176,0.1)] text-teal-400 hover:bg-[rgba(58,189,176,0.2)] border border-[rgba(58,189,176,0.2)]'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
      }`}
    >
      {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      {isDark ? 'COMMAND CENTER' : 'STANDARD'}
    </button>
  );
}
