import { NextResponse } from 'next/server';
import { TelebirrPayment, getTelebirrConfig } from '@/lib/telebirr';

export async function POST(request: Request) {
  try {
    const { phoneNumber, otpCode, otpReference, amount, orderId, sellerId } = await request.json();

    // Validate required fields
    if (!phoneNumber || !otpCode || !otpReference || !amount || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get config based on seller or admin
    const config = await getTelebirrConfig(sellerId);
    
    // Initialize Telebirr with config
    const telebirr = new TelebirrPayment(config);

    // Verify OTP with Telebirr
    const response = await telebirr.verifyPaymentOTP({
      phoneNumber,
      otpCode,
      otpReference,
      amount,
      orderId,
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify OTP' },
      { status: 500 }
    );
  }
} 