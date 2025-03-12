import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic'; // Mark this route as dynamic

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    
    // Get parameters from the return URL
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');
    
    if (!orderId) {
      throw new Error('Order ID is required');
    }

    // Update order status based on the return status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        payment_status: status === 'success' ? 'completed' : 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // Redirect to appropriate page based on status
    const redirectUrl = status === 'success' 
      ? '/payment/complete?status=success'
      : '/payment/complete?status=failed';

    return NextResponse.redirect(new URL(redirectUrl, request.url));

  } catch (error) {
    console.error('Return URL error:', error);
    return NextResponse.redirect(
      new URL('/payment/complete?status=error', request.url)
    );
  }
} 