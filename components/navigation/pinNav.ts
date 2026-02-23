// lib/navigation/pinNav.ts
//
// PIN Platform Navigation Configuration
// ─────────────────────────────────────
// Role-based sidebar navigation for all 12 management centers.
// Aqua-Lo is admin-only in the sidebar; Aqua-Lo users land on
// their own command center at /aqua-lo (formerly SHUCK).
//
// Usage:
//   import { pinNav, getNavForRole } from '@/lib/navigation/pinNav';
//   const sidebar = getNavForRole(user.role, user.managementCenter);

import {
  Globe,
  Brain,
  TrendingUp,
  Shield,
  Droplets,
  Building2,
  Activity,
  ScrollText,
  BarChart3,
  FileText,
  Network,
  DollarSign,
  Database,
  AlertTriangle,
  Upload,
  FlaskConical,
  Landmark,
  Factory,
  Leaf,
  GraduationCap,
  School,
  Users,
  Settings,
  BookOpen,
  Microscope,
  Gauge,
  MapPin,
  ClipboardCheck,
  Beaker,
  type LucideIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────

export type ManagementCenter =
  | 'federal'
  | 'state'
  | 'ms4'
  | 'municipal'
  | 'corporate'
  | 'researcher'
  | 'college'
  | 'ngo'
  | 'k12'
  | 'aqua-lo'    // Lab/LIMS command center (formerly SHUCK)
  | 'tribal'
  | 'military';

export type UserRole =
  | 'ADMIN'
  | 'PROGRAM_MANAGER'
  | 'DATA_STEWARD'
  | 'FIELD_INSPECTOR'
  | 'VIEWER'
  | 'AUDITOR'
  | 'LAB_DIRECTOR'
  | 'LAB_ANALYST'
  | 'RESEARCHER'
  | 'EDUCATOR'
  | 'STUDENT';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: 'AI' | 'NEW' | 'BETA';
  isNew?: boolean;
  // Role-based visibility
  visibleTo?: UserRole[];         // If set, only these roles see it
  hiddenFrom?: UserRole[];        // If set, these roles don't see it
  // Management center visibility
  centers?: ManagementCenter[];   // If set, only these centers see it
  // Children (sub-menu)
  children?: NavItem[];
  // Collapse state
  defaultOpen?: boolean;
}

export interface NavSection {
  section: string;                // Section header label
  items: NavItem[];
  visibleTo?: UserRole[];
  centers?: ManagementCenter[];
}

// ─── Federal Command Center ───────────────────────────────────────────

export const federalNav: NavItem[] = [
  // Strategic
  { label: 'Overview',
    href: '/federal',
    icon: Globe },
  { label: 'AI Briefing',
    href: '/federal/briefing',
    icon: Brain,
    badge: 'AI' },
  { label: 'Trends & Forecasts',
    href: '/federal/trends',
    icon: TrendingUp,
    badge: 'AI',
    isNew: true },
  { label: 'Policy & Regulatory',
    href: '/federal/compliance/policy',
    icon: ScrollText,
    badge: 'AI',
    isNew: true },

  // Operational
  { label: 'Compliance',
    href: '/federal/compliance',
    icon: Shield,
    defaultOpen: false,
    children: [
      { label: 'Water Quality',
        href: '/federal/compliance/water-quality',
        icon: Droplets,
        badge: 'AI' },
      { label: 'Infrastructure',
        href: '/federal/compliance/infrastructure',
        icon: Building2 },
      { label: 'Scorecard',
        href: '/federal/compliance/scorecard',
        icon: BarChart3 },
      { label: 'Reports',
        href: '/federal/compliance/reports',
        icon: FileText },
    ],
  },

  // Monitoring & Threats
  { label: 'Emerging Contaminants',
    href: '/federal/emerging-contaminants',
    icon: AlertTriangle,
    badge: 'AI',
    isNew: true },
  { label: 'Monitoring',
    href: '/federal/compliance/monitoring',
    icon: Activity },

  // Coordination & Funding
  { label: 'Interagency Hub',
    href: '/federal/interagency',
    icon: Network,
    isNew: true },
  { label: 'Grants & Funding',
    href: '/federal/funding',
    icon: DollarSign,
    badge: 'AI',
    isNew: true },

  // Trust
  { label: 'Data Sources & Coverage',
    href: '/federal/data-sources',
    icon: Database,
    isNew: true },
];

// ─── State Command Center ─────────────────────────────────────────────

