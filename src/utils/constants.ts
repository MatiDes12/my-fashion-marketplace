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