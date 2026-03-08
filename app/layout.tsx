import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/lib/authContext';

const inter = Inter({ subsets: ['latin'] });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
  ),
  title: 'Project Pearl - Water Quality Monitoring',
  description: 'Real-time water quality monitoring and MS4 compliance dashboard with automated reporting',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  icons: {
    icon: '/Pearl-Logo-alt.png',
    apple: '/Pearl-Logo-alt.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Project Pearl',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  openGraph: {
    title: 'Project Pearl - Water Quality Monitoring',
    description: 'Real-time water quality monitoring and MS4 compliance dashboard',
    images: [
      {
        url: '/Pearl-Logo-alt.png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Project Pearl - Water Quality Monitoring',
    description: 'Real-time water quality monitoring and MS4 compliance dashboard',
    images: [
      {
        url: '/Pearl-Logo-alt.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var a=localStorage.getItem('pin-accent');if(a&&a!=='teal')document.documentElement.setAttribute('data-accent',a)}catch(e){}})()` }} />
      </head>
      <body className={`${inter.className} ${jetbrainsMono.variable}`} style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="pin-theme">
          <AuthProvider>
            {children}
            <footer className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur-sm px-4 py-2 flex items-center justify-between text-[10px] text-slate-400" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card, white)' }}>
              <span>PIN synthesizes public EPA/Congressional/media signals into predictive intelligence — not official regulatory or legal advice.</span>
              <span className="flex items-center gap-3">
                <a href="mailto:doug@pinwater.org" className="hover:text-slate-600 transition-colors">Request Demo</a>
                <span className="text-slate-300">|</span>
                <a href="mailto:doug@pinwater.org" className="hover:text-slate-600 transition-colors">See Potomac Scenario in Action</a>
                <span className="text-slate-300">|</span>
                <a href="mailto:doug@pinwater.org" className="hover:text-slate-600 transition-colors font-medium">doug@pinwater.org</a>
              </span>
            </footer>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
