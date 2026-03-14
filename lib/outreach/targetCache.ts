/* ------------------------------------------------------------------ */
/*  PIN Outreach — Target Cache                                       */
/*  Disk + Blob persistence (same pattern as contactCache)            */
/* ------------------------------------------------------------------ */

import type { OutreachTarget } from './types';
import { BLOB_PATHS, DISK_PATHS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';
import { loadCacheFromDisk, saveCacheToDisk } from '../cacheUtils';

let _targets: OutreachTarget[] | null = null;
let _diskLoaded = false;
let _blobChecked = false;

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  const data = loadCacheFromDisk<OutreachTarget[]>(DISK_PATHS.targets);
  if (data && Array.isArray(data)) _targets = data;
}

export async function loadTargets(): Promise<OutreachTarget[]> {
  ensureDiskLoaded();
  if (_targets) return _targets;

  if (!_blobChecked) {
    _blobChecked = true;
    const data = await loadCacheFromBlob<OutreachTarget[]>(BLOB_PATHS.targets);
    if (data && Array.isArray(data)) {
      _targets = data;
      saveCacheToDisk(DISK_PATHS.targets, data);
      return _targets;
    }
  }

  _targets = [];
  return _targets;
}

export async function saveTargets(targets: OutreachTarget[]): Promise<void> {
  _targets = targets;
  saveCacheToDisk(DISK_PATHS.targets, targets);
  await saveCacheToBlob(BLOB_PATHS.targets, targets);
}
