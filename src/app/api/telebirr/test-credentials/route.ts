import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyFabricToken } from '@/lib/telebirr';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const credentials = await request.json();

    // Test the credentials by trying to get a token
    const tokenResult = await applyFabricToken({
      baseUrl: credentials.base_url,
      fabricAppId: credentials.fabric_app_id,
      appSecret: credentials.app_secret
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Credentials verified successfully',
      token: tokenResult.token
    });

  } catch (error) {
    console.error('Credentials test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to verify credentials'
      },
      { status: 500 }
    );
  }
}
