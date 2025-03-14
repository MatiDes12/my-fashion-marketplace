'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
      const { error } = await supabase
        .from('admin_payment_settings')
        .upsert(paymentSettings);

      if (error) throw error;
      toast.success('Payment settings updated successfully');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Settings</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="payment">Payment Settings</TabsTrigger>
          <TabsTrigger value="general">General Settings</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="payment">
          <form onSubmit={handlePaymentSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  App Secret
                </label>
                <input
                  type="password"
                  value={paymentSettings.app_secret}
                  onChange={(e) => setPaymentSettings({...paymentSettings, app_secret: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
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

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Private Key
                </label>
                <textarea
                  value={paymentSettings.private_key}
                  onChange={(e) => setPaymentSettings({...paymentSettings, private_key: e.target.value})}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>

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
                type="submit"
                className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Save Settings
              </button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="general">
          {/* Add general settings form here */}
        </TabsContent>

        <TabsContent value="notifications">
          {/* Add notification settings form here */}
        </TabsContent>
      </Tabs>
    </div>
  );
} 