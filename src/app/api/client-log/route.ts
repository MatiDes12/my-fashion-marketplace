import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Fallback to service role for unauthenticated logs
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const routeClient = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: sessionData } = await routeClient.auth.getSession();
    const userId = sessionData.session?.user.id || null;

    const { message, level = 'info', data } = await request.json();

    const { error } = await serviceClient
      .from('client_logs')
      .insert({ message, level, data, user_id: userId });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving client log:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
