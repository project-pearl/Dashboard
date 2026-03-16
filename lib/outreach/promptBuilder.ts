/* ------------------------------------------------------------------ */
/*  PIN Outreach — AI Prompt Builder                                  */
/*  Builds system/user prompts for audience discovery & email gen     */
/* ------------------------------------------------------------------ */

import type { BusinessProfile, AudienceSegment, OutreachTarget } from './types';
import { UNIVERSAL_QA_TONE } from '../llmHelpers';

/* ------------------------------------------------------------------ */
/*  0. Profile Generation from Freeform Text                          */
/* ------------------------------------------------------------------ */

export function buildProfileFromDescriptionPrompt(description: string): {
  system: string;
  user: string;
} {
  return {
    system: `You are a GovTech marketing strategist specializing in water quality and environmental technology products. You extract structured business profiles from freeform descriptions.

Respond with valid JSON only — no markdown fences, no explanation.`,
    user: `A user has described their business/product below. Extract a complete business profile from this description.

DESCRIPTION:
${description}

Generate a structured profile with:
- name: The company/product name (extract from description or use a sensible name)
- tagline: A concise one-line value proposition (under 15 words)
- valueProps: 5-8 specific value propositions based on what they described
- stats: 5-10 key statistics with label and value (extract real numbers from the description, or create realistic ones based on the capabilities described)
- differentiators: 5-10 competitive differentiators that set this product apart

Be specific and concrete. Pull actual details from the description rather than generating generic marketing language.

Respond as JSON:
{
  "name": "...",
  "tagline": "...",
  "valueProps": ["..."],
  "stats": [{ "label": "...", "value": "..." }],
  "differentiators": ["..."]
}`,
  };
}

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
/*  4. Target Research                                                */
/* ------------------------------------------------------------------ */

export function buildTargetResearchPrompt(
  profile: BusinessProfile,
  target: Pick<OutreachTarget, 'orgName' | 'orgType' | 'whyTarget'>,
): {
  system: string;
  user: string;
} {
  return {
    system: `You are a GovTech business development strategist. You research specific organizations to create tailored outreach intelligence for technology products.

You have deep knowledge of US government agencies, utilities, universities, military installations, and corporate programs. You understand procurement cycles, organizational pain points, and how to identify the right contacts. Even if an organization is not directly focused on water or environment, you find the angle — every org has infrastructure, compliance, data, or operational needs that connect to environmental intelligence platforms.

IMPORTANT: Always generate substantive research. Never return empty arrays or placeholder text. If the org's connection to the product is indirect, explain the indirect connection and find relevant roles, pain points, and talking points anyway.

Respond with valid JSON only — no markdown fences, no explanation.`,
    user: `Research this organization and generate targeted outreach intelligence for our product.

OUR PRODUCT:
Name: ${profile.name}
Tagline: ${profile.tagline}
Value Props: ${profile.valueProps.join('; ')}
Key Stats: ${profile.stats.map(s => `${s.label}: ${s.value}`).join('; ')}
Differentiators: ${profile.differentiators.join('; ')}

TARGET ORGANIZATION:
Name: ${target.orgName}
Type: ${target.orgType}
Why we're targeting them: ${target.whyTarget}

Generate comprehensive research. Even if the org is not directly water/environment-focused, find the relevant connection (infrastructure, compliance, data management, international programs, operational resilience, etc.):
- summary: 2-3 sentence overview of the org and how it connects to environmental data or infrastructure
- relevance: Why our product specifically matters to them (find the angle even if indirect)
- keyRoles: 5-8 specific job titles to target (e.g., "Program Manager, Environmental Sciences Division", "Chief Data Officer", "Director of Operations")
- painPoints: 4-6 pain points specific to THIS organization (not generic)
- talkingPoints: 4-6 tailored value propositions for this org
- budgetCycle: When they plan/allocate budget (e.g., "Federal FY starts Oct 1, proposals due by June")
- recentNews: 2-4 recent initiatives, mandates, or announcements relevant to this org
- approachStrategy: 2-3 sentences on how to get in the door with this specific org

Respond as JSON:
{
  "summary": "...",
  "relevance": "...",
  "keyRoles": ["..."],
  "painPoints": ["..."],
  "talkingPoints": ["..."],
  "budgetCycle": "...",
  "recentNews": ["..."],
  "approachStrategy": "..."
}`,
  };
}

/* ------------------------------------------------------------------ */
/*  5. Contact Discovery (future — placeholder)                       */
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
