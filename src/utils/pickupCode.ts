import { createClientComponent } from '@/lib/supabase';

// Generate a random code of specified length
function generateRandomCode(length: number = 8): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a unique pickup code
export async function generateUniquePickupCode(): Promise<string> {
  const supabase = createClientComponent();
  let code: string;
  let isUnique = false;
  
  // Try up to 5 times to generate a unique code
  for (let i = 0; i < 5; i++) {
    code = generateRandomCode(8);
    
    // Check if code exists
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('pickup_code', code)
      .maybeSingle();
      
    if (error) throw error;
    
    if (!data) {
      isUnique = true;
      break;
    }
  }
  
  if (!isUnique) {
    throw new Error('Failed to generate unique pickup code');
  }
  
  return code!;
}

// Client-side verification function (for direct database access)
export async function verifyPickupCodeClient(code: string, orderId: string): Promise<{
  success: boolean;
  error?: string;
  order?: any;
}> {
  const supabase = createClientComponent();
  
  try {
    // Normalize the code to uppercase and trim
    const normalizedCode = code.trim().toUpperCase();
    console.log('Attempting to verify code:', normalizedCode, 'for order:', orderId);

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

    console.log('Found order:', order);

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
    const { error: transactionError } = await supabase
      .from('transactions')
      .update({
        payment_status: 'paid',
        platform_payout_status: 'completed',
        seller_payout_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId);

    if (transactionError) {
      console.error('Error updating transaction:', transactionError);
      // Don't fail the whole operation, just log the error
    } else {
      console.log('Transaction updated successfully for order:', orderId);
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