/* ------------------------------------------------------------------ */
/*  PIN Outreach — Audience Segment Cache                             */
/*  Disk + Blob persistence (same pattern as alert recipients)        */
/* ------------------------------------------------------------------ */

import type { AudienceSegment } from './types';
import { BLOB_PATHS, DISK_PATHS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';
import { loadCacheFromDisk, saveCacheToDisk } from '../cacheUtils';

let _segments: AudienceSegment[] | null = null;
let _diskLoaded = false;
let _blobChecked = false;

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  const data = loadCacheFromDisk<AudienceSegment[]>(DISK_PATHS.segments);
  if (data && Array.isArray(data)) _segments = data;
}

export async function loadSegments(): Promise<AudienceSegment[]> {
  ensureDiskLoaded();
  if (_segments) return _segments;

  if (!_blobChecked) {
    _blobChecked = true;
    const data = await loadCacheFromBlob<AudienceSegment[]>(BLOB_PATHS.segments);
    if (data && Array.isArray(data)) {
      _segments = data;
      saveCacheToDisk(DISK_PATHS.segments, data);
      return _segments;
    }
  }

  _segments = [];
  return _segments;
}

export async function saveSegments(segments: AudienceSegment[]): Promise<void> {
  _segments = segments;
  saveCacheToDisk(DISK_PATHS.segments, segments);
  await saveCacheToBlob(BLOB_PATHS.segments, segments);
}
