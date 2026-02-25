'use client';

import { useTheme as useNextTheme } from 'next-themes';

/**
 * Thin wrapper around next-themes that exposes { theme, isDark, isLight }.
 * Any component can import this to react to theme changes.
 */
export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const resolved = resolvedTheme ?? theme ?? 'light';
  return {
    theme: resolved,
    isDark: resolved === 'dark',
    isLight: resolved === 'light',
    setTheme,
  };
}
