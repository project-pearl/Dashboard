'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const FederalManagementCenter = dynamic(
  () => import('@/components/FederalManagementCenter').then((m) => m.FederalManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

class FMCErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; retryCount: number }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Federal Dashboard] Error boundary caught:', error.message, info.componentStack);
    // Auto-retry once on first error (handles transient mount race conditions)
    if (this.state.retryCount === 0) {
      setTimeout(() => {
        this.setState({ hasError: false, error: null, retryCount: 1 });
      }, 500);
    }
  }
  render() {
    if (this.state.hasError) {
      // Show retry UI only after auto-retry has been attempted
      if (this.state.retryCount === 0) {
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <Skeleton className="w-full h-[400px]" />
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
          <h2 className="text-lg font-semibold text-slate-800">
            Something went wrong loading the Federal Dashboard
          </h2>
          <p className="text-sm text-slate-500 max-w-md">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null, retryCount: 0 })}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function FederalPage() {
  return (
    <FMCErrorBoundary>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
        <FederalManagementCenter
          onClose={() => {}}
          onSelectRegion={() => {}}
          federalMode
        />
      </Suspense>
    </FMCErrorBoundary>
  );
}
