// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

// FederalManagementCenter has 50+ deep dependencies. Instead of rendering it,
// we validate the module exports a function component (importability test).

// Mock all the required modules so the import doesn't crash
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('next/dynamic', () => ({ default: () => () => null, __esModule: true }));
vi.mock('next/image', () => ({ default: () => null, __esModule: true }));
vi.mock('@/lib/authContext', () => ({ useAuth: () => ({ user: { uid: 'u', email: 'a@b.com', name: 'T', role: 'Federal', status: 'active', isAdmin: false, adminLevel: 'none', isSuperAdmin: false, createdAt: '2024-01-01' }, logout: vi.fn(), isAuthenticated: true, isLoading: false }) }));
vi.mock('@/lib/useWaterData', () => ({ useWaterData: () => ({ data: {}, isLoading: false }), DATA_SOURCES: [], REGION_META: {}, getWaterbodyDataSources: () => [] }));
vi.mock('@/lib/useLensParam', () => ({ useLensParam: () => ['overview', vi.fn()] }));
vi.mock('@/lib/useTheme', () => ({ useTheme: () => ({ theme: 'dark', setTheme: vi.fn(), brandedColors: {} }) }));
vi.mock('@/lib/useTierFilter', () => ({ useTierFilter: () => ({ filteredData: [], setTierFilter: vi.fn(), tierFilter: 'all' }) }));
vi.mock('@/lib/adminStateContext', () => ({ useAdminState: () => ({ adminSelectedState: null, setAdminSelectedState: vi.fn() }), STATE_ABBR_TO_NAME: {} }));
vi.mock('@/lib/useStateReport', () => ({ useStateReport: () => ({ data: null, isLoading: false }) }));
vi.mock('@/hooks/useSentinelAlerts', () => ({ useSentinelAlerts: () => ({ alerts: [], isLoading: false }) }));
vi.mock('@/hooks/useFloodForecast', () => ({ useFloodForecast: () => ({ data: null, isLoading: false }) }));
vi.mock('@/hooks/useFloodRiskOverview', () => ({ useFloodRiskOverview: () => ({ overview: null, isLoading: false }) }));
vi.mock('@/hooks/useSentinelAudio', () => ({ useSentinelAudio: () => ({ play: vi.fn() }) }));
vi.mock('@/ams/hooks/useAlertSummary', () => ({ useAlertSummary: () => ({ data: null }) }));
vi.mock('@/lib/jurisdiction-context', () => ({ useJurisdictionContext: () => ({ jurisdiction: null, setJurisdiction: vi.fn() }) }));
vi.mock('@/lib/jurisdictions/index', () => ({ scopeRowsByJurisdiction: () => [] }));
vi.mock('react-map-gl/mapbox', () => ({ default: () => null, Source: () => null, Layer: () => null, Marker: () => null, Popup: () => null, NavigationControl: () => null }));
vi.mock('mapbox-gl', () => ({ default: {} }));
vi.mock('us-atlas/states-10m.json', () => ({ default: { type: 'Topology', objects: { states: { type: 'GeometryCollection', geometries: [] } }, arcs: [] } }));
vi.mock('topojson-client', () => ({ feature: () => ({ type: 'FeatureCollection', features: [] }) }));
vi.mock('@/data/huc8-names.json', () => ({ default: {} }));
vi.mock('@/data/huc8-centroids.json', () => ({ default: {} }));
vi.mock('@/lib/regionsConfig', () => ({ getRegionById: () => null }));
vi.mock('@/lib/brandedPrint', () => ({ brandedPrintSection: vi.fn(), BrandedPrintBtn: () => null }));
vi.mock('@/lib/restorationEngine', () => ({ computeRestorationPlan: () => null, resolveAttainsCategory: () => 'none', mergeAttainsCauses: () => [], COST_PER_UNIT_YEAR: {} }));
vi.mock('@/lib/ecologicalSensitivity', () => ({ getEcoScore: () => 0, getEcoData: () => null }));
vi.mock('@/lib/ejVulnerability', () => ({ getEJScore: () => 0, getEJData: () => null }));
vi.mock('@/lib/waterfrontExposure', () => ({ getExposureScore: () => 0 }));
vi.mock('@/lib/brandedPdfGenerator', () => ({ BrandedPDFGenerator: { generate: vi.fn() } }));
vi.mock('@/lib/epa-regions', () => ({ EPA_REGIONS: [], getEpaRegionForState: () => null }));
vi.mock('@/lib/scoringUtils', () => ({ scoreToGrade: () => ({ grade: 'B', color: 'green' }), ALERT_LEVEL_SCORES: {} }));
vi.mock('@/lib/indices/config', () => ({ INDEX_WEIGHTS: {} }));
vi.mock('@/lib/adminHierarchy', () => ({ getInvitableRoles: () => [] }));
vi.mock('@/lib/alerts/types', () => ({}));
vi.mock('@/lib/national-summary', () => ({}));

