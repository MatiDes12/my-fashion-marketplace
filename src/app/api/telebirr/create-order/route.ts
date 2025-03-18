import { NextResponse } from 'next/server';
import { getTelebirrConfig, TelebirrPayment } from '@/lib/telebirr';

export async function POST(request: Request) {
  try {
    const { amount, description } = await request.json();
    console.log('Received request:', { amount, description });

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
      amount: amount.toString()
    });

    console.log('Successfully created order with URL:', paymentUrl);

    return NextResponse.json({ success: true, paymentUrl });

  } catch (error) {
    console.error('Detailed Telebirr payment error:', error);
    let errorMessage = 'Payment initialization failed';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 