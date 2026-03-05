import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { sanitizeForLog, isValidEmail } from '@/utils/security';
import { checkPaymentRateLimit } from '@/utils/rate-limit';

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY!;
const CHAPA_API_URL = 'https://api.chapa.co/v1/transaction/initialize';

// Allowed callback/return URL patterns - only our own domains
const ALLOWED_CALLBACK_HOSTS = [
  'localhost',
  '127.0.0.1',
  'avrioxshop.com',
  'www.avrioxshop.com',
];

// Validate callback URL to prevent SSRF
function validateCallbackUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // Only allow HTTPS (or HTTP for localhost)
    if (parsed.protocol !== 'https:' &&
        !(parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))) {
      return null;
    }
    // Check against allowed hosts
    const isAllowed = ALLOWED_CALLBACK_HOSTS.some(host =>
      parsed.hostname === host || parsed.hostname.endsWith('.' + host)
    );
    if (!isAllowed) {
      console.warn('[CHAPA INIT] Rejected callback URL with disallowed host:', sanitizeForLog(parsed.hostname));
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!(await checkPaymentRateLimit(ip))) {
      return NextResponse.json({ error: 'Too many payment requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();

    // Validate and clean email
    const email = body.email?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      throw new Error('Please enter a valid email address');
    }
    
    // Split the full name into first and last name
    const fullName = body.full_name || 'Customer Name';
    const [firstName = 'Customer', lastName = 'Name'] = fullName.split(' ');

    // Validate callback URLs to prevent SSRF
    const callbackUrl = validateCallbackUrl(body.callback_url);
    const returnUrl = validateCallbackUrl(body.return_url);

    if (!callbackUrl || !returnUrl) {
      throw new Error('Invalid callback or return URL');
    }

    // Validate tx_ref format
    if (!body.tx_ref || typeof body.tx_ref !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.tx_ref)) {
      throw new Error('Invalid transaction reference');
    }

    // Validate amount
    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0 || amount > 1000000) {
      throw new Error('Invalid amount');
    }

    // Add required fields for Chapa API - use only validated values
    const payload = {
      email: email,
      first_name: firstName.substring(0, 50),
      last_name: lastName.substring(0, 50),
      currency: "ETB",
      tx_ref: body.tx_ref,
      amount: amount.toFixed(2),
      callback_url: callbackUrl,
      return_url: returnUrl,
    };

    console.log('Sending payload to Chapa for tx_ref:', sanitizeForLog(body.tx_ref));
    
    const response = await fetch(CHAPA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('Chapa API response status:', response.status, 'success:', data.status === 'success');

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