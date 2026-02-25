import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/lib/authContext';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
