import { createRouteClient } from '@/lib/supabase-route';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createRouteClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Update user role to owner
    const { error: userError } = await supabase
      .from('users')
      .update({ role: 'owner' })
      .eq('id', session.user.id);

    if (userError) throw userError;

    // Initialize payment settings
    const { error: settingsError } = await supabase
      .from('payment_settings')
      .insert({
        user_id: session.user.id,
        telebirr_settings: {
          is_active: false,
          short_code: '',
          app_key: '',
          app_secret: '',
          merchant_id: '',
          private_key: '',
          notify_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/telebirr/notify`,
          redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/complete`
        }
      });

    if (settingsError) throw settingsError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error registering seller:', error);
    return NextResponse.json(
      { error: 'Failed to register seller' },
      { status: 500 }
    );
  }
} 