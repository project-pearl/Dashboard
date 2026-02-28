'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/treatment', label: 'Our Technology' },
  { href: '/story', label: 'Our Story' },
];

interface DarkPageShellProps {
  children: React.ReactNode;
}

export default function DarkPageShell({ children }: DarkPageShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#060e1a] flex flex-col">
      {/* ═══ NAVBAR ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#060e1a]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <Image
                src="/Pearl-Intelligence-Network.png"
                alt="PIN — PEARL Intelligence Network"
                width={140}
                height={38}
                className="object-contain"
                priority
              />
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8 text-[13px] font-mono tracking-wide uppercase">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`pb-0.5 transition-colors ${
                    pathname === link.href
                      ? 'text-cyan-400 border-b border-cyan-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="hidden md:inline-flex items-center gap-2 px-5 py-2 text-sm font-mono font-semibold text-[#060e1a] bg-cyan-400 rounded-sm hover:bg-cyan-300 transition-colors"
              >
                Sign In <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden text-slate-400 hover:text-white transition-colors"
              >
                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[#060e1a]/95 backdrop-blur-xl border-t border-white/[0.06] px-6 py-4 space-y-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block text-sm font-mono tracking-wide uppercase py-2 ${
                  pathname === link.href ? 'text-cyan-400' : 'text-slate-400'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="block text-sm font-mono font-semibold text-[#060e1a] bg-cyan-400 rounded-sm px-4 py-2.5 text-center mt-2"
            >
              Sign In
            </Link>
          </div>
        )}
      </nav>

      {/* ═══ CONTENT ═══ */}
      <main className="flex-1">{children}</main>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-[#060e1a] border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <Image
                src="/Logo_Pearl_with_reef.jpg"
                alt="PIN"
                width={100}
                height={100}
                className="object-contain rounded-lg opacity-80 mb-4"
              />
              <p className="text-sm text-slate-600 leading-relaxed max-w-sm font-mono">
                PIN (PEARL Intelligence Network) — Proactive Engineering for Aquatic Rehabilitation &amp; Legacy.
              </p>
            </div>

            {/* Pages */}
            <div>
              <h4 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-slate-500 mb-4">
                Pages
              </h4>
              <ul className="space-y-3 text-sm font-mono text-slate-600">
                <li>
                  <Link href="/" className="hover:text-white transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/treatment" className="hover:text-white transition-colors">
                    Our Technology
                  </Link>
                </li>
                <li>
                  <Link href="/story" className="hover:text-white transition-colors">
                    Our Story
                  </Link>
                </li>
                <li>
                  <Link href="/tools/data-provenance" className="hover:text-white transition-colors">
                    Data Provenance
                  </Link>
                </li>
                <li>
                  <Link href="/explore" className="hover:text-white transition-colors">
                    Explore Data
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-slate-500 mb-4">
                Contact
              </h4>
              <ul className="space-y-3 text-sm font-mono text-slate-600">
                <li>
                  <a
                    href="mailto:doug@project-pearl.org?subject=PEARL%20Pilot%20Briefing"
                    className="hover:text-white transition-colors"
                  >
                    Request Pilot Briefing
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:doug@project-pearl.org?subject=PEARL%20Inquiry"
                    className="hover:text-white transition-colors"
                  >
                    Contact Us
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.epa.gov/waterdata/attains"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    EPA ATTAINS
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/[0.06] space-y-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-700 font-mono">
                &copy; {new Date().getFullYear()} Local Seafood Projects Inc. All rights reserved.
              </p>
              <p className="text-xs text-slate-700 font-mono">
                Patent Pending &middot; Built in Maryland
              </p>
            </div>
            <p className="text-[10px] text-slate-800 font-mono text-center sm:text-left">
              Project Pearl&trade;, Pearl&trade;, ALIA&trade;, and AQUA-LO&trade; are trademarks of Local Seafood Projects.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
