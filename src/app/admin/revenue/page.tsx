'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';

// Define the Transaction interface
interface Transaction {
  id: string;
  platform_revenue: number;
  platform_payout_status: 'pending' | 'completed';
  created_at: string;
  // Add other transaction fields as needed
}

export default function RevenuePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingPayouts: 0,
    completedPayouts: 0
  });

  const supabase = createClientComponent();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTransactions(data as Transaction[]);
      
      // Calculate stats
      const stats = data.reduce((acc, trans: Transaction) => ({
        totalRevenue: acc.totalRevenue + trans.platform_revenue,
        pendingPayouts: acc.pendingPayouts + (trans.platform_payout_status === 'pending' ? trans.platform_revenue : 0),
        completedPayouts: acc.completedPayouts + (trans.platform_payout_status === 'completed' ? trans.platform_revenue : 0)
      }), { totalRevenue: 0, pendingPayouts: 0, completedPayouts: 0 });

      setStats(stats);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">Platform Revenue</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Total Revenue</h3>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {formatCurrency(stats.totalRevenue)}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Pending Revenue</h3>
          <p className="mt-2 text-3xl font-bold text-yellow-600">
            {formatCurrency(stats.pendingPayouts)}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Paid Out</h3>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            {formatCurrency(stats.completedPayouts)}
          </p>
        </div>
      </div>

      {/* Transaction list */}
      <div className="bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Table headers and transaction rows */}
        </table>
      </div>
    </div>
  );
} 