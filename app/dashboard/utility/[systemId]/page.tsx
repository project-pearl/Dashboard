'use client';

import { useParams } from 'next/navigation';
import UtilityManagementCenter from '@/components/UtilityManagementCenter';

export default function UtilityPage() {
  const params = useParams();
  const systemId = params.systemId as string;

  return <UtilityManagementCenter systemId={systemId} />;
}
