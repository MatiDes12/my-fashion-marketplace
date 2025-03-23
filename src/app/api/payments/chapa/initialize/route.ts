import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY!;
const CHAPA_API_URL = 'https://api.chapa.co/v1/transaction/initialize';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Add required fields for Chapa API
    const payload = {
      ...body,
      first_name: "Customer", // Add default or get from user
      last_name: "Name",      // Add default or get from user
      currency: "ETB",        // Ensure currency is ETB
    };

    const response = await fetch(CHAPA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('Chapa API response:', data); // Add this for debugging

    if (!response.ok) {
      throw new Error(data.message || 'Failed to initialize Chapa payment');
    }

    // Return the exact structure from Chapa
    return NextResponse.json(data);
  } catch (error) {
    console.error('Chapa payment initialization error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Payment initialization failed',
        details: error
      }, 
      { status: 500 }
    );
  }
} 