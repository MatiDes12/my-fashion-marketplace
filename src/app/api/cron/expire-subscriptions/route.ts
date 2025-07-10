import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Set your CRON_SECRET in Vercel to: N1...
export async function POST(request: Request) {
  // Debug: Log the CRON_SECRET and Authorization header (first 8 chars only)
  const authHeader = request.headers.get('Authorization');
  console.log('CRON_SECRET (first 8):', (process.env.CRON_SECRET || '').slice(0, 8));
  console.log('Authorization header (first 8):', (authHeader || '').slice(0, 8));

  // Secure with CRON_SECRET
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const now = new Date().toISOString();

  // Find all completed subscriptions that have expired
  const { data: expiredSubs, error: fetchError } = await supabase
    .from('subscription_orders')
    .select('id, user_id')
    .eq('status', 'completed')
    .lt('subscription_end_date', now);

  if (fetchError) {
    console.error('Failed to fetch expired subscriptions:', fetchError);
    return new Response('Error fetching expired subscriptions', { status: 500 });
  }

  if (!expiredSubs || expiredSubs.length === 0) {
    return new Response('No expired subscriptions found', { status: 200 });
  }

  // Expire subscriptions and downgrade users
  for (const sub of expiredSubs) {
    try {
      await supabase
        .from('subscription_orders')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', sub.id);
      if (sub.user_id) {
        await supabase
          .from('users')
          .update({ subscription_plan: 'basic' })
          .eq('id', sub.user_id);
      }
    } catch (err) {
      console.error(`Failed to expire subscription ${sub.id}:`, err);
    }
  }

  return new Response(`Expired ${expiredSubs.length} subscriptions`, { status: 200 });
} 