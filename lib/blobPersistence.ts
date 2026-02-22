/**
 * Shared Vercel Blob persistence helpers for cross-instance cache survival.
 *
 * All cache modules call saveCacheToBlob() after saveToDisk() and
 * loadCacheFromBlob() when ensureDiskLoaded() finds nothing on disk.
 * Uses raw REST API to avoid webpack/undici issues with @vercel/blob.
 */

const BLOB_API = 'https://blob.vercel-storage.com';

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
    if (!token) return null;
    const listRes = await fetch(
      `${BLOB_API}?prefix=${encodeURIComponent(blobPath)}&limit=1`,
      { headers: { 'authorization': `Bearer ${token}`, 'x-api-version': '7' } },
    );
    if (!listRes.ok) return null;
    const listData = await listRes.json();
    const blobs = listData?.blobs || [];
    if (blobs.length === 0) return null;
    const downloadUrl = blobs[0].downloadUrl || blobs[0].url;
    const res = await fetch(downloadUrl);
    if (!res.ok) return null;
    return res.json();
  } catch (e: any) {
    console.warn(`[Blob] Load failed ${blobPath}: ${e.message}`);
    return null;
  }
}
