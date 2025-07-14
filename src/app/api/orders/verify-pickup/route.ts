import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { verifyPickupCode } from '@/utils/pickupCodeServer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, orderId } = body;

    if (!code) {
      return NextResponse.json({ 
        success: false, 
        error: 'Pickup code is required' 
      }, { status: 400 });
    }

    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID is required' 
      }, { status: 400 });
    }

    // Normalize the code
    const normalizedCode = code.trim().toUpperCase();
    
    const result = await verifyPickupCode(normalizedCode, orderId);
    console.log('Verification result:', result);

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Failed to verify pickup code'
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Pickup code verified successfully',
      order: result.order
    });

  } catch (error) {
    console.error('Error in verify-pickup API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to verify pickup code' 
    }, { status: 500 });
  }
} 