'use client';

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-max bg-amber-500 text-white text-sm font-medium flex items-center justify-center gap-2 py-2 px-4 shadow-lg"
    >
      <WifiOff className="w-4 h-4" aria-hidden="true" />
      You are offline. Data may be stale and some features are unavailable.
    </div>
  );
}
