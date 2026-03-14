/**
 * Zod validation schemas for all API request bodies.
 *
 * Organized by domain: Upload, Alert, AI, Admin, Invite, Cache.
 * Each schema is used with {@link parseBody} from `lib/validateRequest.ts`
 * inside the corresponding API route handler.
 */

import { z } from 'zod';

// ─── Upload Schemas ──────────────────────────────────────────────────────────

/** Schema for a single water-quality sample submission (NGO/K-12 upload). */
export const uploadSubmitSchema = z.object({
  parameter: z.enum(['DO', 'pH', 'temperature', 'turbidity', 'bacteria', 'TN', 'TP', 'conductivity']),
  value: z.number({ required_error: 'value is required' }).refine((v) => !isNaN(v), 'value must be a valid number'),
  latitude: z.string().min(1, 'latitude is required'),
  longitude: z.string().min(1, 'longitude is required'),
  user_id: z.string().min(1, 'user_id is required'),
  user_role: z.enum(['NGO', 'K12']),
  location_name: z.string().optional(),
  sample_date: z.string().optional(),
  volunteer_id: z.string().optional(),
  qa_checklist: z.unknown().optional(),
  student_name: z.string().optional(),
  team_name: z.string().optional(),
  teacher_uid: z.string().optional(),
  state_abbr: z.string().optional(),
});

/** Schema for bulk CSV upload of water-quality samples. */
export const csvUploadSchema = z.object({
  csv_text: z.string().min(1, 'csv_text is required').max(10_000_000, 'CSV exceeds 10MB limit'),
  user_id: z.string().min(1, 'user_id is required'),
  user_role: z.enum(['NGO', 'K12']),
  column_mapping: z.record(z.string()).optional(),
  state_abbr: z.string().optional(),
  volunteer_id: z.string().optional(),
  teacher_uid: z.string().optional(),
  original_file: z.string().optional(),
});

/** Schema for approving pending sample submissions. */
export const uploadApproveSchema = z.object({
  sample_ids: z.array(z.string()).min(1, 'sample_ids must be a non-empty array'),
  approved_by: z.string().min(1, 'approved_by is required'),
  action: z.string().optional(),
});

// ─── Alert Schemas ───────────────────────────────────────────────────────────

/** Schema for creating a custom alert rule. */
export const alertRuleCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  condition: z.unknown(),
  triggerType: z.string().optional().default('custom'),
  severity: z.string().optional().default('warning'),
  enabled: z.boolean().optional().default(true),
  createdBy: z.string().optional().default('admin'),
});

/** Schema for deleting an alert rule by ID. */
export const alertRuleDeleteSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

/** Schema for adding a new alert recipient. */
export const alertRecipientCreateSchema = z.object({
  email: z.string().email('valid email is required'),
  name: z.string().min(1, 'name is required'),
  role: z.string().optional().default('admin'),
  state: z.string().nullable().optional().default(null),
  triggers: z.array(z.string()).optional().default(['sentinel', 'delta', 'attains']),
  severities: z.array(z.string()).optional().default(['critical', 'warning']),
  active: z.boolean().optional().default(true),
});

