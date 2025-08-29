import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Set your CRON_SECRET in Vercel to: N1PMxaceyJhbGciOiJIUzHiiSfG
export async function POST(request: Request) {
  // Secure with CRON_SECRET
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago

  let cleanupStats = {
    pendingRemoved: 0,
    failedRemoved: 0,
    totalRemoved: 0
  };

  try {
    // Clean up pending subscriptions older than 1 hour
    const { data: pendingSubs, error: pendingError } = await supabase
      .from('subscription_orders')
      .select('id, user_id, plan_id, tx_ref, created_at')
      .eq('status', 'pending')
      .lt('created_at', oneHourAgo);

    if (pendingError) {
      console.error('Failed to fetch pending subscriptions:', pendingError);
    } else if (pendingSubs && pendingSubs.length > 0) {
      const { error: deletePendingError } = await supabase
        .from('subscription_orders')
        .delete()
        .eq('status', 'pending')
        .lt('created_at', oneHourAgo);

      if (deletePendingError) {
        console.error('Failed to delete pending subscriptions:', deletePendingError);
      } else {
        cleanupStats.pendingRemoved = pendingSubs.length;
        console.log(`Cleaned up ${pendingSubs.length} pending subscriptions older than 1 hour`);
      }
    }

    // Clean up failed subscriptions older than 1 day
    const { data: failedSubs, error: failedError } = await supabase
      .from('subscription_orders')
      .select('id, user_id, plan_id, tx_ref, created_at')
      .eq('status', 'failed')
      .lt('created_at', oneDayAgo);

    if (failedError) {
      console.error('Failed to fetch failed subscriptions:', failedError);
    } else if (failedSubs && failedSubs.length > 0) {
      const { error: deleteFailedError } = await supabase
        .from('subscription_orders')
        .delete()
        .eq('status', 'failed')
        .lt('created_at', oneDayAgo);

      if (deleteFailedError) {
        console.error('Failed to delete failed subscriptions:', deleteFailedError);
      } else {
        cleanupStats.failedRemoved = failedSubs.length;
        console.log(`Cleaned up ${failedSubs.length} failed subscriptions older than 1 day`);
      }
    }

    cleanupStats.totalRemoved = cleanupStats.pendingRemoved + cleanupStats.failedRemoved;

    if (cleanupStats.totalRemoved === 0) {
      return new Response('No subscriptions to clean up', { status: 200 });
    }

    const responseMessage = `Cleanup completed: ${cleanupStats.pendingRemoved} pending, ${cleanupStats.failedRemoved} failed subscriptions removed`;
    console.log(responseMessage);
    return new Response(responseMessage, { status: 200 });

  } catch (error) {
    console.error('Unexpected error during cleanup:', error);
    return new Response('Error during cleanup process', { status: 500 });
  }
}
