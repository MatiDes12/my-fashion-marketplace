'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { 
  EnvelopeIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

interface ContactMessage {
  id: string;
  created_at: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  to_email: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
}

export default function ContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const supabase = createClientComponent();

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const updateMessageStatus = async (id: string, status: 'sent' | 'failed') => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ status, sent_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Message marked as ${status}`);
      fetchMessages();
    } catch (error) {
      console.error('Error updating message:', error);
      toast.error('Failed to update message status');
    }
  };

  // Calculate statistics
  const stats = {
    total: messages.length,
    pending: messages.filter(m => m.status === 'pending').length,
    sent: messages.filter(m => m.status === 'sent').length,
    failed: messages.filter(m => m.status === 'failed').length,
  };

  // Filter messages
  const filteredMessages = messages.filter(message => {
    const matchesSearch = !searchTerm || 
      message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || message.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'sent': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <ClockIcon className="h-4 w-4" />;
      case 'sent': return <CheckCircleIcon className="h-4 w-4" />;
      case 'failed': return <XCircleIcon className="h-4 w-4" />;
      default: return <ClockIcon className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Messages</h1>
        <p className="text-gray-600">Manage and track customer contact form submissions</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Messages"
          value={stats.total}
          icon={<EnvelopeIcon className="h-6 w-6" />}
          color="blue"
          description="All contact submissions"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon={<ClockIcon className="h-6 w-6" />}
          color="yellow"
          description="Awaiting response"
        />
        <StatCard
          title="Sent"
          value={stats.sent}
          icon={<CheckCircleIcon className="h-6 w-6" />}
          color="green"
          description="Successfully processed"
        />
        <StatCard
          title="Failed"
          value={stats.failed}
          icon={<XCircleIcon className="h-6 w-6" />}
          color="red"
          description="Processing failed"
        />
      </div>

      {/* Search and Filter */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages by subject, content, or sender..."
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
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages Grid */}
      <div className="space-y-6">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <EnvelopeIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No messages found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'No contact messages have been submitted yet.'
              }
            </p>
          </div>
        ) : (
          filteredMessages.map((message) => (
            <div key={message.id} className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-400 to-pink-400 flex items-center justify-center">
                      <UserCircleIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{message.name}</h3>
                      <p className="text-sm text-gray-500">{message.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(message.status)}`}>
                      {getStatusIcon(message.status)}
                      <span className="ml-1">{message.status}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(message.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="mb-4">
                  <h4 className="text-md font-medium text-gray-900 mb-2">{message.subject}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{message.message}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex space-x-2">
                    {message.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateMessageStatus(message.id, 'sent')}
                          className="inline-flex items-center px-3 py-2 border border-green-300 shadow-sm text-sm leading-4 font-medium rounded-md text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Mark Sent
                        </button>
                        <button
                          onClick={() => updateMessageStatus(message.id, 'failed')}
                          className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <XCircleIcon className="h-4 w-4 mr-1" />
                          Mark Failed
                        </button>
                      </>
                    )}
                    {message.status !== 'pending' && (
                      <span className="text-sm text-gray-500">
                        {message.sent_at && `Processed: ${format(new Date(message.sent_at), 'MMM d, yyyy HH:mm')}`}
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedMessage(message);
                      setIsModalOpen(true);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <EyeIcon className="h-4 w-4 mr-1" />
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Details Modal */}
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsModalOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                  {selectedMessage && (
                    <>
                      <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                            Message Details
                          </Dialog.Title>
                          <button
                            onClick={() => setIsModalOpen(false)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <XCircleIcon className="h-6 w-6" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-6 space-y-6">
                        {/* Sender Info */}
                        <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-400 to-pink-400 flex items-center justify-center">
                            <UserCircleIcon className="h-8 w-8 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{selectedMessage.name}</h4>
                            <p className="text-sm text-gray-600">{selectedMessage.email}</p>
                            <p className="text-xs text-gray-500">
                              Sent on {format(new Date(selectedMessage.created_at), 'PPpp')}
                            </p>
                          </div>
                          <div className="ml-auto">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedMessage.status)}`}>
                              {getStatusIcon(selectedMessage.status)}
                              <span className="ml-1">{selectedMessage.status}</span>
                            </span>
                          </div>
                        </div>

                        {/* Subject */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Subject</h4>
                          <p className="text-lg text-gray-900 font-medium">{selectedMessage.subject}</p>
                        </div>

                        {/* Message */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Message</h4>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{selectedMessage.message}</p>
                          </div>
                        </div>

                        {/* Status Actions */}
                        {selectedMessage.status === 'pending' && (
                          <div className="flex space-x-3 pt-4 border-t border-gray-200">
                            <button
                              onClick={() => {
                                updateMessageStatus(selectedMessage.id, 'sent');
                                setIsModalOpen(false);
                              }}
                              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-green-300 shadow-sm text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              <CheckCircleIcon className="h-4 w-4 mr-2" />
                              Mark as Sent
                            </button>
                            <button
                              onClick={() => {
                                updateMessageStatus(selectedMessage.id, 'failed');
                                setIsModalOpen(false);
                              }}
                              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <XCircleIcon className="h-4 w-4 mr-2" />
                              Mark as Failed
                            </button>
                          </div>
                        )}

                        {/* Processing Info */}
                        {selectedMessage.status !== 'pending' && selectedMessage.sent_at && (
                          <div className="pt-4 border-t border-gray-200">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Processed:</span> {format(new Date(selectedMessage.sent_at), 'PPpp')}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
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
      case 'red': return 'bg-red-50 border-red-200 text-red-600';
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