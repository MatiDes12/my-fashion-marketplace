'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { config } from '@/config/env';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface TelebirrSettings {
  shortCode: string;      // 476204
  merchantAppId: string;  // 1384483114342406
  fabricAppId: string;    // c4182ef8-9249-458a-985e-06d191f4d505
  appSecret: string;      // fad0f06383c6297f545876694b974599
  privateKey: string;     // Your RSA private key
  notifyUrl: string;
  redirectUrl: string;
  isActive: boolean;
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
  return config.siteUrl;
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
    const parsedUrl = new URL(url);
    return parsedUrl.pathname === expectedPath;
  } catch {
    return false;
  }
};

const validatePrivateKey = (key: string): boolean => {
  try {
    // Basic validation for base64 string
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    const cleanKey = key.trim();
    
    // Remove any existing headers/footers
    const keyWithoutHeaders = cleanKey
      .replace(/-----BEGIN.*KEY-----/, '')
      .replace(/-----END.*KEY-----/, '')
      .replace(/[\s\r\n]+/g, '');

    // Check if it's a valid base64 string
    if (!base64Regex.test(keyWithoutHeaders)) {
      return false;
    }

    // Check minimum length (typical RSA keys are at least 1024 bits)
    if (keyWithoutHeaders.length < 128) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

const validateUrls = (settings: TelebirrSettings) => {
  const errors: string[] = [];
  
  // Check if URLs are provided
  if (!settings.notifyUrl) {
    errors.push('Notify URL is required');
  }
  if (!settings.redirectUrl) {
    errors.push('Redirect URL is required');
  }

  // Enhanced URL format validation
  if (settings.notifyUrl) {
    if (!isValidUrl(settings.notifyUrl)) {
      errors.push('Invalid Notify URL format');
    } else {
      // Check if notify URL has the correct path
      if (!validateUrlPath(settings.notifyUrl, '/api/telebirr/notify')) {
        errors.push('Notify URL must end with /api/telebirr/notify');
      }
    }
  }

  if (settings.redirectUrl) {
    if (!isValidUrl(settings.redirectUrl)) {
      errors.push('Invalid Redirect URL format');
    } else {
      // Check if redirect URL has the correct path
      if (!validateUrlPath(settings.redirectUrl, '/payment/complete')) {
        errors.push('Redirect URL must end with /payment/complete');
      }
    }
  }

  // Check if URLs are HTTPS (for production)
  if (process.env.NODE_ENV === 'production') {
    if (settings.notifyUrl && !settings.notifyUrl.startsWith('https://')) {
      errors.push('Notify URL must use HTTPS in production');
    }
    if (settings.redirectUrl && !settings.redirectUrl.startsWith('https://')) {
      errors.push('Redirect URL must use HTTPS in production');
    }
  }

  return errors;
};

const formatKeyForStorage = (key: string): string => {
  // Remove any existing headers/footers and whitespace
  return key
    .replace(/-----BEGIN.*KEY-----/, '')
    .replace(/-----END.*KEY-----/, '')
    .replace(/[\s\r\n]+/g, '');
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

export default function PaymentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<TelebirrSettings>({
    fabricAppId: '',
    appSecret: '',
    merchantAppId: '',
    shortCode: '',
    privateKey: '',
    notifyUrl: `${config.siteUrl}/api/telebirr/notify`,
    redirectUrl: `${config.siteUrl}/payment/complete`,
    isActive: false
  });
  const [isTestingCredentials, setIsTestingCredentials] = useState(false);

  const supabase = createClientComponent();

  const isMockMode = process.env.NEXT_PUBLIC_MOCK_TELEBIRR === 'true';

  useEffect(() => {
    // Check if we have required environment variables
    if (!config.supabase.url || !config.supabase.anonKey) {
      setError('Missing required configuration. Please check your environment variables.');
      setLoading(false);
      return;
    }

    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please login to access payment settings');
      }

      const { data, error } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.telebirr_settings) {
        setSettings({
          shortCode: data.telebirr_settings.short_code || '',
          merchantAppId: data.telebirr_settings.merchant_app_id || '',
          fabricAppId: data.telebirr_settings.fabric_app_id || '',
          appSecret: data.telebirr_settings.app_secret || '',
          privateKey: data.telebirr_settings.private_key || '',
          notifyUrl: data.telebirr_settings.notify_url || `${config.siteUrl}/api/telebirr/notify`,
          redirectUrl: data.telebirr_settings.redirect_url || `${config.siteUrl}/payment/complete`,
          isActive: data.telebirr_settings.is_active || false
        });
      } else {
        // Set default values
        setSettings({
          shortCode: '',
          merchantAppId: '',
          fabricAppId: '',
          appSecret: '',
          privateKey: '',
          notifyUrl: `${config.siteUrl}/api/telebirr/notify`,
          redirectUrl: `${config.siteUrl}/payment/complete`,
          isActive: false
        });
      }
    } catch (err) {
      console.error('Error fetching payment settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please login to save settings');
      }

      // Validate required fields
      if (!settings.shortCode || !settings.merchantAppId || !settings.fabricAppId || !settings.appSecret) {
        throw new Error('All Telebirr credentials are required');
      }

      if (!validatePrivateKey(settings.privateKey)) {
        throw new Error('Invalid private key format');
      }

      // Validate URLs
      const urlErrors = validateUrls(settings);
      if (urlErrors.length > 0) {
        throw new Error(urlErrors.join(', '));
      }

      // First check if settings exist
      const { data: existingSettings } = await supabase
        .from('payment_settings')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      const telebirrSettings = {
        is_active: settings.isActive,
        short_code: settings.shortCode,
        merchant_app_id: settings.merchantAppId,
        fabric_app_id: settings.fabricAppId,
        app_secret: settings.appSecret,
        private_key: formatKeyForStorage(settings.privateKey),
        notify_url: settings.notifyUrl,
        redirect_url: settings.redirectUrl
      };

      let error;
      if (existingSettings) {
        // Update existing settings
        const result = await supabase
          .from('payment_settings')
          .update({
            telebirr_settings: telebirrSettings,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSettings.id);
        error = result.error;
      } else {
        // Insert new settings
        const result = await supabase
          .from('payment_settings')
          .insert({
            user_id: session.user.id,
            telebirr_settings: telebirrSettings
          });
        error = result.error;
      }

      if (error) {
        console.error('Database error:', error);
        throw new Error('Failed to save settings. Please try again.');
      }

      toast.success(
        <div>
          <p>Payment settings saved successfully!</p>
          <Link 
            href="/dashboard/products" 
            className="text-green-600 hover:text-green-500 mt-2 block"
          >
            Add your first product →
          </Link>
        </div>,
        { duration: 5000 }
      );
    } catch (err) {
      console.error('Error saving payment settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUrlChange = (field: 'notifyUrl' | 'redirectUrl', value: string) => {
    setSettings({ ...settings, [field]: value });
    
    if (!value) {
      toast.error(`${field === 'notifyUrl' ? 'Notify' : 'Redirect'} URL is required`);
      return;
    }
    
    if (!isValidUrl(value)) {
      toast.error(`Invalid ${field === 'notifyUrl' ? 'Notify' : 'Redirect'} URL format`);
      return;
    }

    if (process.env.NODE_ENV === 'production' && !value.startsWith('https://')) {
      // Use toast.custom instead of toast.warn
      toast.custom((t) => (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                {`${field === 'notifyUrl' ? 'Notify' : 'Redirect'} URL should use HTTPS in production`}
              </p>
            </div>
          </div>
        </div>
      ));
    }
  };

  const TestUrlButton = ({ url, label }: { url: string; label: string }) => {
    const [testing, setTesting] = useState(false);
    const [lastTestResult, setLastTestResult] = useState<boolean | null>(null);

    const handleTest = async () => {
      setTesting(true);
      try {
        const isAccessible = await testUrl(url);
        setLastTestResult(isAccessible);
        toast[isAccessible ? 'success' : 'error'](
          `${label} ${isAccessible ? 'is accessible' : 'is not accessible'}`
        );
      } catch (error) {
        setLastTestResult(false);
        toast.error(`Failed to test ${label}`);
      } finally {
        setTesting(false);
      }
    };

    return (
      <button
        type="button"
        onClick={handleTest}
        disabled={testing || !isValidUrl(url)}
        className={`inline-flex items-center px-2 py-1 text-xs rounded-md ${
          lastTestResult === null
            ? 'bg-gray-100 text-gray-700'
            : lastTestResult
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        } disabled:opacity-50`}
      >
        {testing ? (
          <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <span>Test {label}</span>
        )}
      </button>
    );
  };

  const testCredentials = async () => {
    try {
      setIsTestingCredentials(true);
      setError(null);

      // First validate that all required fields are present
      if (!settings.shortCode || !settings.merchantAppId || 
          !settings.fabricAppId || !settings.appSecret || !settings.privateKey) {
        throw new Error('All Telebirr credentials are required');
      }

      // Get the base URL from environment variables
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

      // Make the test request
      const response = await fetch(`${baseUrl}/api/telebirr/test-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: {
            short_code: settings.shortCode,
            merchant_app_id: settings.merchantAppId,
            fabric_app_id: settings.fabricAppId,
            app_secret: settings.appSecret,
            private_key: settings.privateKey,
            notify_url: settings.notifyUrl,
            redirect_url: settings.redirectUrl
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate credentials');
      }

      if (data.success) {
        toast.success('Credentials validated successfully!');
      } else {
        throw new Error(data.message || 'Failed to validate credentials');
      }

    } catch (error) {
      console.error('Test credentials error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to test credentials');
      setError(error instanceof Error ? error.message : 'Failed to test credentials');
    } finally {
      setIsTestingCredentials(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {error && <ErrorMessage message={error} />}
      
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Telebirr Payment Settings
            </h1>
            {isMockMode && (
              <Badge variant="warning" className="text-sm">
                Mock Mode
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Configure your Telebirr merchant account to receive payments from customers
          </p>
        </div>

        {isMockMode && (
          <div className="rounded-md bg-blue-50 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Mock Mode Active
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Running in mock mode. No real API calls will be made to Telebirr.
                    This is useful for testing the interface without real credentials.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="md:grid md:grid-cols-3 md:gap-6">
            <div className="md:col-span-1">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Merchant Credentials</h3>
              <p className="mt-1 text-sm text-gray-500">
                Enter your Telebirr merchant account credentials
              </p>
            </div>

            <div className="mt-5 md:mt-0 md:col-span-2">
              <div className="grid grid-cols-6 gap-6">
                <ExampleCredentials />
                
                <SettingsField
                  id="shortCode"
                  label="Short Code"
                  value={settings.shortCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                    setSettings({ ...settings, shortCode: e.target.value })}
                  placeholder="Enter your short code"
                  helpText="Your Telebirr short code"
                />

                <SettingsField
                  id="merchantAppId"
                  label="Merchant App ID"
                  value={settings.merchantAppId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                    setSettings({ ...settings, merchantAppId: e.target.value })}
                  placeholder="Enter your merchant application ID"
                  helpText="Your Telebirr merchant application ID"
                />

                <SettingsField
                  id="fabricAppId"
                  label="Fabric App ID"
                  value={settings.fabricAppId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                    setSettings({ ...settings, fabricAppId: e.target.value })}
                  placeholder="Enter your fabric application ID"
                  helpText="Your Telebirr fabric application ID"
                />

                <SettingsField
                  id="appSecret"
                  label="App Secret"
                  value={settings.appSecret}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                    setSettings({ ...settings, appSecret: e.target.value })}
                  placeholder="Enter your application secret"
                  helpText="Your Telebirr application secret"
                />

                <div className="col-span-6">
                  <label htmlFor="privateKey" className="block text-sm font-medium text-gray-700">
                    Private Key
                  </label>
                  <textarea
                    id="privateKey"
                    value={settings.privateKey}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                      setSettings({ ...settings, privateKey: e.target.value })}
                    rows={8}
                    className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-green-500 focus:border-green-500 border-gray-300 rounded-md font-mono"
                    placeholder="Your RSA private key"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Your Telebirr RSA private key for signing requests
                  </p>
                </div>

                <div className="col-span-6">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="isActive"
                        type="checkbox"
                        checked={settings.isActive}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                          setSettings({ ...settings, isActive: e.target.checked })}
                        className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="isActive" className="font-medium text-gray-700">
                        Enable Telebirr Payments
                      </label>
                      <p className="text-gray-500">Allow customers to pay using Telebirr</p>
                    </div>
                  </div>
                </div>

                <div className="col-span-6">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="notifyUrl" className="block text-sm font-medium text-gray-700">
                        Notify URL
                      </label>
                      <div className="mt-1 space-y-2">
                        <div className="flex rounded-md shadow-sm">
                          <input
                            type="text"
                            id="notifyUrl"
                            value={settings.notifyUrl}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                              handleUrlChange('notifyUrl', e.target.value)}
                            className={`flex-1 focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-none rounded-l-md sm:text-sm border-gray-300 ${
                              !isValidUrl(settings.notifyUrl) && settings.notifyUrl ? 'border-red-300' : ''
                            }`}
                            aria-describedby="notify-url-description"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSettings({
                                ...settings,
                                notifyUrl: `${getBaseUrl()}/api/telebirr/notify`
                              });
                              toast.success('Notify URL copied to form');
                            }}
                            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 text-sm"
                          >
                            Use Default
                          </button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <TestUrlButton url={settings.notifyUrl} label="Notify URL" />
                          {isValidUrl(settings.notifyUrl) && (
                            <span className={`text-xs ${
                              validateUrlPath(settings.notifyUrl, '/api/telebirr/notify')
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}>
                              {validateUrlPath(settings.notifyUrl, '/api/telebirr/notify')
                                ? '✓ Valid path'
                                : '✗ Invalid path'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p id="notify-url-description" className="text-sm text-gray-500">
                        URL where Telebirr will send payment notifications. Must end with /api/telebirr/notify
                      </p>
                    </div>

                    <div>
                      <label htmlFor="redirectUrl" className="block text-sm font-medium text-gray-700">
                        Redirect URL
                      </label>
                      <div className="mt-1 space-y-2">
                        <div className="flex rounded-md shadow-sm">
                          <input
                            type="text"
                            id="redirectUrl"
                            value={settings.redirectUrl}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                              handleUrlChange('redirectUrl', e.target.value)}
                            className={`flex-1 focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-none rounded-l-md sm:text-sm border-gray-300 ${
                              !isValidUrl(settings.redirectUrl) && settings.redirectUrl ? 'border-red-300' : ''
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSettings({
                                ...settings,
                                redirectUrl: `${getBaseUrl()}/payment/complete`
                              });
                              toast.success('Redirect URL copied to form');
                            }}
                            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 text-sm"
                          >
                            Use Default
                          </button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <TestUrlButton url={settings.redirectUrl} label="Redirect URL" />
                          {isValidUrl(settings.redirectUrl) && (
                            <span className={`text-xs ${
                              validateUrlPath(settings.redirectUrl, '/payment/complete')
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}>
                              {validateUrlPath(settings.redirectUrl, '/payment/complete')
                                ? '✓ Valid path'
                                : '✗ Invalid path'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        URL where customers will be redirected after payment
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-span-6">
                  <div className="rounded-md bg-blue-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">
                          Default URLs
                        </h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <p className="mb-1">
                            <strong>Default Notify URL:</strong>
                            <code className="ml-2 p-1 bg-blue-100 rounded">
                              {`${getBaseUrl()}/api/telebirr/notify`}
                            </code>
                          </p>
                          <p>
                            <strong>Default Redirect URL:</strong>
                            <code className="ml-2 p-1 bg-blue-100 rounded">
                              {`${getBaseUrl()}/payment/complete`}
                            </code>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <button
            onClick={testCredentials}
            disabled={isTestingCredentials}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isTestingCredentials ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Testing Credentials...
              </>
            ) : (
              'Test Credentials'
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 