import { NextResponse } from 'next/server';
import { telebirrConfig } from '@/config/telebirr';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const response = await fetch(`${telebirrConfig.baseUrl}${telebirrConfig.endpoints.token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APP-Key': body.fabricAppId,
      },
      body: JSON.stringify({
        appSecret: body.appSecret,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get token');
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Token error:', error);
    return NextResponse.json(
      { error: 'Failed to get token' }, 
      { status: 500 }
    );
  }
} 