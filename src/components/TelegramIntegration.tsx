'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface TelegramIntegrationProps {
  userId: string;
  className?: string;
}

export default function TelegramIntegration({ userId, className = '' }: TelegramIntegrationProps) {
  const { t } = useLanguage();
  const [isLinked, setIsLinked] = useState(false);
  const [chatId, setChatId] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkMethod, setLinkMethod] = useState<'chatId' | 'username'>('chatId');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const supabase = createClientComponent();

  useEffect(() => {
    checkTelegramLink();
  }, [userId]);

  const checkTelegramLink = async () => {
    try {
      const { data } = await supabase
        .from('telegram_users')
        .select('chat_id, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      setIsLinked(!!data);
    } catch (error) {
      setIsLinked(false);
    }
  };

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (!usernameToCheck.trim()) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const cleanUsername = usernameToCheck.replace('@', '');
      const response = await fetch(`/api/telegram/link-account-by-username?username=${encodeURIComponent(cleanUsername)}`);
      const data = await response.json();
      
      if (response.ok) {
        setUsernameAvailable(data.available);
      } else {
        setUsernameAvailable(false);
      }
    } catch (error) {
      console.error('Error checking username availability:', error);
      setUsernameAvailable(false);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Debounced username check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (username.trim()) {
        checkUsernameAvailability(username);
      } else {
        setUsernameAvailable(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (linkMethod === 'chatId' && !chatId.trim()) {
      toast.error(t('telegram.errors.chatIdRequired'));
      return;
    }
    
    if (linkMethod === 'username' && !username.trim()) {
      toast.error(t('telegram.errors.usernameRequired'));
      return;
    }

    setLoading(true);
    try {
      // Get the current session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error(t('telegram.errors.authRequired'));
      }

      let response;
      if (linkMethod === 'chatId') {
        response = await fetch('/api/telegram/link-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId,
          chatId: chatId.trim()
        }),
      });
      } else {
        response = await fetch('/api/telegram/link-account-by-username', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId,
            username: username.trim()
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('telegram.errors.linkFailed'));
      }

      if (linkMethod === 'username' && data.nextStep) {
        toast.success(t('telegram.toast.linked'));
        toast(t('telegram.username.nextDesc'), { icon: 'ℹ️' });
      } else {
      toast.success(t('telegram.toast.linked'));
      }
      
      setIsLinked(true);
      setShowLinkForm(false);
      setChatId('');
      setUsername('');
    } catch (error) {
      console.error('Error linking account:', error);
      toast.error(t('telegram.errors.linkFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkAccount = async () => {
    setLoading(true);
    try {
      // Get the current session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error(t('telegram.errors.authRequired'));
      }

      const response = await fetch('/api/telegram/unlink-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unlink account');
      }

      toast.success(t('telegram.toast.unlinkSuccess'));
      setIsLinked(false);
      setShowLinkForm(false); // Hide the link form if it was open
    } catch (error) {
      console.error('Error unlinking account:', error);
      const errorMessage = error instanceof Error ? error.message : '';
      const finalMessage = errorMessage && errorMessage.toLowerCase().includes('auth')
        ? t('telegram.errors.authRequired')
        : t('telegram.toast.unlinkFailed');
      toast.error(finalMessage);
    } finally {
      setLoading(false);
    }
  };

  const openTelegramBot = async () => {
    try {
      console.log('Fetching bot URL...');
      const response = await fetch('/api/telegram/bot-url');
      const data = await response.json();
      
      console.log('Bot URL response:', data);
      
      if (data.success && data.botUrl) {
        console.log('Opening bot URL:', data.botUrl);
        window.open(data.botUrl, '_blank');
      } else {
        console.log('Using fallback URL');
        // Fallback to default URL
        window.open('https://t.me/Avrioxshop_bot', '_blank');
      }
    } catch (error) {
      console.error('Error opening Telegram bot:', error);
      // Fallback to default URL
    window.open('https://t.me/Avrioxshop_bot', '_blank');
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.27-.48.74-.74 2.87-1.25 4.79-2.09 5.76-2.51 2.7-1.18 3.26-1.38 3.64-1.39.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('telegram.title')}</h3>
            <p className="text-sm text-gray-500">{t('telegram.subtitle')}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          isLinked 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          {isLinked ? t('telegram.status.connected') : t('telegram.status.notConnected')}
        </div>
      </div>

      {isLinked ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-800 font-medium">{t('telegram.connected.title')}</span>
            </div>
            <p className="text-green-700 text-sm mt-1">{t('telegram.connected.desc')}</p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={openTelegramBot}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.27-.48.74-.74 2.87-1.25 4.79-2.09 5.76-2.51 2.7-1.18 3.26-1.38 3.64-1.39.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              <span>{t('telegram.openBot')}</span>
            </button>
            <button
              onClick={handleUnlinkAccount}
              disabled={loading}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {loading ? t('telegram.unlinking') : t('telegram.unlink')}
            </button>
          </div>
          
          {/* Fallback link in case button doesn't work */}
          <p className="text-xs text-gray-500 text-center">
            {t('telegram.buttonNotWorking')}{' '}
            <a 
              href="https://t.me/Avrioxshop_bot" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 ml-1 underline"
            >
              {t('telegram.clickHere')}
            </a>
          </p>
          
          {/* Instructions for connected users */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-800 font-medium mb-2">{t('telegram.commands.title')}</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• <strong>/start</strong> - {t('telegram.commands.start')}</li>
              <li>• <strong>/myid</strong> - {t('telegram.commands.myid')}</li>
              <li>• <strong>/orders</strong> - {t('telegram.commands.orders')}</li>
              <li>• <strong>/profile</strong> - {t('telegram.commands.profile')}</li>
              <li>• <strong>/help</strong> - {t('telegram.commands.help')}</li>
            </ul>
          </div>
          
          {/* Username linking completion reminder */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-800 font-medium mb-1">{t('telegram.reminder.title')}</p>
            <p className="text-xs text-yellow-700">{t('telegram.reminder.desc').replace('"hello"', '"hello"')}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-blue-800 font-medium">{t('telegram.connect.title')}</span>
            </div>
            <p className="text-blue-700 text-sm mt-1">{t('telegram.connect.subtitle')}</p>
          </div>

          {!showLinkForm ? (
            <div className="flex space-x-3">
              <button
                onClick={() => setShowLinkForm(true)}
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.27-.48.74-.74 2.87-1.25 4.79-2.09 5.76-2.51 2.7-1.18 3.26-1.38 3.64-1.39.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                <span>{t('telegram.connectAccount')}</span>
              </button>
              <button
                onClick={openTelegramBot}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('telegram.openBot')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleLinkAccount} className="space-y-4">
              {/* Link Method Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('telegram.linkMethod')}
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="chatId"
                      checked={linkMethod === 'chatId'}
                      onChange={(e) => setLinkMethod(e.target.value as 'chatId' | 'username')}
                      className="mr-2"
                    />
                    <span className="text-sm">{t('telegram.linkMethod.chatId')}</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="username"
                      checked={linkMethod === 'username'}
                      onChange={(e) => setLinkMethod(e.target.value as 'chatId' | 'username')}
                      className="mr-2"
                    />
                    <span className="text-sm">{t('telegram.linkMethod.username')}</span>
                  </label>
                </div>
              </div>

              {/* Chat ID Input */}
              {linkMethod === 'chatId' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('telegram.chatId.label')}
                </label>
                <input
                  type="text"
                  value={chatId}
                     onChange={(e) => {
                       // Only allow numbers
                       const value = e.target.value.replace(/[^0-9]/g, '');
                       setChatId(value);
                     }}
                  placeholder={t('telegram.chatId.placeholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                     inputMode="numeric"
                     pattern="[0-9]*"
                />
                <p className="text-xs text-gray-500 mt-1">{t('telegram.chatId.hint')}</p>
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800 font-medium mb-1">{t('telegram.chatId.howtoTitle')}</p>
                    <ol className="text-xs text-blue-700 space-y-1">
                      <li>{t('telegram.chatId.step1')}</li>
                      <li>{t('telegram.chatId.step2')}</li>
                      <li>{t('telegram.chatId.step3')}</li>
                      <li>{t('telegram.chatId.step4')}</li>
                    </ol>
                  </div>
                  
                  {/* Mobile-friendly Open Bot button for Chat ID method */}
                  <button
                    type="button"
                    onClick={openTelegramBot}
                    className="mt-2 w-full bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.27-.48.74-.74 2.87-1.25 4.79-2.09 5.76-2.51 2.7-1.18 3.26-1.38 3.64-1.39.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                    </svg>
                    <span>{t('telegram.openBot')}</span>
                  </button>
                  
                  {/* Fallback link in case button doesn't work */}
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {t('telegram.buttonNotWorking')}{' '}
                    <a 
                      href="https://t.me/Avrioxshop_bot" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 ml-1 underline"
                    >
                      {t('telegram.clickHere')}
                    </a>
                  </p>
                </div>
              )}

              {/* Username Input */}
              {linkMethod === 'username' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('telegram.username.label')}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('telegram.username.placeholder')}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        usernameAvailable === true ? 'border-green-300 bg-green-50' :
                        usernameAvailable === false ? 'border-red-300 bg-red-50' :
                        'border-gray-300'
                      }`}
                      disabled={loading}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      {checkingUsername ? (
                        <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : usernameAvailable === true ? (
                        <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : usernameAvailable === false ? (
                        <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="mt-1">
                    {usernameAvailable === true && (
                      <p className="text-xs text-green-600">{t('telegram.username.available')}</p>
                    )}
                    {usernameAvailable === false && (
                      <p className="text-xs text-red-600">{t('telegram.username.unavailable')}</p>
                    )}
                    {usernameAvailable === null && username.trim() && (
                      <p className="text-xs text-gray-500">{t('telegram.username.checking')}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t('telegram.username.hint')}</p>
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800 font-medium mb-1">{t('telegram.username.nextTitle')}</p>
                    <p className="text-xs text-blue-700">{t('telegram.username.nextDesc').replace('"hello"', '"hello"')}</p>
              </div>
                  
                  {/* Mobile-friendly Open Bot button for username method */}
                  <button
                    type="button"
                    onClick={openTelegramBot}
                    className="mt-2 w-full bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.27-.48.74-.74 2.87-1.25 4.79-2.09 5.76-2.51 2.7-1.18 3.26-1.38 3.64-1.39.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                    </svg>
                    <span>{t('telegram.openBot')}</span>
                  </button>
                  
                  {/* Fallback link in case button doesn't work */}
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {t('telegram.buttonNotWorking')}{' '}
                    <a 
                      href="https://t.me/Avrioxshop_bot" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 ml-1 underline"
                    >
                      {t('telegram.clickHere')}
                    </a>
                  </p>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading || (linkMethod === 'username' && usernameAvailable === false)}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {loading ? t('telegram.submit.linking') : t('telegram.submit.linkAccount')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkForm(false);
                    setLinkMethod('chatId');
                    setChatId('');
                    setUsername('');
                    setUsernameAvailable(null);
                  }}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {t('telegram.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-2">{t('telegram.footer.title')}</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{t('telegram.footer.order')}</span>
          </li>
          <li className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{t('telegram.footer.payment')}</span>
          </li>
          <li className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{t('telegram.footer.delivery')}</span>
          </li>
          <li className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{t('telegram.footer.flash')}</span>
          </li>
        </ul>
      </div>
    </div>
  );
} 