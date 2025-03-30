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

// Define interfaces for each payment method
interface TelebirrSettings {
  is_active: boolean;
  short_code?: string;
  merchant_app_id?: string;
  fabric_app_id?: string;
  app_secret?: string;
  private_key?: string;
  notify_url?: string;
  redirect_url?: string;
}

interface BankSettings {
  is_active: boolean;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  branch?: string;
  address?: string;
  mobile_number?: string;
  contact_email?: string;
  contact_phone?: string;
}

interface CBEBirrSettings {
  is_active: boolean;
  merchant_id?: string;
  api_key?: string;
  notify_url?: string;
}

interface AmoleSettings {
  is_active: boolean;
  merchant_id?: string;
  api_key?: string;
  notify_url?: string;
  account_name?: string;
  account_number?: string;
  transfer_type?: 'within_dashen' | 'other_banks';
  reference_prefix?: string;
}

interface ChapaSettings {
  is_active: boolean;
  public_key?: string;
  secret_key?: string;
  callback_url?: string;
}

interface PaymentSettings {
  id?: string;
  user_id?: string;
  telebirr_settings: TelebirrSettings;
  bank_settings: BankSettings;
  cbe_birr_settings: CBEBirrSettings;
  amole_settings: AmoleSettings;
  chapa_settings: ChapaSettings;
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

const getBaseUrl = () => {
  // In development, use localhost, in production use AVRIO domain
  return process.env.NODE_ENV === 'production' 
    ? 'https://www.avrioxshop.com'
    : 'https://www.avrioxshop.com';
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const testUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors' // Since we're testing cross-origin URLs
    });
    return true;
  } catch {
    return false;
  }
};

