'use client';

import { useEffect } from 'react';
import { useCacheStatus } from '@/lib/useCacheStatus';

/** Updates the favicon with an alert badge when Sentinel has active alerts. */
export function DynamicFavicon() {
  const { data } = useCacheStatus(60_000);

  useEffect(() => {
    if (!data || typeof data !== 'object') return;
    const caches = data as Record<string, unknown>;
    // Check if any sentinel/alert cache has active alerts
    const alertCount = (caches as Record<string, { count?: number }>)?.sentinelAlerts?.count ?? 0;

    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) return;

    if (alertCount > 0) {
      // Draw alert badge on favicon via canvas
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = '/Pearl-Logo-alt.png';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 64, 64);
        // Red badge circle
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(52, 12, 12, 0, 2 * Math.PI);
        ctx.fill();
        // Badge text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(alertCount > 9 ? '9+' : String(alertCount), 52, 13);
        link.href = canvas.toDataURL('image/png');
      };
    } else {
      // Reset to default
      link.href = '/Pearl-Logo-alt.png';
    }
  }, [data]);

  return null;
}
