'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { formatCurrency } from '@/utils/currency';
import { toast } from 'react-hot-toast';
import PickupCodeDisplay from '@/components/PickupCodeDisplay';
import { Html5Qrcode } from 'html5-qrcode';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface User {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  owner_id: string;
}

interface Order {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  order_status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'picked up';
  service_fee: number;
  payment_status?: string;
  payment_reference?: string;
  tx_ref?: string;
  receipt_url?: string;
  delivery_fee: number;
  delivery_proof_image?: string;
  delivery_method?: 'home_delivery' | 'store_pickup';
  delivery_address?: string;
  product?: Product;
  user?: User;
  transaction?: {
    customer_phone?: string;
    payment_method?: string;
    payment_status?: string;
    subtotal?: number;
    platform_fee?: number;
    service_fee?: number;
    delivery_fee?: number;
    vat_amount?: number;
    total_amount?: number;
    seller_payout_amount?: number;
    platform_revenue?: number;
    seller_payout_status?: string;
  } | null;
  selected_size?: string;
  selected_color?: string;
  selected_variant_sku?: string;
  pickup_code?: string;
  pickup_code_verified?: boolean;
  pickup_code_verified_at?: string;
}

// Add new interface for grouped orders
interface OrderGroup {
  payment_reference: string;
  orders: Order[];
  total: number;
  created_at: string;
  payment_status: string;
  order_status: string;
  is_cash_payment: boolean;
  tx_ref: string;
  receipt_url: string;
}

// Helper function to get base payment reference
const getBasePaymentRef = (paymentRef: string) => {
  if (!paymentRef) return null;
  // For cash payments, extract the base reference (before the last hyphen)
  if (paymentRef.startsWith('CASH-')) {
    const parts = paymentRef.split('-');
    // Remove the last part (variant) and join back
    return parts.slice(0, -1).join('-');
  }
  // For Chapa payments, use as is
  return paymentRef;
};

interface OrderWithUser {
  id: string;
  created_at: string;
  quantity: number;
  total_price: number;
  order_status: Order['order_status'];
  user_id: string;
  service_fee: number;
  payment_status?: string;
  payment_reference?: string;
  tx_ref?: string;
  receipt_url?: string;
  user: User;  // Not an array, just a single user object
}

interface SupabaseOrder {
  id: string;
  created_at: string;
  quantity: number;
  total_price: number;
  order_status: Order['order_status'];
  user_id: string;
  service_fee: number;
  payment_status?: string;
  payment_reference?: string;
  tx_ref?: string;
  receipt_url?: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
  };
}

// Add a simple device detection hook
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640 || /Mobi|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
}

// Helper function to extract short reference
const getShortReference = (paymentRef: string | undefined) => {
  if (!paymentRef) return '';
  // Extract the second-to-last part (the short ID)
  const parts = paymentRef.split('-');
  if (parts.length >= 2) {
    return parts[parts.length - 2]; // Get second-to-last part
  }
  return paymentRef; // Return full reference if not enough parts
};

