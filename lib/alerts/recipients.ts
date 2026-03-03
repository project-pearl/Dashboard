/* ------------------------------------------------------------------ */
/*  PIN Alerts — Recipient Management                                 */
/*  Disk + Blob persistence (same pattern as sentinel health)         */
/* ------------------------------------------------------------------ */

import type { AlertRecipient, AlertSeverity, AlertTriggerType } from './types';
import { BLOB_PATHS, DISK_PATHS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';
import { loadCacheFromDisk, saveCacheToDisk } from '../cacheUtils';

let _recipients: AlertRecipient[] | null = null;
let _diskLoaded = false;
let _blobChecked = false;

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  const data = loadCacheFromDisk<AlertRecipient[]>(DISK_PATHS.recipients);
  if (data && Array.isArray(data)) _recipients = data;
}

export async function loadRecipients(): Promise<AlertRecipient[]> {
  ensureDiskLoaded();
  if (_recipients) return _recipients;

  if (!_blobChecked) {
    _blobChecked = true;
    const data = await loadCacheFromBlob<AlertRecipient[]>(BLOB_PATHS.recipients);
    if (data && Array.isArray(data)) {
      _recipients = data;
      saveCacheToDisk(DISK_PATHS.recipients, data);
      return _recipients;
    }
  }

  _recipients = [];
  return _recipients;
}

export async function saveRecipients(recipients: AlertRecipient[]): Promise<void> {
  _recipients = recipients;
  saveCacheToDisk(DISK_PATHS.recipients, recipients);
  await saveCacheToBlob(BLOB_PATHS.recipients, recipients);
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

export function getRecipientsForAlert(
  triggerType: AlertTriggerType,
  severity: AlertSeverity,
  recipients: AlertRecipient[],
): AlertRecipient[] {
  return recipients.filter(r => {
    if (!r.active) return false;
    if (!r.triggers.includes(triggerType)) return false;
    // Check if this severity meets the recipient's minimum severity threshold
    const eventRank = SEVERITY_RANK[severity];
    const minRank = Math.min(...r.severities.map(s => SEVERITY_RANK[s]));
    return eventRank >= minRank;
  });
}
