'use client';

import React, { Suspense } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { AdminStateProvider } from '@/lib/adminStateContext';
import { JurisdictionProvider } from '@/lib/jurisdiction-context';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminStateProvider>
      <JurisdictionProvider>
      <div className="flex h-screen bg-[var(--pin-page-bg)] overflow-hidden">
        {/* Sidebar */}
        <Suspense fallback={<div className="w-64 bg-white dark:bg-[#0D1526] border-r border-slate-200 dark:border-[rgba(58,189,176,0.12)] flex-shrink-0" />}>
          <DashboardSidebar />
        </Suspense>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <DashboardHeader />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            {children}

            {/* Footer */}
            <footer className="px-6 py-4 mt-8 bg-white dark:bg-[rgba(14,22,45,0.85)]">
              <PlatformDisclaimer />
            </footer>
          </main>
        </div>
      </div>
      </JurisdictionProvider>
      </AdminStateProvider>
    </AuthGuard>
  );
}
