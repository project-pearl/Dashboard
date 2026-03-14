/* ------------------------------------------------------------------ */
/*  PIN Outreach — Contact Cache                                      */
/*  Disk + Blob persistence (same pattern as alert recipients)        */
/* ------------------------------------------------------------------ */

import type { OutreachContact } from './types';
import { BLOB_PATHS, DISK_PATHS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';
import { loadCacheFromDisk, saveCacheToDisk } from '../cacheUtils';

let _contacts: OutreachContact[] | null = null;
let _diskLoaded = false;
let _blobChecked = false;

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  const data = loadCacheFromDisk<OutreachContact[]>(DISK_PATHS.contacts);
  if (data && Array.isArray(data)) _contacts = data;
}

export async function loadContacts(): Promise<OutreachContact[]> {
  ensureDiskLoaded();
  if (_contacts) return _contacts;

  if (!_blobChecked) {
    _blobChecked = true;
    const data = await loadCacheFromBlob<OutreachContact[]>(BLOB_PATHS.contacts);
    if (data && Array.isArray(data)) {
      _contacts = data;
      saveCacheToDisk(DISK_PATHS.contacts, data);
      return _contacts;
    }
  }

  _contacts = [];
  return _contacts;
}

export async function saveContacts(contacts: OutreachContact[]): Promise<void> {
  _contacts = contacts;
  saveCacheToDisk(DISK_PATHS.contacts, contacts);
  await saveCacheToBlob(BLOB_PATHS.contacts, contacts);
}
