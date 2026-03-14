/* ------------------------------------------------------------------ */
/*  PIN Outreach — AI Prompt Builder                                  */
/*  Builds system/user prompts for audience discovery & email gen     */
/* ------------------------------------------------------------------ */

import type { BusinessProfile, AudienceSegment } from './types';
import { UNIVERSAL_QA_TONE } from '../llmHelpers';

/* ------------------------------------------------------------------ */
/*  1. Profile Enhancement                                            */
/* ------------------------------------------------------------------ */

export function buildProfileEnhancePrompt(partial: Partial<BusinessProfile>): {
  system: string;
  user: string;
} {
  return {
    system: `You are a GovTech marketing strategist specializing in water quality technology products. Help refine a business profile for a water quality intelligence platform.

Respond with valid JSON only — no markdown fences, no explanation.`,
    user: `Here is the current business profile (partially filled):
${JSON.stringify(partial, null, 2)}

Suggest improvements:
1. If valueProps has fewer than 4 items, suggest additional value propositions.
2. If differentiators has fewer than 3 items, suggest competitive differentiators.
3. Suggest 3-5 compelling stats (label + value) based on the product description.

Respond as JSON:
{
  "suggestedValueProps": ["..."],
  "suggestedDifferentiators": ["..."],
  "suggestedStats": [{ "label": "...", "value": "..." }]
}`,
  };
}

/* ------------------------------------------------------------------ */
/*  2. Audience Discovery                                             */
/* ------------------------------------------------------------------ */

export function buildAudienceDiscoveryPrompt(profile: BusinessProfile): {
  system: string;
  user: string;
} {
  const roleKeys = Object.keys(UNIVERSAL_QA_TONE);

  return {
    system: `You are a market segmentation expert for water quality and environmental technology products targeting government agencies, utilities, educational institutions, and corporate sustainability teams.

You understand the US water quality regulatory landscape: EPA, state environmental agencies, MS4 permit holders, utilities, and academic researchers.

Respond with valid JSON only — no markdown fences, no explanation.`,
    user: `Analyze this business profile and discover 6-10 ideal audience segments:

BUSINESS PROFILE:
${JSON.stringify(profile, null, 2)}

AVAILABLE ROLE MAPPINGS (each represents a distinct buyer persona with established communication tone):
${roleKeys.join(', ')}

For each segment, provide:
- name: A descriptive segment name (e.g., "State Environmental Program Managers")
- description: 2-3 sentence description of who they are
- roleMapping: One of the role mappings above that best matches this segment
- painPoints: 3-5 specific pain points this segment experiences
- buyingMotivations: 3-5 reasons they would purchase
- objections: 2-4 common objections or concerns
- decisionMakers: Who influences/approves the purchase
- toneGuidance: Brief guidance on communication style for this segment
- priority: "high", "medium", or "low" based on likely conversion potential

Respond as JSON:
{
  "segments": [
    {
      "name": "...",
      "description": "...",
      "roleMapping": "...",
      "painPoints": ["..."],
      "buyingMotivations": ["..."],
      "objections": ["..."],
      "decisionMakers": ["..."],
      "toneGuidance": "...",
      "priority": "high|medium|low"
    }
  ]
}`,
  };
}

/* ------------------------------------------------------------------ */
/*  3. Email Generation                                               */
/* ------------------------------------------------------------------ */

export function buildEmailGeneratePrompt(
  profile: BusinessProfile,
  segment: AudienceSegment,
  campaignGoal: string,
): {
  system: string;
  user: string;
} {
  const toneContext = UNIVERSAL_QA_TONE[segment.roleMapping as keyof typeof UNIVERSAL_QA_TONE]
    || 'Professional and data-driven communication style.';

  return {
    system: `You are an expert GovTech email copywriter who writes high-converting cold outreach emails for water quality technology products.

TONE GUIDANCE FOR THIS AUDIENCE:
${toneContext}

SEGMENT-SPECIFIC TONE:
${segment.toneGuidance}

RULES:
- Lead with a pain point the recipient recognizes
- Include 1-2 specific platform stats/capabilities from the business profile
- Keep under 200 words
- Single clear call-to-action
- Use personalization tokens: {{firstName}}, {{organization}}, {{state}}
- No clickbait or overpromising
- Professional but not stiff — sound like a knowledgeable peer

Respond with valid JSON only — no markdown fences, no explanation.`,
    user: `Generate an outreach email for this audience segment.

BUSINESS PROFILE:
Name: ${profile.name}
Tagline: ${profile.tagline}
Value Props: ${profile.valueProps.join('; ')}
Key Stats: ${profile.stats.map(s => `${s.label}: ${s.value}`).join('; ')}
Differentiators: ${profile.differentiators.join('; ')}

TARGET SEGMENT: ${segment.name}
Description: ${segment.description}
Pain Points: ${segment.painPoints.join('; ')}
Buying Motivations: ${segment.buyingMotivations.join('; ')}
Common Objections: ${segment.objections.join('; ')}
Decision Makers: ${segment.decisionMakers.join('; ')}

CAMPAIGN GOAL: ${campaignGoal}

Respond as JSON:
{
  "subjectLines": ["subject1", "subject2", "subject3"],
  "htmlBody": "<p>Email body with inline styles for email clients...</p>",
  "textBody": "Plain text version of the email...",
  "personalizationTokens": ["{{firstName}}", "{{organization}}"]
}`,
  };
}

/* ------------------------------------------------------------------ */
/*  4. Contact Discovery (future — placeholder)                       */
/* ------------------------------------------------------------------ */

export function buildContactDiscoveryPrompt(
  segment: AudienceSegment,
  state?: string,
): {
  system: string;
  user: string;
} {
  return {
    system: `You are a research assistant that helps identify potential contacts at government agencies and organizations involved in water quality management.

Respond with valid JSON only — no markdown fences, no explanation.`,
    user: `Suggest types of contacts to reach for this audience segment:

SEGMENT: ${segment.name}
Description: ${segment.description}
Decision Makers: ${segment.decisionMakers.join('; ')}
${state ? `STATE FOCUS: ${state}` : 'SCOPE: National'}

Suggest 5-10 specific job titles and the types of organizations where they work.

Respond as JSON:
{
  "suggestions": [
    { "title": "...", "organizationType": "...", "findingStrategy": "..." }
  ]
}`,
  };
}
