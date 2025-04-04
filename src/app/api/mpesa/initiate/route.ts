import { NextResponse } from 'next/server';

// Change to production URL
const MPESA_BASE_URL = 'https://api.safaricom.et';

// Use environment variables for production
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE;
const PASSKEY = process.env.MPESA_PASSKEY;

async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const response = await fetch(`${MPESA_BASE_URL}/v1/token/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get access token');
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: Request) {
  try {
    const { phoneNumber, amount, orderId } = await request.json();
    const accessToken = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    
    // Generate password using your production credentials
    const password = Buffer.from(
      `${SHORTCODE}${PASSKEY}${timestamp}`
    ).toString('base64');

    const response = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v3/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        MerchantRequestID: `AVRIO-${orderId}`,
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: SHORTCODE,
        PhoneNumber: phoneNumber,
        CallBackURL: `${process.env.NEXT_PUBLIC_BASE_URL}/api/mpesa/callback`,
        AccountReference: orderId,
        TransactionDesc: "Payment for order",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.errorMessage || 'Failed to initiate payment' }, { status: 400 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error initiating M-PESA payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 