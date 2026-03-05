import { createRouteClient } from '@/lib/supabase-route';
import { NextResponse } from 'next/server';

// Simple in-memory rate limiting (for production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string, limit: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

export async function POST(request: Request) {
  const supabase = await createRouteClient();
  
  try {
    // Check if user is authenticated and is an admin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Not authenticated' }, 
        { status: 401 }
      );
    }

    // Check if user is an admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' }, 
        { status: 403 }
      );
    }

    // Rate limiting: 5 requests per minute per admin user
    const rateLimitKey = `admin_cleanup_${session.user.id}`;
    if (!checkRateLimit(rateLimitKey, 5, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before trying again.' }, 
        { status: 429 }
      );
    }

    let results = {
      expiredCount: 0,
      pendingRemoved: 0,
      failedRemoved: 0,
      totalRemoved: 0
    };

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
      return NextResponse.json({ 
        message: 'No actions needed - all subscriptions are current',
        stats: results 
      });
    }

    const responseMessage = `Cleanup completed: ${summary}`;
    console.log(responseMessage);
    
    return NextResponse.json({ 
      message: responseMessage,
      stats: results 
    });

  } catch (error) {
    console.error('Unexpected error during cleanup:', error);
    return NextResponse.json(
      { error: 'Error during cleanup process' }, 
      { status: 500 }
    );
  }
}
