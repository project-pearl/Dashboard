/* ------------------------------------------------------------------ */
/*  useSentinelAudio — Web Audio API two-tone chime for CRITICAL      */
/*  Ascending C5→E5 chime, 800ms duration, opt-in by default          */
/* ------------------------------------------------------------------ */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_KEY = 'sentinel-audio';
const PLAYED_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/** Roles that default to audio ON */
const AUDIO_ON_ROLES = new Set(['emergency-coordinator', 'ms4-utility', 'ms4']);

interface UseSentinelAudioOptions {
  userRole?: string;
}

interface UseSentinelAudioResult {
  audioEnabled: boolean;
  audioUnlocked: boolean;
  toggleAudio: () => void;
  playChime: () => void;
}

export function useSentinelAudio(
  options: UseSentinelAudioOptions = {}
): UseSentinelAudioResult {
  const { userRole } = options;

  // Determine initial state from sessionStorage or role default
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';
    return AUDIO_ON_ROLES.has(userRole ?? '');
  });

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playedRef = useRef<Map<string, number>>(new Map());

  // Unlock AudioContext on first user gesture
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      if (audioCtxRef.current) return;
      try {
        audioCtxRef.current = new AudioContext();
        setAudioUnlocked(true);
      } catch {
        // Web Audio not available
      }
    };

    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabled(prev => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, String(next));
      } catch { /* non-fatal */ }
      return next;
    });
  }, []);

  const playChime = useCallback(() => {
    if (!audioEnabled || !audioCtxRef.current) return;

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Oscillator 1: C5 (523 Hz), 400ms
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 523;
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain1.gain.linearRampToValueAtTime(0, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Oscillator 2: E5 (659 Hz), starts at 400ms, 400ms duration
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 659;
    gain2.gain.setValueAtTime(0, now + 0.4);
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.45);
    gain2.gain.linearRampToValueAtTime(0, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.4);
    osc2.stop(now + 0.8);
  }, [audioEnabled]);

  return { audioEnabled, audioUnlocked, toggleAudio, playChime };
}
