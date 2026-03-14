/* ------------------------------------------------------------------ */
/*  PIN Outreach — Type Definitions                                   */
/* ------------------------------------------------------------------ */

/** Business profile used as context for AI audience discovery and email generation. */
export interface BusinessProfile {
  name: string;
  tagline: string;
  website?: string;
  valueProps: string[];
  stats: { label: string; value: string }[];
  differentiators: string[];
  updatedAt: string;
}

/** AI-discovered audience segment with tone mapping. */
export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  /** Maps to a key in UNIVERSAL_QA_TONE for tone guidance. */
  roleMapping: string;
  painPoints: string[];
  buyingMotivations: string[];
  objections: string[];
  decisionMakers: string[];
  toneGuidance: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

export type CampaignStatus = 'draft' | 'ready' | 'sent' | 'partial';

/** A campaign targeting one or more audience segments. */
export interface Campaign {
  id: string;
  name: string;
  goal: string;
  segmentIds: string[];
  emails: Record<string, EmailDraft>;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

/** AI-generated email draft for a specific segment. */
export interface EmailDraft {
  segmentId: string;
  subjectLines: string[];
  selectedSubject: number;
  htmlBody: string;
  textBody: string;
  personalizationTokens: string[];
  version: number;
  generatedAt: string;
}

/** A contact for outreach campaigns. */
export interface OutreachContact {
  id: string;
  name: string;
  email: string;
  title?: string;
  organization?: string;
  state?: string;
  segmentId?: string;
  createdAt: string;
}

/** Append-only send log entry. */
export interface SendLogEntry {
  id: string;
  campaignId: string;
  contactId: string;
  contactEmail: string;
  segmentId: string;
  subjectLine: string;
  sentAt: string;
  success: boolean;
  error?: string;
}
