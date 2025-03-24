'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import Image from 'next/image';
import Link from 'next/link';
import { formatCurrency } from '@/utils/currency';
import { toast } from 'react-hot-toast';
import { withSellerVerification } from '@/components/withSellerVerification';

type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  is_active: boolean;
  created_at: string;
  category: string;
  product_images?: ProductImage[];
};

type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  is_model_picture: boolean;
};

type CategoryGroup = {
  [key: string]: Product[];
};

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPaymentSettings, setHasPaymentSettings] = useState(false);
  const router = useRouter();
  const supabase = createClientComponent();

  // Define fetchProducts outside useEffect so it can be reused
  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login?message=Please login to access the dashboard');
        return;
      }

      // Fetch products with their images
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          product_images (*)
        `)
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // Group products by category
      const groups: CategoryGroup = {};
      productsData?.forEach((product: any) => {
        const category = product.category || 'Uncategorized';
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(product);
      });

      setProducts(productsData || []);
      setCategoryGroups(groups);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkPaymentSettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // Check if user has payment settings
        const { data: settings, error } = await supabase
          .from('payment_settings')
          .select('telebirr_settings')
          .eq('user_id', session.user.id)
          .single();

        if (error) {
          console.error('Error checking payment settings:', error);
          return;
        }

        const hasSettings = settings?.telebirr_settings?.is_active || false;
        setHasPaymentSettings(hasSettings);

        if (!hasSettings) {
          toast.error(
            <div>
              <p>Please set up your payment settings before adding products.</p>
              <Link 
                href="/dashboard/payment-settings" 
                className="text-green-600 hover:text-green-500 mt-2 block"
              >
                Set up payment settings →
              </Link>
            </div>,
            { duration: 5000 }
          );
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    checkPaymentSettings();
    fetchProducts();
  }, []);

  // Clean image URL helper
  const cleanImageUrl = (url: string | undefined): string => {
    if (!url) return '';
    return url.startsWith('@') ? url.substring(1) : url;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Products by Category</h1>
          {hasPaymentSettings ? (
            <Link
              href="/dashboard/products/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              Add New Product
            </Link>
          ) : (
            <Link
              href="/dashboard/payment-settings"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
            >
              Set Up Payment Settings
            </Link>
          )}
        </div>

        {!hasPaymentSettings && (
          <div className="mb-8 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You need to set up your payment settings before you can add products.
                  <Link 
                    href="/dashboard/payment-settings"
                    className="font-medium text-yellow-700 underline ml-2"
                  >
                    Set up now
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Category Navigation */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg ${
                !selectedCategory 
                  ? 'bg-green-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              All Categories
            </button>
            {Object.keys(categoryGroups).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg ${
                  selectedCategory === category 
                    ? 'bg-green-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {category} ({categoryGroups[category].length})
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="space-y-8">
          {(selectedCategory ? [selectedCategory] : Object.keys(categoryGroups)).map((category) => (
            <div key={category} className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">{category}</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryGroups[category].map((product) => (
                    <div key={product.id} className="bg-white rounded-lg border shadow-sm">
                      <div className="aspect-w-3 aspect-h-2">
                        {product.product_images && product.product_images.length > 0 ? (
                          <Image
                            src={cleanImageUrl(product.product_images[0].image_url)}
                            alt={product.title}
                            width={300}
                            height={200}
                            className="object-cover rounded-t-lg"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-400">No image</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="text-lg font-medium text-gray-900">{product.title}</h3>
                        <p className="mt-1 text-gray-500 line-clamp-2">{product.description}</p>
                        <div className="mt-2 flex justify-between items-center">
                          <span className="text-green-600 font-medium">
                            {formatCurrency(product.price)}
                          </span>
                          <span className={`text-sm ${
                            product.quantity > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {product.quantity} in stock
                          </span>
                        </div>
                        <div className="mt-4 flex justify-end space-x-2">
                          <Link
                            href={`/dashboard/products/edit/${product.id}`}
                            className="text-indigo-600 hover:text-indigo-900 text-sm"
                          >
                            Edit
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default withSellerVerification(ProductsPage); 