import { supabaseServerAnon } from '@/lib/supabase-server';

const supabase = supabaseServerAnon;

interface TelebirrConfig {
  baseUrl: string;
  webBaseUrl: string;
  merchantAppId: string;
  fabricAppId: string;
  appSecret: string;
  privateKey: string;
  shortCode: string;
  notifyUrl: string;
  redirectUrl: string;
  [key: string]: string; // Add index signature
}

export async function getTelebirrConfig() {
  try {
    console.log('Fetching Telebirr settings from Supabase...');
    
    const { data: settings, error } = await supabase
      .from('admin_payment_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error('Failed to fetch payment settings: ' + error.message);
    }

    if (!settings) {
      throw new Error('No active payment settings found');
    }

    console.log('Got settings:', {
      merchantAppId: settings.merchant_app_id,
      fabricAppId: settings.fabric_app_id,
      shortCode: settings.short_code,
    });

    // Add additional validation
    if (!settings.merchant_app_id || settings.merchant_app_id.length < 10) {
      throw new Error('Invalid merchant_app_id');
    }
    if (!settings.fabric_app_id || !settings.fabric_app_id.includes('-')) {
      throw new Error('Invalid fabric_app_id');
    }
    if (!settings.short_code || settings.short_code.length < 6) {
      throw new Error('Invalid short_code');
    }

    const config: TelebirrConfig = {
      // Test environment URLs
      baseUrl: "https://196.188.120.3:38443/apiaccess/payment/gateway",
      webBaseUrl: "https://196.188.120.3:38443/payment/web/paygate",
      merchantAppId: settings.merchant_app_id,
      fabricAppId: settings.fabric_app_id,
      appSecret: settings.app_secret,
      privateKey: settings.private_key,
      shortCode: settings.short_code,
      notifyUrl: settings.notify_url,
      redirectUrl: settings.redirect_url,
    };

    // Validate required fields
    const requiredFields = ['merchantAppId', 'fabricAppId', 'appSecret', 'privateKey', 'shortCode'];
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return config;
  } catch (error) {
    console.error('Error in getTelebirrConfig:', error);
    throw error;
  }
} 