const validateUrlPath = (url: string, expectedPath: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname === expectedPath;
  } catch {
    return false;
  }
};

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
  const baseUrl = getBaseUrl();
  const defaultNotifyUrl = `${baseUrl}/api/telebirr/notify`;
  const defaultRedirectUrl = `${baseUrl}/payment/complete`;

  return (
    <div className="space-y-6 p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">Telebirr Settings</h3>
          <div className="flex items-center">
        <input
          type="checkbox"
              id="telebirr-checkbox"
              checked={settings.is_active}
              onChange={(e) => {
                onChange({
                  ...settings,
                  is_active: e.target.checked,
                  notify_url: e.target.checked ? defaultNotifyUrl : settings.notify_url,
                  redirect_url: e.target.checked ? defaultRedirectUrl : settings.redirect_url
                });
              }}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="telebirr-checkbox" className="ml-2 text-sm text-gray-700">
              Enable Telebirr
            </label>
          </div>
        </div>
        <Switch
          id="telebirr-active"
          checked={settings.is_active}
          onCheckedChange={(checked: boolean) => {
            onChange({
              ...settings,
              is_active: checked,
              notify_url: checked ? defaultNotifyUrl : settings.notify_url,
              redirect_url: checked ? defaultRedirectUrl : settings.redirect_url
            });
          }}
          className="bg-gray-200 data-[state=checked]:bg-indigo-600"
        />
      </div>

      {settings.is_active && (
        <>
          <ExampleCredentials />
          
          <div className="grid grid-cols-1 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Short Code</label>
              <input
                type="text"
                value={settings.short_code || ''}
                onChange={(e) => onChange({ ...settings, short_code: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Enter your Telebirr short code"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Merchant App ID</label>
              <input
                type="text"
                value={settings.merchant_app_id || ''}
                onChange={(e) => onChange({ ...settings, merchant_app_id: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Enter your merchant application ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Fabric App ID</label>
              <input
                type="text"
                value={settings.fabric_app_id || ''}
                onChange={(e) => onChange({ ...settings, fabric_app_id: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Enter your fabric application ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">App Secret</label>
              <input
                type="password"
                value={settings.app_secret || ''}
                onChange={(e) => onChange({ ...settings, app_secret: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Enter your application secret"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Private Key</label>
              <textarea
                value={settings.private_key || ''}
                onChange={(e) => onChange({ ...settings, private_key: e.target.value })}
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                placeholder="Enter your RSA private key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Notify URL</label>
              <input
                type="url"
                value={settings.notify_url || defaultNotifyUrl}
                onChange={(e) => onChange({ ...settings, notify_url: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder={defaultNotifyUrl}
                readOnly // Make it read-only since we're using default
              />
              <p className="mt-1 text-sm text-gray-500">Default notify URL (cannot be changed)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Redirect URL</label>
              <input
                type="url"
                value={settings.redirect_url || defaultRedirectUrl}
                onChange={(e) => onChange({ ...settings, redirect_url: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder={defaultRedirectUrl}
                readOnly // Make it read-only since we're using default
              />
              <p className="mt-1 text-sm text-gray-500">Default redirect URL (cannot be changed)</p>
            </div>
          </div>
        </>
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
          <h3 className="text-lg font-medium text-gray-900">CBE Account Settings</h3>
      <div className="flex items-center">
        <input
          type="checkbox"
              id="cbe-checkbox"
              checked={settings.is_active}
              onChange={(e) => onChange({ ...settings, is_active: e.target.checked })}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="cbe-checkbox" className="ml-2 text-sm text-gray-700">
              Enable CBE Account
            </label>
          </div>
        </div>
        <Switch
          id="cbe-active"
          checked={settings.is_active}
          onCheckedChange={(checked: boolean) => {
            onChange({ ...settings, is_active: checked });
          }}
          className="bg-gray-200 data-[state=checked]:bg-indigo-600"
        />
      </div>

      {settings.is_active && (
        <>
          {/* Recipient Information */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">Recipient Information</h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="account-holder" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  id="account-holder"
                  placeholder="Account Holder's Full Name"
                  value={settings.account_holder || ''}
                  onChange={(e) => onChange({ ...settings, account_holder: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Must match the name registered with CBE</p>
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  type="text"
                  id="address"
                  placeholder="City/Location"
                  value={settings.address || ''}
                  onChange={(e) => onChange({ ...settings, address: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Bank Account Details */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">Bank Account Details</h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="branch-name" className="block text-sm font-medium text-gray-700">
                  Branch Name
                </label>
          <input
            type="text"
                  id="branch-name"
                  placeholder="CBE Branch Name"
            value={settings.bank_name || ''}
            onChange={(e) => onChange({ ...settings, bank_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="branch-code" className="block text-sm font-medium text-gray-700">
                  Branch Code
                </label>
                <input
                  type="text"
                  id="branch-code"
                  placeholder="CBE Branch Code"
                  value={settings.branch || ''}
                  onChange={(e) => onChange({ ...settings, branch: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="account-number" className="block text-sm font-medium text-gray-700">
                  Account Number
                </label>
                <input
                  type="text"
                  id="account-number"
                  placeholder="CBE Account Number"
                  value={settings.account_number || ''}
                  onChange={(e) => onChange({ ...settings, account_number: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="mobile-number" className="block text-sm font-medium text-gray-700">
                  CBE Birr Mobile Number
                </label>
                <input
                  type="tel"
                  id="mobile-number"
                  placeholder="Mobile Number for CBE Birr"
                  value={settings.mobile_number || ''}
                  onChange={(e) => onChange({ ...settings, mobile_number: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Number registered with CBE Birr</p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">Contact Information</h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  id="contact-email"
                  placeholder="Email for updates"
                  value={settings.contact_email || ''}
                  onChange={(e) => onChange({ ...settings, contact_email: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

        <div>
                <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="contact-phone"
                  placeholder="Phone number for updates"
                  value={settings.contact_phone || ''}
                  onChange={(e) => onChange({ ...settings, contact_phone: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Add AmoleSettings component
const AmoleSettings = ({ settings, onChange }: {
  settings: AmoleSettings;
  onChange: (settings: AmoleSettings) => void;
}) => {
  const baseUrl = getBaseUrl();
  const defaultNotifyUrl = `${baseUrl}/api/amole/notify`;

  return (
    <div className="space-y-6 p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">Amole Settings</h3>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="amole-checkbox"
              checked={settings.is_active}
              onChange={(e) => onChange({ ...settings, is_active: e.target.checked })}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="amole-checkbox" className="ml-2 text-sm text-gray-700">
              Enable Amole Payments
            </label>
          </div>
        </div>
        <Switch
          id="amole-active"
          checked={settings.is_active}
          onCheckedChange={(checked: boolean) => {
            onChange({ ...settings, is_active: checked });
          }}
          className="bg-gray-200 data-[state=checked]:bg-indigo-600"
        />
      </div>

      {settings.is_active && (
        <>
          {/* Account Information */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">Dashen Bank Account Information</h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="account-name" className="block text-sm font-medium text-gray-700">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  id="account-name"
                  value={settings.account_name || ''}
                  onChange={(e) => onChange({ ...settings, account_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Full name as registered with Dashen Bank"
                />
              </div>

              <div>
                <label htmlFor="account-number" className="block text-sm font-medium text-gray-700">
                  Account Number
                </label>
          <input
            type="text"
                  id="account-number"
            value={settings.account_number || ''}
            onChange={(e) => onChange({ ...settings, account_number: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Dashen Bank Account Number"
                />
              </div>
            </div>
          </div>

          {/* Amole API Credentials */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">Amole API Credentials</h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="merchant-id" className="block text-sm font-medium text-gray-700">
                  Merchant ID
                </label>
          <input
            type="text"
                  id="merchant-id"
                  value={settings.merchant_id || ''}
                  onChange={(e) => onChange({ ...settings, merchant_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Your Amole Merchant ID"
                />
            </div>

              <div>
                <label htmlFor="api-key" className="block text-sm font-medium text-gray-700">
                  API Key
                </label>
                <input
                  type="password"
                  id="api-key"
                  value={settings.api_key || ''}
                  onChange={(e) => onChange({ ...settings, api_key: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Your Amole API Key"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="notify-url" className="block text-sm font-medium text-gray-700">
                  Notification URL
                </label>
                <input
                  type="url"
                  id="notify-url"
                  value={settings.notify_url || defaultNotifyUrl}
                  onChange={(e) => onChange({ ...settings, notify_url: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder={defaultNotifyUrl}
                  readOnly // Make it read-only since we're using default
                />
                <p className="mt-1 text-xs text-gray-500">
                  URL where Amole will send payment notifications
              </p>
            </div>
          </div>
        </div>

          {/* Additional Settings */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">Additional Settings</h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="transfer-type" className="block text-sm font-medium text-gray-700">
                  Default Transfer Type
                </label>
                <select
                  id="transfer-type"
                  value={settings.transfer_type || 'within_dashen'}
                  onChange={(e) => onChange({ 
                    ...settings, 
                    transfer_type: e.target.value as 'within_dashen' | 'other_banks' 
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="within_dashen">Within Dashen Bank</option>
                  <option value="other_banks">Other Banks</option>
                </select>
              </div>

              <div>
                <label htmlFor="reference-prefix" className="block text-sm font-medium text-gray-700">
                  Reference Prefix
                </label>
          <input
            type="text"
                  id="reference-prefix"
                  value={settings.reference_prefix || ''}
                  onChange={(e) => onChange({ ...settings, reference_prefix: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Optional prefix for transfer references"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const PaymentSettingsPage = () => {
  const [activeTab, setActiveTab] = useState('telebirr');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PaymentSettings>({
    telebirr_settings: { is_active: false },
    bank_settings: { is_active: false },
    cbe_birr_settings: { is_active: false },
    amole_settings: { is_active: false },
    chapa_settings: { is_active: false, public_key: '', secret_key: '', callback_url: '' }
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
            telebirr_settings: { is_active: false },
            bank_settings: { is_active: false },
            cbe_birr_settings: { is_active: false },
            amole_settings: { is_active: false },
            chapa_settings: { is_active: false, public_key: '', secret_key: '', callback_url: '' }
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
          ...settings,
          user_id: session.user.id,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    }
  };

  const testChapaConnection = async () => {
    try {
      const response = await fetch('/api/test-chapa-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_key: settings.chapa_settings.public_key,
          secret_key: settings.chapa_settings.secret_key,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to connect to Chapa');
      }

      toast.success('Successfully connected to Chapa!');
    } catch (error) {
      toast.error('Failed to connect to Chapa. Please check your credentials.');
      console.error('Chapa connection error:', error);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

    return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Payment Settings</h1>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-100 p-1 rounded-lg">
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
        </TabsList>

        <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200">
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
            <div className="mt-8 bg-white rounded-lg shadow">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    Chapa Payment Settings
                  </h3>
                  <Switch
                    id="chapa-active"
                    checked={settings.chapa_settings.is_active}
                    onCheckedChange={(checked: boolean) => {
                      setSettings(prev => ({
                        ...prev,
                        chapa_settings: { ...prev.chapa_settings, is_active: checked }
                      }));
                    }}
                  />
                </div>

                {settings.chapa_settings.is_active && (
                  <div className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="chapa-public-key" className="block text-sm font-medium text-gray-700">
                          Public Key
                  </label>
                        <input
                          type="text"
                          id="chapa-public-key"
                          value={settings.chapa_settings.public_key || ''}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            chapa_settings: { ...prev.chapa_settings, public_key: e.target.value }
                          }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                          placeholder="CHAPUBK_TEST-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                          Your Chapa public key from the dashboard
                  </p>
                </div>

                    <div>
                        <label htmlFor="chapa-secret-key" className="block text-sm font-medium text-gray-700">
                          Secret Key
                      </label>
                          <input
                          type="password"
                          id="chapa-secret-key"
                          value={settings.chapa_settings.secret_key || ''}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            chapa_settings: { ...prev.chapa_settings, secret_key: e.target.value }
                          }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                          placeholder="CHASECK_TEST-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                        />
                        <p className="mt-2 text-sm text-gray-500">
                          Your Chapa secret key (keep this secure)
                      </p>
                    </div>

                      <div className="sm:col-span-2">
                        <label htmlFor="chapa-callback-url" className="block text-sm font-medium text-gray-700">
                          Callback URL
                      </label>
                          <input
                          type="url"
                          id="chapa-callback-url"
                          value={settings.chapa_settings.callback_url || ''}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            chapa_settings: { ...prev.chapa_settings, callback_url: e.target.value }
                          }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                          placeholder="https://your-domain.com/api/chapa/webhook"
                        />
                        <p className="mt-2 text-sm text-gray-500">
                          The URL where Chapa will send payment notifications
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                          <button
                            type="button"
                        onClick={testChapaConnection}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Test Connection
                          </button>
                        </div>
                  </div>
                          )}
                        </div>
                      </div>
          </TabsContent>
                    </div>
      </Tabs>

      <div className="mt-6 flex justify-end">
            <button
          onClick={handleSave}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
          Save Settings
            </button>
          </div>
    </main>
  );
};

export default PaymentSettingsPage; 