'use client';

import React, { Suspense } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { AdminStateProvider } from '@/lib/adminStateContext';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminStateProvider>
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
            <footer className="px-6 py-4 border-t border-slate-200 mt-8 bg-white dark:bg-[rgba(14,22,45,0.85)] dark:border-[rgba(58,189,176,0.12)]">
              <div className="text-[11px] text-slate-400 text-center space-y-1">
                <p>Data sourced from EPA ATTAINS, Water Quality Portal, NOAA CO-OPS, USGS NWIS, and state environmental agencies.</p>
                <p>&copy; {new Date().getFullYear()} Local Seafood Projects Inc. All rights reserved.</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Project Pearl&trade;, Pearl&trade;, ALIA&trade;, and AQUA-LO&trade; are trademarks of Local Seafood Projects Inc.</p>
              </div>
            </footer>
          </main>
        </div>
      </div>
      </AdminStateProvider>
    </AuthGuard>
  );
}
