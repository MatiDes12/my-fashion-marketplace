import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Add export config to explicitly mark this as a dynamic route
export const dynamic = 'force-dynamic';

// Add validation function at the top
const validateOrderUpdate = (order: any) => {
  if (!order) throw new Error('Invalid order data');
  if (order.quantity <= 0) throw new Error('Invalid quantity');
  if (order.total_price <= 0) throw new Error('Invalid total price');
  if (order.service_fee < 0) throw new Error('Invalid service fee');
  if (order.platform_fee < 0) throw new Error('Invalid platform fee');
  if (order.delivery_fee < 0) throw new Error('Invalid delivery fee');
  return true;
};

// Use NextRequest instead of Request
export async function GET(request: NextRequest) {
  try {
    // Use NextRequest's nextUrl property instead of URL constructor
    const tx_ref = request.nextUrl.searchParams.get('tx_ref');

    if (!tx_ref) {
      throw new Error('Missing transaction reference');
    }

    // Fetch the cash order status
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('tx_ref', tx_ref)
      .single();

    if (error) throw error;

    // Add validation after fetching order
    try {
      validateOrderUpdate(order);
    } catch (error) {
      console.error('[CASH VERIFY] Validation error:', error);
      return NextResponse.json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Order validation failed'
      }, { status: 400 });
    }

    return NextResponse.json({
      status: 'success',
      data: {
        status: order.payment_status,
        tx_ref: order.tx_ref,
        receipt_url: order.receipt_url
      }
    });

  } catch (error) {
    console.error('[CASH VERIFY] Error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Verification failed'
      },
      { status: 500 }
    );
  }
} 