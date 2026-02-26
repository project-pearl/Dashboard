/**
 * Shared LLM helpers for insight generation cron routes.
 *
 * Extracted to avoid duplication between the main cron and the urgent cron.
 */

import type { CachedInsight } from './insightsCache';

// ── Types ────────────────────────────────────────────────────────────────────

export type Role = 'MS4' | 'State' | 'Federal' | 'Corporate' | 'K12' | 'College' | 'Researcher' | 'NGO';

export const ALL_ROLES: Role[] = ['MS4', 'State', 'Federal', 'Corporate', 'K12', 'College', 'Researcher', 'NGO'];

export type LLMCaller = (systemPrompt: string, userMessage: string) => Promise<string>;

export const ROLE_TONE: Record<Role, string> = {
  MS4: 'Focus on compliance risk, permit deadlines, cost optimization, and MS4 regulatory obligations.',
  State: 'Focus on statewide trends, impairment reclassification risk, resource allocation, and TMDL progress.',
  Federal: 'Focus on cross-state patterns, national trends, policy impact, and Clean Water Act implications.',
  Corporate: 'Focus on portfolio risk, ESG disclosure readiness, supply chain water risk, and investor-relevant metrics.',
  K12: 'Focus on fun discoveries, wildlife impacts, "did you know" style facts, and engaging educational content for students.',
  College: 'Focus on research-worthy anomalies, data quality assessment, publication-ready findings, and methodology rigor.',
  Researcher: 'Focus on statistical anomalies, research-worthy patterns, data quality, and peer-comparable findings.',
  NGO: 'Focus on community impact, advocacy opportunities, environmental justice, and public health connections.',
};

// ── System Prompt ─────────────────────────────────────────────────────────────

export function buildSystemPrompt(role: Role): string {
  return `You are a water quality data analyst for the PEARL platform. Generate actionable insights based on the provided water quality data. Be specific, cite parameter values, and provide early warnings. When analyzing waterbody data near major infrastructure (CSO outfalls, interceptors, treatment plants), flag sudden multi-parameter anomalies (simultaneous E. coli spike + DO crash + turbidity surge) as potential sewage discharge events. Reference the January 2026 Potomac Interceptor collapse as an example of why early detection matters — 200M+ gallons went unmonitored because no independent continuous monitoring existed.

When real-time alerts (USGS threshold exceedances, signals from USCG/EPA/NOAA, or NWS weather alerts) are present in the data, prioritize them over historical aggregates. These represent active, evolving conditions that users need to know about immediately. Connect real-time alerts to the broader ATTAINS context — e.g., if a site with a critical DO reading is in an already-impaired watershed, note the compounding risk.

${ROLE_TONE[role]} Format your response as a JSON array of exactly 4 objects, each with: {type: "predictive"|"anomaly"|"comparison"|"recommendation"|"summary", severity: "info"|"warning"|"critical", title: string, body: string, waterbody?: string, timeframe?: string}. Return ONLY the JSON array, no markdown or extra text.`;
}

// ── LLM Callers ──────────────────────────────────────────────────────────────

export async function callAnthropic(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

export async function callOpenAI(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ── Provider selection ───────────────────────────────────────────────────────

export function getConfiguredLLMCaller(): { callLLM: LLMCaller; provider: string } | null {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

  if (ANTHROPIC_API_KEY) {
    return {
      callLLM: (sys, msg) => callAnthropic(ANTHROPIC_API_KEY, sys, msg),
      provider: 'anthropic',
    };
  }
  if (OPENAI_API_KEY) {
    return {
      callLLM: (sys, msg) => callOpenAI(OPENAI_API_KEY, sys, msg),
      provider: 'openai',
    };
  }
  return null;
}

// ── Parse + validate insights ────────────────────────────────────────────────

export function parseInsights(rawText: string): CachedInsight[] {
  const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((i: any) =>
    i &&
    typeof i.title === 'string' &&
    typeof i.body === 'string' &&
    ['predictive', 'anomaly', 'comparison', 'recommendation', 'summary'].includes(i.type) &&
    ['info', 'warning', 'critical'].includes(i.severity)
  ).slice(0, 5);
}

// ── Utility ──────────────────────────────────────────────────────────────────

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
