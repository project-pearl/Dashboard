'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/', label: 'Home', anchor: undefined },
  { href: '/explore', label: 'Explore Data' },
  { href: '/treatment', label: 'Our Technology' },
  { href: '/story', label: 'Our Story' },
];

export default function PublicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isHome = pathname === '/';

  function handleNav(link: typeof NAV_LINKS[0]) {
    setMobileOpen(false);
    if (link.anchor && isHome) {
      // On the home page, scroll to the anchor
      const el = document.querySelector(link.anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (link.anchor) {
      // On other pages, navigate home with hash
      router.push('/' + link.anchor);
    }
    // Regular links handled by <Link>
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/95 border-b border-slate-200/60 shadow-sm shadow-slate-200/20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/">
            <Image src="/Pearl-Intelligence-Network.png" alt="PEARL Intelligence Network" width={160} height={44} className="object-contain" priority />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-[13px] font-semibold tracking-wide uppercase text-slate-500">
            {NAV_LINKS.map((link) => {
              const isActive = !link.anchor && pathname === link.href;
              if (link.anchor) {
                return (
                  <button
                    key={link.label}
                    onClick={() => handleNav(link)}
                    className={`hover:text-slate-900 transition-colors ${isHome ? '' : 'hidden lg:block'}`}
                  >
                    {link.label}
                  </button>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors ${
                    isActive
                      ? 'text-slate-900 border-b-2 border-slate-900 pb-0.5'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-full bg-slate-900 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
            >
              Sign In <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-slate-500 hover:text-slate-900 transition-colors"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200/60 px-6 py-4 space-y-1">
          {NAV_LINKS.map((link) => {
            if (link.anchor) {
              return (
                <button
                  key={link.label}
                  onClick={() => handleNav(link)}
                  className="block w-full text-left text-sm font-semibold tracking-wide uppercase py-2.5 text-slate-500 hover:text-slate-900"
                >
                  {link.label}
                </button>
              );
            }
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block text-sm font-semibold tracking-wide uppercase py-2.5 ${
                  pathname === link.href ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
