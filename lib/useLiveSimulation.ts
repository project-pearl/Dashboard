'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WaterQualityData } from './types';

interface LiveSimulationState {
  data: WaterQualityData;
  lastUpdated: Date;
  secondsSinceUpdate: number;
  isStormSpiking: boolean;
  stormIntensity: number; // 0-1
  stormPhase: 'idle' | 'building' | 'peak' | 'recovering';
}

// Realistic drift per tick — matches sensor noise
const DRIFT_CONFIG: Record<string, { variance: number; min: number; max: number }> = {
  DO:        { variance: 0.05, min: 2,    max: 12   },
  turbidity: { variance: 0.8,  min: 0.5,  max: 450  },
  TN:        { variance: 0.01, min: 0.1,  max: 20   },
  TP:        { variance: 0.005,min: 0.01, max: 2.0  },
  TSS:       { variance: 1.5,  min: 1,    max: 500  },
  salinity:  { variance: 0.1,  min: 0.5,  max: 38   },
};

// Storm spike multipliers (applied on top of base value)
const STORM_SPIKE: Record<string, number> = {
  DO:        0.55,  // DO drops during storm
  turbidity: 8.5,
  TN:        4.2,
  TP:        5.8,
  TSS:       9.2,
  salinity:  0.75,  // diluted by rain
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function driftValue(
  current: number,
  base: number,
  variance: number,
  min: number,
  max: number,
  stormIntensity: number,
  stormMultiplier: number
): number {
  const randomWalk = (Math.random() - 0.5) * variance;
  const meanReversion = (base - current) * 0.04;
  let next = current + randomWalk + meanReversion;

  if (stormIntensity > 0) {
    const targetStorm = base * stormMultiplier;
    next = next + (targetStorm - base) * stormIntensity;
  }

  return clamp(next, min, max);
}

/**
 * Live data hook with manual storm simulation for demos.
 *
 * In normal operation: passes through real API data untouched.
 * When forceStorm is true: triggers a full storm cycle
 * (building ~32s → peak ~24s → recovering ~48s → idle).
 * No random storms — 100% controlled by the toggle.
 */
export function useLiveSimulation(
  baseData: WaterQualityData,
  enabled: boolean = true,
  tickMs: number = 4000,
  forceStorm: boolean = false
): LiveSimulationState {
  const [liveData, setLiveData] = useState<WaterQualityData>(baseData);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [isStormSpiking, setIsStormSpiking] = useState(false);
  const [stormIntensity, setStormIntensity] = useState(0);
  const [stormPhase, setStormPhase] = useState<'idle' | 'building' | 'peak' | 'recovering'>('idle');

  const stormPhaseRef = useRef<'idle' | 'building' | 'peak' | 'recovering'>('idle');
  const stormTickRef = useRef(0);

  // Tuning: how many ticks each phase lasts
  const STORM_BUILD_TICKS = 8;    // ~32s ramp up
  const STORM_PEAK_TICKS = 6;     // ~24s peak
  const STORM_RECOVER_TICKS = 12; // ~48s recovery

  const baseDataRef = useRef(baseData);
  useEffect(() => {
    baseDataRef.current = baseData;
    if (stormPhaseRef.current === 'idle') {
      setLiveData(baseData);
    }
  }, [baseData]);

  // When forceStorm toggles ON → kick off storm cycle
  const prevForceStorm = useRef(false);
  useEffect(() => {
    if (forceStorm && !prevForceStorm.current && stormPhaseRef.current === 'idle') {
      stormPhaseRef.current = 'building';
      stormTickRef.current = 0;
      setIsStormSpiking(true);
      setStormPhase('building');
    }
    prevForceStorm.current = forceStorm;
  }, [forceStorm]);

  // Seconds-since-update counter
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      setSecondsSinceUpdate(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  const tick = useCallback(() => {
    const base = baseDataRef.current;
    const phase = stormPhaseRef.current;

    // Idle: pass through real data, no simulation
    if (phase === 'idle') {
      setLiveData(base);
      setLastUpdated(new Date());
      setSecondsSinceUpdate(0);
      return;
    }

    // Storm state machine — only runs when manually triggered
    let intensity = stormIntensity;

    if (phase === 'building') {
      stormTickRef.current += 1;
      intensity = stormTickRef.current / STORM_BUILD_TICKS;
      if (stormTickRef.current >= STORM_BUILD_TICKS) {
        stormPhaseRef.current = 'peak';
        stormTickRef.current = 0;
        intensity = 1;
        setStormPhase('peak');
      }
    } else if (phase === 'peak') {
      stormTickRef.current += 1;
      intensity = 1;
      if (stormTickRef.current >= STORM_PEAK_TICKS) {
        stormPhaseRef.current = 'recovering';
        stormTickRef.current = 0;
        setStormPhase('recovering');
      }
    } else if (phase === 'recovering') {
      stormTickRef.current += 1;
      intensity = 1 - (stormTickRef.current / STORM_RECOVER_TICKS);
      if (stormTickRef.current >= STORM_RECOVER_TICKS) {
        stormPhaseRef.current = 'idle';
        intensity = 0;
        setIsStormSpiking(false);
        setStormPhase('idle');
      }
    }

    setStormIntensity(intensity);

    // Apply drift + storm effects to each parameter
    setLiveData(prev => {
      const next = { ...prev, timestamp: new Date(), parameters: { ...prev.parameters } };

      for (const key of Object.keys(DRIFT_CONFIG)) {
        const cfg = DRIFT_CONFIG[key];
        const spike = STORM_SPIKE[key] ?? 1;

        if (prev.parameters[key]) {
          next.parameters[key] = {
            ...prev.parameters[key],
            value: driftValue(
              prev.parameters[key].value,
              base.parameters[key]?.value ?? prev.parameters[key].value,
              cfg.variance,
              cfg.min,
              cfg.max,
              intensity,
              spike
            )
          };
        }
      }

      return next;
    });

    setLastUpdated(new Date());
    setSecondsSinceUpdate(0);
  }, [stormIntensity]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(tick, tickMs);
    return () => clearInterval(interval);
  }, [enabled, tick, tickMs]);

  return {
    data: liveData,
    lastUpdated,
    secondsSinceUpdate,
    isStormSpiking,
    stormIntensity,
    stormPhase,
  };
}
