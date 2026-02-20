import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/authContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Project Pearl - Water Quality Monitoring',
  description: 'Real-time water quality monitoring and MS4 compliance dashboard with automated reporting',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  icons: {
    icon: '/Logo_Pearl_as_Headline.JPG',
    apple: '/Logo_Pearl_as_Headline.JPG',
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
        url: '/Logo_Pearl_as_Headline.JPG',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Project Pearl - Water Quality Monitoring',
    description: 'Real-time water quality monitoring and MS4 compliance dashboard',
    images: [
      {
        url: '/Logo_Pearl_as_Headline.JPG',
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
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