// Child components
const N = () => null;
vi.mock('@/components/AIInsightsEngine', () => ({ AIInsightsEngine: N }));
vi.mock('@/components/StateWaterbodyCard', () => ({ default: N }));
vi.mock('@/components/ResolutionPlanner', () => ({ default: N }));
vi.mock('@/components/RestorationPlanner', () => ({ default: N }));
vi.mock('@/components/NationalStatusCard', () => ({ default: N }));
vi.mock('@/components/ICISCompliancePanel', () => ({ ICISCompliancePanel: N }));
vi.mock('@/components/SDWISCompliancePanel', () => ({ SDWISCompliancePanel: N }));
vi.mock('@/components/NwisGwPanel', () => ({ NwisGwPanel: N }));
vi.mock('@/components/LocationReportCard', () => ({ default: N }));
vi.mock('@/components/WaterbodyDetailCard', () => ({ WaterbodyDetailCard: N }));
vi.mock('@/components/DataProvenanceAudit', () => ({ ProvenanceIcon: N }));
vi.mock('@/components/RoleTrainingGuide', () => ({ default: N }));
vi.mock('@/components/SentinelStatusBadge', () => ({ SentinelStatusBadge: N }));
vi.mock('@/components/SentinelBriefingCard', () => ({ SentinelBriefingCard: N }));
vi.mock('@/components/FloodForecastCard', () => ({ FloodForecastCard: N, FloodStatusSummary: N }));
vi.mock('@/components/FloodRiskOverviewCard', () => ({ FloodRiskOverviewCard: N, FloodRiskSummary: N }));
vi.mock('@/components/StateDataReportCard', () => ({ StateDataReportCard: N }));
vi.mock('@/components/DataFreshnessFooter', () => ({ DataFreshnessFooter: N }));
vi.mock('@/components/AirQualityMonitoringCard', () => ({ AirQualityMonitoringCard: N }));
vi.mock('@/components/BriefingQACard', () => ({ BriefingQACard: N }));
vi.mock('@/ams/components/AMSAlertMonitor', () => ({ default: N }));
vi.mock('./LayoutEditor', () => ({ LayoutEditor: ({ children }: any) => children }));
vi.mock('./DraggableSection', () => ({ DraggableSection: ({ children }: any) => children }));
vi.mock('./HeroBanner', () => ({ default: N }));
vi.mock('./GrantOpportunityMatcher', () => ({ GrantOpportunityMatcher: N }));
vi.mock('./GrantOutcomesCard', () => ({ GrantOutcomesCard: N }));
vi.mock('./EmergingContaminantsTracker', () => ({ EmergingContaminantsTracker: N }));
vi.mock('./PolicyTracker', () => ({ PolicyTracker: N }));
vi.mock('./DataLatencyTracker', () => ({ DataLatencyTracker: N }));
vi.mock('./DeltaChangelog', () => ({ DeltaChangelog: N }));
vi.mock('./HabitatEcologyPanel', () => ({ HabitatEcologyPanel: N }));
vi.mock('./AgriculturalNPSPanel', () => ({ AgriculturalNPSPanel: N }));
vi.mock('./DisasterEmergencyPanel', () => ({ DisasterEmergencyPanel: N }));
vi.mock('./MilitaryInstallationsPanel', () => ({ MilitaryInstallationsPanel: N }));
vi.mock('./WaterfrontExposurePanel', () => ({ default: N }));
vi.mock('./UserManagementPanel', () => ({ UserManagementPanel: N }));

describe('FederalManagementCenter', () => {
  it('exports FederalManagementCenter as a named function', async () => {
    const mod = await import('@/components/FederalManagementCenter');
    expect(mod.FederalManagementCenter).toBeDefined();
    expect(typeof mod.FederalManagementCenter).toBe('function');
  });
});
