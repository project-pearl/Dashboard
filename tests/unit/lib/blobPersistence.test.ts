import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { saveCacheToBlob, loadCacheFromBlob } from '@/lib/blobPersistence';

describe('saveCacheToBlob', () => {
  it('returns true on success', async () => {
    const result = await saveCacheToBlob('cache/test.json', { foo: 'bar' });
    expect(result).toBe(true);
  });

  it('returns false when no token', async () => {
    const original = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const result = await saveCacheToBlob('cache/test.json', { foo: 'bar' });
    expect(result).toBe(false);
    process.env.BLOB_READ_WRITE_TOKEN = original;
  });

  it('returns false on HTTP 500', async () => {
    server.use(
      http.put('https://blob.vercel-storage.com/*', () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const result = await saveCacheToBlob('cache/test.json', { foo: 'bar' });
    expect(result).toBe(false);
  });
});

describe('loadCacheFromBlob', () => {
  it('returns parsed JSON on success', async () => {
    const testData = { meta: { built: '2024-01-01' }, records: [1, 2, 3] };
    server.use(
      http.get('https://blob.vercel-storage.com', () => {
        return HttpResponse.json({
          blobs: [{ downloadUrl: 'https://blob.vercel-storage.com/download/test', size: 100 }],
        });
      }),
      http.get('https://blob.vercel-storage.com/download/test', () => {
        return HttpResponse.json(testData);
      }),
    );
    const result = await loadCacheFromBlob('cache/test.json');
    expect(result).toEqual(testData);
  });

  it('returns null when no token', async () => {
    const original = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const result = await loadCacheFromBlob('cache/test.json');
    expect(result).toBeNull();
    process.env.BLOB_READ_WRITE_TOKEN = original;
  });

  it('returns null when empty blob list', async () => {
    server.use(
      http.get('https://blob.vercel-storage.com', () => {
        return HttpResponse.json({ blobs: [] });
      }),
    );
    const result = await loadCacheFromBlob('cache/test.json');
    expect(result).toBeNull();
  });

  it('returns null on download failure', async () => {
    server.use(
      http.get('https://blob.vercel-storage.com', () => {
        return HttpResponse.json({
          blobs: [{ downloadUrl: 'https://blob.vercel-storage.com/download/fail', size: 100 }],
        });
      }),
      http.get('https://blob.vercel-storage.com/download/fail', () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const result = await loadCacheFromBlob('cache/test.json');
    expect(result).toBeNull();
  });
});
