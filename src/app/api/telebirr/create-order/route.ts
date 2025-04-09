import { NextResponse } from 'next/server';
import { getTelebirrConfig, TelebirrPayment } from '@/lib/telebirr';

export async function POST(request: Request) {
  try {
    const { amount, description, subscription = false } = await request.json();
    console.log('Received request:', { amount, description, subscription });

    // Get Telebirr config
    const config = await getTelebirrConfig();
    console.log('Got Telebirr config:', {
      baseUrl: config.baseUrl,
      merchantAppId: config.merchantAppId,
      fabricAppId: config.fabricAppId,
      shortCode: config.shortCode,
    });
    
    // Initialize payment service
    const telebirr = new TelebirrPayment(config);

    // Create order and get payment URL
    const paymentUrl = await telebirr.createOrder({
      title: description,
      amount: amount.toString(),
      isSubscription: subscription
    });

    console.log('Successfully created order with URL:', paymentUrl);

    return NextResponse.json({ success: true, paymentUrl });

  } catch (error) {
    console.error('Detailed Telebirr payment error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Payment initialization failed'
      },
      { status: 500 }
    );
  }
} 