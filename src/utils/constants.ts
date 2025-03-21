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
  TELEBIRR: 'TELEBIRR',
  CBE: 'CBE',
  AMOLE: 'AMOLE',
  CASH_ON_DELIVERY: 'CASH_ON_DELIVERY',
} as const;

export type PaymentMethodType = keyof typeof PAYMENT_METHODS;

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
  'Cultural Accessories',
  
  // Modern Fashion
  'Modern Fashion',
  'Dresses',
  'Tops',
  'Pants & Skirts',
  'Outerwear',
  'Accessories',
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
  'Accessories',
  
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

// Add subcategories mapping for better organization
export const CATEGORY_GROUPS = {
  'Traditional Wear': ['Habesha Kemis', 'Tilfi', 'Cultural Accessories'],
  'Modern Fashion': ['Dresses', 'Tops', 'Pants & Skirts', 'Outerwear', 'Accessories', 'Shoes'],
  'Home & Living': ['Furniture', 'Home Decor', 'Kitchen & Dining', 'Bedding', 'Lighting', 'Rugs & Carpets'],
};

// Add this helper function to normalize category names consistently
export const normalizeCategory = (category: string): string => {
  return category.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_');
};

// Add mapping for database categories to display names
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
  // Add home & living categories if needed
}; 