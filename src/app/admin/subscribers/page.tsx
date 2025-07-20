'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { DataTable } from '@/components/DataTable';

interface Subscriber {
  id: string;
  email: string;
  subscription_type: 'notify_me' | 'newsletter';
  is_active: boolean;
  created_at: string;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [filteredSubscribers, setFilteredSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageType, setMessageType] = useState<'notify_me' | 'newsletter'>('newsletter');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchSubscribers();
  }, []);

  // Filter subscribers based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSubscribers(subscribers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = subscribers.filter(subscriber => {
      return (
        subscriber.email.toLowerCase().includes(query) ||
        subscriber.subscription_type.toLowerCase().includes(query) ||
        (subscriber.is_active ? 'active' : 'inactive').includes(query) ||
        new Date(subscriber.created_at).toLocaleDateString().toLowerCase().includes(query)
      );
    });

    setFilteredSubscribers(filtered);
  }, [searchQuery, subscribers]);

  const fetchSubscribers = async () => {
    try {
      const { data, error } = await supabase
        .from('email_subscribers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscribers(data || []);
      setFilteredSubscribers(data || []);
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
      setShowComposer(false);
    } catch (error) {
      console.error('Error sending messages:', error);
      toast.error('Failed to send messages');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const subscriberStats = {
    total: filteredSubscribers.length,
    newsletter: filteredSubscribers.filter(s => s.subscription_type === 'newsletter').length,
    notifyMe: filteredSubscribers.filter(s => s.subscription_type === 'notify_me').length,
    active: filteredSubscribers.filter(s => s.is_active).length
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Subscriber Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your email subscribers and send targeted messages
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowComposer(!showComposer)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {showComposer ? 'Hide Composer' : 'Send Message'}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subscribers by email, type, status..."
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm"
          />
          {searchQuery && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 text-sm text-gray-600">
            Found {filteredSubscribers.length} subscriber{filteredSubscribers.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Subscribers"
          value={subscriberStats.total}
          icon="users"
          color="blue"
        />
        <StatCard
          title="Newsletter Subscribers"
          value={subscriberStats.newsletter}
          icon="newsletter"
          color="green"
        />
        <StatCard
          title="Launch Notifications"
          value={subscriberStats.notifyMe}
          icon="bell"
          color="purple"
        />
        <StatCard
          title="Active Subscribers"
          value={subscriberStats.active}
          icon="check"
          color="emerald"
        />
      </div>

      {/* Message Composer */}
      {showComposer && (
        <div className="bg-white shadow-lg rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Send Message</h2>
            <button
              onClick={() => setShowComposer(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message Type</label>
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as 'notify_me' | 'newsletter')}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                >
                  <option value="newsletter">Newsletter</option>
                  <option value="notify_me">Launch Notification</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  placeholder="Enter email subject"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                placeholder="Enter your message content..."
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                This message will be sent to {subscriberStats.total} subscriber{subscriberStats.total !== 1 ? 's' : ''}
              </div>
              <button
                onClick={handleSendMessage}
                disabled={sending}
                className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Message
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscribers Table */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden">
        <DataTable
          data={filteredSubscribers}
          columns={[
            {
              header: 'Email',
              accessor: 'email',
              cell: (row) => (
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-red-400 to-red-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {row.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{row.email}</div>
                    <div className="text-sm text-gray-500">Subscriber</div>
                  </div>
                </div>
              )
            },
            {
              header: 'Subscription Type',
              accessor: 'subscription_type',
              cell: (row) => (
                <div className="flex items-center">
                  <div className={`flex-shrink-0 h-2 w-2 rounded-full mr-3 ${
                    row.subscription_type === 'newsletter' ? 'bg-green-400' : 'bg-purple-400'
                  }`}></div>
                  <span className="text-sm text-gray-900">
                    {row.subscription_type === 'notify_me' ? 'Launch Notification' : 'Newsletter'}
                  </span>
                </div>
              )
            },
            {
              header: 'Status',
              accessor: 'is_active',
              cell: (row) => (
                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  row.is_active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {row.is_active ? 'Active' : 'Inactive'}
                </span>
              )
            },
            {
              header: 'Subscribed On',
              accessor: 'created_at',
              cell: (row) => (
                <div className="text-sm text-gray-900">
                  {new Date(row.created_at).toLocaleDateString()}
                  <div className="text-xs text-gray-500">
                    {new Date(row.created_at).toLocaleTimeString()}
                  </div>
                </div>
              )
            }
          ]}
          itemsPerPage={10}
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'users':
        return (
          <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        );
      case 'newsletter':
        return (
          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'bell':
        return (
          <svg className="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM4.19 4.19A4 4 0 004 6v6a4 4 0 004 4h6a4 4 0 004-4V6a4 4 0 00-4-4H8a4 4 0 00-2.81 1.19z" />
          </svg>
        );
      case 'check':
        return (
          <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{value.toLocaleString()}</p>
            <div className="flex items-center text-sm font-medium text-gray-500">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
              Subscribers
            </div>
          </div>
          <div className="flex-shrink-0 ml-4">
            {getIcon(icon)}
          </div>
        </div>
      </div>
    </div>
  );
} 