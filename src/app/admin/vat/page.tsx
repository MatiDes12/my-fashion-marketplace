'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import { DateRangePicker } from '@/components/DateRangePicker';
import { LineChart } from '@/components/charts/LineChart';
import { PieChart } from '@/components/charts/PieChart';
import { BarChart } from '@/components/charts/BarChart';
import { DataTable } from '@/components/DataTable';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';

interface VATStats {
  totalVAT: number;
  monthlyVAT: number;
  quarterlyVAT: number;
  yearlyVAT: number;
  vatByCategory: Array<{
    category: string;
    amount: number;
  }>;
  dailyVAT: Array<{
    date: string;
    vat: number;
    taxableAmount: number;
  }>;
  vatBySeller: Array<{
    seller_id: string;
    seller_name: string;
    total_vat: number;
    taxable_amount: number;
    transaction_count: number;
  }>;
}

export default function VATReportPage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
  });
  const [stats, setStats] = useState<VATStats>({
    totalVAT: 0,
    monthlyVAT: 0,
    quarterlyVAT: 0,
    yearlyVAT: 0,
    vatByCategory: [],
    dailyVAT: [],
    vatBySeller: []
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchVATData();
  }, [dateRange]);

  const fetchVATData = async () => {
    try {
      setLoading(true);

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          *,
          seller:users!transactions_seller_id_fkey (
            id,
            full_name,
            email,
            store_settings
          )
        `)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Calculate daily VAT
      const dailyVAT = transactions?.reduce((acc, t) => {
        const date = new Date(t.created_at).toISOString().split('T')[0];
        const existing = acc.find(d => d.date === date);
        
        if (existing) {
          existing.vat += t.vat_amount || 0;
          existing.taxableAmount += t.subtotal || 0;
        } else {
          acc.push({
            date,
            vat: t.vat_amount || 0,
            taxableAmount: t.subtotal || 0
          });
        }
        return acc;
      }, [] as VATStats['dailyVAT']).sort((a, b) => a.date.localeCompare(b.date)) || [];

      // Calculate VAT by category
      const vatByCategory = [
        {
          category: 'Platform Fees',
          amount: transactions?.reduce((sum, t) => sum + ((t.platform_fee || 0) * 0.15), 0) || 0
        },
        {
          category: 'Service Fees',
          amount: transactions?.reduce((sum, t) => sum + ((t.service_fee || 0) * 0.15), 0) || 0
        },
        {
          category: 'Delivery Fees',
          amount: transactions?.reduce((sum, t) => sum + ((t.delivery_fee || 0) * 0.15), 0) || 0
        },
        {
          category: 'Product Sales',
          amount: transactions?.reduce((sum, t) => sum + ((t.subtotal || 0) * 0.15), 0) || 0
        }
      ];

      // Calculate VAT by seller
      const vatBySeller = transactions?.reduce((acc, t) => {
        const existing = acc.find(s => s.seller_id === t.seller?.id);
        if (existing) {
          existing.total_vat += t.vat_amount || 0;
          existing.taxable_amount += t.subtotal || 0;
          existing.transaction_count += 1;
        } else if (t.seller) {
          acc.push({
            seller_id: t.seller.id,
            seller_name: t.seller.full_name,
            total_vat: t.vat_amount || 0,
            taxable_amount: t.subtotal || 0,
            transaction_count: 1
          });
        }
        return acc;
      }, [] as VATStats['vatBySeller']) || [];

      // Calculate time-based VAT totals
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      setStats({
        totalVAT: transactions?.reduce((sum, t) => sum + (t.vat_amount || 0), 0) || 0,
        monthlyVAT: transactions?.reduce((sum, t) => 
          new Date(t.created_at) >= monthStart ? sum + (t.vat_amount || 0) : sum, 0) || 0,
        quarterlyVAT: transactions?.reduce((sum, t) => 
          new Date(t.created_at) >= quarterStart ? sum + (t.vat_amount || 0) : sum, 0) || 0,
        yearlyVAT: transactions?.reduce((sum, t) => 
          new Date(t.created_at) >= yearStart ? sum + (t.vat_amount || 0) : sum, 0) || 0,
        vatByCategory,
        dailyVAT,
        vatBySeller: vatBySeller.sort((a, b) => b.total_vat - a.total_vat)
      });

    } catch (error) {
      console.error('Error fetching VAT data:', error);
      toast.error('Failed to load VAT statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">VAT Report</h1>
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onChange={({ startDate, endDate }) => {
            if (startDate && endDate) {
              setDateRange({ start: startDate, end: endDate });
            }
          }}
        />
      </div>

      {/* VAT Summary Cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total VAT Collected"
          value={formatCurrency(stats.totalVAT)}
          subtext="All time"
        />
        <StatCard
          title="Monthly VAT"
          value={formatCurrency(stats.monthlyVAT)}
          subtext="Current month"
        />
        <StatCard
          title="Quarterly VAT"
          value={formatCurrency(stats.quarterlyVAT)}
          subtext="Current quarter"
        />
        <StatCard
          title="Yearly VAT"
          value={formatCurrency(stats.yearlyVAT)}
          subtext="Current year"
        />
      </div>

      {/* Charts */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* VAT Trend */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">VAT Collection Trend</h2>
          <LineChart
            data={[
              {
                id: "VAT",
                data: stats.dailyVAT.map(d => ({
                  x: d.date,
                  y: d.vat
                }))
              },
              {
                id: "Taxable Amount",
                data: stats.dailyVAT.map(d => ({
                  x: d.date,
                  y: d.taxableAmount
                }))
              }
            ]}
            height={300}
          />
        </div>

        {/* VAT by Category */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">VAT by Category</h2>
          <PieChart
            data={stats.vatByCategory.map(c => ({
              id: c.category,
              label: c.category,
              value: c.amount
            }))}
            height={300}
          />
        </div>
      </div>

      {/* VAT by Seller Table */}
      <div className="mt-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900">VAT by Seller</h3>
          </div>
          <DataTable
            data={stats.vatBySeller}
            columns={[
              {
                header: 'Seller',
                accessor: 'seller_name',
              },
              {
                header: 'VAT Collected',
                accessor: 'total_vat',
                cell: (row) => formatCurrency(row.total_vat)
              },
              {
                header: 'Taxable Amount',
                accessor: 'taxable_amount',
                cell: (row) => formatCurrency(row.taxable_amount)
              },
              {
                header: 'Transactions',
                accessor: 'transaction_count',
              },
              {
                header: 'Average VAT/Transaction',
                accessor: 'avg_vat',
                cell: (row) => formatCurrency(row.total_vat / row.transaction_count)
              }
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtext }: { 
  title: string; 
  value: string; 
  subtext: string;
}) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-1">
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
            <dd className="mt-1 text-sm text-gray-500">{subtext}</dd>
          </div>
        </div>
      </div>
    </div>
  );
} 