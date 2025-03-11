'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';

interface WithdrawalFormData {
  amount: string;
  withdrawal_method: 'bank' | 'telebirr';
  bank_name: string;
  account_number: string;
  account_holder: string;
  telebirr_number?: string;
  telebirr_name?: string;
}

interface PlatformStats {
  total_platform_fees: number;
  total_service_fees: number;
  total_vat: number;
  total_revenue: number;
}

export default function WithdrawalsPage() {
  const [availableBalance, setAvailableBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<WithdrawalFormData>({
    amount: '',
    withdrawal_method: 'bank',
    bank_name: '',
    account_number: '',
    account_holder: '',
    telebirr_number: '',
    telebirr_name: ''
  });
  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    total_platform_fees: 0,
    total_service_fees: 0,
    total_vat: 0,
    total_revenue: 0
  });

  const supabase = createClientComponent();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get platform stats using raw SQL query
      const { data: stats, error: statsError } = await supabase
        .rpc('get_platform_stats'); // We'll create this function

      if (statsError) throw statsError;
      setPlatformStats(stats || {
        total_platform_fees: 0,
        total_service_fees: 0,
        total_vat: 0,
        total_revenue: 0
      });

      // Get total withdrawals
      const { data: withdrawalsData } = await supabase
        .from('platform_withdrawals')
        .select('*')
        .order('requested_at', { ascending: false });

      if (stats) {
        const totalWithdrawn = withdrawalsData?.reduce((sum, w) => 
          w.status === 'completed' ? sum + (w.amount || 0) : sum, 0) || 0;
        
        setAvailableBalance(stats.total_revenue - totalWithdrawn);
        setWithdrawals(withdrawalsData || []);
      }

    } catch (error) {
      console.error('Error fetching withdrawal data:', error);
      toast.error('Failed to load withdrawal data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);

      // Validate amount
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0 || amount > availableBalance) {
        toast.error('Invalid withdrawal amount');
        return;
      }

      // Create withdrawal request
      const { error } = await supabase
        .from('platform_withdrawals')
        .insert({
          amount,
          bank_name: formData.bank_name,
          account_number: formData.account_number,
          account_holder: formData.account_holder,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Withdrawal request submitted successfully');
      setFormData({
        amount: '',
        withdrawal_method: 'bank',
        bank_name: '',
        account_number: '',
        account_holder: '',
        telebirr_number: '',
        telebirr_name: ''
      });
      fetchData();

    } catch (error) {
      console.error('Error submitting withdrawal:', error);
      toast.error('Failed to submit withdrawal request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Withdrawal Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-6">Request Withdrawal</h2>
          
          <div className="mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Available Balance</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(availableBalance)}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Amount
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    max={availableBalance}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Withdrawal Method
                </label>
                <select
                  value={formData.withdrawal_method}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    withdrawal_method: e.target.value as 'bank' | 'telebirr' 
                  })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="telebirr">Telebirr</option>
                </select>
              </div>

              {formData.withdrawal_method === 'bank' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Bank Name
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        required
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Account Number
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        required
                        value={formData.account_number}
                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                        className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Account Holder Name
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        required
                        value={formData.account_holder}
                        onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                        className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </>
              )}

              {formData.withdrawal_method === 'telebirr' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Telebirr Number
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.telebirr_number}
                      onChange={(e) => setFormData({ ...formData, telebirr_number: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Telebirr Account Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.telebirr_name}
                      onChange={(e) => setFormData({ ...formData, telebirr_name: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={submitting || availableBalance <= 0}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Request Withdrawal'}
              </button>
            </div>
          </form>
        </div>

        {/* Withdrawal History */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900">Withdrawal History</h3>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {withdrawals.map((withdrawal: any) => (
                <li key={withdrawal.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(withdrawal.amount)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {withdrawal.bank_name} - {withdrawal.account_number}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(withdrawal.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      withdrawal.status === 'completed' ? 'bg-green-100 text-green-800' :
                      withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      withdrawal.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {withdrawal.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="text-sm font-medium text-gray-500">Platform Fees (5%)</h3>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrency(platformStats.total_platform_fees)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="text-sm font-medium text-gray-500">Service Fees (2%)</h3>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrency(platformStats.total_service_fees)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="text-sm font-medium text-gray-500">VAT Collected (15%)</h3>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrency(platformStats.total_vat)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Platform Revenue</h3>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrency(platformStats.total_revenue)}
          </p>
        </div>
      </div>
    </div>
  );
} 