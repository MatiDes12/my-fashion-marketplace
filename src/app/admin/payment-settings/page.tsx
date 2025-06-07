'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { config, getTelebirrCallbackUrls } from '@/config/env';

interface PaymentSettings {
  id?: string;
  telebirr_number: string;
  telebirr_name: string;
  merchant_app_id: string;
  fabric_app_id: string;
  app_secret: string;
  private_key: string;
  short_code: string;
  notify_url: string;
  redirect_url: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  subscription_notify_url: string;
  chapa_public_key: string;
  chapa_secret_key: string;
  chapa_callback_url: string;
  chapa_webhook_secret: string;
  chapa_is_active: boolean;
}

export default function AdminPaymentSettingsPage() {
  const callbackUrls = getTelebirrCallbackUrls();
  
  const [settings, setSettings] = useState<PaymentSettings>({
    telebirr_number: '',
    telebirr_name: '',
    merchant_app_id: '',
    fabric_app_id: '',
    app_secret: '',
    private_key: '',
    short_code: '',
    notify_url: callbackUrls.notifyUrl,
    redirect_url: callbackUrls.redirectUrl,
    is_active: true,
    subscription_notify_url: typeof window !== 'undefined'
      ? `${window.location.origin}/api/telebirr/subscription-callback`
      : '/api/telebirr/subscription-callback',
    chapa_public_key: '',
    chapa_secret_key: '',
    chapa_callback_url: typeof window !== 'undefined'
      ? `${window.location.origin}/api/payments/chapa/subscription-callback`
      : '/api/payments/chapa/subscription-callback',
    chapa_webhook_secret: '',
    chapa_is_active: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_payment_settings')
        .select('*')
        .single();

      if (error) throw error;
      if (data) setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const validateUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.toString();
    } catch (e) {
      return false;
    }
  };

  const validateSettings = () => {
    if (!settings.telebirr_number) return 'Telebirr number is required';
    if (!settings.telebirr_name) return 'Telebirr name is required';
    if (!settings.merchant_app_id) return 'Merchant App ID is required';
    if (!settings.fabric_app_id) return 'Fabric App ID is required';
    if (!settings.app_secret) return 'App Secret is required';
    if (!settings.private_key) return 'Private Key is required';
    if (!settings.short_code) return 'Short Code is required';
    if (!settings.notify_url) return 'Notify URL is required';
    if (!settings.redirect_url) return 'Redirect URL is required';
    if (!settings.subscription_notify_url) return 'Subscription Notify URL is required';
    if (!validateUrl(settings.notify_url)) return 'Invalid notify URL';
    if (!validateUrl(settings.redirect_url)) return 'Invalid redirect URL';
    if (!validateUrl(settings.subscription_notify_url)) return 'Invalid subscription notify URL';
    return null;
  };

  const normalizeUrls = (settings: PaymentSettings) => {
    return {
      ...settings,
      notify_url: settings.notify_url.replace(/([^:]\/)\/+/g, "$1"),
      redirect_url: settings.redirect_url.replace(/([^:]\/)\/+/g, "$1"),
      subscription_notify_url: settings.subscription_notify_url.replace(/([^:]\/)\/+/g, "$1")
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateSettings();
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const normalizedSettings = normalizeUrls(settings);
      const { error } = await supabase
        .from('admin_payment_settings')
        .upsert({
          ...normalizedSettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('Settings updated successfully');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8">Payment Gateway Settings</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Telebirr Settings</h2>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.is_active}
                onChange={(e) => setSettings({...settings, is_active: e.target.checked})}
                className="h-4 w-4 text-indigo-600"
              />
              <span className="ml-2">Active</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Telebirr Number</label>
            <input
              type="text"
              value={settings.telebirr_number}
              onChange={(e) => setSettings({...settings, telebirr_number: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
              <label className="block text-sm font-medium text-gray-700">Telebirr Name</label>
            <input
              type="text"
              value={settings.telebirr_name}
              onChange={(e) => setSettings({...settings, telebirr_name: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
              <label className="block text-sm font-medium text-gray-700">Merchant App ID</label>
            <input
              type="text"
              value={settings.merchant_app_id}
              onChange={(e) => setSettings({...settings, merchant_app_id: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
              <label className="block text-sm font-medium text-gray-700">Fabric App ID</label>
            <input
              type="text"
              value={settings.fabric_app_id}
              onChange={(e) => setSettings({...settings, fabric_app_id: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
              <label className="block text-sm font-medium text-gray-700">Short Code</label>
            <input
              type="text"
              value={settings.short_code}
              onChange={(e) => setSettings({...settings, short_code: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">App Secret</label>
            <textarea
              value={settings.app_secret}
              onChange={(e) => setSettings({...settings, app_secret: e.target.value})}
              rows={2}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Private Key</label>
            <textarea
              value={settings.private_key}
              onChange={(e) => setSettings({...settings, private_key: e.target.value})}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Notify URL</label>
            <input
              type="url"
              value={settings.notify_url}
              onChange={(e) => setSettings({...settings, notify_url: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Redirect URL</label>
            <input
              type="url"
              value={settings.redirect_url}
              onChange={(e) => setSettings({...settings, redirect_url: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Subscription Notify URL</label>
              <input
                type="url"
                value={settings.subscription_notify_url}
                onChange={(e) => setSettings({...settings, subscription_notify_url: e.target.value})}
                placeholder="https://yourdomain.com/api/telebirr/subscription-callback"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                URL for subscription payment notifications
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Chapa Settings</h2>
            <label className="flex items-center">
          <input
            type="checkbox"
                checked={settings.chapa_is_active}
                onChange={(e) => setSettings({...settings, chapa_is_active: e.target.checked})}
                className="h-4 w-4 text-indigo-600"
          />
              <span className="ml-2">Active</span>
          </label>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Public Key</label>
              <input
                type="text"
                value={settings.chapa_public_key}
                onChange={(e) => setSettings({...settings, chapa_public_key: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Secret Key</label>
              <input
                type="password"
                value={settings.chapa_secret_key}
                onChange={(e) => setSettings({...settings, chapa_secret_key: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Callback URL</label>
              <input
                type="url"
                value={settings.chapa_callback_url}
                onChange={(e) => setSettings({...settings, chapa_callback_url: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Webhook Secret</label>
              <input
                type="password"
                value={settings.chapa_webhook_secret}
                onChange={(e) => setSettings({...settings, chapa_webhook_secret: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
} 