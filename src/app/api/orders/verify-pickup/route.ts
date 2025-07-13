import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { verifyPickupCode } from '@/utils/pickupCode';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ 
        success: false, 
        error: 'Pickup code is required' 
      }, { status: 400 });
    }

    const success = await verifyPickupCode(code);

    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or already verified pickup code' 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Pickup code verified successfully'
    });

  } catch (error) {
    console.error('Error verifying pickup code:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to verify pickup code' 
    }, { status: 500 });
  }
} 