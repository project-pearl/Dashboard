/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';
import { server } from './mocks/server';

// Stub env vars for tests
process.env.CRON_SECRET = 'test-cron-secret';
process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
