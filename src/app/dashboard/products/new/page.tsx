'use client';

import { useState, useRef } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { PRODUCT_CATEGORIES } from '@/utils/constants';
import Link from 'next/link';

export default function NewProductPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [delivery_fee, setDeliveryFee] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClientComponent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate form
      if (!title || !description || !price || !quantity || 
          (!category && !customCategory) ||
          (category === 'custom' && !customCategory)) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      if (images.length === 0) {
        setError('Please upload at least one product image');
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('You must be logged in to create a product');
      }

      // Create product
      const finalCategory = showCustomCategory ? customCategory : category;
      
      const { data, error } = await supabase
        .from('products')
        .insert({
          title,
          description,
          price: parseFloat(price),
          category: finalCategory,
          owner_id: session.user.id,
          is_active: true,
          quantity: parseInt(quantity),
          delivery_fee: parseFloat(delivery_fee)
        })
        .select();

      if (error) {
        throw error;
      }

      // Upload images
      try {
        for (const image of images) {
          const fileExt = image.name.split('.').pop();
          const fileName = `${data[0].id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          // First check if file already exists and remove it
          const { data: existingFile } = await supabase.storage
            .from('products')
            .list(`${data[0].id}`);

          if (existingFile?.some(f => f.name === fileName)) {
            await supabase.storage
              .from('products')
              .remove([fileName]);
          }

          // Upload new file
          const { error: uploadError, data: uploadData } = await supabase.storage
            .from('products')
            .upload(fileName, image, {
              cacheControl: '3600',
              upsert: true,
              contentType: image.type
            });

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
            continue;
          }

          // Get public URL
          const { data: publicUrlData } = supabase.storage
            .from('products')
            .getPublicUrl(fileName);

          if (publicUrlData) {
            // Add image to product_images table
            const { error: imageError } = await supabase
              .from('product_images')
              .insert({
                product_id: data[0].id,
                image_url: publicUrlData.publicUrl,
                is_model_picture: false
              });

            if (imageError) {
              console.error('Error saving image reference:', imageError);
            }
          }
        }

        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard/products');
        }, 2000);
      } catch (err) {
        console.error('Error in image upload process:', err);
        setError('Product created but there was an issue with image uploads. Please try editing the product to add images.');
        // Still redirect after a delay since the product was created
        setTimeout(() => {
          router.push('/dashboard/products');
        }, 3000);
      } finally {
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error creating product:', err);
      setError(err.message || 'An error occurred while creating the product');
    }
  };

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setImages(Array.from(e.target.files));
    }
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Add New Product</h1>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {success ? (
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Product created successfully!</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>Redirecting to products page...</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
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
                        placeholder="Traditional Habesha Dress"
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
                        placeholder="Describe your product in detail..."
                        required
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Include details about materials, size, color, and any special features.
                    </p>
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
                        placeholder="0.00"
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
                        <div className="space-y-4">
                          <select
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            required={!showCustomCategory}
                          >
                            <option value="">Select a category</option>
                            
                            {/* Main Categories */}
                            <optgroup label="Traditional Wear">
                              <option value="traditional_wear">Traditional Wear</option>
                              <option value="habesha_kemis">Habesha Kemis</option>
                              <option value="tilfi">Tilfi</option>
                              <option value="cultural_accessories">Cultural Accessories</option>
                            </optgroup>

                            <optgroup label="Modern Fashion">
                              <option value="modern_fashion">Modern Fashion</option>
                              <option value="dresses">Dresses</option>
                              <option value="tops">Tops</option>
                              <option value="pants_skirts">Pants & Skirts</option>
                              <option value="outerwear">Outerwear</option>
                              <option value="accessories">Accessories</option>
                              <option value="shoes">Shoes</option>
                            </optgroup>

                            <optgroup label="Home & Living">
                              <option value="home_living">Home & Living</option>
                              <option value="furniture">Furniture</option>
                              <option value="home_decor">Home Decor</option>
                              <option value="kitchen_dining">Kitchen & Dining</option>
                              <option value="bedding">Bedding</option>
                              <option value="lighting">Lighting</option>
                              <option value="rugs_carpets">Rugs & Carpets</option>
                            </optgroup>

                            {/* Add more optgroups for other categories */}
                            
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
                        </div>
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
                      <p className="mt-2 text-sm text-gray-500">
                        Choose the most appropriate category for your product to help buyers find it easily.
                      </p>
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
                        value={delivery_fee}
                        onChange={(e) => setDeliveryFee(e.target.value)}
                        className="focus:ring-green-500 focus:border-green-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Leave empty for free delivery</p>
                  </div>

                  <div className="sm:col-span-6">
                    <label htmlFor="images" className="block text-sm font-medium text-gray-700">
                      Product Images
                    </label>
                    <div className="mt-1">
                      <input
                        type="file"
                        id="images"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                        multiple
                        accept="image/*"
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Upload high-quality images of your product. Multiple images recommended.
                    </p>
                    {images.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          {images.length} {images.length === 1 ? 'file' : 'files'} selected
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
                      disabled={loading}
                      className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        'Create Product'
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