import { NextResponse } from 'next/server';

const MPESA_BASE_URL = 'https://apisandbox.safaricom.et';
const CONSUMER_KEY = 'NrOZwAkAI1shxtKwF0eA8RL9e1rUpCVbu9FXYvjq4Y8SBw3f';
const CONSUMER_SECRET = 'NADIfr8CpKQW0cFIv4GSgM3oTGLZeWARL9pmTcdM1UgiSTIKavyfu9Fko2GAFF0k';

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
    const { phoneNumber, amount, billRefNumber } = await request.json();
    const accessToken = await getAccessToken();

    const response = await fetch(`${MPESA_BASE_URL}/mpesa/b2c/simulatetransaction/v1/request`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        CommandID: "CustomerPayBillOnline",
        Amount: amount.toString(),
        Msisdn: phoneNumber,
        BillRefNumber: billRefNumber,
        ShortCode: "1020"
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.errorMessage || 'Failed to simulate payment' }, { status: 400 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error simulating M-PESA payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 