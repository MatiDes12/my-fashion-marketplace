'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { ETHIOPIAN_CATEGORIES } from '@/utils/constants';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'react-hot-toast';

type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  is_model_picture: boolean;
};

type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  is_active: boolean;
  images?: ProductImage[];
  quantity: number;
  delivery_fee?: number;
};

export default function EditProductPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [quantity, setQuantity] = useState('');
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClientComponent();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    quantity: '',
    category: '',
    delivery_fee: '',
  });

  // Clean image URL helper
  const cleanImageUrl = (url: string | undefined): string => {
    if (!url) return '';
    return url.startsWith('@') ? url.substring(1) : url;
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        
        // Check authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login?message=Please login to access the dashboard');
          return;
        }
        
        // Check role
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (userError || userData?.role !== 'owner') {
          router.push('/');
          return;
        }
        
        // Fetch product
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', params.id)
          .eq('owner_id', session.user.id)
          .single();
        
        if (productError) {
          setError('Product not found or you do not have permission to edit it');
          return;
        }
        
        // Fetch product images
        const { data: imagesData, error: imagesError } = await supabase
          .from('product_images')
          .select('*')
          .eq('product_id', params.id);
        
        if (imagesError) {
          console.error('Error fetching product images:', imagesError);
        }
        
        // Set product data
        setProduct(productData);
        setTitle(productData.title);
        setDescription(productData.description);
        setPrice(productData.price.toString());
        setCategory(productData.category || '');
        setIsActive(productData.is_active);
        setQuantity(productData.quantity.toString());
        setFormData({
          title: productData.title,
          description: productData.description,
          price: productData.price.toString(),
          quantity: productData.quantity.toString(),
          category: productData.category,
          delivery_fee: productData.delivery_fee?.toString() || '',
        });
        
        // Set existing images
        if (imagesData) {
          setExistingImages(imagesData);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        setError('Failed to load product data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProduct();
  }, [params.id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Validate form
      if (!title || !description || !price) {
        setError('Please fill in all required fields');
        setSaving(false);
        return;
      }

      const finalCategory = showCustomCategory ? customCategory : category;
      
      // Update product
      const { error: updateError } = await supabase
        .from('products')
        .update({
          title,
          description,
          price: parseFloat(price),
          category: finalCategory,
          is_active: isActive,
          quantity: parseInt(quantity),
          delivery_fee: formData.delivery_fee ? parseFloat(formData.delivery_fee) : null,
        })
        .eq('id', params.id);

      if (updateError) throw updateError;

      // Handle image deletions
      for (const imageId of imagesToDelete) {
        const { error: deleteError } = await supabase
          .from('product_images')
          .delete()
          .eq('id', imageId);
        
        if (deleteError) {
          console.error('Error deleting image:', deleteError);
        }
      }

      // Upload new images
      if (newImages.length > 0) {
        for (const image of newImages) {
          try {
            const fileExt = image.name.split('.').pop();
            const fileName = `${params.id}/${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from('products')
              .upload(fileName, image);

            if (uploadError) {
              console.error('Error uploading image:', uploadError);
              continue;
            }

            // Get public URL
            const { data: publicUrlData } = supabase.storage
              .from('products')
              .getPublicUrl(fileName);
            
            // Add image to product_images table
            const { error: imageError } = await supabase
              .from('product_images')
              .insert({
                product_id: params.id,
                image_url: publicUrlData.publicUrl,
                is_model_picture: false
              });

            if (imageError) {
              console.error('Error saving image reference:', imageError);
            }
          } catch (err) {
            console.error('Error processing image:', err);
          }
        }
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/products');
      }, 2000);
    } catch (err: any) {
      console.error('Error updating product:', err);
      setError(err.message || 'An error occurred while updating the product');
    } finally {
      setSaving(false);
    }
  };

  function handleNewImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setNewImages(Array.from(e.target.files));
    }
  }

  function toggleImageForDeletion(imageId: string) {
    if (imagesToDelete.includes(imageId)) {
      setImagesToDelete(imagesToDelete.filter(id => id !== imageId));
    } else {
      setImagesToDelete([...imagesToDelete, imageId]);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Edit Product</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Update your product details and images
            </p>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {loading ? (
              <LoadingSpinner />
            ) : error && !product ? (
              <ErrorMessage message={error} />
            ) : success ? (
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Product updated successfully</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>Redirecting to products page...</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && <ErrorMessage message={error} />}
                
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-4">
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      Product Title <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <textarea
                        id="description"
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                      Price (ETB) <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">ETB</span>
                      </div>
                      <input
                        type="number"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="focus:ring-green-500 focus:border-green-500 block w-full pl-12 pr-12 sm:text-sm border-gray-300 rounded-md"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      {!showCustomCategory ? (
                        <>
                          <select
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            required={!showCustomCategory}
                          >
                            <option value="">Select a category</option>
                            {ETHIOPIAN_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value="custom">+ Add custom category</option>
                          </select>
                          {category === 'custom' && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCustomCategory(true);
                                  setCategory('');
                                }}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Create custom category
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex">
                          <input
                            type="text"
                            id="customCategory"
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="Enter custom category"
                            required={showCustomCategory}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomCategory(false);
                              setCustomCategory('');
                            }}
                            className="ml-2 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <div className="mt-1">
                      <select
                        id="status"
                        value={isActive ? 'active' : 'inactive'}
                        onChange={(e) => setIsActive(e.target.value === 'active')}
                        className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                      Quantity in Stock <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="number"
                        id="quantity"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        min="0"
                        required
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="delivery_fee" className="block text-sm font-medium text-gray-700">
                      Delivery Fee (optional)
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        id="delivery_fee"
                        value={formData.delivery_fee}
                        onChange={(e) => setFormData({ ...formData, delivery_fee: e.target.value })}
                        className="focus:ring-green-500 focus:border-green-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Leave empty for free delivery</p>
                  </div>

                  {/* Current Images Section */}
                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Images
                    </label>
                    {existingImages.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
                        {existingImages.map((image) => (
                          <div 
                            key={image.id} 
                            className={`relative border rounded-md overflow-hidden ${
                              imagesToDelete.includes(image.id) ? 'opacity-50 border-red-500' : 'border-gray-200'
                            }`}
                          >
                            <div className="aspect-w-1 aspect-h-1 w-full">
                              <Image
                                src={cleanImageUrl(image.image_url)}
                                alt="Product image"
                                width={200}
                                height={200}
                                className="object-cover"
                              />
                            </div>
                            <div className="p-2 flex justify-between items-center">
                              <label className="inline-flex items-center">
                                <input
                                  type="checkbox"
                                  checked={image.is_model_picture}
                                  className="form-checkbox h-4 w-4 text-green-600"
                                  disabled
                                />
                                <span className="ml-2 text-xs text-gray-700">Model</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => toggleImageForDeletion(image.id)}
                                className={`text-xs ${
                                  imagesToDelete.includes(image.id) 
                                    ? 'text-green-600 hover:text-green-800' 
                                    : 'text-red-600 hover:text-red-800'
                                }`}
                              >
                                {imagesToDelete.includes(image.id) ? 'Keep' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No images available</p>
                    )}
                  </div>

                  {/* New Images Section */}
                  <div className="sm:col-span-6">
                    <label htmlFor="newImages" className="block text-sm font-medium text-gray-700">
                      Add New Images
                    </label>
                    <div className="mt-1">
                      <input
                        type="file"
                        id="newImages"
                        ref={fileInputRef}
                        onChange={handleNewImageChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                        multiple
                        accept="image/*"
                      />
                    </div>
                    {newImages.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          {newImages.length} new {newImages.length === 1 ? 'image' : 'images'} selected
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-5">
                  <div className="flex justify-end">
                    <Link
                      href="/dashboard/products"
                      className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={saving}
                      className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 