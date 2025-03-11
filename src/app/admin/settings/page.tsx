'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

interface TelebirrSettings {
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
}

export default function AdminSettingsPage() {
  const defaultNotifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/api/telebirr/notify`;
  const defaultRedirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/api/telebirr/return`;

  const [settings, setSettings] = useState<TelebirrSettings>({
    telebirr_number: '',
    telebirr_name: '',
    merchant_app_id: '',
    fabric_app_id: '',
    app_secret: '',
    private_key: '',
    short_code: '',
    notify_url: defaultNotifyUrl,
    redirect_url: defaultRedirectUrl,
    is_active: true
  });
  const [loading, setLoading] = useState(true);
  const [existingSettingsId, setExistingSettingsId] = useState<string | null>(null);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);

      // Only fetch existing settings, don't create new ones
      const { data: existingSettings, error: fetchError } = await supabase
        .from('admin_payment_settings')
        .select('*');

      if (fetchError) throw fetchError;

      // If settings exist, use them
      if (existingSettings && existingSettings.length > 0) {
        setSettings(existingSettings[0]);
        setExistingSettingsId(existingSettings[0].id);
      }

    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let result;

      if (existingSettingsId) {
        // Update existing settings
        result = await supabase
          .from('admin_payment_settings')
          .update({
            telebirr_number: settings.telebirr_number,
            telebirr_name: settings.telebirr_name,
            merchant_app_id: settings.merchant_app_id,
            fabric_app_id: settings.fabric_app_id,
            app_secret: settings.app_secret,
            private_key: settings.private_key,
            short_code: settings.short_code,
            notify_url: settings.notify_url,
            redirect_url: settings.redirect_url,
            is_active: settings.is_active
          })
          .eq('id', existingSettingsId);
      } else {
        // Create new settings
        result = await supabase
          .from('admin_payment_settings')
          .insert({
            telebirr_number: settings.telebirr_number,
            telebirr_name: settings.telebirr_name,
            merchant_app_id: settings.merchant_app_id,
            fabric_app_id: settings.fabric_app_id,
            app_secret: settings.app_secret,
            private_key: settings.private_key,
            short_code: settings.short_code,
            notify_url: settings.notify_url,
            redirect_url: settings.redirect_url,
            is_active: settings.is_active
          })
          .select();

        if (result.data?.[0]) {
          setExistingSettingsId(result.data[0].id);
        }
      }

      if (result.error) throw result.error;
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-6">Admin Payment Settings</h1>
      
      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
        <div className="space-y-6">
          {/* Basic Info Section */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Telebirr Number
                </label>
                <input
                  type="text"
                  required
                  value={settings.telebirr_number}
                  onChange={(e) => setSettings({ ...settings, telebirr_number: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Enter your Telebirr number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Telebirr Account Name
                </label>
                <input
                  type="text"
                  required
                  value={settings.telebirr_name}
                  onChange={(e) => setSettings({ ...settings, telebirr_name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Enter your Telebirr account name"
                />
              </div>
            </div>
          </div>

          {/* API Credentials Section */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">API Credentials</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Merchant App ID
                </label>
                <input
                  type="text"
                  required
                  value={settings.merchant_app_id}
                  onChange={(e) => setSettings({ ...settings, merchant_app_id: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Enter your merchant application ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fabric App ID
                </label>
                <input
                  type="text"
                  required
                  value={settings.fabric_app_id}
                  onChange={(e) => setSettings({ ...settings, fabric_app_id: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Enter your fabric application ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  App Secret
                </label>
                <input
                  type="password"
                  required
                  value={settings.app_secret}
                  onChange={(e) => setSettings({ ...settings, app_secret: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Enter your application secret"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Private Key
                </label>
                <textarea
                  required
                  value={settings.private_key}
                  onChange={(e) => setSettings({ ...settings, private_key: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Enter your private key"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Short Code
                </label>
                <input
                  type="text"
                  required
                  value={settings.short_code}
                  onChange={(e) => setSettings({ ...settings, short_code: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Enter your short code"
                />
              </div>
            </div>
          </div>

          {/* Callback URLs Section */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Callback URLs</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notify URL
                </label>
                <input
                  type="text"
                  required
                  value={settings.notify_url}
                  onChange={(e) => setSettings({ ...settings, notify_url: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-50"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Redirect URL
                </label>
                <input
                  type="text"
                  required
                  value={settings.redirect_url}
                  onChange={(e) => setSettings({ ...settings, redirect_url: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-50"
                  readOnly
                />
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={settings.is_active}
              onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
              Enable Telebirr Payments
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
} 