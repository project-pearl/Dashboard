// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

// AlertsManagementPanel has deep dependencies that use JSX at module level.
// Mock everything for importability testing (Pattern A).

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/image', () => ({
  default: () => null,
  __esModule: true,
}));

vi.mock('@/components/AlertDeepDive', () => ({
  AlertDeepDive: () => null,
}));

vi.mock('@/lib/csrf', () => ({
  csrfHeaders: () => ({}),
}));

vi.mock('@/lib/alerts/triggers/sentinelTrigger', () => ({
  PATTERN_LABELS: {},
}));

vi.mock('@/lib/alerts/types', () => ({}));

describe('AlertsManagementPanel', () => {
  it('exports AlertsManagementPanel as a named export', async () => {
    const mod = await import('@/components/AlertsManagementPanel');
    expect(mod.AlertsManagementPanel).toBeDefined();
    expect(typeof mod.AlertsManagementPanel).toBe('function');
  });

  it('is a valid React component', async () => {
    const mod = await import('@/components/AlertsManagementPanel');
    expect(mod.AlertsManagementPanel.length).toBeDefined();
  });
});
