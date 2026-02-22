'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Bidirectional URL ↔ lens state sync.
 * Drop-in replacement for useState — reads `?lens=X` from the URL
 * and writes it back via router.replace (so back button skips lens changes).
 */
export function useLensParam<T extends string>(defaultLens: T): [T, (lens: T) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const raw = searchParams.get('lens');
  const currentLens = (raw as T) || defaultLens;

  const setLens = useCallback(
    (lens: T) => {
      router.replace(pathname + '?lens=' + lens, { scroll: false });
    },
    [router, pathname],
  );

  return [currentLens, setLens];
}
