/* ------------------------------------------------------------------ */
/*  PIN Outreach — Business Profile Cache                             */
/*  Disk + Blob persistence (same pattern as alert recipients)        */
/* ------------------------------------------------------------------ */

import type { BusinessProfile } from './types';
import { BLOB_PATHS, DISK_PATHS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';
import { loadCacheFromDisk, saveCacheToDisk } from '../cacheUtils';

let _profile: BusinessProfile | null = null;
let _diskLoaded = false;
let _blobChecked = false;

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  const data = loadCacheFromDisk<BusinessProfile>(DISK_PATHS.profile);
  if (data && typeof data === 'object' && 'name' in data) _profile = data;
}

export async function loadProfile(): Promise<BusinessProfile | null> {
  ensureDiskLoaded();
  if (_profile) return _profile;

  if (!_blobChecked) {
    _blobChecked = true;
    const data = await loadCacheFromBlob<BusinessProfile>(BLOB_PATHS.profile);
    if (data && typeof data === 'object' && 'name' in data) {
      _profile = data;
      saveCacheToDisk(DISK_PATHS.profile, data);
      return _profile;
    }
  }

  return null;
}

export async function saveProfile(profile: BusinessProfile): Promise<void> {
  _profile = profile;
  saveCacheToDisk(DISK_PATHS.profile, profile);
  await saveCacheToBlob(BLOB_PATHS.profile, profile);
}
