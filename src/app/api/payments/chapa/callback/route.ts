import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Create a Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Add validation function
const validateOrderData = (data: any) => {
  if (!data) throw new Error('Invalid order data');
  if (!data.user_id) throw new Error('Missing user ID');
  if (!data.tx_ref) throw new Error('Missing transaction reference');
  if (!Array.isArray(data.sellers)) throw new Error('Invalid sellers data');
  return true;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tx_ref = searchParams.get('trx_ref') || searchParams.get('tx_ref');
  const status = searchParams.get('status');

  console.log('[CHAPA CALLBACK] Starting callback processing:', { tx_ref, status });

  try {
    if (!tx_ref) {
      throw new Error('Missing transaction reference');
    }

    // Verify with Chapa
    const verifyResponse = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY!}`,
        'Content-Type': 'application/json'
      }
    });

    const verifyData = await verifyResponse.json();
    console.log('[CHAPA CALLBACK] Verification response:', verifyData);

    if (verifyResponse.ok && verifyData.status === 'success') {
      const reference = verifyData.data?.reference;
      const receiptUrl = reference 
        ? `https://checkout.chapa.co/checkout/payment-receipt/${reference}`
        : null;

      // Check if order already exists for this tx_ref
      const { data: existingOrders, error: existingOrdersError } = await supabase
        .from('orders')
        .select('id')
        .eq('tx_ref', tx_ref);

      if (existingOrdersError) {
        throw new Error('Failed to check for existing orders');
      }

      // If orders already exist for this tx_ref, skip processing
      if (existingOrders && existingOrders.length > 0) {
        console.log('[CHAPA CALLBACK] Order already exists for tx_ref:', tx_ref);
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `/orders?payment_success=true&tx_ref=${tx_ref}`,
          },
        });
      }

      // Get temporary orders
      const { data: tempOrders, error: tempOrdersError } = await supabase
        .from('temporary_orders')
        .select('*')
        .eq('tx_ref', tx_ref)
        .gt('expires_at', new Date().toISOString());

      if (tempOrdersError || !tempOrders?.length) {
        throw new Error('Temporary orders not found or expired');
      }

      // Process each temporary order
      for (const tempOrder of tempOrders) {
        // Check product availability first
        const { data: product, error: productCheckError } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', tempOrder.product_id)
          .single();

        if (productCheckError) {
          console.error('[CHAPA CALLBACK] Error checking product availability:', productCheckError);
          continue;
        }

        if (!product || (product.quantity || 0) < tempOrder.quantity) {
          console.error('[CHAPA CALLBACK] Insufficient quantity available for product:', tempOrder.product_id);
          continue;
        }

        // Create order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: tempOrder.user_id,
            product_id: tempOrder.product_id,
            quantity: tempOrder.quantity,
            total_price: tempOrder.total_price,
            platform_fee: tempOrder.platform_fee,
            service_fee: tempOrder.service_fee,
            ethiopia_tax: tempOrder.ethiopia_tax,
            delivery_fee: tempOrder.delivery_fee,
            tx_ref: tx_ref,
            payment_status: 'paid',
            order_status: 'confirmed',
            payment_reference: reference,
            receipt_url: receiptUrl,
            delivery_method: tempOrder.delivery_method,
            delivery_address: tempOrder.delivery_address,
            selected_size: tempOrder.selected_size,
            selected_color: tempOrder.selected_color,
            selected_variant_sku: tempOrder.selected_variant_sku
          })
          .select()
          .single();

        if (orderError) {
          // Check if error is due to unique constraint violation
          if (orderError.code === '23505' && orderError.message.includes('unique_tx_ref')) {
            console.log('[CHAPA CALLBACK] Order already exists for tx_ref:', tx_ref);
            continue; // Skip to next order
          }
          console.error('[CHAPA CALLBACK] Error creating order:', orderError);
          continue;
        }

        // Update product quantity
        const newQuantity = Math.max(0, (product.quantity || 0) - tempOrder.quantity);
        
        const { error: quantityUpdateError } = await supabase
          .from('products')
          .update({ 
            quantity: newQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', tempOrder.product_id);

        if (quantityUpdateError) {
          console.error('[CHAPA CALLBACK] Error updating product quantity:', quantityUpdateError);
          // Don't continue here as the order is already created
        }

        // Create transaction
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            order_id: order.id,
            payment_method: 'CHAPA',
            payment_status: 'paid',
            subtotal: tempOrder.total_price - tempOrder.delivery_fee,
            platform_fee: tempOrder.platform_fee,
            service_fee: tempOrder.service_fee,
            vat_amount: tempOrder.ethiopia_tax,
            delivery_fee: tempOrder.delivery_fee,
            total_amount: tempOrder.total_price,
            seller_id: tempOrder.seller_id,
            customer_name: verifyData.data.first_name + ' ' + verifyData.data.last_name,
            customer_email: verifyData.data.email,
            customer_phone: tempOrder.customer_phone,
            seller_payout_amount: tempOrder.total_price - tempOrder.service_fee,
            seller_payout_status: 'pending',
            platform_payout_status: 'completed'
          });

        if (transactionError) {
          console.error('[CHAPA CALLBACK] Error creating transaction:', transactionError);
        }
      }

      // Delete temporary orders
      const { error: deleteError } = await supabase
        .from('temporary_orders')
        .delete()
        .eq('tx_ref', tx_ref);

      if (deleteError) {
        console.error('[CHAPA CALLBACK] Error deleting temporary orders:', deleteError);
      }

      // Clear cart items for the user
      const { error: cartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', tempOrders[0].user_id);

      if (cartError) {
        console.error('[CHAPA CALLBACK] Error clearing cart:', cartError);
      }

      console.log('[CHAPA CALLBACK] Successfully processed all orders and transactions');

      return new Response(null, {
        status: 302,
        headers: {
          'Location': `/orders?payment_success=true&tx_ref=${tx_ref}`,
        },
      });
    }

    throw new Error('Payment verification failed');

  } catch (error) {
    console.error('[CHAPA CALLBACK] Error:', error);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `/cart?payment_error=true&tx_ref=${tx_ref}`,
      },
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Verify the payment with Chapa
    const verifyResponse = await fetch(
      `https://api.chapa.co/v1/transaction/verify/${body.tx_ref}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY!}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const verifyData = await verifyResponse.json();
    
    if (verifyResponse.ok && verifyData.status === 'success') {
      // Process the order here (same logic as GET handler)
      // ...
    return NextResponse.json({ success: true });
    }

    throw new Error('Payment verification failed');
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
} 