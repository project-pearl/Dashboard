import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkIsAdmin, ADMIN_EMAILS } from '@/lib/authTypes';

export async function GET() {
  try {
    // Get current session
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({
        authenticated: false,
        error: 'No session found'
      });
    }

    // Check admin status
    const isAdmin = checkIsAdmin(user.email || '');

    return NextResponse.json({
      authenticated: true,
      email: user.email,
      isAdmin,
      adminEmails: ADMIN_EMAILS,
      adminEmailsEnv: process.env.ADMIN_EMAILS || 'Not set',
      environment: process.env.NODE_ENV
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}