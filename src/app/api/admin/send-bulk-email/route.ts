import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase-route';
import { getSupabaseServer } from '@/lib/supabase-server';
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    // Verify admin authentication
    const supabase = await createRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { type, subject, message, singleEmail } = await request.json();

    // Validate input
    if (!subject || !message || (!type && !singleEmail)) {
      return NextResponse.json(
        { error: 'Provide subject, message, and either subscription type or a singleEmail' },
        { status: 400 }
      );
    }

    if (type && !['notify_me', 'newsletter'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid subscription type' },
        { status: 400 }
      );
    }

    let recipients: { email: string }[] = [];
    if (singleEmail) {
      recipients = [{ email: singleEmail }];
    } else {
      // Get active subscribers of the specified type
      const { data: subscribers, error: fetchError } = await getSupabaseServer()
        .from('email_subscribers')
        .select('email')
        .eq('subscription_type', type)
        .eq('is_active', true);

      if (fetchError) throw fetchError;
      recipients = (subscribers as { email: string }[]) || [];
    }
    if (!recipients?.length) {
      return NextResponse.json(
        { error: 'No active subscribers found' },
        { status: 404 }
      );
    }

    // Send emails in smaller batches and throttle between batches (prod rate limits)
    const batchSize = 25;
    const emailPromises = [];
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      const batchPromises = batch.map((subscriber: any) => 
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

      // throttle between batches (200ms)
      await new Promise((r) => setTimeout(r, 200));
    }

    // Wait for all emails to be sent safely
    const results = await Promise.allSettled(emailPromises);
    const failed = results.filter(r => r.status === 'rejected').length;

    // Log campaign
    await getSupabaseServer()
      .from('email_campaigns')
      .insert({
        subject,
        message,
        subscription_type: singleEmail ? null : type,
        single_email: singleEmail || null,
        recipients_count: recipients.length,
        failed_count: failed
      });

    return NextResponse.json({
      success: true,
      message: `Attempted ${recipients.length} emails (${recipients.length - failed} succeeded, ${failed} failed)`
    });

  } catch (error) {
    console.error('Error sending bulk emails:', error);
    return NextResponse.json(
      { error: 'Failed to send emails' },
      { status: 500 }
    );
  }
} 