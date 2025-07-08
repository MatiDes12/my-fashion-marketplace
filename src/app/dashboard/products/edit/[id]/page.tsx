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
  custom_variants?: {
    name: string;
    options: string[];
  }[];
  available_variants?: {
    size?: string;
    color?: string;
    custom_options?: { [key: string]: string };
    quantity: number;
    sku: string;
  }[];
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

const formatImageUrl = (url: string) => {
  if (!url) return '/placeholder.png';
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${url}`;
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
  const [customVariantTypes, setCustomVariantTypes] = useState<Array<{
    name: string;
    options: string[];
  }>>([]);
  const [variants, setVariants] = useState<Array<{
    size?: string;
    color?: string;
    custom_options?: { [key: string]: string };
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
  const [deliveryOptions, setDeliveryOptions] = useState({
    delivery: true,
    pickup: true,
    pickup_location: '',
    delivery_time: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClientComponent();

  const categoryConfig = CATEGORY_SPECIFIC_FIELDS[category] || 
    Object.entries(CATEGORY_SPECIFIC_FIELDS).find(([key]) => 
      key.toLowerCase() === category.toLowerCase()
    )?.[1] || 
    CATEGORY_SPECIFIC_FIELDS.default;

  const inputClasses = "mt-1 block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm text-base transition duration-150 ease-in-out";
  const selectClasses = "mt-1 block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base transition duration-150 ease-in-out";
  const textareaClasses = "mt-1 block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm text-base transition duration-150 ease-in-out";

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data: product, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', params.id)
          .single();
        
        if (error) throw error;

        // Set basic product information
        setTitle(product.title || '');
        setDescription(product.description || '');
        setPrice(product.price?.toString() || '');
        setCategory(product.category || '');
        setQuantity(product.quantity?.toString() || '0');
        setDeliveryFee(product.delivery_fee?.toString() || '');
        setDetailedDescription(product.detailed_description || '');
        setQuality(product.quality || 'new');
        setSizes(product.sizes || []);
        setColors(product.colors || []);
        
        // Handle brand - prioritize root level brand over specifications.brand
        setBrand(product.brand || product.specifications?.brand || '');
        
        // Remove brand from specifications if it exists
        const specs = { ...product.specifications };
        delete specs.brand;
        setSpecifications(specs);

        // Extract custom variant types from available variants
        if (product.available_variants && Array.isArray(product.available_variants)) {
          const customTypes = new Map<string, Set<string>>();
          
          // Collect all custom variant types and their options
          product.available_variants.forEach((variant: any) => {
            Object.entries(variant).forEach(([key, value]) => {
              // Skip standard variant properties
              if (!['size', 'color', 'quantity', 'sku'].includes(key) && value) {
                if (!customTypes.has(key)) {
                  customTypes.set(key, new Set());
                }
                customTypes.get(key)?.add(value as string);
              }
            });
          });

          // Convert to the expected format
          const customVariantTypesArray = Array.from(customTypes.entries()).map(([name, options]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '), // Convert from snake_case to Title Case
            options: Array.from(options)
          }));

          setCustomVariantTypes(customVariantTypesArray);

          // Convert variants to include custom_options
          const formattedVariants = product.available_variants.map((variant: any) => {
            const formattedVariant: any = {
              size: variant.size,
              color: variant.color,
              quantity: variant.quantity,
              sku: variant.sku,
              custom_options: {}
            };

            // Add custom options
            Object.entries(variant).forEach(([key, value]) => {
              if (!['size', 'color', 'quantity', 'sku'].includes(key) && value) {
                formattedVariant.custom_options[key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')] = value;
              }
            });

            return formattedVariant;
          });

          setVariants(formattedVariants);
        }

        setExistingImages(product.product_images || []);
        setShippingInfo(product.shipping_info || {
          processing_time: '1-2 business days',
          shipping_options: [],
          return_policy: ''
        });
        setHighlights(product.highlights || []);
        setStyleNotes(product.style_notes || '');
        setFitInfo(product.fit_info || '');
        setOccasion(product.occasion || []);
        setSeason(product.season || []);
        setSustainabilityInfo(product.sustainability_info || '');
        setCountryOfOrigin(product.country_of_origin || '');
        setWarrantyInfo(product.warranty_info || '');
        setFaqs(product.faqs || []);
        setDeliveryOptions(product.delivery_options || {
          delivery: true,
          pickup: true,
          pickup_location: '',
          delivery_time: ''
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching product:', error);
        toast.error('Failed to load product');
        setLoading(false);
      }
    };
    
    fetchProduct();
  }, [params.id, supabase]);

  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const imageSectionRef = useRef<HTMLDivElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    let files: File[] = [];
    if ('dataTransfer' in e) {
      files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    } else if (e.target.files) {
      files = Array.from(e.target.files);
    }
    if (files.length + images.length + (existingImages.length - imagesToDelete.length) > 8) {
      setImageError('Maximum 8 images allowed.');
      return;
    }
    setImages(prev => [...prev, ...files]);
    setImageError(null);
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
    setImageError(null);

    // Enforce minimum 4 images (existing + new - toDelete)
    const totalImages = existingImages.length - imagesToDelete.length + images.length;
    if (totalImages < 4) {
      setImageError('Please upload at least 4 images.');
      if (imageSectionRef.current) imageSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setLoading(false);
      return;
    }

    try {
      // Get the current user's session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!session?.user) {
        throw new Error('You must be logged in to update a product');
      }

      // Validate required fields
      if (!title || !description || !price || !category || !quantity) {
        throw new Error('Please fill in all required fields');
      }

      // Prepare variants data - flatten custom options into the variant object
      const flattenedVariants = variants.map(variant => {
        // Start with basic variant properties
        const flatVariant: any = {
          size: variant.size,
          color: variant.color,
          quantity: variant.quantity,
          sku: variant.sku
        };

        // Add custom options as direct properties
        if (variant.custom_options) {
          Object.entries(variant.custom_options).forEach(([key, value]) => {
            const storageKey = key.toLowerCase().replace(/\s+/g, '_');
            flatVariant[storageKey] = value;
          });
        }

        return flatVariant;
      });

      // Update product details
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
          available_variants: flattenedVariants,
          brand,
          material,
          care_instructions: careInstructions,
          measurements,
          shipping_info: shippingInfo,
          highlights,
          specifications: {
            ...specifications,
            // Remove brand from specifications if it exists
            ...(specifications.brand ? { } : {})
          },
          style_notes: styleNotes,
          fit_info: fitInfo,
          occasion,
          season,
          sustainability_info: sustainabilityInfo,
          country_of_origin: countryOfOrigin,
          warranty_info: warrantyInfo,
          faqs,
          delivery_time: deliveryOptions.delivery_time,
          delivery_options: deliveryOptions,
          owner_id: session.user.id
        })
        .eq('id', params.id)
        .eq('owner_id', session.user.id); // Only allow update if user owns the product

      if (updateError) throw updateError;

      // Handle image uploads
      if (images.length > 0) {
        try {
          for (const image of images) {
            const fileExt = image.name.split('.').pop();
            const fileName = `${params.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            
            // Upload image to storage
            const { error: uploadError } = await supabase.storage
              .from('products')
              .upload(fileName, image);

            if (uploadError) throw uploadError;

            // Get the public URL
            const { data: publicUrlData } = await supabase.storage
              .from('products')
              .getPublicUrl(fileName);

            if (!publicUrlData?.publicUrl) {
              throw new Error('Failed to get public URL for uploaded image');
            }

            // Create image reference in product_images table
            const { error: imageRefError } = await supabase
              .from('product_images')
              .insert({
                product_id: params.id,
                image_url: publicUrlData.publicUrl,
                is_model_picture: false
              });

            if (imageRefError) {
              console.error('Error saving image reference:', imageRefError);
              throw imageRefError;
            }
          }
        } catch (error) {
          console.error('Error uploading images:', error);
          // Don't throw here, allow product update even if image upload fails
          toast.error('Some images failed to upload');
        }
      }

      toast.success('Product updated successfully');
      router.push('/dashboard/products');
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
      setLoading(false);
    }
  };

  const ExistingImage = ({ image }: { image: ProductImage }) => {
    const [imageError, setImageError] = useState(false);
    const imageUrl = imageError ? '/placeholder.png' : formatImageUrl(image.image_url);

    return (
      <div className="relative">
        <Image
          src={imageUrl}
          alt="Product"
          width={96}
          height={96}
          className="h-24 w-24 object-cover rounded-lg"
          onError={() => setImageError(true)}
        />
        <button
          type="button"
          onClick={() => handleRemoveExistingImage(image.image_url)}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
        >
          X
        </button>
      </div>
    );
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

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Category <span className="text-red-500">*</span>
                      </label>
                        {!showCustomCategory ? (
                        <div className="mt-1 flex items-center">
                            <select
                              value={category}
                            onChange={(e) => {
                              if (e.target.value === 'custom') {
                                setShowCustomCategory(true);
                              } else {
                                setCategory(e.target.value);
                              }
                            }}
                              className={selectClasses}
                            required
                            >
                              <option value="">Select a category</option>
                              <optgroup label="Traditional Wear">
                              <option value="Habesha Kemis">Habesha Kemis</option>
                              <option value="Tilfi">Tilfi</option>
                              <option value="Traditional Accessories">Traditional Accessories</option>
                              </optgroup>
                              <optgroup label="Modern Fashion">
                              <option value="Modern Fashion">Modern Fashion</option>
                              <option value="Dresses">Dresses</option>
                              <option value="Tops">Tops</option>
                              <option value="Pants & Skirts">Pants & Skirts</option>
                              <option value="Outerwear">Outerwear</option>
                              <option value="Fashion Accessories">Fashion Accessories</option>
                              <option value="Shoes">Shoes</option>
                            </optgroup>
                            <optgroup label="Home & Living">
                              <option value="Home & Living">Home & Living</option>
                              <option value="Furniture">Furniture</option>
                              <option value="Home Decor">Home Decor</option>
                              <option value="Kitchen & Dining">Kitchen & Dining</option>
                              <option value="Bedding">Bedding</option>
                              <option value="Lighting">Lighting</option>
                              <option value="Rugs & Carpets">Rugs & Carpets</option>
                            </optgroup>
                            <optgroup label="Beauty & Personal Care">
                              <option value="Beauty & Personal Care">Beauty & Personal Care</option>
                              <option value="Skincare">Skincare</option>
                              <option value="Hair Care">Hair Care</option>
                              <option value="Makeup">Makeup</option>
                              <option value="Fragrances">Fragrances</option>
                              <option value="Traditional Beauty Products">Traditional Beauty Products</option>
                            </optgroup>
                            <optgroup label="Jewelry & Accessories">
                              <option value="Jewelry">Jewelry</option>
                              <option value="Watches">Watches</option>
                              <option value="Bags & Purses">Bags & Purses</option>
                              <option value="Scarves & Shawls">Scarves & Shawls</option>
                            </optgroup>
                            <optgroup label="Art & Collectibles">
                              <option value="Art & Collectibles">Art & Collectibles</option>
                              <option value="Paintings">Paintings</option>
                              <option value="Sculptures">Sculptures</option>
                              <option value="Traditional Art">Traditional Art</option>
                              <option value="Photography">Photography</option>
                              <option value="Handmade Crafts">Handmade Crafts</option>
                            </optgroup>
                            <optgroup label="Food & Beverages">
                              <option value="Food & Beverages">Food & Beverages</option>
                              <option value="Coffee & Tea">Coffee & Tea</option>
                              <option value="Spices & Seasonings">Spices & Seasonings</option>
                              <option value="Traditional Foods">Traditional Foods</option>
                              <option value="Snacks">Snacks</option>
                            </optgroup>
                            <optgroup label="Electronics & Gadgets">
                              <option value="Electronics">Electronics</option>
                              <option value="Phones & Accessories">Phones & Accessories</option>
                              <option value="Computers & Tablets">Computers & Tablets</option>
                              <option value="Audio & Headphones">Audio & Headphones</option>
                              <option value="Smart Home">Smart Home</option>
                            </optgroup>
                            <optgroup label="Books & Media">
                              <option value="Books & Media">Books & Media</option>
                              <option value="Books">Books</option>
                              <option value="Music">Music</option>
                              <option value="Movies">Movies</option>
                              <option value="Educational Materials">Educational Materials</option>
                            </optgroup>
                            <optgroup label="Kids & Baby">
                              <option value="Kids & Baby">Kids & Baby</option>
                              <option value="Kids Clothing">Kids Clothing</option>
                              <option value="Baby Essentials">Baby Essentials</option>
                              <option value="Toys & Games">Toys & Games</option>
                              <option value="School Supplies">School Supplies</option>
                            </optgroup>
                            <optgroup label="Sports & Fitness">
                              <option value="Sports & Fitness">Sports & Fitness</option>
                              <option value="Exercise Equipment">Exercise Equipment</option>
                              <option value="Sports Wear">Sports Wear</option>
                              <option value="Outdoor Gear">Outdoor Gear</option>
                            </optgroup>
                            <optgroup label="Health & Wellness">
                              <option value="Health & Wellness">Health & Wellness</option>
                              <option value="Traditional Medicine">Traditional Medicine</option>
                              <option value="Supplements">Supplements</option>
                              <option value="Medical Supplies">Medical Supplies</option>
                            </optgroup>
                            <optgroup label="Musical Instruments">
                              <option value="Musical Instruments">Musical Instruments</option>
                              <option value="Traditional Instruments">Traditional Instruments</option>
                              <option value="Modern Instruments">Modern Instruments</option>
                              <option value="Music Accessories">Music Accessories</option>
                            </optgroup>
                            <optgroup label="Party & Events">
                              <option value="Party & Events">Party & Events</option>
                              <option value="Wedding Supplies">Wedding Supplies</option>
                              <option value="Holiday Decorations">Holiday Decorations</option>
                              <option value="Event Accessories">Event Accessories</option>
                            </optgroup>
                            <optgroup label="Pet Supplies">
                              <option value="Pet Supplies">Pet Supplies</option>
                              <option value="Pet Food">Pet Food</option>
                              <option value="Pet Accessories">Pet Accessories</option>
                              <option value="Pet Care">Pet Care</option>
                            </optgroup>
                            <optgroup label="Office & Stationery">
                              <option value="Office & Stationery">Office & Stationery</option>
                              <option value="Office Supplies">Office Supplies</option>
                              <option value="Writing Materials">Writing Materials</option>
                              <option value="Organization">Organization</option>
                            </optgroup>
                            <optgroup label="Garden & Outdoor">
                              <option value="Garden & Outdoor">Garden & Outdoor</option>
                              <option value="Plants & Seeds">Plants & Seeds</option>
                              <option value="Garden Tools">Garden Tools</option>
                              <option value="Outdoor Furniture">Outdoor Furniture</option>
                            </optgroup>
                            <optgroup label="Vintage & Antiques">
                              <option value="Vintage & Antiques">Vintage & Antiques</option>
                              <option value="Vintage Clothing">Vintage Clothing</option>
                              <option value="Antique Furniture">Antique Furniture</option>
                              <option value="Collectibles">Collectibles</option>
                              </optgroup>
                            <option value="custom">Add Custom Category</option>
                            </select>
                              </div>
                        ) : (
                        <div className="mt-1 flex items-center">
                            <input
                              type="text"
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
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Delivery Options</h4>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="delivery"
                        checked={deliveryOptions.delivery}
                        onChange={(e) => setDeliveryOptions(prev => ({
                          ...prev,
                          delivery: e.target.checked
                        }))}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label htmlFor="delivery" className="text-sm text-gray-700">
                        Home Delivery
                      </label>
                    </div>

                    {deliveryOptions.delivery && (
                      <div className="ml-7 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Delivery Fee (ETB)
                          </label>
                          <div className="relative rounded-lg">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <span className="text-gray-500 text-base">ETB</span>
                            </div>
                            <input
                              type="number"
                              value={delivery_fee}
                              onChange={(e) => setDeliveryFee(e.target.value)}
                              placeholder="0.00"
                              className={`${inputClasses} pl-12`}
                              min="0"
                              step="0.01"
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">Leave empty for free delivery</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Estimated Delivery Time
                          </label>
                          <select
                            value={deliveryOptions.delivery_time}
                            onChange={(e) => setDeliveryOptions(prev => ({
                              ...prev,
                              delivery_time: e.target.value
                            }))}
                            className={selectClasses}
                          >
                            <option value="">Select delivery time</option>
                            <option value="1-2">1-2 business days</option>
                            <option value="3-5">3-5 business days</option>
                            <option value="5-7">5-7 business days</option>
                            <option value="7-14">1-2 weeks</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="pickup"
                        checked={deliveryOptions.pickup}
                        onChange={(e) => setDeliveryOptions(prev => ({
                          ...prev,
                          pickup: e.target.checked
                        }))}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label htmlFor="pickup" className="text-sm text-gray-700">
                        Store Pickup
                      </label>
                    </div>

                    {deliveryOptions.pickup && (
                      <div className="ml-7">
                        <label className="block text-sm font-medium text-gray-700">
                          Pickup Location
                        </label>
                        <textarea
                          value={deliveryOptions.pickup_location}
                          onChange={(e) => setDeliveryOptions(prev => ({
                            ...prev,
                            pickup_location: e.target.value
                          }))}
                          placeholder="Enter pickup address and instructions"
                          className={textareaClasses}
                          rows={2}
                        />
                      </div>
                    )}

                    {!deliveryOptions.delivery && !deliveryOptions.pickup && (
                      <p className="text-sm text-red-500 mt-2">
                        Please select at least one delivery option
                      </p>
                    )}
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

                <div className="bg-gray-50 rounded-lg p-6 space-y-6" ref={imageSectionRef}>
                  <div className="flex justify-between items-center">
                    <h4 className="text-base font-medium text-gray-900">Product Images <span className="text-red-500">*</span></h4>
                    <span className="text-sm text-gray-500">{existingImages.length - imagesToDelete.length + images.length}/8 images</span>
                  </div>
                  <div>
                    <label htmlFor="newImages" className="block text-sm font-medium text-gray-700">
                      Add New Images
                    </label>
                    <div
                      className={`mt-3 border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}
                      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
                      onDrop={e => { e.preventDefault(); setIsDragging(false); handleImageChange(e); }}
                      onClick={() => fileInputRef.current?.click()}
                      style={{ minHeight: 120 }}
                    >
                      <input
                        type="file"
                        id="newImages"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        className="hidden"
                        multiple
                        accept="image/*"
                      />
                      <svg className="h-10 w-10 text-green-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4a1 1 0 011-1h8a1 1 0 011 1v12m-4 4h-4a1 1 0 01-1-1v-4h10v4a1 1 0 01-1 1h-4z" />
                      </svg>
                      <span className="text-gray-600 text-sm">Click or drag & drop images here</span>
                      <span className="text-xs text-gray-400 mt-1">(JPG, PNG, up to 8 images)</span>
                    </div>
                    {imageError && (
                      <div className="mt-2 text-sm text-red-600 animate-bounce">{imageError}</div>
                    )}
                    {/* Previews for new images */}
                    {images.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {images.map((img, idx) => {
                          const url = URL.createObjectURL(img);
                          return (
                            <div key={idx} className="relative group border rounded-lg overflow-hidden">
                              <img src={url} alt={`Preview ${idx + 1}`} className="object-cover w-full h-32" />
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); handleRemoveImage(idx); }}
                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition"
                                title="Remove image"
                              >
                                &times;
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Previews for existing images */}
                    {existingImages.length - imagesToDelete.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {existingImages.filter(img => !imagesToDelete.includes(img.image_url)).map((image, idx) => (
                          <div key={image.id} className="relative group border rounded-lg overflow-hidden">
                            <img src={formatImageUrl(image.image_url)} alt="Product" className="object-cover w-full h-32" />
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); handleRemoveExistingImage(image.image_url); }}
                              className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition"
                              title="Remove image"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
                  </div>
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

                {categoryConfig.requiresSizing && (
                  <div className="sizes-section mt-6">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Size Options</h4>
                    <div className="mt-2 space-y-4">
                      {/* Letter Sizes */}
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Letter Sizes:</p>
                        <div className="flex flex-wrap gap-3">
                          {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'].map((size) => (
                            <label key={size} className="inline-flex items-center">
                              <input
                                type="checkbox"
                                checked={sizes.includes(size)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSizes([...sizes, size]);
                                  } else {
                                    setSizes(sizes.filter(s => s !== size));
                                  }
                                }}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">{size}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Numerical Sizes */}
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Numerical Sizes:</p>
                        <div className="flex flex-wrap gap-3">
                          {Array.from({ length: 21 }, (_, i) => (i + 30).toString()).map((size) => (
                            <label key={size} className="inline-flex items-center">
                              <input
                                type="checkbox"
                                checked={sizes.includes(size)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSizes([...sizes, size]);
                                  } else {
                                    setSizes(sizes.filter(s => s !== size));
                                  }
                                }}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">{size}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* EU Sizes */}
                      <div>
                        <p className="text-sm text-gray-600 mb-2">EU Sizes:</p>
                        <div className="flex flex-wrap gap-3">
                          {Array.from({ length: 16 }, (_, i) => `EU ${i + 36}`).map((size) => (
                            <label key={size} className="inline-flex items-center">
                              <input
                                type="checkbox"
                                checked={sizes.includes(size)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSizes([...sizes, size]);
                                  } else {
                                    setSizes(sizes.filter(s => s !== size));
                                  }
                                }}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">{size}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Custom Size Input */}
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Custom Sizes:</p>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            placeholder="Enter custom size"
                            className={`${inputClasses} w-48`}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const value = e.currentTarget.value.trim();
                                if (value && !sizes.includes(value)) {
                                  setSizes([...sizes, value]);
                                  e.currentTarget.value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.querySelector('input[placeholder="Enter custom size"]') as HTMLInputElement;
                              const value = input?.value.trim();
                              if (value && !sizes.includes(value)) {
                                setSizes([...sizes, value]);
                                input.value = '';
                              }
                            }}
                            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Selected Sizes Display */}
                      {sizes.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 mb-2">Selected Sizes:</p>
                          <div className="flex flex-wrap gap-2">
                            {sizes.map((size) => (
                              <span
                                key={size}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                              >
                                {size}
                                <button
                                  type="button"
                                  onClick={() => setSizes(sizes.filter(s => s !== size))}
                                  className="ml-1 inline-flex items-center p-0.5 rounded-full text-green-800 hover:bg-green-200 focus:outline-none"
                                >
                                  <span className="sr-only">Remove size {size}</span>
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Colors</h4>
                  <div className="mt-2">
                    <input
                      type="text"
                      value={colors.join(', ')}
                      onChange={(e) => setColors(e.target.value.split(',').map(c => c.trim()))}
                      placeholder="Enter colors (comma-separated)"
                      className={inputClasses}
                    />
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Custom Variant Types</h4>
                  <div className="mt-2 space-y-4">
                    {customVariantTypes.map((variantType, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={variantType.name}
                            onChange={(e) => {
                              const newTypes = [...customVariantTypes];
                              newTypes[index].name = e.target.value;
                              setCustomVariantTypes(newTypes);
                            }}
                            placeholder="Variant type name (e.g. Flavor)"
                            className={`${inputClasses} flex-1`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newTypes = [...customVariantTypes];
                              newTypes.splice(index, 1);
                              setCustomVariantTypes(newTypes);
                            }}
                            className="p-2 text-red-600 hover:text-red-800"
                          >
                            <span className="sr-only">Remove variant type</span>
                            ×
                          </button>
                        </div>
                        <input
                          type="text"
                          value={variantType.options.join(', ')}
                          onChange={(e) => {
                            const newTypes = [...customVariantTypes];
                            newTypes[index].options = e.target.value.split(',').map(o => o.trim());
                            setCustomVariantTypes(newTypes);
                          }}
                          placeholder="Enter options (comma-separated)"
                          className={inputClasses}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomVariantTypes([
                          ...customVariantTypes,
                          { name: '', options: [] }
                        ]);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                    >
                      Add Custom Variant Type
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Variants</h4>
                  <div className="mt-2 space-y-4">
                    {/* Generate all possible combinations */}
                    {(() => {
                      // Get all possible combinations
                      const combinations: Array<{
                        size?: string;
                        color?: string;
                        custom_options?: { [key: string]: string };
                      }> = [];

                      const addCombinations = (
                        current: {
                          size?: string;
                          color?: string;
                          custom_options?: { [key: string]: string };
                        },
                        remainingTypes: string[]
                      ) => {
                        if (remainingTypes.length === 0) {
                          combinations.push(current);
                          return;
                        }

                        const type = remainingTypes[0];
                        const rest = remainingTypes.slice(1);

                        if (type === 'size' && sizes.length > 0) {
                          sizes.forEach(size => {
                            addCombinations(
                              { ...current, size },
                              rest
                            );
                          });
                        } else if (type === 'color' && colors.length > 0) {
                          colors.forEach(color => {
                            addCombinations(
                              { ...current, color },
                              rest
                            );
                          });
                        } else if (type.startsWith('custom_')) {
                          const variantType = customVariantTypes[parseInt(type.split('_')[1])];
                          variantType.options.forEach(option => {
                            const custom_options = {
                              ...(current.custom_options || {}),
                              [variantType.name]: option
                            };
                            addCombinations(
                              { ...current, custom_options },
                              rest
                            );
                          });
                        } else {
                          addCombinations(current, rest);
                        }
                      };

                      // Start with all variant types
                      const variantTypes = [
                        ...(sizes.length > 0 ? ['size'] : []),
                        ...(colors.length > 0 ? ['color'] : []),
                        ...customVariantTypes.map((_, i) => `custom_${i}`)
                      ];

                      addCombinations({}, variantTypes);

                      return combinations.map((combination, index) => {
                        const variant = variants.find(v => 
                          (!v.size || v.size === combination.size) &&
                          (!v.color || v.color === combination.color) &&
                          (!v.custom_options || Object.entries(v.custom_options).every(
                            ([key, value]) => combination.custom_options?.[key] === value
                          ))
                        );

                        const variantName = [
                          combination.size,
                          combination.color,
                          ...Object.entries(combination.custom_options || {}).map(
                            ([key, value]) => `${key}: ${value}`
                          )
                        ].filter(Boolean).join(' - ');

                        return (
                          <div key={index} className="flex items-center gap-4">
                            <span className="w-1/2">{variantName}</span>
                            <input
                              type="number"
                              placeholder="Quantity"
                              min="0"
                              value={variant?.quantity || ''}
                              onChange={(e) => {
                                const quantity = parseInt(e.target.value) || 0;
                                const sku = [
                                  combination.size,
                                  combination.color,
                                  ...Object.values(combination.custom_options || {})
                                ].filter(Boolean).join('-');

                                const newVariants = [...variants];
                                const variantIndex = variants.findIndex(v =>
                                  (!v.size || v.size === combination.size) &&
                                  (!v.color || v.color === combination.color) &&
                                  (!v.custom_options || Object.entries(v.custom_options).every(
                                    ([key, value]) => combination.custom_options?.[key] === value
                                  ))
                                );

                                if (variantIndex >= 0) {
                                  newVariants[variantIndex] = {
                                    ...combination,
                                    quantity,
                                    sku
                                  };
                                } else {
                                  newVariants.push({
                                    ...combination,
                                    quantity,
                                    sku
                                  });
                                }
                                setVariants(newVariants);
                              }}
                              className={`${inputClasses} w-32`}
                            />
                          </div>
                        );
                      });
                    })()}
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