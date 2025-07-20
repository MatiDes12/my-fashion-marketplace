'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

interface TelegramSettings {
  id: string;
  bot_token: string;
  webhook_url: string;
  admin_chat_id: string;
  support_chat_id: string;
  is_active: boolean;
}

interface TelegramNotification {
  id: string;
  user_id: string;
  chat_id: string;
  notification_type: string;
  message_text: string;
  metadata: any;
  sent_at: string;
  status: string;
  error_message?: string;
}

interface TelegramUser {
  id: string;
  user_id: string;
  chat_id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  created_at: string;
}

export default function TelegramAdminPage() {
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [notifications, setNotifications] = useState<TelegramNotification[]>([]);
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'notifications' | 'users'>('settings');
  const [selectedNotification, setSelectedNotification] = useState<TelegramNotification | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const supabase = createClientComponent();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchSettings(),
        fetchNotifications(),
        fetchUsers()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('admin_telegram_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    setSettings(data);
  };

  const fetchNotifications = async () => {
    try {
      console.log('Fetching telegram notifications...');
      const { data, error } = await supabase
        .from('telegram_notifications')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        throw error;
      }
      
      console.log('Fetched notifications:', data);
      setNotifications(data || []);
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
      setNotifications([]);
    }
  };

  const fetchUsers = async () => {
    try {
      console.log('Fetching telegram users...');
      const { data, error } = await supabase
        .from('telegram_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }
      
      console.log('Fetched users:', data);
      setUsers(data || []);
    } catch (error) {
      console.error('Error in fetchUsers:', error);
      setUsers([]);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const settingsData = {
        bot_token: formData.get('bot_token') as string,
        webhook_url: formData.get('webhook_url') as string,
        admin_chat_id: formData.get('admin_chat_id') as string,
        support_chat_id: formData.get('support_chat_id') as string,
        is_active: true
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('admin_telegram_settings')
          .update(settingsData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('admin_telegram_settings')
          .insert([settingsData]);

        if (error) throw error;
      }

      toast.success('Settings saved successfully');
      await fetchSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSetWebhook = async () => {
    if (!settings?.webhook_url) {
      toast.error('Please enter a webhook URL first');
      return;
    }

    try {
      const response = await fetch('/api/telegram/setup-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: settings.webhook_url })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);
      toast.success('Webhook set successfully');
    } catch (error) {
      console.error('Error setting webhook:', error);
      toast.error('Failed to set webhook');
    }
  };

  const handleTestNotification = async () => {
    if (!settings?.admin_chat_id) {
      toast.error('Please enter admin chat ID first');
      return;
    }

    try {
      const response = await fetch('/api/telegram/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'admin_alert',
          userId: 'admin',
          data: {
            message: 'This is a test notification from your Telegram bot!',
            level: 'info'
          }
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);
      toast.success('Test notification sent successfully');
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    }
  };

  const handleTestWelcomeMessage = async (chatId: string) => {
    try {
      const response = await fetch('/api/telegram/test-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          userId: 'test-user'
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);
      toast.success('Welcome message sent successfully');
    } catch (error) {
      console.error('Error sending welcome message:', error);
      toast.error('Failed to send welcome message');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Telegram Integration</h1>
        <div className="flex space-x-3">
          <button
            onClick={handleSetWebhook}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Set Webhook
          </button>
          <button
            onClick={handleTestNotification}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
          >
            Test Notification
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'settings', label: 'Bot Settings' },
            { id: 'notifications', label: 'Notification Logs' },
            { id: 'users', label: 'Connected Users' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white shadow-lg rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Bot Configuration</h2>
          
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bot Token
                </label>
                <input
                  type="password"
                  name="bot_token"
                  defaultValue={settings?.bot_token || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your bot token"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get this from @BotFather on Telegram
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook URL
                </label>
                <input
                  type="url"
                  name="webhook_url"
                  defaultValue={settings?.webhook_url || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://yourdomain.com/api/telegram/webhook"
                />
                <p className="text-xs text-gray-500 mt-1">
                  URL where Telegram will send updates
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Chat ID
                </label>
                <input
                  type="text"
                  name="admin_chat_id"
                  defaultValue={settings?.admin_chat_id || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your admin chat ID"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your personal chat ID for admin notifications
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Support Chat ID
                </label>
                <input
                  type="text"
                  name="support_chat_id"
                  defaultValue={settings?.support_chat_id || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Support chat ID (optional)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Chat ID for support messages (optional)
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Notification Logs</h2>
              <p className="text-sm text-gray-500 mt-1">
                Recent Telegram notifications sent to users
              </p>
            </div>
            <div className="flex space-x-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
              <button
                onClick={() => {
                  const filteredNotifications = statusFilter === 'all' 
                    ? notifications 
                    : notifications.filter(n => n.status === statusFilter);
                  
                  if (filteredNotifications.length === 0) {
                    toast.error('No notifications to export');
                    return;
                  }
                  
                  // Create CSV content
                  const headers = ['Type', 'Chat ID', 'Status', 'Sent At', 'Message'];
                  const csvContent = [
                    headers.join(','),
                    ...filteredNotifications.map(n => [
                      n.notification_type,
                      n.chat_id,
                      n.status,
                      new Date(n.sent_at).toLocaleString(),
                      `"${n.message_text.replace(/"/g, '""')}"`
                    ].join(','))
                  ].join('\n');
                  
                  // Download CSV file
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `telegram-notifications-${new Date().toISOString().split('T')[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                  
                  toast.success('Notifications exported successfully');
                }}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
              <button
                onClick={() => fetchNotifications()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
                      </div>
            
            {/* Notification Statistics */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {notifications.length}
                  </div>
                  <div className="text-sm text-gray-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {notifications.filter(n => n.status === 'sent').length}
                  </div>
                  <div className="text-sm text-gray-500">Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {notifications.filter(n => n.status === 'failed').length}
                  </div>
                  <div className="text-sm text-gray-500">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {notifications.filter(n => n.status === 'pending').length}
                  </div>
                  <div className="text-sm text-gray-500">Pending</div>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chat ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  const filteredNotifications = statusFilter === 'all' 
                    ? notifications 
                    : notifications.filter(n => n.status === statusFilter);
                  
                                    return filteredNotifications.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <h3 className="mt-2 text-sm font-medium text-gray-900">
                            {statusFilter === 'all' ? 'No notifications' : `No ${statusFilter} notifications`}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {statusFilter === 'all' 
                              ? 'No Telegram notifications have been sent yet.'
                              : `No ${statusFilter} notifications found.`
                            }
                          </p>
                          <div className="mt-6">
                            <button
                              onClick={handleTestNotification}
                              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Send Test Notification
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredNotifications.map((notification) => (
                    <tr key={notification.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {notification.notification_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {notification.chat_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          notification.status === 'sent' 
                            ? 'bg-green-100 text-green-800'
                            : notification.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {notification.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(notification.sent_at).toLocaleString()}
                      </td>
                                                              <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate cursor-pointer hover:text-blue-600" 
                        onClick={() => {
                          setSelectedNotification(notification);
                          setShowNotificationModal(true);
                        }}>
                      {notification.message_text}
                    </td>
                  </tr>
                ))
              );
            })()}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Connected Users</h2>
              <p className="text-sm text-gray-500 mt-1">
                Users who have linked their Telegram accounts
              </p>
            </div>
            <button
              onClick={() => fetchUsers()}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chat ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Connected
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No connected users</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          No users have linked their Telegram accounts yet.
                        </p>
                        <div className="mt-6">
                          <p className="text-xs text-gray-400">
                            Users can link their accounts by visiting their profile page and clicking "Connect Telegram"
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.user_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.chat_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.first_name} {user.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        @{user.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      {showNotificationModal && selectedNotification && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Notification Details
                </h3>
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedNotification.notification_type}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Chat ID</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedNotification.chat_id}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                    selectedNotification.status === 'sent' 
                      ? 'bg-green-100 text-green-800'
                      : selectedNotification.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedNotification.status}
                  </span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sent At</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(selectedNotification.sent_at).toLocaleString()}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Message</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md">
                    <pre className="text-sm text-gray-900 whitespace-pre-wrap">
                      {selectedNotification.message_text}
                    </pre>
                  </div>
                </div>
                
                {selectedNotification.error_message && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Error Message</label>
                    <div className="mt-1 p-3 bg-red-50 rounded-md">
                      <pre className="text-sm text-red-900 whitespace-pre-wrap">
                        {selectedNotification.error_message}
                      </pre>
                    </div>
                  </div>
                )}
                
                {selectedNotification.metadata && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Metadata</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md">
                      <pre className="text-sm text-gray-900 whitespace-pre-wrap">
                        {JSON.stringify(selectedNotification.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                {selectedNotification.status === 'failed' && (
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/telegram/send-notification', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: selectedNotification.notification_type,
                            userId: selectedNotification.user_id || 'admin',
                            data: selectedNotification.metadata || {}
                          })
                        });
                        
                        if (response.ok) {
                          toast.success('Notification resent successfully');
                          setShowNotificationModal(false);
                          fetchNotifications(); // Refresh the list
                        } else {
                          toast.error('Failed to resend notification');
                        }
                      } catch (error) {
                        console.error('Error resending notification:', error);
                        toast.error('Failed to resend notification');
                      }
                    }}
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                  >
                    Resend
                  </button>
                )}
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 