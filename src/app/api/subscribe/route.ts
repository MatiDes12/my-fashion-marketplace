import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, type } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!type || !['notify_me', 'newsletter'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid subscription type' },
        { status: 400 }
      );
    }

    // Check if already subscribed to this specific type
    const { data: existingSubscription, error: checkError } = await supabaseServer
      .from('email_subscribers')
      .select('*')
      .eq('email', email)
      .eq('subscription_type', type)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found
      throw checkError;
    }

    if (existingSubscription) {
      return NextResponse.json(
        { 
          success: true,
          message: type === 'notify_me'
            ? 'You are already registered to be notified when we launch!'
            : 'You are already subscribed to our newsletter!'
        },
        { status: 200 }
      );
    }

    // Add new subscription
    const { error: subscribeError } = await supabaseServer
      .from('email_subscribers')
      .insert([
        {
          email,
          subscription_type: type,
          is_active: true
        }
      ]);

    if (subscribeError) {
      if (subscribeError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { 
            success: true,
            message: type === 'notify_me'
              ? 'You are already registered to be notified when we launch!'
              : 'You are already subscribed to our newsletter!'
          },
          { status: 200 }
        );
      }
      throw subscribeError;
    }

    // Send confirmation email
    await resend.emails.send({
      from: 'noreply@avrioxshop.com',
      to: email,
      subject: type === 'notify_me' 
        ? 'Thank you for your interest in Avrio Shop!'
        : 'Welcome to Avrio Shop Newsletter!',
      html: type === 'notify_me'
        ? `
          <h1>Thank you for your interest!</h1>
          <p>We'll notify you as soon as Avrio Shop launches.</p>
          <p>Stay tuned for an amazing shopping experience!</p>
          <p>Want to stay updated with our latest news? <a href="${process.env.NEXT_PUBLIC_SITE_URL}/#newsletter">Subscribe to our newsletter</a>!</p>
        `
        : `
          <h1>Welcome to Avrio Shop Newsletter!</h1>
          <p>Thank you for subscribing to our newsletter.</p>
          <p>You'll now receive exclusive deals and updates about Avrio Shop.</p>
          <p>Want to be notified when we launch? <a href="${process.env.NEXT_PUBLIC_SITE_URL}/#notify">Click here</a>!</p>
        `
    });

    // Send notification to admin
    await resend.emails.send({
      from: 'noreply@avrioxshop.com',
      to: 'avrioxshop@gmail.com',
      subject: `New ${type === 'notify_me' ? 'Launch Notification' : 'Newsletter'} Subscriber`,
      html: `
        <h1>New Subscriber</h1>
        <p>Email: ${email}</p>
        <p>Type: ${type}</p>
        <p>Date: ${new Date().toLocaleString()}</p>
      `
    });

    return NextResponse.json(
      { 
        success: true, 
        message: type === 'notify_me'
          ? 'Thank you! We\'ll notify you when we launch.'
          : 'Successfully subscribed to our newsletter!'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to process subscription. Please try again.' },
      { status: 500 }
    );
  }
} 