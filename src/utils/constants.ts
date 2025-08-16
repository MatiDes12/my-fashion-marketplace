export const ETHIOPIAN_CATEGORIES = [
  'Traditional Clothing',
  'Modern Ethiopian Fashion',
  'Habesha Dresses',
  'Habesha Kemis',
  'Tilfi Scarves',
  'Netela',
  'Gabi',
  'Ethiopian Jewelry',
  'Handwoven Textiles',
  'Leather Goods',
  'Accessories',
  'Footwear',
  'Home Decor'
];

export const PAYMENT_METHODS = {
  CASH: {
    id: 'CASH',
    name: 'Cash on Delivery',
    description: 'Pay when you receive your order',
    logo: '/images/payment-methods/cash-icon.jpg',
    isAvailable: true, // Cash is always available
  },
  TELEBIRR: {
    id: 'TELEBIRR',
    name: 'Telebirr',
    description: 'Pay with Telebirr mobile money',
    logo: '/images/payment-methods/Telebirr-logo.png',
    isAvailable: false, // Will be set dynamically
  },
  CBE: {
    id: 'CBE',
    name: 'CBE Bank Account',
    description: 'Direct bank transfer to CBE account',
    logo: '/images/payment-methods/cbe.png',
    isAvailable: false, // Will be set dynamically
  },
  AMOLE: {
    id: 'AMOLE',
    name: 'Amole',
    description: 'Pay with Amole digital wallet',
    logo: '/images/payment-methods/amole.png',
    isAvailable: false, // Will be set dynamically
  },
  CHAPA: {
    id: 'CHAPA',
    name: 'Chapa',
    description: 'Secure online payment with Chapa',
    logo: '/images/payment-methods/chapa-logo.png',
    isAvailable: false, // Will be set dynamically
  },  
  MPESA: {
    id: 'MPESA',
    name: 'M-PESA',
    description: 'Pay with M-PESA mobile money',
    logo: '/images/payment-methods/mpesa-logo.png',
    isAvailable: false, // Will be set dynamically
  },
  STRIPE: {
    id: 'STRIPE',
    name: 'Credit/Debit Card (USD)',
    description: 'Pay with international credit/debit cards via Stripe',
    logo: '/images/payment-methods/stripe-logo.svg',
    isAvailable: true, // Stripe is always available
  },
} as const;

export type PaymentMethodType = 'CASH' | 'TELEBIRR' | 'CBE' | 'AMOLE' | 'CHAPA' | 'MPESA' | 'STRIPE';

export const REGIONS = [
  'አዲስ አበባ', // Addis Ababa
  'ድሬዳዋ', // Dire Dawa
  'ኦሮሚያ', // Oromia
  'አማራ', // Amhara
  'ትግራይ', // Tigray
  'አፋር', // Afar
  'ቤኒሻንጉል ጉሙዝ', // Benishangul-Gumuz
  'ሀረሪ', // Harari
  'ጋምቤላ', // Gambela
  'ሶማሌ', // Somali
  'ደቡብ ክልል', // SNNPR
] as const;

export const PLACEHOLDER_IMAGES = [
  '/products/traditional-1.jpg',
  '/products/modern-1.jpg',
  '/products/accessories-1.jpg',
  '/products/shoes-1.jpg',
  // Add more placeholder images for each category
];