export const stateNav: NavItem[] = [
  { label: 'Overview',
    href: '/state',
    icon: Globe },
  { label: 'AI Briefing',
    href: '/state/briefing',
    icon: Brain,
    badge: 'AI' },
  { label: 'Integrated Report',
    href: '/state/integrated-report',
    icon: FileText },
  { label: '303(d) / Impaired Waters',
    href: '/state/impaired-waters',
    icon: AlertTriangle },
  { label: 'TMDL Tracker',
    href: '/state/tmdl',
    icon: ClipboardCheck },
  { label: 'Monitoring Network',
    href: '/state/monitoring',
    icon: Activity },
  { label: 'Permits & Enforcement',
    href: '/state/permits',
    icon: Shield },
  { label: 'Data Upload',
    href: '/state/uploads',
    icon: Upload,
    visibleTo: ['ADMIN', 'PROGRAM_MANAGER', 'DATA_STEWARD'],
    isNew: true },
  { label: 'Scorecard',
    href: '/state/scorecard',
    icon: BarChart3 },
  { label: 'Reports',
    href: '/state/reports',
    icon: FileText },
];

// ─── MS4 & Stormwater Command Center ──────────────────────────────────

export const ms4Nav: NavItem[] = [
  { label: 'Overview',
    href: '/ms4',
    icon: Globe },
  { label: 'AI Briefing',
    href: '/ms4/briefing',
    icon: Brain,
    badge: 'AI' },
  { label: 'Permit Compliance',
    href: '/ms4/compliance',
    icon: Shield },
  { label: 'Monitoring Stations',
    href: '/ms4/monitoring',
    icon: Activity },
  { label: 'BMP Tracking',
    href: '/ms4/bmp',
    icon: Leaf },
  { label: 'Watershed Alerts',
    href: '/ms4/alerts',
    icon: AlertTriangle,
    badge: 'AI' },
  { label: 'Data Upload',
    href: '/ms4/uploads',
    icon: Upload,
    visibleTo: ['ADMIN', 'PROGRAM_MANAGER', 'DATA_STEWARD', 'FIELD_INSPECTOR'],
    isNew: true },
  { label: 'Scorecard',
    href: '/ms4/scorecard',
    icon: BarChart3 },
  { label: 'Annual Report',
    href: '/ms4/annual-report',
    icon: FileText },
  { label: 'Grants & Funding',
    href: '/ms4/funding',
    icon: DollarSign,
    badge: 'AI',
    isNew: true },
];

// ─── Municipal / Water Utility Command Center ─────────────────────────

export const municipalNav: NavItem[] = [
  { label: 'Overview',
    href: '/municipal',
    icon: Globe },
  { label: 'AI Briefing',
    href: '/municipal/briefing',
    icon: Brain,
    badge: 'AI' },
  { label: 'Source Water Quality',
    href: '/municipal/source-water',
    icon: Droplets },
  { label: 'Treatment Performance',
    href: '/municipal/treatment',
    icon: Gauge },
  { label: 'Distribution System',
    href: '/municipal/distribution',
    icon: Building2 },
  { label: 'Compliance',
    href: '/municipal/compliance',
    icon: Shield },
  { label: 'Reports',
    href: '/municipal/reports',
    icon: FileText },
];

// ─── Corporate ESG Command Center ─────────────────────────────────────

export const corporateNav: NavItem[] = [
  { label: 'Overview',
    href: '/corporate',
    icon: Globe },
  { label: 'AI Briefing',
    href: '/corporate/briefing',
    icon: Brain,
    badge: 'AI' },
  { label: 'Facility Compliance',
    href: '/corporate/compliance',
    icon: Shield },
  { label: 'Discharge Monitoring',
    href: '/corporate/discharge',
    icon: Droplets },
  { label: 'ESG Reporting',
    href: '/corporate/esg',
    icon: BarChart3 },
  { label: 'Risk Assessment',
    href: '/corporate/risk',
    icon: AlertTriangle,
    badge: 'AI' },
  { label: 'Data Upload',
    href: '/corporate/uploads',
    icon: Upload,
    visibleTo: ['ADMIN', 'PROGRAM_MANAGER', 'DATA_STEWARD'],
    isNew: true },
  { label: 'Reports',
    href: '/corporate/reports',
    icon: FileText },
];

// ─── Researcher Command Center ────────────────────────────────────────

export const researcherNav: NavItem[] = [
  { label: 'Overview',
    href: '/researcher',
    icon: Globe },
  { label: 'Data Explorer',
    href: '/researcher/explorer',
    icon: Database },
  { label: 'Query Builder',
    href: '/researcher/query',
    icon: Microscope },
  { label: 'Trend Analysis',
    href: '/researcher/trends',
    icon: TrendingUp,
    badge: 'AI' },
  { label: 'Data Upload',
    href: '/researcher/uploads',
    icon: Upload,
    visibleTo: ['ADMIN', 'RESEARCHER'],
    isNew: true },
  { label: 'Export & API',
    href: '/researcher/export',
    icon: FileText },
];

