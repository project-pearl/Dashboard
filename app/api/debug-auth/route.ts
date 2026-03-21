import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { resolveAdminLevel } from '@/lib/authTypes';

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

    // Get user profile for admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('admin_level')
      .eq('id', user.id)
      .single();

    const adminLevel = resolveAdminLevel(profile?.admin_level, user.email || '');
    const isAdmin = adminLevel !== 'none';

    return NextResponse.json({
      authenticated: true,
      email: user.email,
      userId: user.id,
      isAdmin,
      adminLevel,
      dbAdminLevel: profile?.admin_level || 'none',
      environment: process.env.NODE_ENV,
      note: 'Admin access is now purely database-driven (no env var fallback)'
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}