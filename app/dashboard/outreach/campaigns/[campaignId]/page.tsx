'use client';

import { use } from 'react';
import OutreachLayout from '@/components/outreach/OutreachLayout';
import CampaignBuilder from '@/components/outreach/CampaignBuilder';

export default function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = use(params);
  return (
    <OutreachLayout>
      <CampaignBuilder campaignId={campaignId} />
    </OutreachLayout>
  );
}