export const PRODUCT_CATEGORIES = [
  'All',
  // Traditional Wear
  'Traditional Wear',
  'Habesha Kemis',
  'Tilfi',
  'Traditional Accessories',
  
  // Modern Fashion
  'Modern Fashion',
  'Dresses',
  'Tops',
  'Pants & Skirts',
  'Outerwear',
  'Fashion Accessories',
  'Shoes',
  
  // Home & Living
  'Home & Living',
  'Furniture',
  'Home Decor',
  'Kitchen & Dining',
  'Bedding',
  'Lighting',
  'Rugs & Carpets',
  
  // Beauty & Personal Care
  'Beauty & Personal Care',
  'Skincare',
  'Hair Care',
  'Makeup',
  'Fragrances',
  'Traditional Beauty Products',
  
  // Jewelry & Accessories
  'Jewelry',
  'Watches',
  'Bags & Purses',
  'Scarves & Shawls',
  
  // Art & Collectibles
  'Art & Collectibles',
  'Paintings',
  'Sculptures',
  'Traditional Art',
  'Photography',
  'Handmade Crafts',
  
  // Food & Beverages
  'Food & Beverages',
  'Coffee & Tea',
  'Spices & Seasonings',
  'Traditional Foods',
  'Snacks',
  
  // Electronics & Gadgets
  'Electronics',
  'Phones & Accessories',
  'Computers & Tablets',
  'Audio & Headphones',
  'Smart Home',
  
  // Books & Media
  'Books & Media',
  'Books',
  'Music',
  'Movies',
  'Educational Materials',
  
  // Kids & Baby
  'Kids & Baby',
  'Kids Clothing',
  'Baby Essentials',
  'Toys & Games',
  'School Supplies',
  
  // Sports & Fitness
  'Sports & Fitness',
  'Exercise Equipment',
  'Sports Wear',
  'Outdoor Gear',
  
  // Health & Wellness
  'Health & Wellness',
  'Traditional Medicine',
  'Supplements',
  'Medical Supplies',
  
  // Musical Instruments
  'Musical Instruments',
  'Traditional Instruments',
  'Modern Instruments',
  'Music Accessories',
  
  // Party & Events
  'Party & Events',
  'Wedding Supplies',
  'Holiday Decorations',
  'Event Accessories',
  
  // Pet Supplies
  'Pet Supplies',
  'Pet Food',
  'Pet Accessories',
  'Pet Care',
  
  // Office & Stationery
  'Office & Stationery',
  'Office Supplies',
  'Writing Materials',
  'Organization',
  
  // Garden & Outdoor
  'Garden & Outdoor',
  'Plants & Seeds',
  'Garden Tools',
  'Outdoor Furniture',
  
  // Vintage & Antiques
  'Vintage & Antiques',
  'Vintage Clothing',
  'Antique Furniture',
  'Collectibles'
];

// Update the CATEGORY_GROUPS object to include Home & Living categories
export const CATEGORY_GROUPS = {
  'Traditional Wear': ['Habesha Kemis', 'Tilfi', 'Cultural Accessories'],
  'Modern Fashion': ['Dresses', 'Tops', 'Pants & Skirts', 'Outerwear', 'Accessories', 'Shoes'],
  'Furniture': ['Living Room', 'Bedroom', 'Dining Room', 'Office'],
  'Home Decor': ['Wall Art', 'Vases', 'Mirrors', 'Decorative Accessories'],
  'Kitchen & Dining': ['Cookware', 'Dinnerware', 'Kitchen Tools', 'Storage'],
  'Home & Living': ['Furniture', 'Home Decor', 'Kitchen & Dining', 'Bedding', 'Lighting', 'Rugs & Carpets'],
};

// Add this helper function to normalize category names consistently
export const normalizeCategory = (category: string): string => {
  return category.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_');
};

// Update the DB_CATEGORY_MAP to include home & living categories
export const DB_CATEGORY_MAP: { [key: string]: string } = {
  habesha_kemis: 'Habesha Kemis',
  tilfi: 'Tilfi',
  cultural_accessories: 'Cultural Accessories',
  dresses: 'Dresses',
  tops: 'Tops',
  pants_skirts: 'Pants & Skirts',
  outerwear: 'Outerwear',
  accessories: 'Accessories',
  shoes: 'Shoes',
  // Add home & living categories
  furniture: 'Furniture',
  home_decor: 'Home Decor',
  kitchen_dining: 'Kitchen & Dining',
  bedding: 'Bedding',
  lighting: 'Lighting',
  rugs_carpets: 'Rugs & Carpets'
};

// Update the type definition for each category configuration
type CategoryConfig = {
  requiresSizing: boolean;
  requiresColors: boolean;
  measurements?: readonly string[];
  specifications?: readonly string[];
  specificFields: readonly string[];
};

