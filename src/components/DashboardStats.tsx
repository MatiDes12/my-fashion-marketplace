import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';

// Custom Tooltip Component
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => {
  return (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

export interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  pendingPayouts: number;
  allPendingPayouts: number;
  completedPayouts: number;
  recentTransactions: any[];
  dailyRevenue: Array<{
    date: string;
    revenue: number;
    transactions: number;
  }>;
  paymentMethods: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
}

export const fetchDashboardStats = async (dateRange?: { start: Date | null; end: Date | null }) => {
  const supabase = createClientComponent();

  let query = supabase
    .from('transactions')
    .select(`
      *,
      seller:users!transactions_seller_id_fkey (
        id,
        full_name,
        email,
        store_settings
      ),
      order:orders!transactions_order_id_fkey (
        id,
        tx_ref,
        payment_reference,
        order_status,
        payment_status,
        product:products!orders_product_id_fkey (
          id,
          title
        )
      )
    `)
    .order('created_at', { ascending: false });

  // Apply date filters only if dates are provided
  if (dateRange?.start) {
    const startDate = new Date(dateRange.start);
    startDate.setHours(0, 0, 0, 0);
    query = query.gte('created_at', startDate.toISOString());
  }
  if (dateRange?.end) {
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);
    query = query.lte('created_at', endDate.toISOString());
  }

  const { data: transactions, error: transactionError } = await query;

  if (transactionError) throw transactionError;

  // Calculate daily revenue (platform profit)
  const dailyRevenue = transactions?.reduce((acc, t) => {
    const date = new Date(t.created_at).toISOString().split('T')[0];
    const platformProfit = (t.service_fee || 0) + (t.platform_fee || 0);
    
    const existing = acc.find((d: { date: string }) => d.date === date);
    if (existing) {
      existing.revenue += platformProfit;
      existing.transactions += 1;
    } else {
      acc.push({
        date,
        revenue: platformProfit,
        transactions: 1
      });
    }
    return acc;
  }, [] as DashboardStats['dailyRevenue']).sort((a: {date: string}, b: {date: string}) => a.date.localeCompare(b.date)) || [];

  // Calculate payment method stats
  const paymentMethods = transactions?.reduce((acc, t) => {
    const existing = acc.find((p: { method: string }) => p.method === t.payment_method);
    if (existing) {
      existing.count += 1;
      existing.amount += t.total_amount || 0;
    } else {
      acc.push({
        method: t.payment_method,
        count: 1,
        amount: t.total_amount || 0
      });
    }
    return acc;
  }, [] as DashboardStats['paymentMethods']) || [];

  // Get other stats
  const { count: userCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  // Calculate pending payouts - only for completed orders (delivered/picked up)
  const pendingPayouts = transactions?.reduce((sum, t) => {
    if (t.seller_payout_status === 'pending' && 
        t.payment_status === 'paid' && 
        (t.order?.order_status === 'delivered' || t.order?.order_status === 'picked up')) {
      return sum + (t.seller_payout_amount || 0);
    }
    return sum;
  }, 0) || 0;

  // Calculate completed payouts
  const completedPayouts = transactions?.reduce((sum, t) => {
    if (t.seller_payout_status === 'completed' && t.payment_status === 'paid') {
      return sum + (t.seller_payout_amount || 0);
    }
    return sum;
  }, 0) || 0;

  // Calculate total platform revenue (service fee + platform fee)
  const totalRevenue = transactions?.reduce((sum, t) => 
    sum + ((t.service_fee || 0) + (t.platform_fee || 0)), 0) || 0;

  const stats: DashboardStats = {
    totalUsers: userCount || 0,
    totalProducts: productCount || 0,
    totalOrders: transactions?.length || 0,
    totalRevenue: totalRevenue,
    pendingPayouts: pendingPayouts,
    allPendingPayouts: transactions?.filter(t => t.seller_payout_status === 'pending' && t.payment_status === 'paid').reduce((sum, t) => sum + (t.seller_payout_amount || 0), 0) || 0,
    completedPayouts: completedPayouts,
    recentTransactions: transactions?.slice(0, 5) || [],
    dailyRevenue,
    paymentMethods
  };

  // Debug logging
  console.log('Dashboard Stats Debug:', {
    dateRange: dateRange ? {
      start: dateRange.start?.toISOString(),
      end: dateRange.end?.toISOString()
    } : 'All Time',
    transactionsCount: transactions?.length || 0,
    totalRevenue,
    sellerPayout: pendingPayouts,
    completedPayouts,
    sellerPayoutBreakdown: transactions?.filter(t => 
      t.seller_payout_status === 'pending' && 
      t.payment_status === 'paid'
    ).map(t => ({
      orderStatus: t.order?.order_status,
      amount: t.seller_payout_amount,
      isCompleted: t.order?.order_status === 'delivered' || t.order?.order_status === 'picked up'
    })) || []
  });

  return stats;
};

// Stat Card Component
export function StatCard({ title, value, trend }: { title: string; value: string; trend: number }) {
  const getIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case 'total revenue':
        return (
          <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'total orders':
        return (
          <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
          </svg>
        );
      case 'seller payout':
        return (
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'all pending payouts':
        return (
          <svg className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'completed payouts':
        return (
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-shadow duration-300">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <Tooltip content={title}>
              <p className="text-sm font-medium text-gray-600 mb-2 truncate">{title}</p>
            </Tooltip>
            <Tooltip content={value}>
              <p 
                className="text-2xl font-bold text-gray-900 mb-2 truncate cursor-help" 
                style={{ 
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
              >
                {value}
              </p>
            </Tooltip>
            <div className={`flex items-center text-sm font-medium ${
              trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>
              {trend > 0 ? (
                <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              ) : trend < 0 ? (
                <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                </svg>
              )}
              <Tooltip content={`${trend > 0 ? '+' : ''}${trend}%`}>
                <span className="truncate cursor-help">
                  {trend > 0 ? '+' : ''}{trend}%
                </span>
              </Tooltip>
            </div>
          </div>
          <div className="flex-shrink-0 ml-3 p-2 bg-gray-50 rounded-lg">
            {getIcon(title)}
          </div>
        </div>
      </div>
    </div>
  );
} 