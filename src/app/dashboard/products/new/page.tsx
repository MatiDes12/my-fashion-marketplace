'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { PRODUCT_CATEGORIES, CATEGORY_SPECIFIC_FIELDS } from '@/utils/constants';
import Link from 'next/link';
import DynamicProductFields from '@/components/DynamicProductFields';
import { withSubscriptionLimits } from '@/components/withSubscriptionLimits';
import { toast } from 'react-hot-toast';

function NewProductPage() {
  const { t } = useLanguage();
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
  const [pickupLocation, setPickupLocation] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClientComponent();
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isSavingCustomCategory, setIsSavingCustomCategory] = useState(false);
  const [useStoreAddress, setUseStoreAddress] = useState(false);
  const [storeAddress, setStoreAddress] = useState('');

  // Add useEffect to fetch custom categories on component mount
  useEffect(() => {
    const fetchCustomCategories = async () => {
      try {
        const { data: customCategoriesData, error: customCategoriesError } = await supabase
          .from('custom_categories')
          .select('name')
          .eq('is_active', true)
          .order('name');
        
        if (!customCategoriesError && customCategoriesData) {
          setCustomCategories(customCategoriesData.map(cat => cat.name));
        }
      } catch (error) {
        console.error('Error fetching custom categories:', error);
      }
    };
    
    fetchCustomCategories();
  }, [supabase]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('store_settings')
            .eq('id', session.user.id)
            .single();

          if (userData?.store_settings?.address) {
            const address = userData.store_settings.address;
            
            // Extract street address from character keys (0, 1, 2, etc.)
            const streetAddressParts = [];
            let i = 0;
            while (address[i] !== undefined) {
              streetAddressParts.push(address[i]);
              i++;
            }
            const streetAddress = streetAddressParts.join('');
            
            // Build the full address
            const addressParts = [
              address.houseNo,
              streetAddress,
              address.landmark,
              address.kebele,
              address.wereda,
              address.subCity,
              address.city
            ].filter(Boolean);
            
            const formattedAddress = addressParts.join(', ');
            setStoreAddress(formattedAddress);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [supabase]);

  // Add function to save custom category
  const saveCustomCategory = async (categoryName: string) => {
    if (!categoryName.trim()) return;
    
    setIsSavingCustomCategory(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to save custom categories');
        return;
      }

      // Check if category already exists
      const { data: existingCategory } = await supabase
        .from('custom_categories')
        .select('name')
        .eq('name', categoryName.trim())
        .single();

      if (existingCategory) {
        toast.error('This category already exists');
        return;
      }

      // Insert new custom category
      const { error: insertError } = await supabase
        .from('custom_categories')
        .insert({
          name: categoryName.trim(),
          created_by: session.user.id
        });

      if (insertError) throw insertError;

      // Add to local state
      setCustomCategories(prev => [...prev, categoryName.trim()]);
      setCategory(categoryName.trim());
      setShowCustomCategory(false);
      setCustomCategory('');
      toast.success('Custom category saved successfully');
      
    } catch (error) {
      console.error('Error saving custom category:', error);
      toast.error('Failed to save custom category');
    } finally {
      setIsSavingCustomCategory(false);
    }
  };

  // Add this line to get category configuration
  const categoryConfig = CATEGORY_SPECIFIC_FIELDS[category as keyof typeof CATEGORY_SPECIFIC_FIELDS] 
    || CATEGORY_SPECIFIC_FIELDS.default;

  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [missingFields, setMissingFields] = useState<{[key: string]: boolean}>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const imageSectionRef = useRef<HTMLDivElement>(null);
  const deliveryOptionsRef = useRef<HTMLDivElement>(null);
  const deliveryCheckboxRef = useRef<HTMLInputElement>(null);
  const pickupLocationRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setImageError(null);
    setMissingFields({});

    // Validate required fields
    const missing: {[key: string]: boolean} = {};
    if (!title) missing.title = true;
    if (!description) missing.description = true;
    if (!price) missing.price = true;
    if (!category && !showCustomCategory) missing.category = true;
    if (showCustomCategory && !customCategory) missing.category = true;
    if (!quantity) missing.quantity = true;
    if (images.length < 2) missing.images = true;
    if (!deliveryOptions.delivery && !deliveryOptions.pickup) missing.deliveryOptions = true;
    if (deliveryOptions.pickup && !pickupLocation) missing.pickupLocation = true;

    if (Object.keys(missing).length > 0) {
      setMissingFields(missing);
        setLoading(false);
      // Scroll to the first missing field
      if (missing.title && titleRef.current) titleRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (missing.description && descRef.current) descRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (missing.price && priceRef.current) priceRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (missing.category && categoryRef.current) categoryRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (missing.quantity && quantityRef.current) quantityRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (missing.images && imageSectionRef.current) imageSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (missing.deliveryOptions && deliveryOptionsRef.current) {
        deliveryOptionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!deliveryOptions.delivery && deliveryCheckboxRef.current) {
          deliveryCheckboxRef.current.focus();
        }
        toast.error('Please select at least one delivery option');
      } else if (missing.pickupLocation && deliveryOptionsRef.current) {
        deliveryOptionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (pickupLocationRef.current) pickupLocationRef.current.focus();
        toast.error('Please provide a pickup location when store pickup is selected');
      }
        return;
      }

    try {
      // Get the current user's session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('You must be logged in to create a product');
      }

      // Generate variants based on sizes and colors if no specific variants are set
      let finalVariants = variants;
      if (variants.length === 0 && (sizes.length > 0 || colors.length > 0)) {
        const generatedVariants = [];
        
        if (sizes.length > 0 && colors.length > 0) {
          // Generate combinations of sizes and colors
          for (const size of sizes) {
            for (const color of colors) {
              generatedVariants.push({
                size,
                color,
                quantity: Math.floor(parseInt(quantity) / (sizes.length * colors.length)),
                sku: `${size}-${color}`.toLowerCase().replace(/\s+/g, '-')
              });
            }
          }
        } else if (sizes.length > 0) {
          // Generate variants for sizes only
          for (const size of sizes) {
            generatedVariants.push({
              size,
              quantity: Math.floor(parseInt(quantity) / sizes.length),
              sku: size.toLowerCase().replace(/\s+/g, '-')
            });
          }
        } else if (colors.length > 0) {
          // Generate variants for colors only
          for (const color of colors) {
            generatedVariants.push({
              color,
              quantity: Math.floor(parseInt(quantity) / colors.length),
              sku: color.toLowerCase().replace(/\s+/g, '-')
            });
          }
        }
        
        finalVariants = generatedVariants;
      } else if (variants.length === 0 && customVariantTypes.length > 0) {
        // Handle custom variant types
        const generatedVariants = [];
        for (const type of customVariantTypes) {
          for (const option of type.options) {
            generatedVariants.push({
              [type.name.toLowerCase().replace(/\s+/g, '_')]: option,
              quantity: Math.floor(parseInt(quantity) / type.options.length),
              sku: option.toLowerCase().replace(/\s+/g, '-')
            });
          }
        }
        finalVariants = generatedVariants;
      }

      // Prepare variants data - flatten custom options into the variant object
      const flattenedVariants = finalVariants.map(variant => {
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

      // Create the product data object
      const productData = {
          title,
          description,
          price: parseFloat(price),
          category: showCustomCategory ? customCategory : category,
          quantity: parseInt(quantity),
          delivery_fee: delivery_fee ? parseFloat(delivery_fee) : null,
          detailed_description: detailedDescription,
          quality,
          sizes,
          colors,
          available_variants: flattenedVariants,
          owner_id: session.user.id,
          is_active: true,
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
          delivery_time: deliveryTime,
          delivery_options: {
            delivery: deliveryOptions.delivery,
            pickup: deliveryOptions.pickup,
            pickup_location: pickupLocation,
            delivery_time: deliveryTime
          }
      };

      // Insert the product
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (productError) throw productError;

      // Handle image uploads
      if (images.length > 0) {
      try {
        for (const image of images) {
          const fileExt = image.name.split('.').pop();
            const fileName = `${product.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
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
                product_id: product.id,
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
          // Don't throw here, allow product creation even if image upload fails
          toast.error('Some images failed to upload');
          }
        }

      toast.success('Product created successfully');
          router.push('/dashboard/products');
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Failed to create product');
        setLoading(false);
    }
  };

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) {
    let files: File[] = [];
    if ('dataTransfer' in e) {
      files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    } else if (e.target.files) {
      files = Array.from(e.target.files);
    }
    if (files.length + images.length > 8) {
      setImageError(t('dashboard.product.maxImages'));
        return;
      }
    setImages(prev => [...prev, ...files]);
    setImageError(null);
    }

  // Add remove image handler
  function handleRemoveImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index));
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
            <h3 className="text-lg leading-6 font-medium text-gray-900">{t('dashboard.product.new.header')}</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              {t('dashboard.product.new.subtitle')}
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
                  <h4 className="text-base font-medium text-gray-900">{t('dashboard.product.basicInfo')}</h4>
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-4 relative">
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      {t('dashboard.product.title')} <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        id="title"
                        ref={titleRef}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={inputClasses + (missingFields.title ? ' border-red-500' : '')}
                        placeholder="Traditional Habesha Dress"
                        required
                      />
                      {missingFields.title && (
                        <div className="absolute left-0 mt-1 text-xs text-red-600 bg-white border border-red-200 rounded px-2 py-1 shadow z-10 animate-bounce">
                           {t('dashboard.product.validation.titleRequired')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-3 relative">
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                      {t('dashboard.product.category')} <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      {!showCustomCategory ? (
                        <>
                          <select
                            id="category"
                            ref={categoryRef}
                            value={category}
                            onChange={(e) => {
                              if (e.target.value === 'custom') {
                                setShowCustomCategory(true);
                                setCategory('');
                              } else {
                                setCategory(e.target.value);
                              }
                            }}
                            className={selectClasses + (missingFields.category ? ' border-red-500' : '')}
                            required={!showCustomCategory}
                          >
                             <option value="">{t('dashboard.product.selectCategory')}</option>
                            
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
                            
                            {customCategories.length > 0 && (
                              <optgroup label="Custom Categories">
                                {customCategories.map((customCat) => (
                                  <option key={customCat} value={customCat}>{customCat}</option>
                                ))}
                              </optgroup>
                            )}
                            
                             <option value="custom">{t('dashboard.product.addCustomCategory')}</option>
                          </select>
                          {missingFields.category && (
                             <div className="absolute left-0 mt-1 text-xs text-red-600 bg-white border border-red-200 rounded px-2 py-1 shadow z-10 animate-bounce">
                               {t('dashboard.product.validation.categoryRequired')}
                             </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <input
                              type="text"
                              id="customCategory"
                              value={customCategory}
                              onChange={(e) => setCustomCategory(e.target.value)}
                              className={inputClasses + (missingFields.category ? ' border-red-500' : '')}
                              placeholder="Enter custom category name"
                              required={showCustomCategory}
                            />
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={() => saveCustomCategory(customCategory)}
                                disabled={isSavingCustomCategory || !customCategory.trim()}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                              >
                               {isSavingCustomCategory ? t('dashboard.product.saving') : t('dashboard.product.saveCategory')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCustomCategory(false);
                                  setCustomCategory('');
                                }}
                                 className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                {t('dashboard.product.cancel')}
                              </button>
                            </div>
                          </div>
                          {missingFields.category && (
                             <div className="absolute left-0 mt-1 text-xs text-red-600 bg-white border border-red-200 rounded px-2 py-1 shadow z-10 animate-bounce">
                               {t('dashboard.product.validation.customCategoryRequired')}
                             </div>
                          )}
                        </>
                      )}
                    </div>
                      <p className="mt-2 text-sm text-gray-500">
                        Choose the most appropriate category for your product to help buyers find it easily.
                      </p>
                  </div>
                  </div>
                </div>

                {/* Description Section */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">{t('dashboard.product.descriptionSection')}</h4>
                  <div className="space-y-6">
                    <div className="relative">
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Brief Description <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1">
                        <textarea
                          id="description"
                          ref={descRef}
                          rows={2}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className={inputClasses + (missingFields.description ? ' border-red-500' : '')}
                          placeholder="Brief overview of your product (will appear in product listings)"
                          maxLength={200}
                          required
                        />
                        {missingFields.description && (
                          <div className="absolute left-0 mt-1 text-xs text-red-600 bg-white border border-red-200 rounded px-2 py-1 shadow z-10 animate-bounce">
                           {t('dashboard.product.validation.descriptionRequired')}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        {t('dashboard.product.summaryHint')}
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
                          placeholder={t('dashboard.product.detailsPlaceholder')}
                          required
                        />
                      </div>
                      <div className="mt-2 bg-white p-4 rounded-md border border-gray-200">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">{t('dashboard.product.includeInfoTitle')}</h5>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                          <li className="flex items-center">
                            <svg className="h-4 w-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {t('dashboard.product.include.materials')}
                          </li>
                          <li className="flex items-center">
                            <svg className="h-4 w-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {t('dashboard.product.include.size')}
                          </li>
                          <li className="flex items-center">
                            <svg className="h-4 w-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {t('dashboard.product.include.care')}
                          </li>
                          <li className="flex items-center">
                            <svg className="h-4 w-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {t('dashboard.product.include.features')}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pricing and Inventory Section */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                  <h4 className="text-base font-medium text-gray-900">{t('dashboard.product.pricingInventory')}</h4>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700">
                        {t('dashboard.product.priceETB')} <span className="text-red-500">*</span>
                      </label>
                        <input
                          type="number"
                          ref={priceRef}
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className={inputClasses + (missingFields.price ? ' border-red-500' : '')}
                        placeholder={t('dashboard.product.enterPrice')}
                          required
                        min="0"
                        step="0.01"
                        />
                        {missingFields.price && (
                          <div className="absolute left-0 mt-1 text-xs text-red-600 bg-white border border-red-200 rounded px-2 py-1 shadow z-10 animate-bounce">
                            {t('dashboard.product.validation.priceRequired')}
                    </div>
                        )}
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700">
                        {t('dashboard.product.quantityInStock')} <span className="text-red-500">*</span>
                    </label>
                      <input
                        type="number"
                        ref={quantityRef}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className={inputClasses + (missingFields.quantity ? ' border-red-500' : '')}
                        placeholder={t('dashboard.product.availableQuantityPlaceholder')}
                        required
                        min="0"
                      />
                      {missingFields.quantity && (
                        <div className="absolute left-0 mt-1 text-xs text-red-600 bg-white border border-red-200 rounded px-2 py-1 shadow z-10 animate-bounce">
                          {t('dashboard.product.validation.quantityRequired')}
                        </div>
                      )}
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
                      <div className="mt-2 text-sm text-gray-500">
                        <p>Select the condition of your item:</p>
                        <ul className="list-disc pl-5 mt-1">
                          <li>New: Brand new, unused item</li>
                          <li>Used: Previously owned and used item</li>
                          <li>Refurbished: Restored to like-new condition</li>
                        </ul>
                      </div>
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                      </div>
                  </div>

                  {/* Custom Variant Types */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Custom Variant Types
                    </label>
                    <div className="mt-2 space-y-4">
                      {customVariantTypes.map((variantType, index) => (
                        <div key={index} className="bg-white p-4 rounded-md border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <input
                              type="text"
                              value={variantType.name}
                              onChange={(e) => {
                                const newTypes = [...customVariantTypes];
                                newTypes[index].name = e.target.value;
                                setCustomVariantTypes(newTypes);
                              }}
                              placeholder="Variant type name (e.g., Material)"
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newTypes = customVariantTypes.filter((_, i) => i !== index);
                                setCustomVariantTypes(newTypes);
                              }}
                              className="ml-2 p-1 text-red-600 hover:text-red-800"
                            >
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
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
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
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
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Custom Variant Type
                      </button>
                    </div>
                  </div>

                  {/* Variants */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Available Variants</h4>
                    <div className="space-y-4">
                      {variants.map((variant, index) => (
                        <div key={index} className="bg-white p-4 rounded-md border border-gray-200">
                          <div className="grid grid-cols-2 gap-4">
                            {sizes.length > 0 && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Size</label>
                                <select
                                  value={variant.size || ''}
                                  onChange={(e) => {
                                    const newVariants = [...variants];
                                    newVariants[index].size = e.target.value;
                                    setVariants(newVariants);
                                  }}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                >
                                  <option value="">Select Size</option>
                                  {sizes.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            
                            {colors.length > 0 && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Color</label>
                                <select
                                  value={variant.color || ''}
                                  onChange={(e) => {
                                    const newVariants = [...variants];
                                    newVariants[index].color = e.target.value;
                                    setVariants(newVariants);
                                  }}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                >
                                  <option value="">Select Color</option>
                                  {colors.map((color) => (
                                    <option key={color} value={color}>{color}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Custom Variant Options */}
                            {customVariantTypes.map((variantType, typeIndex) => (
                              <div key={typeIndex}>
                                <label className="block text-sm font-medium text-gray-700">{variantType.name}</label>
                                <select
                                  value={variant.custom_options?.[variantType.name] || ''}
                                  onChange={(e) => {
                                    const newVariants = [...variants];
                                    if (!newVariants[index].custom_options) {
                                      newVariants[index].custom_options = {};
                                    }
                                    newVariants[index].custom_options[variantType.name] = e.target.value;

                                    // Update SKU
                                    const skuParts = [];
                                    if (newVariants[index].size) skuParts.push(newVariants[index].size);
                                    if (newVariants[index].color) skuParts.push(newVariants[index].color);
                                    Object.values(newVariants[index].custom_options).forEach(value => {
                                      if (value) skuParts.push(value);
                                    });
                                    newVariants[index].sku = skuParts.join('-').toLowerCase().replace(/\s+/g, '_');

                                    setVariants(newVariants);
                                  }}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                >
                                  <option value="">Select {variantType.name}</option>
                                  {variantType.options.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Quantity</label>
                      <input
                        type="number"
                        min="0"
                                value={variant.quantity}
                              onChange={(e) => {
                                const newVariants = [...variants];
                                  newVariants[index].quantity = parseInt(e.target.value) || 0;
                                setVariants(newVariants);
                              }}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                    </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">SKU</label>
                              <input
                                type="text"
                                value={variant.sku}
                                onChange={(e) => {
                                  const newVariants = [...variants];
                                  newVariants[index].sku = e.target.value;
                                  setVariants(newVariants);
                                }}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setVariants(variants.filter((_, i) => i !== index));
                            }}
                            className="mt-2 text-sm text-red-600 hover:text-red-800"
                          >
                            Remove Variant
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          // Generate a base variant
                          const baseVariant = {
                            size: sizes[0] || undefined,
                            color: colors[0] || undefined,
                            quantity: 0,
                            sku: ''
                          };

                          // Add custom options if they exist
                          const customOptions: { [key: string]: string } = {};
                          customVariantTypes.forEach(type => {
                            if (type.options.length > 0) {
                              customOptions[type.name] = type.options[0];
                            }
                          });

                          // Generate SKU
                          const skuParts = [];
                          if (baseVariant.size) skuParts.push(baseVariant.size);
                          if (baseVariant.color) skuParts.push(baseVariant.color);
                          Object.values(customOptions).forEach(value => skuParts.push(value));
                          baseVariant.sku = skuParts.join('-').toLowerCase().replace(/\s+/g, '_');

                          setVariants([
                            ...variants,
                            {
                              ...baseVariant,
                              custom_options: customOptions
                            }
                          ]);
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Variant
                      </button>
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
                <div className="bg-gray-50 rounded-lg p-6 space-y-6" ref={imageSectionRef}>
                  <div className="flex justify-between items-center">
                    <h4 className="text-base font-medium text-gray-900">{t('dashboard.product.productImages')} <span className="text-red-500">*</span></h4>
                    <span className="text-sm text-gray-500">{images.length}/8 {t('dashboard.product.imagesCountSuffix')}</span>
                  </div>
                  <div>
                    <label htmlFor="images" className="block text-sm font-medium text-gray-700">
                      {t('dashboard.product.uploadRange')}
                    </label>
                    <p className="mt-1 text-sm text-gray-500">
                      Upload <span className="font-semibold">2-8 high-quality images</span> of your product. Include different angles and details.
                    </p>
                    <p className="mt-1 text-sm text-blue-600 font-medium">
                      💡 <strong>Tip:</strong> Use square images (1000x1000px) for best display in the 384px height container
                    </p>
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
                        id="images"
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
                    {(imageError || missingFields.images) && (
                      <div className="mt-2 text-sm text-red-600 animate-bounce">
                        {imageError || 'Please upload at least 2 images.'}
                      </div>
                    )}
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
                    <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                      <h5 className="text-sm font-medium text-blue-800 mb-2">Image Guidelines:</h5>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Upload minimum 2 and maximum 8 images</li>
                        <li>• First image will be the main product image</li>
                        <li>• Include photos from different angles</li>
                        <li>• Show both full product and detail shots</li>
                        <li>• Use well-lit, clear photos</li>
                        <li>• <strong>Recommended size: 800x600px (4:3 ratio) or 1000x1000px (square)</strong></li>
                        <li>• <strong>Container size: 384px height × full width</strong></li>
                        <li>• <strong>Best fit: Use square images (1:1 ratio) to avoid cropping</strong></li>
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
                <div className="bg-gray-50 rounded-lg p-6 space-y-6" ref={deliveryOptionsRef}>
                  <h4 className="text-base font-medium text-gray-900">Delivery Options</h4>
                  <div className="space-y-4">
                    {!deliveryOptions.delivery && !deliveryOptions.pickup && (
                      <p className="text-sm text-red-500">
                        {t('dashboard.product.deliverySelectOne')}
                      </p>
                    )}
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="delivery"
                        ref={deliveryCheckboxRef}
                        checked={deliveryOptions.delivery}
                        onChange={(e) => setDeliveryOptions(prev => ({
                          ...prev,
                          delivery: e.target.checked
                        }))}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label htmlFor="delivery" className="text-sm text-gray-700">
                        {t('dashboard.product.homeDelivery')}
                      </label>
                    </div>

                    {deliveryOptions.delivery && (
                      <div className="ml-7 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {t('dashboard.product.deliveryFee')}
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
                        {t('dashboard.product.storePickup')}
                      </label>
                    </div>

                    {deliveryOptions.pickup && (
                      <div className="ml-7 space-y-4">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="useStoreAddress"
                            checked={useStoreAddress}
                            onChange={(e) => {
                              setUseStoreAddress(e.target.checked);
                              if (e.target.checked) {
                                setPickupLocation(storeAddress);
                              } else {
                                setPickupLocation('');
                              }
                            }}
                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                          />
                          <label htmlFor="useStoreAddress" className="text-sm text-gray-700">
                            {t('dashboard.product.useStoreAddress')}
                          </label>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {t('dashboard.product.pickupLocation')} <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            ref={pickupLocationRef}
                            value={pickupLocation}
                            onChange={(e) => setPickupLocation(e.target.value)}
                            placeholder={useStoreAddress ? storeAddress : "Enter pickup address and instructions"}
                            className={textareaClasses}
                            rows={3}
                            required={deliveryOptions.pickup}
                            disabled={useStoreAddress}
                          />
                          {useStoreAddress && storeAddress && (
                            <p className="mt-1 text-sm text-gray-500">
                              Using your store address: {storeAddress}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {!deliveryOptions.delivery && !deliveryOptions.pickup && (
                      <p className="text-sm text-red-500 mt-2">
                        {t('dashboard.product.deliverySelectOne')}
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
                          {t('dashboard.product.estimatedDeliveryTime')}
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
                      {t('dashboard.product.cancel')}
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
                        {t('dashboard.product.creating')}
                      </span>
                      ) : (
                        t('dashboard.product.create')
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

export default withSubscriptionLimits(NewProductPage, 'products'); 