// Helper function to extract size and color from SKU
const getSizeAndColorFromSku = (sku: string | undefined) => {
  if (!sku) return '';
  // Extract the size and color parts (last two parts)
  const parts = sku.split('-');
  if (parts.length >= 2) {
    const size = parts[parts.length - 2]; // Second-to-last part
    const color = parts[parts.length - 1]; // Last part
    return `${size}-${color}`;
  }
  return sku; // Return full SKU if not enough parts
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<OrderGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponent();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // Remove old orderStats state
  // Add new stats state for all breakdowns
  const [stats, setStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    moneyReceived: 0,
    pendingPayouts: 0,
    byStatus: {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      pickedup: 0,
      cancelled: 0,
    },
    byPaymentStatus: {
      paid: 0,
      pending: 0,
      other: 0,
    },
    byPayoutStatus: {
      received: 0,
      pending: 0,
      notEligible: 0,
    },
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('all');
  const [filteredOrders, setFilteredOrders] = useState<OrderGroup[]>([]);
  const [isPickupVerifyModalOpen, setIsPickupVerifyModalOpen] = useState(false);
  const [verifyingPickup, setVerifyingPickup] = useState(false);
  const [pickupCode, setPickupCode] = useState('');
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isCameraAvailable, setIsCameraAvailable] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'qr-reader';
  const isMobile = useIsMobile();

  // Function to generate a random pickup code
  const generatePickupCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleScanResult = async (decodedText: string) => {
    console.log("QR Code detected:", decodedText);
    
    // First safely stop the scanner
    await safeStopScanner();
    
    // Then verify the code
    await verifyPickupCode(decodedText);
  };

  const handleScanError = (error: any) => {
    console.error('Scan error:', error);
    toast.error('Failed to scan QR code');
    setIsScanning(false);
  };

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login?message=Please login to access the dashboard');
          return;
        }

        // First get all products owned by the seller
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, owner_id')
          .eq('owner_id', session.user.id);

        if (productsError) {
          console.error('Products error:', productsError);
          throw productsError;
        }

        if (!products || products.length === 0) {
          setOrders([]);
          return;
        }

        // Debug: Check what products we have
        console.log('Seller products:', products);

        // Then fetch orders for these products with proper joins
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            *,
            product:products!inner(
              id,
              title,
              price,
              owner_id
            ),
            user:users(
              id,
              full_name,
              email,
              phone
            ),
            transaction:transactions(
              customer_phone,
              payment_method,
              payment_status,
              subtotal,
              platform_fee,
              service_fee,
              delivery_fee,
              vat_amount,
              total_amount,
              seller_payout_amount,
              platform_revenue,
              seller_payout_status
            )
          `)
          .in('product_id', products.map(p => p.id))
          .order('created_at', { ascending: false });

        if (ordersError) {
          console.error('Orders error:', ordersError);
          throw ordersError;
        }

        console.log('Raw orders data:', ordersData);

        // Collect all unique user_ids and product_ids that need to be fetched
        const missingUserIds = ordersData
          .filter(order => !order.user?.[0] && order.user_id)
          .map(order => order.user_id);
        
        const missingProductIds = ordersData
          .filter(order => !order.product?.[0] && order.product_id)
          .map(order => order.product_id);

        console.log('Missing user IDs:', missingUserIds);
        console.log('Missing product IDs:', missingProductIds);

        // Fetch missing user data in bulk
        let bulkUserData: any[] = [];
        if (missingUserIds.length > 0) {
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, full_name, email, phone')
            .in('id', missingUserIds);
          
          if (!usersError && users) {
            bulkUserData = users;
            console.log('Bulk fetched user data:', bulkUserData);
          } else {
            console.error('Error fetching bulk user data:', usersError);
          }
        }

        // Fetch missing product data in bulk
        let bulkProductData: any[] = [];
        if (missingProductIds.length > 0) {
          const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, title, price, owner_id')
            .in('id', missingProductIds);
          
          if (!productsError && products) {
            bulkProductData = products;
            console.log('Bulk fetched product data:', bulkProductData);
          } else {
            console.error('Error fetching bulk product data:', productsError);
          }
        }

        // Transform and set the orders
        const transformedOrders = ordersData.map(order => {
          console.log('Processing order:', {
            id: order.id,
            user_id: order.user_id,
            product_id: order.product_id,
            pickup_code: order.pickup_code,
            delivery_method: order.delivery_method,
            user: order.user,
            product: order.product
          });
          
          // Get user data from join or bulk fetch
          let userData = order.user?.[0] || null;
          if (!userData && order.user_id) {
            userData = bulkUserData.find(user => user.id === order.user_id) || null;
          }

          // Get product data from join or bulk fetch
          let productData = order.product?.[0] || null;
          if (!productData && order.product_id) {
            productData = bulkProductData.find(product => product.id === order.product_id) || null;
          }
          
          return {
            ...order,
            product: productData,
            user: userData,
            transaction: order.transaction?.[0] || null
          };
        }) as Order[];

        console.log('Transformed orders:', transformedOrders);
        setOrders(transformedOrders);

      } catch (error) {
        console.error('Error in fetchOrders:', error);
        setError('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [router]);

  useEffect(() => {
    // Debug current user session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session);
      
      if (session) {
        // Debug user's products
        const { data: products } = await supabase
          .from('products')
          .select('id, title')
          .eq('owner_id', session.user.id);
        
        console.log('User products:', products);
        
        // Debug orders for these products
        if (products && products.length > 0) {
          const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .in('product_id', products.map(p => p.id));
            
          console.log('Orders for products:', orders);
        }
      }
    };
    
    checkSession();
  }, []);

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);

      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('File type must be JPEG, PNG, or GIF');
      }

      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      console.log('Attempting to upload to:', filePath);

      // Upload image to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('delivery-proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL using the correct method
      const publicUrl = supabase.storage
        .from('delivery-proofs')
        .getPublicUrl(filePath).data.publicUrl;

      if (!publicUrl) {
        throw new Error('Failed to get public URL');
      }

      console.log('Upload successful, public URL:', publicUrl);
      return publicUrl;

    } catch (error) {
      console.error('Error uploading image:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload image');
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  // Modify handleUpdateStatus to handle pickup code generation
  const handleUpdateStatus = async (newStatus: Order['order_status']) => {
    if (!selectedOrder) return;
    
    // Prevent changing status if already delivered/picked up
    if (selectedOrder.order_status === 'delivered' || selectedOrder.order_status === 'picked up') {
      toast.error("Cannot change status once order is marked as delivered/picked up");
      return;
    }
    
    setUpdatingStatus(true);
    try {
      const isCashPayment = selectedOrder.transaction?.payment_method === 'CASH';
      const isMarkingDelivered = newStatus === 'delivered';
      const isMarkingPickedUp = newStatus === 'picked up';
      const isPickupOrder = selectedOrder.delivery_method === 'store_pickup';

      // Only require image for delivery orders being marked as delivered
      if (isMarkingDelivered && !isPickupOrder && !selectedImage && !selectedOrder.delivery_proof_image) {
        alert('Please upload delivery proof image before marking as delivered');
        return;
      }

      // For pickup orders being confirmed, generate a pickup code
      const pickupCode = isPickupOrder && newStatus === 'confirmed' ? generatePickupCode() : null;

      let deliveryProofUrl = selectedOrder.delivery_proof_image;

      // Only upload image for delivery orders
      if (isMarkingDelivered && !isPickupOrder && selectedImage) {
        deliveryProofUrl = await handleImageUpload(selectedImage);
      }

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Update order with image URL and status
      const { data: orderUpdate, error: orderError } = await supabase
        .from('orders')
        .update({ 
          order_status: newStatus,
          updated_at: new Date().toISOString(),
          delivery_proof_image: deliveryProofUrl,
          ...(pickupCode ? { pickup_code: pickupCode } : {}),
          // Only update payment_status to paid for delivered orders
          ...(isMarkingDelivered ? { payment_status: 'paid' } : {})
        })
        .eq('id', selectedOrder.id)
        .select('*')
        .single();

      if (orderError) throw orderError;

      // If status is delivered, update the transaction
      if (isMarkingDelivered) {
        const { error: transactionError } = await supabase
          .from('transactions')
          .update({
            payment_status: 'paid',
            platform_payout_status: 'completed',
            seller_payout_status: 'pending',
            updated_at: new Date().toISOString(),
            seller_id: session.user.id
          })
          .eq('order_id', selectedOrder.id)
          .eq('seller_id', session.user.id);

        if (transactionError) throw transactionError;
      }

      // Update the local state with the new order data
      setOrders(orders.map(order => 
        order.id === selectedOrder.id 
          ? { 
              ...order, 
              order_status: newStatus,
              delivery_proof_image: deliveryProofUrl,
              updated_at: new Date().toISOString(),
              ...(pickupCode ? { pickup_code: pickupCode } : {}),
              ...(isMarkingDelivered ? {
                payment_status: 'paid',
                transaction: {
                  ...order.transaction,
                  payment_status: 'paid',
                  platform_payout_status: 'completed',
                  seller_payout_status: 'pending'
                }
              } : {})
            }
          : order
      ));

      setIsUpdateModalOpen(false);
      setSelectedOrder(null);

      if (pickupCode) {
        toast.success(`Order confirmed! Pickup code: ${pickupCode}`);
      } else {
      toast.success(`Order status updated to ${newStatus}`);
      }

    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  async function debugOrderData(supabase: any) {
    // Check orders table
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        user:users (*)
      `)
      .limit(5);

    console.log('Debug - Orders with users:', orders);
    console.log('Debug - Orders error:', ordersError);
  }

  useEffect(() => {
    debugOrderData(supabase);
  }, []);

  // Add useEffect to group orders whenever orders change
  useEffect(() => {
    if (!orders.length) return;

    // Group orders by payment reference
    const grouped = orders.reduce((acc: { [key: string]: Order[] }, order) => {
      const baseRef = getBasePaymentRef(order.payment_reference || order.tx_ref || '');
      if (!baseRef) return acc;
      
      if (!acc[baseRef]) {
        acc[baseRef] = [];
      }
      acc[baseRef].push(order);
      return acc;
    }, {});

    // Convert to array format
    const groupedArray = Object.entries(grouped).map(([ref, orders]) => {
      const total = orders.reduce((sum, order) => sum + order.total_price, 0);
      const firstOrder = orders[0];
      
      return {
        payment_reference: ref,
        orders,
        total,
        created_at: firstOrder.created_at,
        payment_status: firstOrder.payment_status || 'pending',
        order_status: firstOrder.order_status,
        is_cash_payment: ref.startsWith('CASH-'),
        tx_ref: firstOrder.tx_ref || '',
        receipt_url: firstOrder.receipt_url || ''
      };
    });

    setGroupedOrders(groupedArray);
    setFilteredOrders(groupedArray);
  }, [orders]);

  // Add a function to get the most recent order status from a group
  const getGroupStatus = (group: OrderGroup) => {
    if (group.orders.some(order => order.order_status === 'delivered')) return 'delivered';
    if (group.orders.some(order => order.order_status === 'picked up')) return 'picked up';
    if (group.orders.some(order => order.order_status === 'shipped')) return 'shipped';
    if (group.orders.some(order => order.order_status === 'confirmed')) return 'confirmed';
    if (group.orders.some(order => order.order_status === 'cancelled')) return 'cancelled';
    return 'pending';
  };

  // Add a function to get the payment status of a group
  const getGroupPaymentStatus = (group: OrderGroup) => {
    if (group.orders.some(order => order.payment_status === 'paid')) return 'paid';
    return 'pending';
  };

  // Add a function to get the payout status of a group
  const getGroupPayoutStatus = (group: OrderGroup) => {
    if (group.orders.some(order => order.transaction?.seller_payout_status === 'completed')) return 'completed';
    if (group.orders.some(order => order.transaction?.seller_payout_status === 'pending')) return 'pending';
    return 'not_eligible';
  };

  // Update filtering logic
  useEffect(() => {
    if (!groupedOrders) return;
    
    let filtered = [...groupedOrders];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(group => 
        group.orders.some(order => 
          order.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.product?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.payment_reference?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(group => 
        group.orders.some(order => {
          if (statusFilter === 'completed') {
            return order.order_status === 'delivered' || order.order_status === 'picked up';
          }
          return order.order_status === statusFilter;
        })
      );
    }
    
    // Apply payment status filter
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(group => 
        group.orders.some(order => order.payment_status === paymentStatusFilter)
      );
    }
    
    // Apply payout status filter
    if (payoutStatusFilter !== 'all') {
      filtered = filtered.filter(group => 
        group.orders.some(order => 
          order.transaction?.seller_payout_status === payoutStatusFilter
        )
      );
    }
    
    setFilteredOrders(filtered);
  }, [groupedOrders, searchTerm, statusFilter, paymentStatusFilter, payoutStatusFilter]);

  // Add pagination calculation
  const indexOfLastOrder = currentPage * itemsPerPage;
  const indexOfFirstOrder = indexOfLastOrder - itemsPerPage;
  const paginatedOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Update stats calculation for grouped orders
  useEffect(() => {
    if (!groupedOrders) return;
    
    const byStatus = {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      pickedup: 0,
      cancelled: 0,
    };
    const byPaymentStatus = {
      paid: 0,
      pending: 0,
      other: 0,
    };
    let completedOrders = 0;
    let pendingOrders = 0;
    let moneyReceived = 0;
    let pendingPayouts = 0;

    groupedOrders.forEach(group => {
      group.orders.forEach(order => {
      // Status
      if (order.order_status === 'pending') byStatus.pending++;
      else if (order.order_status === 'confirmed') byStatus.confirmed++;
      else if (order.order_status === 'shipped') byStatus.shipped++;
      else if (order.order_status === 'delivered') {
        byStatus.delivered++;
        completedOrders++;
      } else if (order.order_status === 'picked up') {
        byStatus.pickedup++;
        completedOrders++;
      } else if (order.order_status === 'cancelled') byStatus.cancelled++;
        
      // Pending orders
      if (order.order_status === 'pending') pendingOrders++;
        
      // Payment status
      if (order.payment_status === 'paid') byPaymentStatus.paid++;
      else if (order.payment_status === 'pending') byPaymentStatus.pending++;
      else byPaymentStatus.other++;

      // Payout status
      if (order.transaction?.seller_payout_status === 'completed') {
        moneyReceived += order.transaction.seller_payout_amount || 0;
      } else if (order.transaction?.seller_payout_status === 'pending') {
        pendingPayouts++;
      }
    });
    });

    setStats({
      totalOrders: groupedOrders.reduce((total, group) => total + group.orders.length, 0),
      completedOrders,
      pendingOrders,
      moneyReceived,
      pendingPayouts,
      byStatus,
      byPaymentStatus,
      byPayoutStatus: {
        received: moneyReceived,
        pending: pendingPayouts,
        notEligible: groupedOrders.reduce((total, group) => 
          total + group.orders.filter(order => 
            order.transaction?.seller_payout_status === 'not_eligible'
          ).length, 0),
      },
    });
  }, [groupedOrders]);

  // Add camera availability check
  useEffect(() => {
    // Check if camera is available
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
          setIsCameraAvailable(true);
        })
        .catch(err => {
          console.error('Camera check failed:', err);
          setIsCameraAvailable(false);
          if (err instanceof Error) {
            if (err.name === 'NotAllowedError') {
              setScannerError('Camera access was denied. Please check your browser permissions.');
            } else if (err.name === 'NotFoundError') {
              setScannerError('No camera found. Please ensure your device has a camera.');
            } else if (err.name === 'NotReadableError') {
              setScannerError('Camera is in use by another application. Please close other apps using the camera.');
      } else {
              setScannerError('Failed to access camera. Please try manual code entry.');
            }
          } else {
            setScannerError('Failed to access camera. Please try manual code entry.');
          }
        });
    } else {
      setIsCameraAvailable(false);
      setScannerError('Camera API not available. Please use manual code entry.');
    }
  }, []);

  // Update the scanner initialization effect
  useEffect(() => {
    if (showScanner && isCameraAvailable) {
      const html5QrCode = new Html5Qrcode(scannerDivId);
      scannerRef.current = html5QrCode;

      html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 200, height: 350 },
          aspectRatio: 1.0
        },
        handleScanResult,
        (errorMessage) => {
          console.log("QR Scan error:", errorMessage);
        }
      ).catch((err) => {
        console.error("Failed to start scanner:", err);
        if (err.message.includes('NotFoundError')) {
          setScannerError('No camera found. Please ensure your device has a camera and it\'s not being used by another application.');
        } else if (err.message.includes('NotAllowedError')) {
          setScannerError('Camera access was denied. Please allow camera access in your browser settings.');
        } else if (err.message.includes('NotReadableError')) {
          setScannerError('Unable to access camera. The camera might be in use by another application.');
        } else {
          setScannerError('Failed to start scanner. Please try manual entry or check if your device has a camera.');
        }
      });
    }

    return () => {
      if (scannerRef.current) {
        safeStopScanner();
      }
    };
  }, [showScanner, isCameraAvailable]);

  // Add a safe scanner stop function
  const safeStopScanner = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
    } catch (err) {
      console.warn('Warning during scanner stop:', err);
    } finally {
      setShowScanner(false);
      setScannerError(null);
      scannerRef.current = null;
      // Return to pickup code entry modal
      setIsScanning(false);
    }
  };

  // Function to verify pickup code
  const verifyPickupCode = async (code: string) => {
    if (!selectedOrder) {
      setPickupError('No order selected');
      return;
    }

    setVerifyingPickup(true);
    setPickupError(null);
    
    try {
      // Normalize input code
      const normalizedInputCode = code.trim().toUpperCase();
      
      // Call the API to verify the code
      const response = await fetch('/api/orders/verify-pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          code: normalizedInputCode,
          orderId: selectedOrder.id
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setPickupError(data.error);
        // For QR scanning failures, show toast and return to manual entry
        if (showScanner) {
          await safeStopScanner();
          // Clear the scanned code
          setPickupCode('');
          // Show error toast
          toast.error(data.error, {
            duration: 3000,
            position: 'top-center',
          });
          // Keep the pickup verify modal open but hide scanner
          setShowScanner(false);
          setIsScanning(false);
        }
        return;
      }

      // Update local state with the verified order
      setOrders(prevOrders => prevOrders.map(order =>
        order.id === selectedOrder.id
          ? {
              ...order,
              order_status: 'picked up' as Order['order_status'],
              pickup_code_verified: true,
              pickup_code_verified_at: new Date().toISOString(),
              payment_status: 'paid',
              transaction: order.transaction ? {
                ...order.transaction,
                payment_status: 'paid',
                platform_payout_status: 'completed',
                seller_payout_status: 'pending'
              } : null
            }
          : order
      ));

      // Close all modals and reset states
      await safeStopScanner();
      setIsPickupVerifyModalOpen(false);
      setIsUpdateModalOpen(false);
      setSelectedOrder(null);
      setPickupCode('');
      setIsScanning(false);
      setSelectedImage(null);
      setImagePreview(null);

      // Show success message
      toast.success('Pickup verified successfully', {
        duration: 3000,
        position: 'top-center',
      });

      // Refresh the orders list
      router.refresh();

    } catch (error) {
      console.error('Error verifying pickup:', error);
      setPickupError('Failed to verify pickup code. Please try again.');
      if (showScanner) {
        await safeStopScanner();
        // Clear the scanned code
        setPickupCode('');
        // Show error toast
        toast.error('Failed to verify pickup code. Please try again.', {
          duration: 3000,
          position: 'top-center',
        });
        // Keep the pickup verify modal open but hide scanner
        setShowScanner(false);
        setIsScanning(false);
      }
    } finally {
      setVerifyingPickup(false);
    }
  };

  // Add a function to handle starting the scanner
  const startScanner = async () => {
    setIsScanning(true);
    setScannerError(null);
    setPickupError(null);
    
    try {
      // Check if camera is available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      
      if (cameras.length === 0) {
        setScannerError('No camera found on your device. Please use manual entry.');
        setIsCameraAvailable(false);
        return;
      }

      setShowScanner(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setScannerError('Failed to access camera. Please check camera permissions or use manual entry.');
      setIsCameraAvailable(false);
    }
  };

  // Update the scan button click handler
  const handleScanButtonClick = () => {
    if (!isCameraAvailable) {
      setScannerError('Camera is not available on this device. Please use manual entry.');
      return;
    }
    startScanner();
  };

  // Add a function to handle scanner close button
  const handleScannerClose = async () => {
    await safeStopScanner();
    // Ensure we return to the pickup code entry modal
    setIsPickupVerifyModalOpen(true);
  };

  {/* Mobile QR Scanner Modal */}
  {showScanner && isMobile && (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50 bg-transparent">
      {/* Scanner animation keyframes for red scanline */}
      <style>{`
        @keyframes scanline {
          0% { top: 0; }
          100% { top: calc(100% - 3px); }
        }
      `}</style>
      <button
        onClick={safeStopScanner}
        className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg text-2xl font-bold focus:outline-none"
        aria-label="Close QR Scanner"
      >
        ×
      </button>
      {scannerError ? (
        <div className="bg-white rounded-lg p-4 shadow text-center mt-8">
          <div className="text-red-500 text-sm mb-2">{scannerError}</div>
          <button
            onClick={() => {
              setShowScanner(false);
              setScannerError(null);
            }}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            Use Manual Entry
          </button>
        </div>
      ) : !isCameraAvailable ? (
        <div className="bg-white rounded-lg p-4 shadow text-center mt-8">
          <p className="text-gray-600 text-sm mb-2">Camera is not available on this device.</p>
          <button
            onClick={() => {
              setShowScanner(false);
              setScannerError(null);
            }}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            Use Manual Entry
          </button>
        </div>
      ) : (
        <>
          <div className="w-[80vw] max-w-[350px] aspect-square mt-16 mb-4 flex items-center justify-center relative">
            <div
              id={scannerDivId}
              className="w-full h-full rounded-lg overflow-hidden"
            />
          </div>
          
        </>
      )}
    </div>
  )}

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Orders Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Orders</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.totalOrders}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div>
              <span className="text-green-500 text-sm font-medium">{stats.completedOrders} completed</span>
              <div className="text-xs text-gray-500 mt-1">
                <div>Delivered: {stats.byStatus.delivered}</div>
                <div>Picked up: {stats.byStatus.pickedup}</div>
            </div>
            </div>
            <div>
              <span className="text-yellow-500 text-sm font-medium">{stats.pendingOrders} pending</span>
              <div className="text-xs text-gray-500 mt-1">
                <div>Processing: {stats.byStatus.confirmed}</div>
                <div>Cancelled: {stats.byStatus.cancelled}</div>
            </div>
          </div>
            </div>
            </div>

        {/* Revenue Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Revenue</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{formatCurrency(stats.moneyReceived)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
          </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500 text-sm">Pending</span>
              <p className="text-sm font-medium text-gray-900">{formatCurrency(stats.pendingPayouts)}</p>
          </div>
            <div>
              <span className="text-gray-500 text-sm">Not Eligible</span>
              <p className="text-sm font-medium text-gray-900">{stats.byPayoutStatus.notEligible}</p>
          </div>
        </div>
      </div>

        {/* Delivery Status Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Delivery Status</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {stats.byStatus.shipped + stats.byStatus.delivered + stats.byStatus.pickedup}
              </p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3">
              <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div>
              <span className="text-sm text-gray-500">Shipped</span>
              <p className="text-sm font-medium text-gray-900">{stats.byStatus.shipped}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Delivered</span>
              <p className="text-sm font-medium text-gray-900">{stats.byStatus.delivered}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Pickup</span>
              <p className="text-sm font-medium text-gray-900">{stats.byStatus.pickedup}</p>
            </div>
          </div>
        </div>

        {/* Payment & Processing Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Processing</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {stats.byStatus.confirmed + stats.byStatus.pending}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
          </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div>
              <span className="text-sm text-gray-500">Confirmed</span>
              <p className="text-sm font-medium text-gray-900">{stats.byStatus.confirmed}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Pending</span>
              <p className="text-sm font-medium text-gray-900">{stats.byStatus.pending}</p>
            </div>
            <div className="col-span-2 mt-2">
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full"
                  style={{ 
                    width: `${Math.round((stats.byPaymentStatus.paid / (stats.byPaymentStatus.paid + stats.byPaymentStatus.pending)) * 100)}%` 
                  }}
                />
              </div>
              <div className="mt-1 text-xs text-gray-500 flex justify-between">
                <span>{stats.byPaymentStatus.paid} paid</span>
                <span>{stats.byPaymentStatus.pending} pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

            {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search Bar */}
          <div className="lg:col-span-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search orders, customers, or products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2.5 pl-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Status Filter */}
          <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="picked up">Picked Up</option>
                  <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
                </select>
              </div>

              {/* Payment Status Filter */}
          <div>
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="all">All Payment Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Payout Status Filter */}
          <div>
                <select
                  value={payoutStatusFilter}
                  onChange={(e) => setPayoutStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="all">All Payout Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="not_eligible">Not Eligible</option>
                </select>
          </div>
              </div>
            </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order Info
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Money Received
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedOrders.map((group) => (
                    <tr key={group.payment_reference} className="group hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                          {group.is_cash_payment ? 'Cash Payment' : 'Chapa Payment'}
                          </div>
                        <div className="text-sm text-gray-500">
                          Ref: {getShortReference(group.payment_reference)}
                          </div>
                          <div className="text-sm text-gray-500">
                          {new Date(group.created_at).toLocaleDateString()}
                              </div>
                        <details className="mt-2">
                          <summary className="text-sm text-indigo-600 cursor-pointer hover:text-indigo-900">
                            View {group.orders.length} items
                          </summary>
                          <div className="mt-2 space-y-2">
                            {group.orders.map((order) => (
                              <div key={order.id} className="pl-4 py-2 border-l-2 border-gray-200">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="text-sm font-medium">{order.product?.title || 'Product not found'}</div>
                                    <div className="text-xs text-gray-500">
                                      Quantity: {order.quantity} | Price: {formatCurrency(order.total_price)}
                          </div>
                                    {order.selected_variant_sku && (
                                      <div className="text-xs text-gray-500">
                                        Variant: {getSizeAndColorFromSku(order.selected_variant_sku)}
                        </div>
                                    )}
                                    {order.selected_size && (
                                      <div className="text-xs text-gray-500">
                                        Size: {order.selected_size}
                                      </div>
                                    )}
                                    {order.selected_color && (
                                      <div className="text-xs text-gray-500">
                                        Color: {order.selected_color}
                                      </div>
                                    )}
                                    {order.delivery_method && (
                                      <div className="text-xs text-gray-500">
                                        Delivery: {order.delivery_method.replace('_', ' ')}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => {
                                        setSelectedOrder(order);
                                        setIsUpdateModalOpen(true);
                                      }}
                                      className="text-xs text-indigo-600 hover:text-indigo-900"
                                    >
                                      Update
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedOrder(order);
                                        setIsViewModalOpen(true);
                                      }}
                                      className="text-xs text-gray-600 hover:text-gray-900"
                                    >
                                      View
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      </td>
                        <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{group.orders[0].user?.full_name || 'Not available'}</div>
                        <div className="text-sm text-gray-500">{group.orders[0].user?.email || 'Not available'}</div>
                        {group.orders[0].user?.phone && (
                          <div className="text-sm text-gray-500">{group.orders[0].user.phone}</div>
                        )}
                        {group.orders[0].transaction?.customer_phone && (
                          <div className="text-sm text-gray-500">{group.orders[0].transaction.customer_phone}</div>
                        )}
                        {!group.orders[0].user && (
                          <div className="text-sm text-gray-500">User ID: {group.orders[0].user_id}</div>
                        )}
                      </td>
                        <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{formatCurrency(group.total)}</div>
                          <div className="flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            group.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {group.payment_status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                        </div>
                      </td>
                        <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {(() => {
                            // Get unique statuses
                            const uniqueStatuses = [...new Set(group.orders.map(o => o.order_status))];
                            
                            // If all orders have the same status, show just one badge
                            if (uniqueStatuses.length === 1) {
                              const status = uniqueStatuses[0];
                              return (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  status === 'delivered' || status === 'picked up'
                                    ? 'bg-green-100 text-green-800'
                                    : status === 'cancelled'
                                    ? 'bg-red-100 text-red-800'
                                    : status === 'shipped'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                              );
                            }

                            // Sort statuses by priority
                            const statusPriority = {
                              'delivered': 1,
                              'picked up': 2,
                              'shipped': 3,
                              'confirmed': 4,
                              'pending': 5,
                              'cancelled': 6
                            };

                            // Count and sort statuses
                            const statusGroups = uniqueStatuses.reduce((acc, status) => {
                              acc[status] = group.orders.filter(o => o.order_status === status).length;
                              return acc;
                            }, {} as Record<string, number>);

                            return Object.entries(statusGroups)
                              .sort(([statusA], [statusB]) => 
                                (statusPriority[statusA as keyof typeof statusPriority] || 99) - 
                                (statusPriority[statusB as keyof typeof statusPriority] || 99)
                              )
                              .map(([status, count]) => (
                                <span 
                                  key={status}
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    status === 'delivered' || status === 'picked up'
                                      ? 'bg-green-100 text-green-800'
                                      : status === 'cancelled'
                                      ? 'bg-red-100 text-red-800'
                                      : status === 'shipped'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {count > 1 ? `${count}× ` : ''}{status.charAt(0).toUpperCase() + status.slice(1)}
                                </span>
                              ));
                          })()}
                        </div>
                      </td>
                        <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="text-sm text-gray-900">
                            {formatCurrency(group.orders.reduce((sum, order) => 
                              sum + (order.transaction?.seller_payout_amount || 0), 0
                            ))}
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            group.orders.some(o => o.transaction?.seller_payout_status === 'completed')
                              ? 'bg-green-100 text-green-800'
                              : group.orders.some(o => o.transaction?.seller_payout_status === 'pending')
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {group.orders.some(o => o.transaction?.seller_payout_status === 'completed')
                              ? 'Completed'
                              : group.orders.some(o => o.transaction?.seller_payout_status === 'pending')
                              ? 'Pending'
                              : 'Not Eligible'}
                          </span>
                        </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-3">
                          {group.receipt_url && (
                            <a
                              href={group.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                              Receipt
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
              </div>
            </div>

      {/* Pagination - update styles */}
            {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="hidden sm:block">
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{indexOfFirstOrder + 1}</span> to{' '}
                <span className="font-medium">{Math.min(indexOfLastOrder, filteredOrders.length)}</span>{' '}
                      of <span className="font-medium">{filteredOrders.length}</span> results
                    </p>
                  </div>
            <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                className="inline-flex items-center px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                Previous
                      </button>
                      <button
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                className="inline-flex items-center px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                Next
                      </button>
              </div>
            </div>
              </div>
            )}

      {/* Update Status Modal */}
      <div className={`fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity ${isUpdateModalOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                    Update Order Status
                  </h3>
                  
                  {/* Add Image Upload Section */}
                  {selectedOrder?.delivery_method === 'home_delivery' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Delivery Proof Image
                        {selectedOrder?.order_status !== 'delivered' && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                          {imagePreview || (selectedOrder?.delivery_proof_image || '') ? (
                            <div className="relative">
                              <img
                                src={imagePreview || (selectedOrder?.delivery_proof_image || '')}
                                alt="Delivery Proof"
                                className="mx-auto h-32 w-auto object-contain"
                              />
                              {selectedOrder?.order_status !== 'delivered' && (
                                <button
                                  onClick={() => {
                                    setSelectedImage(null);
                                    setImagePreview(null);
                                  }}
                                  className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {selectedOrder?.order_status !== 'delivered' && (
                                <>
                                  <div className="flex text-sm text-gray-600">
                                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                      <span>Upload a file</span>
                                      <input
                                        type="file"
                                        className="sr-only"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                      />
                                    </label>
                                    <p className="pl-1">or drag and drop</p>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    PNG, JPG, GIF up to 10MB
                                  </p>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status Buttons */}
                  <div className="mt-2 space-y-3">
                    {['pending', 'confirmed', 'shipped', 
                      selectedOrder?.delivery_method === 'store_pickup' ? 'picked up' : 'delivered', 
                      'cancelled'].map((status) => {
                      const isPickupStatus = status === 'picked up';
                      const handleClick = () => {
                        if (isPickupStatus) {
                          setIsPickupVerifyModalOpen(true);
                        } else {
                          handleUpdateStatus(status as Order['order_status']);
                        }
                      };

                      return (
                      <button
                        key={status}
                          onClick={handleClick}
                        disabled={
                          updatingStatus || 
                          selectedOrder?.order_status === 'delivered' ||
                          selectedOrder?.order_status === 'picked up' ||
                          (selectedOrder?.order_status === status)
                        }
                        className={`px-4 py-2 text-sm font-medium rounded-md ${
                          selectedOrder?.order_status === status
                            ? 'bg-gray-100 text-gray-800'
                            : (selectedOrder?.order_status === 'delivered' || selectedOrder?.order_status === 'picked up')
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setIsUpdateModalOpen(false);
                    setSelectedImage(null);
                    setImagePreview(null);
                  }}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {isViewModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Order Group Details</h2>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              </div>

            <div className="p-6 space-y-8">
              {/* Group Summary */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Group Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                    <p className="text-sm font-medium text-gray-500">Payment Reference</p>
                    <p className="mt-1 text-sm text-gray-900">{getShortReference(selectedOrder.payment_reference )}</p>
                    </div>
                    <div>
                    <p className="text-sm font-medium text-gray-500">Payment Method</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedOrder.payment_reference?.startsWith('CASH-') ? 'CASH' : 'CHAPA'}
                    </p>
                    </div>
                    <div>
                    <p className="text-sm font-medium text-gray-500">Total Orders</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {groupedOrders.find(g => 
                        g.payment_reference === getBasePaymentRef(selectedOrder.payment_reference || ''))?.orders.length || 1}
                    </p>
                    </div>
                    </div>
                    </div>

              {/* Orders in Group */}
                    <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Orders in Group</h3>
                <div className="space-y-6">
                  {groupedOrders
                    .find(g => g.payment_reference === getBasePaymentRef(selectedOrder.payment_reference || ''))
                    ?.orders.map((order) => (
                      <div key={order.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium text-gray-900">Order #{order.id.slice(0, 8)}</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              order.order_status === 'delivered' || order.order_status === 'picked up'
                                ? 'bg-green-100 text-green-800'
                                : order.order_status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : order.order_status === 'shipped'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                          </span>
                  </div>
                </div>
                        
                        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <div className="mb-4">
                              <h5 className="text-sm font-medium text-gray-900 mb-1">{order.product?.title || 'Product not found'}</h5>
                              <div className="text-sm text-gray-500">
                                <p>Quantity: {order.quantity}</p>
                                <p>Total: {formatCurrency(order.total_price)}</p>
                                {order.selected_variant_sku && (
                                  <p>Variant: {getSizeAndColorFromSku(order.selected_variant_sku)}</p>
                        )}
                                {order.selected_size && (
                                  <p>Size: {order.selected_size}</p>
                                )}
                                {order.selected_color && (
                                  <p>Color: {order.selected_color}</p>
                                )}
                      </div>
                    </div>

                            <div>
                              <h5 className="text-sm font-medium text-gray-900 mb-1">Customer</h5>
                              <div className="text-sm text-gray-500">
                                <p>Name: {order.user?.full_name || 'Not available'}</p>
                                <p>Email: {order.user?.email || 'Not available'}</p>
                                {order.user?.phone && (
                                  <p>Phone: {order.user.phone}</p>
                                )}
                                {order.transaction?.customer_phone && (
                                  <p>Phone: {order.transaction.customer_phone}</p>
                                )}
                                {!order.user?.phone && !order.transaction?.customer_phone && (
                                  <p>Phone: Not available</p>
                                )}
                                {!order.user && (
                                  <p>User ID: {order.user_id}</p>
                                )}
                          </div>
                          </div>
                        </div>

                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-1">Delivery Details</h5>
                            <div className="text-sm text-gray-500">
                              <p>Method: {order.delivery_method?.replace('_', ' ')}</p>
                              {order.delivery_address && (
                                <div className="mt-2">
                                {(() => {
                                  try {
                                      const address = JSON.parse(order.delivery_address);
                                    return (
                                        <div className="space-y-1">
                                          <p>City: {address.city}</p>
                                          <p>Sub City: {address.subCity}</p>
                                          <p>Wereda: {address.wereda}</p>
                                          <p>Kebele: {address.kebele}</p>
                                          <p>House No: {address.houseNo}</p>
                                          {address.landmark && <p>Landmark: {address.landmark}</p>}
                                          {address.mapLink && (
                                            <a
                                              href={address.mapLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                              className="text-indigo-600 hover:text-indigo-900 block mt-2"
                                          >
                                              View on Map
                                          </a>
                                        )}
                                      </div>
                                    );
                                    } catch {
                                      return <p>{order.delivery_address}</p>;
                                  }
                                })()}
                              </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                      </div>
                    </div>

              {/* Financial Summary */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                    <p className="text-sm font-medium text-gray-500">Total Amount</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatCurrency(
                        groupedOrders
                          .find(g => g.payment_reference === getBasePaymentRef(selectedOrder.payment_reference || ''))
                          ?.orders.reduce((sum, order) => sum + order.total_price, 0) || 0
                      )}
                          </p>
                        </div>
                        <div>
                    <p className="text-sm font-medium text-gray-500">Payment Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedOrder.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedOrder.payment_status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                        </div>
                        <div>
                    <p className="text-sm font-medium text-gray-500">Payout Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedOrder.transaction?.seller_payout_status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : selectedOrder.transaction?.seller_payout_status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedOrder.transaction?.seller_payout_status === 'completed'
                        ? 'Completed'
                        : selectedOrder.transaction?.seller_payout_status === 'pending'
                        ? 'Pending'
                        : 'Not Eligible'}
                    </span>
                  </div>
                </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

      {/* Add Pickup Code Display in Order Details */}
      {selectedOrder?.pickup_code && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <PickupCodeDisplay
            code={selectedOrder.pickup_code}
            verified={selectedOrder.pickup_code_verified}
            verifiedAt={selectedOrder.pickup_code_verified_at}
          />
              </div>
      )}

      {/* Add QR Code Scanner for Pickup Verification */}
      {isPickupVerifyModalOpen && !(showScanner && isMobile) && (
        <div className={`fixed inset-0 bg-gray-500 bg-opacity-60 flex items-center justify-center z-50`}>
          {/* Red scanline animation for desktop */}
          <style>{`
            @keyframes desktop-scanline {
              0% { top: 0%; }
              100% { top: 100%; }
            }
          `}</style>
          <div className="relative w-full max-w-xs sm:max-w-sm mx-auto bg-white rounded-2xl shadow-2xl px-6 py-6 sm:p-8 sm:py-10 flex flex-col items-center">
                <button
              onClick={() => {
                setIsPickupVerifyModalOpen(false);
                setPickupCode('');
                setPickupError(null);
                setIsScanning(false);
              }}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full text-xl font-bold focus:outline-none"
              aria-label="Close"
            >
              ×
                </button>
            <h3 className="text-lg font-bold text-gray-900 mb-4 mt-2 text-center w-full">Verify Pickup Code</h3>
            {isScanning ? (
              <div className="mt-4 w-full relative flex items-center justify-center">
                <button
                  onClick={handleScannerClose}
                  className="text-sm text-gray-500 hover:text-gray-700 mb-4 absolute left-0 top-0"
                  style={{zIndex: 2}}
                >
                  ← Back to manual entry
                </button>
                <div className="w-full h-[220px] sm:h-[280px] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center relative overflow-hidden">
                  <div
                    id={scannerDivId}
                    className="w-full h-full rounded-lg"
                  />
                  {/* Red scanline for desktop only */}
                  <div
                    className="hidden sm:block absolute left-0 w-full h-[3px] bg-red-600"
                    style={{
                      animation: 'desktop-scanline 1.5s linear infinite alternate',
                      zIndex: 10,
                      transform: 'translateY(-50%)'
                    }}
                  />
                </div>
                {scannerError && (
                  <p className="mt-2 text-sm text-red-600 text-center w-full" style={{zIndex: 2}}>{scannerError}</p>
                )}
              </div>
            ) : (
              <>
                <div className="mt-2 w-full">
                  <label htmlFor="pickupCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Enter Pickup Code
                  </label>
                  <input
                    type="text"
                    name="pickupCode"
                    id="pickupCode"
                    value={pickupCode}
                    onChange={(e) => setPickupCode(e.target.value.toUpperCase())}
                    placeholder="Enter 8-digit code"
                    className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 mb-2"
                    maxLength={8}
                  />
                  {pickupError && (
                    <p className="mt-1 text-sm text-red-600 text-center">{pickupError}</p>
                  )}
                </div>
                <div className="flex flex-col gap-3 w-full mt-4">
                  <button
                    onClick={handleScanButtonClick}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-2 0h-2m-4 0H8m-4 0H4m12-8h2m-2 0h-2m-4 0H8m-4 0H4m12 4h2m-2 0h-2m-4 0H8m-4 0H4m12 8h2m-2 0h-2m-4 0H8m-4 0H4" />
                    </svg>
                    Scan QR Code
                  </button>
                  <button
                    onClick={() => verifyPickupCode(pickupCode)}
                    disabled={verifyingPickup || !pickupCode}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-300 disabled:text-gray-400"
                  >
                    {verifyingPickup ? 'Verifying...' : 'Verify Code'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={handleScannerClose}
              className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg text-2xl font-bold focus:outline-none"
              aria-label="Close QR Scanner"
            >
              ×
            </button>
            {scannerError ? (
              <div className="bg-white rounded-lg p-4 shadow text-center">
                <div className="text-red-500 text-sm mb-2">{scannerError}</div>
                <button
                  onClick={handleScannerClose}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  Use Manual Entry
                </button>
              </div>
            ) : !isCameraAvailable ? (
              <div className="bg-white rounded-lg p-4 shadow text-center">
                <p className="text-gray-600 text-sm mb-2">Camera is not available on this device.</p>
                <button
                  onClick={handleScannerClose}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  Use Manual Entry
                </button>
            </div>
            ) : (
              <div className="relative flex flex-col items-center justify-center w-full h-full">
                {/* Scanner frame and camera view */}
                <div className="absolute left-1/2" style={{ top: '55%', transform: 'translate(-50%, -50%)' }}>
                  <div className="relative w-64 h-64">
                    {/* Camera view */}
                    <div id={scannerDivId} className="w-full h-full overflow-hidden" />
                    
                    {/* White corner borders */}
                    {/* Top-left */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white z-30" />
                    {/* Top-right */}
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white z-30" />
                    {/* Bottom-left */}
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white z-30" />
                    {/* Bottom-right */}
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white z-30" />
                    
                    {/* Instruction text */}
                    <div className="absolute w-full text-center" style={{ top: '104%' }}>
                      <p className="text-sm text-Black drop-shadow font-medium">Position QR code in frame</p>
          </div>
        </div>
      </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile QR Scanner Modal */}
      {showScanner && isMobile && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50 bg-transparent">
          {/* Scanner animation keyframes for red scanline */}
          <style>{`
            @keyframes scanline {
              0% { top: 0; }
              100% { top: calc(100% - 3px); }
            }
          `}</style>
          <button
            onClick={handleScannerClose}
            className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg text-2xl font-bold focus:outline-none"
            aria-label="Close QR Scanner"
          >
            ×
          </button>
          {scannerError ? (
            <div className="bg-white rounded-lg p-4 shadow text-center mt-8">
              <div className="text-red-500 text-sm mb-2">{scannerError}</div>
              <button
                onClick={handleScannerClose}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Use Manual Entry
                </button>
              </div>
          ) : !isCameraAvailable ? (
            <div className="bg-white rounded-lg p-4 shadow text-center mt-8">
              <p className="text-gray-600 text-sm mb-2">Camera is not available on this device.</p>
              <button
                onClick={handleScannerClose}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Use Manual Entry
              </button>
            </div>
          ) : (
            <>
              <div className="w-[80vw] max-w-[350px] aspect-square mt-16 mb-4 flex items-center justify-center relative">
                <div
                  id={scannerDivId}
                  className="w-full h-full rounded-lg overflow-hidden"
                />
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
} 