export const CATEGORY_SPECIFIC_FIELDS: { [key: string]: CategoryConfig } = {
  // Traditional Wear Categories
  'Traditional Wear': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Chest', 'Length', 'Shoulder', 'Sleeve'],
    specifications: ['Material Type', 'Style', 'Pattern'],
    specificFields: ['material', 'care_instructions', 'fit_info', 'style_notes', 'occasion', 'season'],
  },
  'Habesha Kemis': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Chest', 'Length', 'Shoulder', 'Sleeve'],
    specifications: ['Material Type', 'Style', 'Pattern'],
    specificFields: ['material', 'care_instructions', 'fit_info', 'style_notes', 'occasion', 'season'],
  },
  'Tilfi': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Length', 'Width'],
    specifications: ['Material Type', 'Style', 'Pattern'],
    specificFields: ['material', 'care_instructions', 'style_notes'],
  },

  // Modern Fashion Categories
  'Modern Fashion': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Chest', 'Length', 'Shoulder', 'Sleeve'],
    specifications: ['Material Type', 'Style', 'Pattern'],
    specificFields: ['material', 'care_instructions', 'fit_info', 'style_notes', 'occasion', 'season'],
  },
  'Dresses': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Chest', 'Waist', 'Hip', 'Length'],
    specifications: ['Material Type', 'Style', 'Pattern'],
    specificFields: ['material', 'care_instructions', 'fit_info', 'style_notes', 'occasion', 'season'],
  },
  'Tops': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Chest', 'Length', 'Shoulder', 'Sleeve'],
    specifications: ['Material Type', 'Style', 'Pattern'],
    specificFields: ['material', 'care_instructions', 'fit_info', 'style_notes', 'occasion', 'season'],
  },
  'Pants & Skirts': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Waist', 'Hip', 'Length', 'Inseam'],
    specifications: ['Material Type', 'Style', 'Pattern'],
    specificFields: ['material', 'care_instructions', 'fit_info', 'style_notes', 'occasion', 'season'],
  },
  'Outerwear': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Chest', 'Length', 'Shoulder', 'Sleeve'],
    specifications: ['Material Type', 'Style', 'Pattern'],
    specificFields: ['material', 'care_instructions', 'fit_info', 'style_notes', 'occasion', 'season'],
  },
  'Shoes': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Length', 'Width'],
    specifications: ['Material Type', 'Style', 'Heel Height'],
    specificFields: ['material', 'care_instructions', 'fit_info', 'style_notes'],
  },

  // Home & Living Categories
  'Home & Living': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Length', 'Width', 'Height', 'Weight'],
    specifications: ['Material Type', 'Style', 'Pattern'],
    specificFields: ['material', 'care_instructions', 'assembly_required'],
  },
  'Furniture': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Length', 'Width', 'Height', 'Weight'],
    specifications: ['Material Type', 'Style', 'Assembly Required'],
    specificFields: ['material', 'care_instructions', 'assembly_required'],
  },
  'Rugs & Carpets': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Length', 'Width'],
    specifications: ['Material Type', 'Style', 'Pattern'],
    specificFields: ['material', 'care_instructions'],
  },
  'Bedding': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Length', 'Width'],
    specifications: ['Material Type', 'Thread Count', 'Pattern'],
    specificFields: ['material', 'care_instructions'],
  },

  // Kids & Baby Categories
  'Kids & Baby': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Age Range', 'Height', 'Weight'],
    specifications: ['Material Type', 'Age Group', 'Safety Features'],
    specificFields: ['material', 'care_instructions', 'safety_info'],
  },
  'Kids Clothing': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Age Range', 'Height', 'Chest', 'Waist'],
    specifications: ['Material Type', 'Age Group', 'Style'],
    specificFields: ['material', 'care_instructions', 'fit_info'],
  },

  // Sports & Fitness Categories
  'Sports Wear': {
    requiresSizing: true,
    requiresColors: true,
    measurements: ['Chest', 'Length', 'Shoulder', 'Sleeve'],
    specifications: ['Material Type', 'Sport Type', 'Features'],
    specificFields: ['material', 'care_instructions', 'fit_info'],
  },

  // Default (for any other category)
  'default': {
    requiresSizing: false,
    requiresColors: false,
    measurements: ['Length', 'Width', 'Height', 'Weight'],
    specificFields: ['brand', 'warranty_info'],
  }
} as const;

// Add common specifications that apply to all products
export const COMMON_SPECIFICATIONS = [
  'brand',
  'model',
  'warranty_period',
  'country_of_origin',
  'certification',
];

// Add common fields that apply to all products
export const COMMON_PRODUCT_FIELDS = [
  'title',
  'description',
  'price',
  'quantity',
  'delivery_fee',
  'quality',
  'highlights',
  'shipping_info',
  'faqs',
];

// Add quality options
export const QUALITY_OPTIONS = [
  { value: 'new', label: 'New', description: 'Brand new, unused item' },
  { value: 'used', label: 'Used', description: 'Previously owned and used item' },
  { value: 'refurbished', label: 'Refurbished', description: 'Restored to like-new condition' }
];

// Add warranty period options
export const WARRANTY_PERIODS = [
  'No Warranty',
  '3 Months',
  '6 Months',
  '1 Year',
  '2 Years',
  '3 Years',
  '5 Years',
  'Lifetime'
]; 