// ─── College / University Command Center ──────────────────────────────

export const collegeNav: NavItem[] = [
  { label: 'Overview',
    href: '/college',
    icon: Globe },
  { label: 'Campus Water Quality',
    href: '/college/campus',
    icon: Droplets },
  { label: 'Research Dashboard',
    href: '/college/research',
    icon: Microscope },
  { label: 'Student Projects',
    href: '/college/projects',
    icon: GraduationCap },
  { label: 'Data Upload',
    href: '/college/uploads',
    icon: Upload,
    visibleTo: ['ADMIN', 'RESEARCHER', 'EDUCATOR'],
    isNew: true },
  { label: 'Reports',
    href: '/college/reports',
    icon: FileText },
];

// ─── NGO Command Center ──────────────────────────────────────────────

export const ngoNav: NavItem[] = [
  { label: 'Overview',
    href: '/ngo',
    icon: Globe },
  { label: 'AI Briefing',
    href: '/ngo/briefing',
    icon: Brain,
    badge: 'AI' },
  { label: 'Watershed Watch',
    href: '/ngo/watershed',
    icon: MapPin },
  { label: 'Volunteer Monitoring',
    href: '/ngo/monitoring',
    icon: Users },
  { label: 'Advocacy Dashboard',
    href: '/ngo/advocacy',
    icon: AlertTriangle },
  { label: 'Data Upload',
    href: '/ngo/uploads',
    icon: Upload,
    visibleTo: ['ADMIN', 'PROGRAM_MANAGER', 'DATA_STEWARD'],
    isNew: true },
  { label: 'Reports',
    href: '/ngo/reports',
    icon: FileText },
  { label: 'Grants & Funding',
    href: '/ngo/funding',
    icon: DollarSign,
    badge: 'AI' },
];

// ─── K-12 Command Center (Read-Only, No Upload) ─────────────────────

export const k12Nav: NavItem[] = [
  { label: 'Overview',
    href: '/k12',
    icon: Globe },
  { label: 'Water Quality Explorer',
    href: '/k12/explorer',
    icon: Droplets },
  { label: 'Lesson Modules',
    href: '/k12/lessons',
    icon: BookOpen },
  { label: 'Data Sandbox',
    href: '/k12/sandbox',
    icon: Database },
  { label: 'Student Dashboard',
    href: '/k12/student',
    icon: School },
  // No upload. No data modification. Read-only.
];

// ─── Aqua-Lo Command Center (Lab/LIMS — formerly SHUCK) ─────────────
// Users with LAB_DIRECTOR or LAB_ANALYST role land here.
// This does NOT appear in the main platform sidebar.
// Aqua-Lo users access it directly at /aqua-lo after login.

export const aquaLoNav: NavItem[] = [
  { label: 'Lab Dashboard',
    href: '/aqua-lo',
    icon: FlaskConical },
  { label: 'Sample Intake',
    href: '/aqua-lo/intake',
    icon: Upload },
  { label: 'Chain of Custody',
    href: '/aqua-lo/chain-of-custody',
    icon: ClipboardCheck },
  { label: 'Analysis Queue',
    href: '/aqua-lo/queue',
    icon: Activity },
  { label: 'Results & QA/QC',
    href: '/aqua-lo/results',
    icon: BarChart3 },
  { label: 'Push to PIN',
    href: '/aqua-lo/push',
    icon: Network,
    badge: 'NEW' },
  { label: 'Audit Trail',
    href: '/aqua-lo/audit',
    icon: ScrollText },
  { label: 'Reports',
    href: '/aqua-lo/reports',
    icon: FileText },
];

// ─── Admin-Only Navigation ───────────────────────────────────────────
// Visible only to ADMIN role. Includes Aqua-Lo management,
// platform settings, user management, and system health.

export const adminNav: NavItem[] = [
  { label: 'Admin Dashboard',
    href: '/admin',
    icon: Settings },
  { label: 'User Management',
    href: '/admin/users',
    icon: Users },
  { label: 'Aqua-Lo Management',
    href: '/admin/aqua-lo',
    icon: FlaskConical,
    children: [
      { label: 'Lab Accounts',
        href: '/admin/aqua-lo/accounts',
        icon: Users },
      { label: 'Data Pipeline',
        href: '/admin/aqua-lo/pipeline',
        icon: Network },
      { label: 'QA/QC Rules',
        href: '/admin/aqua-lo/qa',
        icon: ClipboardCheck },
    ],
  },
  { label: 'Data Sources',
    href: '/admin/data-sources',
    icon: Database },
  { label: 'API Keys',
    href: '/admin/api-keys',
    icon: Shield },
  { label: 'System Health',
    href: '/admin/health',
    icon: Activity },
  { label: 'Audit Log',
    href: '/admin/audit',
    icon: ScrollText },
];

