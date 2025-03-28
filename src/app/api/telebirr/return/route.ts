import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');

    const supabase = createRouteHandlerClient({ cookies });

    // Get order details
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order) {
      return NextResponse.redirect(new URL('/orders?error=not-found', request.url));
    }

    if (status === 'success') {
      return NextResponse.redirect(new URL(`/orders/${orderId}/success`, request.url));
    } else {
      return NextResponse.redirect(new URL(`/orders/${orderId}/failed`, request.url));
    }

  } catch (error) {
    console.error('Return URL error:', error);
    return NextResponse.redirect(new URL('/orders?error=unknown', request.url));
  }
} 