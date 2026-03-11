import { describe, it, expect } from 'vitest';
import {
  uploadSubmitSchema,
  csvUploadSchema,
  alertRuleCreateSchema,
  alertRecipientCreateSchema,
  askPinSchema,
  inviteCreateSchema,
  cacheRefreshSchema,
} from '@/lib/schemas';

describe('schemas', () => {
  /* ---------------------------------------------------------------- */
  /*  uploadSubmitSchema                                               */
  /* ---------------------------------------------------------------- */
  describe('uploadSubmitSchema', () => {
    const validInput = {
      parameter: 'DO',
      value: 7.5,
      latitude: '39.0',
      longitude: '-76.5',
      user_id: 'user-123',
      user_role: 'NGO',
    };

    it('accepts valid input', () => {
      const result = uploadSubmitSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('accepts valid input with optional fields', () => {
      const result = uploadSubmitSchema.safeParse({
        ...validInput,
        location_name: 'Rock Creek',
        sample_date: '2024-01-15',
        volunteer_id: 'vol-1',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing required parameter', () => {
      const { parameter, ...rest } = validInput;
      const result = uploadSubmitSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects invalid parameter enum value', () => {
      const result = uploadSubmitSchema.safeParse({ ...validInput, parameter: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('rejects string where number expected for value', () => {
      const result = uploadSubmitSchema.safeParse({ ...validInput, value: 'not-a-number' });
      expect(result.success).toBe(false);
    });

    it('rejects empty string for latitude', () => {
      const result = uploadSubmitSchema.safeParse({ ...validInput, latitude: '' });
      expect(result.success).toBe(false);
    });

    it('rejects empty string for user_id', () => {
      const result = uploadSubmitSchema.safeParse({ ...validInput, user_id: '' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid user_role enum', () => {
      const result = uploadSubmitSchema.safeParse({ ...validInput, user_role: 'Admin' });
      expect(result.success).toBe(false);
    });

    it('validates all parameter enum values', () => {
      const validParams = ['DO', 'pH', 'temperature', 'turbidity', 'bacteria', 'TN', 'TP', 'conductivity'];
      for (const param of validParams) {
        const result = uploadSubmitSchema.safeParse({ ...validInput, parameter: param });
        expect(result.success).toBe(true);
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  csvUploadSchema                                                  */
  /* ---------------------------------------------------------------- */
  describe('csvUploadSchema', () => {
    const validInput = {
      csv_text: 'header1,header2\nval1,val2',
      user_id: 'user-123',
      user_role: 'K12',
    };

    it('accepts valid input', () => {
      const result = csvUploadSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('rejects empty csv_text', () => {
      const result = csvUploadSchema.safeParse({ ...validInput, csv_text: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing user_id', () => {
      const { user_id, ...rest } = validInput;
      const result = csvUploadSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects invalid user_role', () => {
      const result = csvUploadSchema.safeParse({ ...validInput, user_role: 'Federal' });
      expect(result.success).toBe(false);
    });

    it('accepts optional column_mapping', () => {
      const result = csvUploadSchema.safeParse({
        ...validInput,
        column_mapping: { col1: 'parameter', col2: 'value' },
      });
      expect(result.success).toBe(true);
    });

    it('passes when optional fields are omitted', () => {
      const result = csvUploadSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.column_mapping).toBeUndefined();
        expect(result.data.state_abbr).toBeUndefined();
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  alertRuleCreateSchema                                            */
  /* ---------------------------------------------------------------- */
  describe('alertRuleCreateSchema', () => {
    const validInput = {
      name: 'High phosphorus alert',
      condition: { parameter: 'TP', operator: '>', value: 0.1 },
    };

    it('accepts valid input', () => {
      const result = alertRuleCreateSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('provides defaults for optional fields', () => {
      const result = alertRuleCreateSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.triggerType).toBe('custom');
        expect(result.data.severity).toBe('warning');
        expect(result.data.enabled).toBe(true);
        expect(result.data.createdBy).toBe('admin');
      }
    });

    it('rejects missing name', () => {
      const { name, ...rest } = validInput;
      const result = alertRuleCreateSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = alertRuleCreateSchema.safeParse({ ...validInput, name: '' });
      expect(result.success).toBe(false);
    });

    it('accepts custom overrides for optional fields', () => {
      const result = alertRuleCreateSchema.safeParse({
        ...validInput,
        triggerType: 'scheduled',
        severity: 'critical',
        enabled: false,
        createdBy: 'user-xyz',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.severity).toBe('critical');
        expect(result.data.enabled).toBe(false);
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  alertRecipientCreateSchema                                       */
  /* ---------------------------------------------------------------- */
  describe('alertRecipientCreateSchema', () => {
    const validInput = {
      email: 'test@example.com',
      name: 'Test User',
    };

    it('accepts valid input', () => {
      const result = alertRecipientCreateSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('provides defaults for optional fields', () => {
      const result = alertRecipientCreateSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('admin');
        expect(result.data.state).toBeNull();
        expect(result.data.triggers).toEqual(['sentinel', 'delta', 'attains']);
        expect(result.data.severities).toEqual(['critical', 'warning']);
        expect(result.data.active).toBe(true);
      }
    });

    it('rejects invalid email', () => {
      const result = alertRecipientCreateSchema.safeParse({ ...validInput, email: 'not-an-email' });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = alertRecipientCreateSchema.safeParse({ ...validInput, name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing email', () => {
      const { email, ...rest } = validInput;
      const result = alertRecipientCreateSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('accepts custom triggers and severities', () => {
      const result = alertRecipientCreateSchema.safeParse({
        ...validInput,
        triggers: ['sentinel'],
        severities: ['critical'],
        state: 'MD',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.triggers).toEqual(['sentinel']);
        expect(result.data.state).toBe('MD');
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  askPinSchema                                                     */
  /* ---------------------------------------------------------------- */
  describe('askPinSchema', () => {
    it('accepts valid question', () => {
      const result = askPinSchema.safeParse({ question: 'What is the water quality in MD?' });
      expect(result.success).toBe(true);
    });

    it('provides default role', () => {
      const result = askPinSchema.safeParse({ question: 'Test question' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('Federal');
      }
    });

    it('rejects empty question', () => {
      const result = askPinSchema.safeParse({ question: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing question', () => {
      const result = askPinSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts optional sectionId and label', () => {
      const result = askPinSchema.safeParse({
        question: 'Test',
        sectionId: 'overview',
        label: 'Water Quality',
        role: 'State',
        kbContext: 'Additional context here',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sectionId).toBe('overview');
        expect(result.data.kbContext).toBe('Additional context here');
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  inviteCreateSchema                                               */
  /* ---------------------------------------------------------------- */
  describe('inviteCreateSchema', () => {
    it('accepts empty object (all fields optional)', () => {
      const result = inviteCreateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('provides default expiresInDays', () => {
      const result = inviteCreateSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expiresInDays).toBe(7);
      }
    });

    it('accepts all optional fields', () => {
      const result = inviteCreateSchema.safeParse({
        role: 'MS4',
        email: 'invite@example.com',
        jurisdiction: 'Montgomery County',
        state: 'MD',
        organization: 'Test Org',
        expiresInDays: 14,
        isMilitary: false,
      });
      expect(result.success).toBe(true);
    });

    it('rejects expiresInDays below 1', () => {
      const result = inviteCreateSchema.safeParse({ expiresInDays: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects expiresInDays above 30', () => {
      const result = inviteCreateSchema.safeParse({ expiresInDays: 31 });
      expect(result.success).toBe(false);
    });

    it('rejects wrong type for expiresInDays', () => {
      const result = inviteCreateSchema.safeParse({ expiresInDays: 'seven' });
      expect(result.success).toBe(false);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  cacheRefreshSchema                                               */
  /* ---------------------------------------------------------------- */
  describe('cacheRefreshSchema', () => {
    const validInput = {
      source: 'attains',
      scopeKey: 'MD',
    };

    it('accepts valid input', () => {
      const result = cacheRefreshSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('rejects missing source', () => {
      const result = cacheRefreshSchema.safeParse({ scopeKey: 'MD' });
      expect(result.success).toBe(false);
    });

    it('rejects missing scopeKey', () => {
      const result = cacheRefreshSchema.safeParse({ source: 'attains' });
      expect(result.success).toBe(false);
    });

    it('rejects empty source string', () => {
      const result = cacheRefreshSchema.safeParse({ source: '', scopeKey: 'MD' });
      expect(result.success).toBe(false);
    });

    it('rejects empty scopeKey string', () => {
      const result = cacheRefreshSchema.safeParse({ source: 'attains', scopeKey: '' });
      expect(result.success).toBe(false);
    });

    it('rejects non-string types', () => {
      const result = cacheRefreshSchema.safeParse({ source: 123, scopeKey: 456 });
      expect(result.success).toBe(false);
    });
  });
});
