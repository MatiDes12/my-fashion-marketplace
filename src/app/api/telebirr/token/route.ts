import { NextResponse } from 'next/server';
import request from 'request';
import { telebirrConfig } from '@/config/telebirr';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    return new Promise((resolve) => {
      const options = {
        method: 'POST',
        url: `${telebirrConfig.baseUrl}${telebirrConfig.endpoints.token}`,
        headers: {
          'Content-Type': 'application/json',
          'X-APP-Key': body.fabricAppId,
        },
        rejectUnauthorized: false,
        requestCert: false,
        agent: false,
        body: JSON.stringify({
          appSecret: body.appSecret,
        }),
      };

      request(options, function (error, response) {
        if (error) {
          console.error('Token request error:', error);
          resolve(NextResponse.json({ error: error.message }, { status: 500 }));
          return;
        }

        try {
          const result = JSON.parse(response.body);
          resolve(NextResponse.json(result));
        } catch (parseError) {
          console.error('Token response parse error:', parseError);
          resolve(NextResponse.json({ error: 'Invalid response format' }, { status: 500 }));
        }
      });
    });
  } catch (error) {
    console.error('Token error:', error);
    return NextResponse.json({ error: 'Failed to get token' }, { status: 500 });
  }
} 