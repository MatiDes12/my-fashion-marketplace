'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Subscriber {
  id: string;
  email: string;
  subscription_type: 'notify_me' | 'newsletter';
  is_active: boolean;
  created_at: string;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageType, setMessageType] = useState<'notify_me' | 'newsletter'>('newsletter');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      const { data, error } = await supabase
        .from('email_subscribers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscribers(data || []);
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      toast.error('Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in both subject and message');
      return;
    }

    try {
      setSending(true);
      const response = await fetch('/api/admin/send-bulk-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: messageType,
          subject,
          message
        }),
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      toast.success('Messages sent successfully!');
      setSubject('');
      setMessage('');
    } catch (error) {
      console.error('Error sending messages:', error);
      toast.error('Failed to send messages');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const subscriberStats = {
    total: subscribers.length,
    newsletter: subscribers.filter(s => s.subscription_type === 'newsletter').length,
    notifyMe: subscribers.filter(s => s.subscription_type === 'notify_me').length,
    active: subscribers.filter(s => s.is_active).length
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Subscriber Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Total Subscribers" value={subscriberStats.total} />
        <StatCard title="Newsletter Subscribers" value={subscriberStats.newsletter} />
        <StatCard title="Launch Notifications" value={subscriberStats.notifyMe} />
        <StatCard title="Active Subscribers" value={subscriberStats.active} />
      </div>

      {/* Message Composer */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Send Message</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Message Type</label>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value as 'notify_me' | 'newsletter')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
            >
              <option value="newsletter">Newsletter</option>
              <option value="notify_me">Launch Notification</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              placeholder="Enter email subject"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              placeholder="Enter your message"
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={sending}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subscribed On
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {subscriber.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {subscriber.subscription_type === 'notify_me' ? 'Launch Notification' : 'Newsletter'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    subscriber.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {subscriber.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(subscriber.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
        <dd className="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
      </div>
    </div>
  );
} 