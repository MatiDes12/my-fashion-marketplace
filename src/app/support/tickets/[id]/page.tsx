'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import { format } from 'date-fns';
import LoadingSpinner from '@/components/LoadingSpinner';

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_response: string | null;
  created_at: string;
  updated_at: string;
}

export default function TicketDetailPage() {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const supabase = createClientComponent();

  useEffect(() => {
    fetchTicket();
    // eslint-disable-next-line
  }, [params?.id]);

  const fetchTicket = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', params?.id)
        .eq('user_id', session.user.id)
        .single();
      if (error || !data) {
        router.push('/support/tickets');
        return;
      }
      setTicket(data);
    } catch (error) {
      router.push('/support/tickets');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!ticket) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Ticket Details</h2>
            <button
              onClick={() => router.push('/support/tickets')}
              className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
            >
              Back to Tickets
            </button>
          </div>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{ticket.subject}</h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-4 ${
              ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
              ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
              ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {ticket.status.replace('_', ' ')}
            </span>
            <p className="text-gray-700 mb-4 whitespace-pre-line">{ticket.message}</p>
            <div className="text-sm text-gray-500 mb-4">
              Created: {format(new Date(ticket.created_at), 'MMM d, yyyy')}
            </div>
            {ticket.admin_response && (
              <div className="mt-4 bg-gray-50 p-4 rounded-md">
                <p className="text-sm font-medium text-gray-900">Admin Response:</p>
                <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{ticket.admin_response}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 