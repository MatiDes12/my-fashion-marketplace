'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { withAdminAuth } from '@/components/withAdminAuth';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { User } from '@/types/database.types';
import { Tab } from '@headlessui/react';

interface SellerVerification {
  id: string;
  user_id: string;
  business_name: string;
  business_email: string;
  business_phone: string;
  legal_business_name: string;
  business_registration_no: string;
  tin_number: string;
  is_vat_registered: boolean;
  vat_number: string | null;
  trade_license_url: string;
  tin_certificate_url: string;
  memorandum_url: string;
  region: string;
  kifle_ketema: string;
  woreda: string;
  kebele: string | null;
  house_no: string;
  id_document_type: 'kebele_id' | 'national_id' | 'passport' | 'driving_license';
  id_document_url: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_reconsideration';
  created_at: string;
  updated_at: string;
}

interface DocumentPreviewModalProps {
  url: string;
  title: string;
  onClose: () => void;
}

function DocumentPreviewModal({ url, title, onClose }: DocumentPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-medium">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-gray-100 rounded-lg overflow-hidden">
            {url.toLowerCase().endsWith('.pdf') ? (
              <iframe src={url} className="w-full h-[70vh]" />
            ) : (
              <div className="relative h-[70vh] w-full">
                <Image
                  src={url}
                  alt={title}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <a
              href={url}
              download
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
            >
              Download
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

function VerificationsPage() {
  const [owners, setOwners] = useState<Array<User & { verification?: SellerVerification | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<{ url: string; title: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [selectedVerificationId, setSelectedVerificationId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 5;
  const supabase = createClientComponentClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'submitted' | 'no_verification'>('overview');

  useEffect(() => {
    fetchOwnersWithVerification();
  }, []);

  // Fetch all owners and their verification (if any)
  const fetchOwnersWithVerification = async () => {
    setLoading(true);
    try {
      // 1. Fetch all owners
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'owner');
      if (usersError) throw usersError;
      // 2. Fetch all verifications
      const { data: verifications, error: verificationsError } = await supabase
        .from('seller_verification')
        .select('*');
      if (verificationsError) throw verificationsError;
      // 3. Merge: attach verification to each owner (if any)
      const ownersWithVerification = (users || []).map((user: User) => ({
        ...user,
        verification: verifications?.find(v => v.user_id === user.id) || null,
      }));
      setOwners(ownersWithVerification);
    } catch (error) {
      console.error('Error fetching owners/verifications:', error);
      toast.error('Failed to load owners/verifications');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics for the overview tab
  const getVerificationStats = () => {
    const totalOwners = owners.length;
    const ownersWithVerification = owners.filter(o => o.verification);
    const ownersNoVerification = owners.filter(o => !o.verification);
    
    const pending = ownersWithVerification.filter(o => o.verification?.status === 'pending');
    const approved = ownersWithVerification.filter(o => o.verification?.status === 'approved');
    const rejected = ownersWithVerification.filter(o => o.verification?.status === 'rejected');
    const needsReconsideration = ownersWithVerification.filter(o => o.verification?.status === 'needs_reconsideration');

    return {
      total: totalOwners,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      needsReconsideration: needsReconsideration.length,
      noVerification: ownersNoVerification.length,
      withVerification: ownersWithVerification.length
    };
  };

  const stats = getVerificationStats();

  // Bulk actions
  const handleBulkAction = async (action: 'approve' | 'reject' | 'needs_reconsideration', userIds: string[]) => {
    try {
      for (const userId of userIds) {
        await handleStatusUpdate(userId, action);
      }
      toast.success(`Bulk ${action} completed successfully`);
    } catch (error) {
      console.error('Bulk action error:', error);
      toast.error(`Failed to complete bulk ${action}`);
    }
  };

  const getDocumentUrl = async (path: string) => {
    try {
      const { data, error } = await supabase
        .storage
        .from('verification-documents')
        .createSignedUrl(path, 3600); // URL valid for 1 hour

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting document URL:', error);
      toast.error('Failed to load document');
      return null;
    }
  };

  const handleDocumentClick = async (path: string, title: string) => {
    if (!path) {
      toast.error('Document not found');
      return;
    }

    const url = await getDocumentUrl(path);
    if (url) {
      setSelectedDocument({ url, title });
    }
  };

  // Update approve/reject to use verification id if present
  const handleStatusUpdate = async (userId: string, status: 'approved' | 'rejected' | 'pending' | 'needs_reconsideration') => {
    try {
      const owner = owners.find(o => o.id === userId);
      if (!owner || !owner.verification) {
        toast.error('No verification record for this owner.');
        return;
      }
      const verificationId = owner.verification.id;
      // Update seller_verification table
      const { error: verificationError } = await supabase
        .from('seller_verification')
        .update({ status })
        .eq('id', verificationId);
      if (verificationError) throw verificationError;
      // Call the RPC function
      const { error: rpcError } = await supabase
        .rpc('update_user_verification_status', {
          p_is_verified: status === 'approved',
          p_new_status: status === 'approved' ? 'verified' : 
                        status === 'needs_reconsideration' ? 'needs_reconsideration' : status,
          p_user_id: owner.id
        });
      if (rpcError) {
        console.error('RPC error:', rpcError);
        throw rpcError;
      }
      // If status is needs_reconsideration, deactivate all products
      if (status === 'needs_reconsideration') {
        const { error: productsError } = await supabase
          .from('products')
          .update({ is_active: false })
          .eq('owner_id', owner.id);
        if (productsError) {
          console.error('Error deactivating products:', productsError);
          throw productsError;
        }
      }
      toast.success(`Verification ${status} successfully`);
      fetchOwnersWithVerification();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status: ' + (error?.message || 'Unknown error'));
    }
  };

  const handleReject = async (userId: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    try {
      const owner = owners.find(o => o.id === userId);
      if (!owner || !owner.verification) {
        toast.error('No verification record for this owner.');
        return;
      }
      const verificationId = owner.verification.id;
      // Update seller_verification table with status and reason
      const { error: verificationError } = await supabase
        .from('seller_verification')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason 
        })
        .eq('id', verificationId);
      if (verificationError) throw verificationError;
      // Call the RPC function
      const { error: rpcError } = await supabase
        .rpc('update_user_verification_status', {
          p_is_verified: false,
          p_new_status: 'rejected',
          p_user_id: owner.id
        });
      if (rpcError) throw rpcError;
      toast.success('Verification rejected successfully');
      setRejectionReason('');
      setShowReasonInput(false);
      setSelectedVerificationId(null);
      fetchOwnersWithVerification();
    } catch (error: any) {
      console.error('Error rejecting verification:', error);
      toast.error('Failed to reject verification: ' + (error?.message || 'Unknown error'));
    }
  };

  // Split owners into two groups
  const ownersNoVerification = owners.filter(o => !o.verification);
  const ownersWithVerification = owners.filter(o => o.verification);

  // Filtering and pagination logic (update to use owners)
  const filteredOwnersNoVerification = ownersNoVerification.filter(o => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (o.full_name?.toLowerCase().includes(searchLower) || '') ||
      (o.email?.toLowerCase().includes(searchLower) || '')
    );
  });
  const filteredOwnersWithVerification = ownersWithVerification.filter(o => {
    if (filterStatus === 'all') return true;
    return o.verification?.status === filterStatus;
  }).filter(o => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (o.verification?.business_name?.toLowerCase().includes(searchLower) || '') ||
      (o.verification?.business_email?.toLowerCase().includes(searchLower) || '') ||
      (o.verification?.tin_number?.toLowerCase().includes(searchLower) || '') ||
      (o.full_name?.toLowerCase().includes(searchLower) || '') ||
      (o.email?.toLowerCase().includes(searchLower) || '')
    );
  });
  const paginatedOwnersNoVerification = filteredOwnersNoVerification.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPagesNoVerification = Math.ceil(filteredOwnersNoVerification.length / itemsPerPage);
  const paginatedOwnersWithVerification = filteredOwnersWithVerification.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPagesWithVerification = Math.ceil(filteredOwnersWithVerification.length / itemsPerPage);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this verification? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('seller_verification')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Verification deleted successfully');
      fetchOwnersWithVerification();
    } catch (error) {
      console.error('Error deleting verification:', error);
      toast.error('Failed to delete verification');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Seller Verifications</h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center">
          <input
            type="search"
            placeholder="Search sellers..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 pl-10 py-2 px-3 text-sm w-64"
          />
          {activeTab === 'submitted' && (
            <select
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 text-sm"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="needs_reconsideration">Needs Reconsideration</option>
            </select>
          )}
        </div>
      </div>

      {/* Stats Cards for Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Total Sellers"
            value={stats.total}
            icon="users"
            color="blue"
            description="All registered sellers"
          />
          <StatCard
            title="Pending Review"
            value={stats.pending}
            icon="clock"
            color="yellow"
            description="Awaiting approval"
          />
          <StatCard
            title="Approved"
            value={stats.approved}
            icon="check"
            color="green"
            description="Successfully verified"
          />
          <StatCard
            title="Rejected"
            value={stats.rejected}
            icon="x"
            color="red"
            description="Verification denied"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={classNames(
              activeTab === 'overview'
                ? 'bg-white border-b-2 border-red-500 text-red-600'
                : 'text-gray-500 hover:text-red-600',
              'px-4 py-2 text-sm font-medium focus:outline-none'
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('submitted')}
            className={classNames(
              activeTab === 'submitted'
                ? 'bg-white border-b-2 border-red-500 text-red-600'
                : 'text-gray-500 hover:text-red-600',
              'px-4 py-2 text-sm font-medium focus:outline-none'
            )}
          >
            Verification Submitted
            <span className="ml-2 inline-block bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full align-middle">
              {ownersWithVerification.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('no_verification')}
            className={classNames(
              activeTab === 'no_verification'
                ? 'bg-white border-b-2 border-red-500 text-red-600'
                : 'text-gray-500 hover:text-red-600',
              'px-4 py-2 text-sm font-medium focus:outline-none'
            )}
          >
            No Verification Submitted
            <span className="ml-2 inline-block bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full align-middle">
              {ownersNoVerification.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' ? (
        <div className="space-y-8">
          {/* Quick Actions */}
          <div className="bg-white shadow-lg rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-4 border border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Pending Review</span>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-2">{stats.pending}</p>
                <p className="text-xs text-gray-500 mb-3">Sellers awaiting approval</p>
                <button
                  onClick={() => {
                    setActiveTab('submitted');
                    setFilterStatus('pending');
                  }}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-medium py-2 px-3 rounded-md transition-colors"
                >
                  Review Pending
                </button>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Approved</span>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-2">{stats.approved}</p>
                <p className="text-xs text-gray-500 mb-3">Successfully verified</p>
                <button
                  onClick={() => {
                    setActiveTab('submitted');
                    setFilterStatus('approved');
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 px-3 rounded-md transition-colors"
                >
                  View Approved
                </button>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Rejected</span>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-2">{stats.rejected}</p>
                <p className="text-xs text-gray-500 mb-3">Verification denied</p>
                <button
                  onClick={() => {
                    setActiveTab('submitted');
                    setFilterStatus('rejected');
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-2 px-3 rounded-md transition-colors"
                >
                  View Rejected
                </button>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Needs Reconsideration</span>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-2">{stats.needsReconsideration}</p>
                <p className="text-xs text-gray-500 mb-3">Requires additional review</p>
                <button
                  onClick={() => {
                    setActiveTab('submitted');
                    setFilterStatus('needs_reconsideration');
                  }}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium py-2 px-3 rounded-md transition-colors"
                >
                  Review Again
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white shadow-lg rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {ownersWithVerification
                .sort((a, b) => new Date(b.verification!.updated_at).getTime() - new Date(a.verification!.updated_at).getTime())
                .slice(0, 5)
                .map((owner) => {
                  const verification = owner.verification!;
                  return (
                    <div key={owner.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                          {owner.full_name?.[0]?.toUpperCase() || owner.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{owner.full_name}</p>
                          <p className="text-xs text-gray-500">{verification.business_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={classNames(
                          'px-2 py-1 rounded-full text-xs font-semibold',
                          verification.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          verification.status === 'approved' ? 'bg-green-100 text-green-800' :
                          verification.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        )}>
                          {verification.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(verification.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white shadow-lg rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Status Distribution</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">No Verification</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gray-400 h-2 rounded-full" 
                        style={{ width: `${(stats.noVerification / stats.total) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{stats.noVerification}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pending</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-400 h-2 rounded-full" 
                        style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{stats.pending}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Approved</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-400 h-2 rounded-full" 
                        style={{ width: `${(stats.approved / stats.total) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{stats.approved}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Rejected</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-400 h-2 rounded-full" 
                        style={{ width: `${(stats.rejected / stats.total) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{stats.rejected}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow-lg rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">Verification Rate</span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">
                    {stats.total > 0 ? Math.round((stats.withVerification / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">Approval Rate</span>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    {stats.withVerification > 0 ? Math.round((stats.approved / stats.withVerification) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">Pending Rate</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-600">
                    {stats.withVerification > 0 ? Math.round((stats.pending / stats.withVerification) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'no_verification' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedOwnersNoVerification.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-12">No sellers found.</div>
          ) : (
            paginatedOwnersNoVerification.map((owner) => (
              <div key={owner.id} className="bg-white rounded-xl shadow p-6 flex flex-col items-center border border-gray-100">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-red-400 to-pink-400 flex items-center justify-center text-white text-2xl font-bold mb-3">
                  {owner.full_name?.[0]?.toUpperCase() || owner.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="text-lg font-semibold text-gray-900">{owner.full_name}</div>
                <div className="text-sm text-gray-500 mb-2">{owner.email}</div>
                <div className="text-xs text-gray-400 mb-4">Joined {owner.created_at ? new Date(owner.created_at).toLocaleDateString() : ''}</div>
                <span className="inline-block bg-gray-100 text-gray-500 text-xs font-medium px-3 py-1 rounded-full mb-2">No verification submitted</span>
                {/* Optionally, add a Remind button here */}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {paginatedOwnersWithVerification.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-12">No sellers found.</div>
          ) : (
            paginatedOwnersWithVerification.map((owner) => {
              const verification = owner.verification!;
              return (
                <div key={owner.id} className="bg-white rounded-xl shadow p-6 border border-gray-100 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-400 to-pink-400 flex items-center justify-center text-white text-xl font-bold">
                      {owner.full_name?.[0]?.toUpperCase() || owner.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{owner.full_name}</div>
                      <div className="text-sm text-gray-500">{owner.email}</div>
                      <div className="text-xs text-gray-400">Joined {owner.created_at ? new Date(owner.created_at).toLocaleDateString() : ''}</div>
                    </div>
                    <span className={classNames(
                      'ml-auto px-3 py-1 rounded-full text-xs font-semibold',
                      verification.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      verification.status === 'approved' ? 'bg-green-100 text-green-800' :
                      verification.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      verification.status === 'needs_reconsideration' ? 'bg-gray-100 text-gray-800' :
                      'bg-gray-100 text-gray-800'
                    )}>
                      {verification.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="font-medium text-gray-700 mb-1">Business</div>
                      <div className="text-sm text-gray-900">{verification.business_name}</div>
                      <div className="text-xs text-gray-500">{verification.legal_business_name}</div>
                      <div className="text-xs text-gray-500">{verification.business_email}</div>
                      <div className="text-xs text-gray-500">{verification.business_phone}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700 mb-1">Tax</div>
                      <div className="text-xs text-gray-500">TIN: <span className="text-gray-900">{verification.tin_number}</span></div>
                      <div className="text-xs text-gray-500">VAT: <span className="text-gray-900">{verification.is_vat_registered ? verification.vat_number : 'Not Registered'}</span></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() => handleDocumentClick(verification.trade_license_url, 'Trade License')}
                      className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs border border-gray-200"
                    >
                      Trade License
                    </button>
                    <button
                      onClick={() => handleDocumentClick(verification.tin_certificate_url, 'TIN Certificate')}
                      className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs border border-gray-200"
                    >
                      TIN Certificate
                    </button>
                    <button
                      onClick={() => handleDocumentClick(verification.memorandum_url, 'Memorandum')}
                      className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs border border-gray-200"
                    >
                      Memorandum
                    </button>
                    <button
                      onClick={() => handleDocumentClick(verification.id_document_url, 'ID Document')}
                      className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs border border-gray-200"
                    >
                      ID Document
                    </button>
                  </div>
                  {/* Actions */}
                  {verification.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleStatusUpdate(owner.id, 'approved')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium text-sm shadow"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedVerificationId(verification.id);
                          setShowReasonInput(true);
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium text-sm shadow"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {verification.status !== 'pending' && (
                    <div className="flex gap-2 mt-2">
                      {['pending', 'approved', 'rejected', 'needs_reconsideration'].map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusUpdate(owner.id, status as any)}
                          className={classNames(
                            'flex-1 px-4 py-2 rounded font-medium text-sm border',
                            verification.status === status
                              ? 'bg-gray-100 text-gray-800 border-gray-300'
                              : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                          )}
                        >
                          {status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {selectedDocument && (
        <DocumentPreviewModal
          url={selectedDocument.url}
          title={selectedDocument.title}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {showReasonInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Provide Rejection Reason</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full h-32 p-2 border rounded-md mb-4"
              placeholder="Please provide a reason for rejection..."
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowReasonInput(false);
                  setRejectionReason('');
                  setSelectedVerificationId(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedVerificationId && handleReject(selectedVerificationId)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {totalPagesNoVerification > 1 && (
        <div className="mt-6 flex justify-center">
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Previous
            </button>
            {[...Array(totalPagesNoVerification)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${
                  currentPage === i + 1
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPagesNoVerification, p + 1))}
              disabled={currentPage === totalPagesNoVerification}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Next
            </button>
          </nav>
        </div>
      )}
      {totalPagesWithVerification > 1 && (
        <div className="mt-6 flex justify-center">
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Previous
            </button>
            {[...Array(totalPagesWithVerification)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${
                  currentPage === i + 1
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPagesWithVerification, p + 1))}
              disabled={currentPage === totalPagesWithVerification}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

// StatCard component for the overview tab
interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
  description: string;
}

function StatCard({ title, value, icon, color, description }: StatCardProps) {
  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'users':
        return (
          <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        );
      case 'clock':
        return (
          <svg className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'check':
        return (
          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'x':
        return (
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
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
            <p className="text-xs text-gray-500">{description}</p>
          </div>
          <div className="flex-shrink-0 ml-4">
            {getIcon(icon)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAdminAuth(VerificationsPage); 