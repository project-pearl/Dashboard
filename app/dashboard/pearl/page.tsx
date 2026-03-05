'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const PEARLManagementCenter = dynamic(
  () => import('@/components/PEARLManagementCenter').then((m) => m.PEARLManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

class PEARLErrorBoundary extends React.Component<
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
    console.error('[PEARL Dashboard] Error boundary caught:', error.message, info.componentStack);
    if (this.state.retryCount === 0) {
      setTimeout(() => {
        this.setState({ hasError: false, error: null, retryCount: 1 });
      }, 500);
    }
  }
  render() {
    if (this.state.hasError) {
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
            Something went wrong loading the PEARL Dashboard
          </h2>
          <p className="text-sm text-slate-500 max-w-md">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null, retryCount: 0 })}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PEARLPage() {
  return (
    <PEARLErrorBoundary>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
        <PEARLManagementCenter onClose={() => {}} />
      </Suspense>
    </PEARLErrorBoundary>
  );
}
