'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useRouter } from 'next/navigation';

interface AdminSettings {
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
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings>({
    telebirr_number: '',
    telebirr_name: '',
    merchant_app_id: '',
    fabric_app_id: '',
    app_secret: '',
    private_key: '',
    short_code: '',
    notify_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/telebirr/notify`,
    redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/telebirr/return`,
    is_active: true
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    checkAdminAndLoadSettings();
  }, []);

  const checkAdminAndLoadSettings = async () => {
    try {
      setLoading(true);
      
      // Check if user is admin
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (user?.role !== 'admin') {
        router.push('/');
        return;
      }

      // Load existing settings
      const { data: existingSettings } = await supabase
        .from('admin_payment_settings')
        .select('*')
        .single();

      if (existingSettings) {
        setSettings(existingSettings);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);

      const { data, error } = await supabase
        .from('admin_payment_settings')
        .upsert({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-8">Admin Payment Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-8 divide-y divide-gray-200">
        {/* Telebirr Account Details */}
        <div className="space-y-6 pt-8">
          <h2 className="text-xl font-semibold">Telebirr Account Details</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Telebirr Number
              </label>
              <input
                type="text"
                required
                value={settings.telebirr_number}
                onChange={(e) => setSettings({ ...settings, telebirr_number: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Account Name
              </label>
              <input
                type="text"
                required
                value={settings.telebirr_name}
                onChange={(e) => setSettings({ ...settings, telebirr_name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* API Credentials */}
        <div className="space-y-6 pt-8">
          <h2 className="text-xl font-semibold">API Credentials</h2>
          
          <div className="grid grid-cols-1 gap-6">
            {/* Add all API credential fields */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Merchant App ID
                </label>
                <input
                  type="text"
                  required
                  value={settings.merchant_app_id}
                  onChange={(e) => setSettings({ ...settings, merchant_app_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="pt-8">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={settings.is_active}
              onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Enable Telebirr Payments
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-8">
          <button
            type="submit"
            disabled={saving}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
} 