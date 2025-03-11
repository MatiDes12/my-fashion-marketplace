type Translation = {
  [key: string]: {
    en: string;
    am: string;
  };
};

export const translations: Translation = {
  // Navigation
  'nav.home': {
    en: 'Home',
    am: 'ዋና ገጽ'
  },
  'nav.products': {
    en: 'Products',
    am: 'ምርቶች'
  },
  'nav.orders': {
    en: 'Orders',
    am: 'ትዕዛዞች'
  },
  'nav.dashboard': {
    en: 'Dashboard',
    am: 'ዳሽቦርድ'
  },
  'nav.signin': {
    en: 'Sign In',
    am: 'ግባ'
  },
  'nav.signup': {
    en: 'Sign Up',
    am: 'ተመዝገብ'
  },
  'nav.signout': {
    en: 'Sign Out',
    am: 'ውጣ'
  },

  // Products
  'products.title': {
    en: 'All Products',
    am: 'ሁሉም ምርቶች'
  },
  'products.search': {
    en: 'Search products...',
    am: 'ምርቶችን ይፈልጉ...'
  },
  'products.filter.category': {
    en: 'All Categories',
    am: 'ሁሉም ምድቦች'
  },
  'products.filter.price': {
    en: 'All Prices',
    am: 'ሁሉም ዋጋዎች'
  },
  'products.sort.newest': {
    en: 'Newest First',
    am: 'አዲሶቹ በመጀመሪያ'
  },
  'products.sort.price.low': {
    en: 'Price: Low to High',
    am: 'ዋጋ: ከዝቅተኛ ወደ ከፍተኛ'
  },
  'products.sort.price.high': {
    en: 'Price: High to Low',
    am: 'ዋጋ: ከከፍተኛ ወደ ዝቅተኛ'
  },

  // Common
  'common.loading': {
    en: 'Loading...',
    am: 'እየጫነ...'
  },
  'common.error': {
    en: 'An error occurred',
    am: 'ስህተት ተከስቷል'
  },
  'common.next': {
    en: 'Next',
    am: 'ቀጣይ'
  },
  'common.previous': {
    en: 'Previous',
    am: 'ቀዳሚ'
  }
};

export type Language = 'en' | 'am'; 