// ─── Navigation Registry ─────────────────────────────────────────────

export const navRegistry: Record<ManagementCenter, NavItem[]> = {
  federal:    federalNav,
  state:      stateNav,
  ms4:        ms4Nav,
  municipal:  municipalNav,
  corporate:  corporateNav,
  researcher: researcherNav,
  college:    collegeNav,
  ngo:        ngoNav,
  k12:        k12Nav,
  'aqua-lo':  aquaLoNav,
  tribal:     federalNav,    // TODO: Build tribal-specific nav
  military:   federalNav,    // TODO: Build military-specific nav
};

// ─── Center Display Names ────────────────────────────────────────────

export const centerLabels: Record<ManagementCenter, string> = {
  federal:    'Federal',
  state:      'State',
  ms4:        'MS4 & Stormwater',
  municipal:  'Municipal Utility',
  corporate:  'Corporate ESG',
  researcher: 'Researcher',
  college:    'College / University',
  ngo:        'NGO / Watershed',
  k12:        'K-12 Education',
  'aqua-lo':  'Aqua-Lo Laboratory',
  tribal:     'Tribal',
  military:   'Military Installation',
};

// ─── Main Platform Sidebar Sections ──────────────────────────────────
// This is what users see in the top-level sidebar to switch centers.
// Aqua-Lo is NOT listed here. Lab users land directly on /aqua-lo.

export const platformSections: NavSection[] = [
  {
    section: 'GOVERNMENT',
    items: [
      { label: 'Federal',
        href: '/federal',
        icon: Landmark },
      { label: 'State',
        href: '/state',
        icon: Globe },
      { label: 'MS4 & Stormwater',
        href: '/ms4',
        icon: Droplets },
      { label: 'Municipal Utility',
        href: '/municipal',
        icon: Building2 },
      { label: 'Tribal',
        href: '/tribal',
        icon: Globe,
        badge: 'BETA' },
      { label: 'Military Installation',
        href: '/military',
        icon: Shield,
        badge: 'BETA' },
    ],
  },
  {
    section: 'INDUSTRY',
    items: [
      { label: 'Corporate ESG',
        href: '/corporate',
        icon: Factory },
    ],
  },
  {
    section: 'SCIENCE & EDUCATION',
    items: [
      { label: 'Researcher',
        href: '/researcher',
        icon: Microscope },
      { label: 'College / University',
        href: '/college',
        icon: GraduationCap },
      { label: 'NGO / Watershed',
        href: '/ngo',
        icon: Leaf },
      { label: 'K-12 Education',
        href: '/k12',
        icon: School },
    ],
  },
  {
    // Admin-only section. Aqua-Lo management lives here.
    section: 'ADMINISTRATION',
    items: adminNav,
    visibleTo: ['ADMIN'],
  },
];

// ─── Helper: Get Navigation for a User ───────────────────────────────

export function getNavForRole(
  role: UserRole,
  center: ManagementCenter,
): NavItem[] {
  const nav = navRegistry[center] || [];

  return nav
    .filter(item => {
      // Check role visibility
      if (item.visibleTo && !item.visibleTo.includes(role)) return false;
      if (item.hiddenFrom && item.hiddenFrom.includes(role)) return false;
      return true;
    })
    .map(item => {
      // Filter children too
      if (item.children) {
        return {
          ...item,
          children: item.children.filter(child => {
            if (child.visibleTo && !child.visibleTo.includes(role)) return false;
            if (child.hiddenFrom && child.hiddenFrom.includes(role)) return false;
            return true;
          }),
        };
      }
      return item;
    });
}

// ─── Helper: Get Platform Sections for a User ────────────────────────

export function getPlatformSections(role: UserRole): NavSection[] {
  return platformSections.filter(section => {
    if (section.visibleTo && !section.visibleTo.includes(role)) return false;
    return true;
  });
}

// ─── Helper: Get Landing Route for a User ────────────────────────────
// Aqua-Lo users land on /aqua-lo, not the main platform sidebar.

export function getLandingRoute(
  role: UserRole,
  center: ManagementCenter,
): string {
  if (center === 'aqua-lo') return '/aqua-lo';
  if (role === 'ADMIN') return '/admin';

  const routes: Record<ManagementCenter, string> = {
    federal:    '/federal',
    state:      '/state',
    ms4:        '/ms4',
    municipal:  '/municipal',
    corporate:  '/corporate',
    researcher: '/researcher',
    college:    '/college',
    ngo:        '/ngo',
    k12:        '/k12',
    'aqua-lo':  '/aqua-lo',
    tribal:     '/tribal',
    military:   '/military',
  };

  return routes[center] || '/';
}
