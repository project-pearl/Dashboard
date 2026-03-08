import { z } from 'zod';

// ─── Upload Schemas ──────────────────────────────────────────────────────────

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

export const uploadApproveSchema = z.object({
  sample_ids: z.array(z.string()).min(1, 'sample_ids must be a non-empty array'),
  approved_by: z.string().min(1, 'approved_by is required'),
  action: z.string().optional(),
});

// ─── Alert Schemas ───────────────────────────────────────────────────────────

export const alertRuleCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  condition: z.unknown(),
  triggerType: z.string().optional().default('custom'),
  severity: z.string().optional().default('warning'),
  enabled: z.boolean().optional().default(true),
  createdBy: z.string().optional().default('admin'),
});

export const alertRuleDeleteSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

export const alertRecipientCreateSchema = z.object({
  email: z.string().email('valid email is required'),
  name: z.string().min(1, 'name is required'),
  role: z.string().optional().default('admin'),
  state: z.string().nullable().optional().default(null),
  triggers: z.array(z.string()).optional().default(['sentinel', 'delta', 'attains']),
  severities: z.array(z.string()).optional().default(['critical', 'warning']),
  active: z.boolean().optional().default(true),
});

export const alertRecipientUpdateSchema = z.object({
  email: z.string().email('valid email is required'),
  name: z.string().optional(),
  role: z.string().optional(),
  state: z.string().nullable().optional(),
  triggers: z.array(z.string()).optional(),
  severities: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const alertRecipientDeleteSchema = z.object({
  email: z.string().email('valid email is required'),
});

export const alertSuppressCreateSchema = z.object({
  dedupKey: z.string().min(1, 'dedupKey is required'),
  reason: z.string().min(1, 'reason is required'),
  expiresAt: z.string().nullable().optional().default(null),
  createdBy: z.string().optional().default('admin'),
});

export const alertSuppressDeleteSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

export const alertTestSchema = z.object({
  email: z.string().email('valid email is required'),
});

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

export const deploymentAlertAckSchema = z.object({
  action: z.literal('acknowledge'),
  alert_id: z.string().min(1, 'alert_id is required'),
  user_id: z.string(),
  user_name: z.string(),
  note: z.string().optional(),
  action_taken: z.string(),
});

export const deploymentAlertTimelineSchema = z.object({
  action: z.literal('record_timeline'),
  alert_id: z.string(),
  deployment_id: z.string(),
  parameter: z.string(),
  value: z.number(),
  baseline: z.number(),
  severity: z.string(),
});

export const deploymentAlertBatchTimelineSchema = z.object({
  action: z.literal('batch_timeline'),
  entries: z.array(z.record(z.unknown())).min(1, 'entries must be a non-empty array'),
});

export const deploymentAlertUpdateSchema = z.object({
  alert_id: z.string().min(1, 'alert_id is required'),
  status: z.string().min(1, 'status is required'),
});

export const deploymentAlertSchema = z.discriminatedUnion('action', [
  deploymentAlertCreateSchema,
  deploymentAlertAckSchema,
  deploymentAlertTimelineSchema,
  deploymentAlertBatchTimelineSchema,
]);

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

export const askPinSchema = z.object({
  question: z.string().min(1, 'question is required'),
  sectionId: z.string().optional(),
  label: z.string().optional(),
  role: z.string().optional().default('Federal'),
  kbContext: z.string().optional(),
});

export const briefingQaSchema = z.object({
  question: z.string().min(1, 'question is required'),
  role: z.enum(['Federal', 'State', 'MS4', 'Local']),
  state: z.string().optional(),
  jurisdiction: z.string().optional(),
  isMilitary: z.boolean().optional(),
});

export const resolutionPlanSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
});

export const aiInsightsSchema = z.object({
  systemPrompt: z.string().min(1, 'systemPrompt is required'),
  userMessage: z.string().min(1, 'userMessage is required'),
});

export const aiCategorizeSchema = z.object({
  type: z.string().min(1, 'type is required'),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().default('N/A'),
});

// ─── Admin Schemas ───────────────────────────────────────────────────────────

export const grantRoleAdminSchema = z.object({
  targetUserId: z.string().min(1, 'targetUserId is required'),
  adminLevel: z.enum(['role_admin', 'none']),
});

// ─── Invite Schemas ──────────────────────────────────────────────────────────

export const inviteCreateSchema = z.object({
  role: z.string().optional(),
  email: z.string().optional(),
  jurisdiction: z.string().optional(),
  state: z.string().optional(),
  organization: z.string().optional(),
  expiresInDays: z.number().min(1).max(30).optional().default(7),
  isMilitary: z.boolean().optional(),
});

export const inviteResolveSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

// ─── Cache Schemas ───────────────────────────────────────────────────────────

export const cacheRefreshSchema = z.object({
  source: z.string().min(1, 'source is required'),
  scopeKey: z.string().min(1, 'scopeKey is required'),
});
