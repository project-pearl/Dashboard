/**
 * Shared UI utility helpers.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS class names, resolving conflicts via `tailwind-merge`.
 * Accepts the same inputs as `clsx` (strings, arrays, objects, falsy values).
 *
 * @param inputs - Class values to merge
 * @returns A single deduplicated class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
