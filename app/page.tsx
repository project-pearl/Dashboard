'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect directly to federal dashboard
    router.replace('/dashboard/federal');
  }, [router]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <p>Redirecting to dashboard...</p>
    </div>
  );
}