const PRICE_RANGES = {
  'Habesha Kemis': '3,500 - 15,000',
  'Tilfi': '2,000 - 8,000',
  'Cultural Accessories': '500 - 5,000',
  'Dresses': '2,000 - 10,000',
  'Tops': '800 - 3,000',
  'Pants & Skirts': '1,500 - 5,000',
  'Outerwear': '2,500 - 12,000',
  'Accessories': '300 - 3,000',
  'Shoes': '1,200 - 6,000',
  'Furniture': '5,000 - 50,000',
  'Home Decor': '500 - 15,000',
  'Kitchen & Dining': '1,000 - 20,000',
  'Bedding': '2,000 - 15,000',
  'Lighting': '800 - 12,000',
  'Rugs & Carpets': '3,000 - 30,000',
};

const getDescriptionForCategory = (category: string) => {
  const descriptions: { [key: string]: string } = {
    'Habesha Kemis': 'Authentic Ethiopian traditional dresses with modern touches, perfect for special occasions.',
    'Tilfi': 'Hand-woven Ethiopian scarves featuring intricate traditional patterns.',
    'Cultural Accessories': 'Beautiful accessories that complement traditional Ethiopian attire.',
    'Dresses': 'Contemporary Ethiopian-inspired dresses for the modern fashion enthusiast.',
    'Tops': 'Stylish tops blending Ethiopian elements with modern design.',
    'Pants & Skirts': 'Modern bottoms with subtle Ethiopian design influences.',
    'Outerwear': 'Elegant outer layers combining comfort with Ethiopian style.',
    'Accessories': 'Modern accessories with traditional Ethiopian motifs.',
    'Shoes': 'Comfortable footwear with unique Ethiopian design elements.',
    'Furniture': 'Traditional and modern furniture pieces for your Ethiopian-inspired home.',
    'Home Decor': 'Decorative items that bring Ethiopian charm to your space.',
    'Kitchen & Dining': 'Essential kitchen items with traditional Ethiopian patterns.',
    'Bedding': 'Comfortable bedding with Ethiopian-inspired designs.',
    'Lighting': 'Unique lighting solutions with Ethiopian artistic elements.',
    'Rugs & Carpets': 'Hand-woven rugs featuring traditional Ethiopian patterns.',
  };
  return descriptions[category] || 'Coming soon to AVRIO Marketplace';
};

const getEmojiForCategory = (category: string) => {
  const categoryEmojis: { [key: string]: string } = {
    'Habesha Kemis': '👗',
    'Tilfi': '🧣',
    'Cultural Accessories': '✨',
    'Dresses': '👗',
    'Tops': '👚',
    'Pants & Skirts': '👖',
    'Outerwear': '🧥',
    'Accessories': '👜',
    'Shoes': '👠',
    'Furniture': '🪑',
    'Home Decor': '🏺',
    'Kitchen & Dining': '🍽️',
    'Bedding': '🛏️',
    'Lighting': '💡',
    'Rugs & Carpets': '🧶',
  };
  return categoryEmojis[category] || '✨';
};

export const generateTemplateProduct = (category: string, index: number) => ({
  id: `coming-soon-${category}-${index}`,
  title: `${category} Collection Coming Soon`,
  description: getDescriptionForCategory(category),
  price: 0,
  price_range: PRICE_RANGES[category] || 'Price TBD',
  category: category.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_'),
  product_images: [{
    id: `coming-soon-image-${index}`,
    image_url: `/images/coming-soon/${category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}.jpg`,
    is_model_picture: false
  }],
  likes: [{ count: 0 }],
  like_count: 0,
  is_coming_soon: true,
  emoji: getEmojiForCategory(category),
  users: {
    id: 'avrio-marketplace',
    full_name: 'AVRIO Marketplace',
    store_settings: {
      name: 'AVRIO Marketplace',
      logo_url: '/images/logo.png'
    }
  }
});

export const generateTemplateCategoryProducts = (category: string, count: number = 1) => {
  return Array.from({ length: count }, (_, i) => generateTemplateProduct(category, i));
}; 