import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyFabricToken } from '@/lib/telebirr';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    // Get active payment settings
    const { data: settings, error: settingsError } = await supabase
      .from('admin_payment_settings')
      .select('base_url, fabric_app_id, app_secret')
      .eq('is_active', true)
      .single();

    if (settingsError || !settings) {
      throw new Error('Payment settings not found');
    }

    // Get fabric token
    const tokenResult = await applyFabricToken({
      baseUrl: settings.base_url,
      fabricAppId: settings.fabric_app_id,
      appSecret: settings.app_secret
    });

    return NextResponse.json({ success: true, token: tokenResult.token });

  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate token'
      },
      { status: 500 }
    );
  }
}
