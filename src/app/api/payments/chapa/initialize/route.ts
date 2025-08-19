import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY!;
const CHAPA_API_URL = 'https://api.chapa.co/v1/transaction/initialize';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate and clean email
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address');
    }
    
    // Additional email validation for Chapa
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address format');
    }
    
    // Check for common email issues
    if (email.length > 254) {
      throw new Error('Email address is too long');
    }
    
    // Check for potentially problematic email domains
    const domain = email.split('@')[1];
    if (domain && domain.includes('buckeyemail.osu.edu')) {
      // This is a university email, which should be fine
      console.log('Using university email domain:', domain);
    }
    
    // Split the full name into first and last name
    const fullName = body.full_name || 'Customer Name';
    const [firstName = 'Customer', lastName = 'Name'] = fullName.split(' ');
    
    // Add required fields for Chapa API
    const payload = {
      ...body,
      email: email,
      first_name: firstName,
      last_name: lastName,
      currency: "ETB",        // Ensure currency is ETB
      tx_ref: body.tx_ref,    // Ensure tx_ref is included
      amount: body.amount,     // Ensure amount is included
      callback_url: body.callback_url, // Ensure callback_url is included
      return_url: body.return_url,     // Ensure return_url is included
    };

    console.log('Sending payload to Chapa:', payload);
    
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
      // Handle Chapa validation errors properly
      if (data.message && typeof data.message === 'object') {
        // Extract validation error messages
        const validationErrors = [];
        for (const [field, errors] of Object.entries(data.message)) {
          if (Array.isArray(errors)) {
            validationErrors.push(`${field}: ${errors.join(', ')}`);
          }
        }
        const errorMessage = validationErrors.length > 0 
          ? `Please check your information: ${validationErrors.join('; ')}`
          : 'Please check your information and try again';
        throw new Error(errorMessage);
      } else if (data.message) {
        throw new Error(data.message);
      } else {
        throw new Error('Failed to initialize payment. Please try again.');
      }
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