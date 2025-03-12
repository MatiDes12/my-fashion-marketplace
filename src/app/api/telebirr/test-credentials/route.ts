import { NextResponse } from 'next/server';
import https from 'https';

export async function POST(request: Request) {
  try {
    const { settings } = await request.json();

    // Production implementation
    const tokenUrl = 'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway/payment/v1/token';

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Required for Telebirr's SSL
      timeout: 30000,
    });

    const fetchOptions: RequestInit & { agent?: https.Agent } = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APP-Key': settings.fabric_app_id,
      },
      body: JSON.stringify({
        appSecret: settings.app_secret,
      }),
      agent: httpsAgent
    };

    const tokenResponse = await fetch(tokenUrl, fetchOptions);

    if (!tokenResponse.ok) {
      throw new Error('Invalid credentials');
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.code !== '0') {
      throw new Error(tokenData.message || 'Failed to validate credentials');
    }

    return NextResponse.json({ 
      success: true,
      message: 'Credentials validated successfully'
    });

  } catch (error) {
    console.error('Credential test error:', error);
    
    let errorMessage = 'Failed to validate credentials';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('ETIMEDOUT') || error.message.includes('Connect Timeout Error')) {
        errorMessage = 'Connection timed out. Please check your network connection.';
        statusCode = 408;
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused. Please contact support.';
        statusCode = 502;
      } else if (error.message.includes('Invalid credentials')) {
        errorMessage = 'Invalid credentials. Please check your App ID and Secret.';
        statusCode = 401;
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