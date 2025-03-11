import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { TelebirrPayment } from '@/utils/telebirr-payment';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { settings } = await request.json();

    // Initialize Telebirr with the settings
    const telebirr = new TelebirrPayment({
      merchant_code: settings.short_code,
      app_id: settings.fabric_app_id,
      app_key: settings.app_secret,
      public_key: settings.public_key,
      private_key: settings.private_key,
      notify_url: settings.notify_url,
      redirect_url: settings.redirect_url
    });

    // Try to get a token - this will validate the basic credentials
    const token = await telebirr.getToken();

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