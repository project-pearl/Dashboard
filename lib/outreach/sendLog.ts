/* ------------------------------------------------------------------ */
/*  PIN Outreach — Send Log (append-only)                             */
/*  Disk + Blob persistence (same pattern as alert recipients)        */
/* ------------------------------------------------------------------ */

import type { SendLogEntry } from './types';
import { BLOB_PATHS, DISK_PATHS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';
import { loadCacheFromDisk, saveCacheToDisk } from '../cacheUtils';

const MAX_LOG_SIZE = 2000;

let _log: SendLogEntry[] | null = null;
let _diskLoaded = false;
let _blobChecked = false;

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  const data = loadCacheFromDisk<SendLogEntry[]>(DISK_PATHS.sendLog);
  if (data && Array.isArray(data)) _log = data;
}

export async function loadSendLog(): Promise<SendLogEntry[]> {
  ensureDiskLoaded();
  if (_log) return _log;

  if (!_blobChecked) {
    _blobChecked = true;
    const data = await loadCacheFromBlob<SendLogEntry[]>(BLOB_PATHS.sendLog);
    if (data && Array.isArray(data)) {
      _log = data;
      saveCacheToDisk(DISK_PATHS.sendLog, data);
      return _log;
    }
  }

  _log = [];
  return _log;
}

export async function appendSendLog(entry: SendLogEntry): Promise<void> {
  const log = await loadSendLog();
  log.push(entry);
  // FIFO trim
  if (log.length > MAX_LOG_SIZE) {
    log.splice(0, log.length - MAX_LOG_SIZE);
  }
  _log = log;
  saveCacheToDisk(DISK_PATHS.sendLog, log);
  await saveCacheToBlob(BLOB_PATHS.sendLog, log);
}
