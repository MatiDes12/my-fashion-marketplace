'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { withAdminAuth } from '@/components/withAdminAuth';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  ChatBubbleLeftRightIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PaperAirplaneIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  user: {
    full_name: string;
    email: string;
  };
}

function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          user:users (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: SupportTicket['status']) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status })
        .eq('id', ticketId);

      if (error) throw error;
      toast.success('Ticket status updated');
      fetchTickets();
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast.error('Failed to update ticket status');
    }
  };

  const submitResponse = async (ticketId: string) => {
    if (!adminResponse.trim()) {
      toast.error('Please enter a response');
      return;
    }

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          admin_response: adminResponse,
          status: 'resolved',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;
      toast.success('Response submitted successfully');
      setIsResponseModalOpen(false);
      setSelectedTicket(null);
      setAdminResponse('');
      fetchTickets();
    } catch (error) {
      console.error('Error submitting response:', error);
      toast.error('Failed to submit response');
    }
  };

  // Calculate statistics
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !searchTerm || 
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <ClockIcon className="h-4 w-4" />;
      case 'in_progress': return <ChatBubbleLeftRightIcon className="h-4 w-4" />;
      case 'resolved': return <CheckCircleIcon className="h-4 w-4" />;
      case 'closed': return <XCircleIcon className="h-4 w-4" />;
      default: return <ClockIcon className="h-4 w-4" />;
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Support Tickets</h1>
        <p className="text-gray-600">Manage and respond to customer support requests</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <StatCard
          title="Total Tickets"
          value={stats.total}
          icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
          color="blue"
          description="All support requests"
        />
        <StatCard
          title="Open"
          value={stats.open}
          icon={<ClockIcon className="h-6 w-6" />}
          color="yellow"
          description="Awaiting response"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
          color="blue"
          description="Being handled"
        />
        <StatCard
          title="Resolved"
          value={stats.resolved}
          icon={<CheckCircleIcon className="h-6 w-6" />}
          color="green"
          description="Successfully closed"
        />
        <StatCard
          title="Closed"
          value={stats.closed}
          icon={<XCircleIcon className="h-6 w-6" />}
          color="gray"
          description="No further action"
        />
      </div>

      {/* Search and Filter */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tickets by subject, message, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Grid */}
      <div className="space-y-6">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12">
            <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No tickets found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'No support tickets have been submitted yet.'
              }
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div key={ticket.id} className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 flex items-center justify-center">
                      <UserCircleIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{ticket.user.full_name}</h3>
                      <p className="text-sm text-gray-500">{ticket.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                      {getStatusIcon(ticket.status)}
                      <span className="ml-1">{ticket.status.replace('_', ' ')}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="mb-4">
                  <h4 className="text-md font-medium text-gray-900 mb-2">{ticket.subject}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{ticket.message}</p>
                </div>

                {/* Admin Response */}
                {ticket.admin_response && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-800 mb-1">Admin Response</p>
                        <p className="text-sm text-green-700">{ticket.admin_response}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex space-x-2">
                    {ticket.status === 'open' && (
                      <button
                        onClick={() => updateTicketStatus(ticket.id, 'in_progress')}
                        className="inline-flex items-center px-3 py-2 border border-blue-300 shadow-sm text-sm leading-4 font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                        Start Progress
                      </button>
                    )}
                    {ticket.status === 'in_progress' && (
                      <button
                        onClick={() => updateTicketStatus(ticket.id, 'resolved')}
                        className="inline-flex items-center px-3 py-2 border border-green-300 shadow-sm text-sm leading-4 font-medium rounded-md text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        Mark Resolved
                      </button>
                    )}
                    {ticket.status !== 'closed' && (
                      <button
                        onClick={() => updateTicketStatus(ticket.id, 'closed')}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                      >
                        <XCircleIcon className="h-4 w-4 mr-1" />
                        Close Ticket
                      </button>
                    )}
                  </div>
                  
                  {!ticket.admin_response && ticket.status !== 'closed' && (
                    <button
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setIsResponseModalOpen(true);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                      Respond
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Response Modal */}
      {isResponseModalOpen && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Respond to Ticket</h3>
                <button
                  onClick={() => {
                    setIsResponseModalOpen(false);
                    setSelectedTicket(null);
                    setAdminResponse('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-1">From: {selectedTicket.user.full_name}</p>
                <p className="text-sm text-gray-600 mb-2">{selectedTicket.user.email}</p>
                <p className="text-sm font-medium text-gray-900 mb-1">Subject: {selectedTicket.subject}</p>
                <p className="text-sm text-gray-600">{selectedTicket.message}</p>
              </div>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Response
              </label>
              <textarea
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Enter your response to the customer..."
              />
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsResponseModalOpen(false);
                    setSelectedTicket(null);
                    setAdminResponse('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedTicket && submitResponse(selectedTicket.id)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                  Send Response
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// StatCard component
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  description: string;
}

function StatCard({ title, value, icon, color, description }: StatCardProps) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-50 border-blue-200 text-blue-600';
      case 'yellow': return 'bg-yellow-50 border-yellow-200 text-yellow-600';
      case 'green': return 'bg-green-50 border-green-200 text-green-600';
      case 'gray': return 'bg-gray-50 border-gray-200 text-gray-600';
      default: return 'bg-blue-50 border-blue-200 text-blue-600';
    }
  };

  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{value.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
          <div className={`flex-shrink-0 ml-4 p-3 rounded-lg border ${getColorClasses(color)}`}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAdminAuth(AdminSupportPage); 