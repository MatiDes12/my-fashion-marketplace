import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Check if user is authenticated and is an admin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return new Response('Unauthorized - Not authenticated', { status: 401 });
    }

    // Check if user is an admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return new Response('Unauthorized - Admin access required', { status: 403 });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago

    let cleanupStats = {
      pendingRemoved: 0,
      failedRemoved: 0,
      totalRemoved: 0
    };

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
      return Response.json({ 
        message: 'No subscriptions to clean up',
        stats: cleanupStats 
      });
    }

    const responseMessage = `Cleanup completed: ${cleanupStats.pendingRemoved} pending, ${cleanupStats.failedRemoved} failed subscriptions removed`;
    console.log(responseMessage);
    
    return Response.json({ 
      message: responseMessage,
      stats: cleanupStats 
    });

  } catch (error) {
    console.error('Unexpected error during cleanup:', error);
    return new Response('Error during cleanup process', { status: 500 });
  }
}
