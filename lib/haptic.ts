/** Haptic feedback utility — triggers vibration on supported mobile devices. */
export function haptic(pattern: 'light' | 'medium' | 'heavy' = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  const durations = { light: 10, medium: 25, heavy: 50 };
  try { navigator.vibrate(durations[pattern]); } catch {}
}
