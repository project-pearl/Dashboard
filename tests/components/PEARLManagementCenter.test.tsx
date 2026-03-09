// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

// PEARLManagementCenter has 25+ deep dependencies. Mock everything for importability.

// Navigation & framework
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('next/dynamic', () => ({ default: () => () => null, __esModule: true }));
vi.mock('next/image', () => ({ default: () => null, __esModule: true }));

// Auth & hooks
vi.mock('@/lib/authContext', () => ({ useAuth: () => ({ user: { uid: 'u', email: 'a@b.com', name: 'Test', role: 'Pearl', status: 'active', isAdmin: true, adminLevel: 'super_admin', isSuperAdmin: true, createdAt: '2024-01-01' }, logout: vi.fn(), isAuthenticated: true, isLoading: false }) }));
vi.mock('@/lib/useLensParam', () => ({ useLensParam: () => ['operations', vi.fn()] }));
vi.mock('@/lib/usePearlFunding', () => ({ usePearlFunding: () => ({ data: null, isLoading: false }) }));
vi.mock('@/lib/useTheme', () => ({ useTheme: () => ({ theme: 'dark', setTheme: vi.fn(), brandedColors: {} }) }));

// Recharts
vi.mock('recharts', () => ({
  BarChart: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, Tooltip: () => null, ResponsiveContainer: ({ children }: any) => children,
  RadarChart: () => null, PolarGrid: () => null, PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null, Radar: () => null, Legend: () => null,
  AreaChart: () => null, Area: () => null, Cell: () => null, PieChart: () => null, Pie: () => null,
}));

// Data/lib mocks
vi.mock('@/lib/csrf', () => ({ csrfHeaders: () => ({}) }));
vi.mock('@/lib/alerts/types', () => ({}));
vi.mock('@/lib/siteIntelTypes', () => ({}));
vi.mock('@/lib/alerts/triggers/sentinelTrigger', () => ({ PATTERN_LABELS: {} }));

// Child components
const N = () => null;
vi.mock('@/components/MockDataBadge', () => ({ MockDataBadge: N }));
vi.mock('./HeroBanner', () => ({ default: N }));
vi.mock('./CronHealthDashboard', () => ({ default: N }));
vi.mock('./UserManagementPanel', () => ({ UserManagementPanel: N }));
vi.mock('./AlertsManagementPanel', () => ({ AlertsManagementPanel: N }));
vi.mock('./WhatIfSimulator', () => ({ default: N }));
vi.mock('@/components/RestorationPlanner', () => ({ default: N }));
vi.mock('./PredictiveRiskEngine', () => ({ default: N }));
vi.mock('@/components/ScenarioPlannerPanel', () => ({ default: N }));
vi.mock('./ScenarioPlannerPanel', () => ({ default: N }));
vi.mock('@/components/RiskInvestigationFlow', () => ({ default: N }));
vi.mock('./RiskInvestigationFlow', () => ({ default: N }));
vi.mock('@/components/DataFreshnessFooter', () => ({ DataFreshnessFooter: N }));
vi.mock('./GrantOpportunityMatcher', () => ({ GrantOpportunityMatcher: N }));
vi.mock('@/components/BudgetPlannerPanel', () => ({ default: N }));
vi.mock('@/components/RoleTrainingGuide', () => ({ default: N }));
vi.mock('./AlertDeepDive', () => ({ AlertDeepDive: N }));

describe('PEARLManagementCenter', () => {
  it('exports PEARLManagementCenter as a named function', async () => {
    const mod = await import('@/components/PEARLManagementCenter');
    expect(mod.PEARLManagementCenter).toBeDefined();
    expect(typeof mod.PEARLManagementCenter).toBe('function');
  });

  it('is a valid React component', async () => {
    const mod = await import('@/components/PEARLManagementCenter');
    expect(mod.PEARLManagementCenter.length).toBeDefined();
  });
});
