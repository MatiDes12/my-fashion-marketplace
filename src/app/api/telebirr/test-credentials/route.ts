import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { TelebirrPayment } from '@/server/telebirr';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { settings } = await request.json();

    // Initialize Telebirr with the settings
    const telebirr = new TelebirrPayment({
      fabricAppId: settings.fabric_app_id,
      appSecret: settings.app_secret,
      merchantAppId: settings.merchant_app_id,
      shortCode: settings.short_code,
      privateKey: settings.private_key,
      notifyUrl: settings.notify_url,
      redirectUrl: settings.redirect_url
    });

    // Try to get a token - this will validate the basic credentials
    const token = await telebirr.getFabricToken();

    // If we got here, the credentials work
    return NextResponse.json({ 
      success: true,
      message: 'Credentials validated successfully',
      token: token // Only for debugging
    });

  } catch (error) {
    console.error('Credential test error:', error);
    
    // Enhanced error handling
    let errorMessage = 'Failed to validate credentials';
    let statusCode = 500;

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timed out. Please ensure you are using an Ethiopian VPN or proxy.';
        statusCode = 408;
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused. Please check if the API URL is correct.';
        statusCode = 502;
      } else if (error.message.includes('Invalid token response')) {
        errorMessage = 'Invalid credentials. Please check your App ID and Secret.';
        statusCode = 401;
      } else if (error.message.includes('Missing required configuration')) {
        errorMessage = error.message;
        statusCode = 400;
      }
    }

    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { 
      status: statusCode 
    });
  }
} 