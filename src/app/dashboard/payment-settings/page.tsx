'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { config } from '@/config/env';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { normalizeUrl } from '@/utils/url';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { EXCHANGE_RATES } from '@/utils/currency';

// Define interfaces for each payment method
interface TelebirrSettings {
  is_active: boolean;
  account_number?: string;
  phone_number?: string;
  notify_url?: string;
  redirect_url?: string;
}

interface BankSettings {
  is_active: boolean;
  account_number?: string;
  phone_number?: string;
  bank_name?: string;
}

interface CBEBirrSettings {
  is_active: boolean;
  account_number?: string;
  phone_number?: string;
}

interface AmoleSettings {
  is_active: boolean;
  account_number?: string;
  phone_number?: string;
}

interface ChapaSettings {
  is_active: boolean;
  account_number?: string;
  phone_number?: string;
}

interface MpesaSettings {
  is_active: boolean;
  account_number?: string;
  phone_number?: string;
}

interface StripeSettings {
  is_active: boolean;
  account_id?: string;
  email?: string;
}

interface PaymentSettings {
  id?: string;
  user_id?: string;
  telebirr_settings: TelebirrSettings;
  bank_settings: BankSettings;
  cbe_birr_settings: CBEBirrSettings;
  amole_settings: AmoleSettings;
  chapa_settings: ChapaSettings;
  mpesa_settings: MpesaSettings;
  stripe_settings: StripeSettings;
}

type ToastType = 'success' | 'error' | 'loading' | 'blank' | 'custom';

interface SettingsFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: 'text' | 'textarea';
  placeholder?: string;
  helpText?: string;
}

const validatePrivateKey = (key: string): boolean => {
  return key.includes('BEGIN PRIVATE KEY') && key.includes('END PRIVATE KEY');
};

const validateUrls = (settings: TelebirrSettings): string[] => {
  const errors: string[] = [];
  try {
    new URL(settings.notify_url || '');
    new URL(settings.redirect_url || '');
  } catch {
    errors.push('Invalid URL format');
  }
  return errors;
};

const formatKeyForStorage = (key: string): string => {
  return key.trim().replace(/\\n/g, '\n');
};

const SettingsField = ({ 
  id, 
  label, 
  value, 
  onChange, 
  type = 'text',
  placeholder = '',
  helpText = ''
}: SettingsFieldProps) => (
  <div className="col-span-6 sm:col-span-4">
    <label htmlFor={id} className="block text-sm font-medium text-gray-700">
      {label}
    </label>
    {type === 'textarea' ? (
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        rows={4}
        className="mt-1 focus:ring-green-500 focus:border-green-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
        placeholder={placeholder}
      />
    ) : (
      <input
        type={type}
        id={id}
        value={value}
        onChange={onChange}
        className="mt-1 focus:ring-green-500 focus:border-green-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
        placeholder={placeholder}
      />
    )}
    {helpText && (
      <p className="mt-2 text-sm text-gray-500">{helpText}</p>
    )}
  </div>
);

