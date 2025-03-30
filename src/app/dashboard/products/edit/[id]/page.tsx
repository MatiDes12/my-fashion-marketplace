'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { ETHIOPIAN_CATEGORIES, PRODUCT_CATEGORIES, CATEGORY_SPECIFIC_FIELDS } from '@/utils/constants';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import DynamicProductFields from '@/components/DynamicProductFields';

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
  quality: string;
  sizes?: string[];
  colors?: string[];
  available_variants?: string[];
  brand?: string;
  material?: string;
  care_instructions?: string;
  measurements?: Record<string, string>;
  specifications?: Record<string, string>;
  style_notes?: string;
  fit_info?: string;
  occasion?: string[];
  season?: string[];
};

export default function EditProductPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [delivery_fee, setDeliveryFee] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [quality, setQuality] = useState('new');
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [variants, setVariants] = useState<Array<{
    size: string;
    color: string;
    quantity: number;
    sku: string;
  }>>([]);
  const [brand, setBrand] = useState('');
  const [material, setMaterial] = useState('');
  const [careInstructions, setCareInstructions] = useState('');
  const [measurements, setMeasurements] = useState<{[key: string]: string}>({});
  const [shippingInfo, setShippingInfo] = useState({
    processing_time: '1-2 business days',
    shipping_options: [],
    return_policy: ''
  });
  const [highlights, setHighlights] = useState<string[]>([]);
  const [specifications, setSpecifications] = useState<{[key: string]: string}>({});
  const [styleNotes, setStyleNotes] = useState('');
  const [fitInfo, setFitInfo] = useState('');
  const [occasion, setOccasion] = useState<string[]>([]);
  const [season, setSeason] = useState<string[]>([]);
  const [sustainabilityInfo, setSustainabilityInfo] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('');
  const [warrantyInfo, setWarrantyInfo] = useState('');
  const [faqs, setFaqs] = useState<Array<{question: string; answer: string}>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClientComponent();

  const categoryConfig = CATEGORY_SPECIFIC_FIELDS[category as keyof typeof CATEGORY_SPECIFIC_FIELDS] 
    || CATEGORY_SPECIFIC_FIELDS.default;

  const inputClasses = "mt-1 block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm text-base transition duration-150 ease-in-out";
  const selectClasses = "mt-1 block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base transition duration-150 ease-in-out";
  const textareaClasses = "mt-1 block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm text-base transition duration-150 ease-in-out";

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(`
            *,
            product_images (
              id,
              image_url,
              is_model_picture
            )
          `)
          .eq('id', params.id)
          .single();
        
        if (productError) throw productError;

        setTitle(productData.title || '');
        setDescription(productData.description || '');
        setPrice(productData.price?.toString() || '');
        setCategory(productData.category || '');
        setQuantity(productData.quantity?.toString() || '0');
        setDeliveryFee(productData.delivery_fee?.toString() || '');
        setDetailedDescription(productData.detailed_description || '');
        setQuality(productData.quality || 'new');
        setSizes(productData.sizes || []);
        setColors(productData.colors || []);
        setVariants(productData.available_variants || []);
        setBrand(productData.brand || '');
        setMaterial(productData.material || '');
        setCareInstructions(productData.care_instructions || '');
        setMeasurements(productData.measurements || {});
        setShippingInfo(productData.shipping_info || {
          processing_time: '1-2 business days',
          shipping_options: [],
          return_policy: ''
        });
        setHighlights(productData.highlights || []);
        setSpecifications(productData.specifications || {});
        setStyleNotes(productData.style_notes || '');
        setFitInfo(productData.fit_info || '');
        setOccasion(productData.occasion || []);
        setSeason(productData.season || []);
        setSustainabilityInfo(productData.sustainability_info || '');
        setCountryOfOrigin(productData.country_of_origin || '');
        setWarrantyInfo(productData.warranty_info || '');
        setFaqs(productData.faqs || []);
        setExistingImages(productData.product_images || []);
        
        setLoading(false);
      } catch (error) {
        setError('Failed to load product');
        setLoading(false);
      }
    };
    
    fetchProduct();
  }, [params.id, supabase]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files);
      setImages(prevImages => [...prevImages, ...newImages]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prevImages => prevImages.filter((_, i) => i !== index));
  };

  const handleRemoveExistingImage = (imageUrl: string) => {
    setImagesToDelete(prev => [...prev, imageUrl]);
    setExistingImages(prev => prev.filter(img => img.image_url !== imageUrl));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!title || !description || !price || !quantity || !category) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      const totalImages = existingImages.length - imagesToDelete.length + images.length;
      if (totalImages < 4 || totalImages > 8) {
        setError(`Please maintain between 4-8 images (you have ${totalImages})`);
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({
          title,
          description,
          price: parseFloat(price),
          category,
          quantity: parseInt(quantity),
          delivery_fee: delivery_fee ? parseFloat(delivery_fee) : null,
          detailed_description: detailedDescription,
          quality,
          sizes,
          colors,
          available_variants: variants,
          brand,
          material,
          care_instructions: careInstructions,
          measurements,
          shipping_info: shippingInfo,
          highlights,
          specifications,
          style_notes: styleNotes,
          fit_info: fitInfo,
          occasion,
          season,
          sustainability_info: sustainabilityInfo,
          country_of_origin: countryOfOrigin,
          warranty_info: warrantyInfo,
          faqs,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id);

      if (updateError) throw updateError;

      if (imagesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from('products')
          .remove(imagesToDelete);

        if (deleteError) throw deleteError;
      }

      if (images.length > 0) {
        for (const image of images) {
            const fileExt = image.name.split('.').pop();
          const fileName = `${params.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from('products')
              .upload(fileName, image);

          if (uploadError) throw uploadError;

            const { error: imageError } = await supabase
              .from('product_images')
              .insert({
                product_id: params.id,
              image_url: fileName,
                is_model_picture: false
              });

          if (imageError) throw imageError;
        }
      }

        router.push('/dashboard/products');
      toast.success('Product updated successfully');
    } catch (error) {
      setError('Failed to update product');
      setLoading(false);
    }
  };

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
            ) : error && !existingImages.length ? (
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
                          className={textareaClasses}
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
                          value={delivery_fee}
                          onChange={(e) => setDeliveryFee(e.target.value)}
                          className={`${inputClasses} pl-12`}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <p className="mt-1 text-sm text-gray-500">Leave empty for free delivery</p>
                    </div>
                  </div>
                </div>

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
                        className={textareaClasses}
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

                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Product Quality</h4>
                  <div className="sm:col-span-3">
                    <label htmlFor="quality" className="block text-sm font-medium text-gray-700">
                      Item Condition <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <select
                        id="quality"
                        value={quality}
                        onChange={(e) => setQuality(e.target.value)}
                        className={selectClasses}
                        required
                      >
                        <option value="new">New</option>
                        <option value="used">Used</option>
                        <option value="refurbished">Refurbished</option>
                      </select>
                      <p className="mt-2 text-sm text-gray-500">
                        Select the condition of your item:
                        <ul className="list-disc pl-5 mt-1">
                          <li>New: Brand new, unused item</li>
                          <li>Used: Previously owned and used item</li>
                          <li>Refurbished: Restored to like-new condition</li>
                        </ul>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Product Images</h4>
                  <div className="sm:col-span-6">
                    <label htmlFor="newImages" className="block text-sm font-medium text-gray-700">
                      Add New Images
                    </label>
                    <div className="mt-1">
                      <input
                        type="file"
                        id="newImages"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                        multiple
                        accept="image/*"
                      />
                    </div>
                    {images.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          {images.length} new {images.length === 1 ? 'image' : 'images'} selected
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

                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Existing Images</h4>
                  {existingImages.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {existingImages.map((image) => (
                        <div key={image.id} className="relative">
                          <img
                            src={image.image_url}
                            alt="Product"
                            className="h-24 w-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingImage(image.image_url)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                          >
                            X
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Dynamic Fields based on Category</h4>
                  {category && (
                    <DynamicProductFields
                      category={category}
                      specifications={specifications}
                      setSpecifications={setSpecifications}
                      measurements={measurements}
                      setMeasurements={setMeasurements}
                      inputClasses={inputClasses}
                      selectClasses={selectClasses}
                    />
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Additional Fields</h4>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Brand</label>
                      <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className={inputClasses}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Material</label>
                      <input
                        type="text"
                        value={material}
                        onChange={(e) => setMaterial(e.target.value)}
                        className={inputClasses}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Care Instructions</label>
                      <textarea
                        value={careInstructions}
                        onChange={(e) => setCareInstructions(e.target.value)}
                        className={textareaClasses}
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Style Notes</label>
                      <textarea
                        value={styleNotes}
                        onChange={(e) => setStyleNotes(e.target.value)}
                        className={textareaClasses}
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Fit Information</label>
                      <textarea
                        value={fitInfo}
                        onChange={(e) => setFitInfo(e.target.value)}
                        className={textareaClasses}
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Sustainability Information</label>
                      <textarea
                        value={sustainabilityInfo}
                        onChange={(e) => setSustainabilityInfo(e.target.value)}
                        className={textareaClasses}
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Country of Origin</label>
                      <input
                        type="text"
                        value={countryOfOrigin}
                        onChange={(e) => setCountryOfOrigin(e.target.value)}
                        className={inputClasses}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Warranty Information</label>
                      <textarea
                        value={warrantyInfo}
                        onChange={(e) => setWarrantyInfo(e.target.value)}
                        className={textareaClasses}
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">FAQs</label>
                      {faqs.map((faq, index) => (
                        <div key={index} className="mt-2 space-y-2">
                          <input
                            type="text"
                            value={faq.question}
                            onChange={(e) => {
                              const newFaqs = [...faqs];
                              newFaqs[index].question = e.target.value;
                              setFaqs(newFaqs);
                            }}
                            className={inputClasses}
                            placeholder="Question"
                          />
                          <textarea
                            value={faq.answer}
                            onChange={(e) => {
                              const newFaqs = [...faqs];
                              newFaqs[index].answer = e.target.value;
                              setFaqs(newFaqs);
                            }}
                            className={textareaClasses}
                            placeholder="Answer"
                            rows={2}
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}
                        className="mt-2 text-sm text-green-600 hover:text-green-500"
                      >
                        Add FAQ
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Link
                    href="/dashboard/products"
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Save Changes
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