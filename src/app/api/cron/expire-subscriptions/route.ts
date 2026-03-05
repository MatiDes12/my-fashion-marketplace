import { createRouteClient } from '@/lib/supabase-route';

export async function POST(request: Request) {
  // Secure with CRON_SECRET - only for automated cron jobs
  const authHeader = request.headers.get('Authorization');
  const expectedSecret = process.env.CRON_SECRET;
  
  if (!expectedSecret) {
    console.error('CRON_SECRET environment variable not set');
    return new Response('Server configuration error', { status: 500 });
  }
  
  if (authHeader !== `Bearer ${expectedSecret}`) {
    console.error('Invalid authorization header for cron job');
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = await createRouteClient();
  
  let results = {
    expiredCount: 0,
    pendingRemoved: 0,
    failedRemoved: 0,
    totalRemoved: 0
  };

  try {
    // 1. EXPIRE SUBSCRIPTIONS - Find and expire completed subscriptions past their end date
    const { data: expiredSubs, error: expiredError } = await supabase
      .from('subscription_orders')
      .select('id, user_id, plan_id, subscription_end_date')
      .eq('status', 'completed')
      .lt('subscription_end_date', new Date().toISOString());

    if (expiredError) {
      console.error('Failed to fetch expired subscriptions:', expiredError);
    } else if (expiredSubs && expiredSubs.length > 0) {
      // Update subscription status to expired
      const { error: updateError } = await supabase
        .from('subscription_orders')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('status', 'completed')
        .lt('subscription_end_date', new Date().toISOString());

      if (updateError) {
        console.error('Failed to update expired subscriptions:', updateError);
      } else {
        results.expiredCount = expiredSubs.length;
        console.log(`Expired ${expiredSubs.length} subscriptions`);
      }

      // Downgrade users to basic plan
      const userIds = expiredSubs.map(sub => sub.user_id);
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ subscription_plan: 'basic' })
        .in('id', userIds);

      if (userUpdateError) {
        console.error('Failed to downgrade users to basic plan:', userUpdateError);
      } else {
        console.log(`Downgraded ${userIds.length} users to basic plan`);
      }
    }

    // 2. CLEANUP PENDING SUBSCRIPTIONS - Remove pending subscriptions older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
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
        results.pendingRemoved = pendingSubs.length;
        console.log(`Cleaned up ${pendingSubs.length} pending subscriptions older than 1 hour`);
      }
    }

    // 3. CLEANUP FAILED SUBSCRIPTIONS - Remove failed subscriptions older than 1 day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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
        results.failedRemoved = failedSubs.length;
        console.log(`Cleaned up ${failedSubs.length} failed subscriptions older than 1 day`);
      }
    }

    results.totalRemoved = results.pendingRemoved + results.failedRemoved;

    // Generate summary message
    const summary = [
      results.expiredCount > 0 ? `${results.expiredCount} subscriptions expired` : null,
      results.pendingRemoved > 0 ? `${results.pendingRemoved} pending subscriptions cleaned up` : null,
      results.failedRemoved > 0 ? `${results.failedRemoved} failed subscriptions cleaned up` : null
    ].filter(Boolean).join(', ');

    if (!summary) {
      return new Response('No actions needed - all subscriptions are current', { status: 200 });
    }

    const responseMessage = `Cron job completed: ${summary}`;
    console.log(responseMessage);
    return new Response(responseMessage, { status: 200 });

  } catch (error) {
    console.error('Unexpected error during cron job:', error);
    return new Response('Error during cron job process', { status: 500 });
  }
} 