/** Schema for updating an existing alert recipient's preferences. */
export const alertRecipientUpdateSchema = z.object({
  email: z.string().email('valid email is required'),
  name: z.string().optional(),
  role: z.string().optional(),
  state: z.string().nullable().optional(),
  triggers: z.array(z.string()).optional(),
  severities: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

/** Schema for removing an alert recipient by email. */
export const alertRecipientDeleteSchema = z.object({
  email: z.string().email('valid email is required'),
});

/** Schema for creating an alert suppression rule (silence a dedupKey). */
export const alertSuppressCreateSchema = z.object({
  dedupKey: z.string().min(1, 'dedupKey is required'),
  reason: z.string().min(1, 'reason is required'),
  expiresAt: z.string().nullable().optional().default(null),
  createdBy: z.string().optional().default('admin'),
});

/** Schema for removing an alert suppression by ID. */
export const alertSuppressDeleteSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

/** Schema for sending a test alert email. */
export const alertTestSchema = z.object({
  email: z.string().email('valid email is required'),
});

/** Schema for creating a deployment-level alert (PEARL unit anomaly). */
export const deploymentAlertCreateSchema = z.object({
  action: z.literal('create_alert'),
  deployment_id: z.string(),
  parameter: z.string(),
  value: z.number(),
  baseline: z.number(),
  delta: z.number(),
  unit: z.string(),
  severity: z.string(),
  title: z.string(),
  diagnosis: z.string(),
  recommendation: z.string(),
  pipeline_event_id: z.string(),
});

/** Schema for acknowledging a deployment alert. */
export const deploymentAlertAckSchema = z.object({
  action: z.literal('acknowledge'),
  alert_id: z.string().min(1, 'alert_id is required'),
  user_id: z.string(),
  user_name: z.string(),
  note: z.string().optional(),
  action_taken: z.string(),
});

/** Schema for recording a single deployment alert timeline entry. */
export const deploymentAlertTimelineSchema = z.object({
  action: z.literal('record_timeline'),
  alert_id: z.string(),
  deployment_id: z.string(),
  parameter: z.string(),
  value: z.number(),
  baseline: z.number(),
  severity: z.string(),
});

/** Schema for recording a batch of deployment alert timeline entries. */
export const deploymentAlertBatchTimelineSchema = z.object({
  action: z.literal('batch_timeline'),
  entries: z.array(z.record(z.unknown())).min(1, 'entries must be a non-empty array'),
});

/** Schema for updating a deployment alert's status. */
export const deploymentAlertUpdateSchema = z.object({
  alert_id: z.string().min(1, 'alert_id is required'),
  status: z.string().min(1, 'status is required'),
});

/** Discriminated union schema for all deployment alert actions. */
export const deploymentAlertSchema = z.discriminatedUnion('action', [
  deploymentAlertCreateSchema,
  deploymentAlertAckSchema,
  deploymentAlertTimelineSchema,
  deploymentAlertBatchTimelineSchema,
]);

/** Schema for ingesting a fusion-engine anomaly detection event. */
export const fusionIngestSchema = z.object({
  source: z.literal('fusion-engine'),
  anomaly: z.object({
    id: z.string(),
    detectedAt: z.string(),
    affectedBasins: z.array(z.string()),
    triggers: z.array(z.object({
      huc8: z.string(),
      parameter: z.string(),
      zScore: z.number(),
      severity: z.string(),
    })),
    statisticalEvidence: z.record(z.unknown()),
    confidence: z.number(),
    severity: z.string(),
    narrative: z.string(),
  }),
});

// ─── AI Schemas ──────────────────────────────────────────────────────────────

/** Schema for the Ask PIN AI question endpoint. */
export const askPinSchema = z.object({
  question: z.string().min(1, 'question is required'),
  sectionId: z.string().optional(),
  label: z.string().optional(),
  role: z.string().optional().default('Federal'),
  kbContext: z.string().optional(),
});

/** Schema for the briefing Q&A follow-up endpoint. */
export const briefingQaSchema = z.object({
  question: z.string().min(1, 'question is required'),
  role: z.enum(['Federal', 'State', 'MS4', 'Local']),
  state: z.string().optional(),
  jurisdiction: z.string().optional(),
  isMilitary: z.boolean().optional(),
});

/** Schema for the universal Ask PIN endpoint (all roles, live data context). */
export const askPinUniversalSchema = z.object({
  question: z.string().min(1, 'question is required'),
  role: z.enum([
    'Federal', 'State', 'MS4', 'Local', 'K12', 'College', 'Researcher',
    'Corporate', 'NGO', 'Utility', 'Biotech', 'Investor', 'Agriculture',
    'Lab', 'Pearl', 'Temp',
  ]),
  state: z.string().optional(),
  jurisdiction: z.string().optional(),
  isMilitary: z.boolean().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(10).optional(),
});

/** Schema for AI resolution plan generation. */
export const resolutionPlanSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
});

