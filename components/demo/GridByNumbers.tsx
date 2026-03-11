'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

/* ── Stat items ─────────────────────────────────────────────────────── */

interface StatItem {
  value: number | null;
  suffix?: string;
  label: string;
}

const STATS: StatItem[] = [
  { value: 565000,  label: 'waterbody assessment units scored' },
  { value: 430,     suffix: 'M+', label: 'datapoints ingested from EPA ATTAINS' },
  { value: 50,      suffix: '+', label: 'live federal data sources' },
  { value: 14,      label: 'watershed intelligence models — 9 HUC-8, 5 waterbody' },
  { value: 87,      label: 'analytical lenses across 12 entity types' },
  { value: null,     label: 'Cross-site anomaly correlation across every active monitoring node' },
  { value: null,     label: 'Aqua-Lo — siloed institutional lab data now part of the national picture' },
];

/* ── Count-up hook ──────────────────────────────────────────────────── */

function useCountUp(target: number, running: boolean, duration = 1800) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!running) return;
    let raf: number;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const pct = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - pct, 3);
      setCurrent(Math.round(eased * target));
      if (pct < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, running, duration]);

  return current;
}

/* ── Stat card ──────────────────────────────────────────────────────── */

function StatCard({ item, animate }: { item: StatItem; animate: boolean }) {
  const count = useCountUp(item.value ?? 0, animate);

  if (item.value == null) {
    return (
      <div className="text-center p-6">
        <div className="text-lg font-bold text-white mb-2">
          {item.label.split(' — ')[0]}
        </div>
        {item.label.includes(' — ') && (
          <p className="text-sm text-slate-400">
            {item.label.split(' — ')[1]}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="text-center p-6">
      <div className="text-4xl font-bold text-white font-mono mb-2">
        {count.toLocaleString()}{item.suffix || ''}
      </div>
      <p className="text-sm text-slate-400">{item.label}</p>
    </div>
  );
}

/* ── Component ──────────────────────────────────────────────────────── */

export function GridByNumbers() {
  const ref = useRef<HTMLDivElement>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimate(true); },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-slate-900 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xs font-bold tracking-[0.2em] uppercase text-slate-500 text-center mb-12">
          The Grid by Numbers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STATS.map((item, i) => (
            <StatCard key={i} item={item} animate={animate} />
          ))}
        </div>
      </div>
    </section>
  );
}
