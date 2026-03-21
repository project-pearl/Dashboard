import { describe, it, expect } from 'vitest';
import { normalizeUserRole, resolveAdminLevel } from '@/lib/authTypes';

describe('normalizeUserRole', () => {
  const validRoles = [
    ['Federal', 'Federal'],
    ['State', 'State'],
    ['Local', 'Local'],
    ['MS4', 'MS4'],
    ['Corporate', 'Corporate'],
    ['Researcher', 'Researcher'],
    ['College', 'College'],
    ['NGO', 'NGO'],
    ['K12', 'K12'],
    ['Temp', 'Temp'],
    ['Pearl', 'Pearl'],
    ['Utility', 'Utility'],
    ['Agriculture', 'Agriculture'],
    ['Lab', 'Lab'],
    ['Biotech', 'Biotech'],
    ['Investor', 'Investor'],
  ] as const;

  it.each(validRoles)('normalizes "%s" correctly', (input, expected) => {
    expect(normalizeUserRole(input)).toBe(expected);
  });

  it('is case-insensitive', () => {
    expect(normalizeUserRole('FEDERAL')).toBe('Federal');
    expect(normalizeUserRole('federal')).toBe('Federal');
    expect(normalizeUserRole('FeDerAL')).toBe('Federal');
    expect(normalizeUserRole('ms4')).toBe('MS4');
  });

  it('returns NGO for unknown roles', () => {
    expect(normalizeUserRole('unknown')).toBe('NGO');
    expect(normalizeUserRole('')).toBe('NGO');
    expect(normalizeUserRole(undefined)).toBe('NGO');
  });
});

describe('resolveAdminLevel', () => {
  it('returns super_admin from DB value', () => {
    expect(resolveAdminLevel('super_admin', 'random@example.com')).toBe('super_admin');
  });

  it('returns role_admin from DB value', () => {
    expect(resolveAdminLevel('role_admin', 'random@example.com')).toBe('role_admin');
  });

  it('returns none for database-only system', () => {
    expect(resolveAdminLevel(null, 'doug@project-pearl.org')).toBe('none');
    expect(resolveAdminLevel(undefined, 'steve@project-pearl.org')).toBe('none');
    expect(resolveAdminLevel(null, 'nobody@example.com')).toBe('none');
    expect(resolveAdminLevel('none', 'nobody@example.com')).toBe('none');
  });
});
