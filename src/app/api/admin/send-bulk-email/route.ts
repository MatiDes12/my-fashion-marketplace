import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { type, subject, message } = await request.json();

    // Validate input
    if (!type || !subject || !message) {
      return NextResponse.json(
        { error: 'Type, subject, and message are required' },
        { status: 400 }
      );
    }

    if (!['notify_me', 'newsletter'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid subscription type' },
        { status: 400 }
      );
    }

    // Get active subscribers of the specified type
    const { data: subscribers, error: fetchError } = await supabase
      .from('email_subscribers')
      .select('email')
      .eq('subscription_type', type)
      .eq('is_active', true);

    if (fetchError) throw fetchError;

    if (!subscribers?.length) {
      return NextResponse.json(
        { error: 'No active subscribers found' },
        { status: 404 }
      );
    }

    // Send emails in batches of 50 (to avoid rate limits)
    const batchSize = 50;
    const emailPromises = [];
    
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      const batchPromises = batch.map(subscriber => 
        resend.emails.send({
          from: 'noreply@avrioxshop.com',
          to: subscriber.email,
          subject: subject,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 30px;">
                <img 
                  src="${process.env.NEXT_PUBLIC_SITE_URL}/images/brand/logo.png" 
                  alt="Avrio Shop" 
                  width="80" 
                  height="80" 
                  style="margin: 0 auto;"
                />
              </div>

              <!-- Content -->
              <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                <h1 style="color: #333; margin-top: 0; text-align: center;">${subject}</h1>
                <div style="color: #666; line-height: 1.6;">
                  ${message}
                </div>
              </div>

              <!-- Footer -->
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                <p style="color: #999; font-size: 12px; margin-bottom: 10px;">
                  You're receiving this email because you subscribed to ${
                    type === 'notify_me' ? 'launch notifications' : 'our newsletter'
                  } from Avrio Shop.
                </p>
                <p style="color: #999; font-size: 12px;">
                  To unsubscribe, <a href="${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?email=${subscriber.email}&type=${type}" style="color: #666;">click here</a>.
                </p>
              </div>
            </div>
          `
        })
      );
      
      emailPromises.push(...batchPromises);
    }

    // Wait for all emails to be sent
    await Promise.all(emailPromises);

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${subscribers.length} emails`
    });

  } catch (error) {
    console.error('Error sending bulk emails:', error);
    return NextResponse.json(
      { error: 'Failed to send emails' },
      { status: 500 }
    );
  }
} 