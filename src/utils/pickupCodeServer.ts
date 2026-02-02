import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { sanitizeForLog, isValidIdentifier } from '@/utils/security';

// Server-side verification function
export async function verifyPickupCode(code: string, orderId: string): Promise<{
  success: boolean;
  error?: string;
  order?: any;
}> {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Validate inputs
    if (!isValidIdentifier(orderId, 50)) {
      return { success: false, error: 'Invalid order ID format' };
    }

    // Normalize the code to uppercase and trim
    const normalizedCode = code.trim().toUpperCase();
    console.log('Attempting to verify code:', sanitizeForLog(normalizedCode), 'for order:', sanitizeForLog(orderId));

    // Query the specific order and verify its pickup code
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        product:products(
          id,
          title,
          price,
          owner_id
        )
      `)
      .eq('id', orderId)
      .single();
      
    if (error) {
      console.error('Error fetching order:', error);
      return {
        success: false,
        error: 'Failed to fetch order'
      };
    }
    
    if (!order) {
      return {
        success: false,
        error: 'Order not found'
      };
    }

    console.log('Found order:', sanitizeForLog(order.id));

    // Verify the pickup code matches
    if (order.pickup_code !== normalizedCode) {
      return {
        success: false,
        error: 'Invalid pickup code for this order'
      };
    }

    if (order.pickup_code_verified) {
      return {
        success: false,
        error: 'This pickup code has already been verified'
      };
    }

    if (order.order_status === 'picked up') {
      return {
        success: false,
        error: 'This order has already been picked up'
      };
    }
    
    // Update order status - ensure lowercase to match DB constraint
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        pickup_code_verified: true,
        pickup_code_verified_at: new Date().toISOString(),
        order_status: 'picked up',
        payment_status: 'paid'
      })
      .eq('id', orderId)
      .select()
      .single();
      
    if (updateError) {
      console.error('Error updating order:', updateError);
      return {
        success: false,
        error: 'Failed to update order status'
      };
    }

    // Update transaction payment status
    console.log('Attempting to update transaction for order:', sanitizeForLog(orderId));
    
    const { error: transactionError } = await supabase
      .from('transactions')
      .update({
        payment_status: 'paid',
        platform_payout_status: 'completed',
        seller_payout_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .select();

    if (transactionError) {
      console.error('Error updating transaction:', transactionError);
      // Don't fail the whole operation, just log the error
    } else {
      console.log('Transaction updated successfully for order:', sanitizeForLog(orderId));
    }

    return {
      success: true,
      order: updatedOrder
    };
  } catch (error) {
    console.error('Unexpected error in verifyPickupCode:', error);
    return {
      success: false,
      error: 'An unexpected error occurred'
    };
  }
} 