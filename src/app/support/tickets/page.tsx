'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import LoadingSpinner from '@/components/LoadingSpinner';
import { EMAIL_CONFIG } from '@/config/email';

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_response: string | null;
  created_at: string;
  updated_at: string;
}

const SUPPORT_EMAIL = EMAIL_CONFIG.SUPPORT;

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Support Tickets</h2>
              <button
                onClick={() => router.push('/support')}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
              >
                New Ticket
              </button>
            </div>
          </div>

          {tickets.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <div>
                <p>No support tickets found.</p>
                <p className="mt-2">
                  You can also reach us directly at{' '}
                  <a 
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-red-600 hover:text-red-700"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{ticket.subject}</h3>
                      <p className="mt-1 text-sm text-gray-600">{ticket.message}</p>
                      {ticket.admin_response && (
                        <div className="mt-4 bg-gray-50 p-4 rounded-md">
                          <p className="text-sm font-medium text-gray-900">Admin Response:</p>
                          <p className="mt-1 text-sm text-gray-600">{ticket.admin_response}</p>
                        </div>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                      ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-4 text-sm text-gray-500">
                    Created: {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 