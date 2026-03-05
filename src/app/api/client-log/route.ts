import { createRouteClient } from '@/lib/supabase-route';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// Fallback to service role for unauthenticated logs
const serviceClient = supabaseServer;

export async function POST(request: Request) {
  try {
    const routeClient = await createRouteClient();

    const { data: { user } } = await routeClient.auth.getUser();
    const userId = user?.id || null;

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
