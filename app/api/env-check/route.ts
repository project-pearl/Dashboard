import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    envKeysWithAPI: Object.keys(process.env).filter(k => k.includes('OPENAI') || k.includes('API_KEY')),
  });
}