/** Schema for raw AI insight generation (system prompt + user message). */
export const aiInsightsSchema = z.object({
  systemPrompt: z.string().min(1, 'systemPrompt is required'),
  userMessage: z.string().min(1, 'userMessage is required'),
});

/** Schema for AI-powered categorization of a named entity. */
export const aiCategorizeSchema = z.object({
  type: z.string().min(1, 'type is required'),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().default('N/A'),
});

// ─── Admin Schemas ───────────────────────────────────────────────────────────

/** Schema for granting or revoking role-admin privileges. */
export const grantRoleAdminSchema = z.object({
  targetUserId: z.string().min(1, 'targetUserId is required'),
  adminLevel: z.enum(['role_admin', 'none']),
});

// ─── Invite Schemas ──────────────────────────────────────────────────────────

/** Schema for creating a new invite link with optional role/scope. */
export const inviteCreateSchema = z.object({
  role: z.string().optional(),
  email: z.string().optional(),
  jurisdiction: z.string().optional(),
  state: z.string().optional(),
  organization: z.string().optional(),
  expiresInDays: z.number().min(1).max(30).optional().default(7),
  isMilitary: z.boolean().optional(),
});

/** Schema for resolving (redeeming) an invite token. */
export const inviteResolveSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

// ─── Cache Schemas ───────────────────────────────────────────────────────────

/** Schema for triggering a targeted cache refresh by source and scope key. */
export const cacheRefreshSchema = z.object({
  source: z.string().min(1, 'source is required'),
  scopeKey: z.string().min(1, 'scopeKey is required'),
});

// ─── Outreach Schemas ─────────────────────────────────────────────────────────

/** Schema for creating/updating a business profile. */
export const outreachProfileSchema = z.object({
  name: z.string().min(1, 'name is required'),
  tagline: z.string().min(1, 'tagline is required'),
  website: z.string().optional(),
  valueProps: z.array(z.string()).min(1, 'at least one value prop is required'),
  stats: z.array(z.object({ label: z.string(), value: z.string() })).optional().default([]),
  differentiators: z.array(z.string()).optional().default([]),
});

/** Schema for triggering audience discovery. */
export const outreachDiscoverSchema = z.object({
  profileOverrides: z.record(z.unknown()).optional(),
});

/** Schema for creating/updating an audience segment. */
export const outreachSegmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'name is required'),
  description: z.string().min(1, 'description is required'),
  roleMapping: z.string().min(1, 'roleMapping is required'),
  painPoints: z.array(z.string()).optional().default([]),
  buyingMotivations: z.array(z.string()).optional().default([]),
  objections: z.array(z.string()).optional().default([]),
  decisionMakers: z.array(z.string()).optional().default([]),
  toneGuidance: z.string().optional().default(''),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
});

/** Schema for generating an email for a segment. */
export const outreachEmailGenerateSchema = z.object({
  segmentId: z.string().min(1, 'segmentId is required'),
  campaignGoal: z.string().min(1, 'campaignGoal is required'),
});

/** Schema for creating a campaign. */
export const outreachCampaignCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  goal: z.string().min(1, 'goal is required'),
  segmentIds: z.array(z.string()).min(1, 'at least one segment is required'),
});

/** Schema for updating a campaign. */
export const outreachCampaignUpdateSchema = z.object({
  name: z.string().optional(),
  goal: z.string().optional(),
  segmentIds: z.array(z.string()).optional(),
  status: z.enum(['draft', 'ready', 'sent', 'partial']).optional(),
  emails: z.record(z.unknown()).optional(),
});

/** Schema for sending a campaign. */
export const outreachSendSchema = z.object({
  contactIds: z.array(z.string()).min(1, 'at least one contact is required'),
  segmentId: z.string().min(1, 'segmentId is required'),
});

/** Schema for creating/importing an outreach contact. */
export const outreachContactSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email('valid email is required'),
  title: z.string().optional(),
  organization: z.string().optional(),
  state: z.string().optional(),
  segmentId: z.string().optional(),
});
