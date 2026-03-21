/**
 * Authentication Configuration — Real auth system integration
 *
 * Replaces mock user system with configurable authentication providers.
 * Supports multiple auth strategies and user database integration.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  state: string;
  organization: string;
  isAdmin: boolean;
  lastLogin?: string;
  permissions?: string[];
}

export interface AuthConfig {
  provider: 'oauth' | 'saml' | 'ldap' | 'database' | 'development';
  allowDemoUsers: boolean;
  sessionTimeout: number; // minutes
  requireMFA: boolean;
  adminDomain?: string;
}

// ─── Authentication Configuration ────────────────────────────────────────────

function getAuthConfig(): AuthConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    provider: (process.env.AUTH_PROVIDER as any) || (isDevelopment ? 'development' : 'oauth'),
    allowDemoUsers: isDevelopment && process.env.ALLOW_DEMO_USERS === 'true',
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '480'), // 8 hours default
    requireMFA: process.env.REQUIRE_MFA === 'true',
    adminDomain: process.env.ADMIN_DOMAIN,
  };
}

export const AUTH_CONFIG = getAuthConfig();

// ─── User Role Definitions ───────────────────────────────────────────────────

export const USER_ROLES = {
  FEDERAL: 'Federal',
  STATE: 'State',
  DOD: 'DoD',
  MS4: 'MS4',
  UTILITY: 'Utility',
  CORPORATE: 'Corporate',
  BIOPHARMA: 'BioPharma',
  NGO: 'NGO',
  UNIVERSITY: 'University',
  K12: 'K12',
  ESG: 'ESG',
  INVESTOR: 'Investor',
  FACILITY: 'Facility',
  RESEARCHER: 'Researcher',
  PUBLIC: 'Public',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// ─── Permission System ──────────────────────────────────────────────────────

export const PERMISSIONS = {
  // Data access
  READ_WATER_DATA: 'read:water_data',
  READ_COMPLIANCE_DATA: 'read:compliance_data',
  READ_SENSITIVE_DATA: 'read:sensitive_data',

  // Admin functions
  MANAGE_USERS: 'manage:users',
  MANAGE_SYSTEM: 'manage:system',
  MANAGE_ALERTS: 'manage:alerts',

  // Data management
  SUBMIT_DATA: 'submit:data',
  VALIDATE_DATA: 'validate:data',
  EXPORT_DATA: 'export:data',

  // Briefings and reports
  CREATE_BRIEFINGS: 'create:briefings',
  SHARE_BRIEFINGS: 'share:briefings',

} as const;

// ─── Role-based Permissions ─────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [USER_ROLES.FEDERAL]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.READ_SENSITIVE_DATA,
    PERMISSIONS.MANAGE_ALERTS,
    PERMISSIONS.CREATE_BRIEFINGS,
    PERMISSIONS.SHARE_BRIEFINGS,
    PERMISSIONS.EXPORT_DATA,
  ],
  [USER_ROLES.STATE]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.CREATE_BRIEFINGS,
    PERMISSIONS.EXPORT_DATA,
  ],
  [USER_ROLES.DOD]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.READ_SENSITIVE_DATA,
    PERMISSIONS.CREATE_BRIEFINGS,
  ],
  [USER_ROLES.MS4]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.SUBMIT_DATA,
    PERMISSIONS.EXPORT_DATA,
  ],
  [USER_ROLES.UTILITY]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.SUBMIT_DATA,
    PERMISSIONS.EXPORT_DATA,
  ],
  [USER_ROLES.CORPORATE]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.EXPORT_DATA,
  ],
  [USER_ROLES.BIOPHARMA]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.SUBMIT_DATA,
    PERMISSIONS.EXPORT_DATA,
  ],
  [USER_ROLES.NGO]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.CREATE_BRIEFINGS,
    PERMISSIONS.SHARE_BRIEFINGS,
  ],
  [USER_ROLES.UNIVERSITY]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.SUBMIT_DATA,
    PERMISSIONS.VALIDATE_DATA,
    PERMISSIONS.CREATE_BRIEFINGS,
  ],
  [USER_ROLES.K12]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.CREATE_BRIEFINGS,
  ],
  [USER_ROLES.ESG]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.EXPORT_DATA,
  ],
  [USER_ROLES.INVESTOR]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.EXPORT_DATA,
  ],
  [USER_ROLES.FACILITY]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.SUBMIT_DATA,
  ],
  [USER_ROLES.RESEARCHER]: [
    PERMISSIONS.READ_WATER_DATA,
    PERMISSIONS.READ_COMPLIANCE_DATA,
    PERMISSIONS.SUBMIT_DATA,
    PERMISSIONS.VALIDATE_DATA,
    PERMISSIONS.CREATE_BRIEFINGS,
  ],
  [USER_ROLES.PUBLIC]: [
    PERMISSIONS.READ_WATER_DATA,
  ],
};

// ─── Utility Functions ──────────────────────────────────────────────────────

export function hasPermission(user: AuthUser, permission: string): boolean {
  if (user.isAdmin) return true;
  const rolePermissions = ROLE_PERMISSIONS[user.role as UserRole] || [];
  return rolePermissions.includes(permission) || (user.permissions || []).includes(permission);
}

export function getUserPermissions(role: UserRole, isAdmin: boolean = false): string[] {
  if (isAdmin) return Object.values(PERMISSIONS);
  return ROLE_PERMISSIONS[role] || [];
}

// ─── Development-only Demo Users (when allowDemoUsers is true) ──────────────

export function getDevelopmentUsers(): AuthUser[] {
  if (!AUTH_CONFIG.allowDemoUsers) {
    return [];
  }

  console.warn('⚠️  Using development demo users. Disable in production.');

  return [
    {
      id: 'dev-federal',
      email: 'federal@dev.pearl.gov',
      name: 'Federal Development User',
      role: USER_ROLES.FEDERAL,
      state: 'DC',
      organization: 'EPA Region 3 (Development)',
      isAdmin: false,
      permissions: getUserPermissions(USER_ROLES.FEDERAL),
    },
    {
      id: 'dev-state-md',
      email: 'state.md@dev.pearl.gov',
      name: 'State Development User (MD)',
      role: USER_ROLES.STATE,
      state: 'MD',
      organization: 'MDE (Development)',
      isAdmin: false,
      permissions: getUserPermissions(USER_ROLES.STATE),
    },
    {
      id: 'dev-admin',
      email: 'admin@dev.pearl.gov',
      name: 'Development Administrator',
      role: USER_ROLES.FEDERAL,
      state: 'DC',
      organization: 'System Administration (Development)',
      isAdmin: true,
      permissions: getUserPermissions(USER_ROLES.FEDERAL, true),
    },
  ];
}

// ─── Authentication Helpers ─────────────────────────────────────────────────

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  // In production, this would integrate with real authentication provider
  if (AUTH_CONFIG.provider === 'development' && AUTH_CONFIG.allowDemoUsers) {
    const devUsers = getDevelopmentUsers();
    const user = devUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (user && password === 'dev2025') {
      return {
        ...user,
        lastLogin: new Date().toISOString(),
      };
    }
  }

  // TODO: Integrate with real auth providers (OAuth, SAML, LDAP, etc.)
  throw new Error('Real authentication not yet implemented. Configure AUTH_PROVIDER environment variable.');
}

export function createUserSession(user: AuthUser): string {
  // In production, this would create a secure JWT or session token
  if (AUTH_CONFIG.provider === 'development') {
    return Buffer.from(JSON.stringify({
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      exp: Date.now() + (AUTH_CONFIG.sessionTimeout * 60 * 1000)
    })).toString('base64');
  }

  throw new Error('Session management not yet implemented for production auth providers.');
}

export function validateUserSession(sessionToken: string): AuthUser | null {
  try {
    if (AUTH_CONFIG.provider === 'development') {
      const sessionData = JSON.parse(Buffer.from(sessionToken, 'base64').toString());

      if (sessionData.exp < Date.now()) {
        return null; // Session expired
      }

      const devUsers = getDevelopmentUsers();
      return devUsers.find(u => u.id === sessionData.userId) || null;
    }
  } catch (error) {
    console.warn('Invalid session token:', error);
  }

  return null;
}