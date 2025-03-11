'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { TelebirrPayment } from '@/utils/telebirr-payment';
import { siteConfig } from '@/config/site';

interface Withdrawal {
  id: string;
  amount: number;
  withdrawal_method: 'bank' | 'telebirr';
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  telebirr_number?: string;
  telebirr_name?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requested_at: string;
  completed_at?: string;
  notes?: string;
}

export default function ManageWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [withdrawalMethods, setWithdrawalMethods] = useState({
    telebirr: {
      isActive: false,
      number: '',
      name: ''
    },
    bank: {
      isActive: true,
      name: '',
      accountNumber: '',
      accountHolder: ''
    }
  });

  const supabase = createClientComponent();

  useEffect(() => {
    fetchWithdrawals();
  }, [selectedStatus]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const query = supabase
        .from('platform_withdrawals')
        .select('*')
        .order('requested_at', { ascending: false });

      if (selectedStatus !== 'all') {
        query.eq('status', selectedStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast.error('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const updateWithdrawalStatus = async (
    withdrawalId: string, 
    newStatus: 'processing' | 'completed' | 'failed',
    notes?: string
  ) => {
    try {
      setProcessing(prev => ({ ...prev, [withdrawalId]: true }));

      const { error } = await supabase
        .from('platform_withdrawals')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          notes: notes
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      toast.success(`Withdrawal ${newStatus} successfully`);
      fetchWithdrawals();
    } catch (error) {
      console.error('Error updating withdrawal:', error);
      toast.error('Failed to update withdrawal');
    } finally {
      setProcessing(prev => ({ ...prev, [withdrawalId]: false }));
    }
  };

  const handleSaveSettings = async () => {
    const { error } = await supabase
      .from('platform_settings')
      .upsert({
        withdrawal_methods: withdrawalMethods
      });
    
    if (!error) {
      toast.success('Withdrawal settings updated');
    }
  };

  const renderPaymentDetails = (withdrawal: Withdrawal) => {
    if (withdrawal.withdrawal_method === 'telebirr') {
      return (
        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
          <div>Telebirr</div>
          <div>{withdrawal.telebirr_name}</div>
          <div className="text-xs">{withdrawal.telebirr_number}</div>
        </td>
      );
    }

    return (
      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
        <div>{withdrawal.bank_name}</div>
        <div className="text-xs">{withdrawal.account_number}</div>
      </td>
    );
  };

  const handleProcessWithdrawal = async (withdrawal: Withdrawal) => {
    try {
      setProcessing(prev => ({ ...prev, [withdrawal.id]: true }));

      if (withdrawal.withdrawal_method === 'telebirr') {
        // Implement Telebirr transfer here using their API
        // This is a placeholder for the actual implementation
        await processTelebirrTransfer(withdrawal);
      }

      // Update withdrawal status
      await updateWithdrawalStatus(withdrawal.id, 'processing');
      
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toast.error('Failed to process withdrawal');
    } finally {
      setProcessing(prev => ({ ...prev, [withdrawal.id]: false }));
    }
  };

  const processTelebirrTransfer = async (withdrawal: Withdrawal) => {
    // This would be your actual Telebirr transfer implementation
    // Using their business-to-business transfer API
    const telebirr = new TelebirrPayment({
      merchant_code: process.env.NEXT_PUBLIC_TELEBIRR_MERCHANT_CODE!,
      app_id: process.env.NEXT_PUBLIC_TELEBIRR_APP_ID!,
      app_key: process.env.NEXT_PUBLIC_TELEBIRR_APP_KEY!,
      public_key: process.env.NEXT_PUBLIC_TELEBIRR_PUBLIC_KEY!,
      private_key: process.env.NEXT_PUBLIC_TELEBIRR_PRIVATE_KEY!,
      notify_url: `${siteConfig.url}/api/telebirr/withdrawal-notify`,
      redirect_url: `${siteConfig.url}/admin/withdrawals/manage`
    });

    const transferResult = await telebirr.transfer({
      amount: withdrawal.amount,
      recipient: withdrawal.telebirr_number!,
      description: `Platform withdrawal #${withdrawal.id}`
    });

    return transferResult;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">Manage Withdrawal Methods</h1>
      
      {/* Telebirr Settings */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-medium mb-4">Telebirr Account</h2>
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={withdrawalMethods.telebirr.isActive}
              onChange={(e) => setWithdrawalMethods({
                ...withdrawalMethods,
                telebirr: {
                  ...withdrawalMethods.telebirr,
                  isActive: e.target.checked
                }
              })}
              className="h-4 w-4 text-green-600"
            />
            <label className="ml-2">Enable Telebirr withdrawals</label>
          </div>
          
          {withdrawalMethods.telebirr.isActive && (
            <>
              <input
                type="text"
                placeholder="Telebirr Number"
                value={withdrawalMethods.telebirr.number}
                onChange={(e) => setWithdrawalMethods({
                  ...withdrawalMethods,
                  telebirr: {
                    ...withdrawalMethods.telebirr,
                    number: e.target.value
                  }
                })}
                className="block w-full border-gray-300 rounded-md shadow-sm"
              />
              <input
                type="text"
                placeholder="Account Name"
                value={withdrawalMethods.telebirr.name}
                onChange={(e) => setWithdrawalMethods({
                  ...withdrawalMethods,
                  telebirr: {
                    ...withdrawalMethods.telebirr,
                    name: e.target.value
                  }
                })}
                className="block w-full border-gray-300 rounded-md shadow-sm"
              />
            </>
          )}
        </div>
      </div>

      {/* Bank Settings */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4">Bank Account</h2>
        {/* Bank account fields */}
      </div>

      <div className="mt-6">
        <button
          onClick={handleSaveSettings}
          className="bg-green-600 text-white px-4 py-2 rounded-md"
        >
          Save Settings
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Manage Withdrawals</h1>
            <p className="mt-2 text-sm text-gray-700">
              Review and process platform withdrawal requests
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
            >
              <option value="all">All Requests</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Requested By
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Amount
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Payment Method
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Status
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Requested At
                      </th>
                      <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {withdrawals.map((withdrawal) => (
                      <tr key={withdrawal.id}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {withdrawal.withdrawal_method === 'telebirr' ? 
                            withdrawal.telebirr_name : 
                            withdrawal.account_holder}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                          {formatCurrency(withdrawal.amount)}
                        </td>
                        {renderPaymentDetails(withdrawal)}
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            withdrawal.status === 'completed' ? 'bg-green-100 text-green-800' :
                            withdrawal.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            withdrawal.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {withdrawal.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {new Date(withdrawal.requested_at).toLocaleDateString()}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          {withdrawal.status === 'pending' && (
                            <button
                              onClick={() => handleProcessWithdrawal(withdrawal)}
                              disabled={processing[withdrawal.id]}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              {processing[withdrawal.id] ? 'Processing...' : 'Process'}
                            </button>
                          )}
                          {withdrawal.status === 'processing' && (
                            <button
                              onClick={() => updateWithdrawalStatus(withdrawal.id, 'completed')}
                              disabled={processing[withdrawal.id]}
                              className="text-green-600 hover:text-green-900"
                            >
                              Complete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 