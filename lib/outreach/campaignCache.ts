/* ------------------------------------------------------------------ */
/*  PIN Outreach — Campaign Cache                                     */
/*  Disk + Blob persistence (same pattern as alert recipients)        */
/* ------------------------------------------------------------------ */

import type { Campaign } from './types';
import { BLOB_PATHS, DISK_PATHS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';
import { loadCacheFromDisk, saveCacheToDisk } from '../cacheUtils';

let _campaigns: Campaign[] | null = null;
let _diskLoaded = false;
let _blobChecked = false;

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  const data = loadCacheFromDisk<Campaign[]>(DISK_PATHS.campaigns);
  if (data && Array.isArray(data)) _campaigns = data;
}

export async function loadCampaigns(): Promise<Campaign[]> {
  ensureDiskLoaded();
  if (_campaigns) return _campaigns;

  if (!_blobChecked) {
    _blobChecked = true;
    const data = await loadCacheFromBlob<Campaign[]>(BLOB_PATHS.campaigns);
    if (data && Array.isArray(data)) {
      _campaigns = data;
      saveCacheToDisk(DISK_PATHS.campaigns, data);
      return _campaigns;
    }
  }

  _campaigns = [];
  return _campaigns;
}

export async function saveCampaigns(campaigns: Campaign[]): Promise<void> {
  _campaigns = campaigns;
  saveCacheToDisk(DISK_PATHS.campaigns, campaigns);
  await saveCacheToBlob(BLOB_PATHS.campaigns, campaigns);
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  const campaigns = await loadCampaigns();
  return campaigns.find(c => c.id === id);
}

export async function upsertCampaign(campaign: Campaign): Promise<void> {
  const campaigns = await loadCampaigns();
  const idx = campaigns.findIndex(c => c.id === campaign.id);
  if (idx >= 0) {
    campaigns[idx] = campaign;
  } else {
    campaigns.push(campaign);
  }
  await saveCampaigns(campaigns);
}