// Add this helper component to show example values
const ExampleCredentials = () => (
  <div className="col-span-6">
    <div className="rounded-md bg-yellow-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Example Credentials Format
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p className="mb-1">
              <strong>Short Code:</strong>
              <code className="ml-2 p-1 bg-yellow-100 rounded">235601</code>
              <span className="ml-2 text-xs">(Your merchant short code from Telebirr)</span>
            </p>
            <p className="mb-1">
              <strong>Merchant App ID:</strong>
              <code className="ml-2 p-1 bg-yellow-100 rounded">1384483114342406</code>
              <span className="ml-2 text-xs">(Your merchant application ID)</span>
            </p>
            <p className="mb-1">
              <strong>Fabric App ID:</strong>
              <code className="ml-2 p-1 bg-yellow-100 rounded">c4182ef8-9249-458a-985e-06d191f4d505</code>
              <span className="ml-2 text-xs">(Your fabric application ID)</span>
            </p>
            <p>
              <strong>App Secret:</strong>
              <code className="ml-2 p-1 bg-yellow-100 rounded">fad0f06383c6297f545876694b974599</code>
              <span className="ml-2 text-xs">(Your application secret)</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Payment method components
const TelebirrSettings = ({ settings, onChange }: { 
  settings: TelebirrSettings; 
  onChange: (settings: TelebirrSettings) => void;
}) => {
  return (
    <div className="space-y-6 p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">Telebirr Settings</h3>
          <div className="flex items-center">
        <Switch
          id="telebirr-active"
          checked={settings.is_active}
          onCheckedChange={(checked: boolean) => {
            onChange({
              ...settings,
                  is_active: checked
            });
          }}
          className="bg-gray-200 data-[state=checked]:bg-indigo-600"
        />
            <label htmlFor="telebirr-active" className="ml-2 text-sm text-gray-700">
              Enable Telebirr
            </label>
          </div>
        </div>
      </div>

      {settings.is_active && (
          <div className="grid grid-cols-1 gap-6 mt-4">
            <div>
            <label className="block text-sm font-medium text-gray-700">Account Number</label>
              <input
                type="text"
              value={settings.account_number || ''}
              onChange={(e) => onChange({ ...settings, account_number: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your Telebirr account number"
              />
            </div>

            <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
              type="tel"
              value={settings.phone_number || ''}
              onChange={(e) => onChange({ ...settings, phone_number: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your Telebirr phone number"
              />
            </div>
            </div>
      )}
    </div>
  );
};

const CBESettings = ({ settings, onChange }: {
  settings: BankSettings;
  onChange: (settings: BankSettings) => void;
}) => {
  return (
    <div className="space-y-6 p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">CBE Bank Settings</h3>
      <div className="flex items-center">
        <Switch
          id="cbe-active"
          checked={settings.is_active}
          onCheckedChange={(checked: boolean) => {
                onChange({
                  ...settings,
                  is_active: checked
                });
          }}
          className="bg-gray-200 data-[state=checked]:bg-indigo-600"
        />
            <label htmlFor="cbe-active" className="ml-2 text-sm text-gray-700">
              Enable CBE Bank
                </label>
              </div>
            </div>
          </div>

      {settings.is_active && (
        <div className="grid grid-cols-1 gap-6 mt-4">
              <div>
            <label className="block text-sm font-medium text-gray-700">Bank Name</label>
          <input
            type="text"
            value={settings.bank_name || ''}
            onChange={(e) => onChange({ ...settings, bank_name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter bank name"
                />
              </div>

              <div>
            <label className="block text-sm font-medium text-gray-700">Account Number</label>
                <input
                  type="text"
                  value={settings.account_number || ''}
                  onChange={(e) => onChange({ ...settings, account_number: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your bank account number"
                />
              </div>

              <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
              value={settings.phone_number || ''}
              onChange={(e) => onChange({ ...settings, phone_number: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your phone number"
            />
              </div>
            </div>
      )}
    </div>
  );
};

// Add AmoleSettings component
const AmoleSettings = ({ settings, onChange }: {
  settings: AmoleSettings;
  onChange: (settings: AmoleSettings) => void;
}) => {
  return (
    <div className="space-y-6 p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">Amole Settings</h3>
          <div className="flex items-center">
        <Switch
          id="amole-active"
          checked={settings.is_active}
          onCheckedChange={(checked: boolean) => {
                onChange({
                  ...settings,
                  is_active: checked
                });
          }}
          className="bg-gray-200 data-[state=checked]:bg-indigo-600"
        />
            <label htmlFor="amole-active" className="ml-2 text-sm text-gray-700">
              Enable Amole
            </label>
          </div>
        </div>
      </div>

      {settings.is_active && (
        <div className="grid grid-cols-1 gap-6 mt-4">
              <div>
            <label className="block text-sm font-medium text-gray-700">Account Number</label>
                <input
                  type="text"
            value={settings.account_number || ''}
            onChange={(e) => onChange({ ...settings, account_number: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your Amole account number"
                />
          </div>

              <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
          <input
              type="tel"
              value={settings.phone_number || ''}
              onChange={(e) => onChange({ ...settings, phone_number: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your Amole phone number"
                />
            </div>
              </div>
      )}
    </div>
  );
};

// Add M-PESA settings component
const MpesaSettings = ({ 
  settings,
  onChange
}: { 
  settings: MpesaSettings;
  onChange: (mpesa_settings: MpesaSettings) => void;
}) => {
  return (
    <div className="space-y-6 p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">M-PESA Settings</h3>
          <div className="flex items-center">
          <Switch
            id="mpesa-active"
            checked={settings.is_active}
            onCheckedChange={(checked: boolean) => {
                onChange({
                  ...settings,
                  is_active: checked
                });
            }}
              className="bg-gray-200 data-[state=checked]:bg-indigo-600"
          />
            <label htmlFor="mpesa-active" className="ml-2 text-sm text-gray-700">
              Enable M-PESA
            </label>
          </div>
        </div>
        </div>

        {settings.is_active && (
        <div className="grid grid-cols-1 gap-6 mt-4">
              <div>
            <label className="block text-sm font-medium text-gray-700">Account Number</label>
                <input
                  type="text"
              value={settings.account_number || ''}
              onChange={(e) => onChange({ ...settings, account_number: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your M-PESA account number"
                />
              </div>

              <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                <input
              type="tel"
              value={settings.phone_number || ''}
              onChange={(e) => onChange({ ...settings, phone_number: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your M-PESA phone number"
                />
              </div>
              </div>
      )}
              </div>
  );
};

// Add Stripe settings component
const StripeSettings = ({ 
  settings,
  onChange
}: { 
  settings: StripeSettings;
  onChange: (stripe_settings: StripeSettings) => void;
}) => {
  return (
    <div className="space-y-6 p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">Stripe Settings</h3>
          <div className="flex items-center">
            <Switch
              id="stripe-active"
              checked={settings.is_active}
              onCheckedChange={(checked: boolean) => {
                onChange({
                  ...settings,
                  is_active: checked
                });
              }}
              className="bg-gray-200 data-[state=checked]:bg-indigo-600"
            />
            <label htmlFor="stripe-active" className="ml-2 text-sm text-gray-700">
              Enable Stripe Payments
            </label>
          </div>
        </div>
      </div>

      {settings.is_active && (
        <div className="grid grid-cols-1 gap-6 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Stripe Connect Required
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>To receive payments via Stripe, you need to connect your Stripe account. 
                  This allows us to process international credit card payments in USD and transfer 
                  funds directly to your bank account.</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Stripe Account ID</label>
            <input
              type="text"
              value={settings.account_id || ''}
              onChange={(e) => onChange({ ...settings, account_id: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="acct_xxxxxxxxxxxxxxxx (Connect your Stripe account)"
              readOnly
            />
            <p className="mt-1 text-sm text-gray-500">
              This will be automatically filled when you connect your Stripe account.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              value={settings.email || ''}
              onChange={(e) => onChange({ ...settings, email: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your email for Stripe account"
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Currency Conversion
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Prices will be automatically converted from ETB to USD for international customers. 
                  Current rate: 1 ETB ≈ ${EXCHANGE_RATES.ETB_TO_USD} USD</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={() => {
                // TODO: Implement Stripe Connect onboarding
                toast.error('Stripe Connect integration coming soon!');
              }}
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Connect Stripe Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PaymentMethodCard = ({ 
  title, 
  description, 
  icon, 
  isActive, 
  onClick 
}: { 
  title: string;
  description: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
    className={`relative rounded-lg border-2 p-6 cursor-pointer transition-all duration-200 ${
      isActive 
        ? 'border-green-500 bg-green-50' 
        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
    }`}
  >
    <div className="flex items-start gap-4">
      <div className={`p-3 rounded-full ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
        {icon}
              </div>
      <div className="flex-1">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
              </div>
      <div className={`h-5 w-5 rounded-full border-2 ${
        isActive 
          ? 'border-green-500 bg-green-500' 
          : 'border-gray-300'
      }`}>
        {isActive && (
          <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
              </div>
            </div>
    {isActive && (
      <div className="absolute -top-2 -right-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-800 text-xs font-medium">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
          </div>
        )}
    </div>
  );

const PaymentSettingsPage = () => {
  const [activeTab, setActiveTab] = useState('telebirr');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PaymentSettings>({
    telebirr_settings: {
      is_active: false,
      account_number: '',
      phone_number: ''
    },
    bank_settings: {
      is_active: false,
      account_number: '',
      phone_number: '',
      bank_name: ''
    },
    cbe_birr_settings: { 
      is_active: false,
      account_number: '',
      phone_number: ''
    },
    amole_settings: { 
      is_active: false,
      account_number: '',
      phone_number: ''
    },
    chapa_settings: { 
      is_active: false,
      account_number: '',
      phone_number: ''
    },
    mpesa_settings: { 
      is_active: false,
      account_number: '',
      phone_number: ''
    },
    stripe_settings: { 
      is_active: false,
      account_id: '',
      email: ''
    }
  });

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authenticated user');
      }

      // Try to get existing settings
      const { data, error } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings exist yet, create default settings
          const defaultSettings = {
            user_id: session.user.id,
            telebirr_settings: { 
              is_active: false,
              account_number: '',
              phone_number: '',
              notify_url: '',
              redirect_url: ''
            },
            bank_settings: { 
              is_active: false,
              account_number: '',
              phone_number: '',
              bank_name: ''
            },
            cbe_birr_settings: { 
              is_active: false,
              account_number: '',
              phone_number: ''
            },
            amole_settings: { 
              is_active: false,
              account_number: '',
              phone_number: ''
            },
            chapa_settings: { 
              is_active: false,
              account_number: '',
              phone_number: ''
            },
            mpesa_settings: { 
              is_active: false,
              account_number: '',
              phone_number: ''
            },
            stripe_settings: { 
              is_active: false,
              account_id: '',
              email: ''
            }
          };

          // Use upsert instead of insert to handle potential race conditions
          const { error: upsertError } = await supabase
            .from('payment_settings')
            .upsert(defaultSettings, {
              onConflict: 'user_id',
              ignoreDuplicates: false
            });

          if (upsertError) throw upsertError;

          // Fetch the settings again to ensure we have the latest data
          const { data: freshData, error: freshError } = await supabase
            .from('payment_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

          if (freshError) throw freshError;
          setSettings(freshData || defaultSettings);
        } else {
          throw error;
        }
      } else if (data) {
        setSettings(data);
      }
      } catch (error) {
      console.error('Error fetching settings:', error);
      setError(error instanceof Error ? error.message : 'Failed to load settings');
      } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authenticated user');
      }

      const { error } = await supabase
        .from('payment_settings')
        .upsert({
          user_id: session.user.id,
          ...settings
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (error) throw error;
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };


  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

    return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Configure your payment methods to start accepting payments from customers.
          </p>
        </div>

        {/* Payment Methods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <PaymentMethodCard
            title="Telebirr"
            description="Accept payments via Telebirr mobile money"
            icon={
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            isActive={activeTab === 'telebirr'}
            onClick={() => setActiveTab('telebirr')}
          />

          <PaymentMethodCard
            title="CBE Bank"
            description="Accept payments via Commercial Bank of Ethiopia"
            icon={
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            isActive={activeTab === 'cbe'}
            onClick={() => setActiveTab('cbe')}
          />

          <PaymentMethodCard
            title="Amole"
            description="Accept payments via Amole digital wallet"
            icon={
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            isActive={activeTab === 'amole'}
            onClick={() => setActiveTab('amole')}
          />

          <PaymentMethodCard
            title="Chapa"
            description="Accept payments via Chapa payment gateway"
            icon={
              <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            }
            isActive={activeTab === 'chapa'}
            onClick={() => setActiveTab('chapa')}
          />

          <PaymentMethodCard
            title="Stripe"
            description="Accept international credit/debit card payments (USD)"
            icon={
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            }
            isActive={activeTab === 'stripe'}
            onClick={() => setActiveTab('stripe')}
          />
        </div>

        {/* Settings Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="inline-flex p-1 bg-gray-100 rounded-lg mb-6">
          <TabsTrigger 
            value="telebirr" 
            className="px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
          >
            Telebirr
          </TabsTrigger>
          <TabsTrigger 
            value="cbe" 
            className="px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
          >
            CBE Account
          </TabsTrigger>
          <TabsTrigger 
            value="amole" 
            className="px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
          >
            Amole
          </TabsTrigger>
          <TabsTrigger 
            value="chapa" 
            className="px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
          >
            Chapa
          </TabsTrigger>
          <TabsTrigger 
            value="mpesa" 
            className="px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
          >
            M-PESA
          </TabsTrigger>
          <TabsTrigger 
            value="stripe" 
            className="px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
          >
            Stripe
          </TabsTrigger>
        </TabsList>

              <div className="mt-8 space-y-6">
        <TabsContent value="telebirr">
          <TelebirrSettings 
            settings={settings.telebirr_settings}
            onChange={(telebirr_settings) => setSettings({ ...settings, telebirr_settings })}
          />
        </TabsContent>

          <TabsContent value="cbe">
            <CBESettings 
            settings={settings.bank_settings}
            onChange={(bank_settings) => setSettings({ ...settings, bank_settings })}
          />
        </TabsContent>

          <TabsContent value="amole">
            <AmoleSettings 
              settings={settings.amole_settings}
              onChange={(amole_settings) => setSettings({ ...settings, amole_settings })}
            />
          </TabsContent>

          <TabsContent value="chapa">
                  <div className="space-y-6 p-4 bg-white rounded-lg shadow">
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <h3 className="text-lg font-medium text-gray-900">Chapa Settings</h3>
                        <div className="flex items-center">
                  <Switch
                    id="chapa-active"
                    checked={settings.chapa_settings.is_active}
                    onCheckedChange={(checked: boolean) => {
                      setSettings(prev => ({
                        ...prev,
                                chapa_settings: {
                                  ...prev.chapa_settings,
                                  is_active: checked
                                }
                      }));
                    }}
                            className="bg-gray-200 data-[state=checked]:bg-indigo-600"
                  />
                          <label htmlFor="chapa-active" className="ml-2 text-sm text-gray-700">
                            Enable Chapa
                          </label>
                        </div>
                      </div>
                </div>

                {settings.chapa_settings.is_active && (
                      <div className="grid grid-cols-1 gap-6 mt-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Account Number</label>
                        <input
                          type="text"
                            value={settings.chapa_settings.account_number || ''}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                              chapa_settings: {
                                ...prev.chapa_settings,
                                account_number: e.target.value
                              }
                          }))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Enter your Chapa account number"
                  />
                </div>

                    <div>
                          <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                          <input
                            type="tel"
                            value={settings.chapa_settings.phone_number || ''}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                              chapa_settings: {
                                ...prev.chapa_settings,
                                phone_number: e.target.value
                              }
                            }))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Enter your Chapa phone number"
                          />
                        </div>
                  </div>
                          )}
                      </div>
          </TabsContent>

          <TabsContent value="mpesa">
            <MpesaSettings 
              settings={settings.mpesa_settings}
              onChange={(mpesa_settings) => setSettings({ ...settings, mpesa_settings })}
            />
          </TabsContent>

          <TabsContent value="stripe">
            <StripeSettings 
              settings={settings.stripe_settings}
              onChange={(stripe_settings) => setSettings({ ...settings, stripe_settings })}
            />
          </TabsContent>
        </div>
      </Tabs>
          </div>
        </div>

        {/* Save Button */}
      <div className="mt-6 flex justify-end">
            <button
          onClick={handleSave}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          Save Settings
            </button>
        </div>
          </div>
    </main>
  );
};

export default PaymentSettingsPage; 