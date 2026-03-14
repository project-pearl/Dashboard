import { describe, it, expect } from 'vitest';
import { buildTargetResearchPrompt } from '@/lib/outreach/promptBuilder';
import type { BusinessProfile } from '@/lib/outreach/types';

const mockProfile: BusinessProfile = {
  name: 'PIN Dashboard',
  tagline: 'Real-time water quality intelligence',
  valueProps: ['Real-time monitoring', 'Compliance tracking'],
  stats: [{ label: 'Data Sources', value: '80+' }],
  differentiators: ['Federal-grade security'],
  updatedAt: '2026-03-14T00:00:00Z',
};

describe('buildTargetResearchPrompt', () => {
  it('returns system and user prompts', () => {
    const result = buildTargetResearchPrompt(mockProfile, {
      orgName: 'DARPA',
      orgType: 'federal',
      whyTarget: 'They fund water security R&D',
    });

    expect(result).toHaveProperty('system');
    expect(result).toHaveProperty('user');
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
  });

  it('includes org name in user prompt', () => {
    const result = buildTargetResearchPrompt(mockProfile, {
      orgName: 'EPA Office of Water',
      orgType: 'federal',
      whyTarget: 'Primary regulator',
    });

    expect(result.user).toContain('EPA Office of Water');
    expect(result.user).toContain('federal');
    expect(result.user).toContain('Primary regulator');
  });

  it('includes product info in user prompt', () => {
    const result = buildTargetResearchPrompt(mockProfile, {
      orgName: 'Test Org',
      orgType: 'utility',
      whyTarget: 'Large utility',
    });

    expect(result.user).toContain('PIN Dashboard');
    expect(result.user).toContain('Real-time monitoring');
    expect(result.user).toContain('80+');
  });

  it('requests JSON response format', () => {
    const result = buildTargetResearchPrompt(mockProfile, {
      orgName: 'Test',
      orgType: 'other',
      whyTarget: 'Test',
    });

    expect(result.system).toContain('JSON');
    expect(result.user).toContain('keyRoles');
    expect(result.user).toContain('painPoints');
    expect(result.user).toContain('talkingPoints');
    expect(result.user).toContain('approachStrategy');
  });

  it('works with all org types', () => {
    const orgTypes = ['federal', 'state', 'municipal', 'utility', 'university', 'corporate', 'military', 'other'] as const;
    for (const orgType of orgTypes) {
      const result = buildTargetResearchPrompt(mockProfile, {
        orgName: `Test ${orgType}`,
        orgType,
        whyTarget: 'Testing',
      });
      expect(result.user).toContain(orgType);
    }
  });
});
