/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';
import { server } from './mocks/server';

// Stub env vars for tests
process.env.CRON_SECRET = 'test-cron-secret';
process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.ADMIN_EMAILS = 'doug@project-pearl.org,steve@project-pearl.org,gwen@project-pearl.org';

// Suppress unhandled rejections from background cache warming (blob/disk calls
// against fake CI URLs). Tests still fail on assertion errors — this only
// prevents background network timeouts from crashing the process after tests pass.
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (msg.includes('timeout') || msg.includes('abort') || msg.includes('Blob')) {
    // Expected in CI — fake blob URLs and network calls timeout
    return;
  }
  // Re-throw unexpected rejections so real bugs aren't swallowed
  throw reason;
});

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
