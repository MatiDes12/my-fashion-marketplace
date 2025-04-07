'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { withAdminAuth } from '@/components/withAdminAuth';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

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
  status: 'pending' | 'approved' | 'rejected';
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

function VerificationsPage() {
  const [verifications, setVerifications] = useState<SellerVerification[]>([]);
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

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    try {
      const { data, error } = await supabase
        .from('seller_verification')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVerifications(data || []);
    } catch (error) {
      console.error('Error fetching verifications:', error);
      toast.error('Failed to load verifications');
    } finally {
      setLoading(false);
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

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      // First update seller_verification table
      const { error: verificationError } = await supabase
        .from('seller_verification')
        .update({ status })
        .eq('id', id);

      if (verificationError) {
        console.error('Verification update error:', verificationError);
        throw verificationError;
      }

      const verification = verifications.find(v => v.id === id);
      if (verification) {
        // Call the RPC function with parameters in the correct order
        const { data, error: rpcError } = await supabase
          .rpc('update_user_verification_status', {
            p_is_verified: status === 'approved',
            p_new_status: status === 'approved' ? 'verified' : status,
            p_user_id: verification.user_id
          });

        if (rpcError) {
          console.error('RPC error:', rpcError);
          throw rpcError;
        }

        console.log('Update response:', data);
      }

      toast.success(`Verification ${status} successfully`);
      fetchVerifications();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status. Please check console for details.');
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      // First update seller_verification table with status and reason
      const { error: verificationError } = await supabase
        .from('seller_verification')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason 
        })
        .eq('id', id);

      if (verificationError) throw verificationError;

      const verification = verifications.find(v => v.id === id);
      if (verification) {
        const { error: rpcError } = await supabase
          .rpc('update_user_verification_status', {
            p_is_verified: false,
            p_new_status: 'rejected',
            p_user_id: verification.user_id
          });

        if (rpcError) throw rpcError;
      }

      toast.success('Verification rejected successfully');
      setRejectionReason('');
      setShowReasonInput(false);
      setSelectedVerificationId(null);
      fetchVerifications();
    } catch (error) {
      console.error('Error rejecting verification:', error);
      toast.error('Failed to reject verification');
    }
  };

  const filteredVerifications = verifications
    .filter(v => {
      if (filterStatus === 'all') return true;
      return v.status === filterStatus;
    })
    .filter(v => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        v.business_name.toLowerCase().includes(searchLower) ||
        v.business_email.toLowerCase().includes(searchLower) ||
        v.tin_number.toLowerCase().includes(searchLower)
      );
    });

  const paginatedVerifications = filteredVerifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredVerifications.length / itemsPerPage);

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
      fetchVerifications();
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
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Seller Verifications</h1>
        <div className="mt-4 sm:mt-0">
          <div className="flex space-x-4">
            <select 
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
            </select>
            <div className="relative">
              <input
                type="search"
                placeholder="Search sellers..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 pl-10"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {['all', 'pending', 'approved', 'rejected'].map((status) => {
          const count = verifications.filter(v => 
            status === 'all' ? true : v.status === status
          ).length;
          
          return (
            <div key={status} className="bg-white rounded-lg shadow px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900">
                    {count}
                  </div>
                </div>
                <div className={`rounded-full p-3 ${
                  status === 'approved' ? 'bg-green-100' :
                  status === 'pending' ? 'bg-yellow-100' :
                  status === 'rejected' ? 'bg-red-100' :
                  'bg-gray-100'
                }`}>
                  {/* Add appropriate icon for each status */}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white shadow-sm rounded-lg">
        {paginatedVerifications.map((verification) => (
          <div key={verification.id} className="border-b border-gray-200 last:border-0">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Business Info Section */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Business Information</h3>
                    <div className="space-y-2">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{verification.business_name}</p>
                        <p className="text-sm text-gray-600">{verification.legal_business_name}</p>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {verification.business_email}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {verification.business_phone}
                      </div>
                    </div>
                  </div>

                  {/* Tax Info Section */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Tax Information</h3>
                    <div className="space-y-2 bg-gray-50 p-3 rounded-md">
                      <div>
                        <span className="text-xs text-gray-500">TIN Number</span>
                        <p className="text-sm font-medium text-gray-900">{verification.tin_number}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">VAT Status</span>
                        <p className="text-sm font-medium text-gray-900">
                          {verification.is_vat_registered ? (
                            <span className="text-green-600">VAT Registered</span>
                          ) : (
                            <span className="text-gray-600">Not VAT Registered</span>
                          )}
                        </p>
                      </div>
                      {verification.is_vat_registered && (
                        <div>
                          <span className="text-xs text-gray-500">VAT Number</span>
                          <p className="text-sm font-medium text-gray-900">{verification.vat_number}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address Section */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Address</h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-900">Region:</span>
                        <p className="text-sm text-gray-600">{verification.region}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">Kifle Ketema:</span>
                        <p className="text-sm text-gray-600">{verification.kifle_ketema}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">Woreda:</span>
                        <p className="text-sm text-gray-600">{verification.woreda}</p>
                      </div>
                      {verification.kebele && (
                        <div>
                          <span className="text-sm font-medium text-gray-900">Kebele:</span>
                          <p className="text-sm text-gray-600">{verification.kebele}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-medium text-gray-900">House No:</span>
                        <p className="text-sm text-gray-600">{verification.house_no}</p>
                      </div>
                    </div>
                  </div>

                  {/* Documents Section */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Documents</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleDocumentClick(verification.trade_license_url, 'Trade License')}
                        className="flex items-center p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-gray-700">Trade License</span>
                      </button>
                      <button 
                        onClick={() => handleDocumentClick(verification.tin_certificate_url, 'TIN Certificate')}
                        className="flex items-center p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-gray-700">TIN Certificate</span>
                      </button>
                      <button 
                        onClick={() => handleDocumentClick(verification.memorandum_url, 'Memorandum')}
                        className="flex items-center p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-gray-700">Memorandum</span>
                      </button>
                      <button 
                        onClick={() => handleDocumentClick(verification.id_document_url, 'ID Document')}
                        className="flex items-center p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-gray-700">ID Document</span>
                      </button>
                    </div>
                  </div>

                  {/* Status & Actions Section */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Status & Actions</h3>
                    <div className="bg-gray-50 p-4 rounded-md">
                      <div className="flex items-center justify-between mb-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${verification.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            verification.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'}`
                        }>
                          {verification.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(verification.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      
                      {verification.status === 'pending' ? (
                        <div className="space-y-2">
                          <button
                            onClick={() => handleStatusUpdate(verification.id, 'approved')}
                            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedVerificationId(verification.id);
                              setShowReasonInput(true);
                            }}
                            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStatusUpdate(verification.id, 'pending')}
                          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                        >
                          Reconsider
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

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

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Previous
            </button>
            {[...Array(totalPages)].map((_, i) => (
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
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
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

export default withAdminAuth(VerificationsPage); 