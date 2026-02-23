/**
 * Shared Vercel Blob persistence helpers for cross-instance cache survival.
 *
 * All cache modules call saveCacheToBlob() after saveToDisk() and
 * loadCacheFromBlob() when ensureDiskLoaded() finds nothing on disk.
 * Uses raw REST API to avoid webpack/undici issues with @vercel/blob.
 */

const BLOB_API = 'https://blob.vercel-storage.com';
const LIST_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 45_000;

export async function saveCacheToBlob(blobPath: string, data: unknown): Promise<boolean> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return false;
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const res = await fetch(`${BLOB_API}/${blobPath}`, {
      method: 'PUT',
      headers: {
        'authorization': `Bearer ${token}`,
        'x-api-version': '7',
        'x-content-type': 'application/json',
        'x-add-random-suffix': '0',
      },
      body: payload,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.warn(`[Blob] Saved ${blobPath} (${sizeMB}MB)`);
    return true;
  } catch (e: any) {
    console.warn(`[Blob] Save failed ${blobPath}: ${e.message}`);
    return false;
  }
}

export async function loadCacheFromBlob<T = any>(blobPath: string): Promise<T | null> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.warn(`[Blob] Load ${blobPath}: no BLOB_READ_WRITE_TOKEN`);
      return null;
    }
    console.warn(`[Blob] Load ${blobPath}: starting list request...`);
    const listRes = await fetch(
      `${BLOB_API}?prefix=${encodeURIComponent(blobPath)}&limit=1`,
      {
        headers: { 'authorization': `Bearer ${token}`, 'x-api-version': '7' },
        signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
      },
    );
    if (!listRes.ok) {
      console.warn(`[Blob] Load ${blobPath}: list HTTP ${listRes.status}`);
      return null;
    }
    const listData = await listRes.json();
    const blobs = listData?.blobs || [];
    if (blobs.length === 0) {
      console.warn(`[Blob] Load ${blobPath}: no blobs found`);
      return null;
    }
    const downloadUrl = blobs[0].downloadUrl || blobs[0].url;
    const sizeBytes = blobs[0].size || 0;
    console.warn(`[Blob] Load ${blobPath}: downloading ${(sizeBytes / 1024 / 1024).toFixed(1)}MB from blob...`);
    const res = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[Blob] Load ${blobPath}: download HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.warn(`[Blob] Loaded ${blobPath} OK (${(sizeBytes / 1024 / 1024).toFixed(1)}MB)`);
    return data;
  } catch (e: any) {
    console.warn(`[Blob] Load FAILED ${blobPath}: ${e.message}`);
    return null;
  }
}
