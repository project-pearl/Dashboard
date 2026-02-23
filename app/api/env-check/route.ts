import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    envKeysWithAPI: Object.keys(process.env).filter(k => k.includes('ANTHRO') || k.includes('OPENAI') || k.includes('API_KEY')),
  });
}
