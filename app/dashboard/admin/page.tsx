'use client';

import { PEARLManagementCenter } from '@/components/PEARLManagementCenter';
import SentinelHealthMonitor from '@/ams/components/SentinelHealthMonitor';
import { useSentinelHealth } from '@/ams/hooks/useSentinelHealth';

export default function AdminPage() {
  const sentinelSources = useSentinelHealth();

  return (
    <div className="space-y-6 p-6">
      <SentinelHealthMonitor sources={sentinelSources} />
      <PEARLManagementCenter onClose={() => {}} />
    </div>
  );
}
