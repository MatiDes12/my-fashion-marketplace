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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Seller Verifications</h1>
      
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Business Information
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax Information
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status & Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {verifications.map((verification) => (
                <tr key={verification.id}>
                  {/* Business Information */}
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-900">Business Name:</span>
                        <p className="text-sm text-gray-600">{verification.business_name}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">Legal Name:</span>
                        <p className="text-sm text-gray-600">{verification.legal_business_name}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">Email:</span>
                        <p className="text-sm text-gray-600">{verification.business_email}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">Phone:</span>
                        <p className="text-sm text-gray-600">{verification.business_phone}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">Registration No:</span>
                        <p className="text-sm text-gray-600">{verification.business_registration_no}</p>
                      </div>
                    </div>
                  </td>

                  {/* Tax Information */}
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-900">TIN Number:</span>
                        <p className="text-sm text-gray-600">{verification.tin_number}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">VAT Registered:</span>
                        <p className="text-sm text-gray-600">
                          {verification.is_vat_registered ? 'Yes' : 'No'}
                        </p>
                      </div>
                      {verification.is_vat_registered && (
                        <div>
                          <span className="text-sm font-medium text-gray-900">VAT Number:</span>
                          <p className="text-sm text-gray-600">{verification.vat_number}</p>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Address */}
                  <td className="px-6 py-4">
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
                  </td>

                  {/* Documents */}
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <button 
                        onClick={() => handleDocumentClick(verification.trade_license_url, 'Trade License')}
                        className="block text-sm text-blue-600 hover:text-blue-800"
                      >
                        Trade License
                      </button>
                      <button 
                        onClick={() => handleDocumentClick(verification.tin_certificate_url, 'TIN Certificate')}
                        className="block text-sm text-blue-600 hover:text-blue-800"
                      >
                        TIN Certificate
                      </button>
                      <button 
                        onClick={() => handleDocumentClick(verification.memorandum_url, 'Memorandum')}
                        className="block text-sm text-blue-600 hover:text-blue-800"
                      >
                        Memorandum
                      </button>
                      <div>
                        <span className="text-sm font-medium text-gray-900">ID Type:</span>
                        <p className="text-sm text-gray-600">{verification.id_document_type}</p>
                      </div>
                      <button 
                        onClick={() => handleDocumentClick(verification.id_document_url, 'ID Document')}
                        className="block text-sm text-blue-600 hover:text-blue-800"
                      >
                        ID Document
                      </button>
                    </div>
                  </td>

                  {/* Status & Actions */}
                  <td className="px-6 py-4">
                    <div className="space-y-4">
                      <div>
                        <span className="text-sm font-medium text-gray-900">Created:</span>
                        <p className="text-sm text-gray-600">
                          {format(new Date(verification.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          verification.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          verification.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {verification.status}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {verification.status === 'pending' ? (
                          <div className="space-x-2">
                            <button
                              onClick={() => handleStatusUpdate(verification.id, 'approved')}
                              className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(verification.id, 'rejected')}
                              className="bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStatusUpdate(verification.id, 'pending')}
                            className="bg-yellow-600 text-white px-3 py-1 rounded-md text-sm hover:bg-yellow-700"
                          >
                            Reconsider
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDocument && (
        <DocumentPreviewModal
          url={selectedDocument.url}
          title={selectedDocument.title}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </div>
  );
}

export default withAdminAuth(VerificationsPage); 