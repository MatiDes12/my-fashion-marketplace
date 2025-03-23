import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Create a Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tx_ref = searchParams.get('trx_ref');
  const status = searchParams.get('status');

  try {
    console.log('Callback params:', { tx_ref, status });

    if (!tx_ref || status !== 'success') {
      throw new Error('Invalid callback parameters');
    }

    // First, get the order to get customer name and owner's phone
    let { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        customer:users!orders_user_id_fkey (
          id,
          full_name,
          email,
          store_settings
        ),
        product:products (
          id,
          owner:users (
            id,
            store_settings
          )
        )
      `)
      .eq('tx_ref', tx_ref)
      .single();

    if (ordersError || !orders) {
      throw new Error('Order not found');
    }

    // Split customer name
    const fullName = orders.customer?.full_name || 'Unknown Customer';
    const [firstName, ...lastNameParts] = fullName.split(' ');
    const lastName = lastNameParts.join(' ') || 'Unknown';

    // Get owner's alternative phone
    let customerPhone = null;
    if (orders.product?.owner?.store_settings) {
      const ownerSettings = orders.product.owner.store_settings;
      if (typeof ownerSettings === 'string') {
        const settings = JSON.parse(ownerSettings);
        customerPhone = settings.alternativePhone;
      } else {
        customerPhone = ownerSettings.alternativePhone;
      }
    }

    // Verify the transaction with Chapa
    const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY!}`,
        'Content-Type': 'application/json'
      }
    });

    let data = await response.json();

    // Immediately update the verification data with correct customer info and phone
    if (response.ok && data.status === 'success') {
      data = {
        ...data,
        data: {
          ...data.data,
          first_name: firstName,
          last_name: lastName,
          phone_number: customerPhone
        }
      };
      
      console.log('Updated verification response:', data);

      // Now get full order details including product and owner info
      let { data: fullOrders, error: fullOrdersError } = await supabase
        .from('orders')
        .select(`
          *,
          customer:users!orders_user_id_fkey (
            id,
            full_name,
            email,
            store_settings
          ),
          product:products (
            id,
            title,
            owner:users (
              id,
              full_name,
              store_settings
            )
          )
        `)
        .eq('tx_ref', tx_ref);

      console.log('Initial orders query:', { fullOrders, fullOrdersError });

      if (fullOrdersError) {
        console.error('Orders fetch error:', fullOrdersError);
        throw fullOrdersError;
      }

      if (!fullOrders || fullOrders.length === 0) {
        // If no orders found, wait a bit and try again (payment might have just been created)
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const { data: retryOrders, error: retryError } = await supabase
          .from('orders')
          .select(`
            *,
            customer:users!orders_user_id_fkey (
              id,
              full_name,
              email,
              store_settings
            ),
            product:products (
              id,
              title,
              owner:users (
                id,
                full_name,
                store_settings
              )
            )
          `)
          .eq('tx_ref', tx_ref);

        console.log('Retry orders query:', { retryOrders, retryError });

        if (retryError || !retryOrders || retryOrders.length === 0) {
          throw new Error(`No orders found for transaction reference: ${tx_ref}`);
        }

        fullOrders = retryOrders;
      }

      // Process each order
      for (const order of fullOrders) {
        try {
          // 1. Update order status to confirmed (but not completed)
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              order_status: 'confirmed', // Initial state after payment
              payment_status: 'paid',
              payment_reference: data.data.reference
            })
            .eq('id', order.id);

          if (updateError) throw updateError;

          // 2. Create transaction record with pending seller payout
          const platformFee = order.platform_fee || 0;    // 5%
          const serviceFee = order.service_fee || 0;      // 2%
          const vatAmount = order.ethiopia_tax || 0;      // 15%
          const deliveryFee = order.delivery_fee || 0;
          const sellerAmount = order.total_price - (platformFee + serviceFee + vatAmount + deliveryFee);

          const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
              order_id: order.id,
              payment_method: 'CHAPA',
              payment_status: 'paid',
              subtotal: order.total_price,
              vat_amount: vatAmount,
              platform_fee: platformFee,
              service_fee: serviceFee,
              delivery_fee: deliveryFee,
              total_amount: order.total_price,
              seller_id: order.product?.owner?.id,
              seller_payout_amount: sellerAmount,
              platform_revenue: platformFee + serviceFee,
              seller_payout_status: 'pending',     // Waiting for admin approval
              platform_payout_status: 'completed', // Platform fees already received
              customer_name: fullName,
              customer_email: order.customer?.email,
              customer_phone: customerPhone
            });

          if (transactionError) throw transactionError;

        } catch (error) {
          console.error('Error processing order:', error);
          throw error;
        }
      }

      // Return success response
      return new Response(JSON.stringify({
        status: 'success',
        message: 'Payment processed successfully and cart cleared',
        tx_ref: tx_ref
      }), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    throw new Error('Payment verification failed');
  } catch (error) {
    console.error('Chapa callback error:', error);
    // Return error response instead of redirecting
    return new Response(JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Payment verification failed',
      tx_ref: tx_ref
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
      status: 400
    });
  }
} 