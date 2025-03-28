import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tools } from '@/utils/tools';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { signature, data } = await request.json();

    // Get active payment settings
    const { data: settings, error: settingsError } = await supabase
      .from('admin_payment_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (settingsError || !settings) {
      throw new Error('Payment settings not found');
    }

    // Verify signature
    const calculatedSign = tools.signRequestObject(data, settings.private_key);
    const isValid = calculatedSign === signature;

    return NextResponse.json({ success: true, isValid });

  } catch (error) {
    console.error('Signature verification error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to verify signature'
      },
      { status: 500 }
    );
  }
}
