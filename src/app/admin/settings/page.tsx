'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/LoadingSpinner';

interface PaymentSettings {
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
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    telebirr_number: '',
    telebirr_name: '',
    merchant_app_id: '',
    fabric_app_id: '',
    app_secret: '',
    private_key: '',
    short_code: '',
    notify_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/telebirr/notify`,
    redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/complete`,
    is_active: true
  });
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('payment');
  const supabase = createClientComponent();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_payment_settings')
        .select('*')
        .single();

      if (error) throw error;
      if (data) setPaymentSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/telebirr/webhook`;
      const { error } = await supabase
        .from('admin_payment_settings')
        .upsert({
          ...paymentSettings,
          notify_url: webhookUrl
        });

      if (error) throw error;
      toast.success('Payment settings updated successfully');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Admin Settings</h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Tabs defaultValue="payment" className="w-full">
          <div className="border-b border-gray-200">
            <TabsList className="flex -mb-px space-x-8 px-6">
              <TabsTrigger 
                value="payment"
                className="py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap"
              >
                Payment Settings
              </TabsTrigger>
              <TabsTrigger 
                value="general"
                className="py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap"
              >
                General Settings
              </TabsTrigger>
              <TabsTrigger 
                value="notifications"
                className="py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap"
              >
                Notifications
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            <TabsContent value="payment">
              <div className="space-y-6">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Important Note
                      </h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        Make sure to keep your payment credentials secure. These settings directly affect payment processing.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handlePaymentSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                    <div className="space-y-6">
                      <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Telebirr Number
                        </label>
                        <input
                          type="text"
                          value={paymentSettings.telebirr_number}
                          onChange={(e) => setPaymentSettings({...paymentSettings, telebirr_number: e.target.value})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Business Name
                        </label>
                        <input
                          type="text"
                          value={paymentSettings.telebirr_name}
                          onChange={(e) => setPaymentSettings({...paymentSettings, telebirr_name: e.target.value})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-lg font-medium text-gray-900">API Configuration</h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Merchant App ID
                        </label>
                        <input
                          type="text"
                          value={paymentSettings.merchant_app_id}
                          onChange={(e) => setPaymentSettings({...paymentSettings, merchant_app_id: e.target.value})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Fabric App ID
                        </label>
                        <input
                          type="text"
                          value={paymentSettings.fabric_app_id}
                          onChange={(e) => setPaymentSettings({...paymentSettings, fabric_app_id: e.target.value})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          App Secret
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <input
                            type="password"
                            value={paymentSettings.app_secret}
                            onChange={(e) => setPaymentSettings({...paymentSettings, app_secret: e.target.value})}
                            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Short Code
                        </label>
                        <input
                          type="text"
                          value={paymentSettings.short_code}
                          onChange={(e) => setPaymentSettings({...paymentSettings, short_code: e.target.value})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Private Key
                      </label>
                      <textarea
                        value={paymentSettings.private_key}
                        onChange={(e) => setPaymentSettings({...paymentSettings, private_key: e.target.value})}
                        rows={4}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="pt-5 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={paymentSettings.is_active}
                          onChange={(e) => setPaymentSettings({...paymentSettings, is_active: e.target.checked})}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Enable Telebirr Payments
                        </label>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="general">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900">Coming Soon</h3>
                <p className="mt-2 text-sm text-gray-500">General settings will be available in a future update.</p>
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900">Coming Soon</h3>
                <p className="mt-2 text-sm text-gray-500">Notification settings will be available in a future update.</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
} 