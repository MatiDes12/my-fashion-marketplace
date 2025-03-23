'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { ETHIOPIAN_CATEGORIES, PRODUCT_CATEGORIES } from '@/utils/constants';
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
  detailed_description: string;
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
  const [detailedDescription, setDetailedDescription] = useState('');

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
        setDescription(productData.description || '');
        setPrice(productData.price.toString());
        setCategory(productData.category || '');
        setIsActive(productData.is_active);
        setQuantity(productData.quantity.toString());
        setDetailedDescription(productData.detailed_description || '');
        setFormData({
          title: productData.title,
          description: productData.description || '',
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
          detailed_description: detailedDescription,
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

      if (existingImages.length + newImages.length < 4 || existingImages.length + newImages.length > 8) {
        setError(`Please maintain between 4-8 images (you have ${existingImages.length + newImages.length})`);
        setSaving(false);
        return;
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
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const totalImages = existingImages.length + files.length;
      
      if (totalImages < 4) {
        setError('Please upload enough images to have at least 4 total');
        return;
      }
      if (totalImages > 8) {
        setError('Maximum 8 images allowed in total');
        return;
      }
      setNewImages(files);
      setError(null);
    }
  }

  function toggleImageForDeletion(imageId: string) {
    if (imagesToDelete.includes(imageId)) {
      setImagesToDelete(imagesToDelete.filter(id => id !== imageId));
    } else {
      setImagesToDelete([...imagesToDelete, imageId]);
    }
  }

  // Add the same input and select classes at the top
  const inputClasses = "block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base transition duration-150 ease-in-out";
  const selectClasses = "block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base transition duration-150 ease-in-out";

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
              <form onSubmit={handleSubmit} className="space-y-8">
                {error && <ErrorMessage message={error} />}

                {/* Basic Information Section */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Basic Information</h4>
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
                          className={inputClasses}
                          required
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-6">
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Brief Description <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1">
                        <textarea
                          id="description"
                          rows={2}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className={inputClasses}
                          placeholder="Brief overview of your product (will appear in product listings)"
                          maxLength={200}
                          required
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        A brief summary of your product (max 200 characters)
                      </p>
                    </div>

                    <div className="sm:col-span-3">
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
                          className={`${inputClasses} pl-12`}
                          min="0"
                          step="0.01"
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
                              className={selectClasses}
                              required={!showCustomCategory}
                            >
                              <option value="">Select a category</option>
                              
                              {/* Traditional Wear */}
                              <optgroup label="Traditional Wear">
                                <option value="traditional_wear">Traditional Wear</option>
                                <option value="habesha_kemis">Habesha Kemis</option>
                                <option value="tilfi">Tilfi</option>
                                <option value="traditional_accessories">Traditional Accessories</option>
                              </optgroup>

                              {/* Modern Fashion */}
                              <optgroup label="Modern Fashion">
                                <option value="modern_fashion">Modern Fashion</option>
                                <option value="dresses">Dresses</option>
                                <option value="tops">Tops</option>
                                <option value="pants_skirts">Pants & Skirts</option>
                                <option value="outerwear">Outerwear</option>
                                <option value="fashion_accessories">Fashion Accessories</option>
                                <option value="shoes">Shoes</option>
                              </optgroup>

                              {/* Add all other category groups here... */}
                              
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
                              className={inputClasses}
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
                          className={selectClasses}
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
                          className={inputClasses}
                          min="0"
                          required
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="delivery_fee" className="block text-sm font-medium text-gray-700">
                        Delivery Fee (optional)
                      </label>
                      <div className="relative rounded-lg">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-gray-500 text-base">ETB</span>
                        </div>
                        <input
                          type="number"
                          id="delivery_fee"
                          value={formData.delivery_fee}
                          onChange={(e) => setFormData({ ...formData, delivery_fee: e.target.value })}
                          className={`${inputClasses} pl-12`}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <p className="mt-1 text-sm text-gray-500">Leave empty for free delivery</p>
                    </div>
                  </div>
                </div>

                {/* Description Section */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Product Description</h4>
                  <div className="sm:col-span-6">
                    <label htmlFor="detailedDescription" className="block text-sm font-medium text-gray-700">
                      Detailed Description <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <textarea
                        id="detailedDescription"
                        rows={6}
                        value={detailedDescription}
                        onChange={(e) => setDetailedDescription(e.target.value)}
                        className={inputClasses}
                        placeholder="Provide comprehensive details about your product..."
                        required
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Include detailed information about:
                      <ul className="list-disc pl-5 mt-1">
                        <li>Materials and fabric composition</li>
                        <li>Size and measurements</li>
                        <li>Care instructions</li>
                        <li>Special features or characteristics</li>
                        <li>Any customization options</li>
                        <li>Return policy specifics</li>
                      </ul>
                    </p>
                  </div>
                </div>

                {/* Images Section */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-base font-medium text-gray-900">Product Images</h4>
                    <span className="text-sm text-gray-500">
                      {existingImages.length + newImages.length}/8 images
                    </span>
                  </div>
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

                <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                  <h5 className="text-sm font-medium text-blue-800 mb-2">Image Guidelines:</h5>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Upload minimum 4 and maximum 8 images</li>
                    <li>• First image will be the main product image</li>
                    <li>• Include photos from different angles</li>
                    <li>• Show both full product and detail shots</li>
                    <li>• Use well-lit, clear photos</li>
                    <li>• Recommended size: 1000x1000px or larger</li>
                  </ul>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3">
                  <Link
                    href="/dashboard/products"
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
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
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 