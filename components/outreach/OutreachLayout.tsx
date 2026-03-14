'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import HeroBanner from '../HeroBanner';

const TABS = [
  { label: 'Campaigns', href: '/dashboard/outreach' },
  { label: 'Profile', href: '/dashboard/outreach/profile' },
  { label: 'Targets', href: '/dashboard/outreach/targets' },
  { label: 'Segments', href: '/dashboard/outreach/segments' },
  { label: 'Contacts', href: '/dashboard/outreach/contacts' },
] as const;

export default function OutreachLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <HeroBanner role="outreach" />

      {/* Content Container with consistent width */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <nav className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
          {TABS.map(tab => {
            const isActive = tab.href === '/dashboard/outreach'
              ? pathname === '/dashboard/outreach'
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Page Content */}
        <div>{children}</div>
      </div>
    </div>
  );
}
