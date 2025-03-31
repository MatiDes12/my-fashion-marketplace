'use client';

import { useState, useRef } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { PRODUCT_CATEGORIES, CATEGORY_SPECIFIC_FIELDS } from '@/utils/constants';
import Link from 'next/link';
import DynamicProductFields from '@/components/DynamicProductFields';

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
  const [deliveryOptions, setDeliveryOptions] = useState({
    delivery: true,
    pickup: true
  });
  const [pickupLocation, setPickupLocation] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClientComponent();

  // Add this line to get category configuration
  const categoryConfig = CATEGORY_SPECIFIC_FIELDS[category as keyof typeof CATEGORY_SPECIFIC_FIELDS] 
    || CATEGORY_SPECIFIC_FIELDS.default;

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

      if (images.length < 4 || images.length > 8) {
        setError(`Please upload between 4-8 images (you have ${images.length})`);
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
          detailed_description: detailedDescription,
          price: parseFloat(price),
          category: finalCategory,
          owner_id: session.user.id,
          is_active: true,
          quantity: parseInt(quantity),
          delivery_fee: deliveryOptions.delivery && delivery_fee ? parseFloat(delivery_fee) : null,
          quality,
          sizes,
          colors,
          available_variants: variants,
          brand,
          material,
          care_instructions: careInstructions,
          measurements,
          shipping_info: {
            processing_time: shippingInfo.processing_time,
            shipping_options: shippingInfo.shipping_options,
          },
          highlights,
          specifications,
          style_notes: styleNotes,
          fit_info: fitInfo,
          occasion,
          season,
          sustainability_info: sustainabilityInfo,
          country_of_origin: countryOfOrigin,
          warranty_info: shippingInfo.return_policy,
          faqs,
          delivery_options: {
            ...deliveryOptions,
            pickup_location: deliveryOptions.pickup ? pickupLocation : null
          },
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

    if (!deliveryOptions.delivery && !deliveryOptions.pickup) {
      setError('Please select at least one delivery option');
      setLoading(false);
      return;
    }

    if (deliveryOptions.delivery && !delivery_fee) {
      setError('Please set a delivery fee');
      setLoading(false);
      return;
    }
  };

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length < 4) {
        setError('Please upload at least 4 images');
        return;
      }
      if (files.length > 8) {
        setError('Maximum 8 images allowed');
        return;
      }
      setImages(files);
      setError(null);
    }
  }

  // Update the input and textarea styles with these classes
  const inputClasses = "block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base transition duration-150 ease-in-out";
  const selectClasses = "block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base transition duration-150 ease-in-out";
  const textareaClasses = "block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base transition duration-150 ease-in-out";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Add New Product</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Fill in the details below to create a new product listing
            </p>
      </div>
      
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
                        placeholder="Traditional Habesha Dress"
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

                              {/* Home & Living */}
                            <optgroup label="Home & Living">
                              <option value="home_living">Home & Living</option>
                              <option value="furniture">Furniture</option>
                              <option value="home_decor">Home Decor</option>
                              <option value="kitchen_dining">Kitchen & Dining</option>
                              <option value="bedding">Bedding</option>
                              <option value="lighting">Lighting</option>
                              <option value="rugs_carpets">Rugs & Carpets</option>
                            </optgroup>

                              {/* Beauty & Personal Care */}
                              <optgroup label="Beauty & Personal Care">
                                <option value="beauty_personal_care">Beauty & Personal Care</option>
                                <option value="skincare">Skincare</option>
                                <option value="hair_care">Hair Care</option>
                                <option value="makeup">Makeup</option>
                                <option value="fragrances">Fragrances</option>
                                <option value="traditional_beauty">Traditional Beauty Products</option>
                              </optgroup>

                              {/* Jewelry & Accessories */}
                              <optgroup label="Jewelry & Accessories">
                                <option value="jewelry">Jewelry</option>
                                <option value="watches">Watches</option>
                                <option value="bags_purses">Bags & Purses</option>
                                <option value="scarves_shawls">Scarves & Shawls</option>
                              </optgroup>

                              {/* Art & Collectibles */}
                              <optgroup label="Art & Collectibles">
                                <option value="art_collectibles">Art & Collectibles</option>
                                <option value="paintings">Paintings</option>
                                <option value="sculptures">Sculptures</option>
                                <option value="traditional_art">Traditional Art</option>
                                <option value="photography">Photography</option>
                                <option value="handmade_crafts">Handmade Crafts</option>
                              </optgroup>

                              {/* Food & Beverages */}
                              <optgroup label="Food & Beverages">
                                <option value="food_beverages">Food & Beverages</option>
                                <option value="coffee_tea">Coffee & Tea</option>
                                <option value="spices_seasonings">Spices & Seasonings</option>
                                <option value="traditional_foods">Traditional Foods</option>
                                <option value="snacks">Snacks</option>
                              </optgroup>

                              {/* Electronics */}
                              <optgroup label="Electronics">
                                <option value="electronics">Electronics</option>
                                <option value="phones_accessories">Phones & Accessories</option>
                                <option value="computers_tablets">Computers & Tablets</option>
                                <option value="audio_headphones">Audio & Headphones</option>
                                <option value="smart_home">Smart Home</option>
                              </optgroup>

                              {/* Books & Media */}
                              <optgroup label="Books & Media">
                                <option value="books_media">Books & Media</option>
                                <option value="books">Books</option>
                                <option value="music">Music</option>
                                <option value="movies">Movies</option>
                                <option value="educational_materials">Educational Materials</option>
                              </optgroup>

                              {/* Kids & Baby */}
                              <optgroup label="Kids & Baby">
                                <option value="kids_baby">Kids & Baby</option>
                                <option value="kids_clothing">Kids Clothing</option>
                                <option value="baby_essentials">Baby Essentials</option>
                                <option value="toys_games">Toys & Games</option>
                                <option value="school_supplies">School Supplies</option>
                              </optgroup>

                              {/* Sports & Fitness */}
                              <optgroup label="Sports & Fitness">
                                <option value="sports_fitness">Sports & Fitness</option>
                                <option value="exercise_equipment">Exercise Equipment</option>
                                <option value="sports_wear">Sports Wear</option>
                                <option value="outdoor_gear">Outdoor Gear</option>
                              </optgroup>

                              {/* Health & Wellness */}
                              <optgroup label="Health & Wellness">
                                <option value="health_wellness">Health & Wellness</option>
                                <option value="traditional_medicine">Traditional Medicine</option>
                                <option value="supplements">Supplements</option>
                                <option value="medical_supplies">Medical Supplies</option>
                              </optgroup>

                              {/* Musical Instruments */}
                              <optgroup label="Musical Instruments">
                                <option value="musical_instruments">Musical Instruments</option>
                                <option value="traditional_instruments">Traditional Instruments</option>
                                <option value="modern_instruments">Modern Instruments</option>
                                <option value="music_accessories">Music Accessories</option>
                              </optgroup>

                              {/* Party & Events */}
                              <optgroup label="Party & Events">
                                <option value="party_events">Party & Events</option>
                                <option value="wedding_supplies">Wedding Supplies</option>
                                <option value="holiday_decorations">Holiday Decorations</option>
                                <option value="event_accessories">Event Accessories</option>
                              </optgroup>

                              {/* Pet Supplies */}
                              <optgroup label="Pet Supplies">
                                <option value="pet_supplies">Pet Supplies</option>
                                <option value="pet_food">Pet Food</option>
                                <option value="pet_accessories">Pet Accessories</option>
                                <option value="pet_care">Pet Care</option>
                              </optgroup>

                              {/* Office & Stationery */}
                              <optgroup label="Office & Stationery">
                                <option value="office_stationery">Office & Stationery</option>
                                <option value="office_supplies">Office Supplies</option>
                                <option value="writing_materials">Writing Materials</option>
                                <option value="organization">Organization</option>
                              </optgroup>

                              {/* Garden & Outdoor */}
                              <optgroup label="Garden & Outdoor">
                                <option value="garden_outdoor">Garden & Outdoor</option>
                                <option value="plants_seeds">Plants & Seeds</option>
                                <option value="garden_tools">Garden Tools</option>
                                <option value="outdoor_furniture">Outdoor Furniture</option>
                              </optgroup>

                              {/* Vintage & Antiques */}
                              <optgroup label="Vintage & Antiques">
                                <option value="vintage_antiques">Vintage & Antiques</option>
                                <option value="vintage_clothing">Vintage Clothing</option>
                                <option value="antique_furniture">Antique Furniture</option>
                                <option value="collectibles">Collectibles</option>
                              </optgroup>
                            
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
                      <p className="mt-2 text-sm text-gray-500">
                        Choose the most appropriate category for your product to help buyers find it easily.
                      </p>
                    </div>
                  </div>
                  </div>
                </div>

                {/* Description Section */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Product Description</h4>
                  <div className="space-y-6">
                    <div>
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

                    <div>
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
                      <div className="mt-2 bg-white p-4 rounded-md border border-gray-200">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Include information about:</h5>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                          <li className="flex items-center">
                            <svg className="h-4 w-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Materials and fabric composition
                          </li>
                          <li className="flex items-center">
                            <svg className="h-4 w-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Size and measurements
                          </li>
                          <li className="flex items-center">
                            <svg className="h-4 w-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Care instructions
                          </li>
                          <li className="flex items-center">
                            <svg className="h-4 w-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Special features
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pricing and Inventory Section */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Pricing & Inventory</h4>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Price (ETB) <span className="text-red-500">*</span>
                      </label>
                        <input
                          type="number"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                        className={inputClasses}
                        placeholder="Enter price"
                          required
                        min="0"
                        step="0.01"
                        />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Quantity <span className="text-red-500">*</span>
                    </label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                          className={inputClasses}
                        placeholder="Available quantity"
                        required
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Product Quality Section */}
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

                {/* Product Variants Section */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Product Variants</h4>
                  
                  {/* Sizes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Available Sizes
                    </label>
                    <div className="mt-2 space-y-2">
                      {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map((size) => (
                        <label key={size} className="inline-flex items-center mr-4">
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

                  {/* Colors */}
                    <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Available Colors
                    </label>
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

                  {/* Variants */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Product Variants
                    </label>
                    <div className="mt-2 space-y-4">
                      {sizes.map(size => 
                        colors.map(color => (
                          <div key={`${size}-${color}`} className="flex items-center space-x-4">
                            <span className="w-24">{size} - {color}</span>
                      <input
                        type="number"
                              placeholder="Quantity"
                        min="0"
                              onChange={(e) => {
                                const newVariants = [...variants];
                                const variantIndex = variants.findIndex(
                                  v => v.size === size && v.color === color
                                );
                                if (variantIndex >= 0) {
                                  newVariants[variantIndex].quantity = parseInt(e.target.value);
                                } else {
                                  newVariants.push({
                                    size,
                                    color,
                                    quantity: parseInt(e.target.value),
                                    sku: `${size}-${color}`
                                  });
                                }
                                setVariants(newVariants);
                              }}
                              className={inputClasses}
                      />
                    </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Brand
                      </label>
                      <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className={inputClasses}
                        placeholder="Brand name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Material
                      </label>
                      <input
                        type="text"
                        value={material}
                        onChange={(e) => setMaterial(e.target.value)}
                        className={inputClasses}
                        placeholder="Material composition"
                      />
                    </div>
                  </div>

                  {/* Care Instructions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Care Instructions
                    </label>
                    <textarea
                      value={careInstructions}
                      onChange={(e) => setCareInstructions(e.target.value)}
                      rows={3}
                      className={inputClasses}
                      placeholder="Washing and care instructions"
                    />
                  </div>

                  {/* Measurements */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Measurements
                    </label>
                    <div className="mt-2 space-y-2">
                      {['Chest', 'Length', 'Shoulder', 'Sleeve'].map((measurement) => (
                        <div key={measurement} className="flex items-center space-x-2">
                          <span className="w-24 text-sm">{measurement}</span>
                          <input
                            type="text"
                            value={measurements[measurement] || ''}
                            onChange={(e) => setMeasurements({
                              ...measurements,
                              [measurement]: e.target.value
                            })}
                            className={inputClasses}
                            placeholder={`${measurement} measurement`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Additional Product Details */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">Additional Product Details</h4>

                  {/* Product Highlights */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Product Highlights
                    </label>
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        value={highlights.join(', ')}
                        onChange={(e) => setHighlights(e.target.value.split(',').map(h => h.trim()))}
                        placeholder="Enter key features (comma-separated)"
                        className={inputClasses}
                      />
                    </div>
                  </div>

                  {/* Style and Fit Information */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Style Notes
                      </label>
                      <textarea
                        value={styleNotes}
                        onChange={(e) => setStyleNotes(e.target.value)}
                        rows={3}
                        className={inputClasses}
                        placeholder="Describe the style and how to wear it"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Fit Information
                      </label>
                      <textarea
                        value={fitInfo}
                        onChange={(e) => setFitInfo(e.target.value)}
                        rows={3}
                        className={inputClasses}
                        placeholder="Describe how the item fits"
                      />
                    </div>
                  </div>

                  {/* Occasion and Season */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Suitable Occasions
                      </label>
                      <select
                        multiple
                        value={occasion}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                          setOccasion(selected);
                        }}
                        className={selectClasses}
                      >
                        <option value="casual">Casual</option>
                        <option value="formal">Formal</option>
                        <option value="party">Party</option>
                        <option value="wedding">Wedding</option>
                        <option value="business">Business</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Suitable Seasons
                      </label>
                      <select
                        multiple
                        value={season}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                          setSeason(selected);
                        }}
                        className={selectClasses}
                      >
                        <option value="spring">Spring</option>
                        <option value="summer">Summer</option>
                        <option value="autumn">Autumn</option>
                        <option value="winter">Winter</option>
                      </select>
                    </div>
                  </div>

                  {/* Shipping and Returns */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Return Policy
                    </label>
                    <textarea
                      value={shippingInfo.return_policy}
                      onChange={(e) => setShippingInfo({...shippingInfo, return_policy: e.target.value})}
                      rows={3}
                      className={inputClasses}
                      placeholder="Describe your return policy"
                    />
                  </div>

                  {/* FAQs */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Frequently Asked Questions
                    </label>
                    <div className="mt-2 space-y-4">
                      {faqs.map((faq, index) => (
                        <div key={index} className="grid grid-cols-1 gap-2">
                          <input
                            type="text"
                            value={faq.question}
                            onChange={(e) => {
                              const newFaqs = [...faqs];
                              newFaqs[index].question = e.target.value;
                              setFaqs(newFaqs);
                            }}
                            placeholder="Question"
                            className={inputClasses}
                          />
                          <textarea
                            value={faq.answer}
                            onChange={(e) => {
                              const newFaqs = [...faqs];
                              newFaqs[index].answer = e.target.value;
                              setFaqs(newFaqs);
                            }}
                            placeholder="Answer"
                            rows={2}
                            className={inputClasses}
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}
                        className="text-sm text-green-600 hover:text-green-500"
                      >
                        + Add FAQ
                      </button>
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Country of Origin
                      </label>
                      <input
                        type="text"
                        value={countryOfOrigin}
                        onChange={(e) => setCountryOfOrigin(e.target.value)}
                        className={inputClasses}
                        placeholder="Where was this item made?"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Sustainability Information
                      </label>
                      <textarea
                        value={sustainabilityInfo}
                        onChange={(e) => setSustainabilityInfo(e.target.value)}
                        className={inputClasses}
                        placeholder="Eco-friendly features, sustainable practices, etc."
                      />
                    </div>
                  </div>
                  </div>

                {/* Images Section */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-base font-medium text-gray-900">Product Images</h4>
                    <span className="text-sm text-gray-500">
                      {images.length}/8 images
                    </span>
                  </div>
                  <div>
                    <label htmlFor="images" className="block text-sm font-medium text-gray-700">
                      Upload Images <span className="text-red-500">*</span>
                    </label>
                    <p className="mt-1 text-sm text-gray-500">
                      Upload 4-8 high-quality images of your product. Include different angles and details.
                    </p>
                    <div className="mt-3">
                      <input
                        type="file"
                        id="images"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        className="block w-full text-base text-gray-500 
                          file:mr-4 file:py-3 file:px-4 
                          file:rounded-lg file:border-0 
                          file:text-base file:font-medium 
                          file:bg-green-50 file:text-green-700 
                          hover:file:bg-green-100
                          border-2 border-gray-200 rounded-lg"
                        multiple
                        accept="image/*"
                      />
                    </div>
                    {images.length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center space-x-2">
                          <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <p className="text-sm text-gray-700">
                            {images.length} {images.length === 1 ? 'image' : 'images'} selected
                          </p>
                        </div>
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

                {/* Dynamic Fields based on Category */}
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

                {/* Show Size/Color options only if required for the category */}
                {categoryConfig.requiresSizing && (
                  <div className="sizes-section mt-6">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Size Options</h4>
                    <div className="mt-2 space-y-2">
                      {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map((size) => (
                        <label key={size} className="inline-flex items-center mr-4">
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
                )}

                {categoryConfig.requiresColors && (
                  <div className="colors-section mt-6">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Color Options</h4>
                    <div className="mt-2">
                      <input
                        type="text"
                        value={colors.join(', ')}
                        onChange={(e) => setColors(e.target.value.split(',').map(c => c.trim()))}
                        placeholder="Enter colors (comma-separated)"
                        className={inputClasses}
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        Example: Red, Blue, Green, Black
                      </p>
                    </div>
                  </div>
                )}

                {/* Delivery Options Section */}
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
                        {deliveryOptions.delivery && !delivery_fee && (
                          <p className="mt-1 text-xs text-yellow-600">
                            <svg className="inline h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            No delivery fee set - delivery will be free
                          </p>
                        )}
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
                          value={pickupLocation}
                          onChange={(e) => setPickupLocation(e.target.value)}
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

                {/* Delivery Time Estimate */}
                {deliveryOptions.delivery && (
                  <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                    <h4 className="text-base font-medium text-gray-900">Delivery Time Estimate</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Estimated Delivery Time
                        </label>
                        <select
                          value={deliveryTime}
                          onChange={(e) => setDeliveryTime(e.target.value)}
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
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex justify-end space-x-3">
                    <Link
                      href="/dashboard/products"
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        Creating...
                      </span>
                      ) : (
                        'Create Product'
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