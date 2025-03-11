'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';

interface VATStats {
  totalVAT: number;
  monthlyVAT: number;
  quarterlyVAT: number;
  yearlyVAT: number;
}

interface VATTransaction {
  id: string;
  created_at: string;
  order_id: string;
  subtotal: number;
  vat_amount: number;
  payment_status: string;
}

export default function VATReportPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<VATStats>({
    totalVAT: 0,
    monthlyVAT: 0,
    quarterlyVAT: 0,
    yearlyVAT: 0
  });
  const [transactions, setTransactions] = useState<VATTransaction[]>([]);
  const [dateRange, setDateRange] = useState('month'); // month, quarter, year, all
  
  const supabase = createClientComponent();

  useEffect(() => {
    fetchVATData();
  }, [dateRange]);

  const fetchVATData = async () => {
    try {
      setLoading(true);

      // Get date range
      const now = new Date();
      let startDate;
      
      switch(dateRange) {
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = null;
      }

      // Fetch transactions with VAT
      const query = supabase
        .from('transactions')
        .select('*')
        .eq('payment_status', 'completed');

      if (startDate) {
        query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate VAT stats
      const vatStats = {
        totalVAT: 0,
        monthlyVAT: 0,
        quarterlyVAT: 0,
        yearlyVAT: 0
      };

      const currentMonth = now.getMonth();
      const currentQuarter = Math.floor(currentMonth / 3);
      const currentYear = now.getFullYear();

      data?.forEach(transaction => {
        const transDate = new Date(transaction.created_at);
        const vatAmount = transaction.vat_amount || 0;

        vatStats.totalVAT += vatAmount;

        if (transDate.getFullYear() === currentYear) {
          vatStats.yearlyVAT += vatAmount;

          if (Math.floor(transDate.getMonth() / 3) === currentQuarter) {
            vatStats.quarterlyVAT += vatAmount;

            if (transDate.getMonth() === currentMonth) {
              vatStats.monthlyVAT += vatAmount;
            }
          }
        }
      });

      setStats(vatStats);
      setTransactions(data || []);

    } catch (error) {
      console.error('Error fetching VAT data:', error);
      toast.error('Failed to load VAT data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">VAT Report</h1>
          <p className="mt-2 text-sm text-gray-700">
            Track and manage Value Added Tax (VAT) for your platform
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Monthly VAT</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(stats.monthlyVAT)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Quarterly VAT</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(stats.quarterlyVAT)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Yearly VAT</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(stats.yearlyVAT)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total VAT Collected</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(stats.totalVAT)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="mt-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subtotal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VAT Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.order_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(transaction.subtotal)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(transaction.vat_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 