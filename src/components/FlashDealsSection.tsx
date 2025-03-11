import Link from 'next/link';
import Image from 'next/image';

interface Product {
  id: string;
  title: string;
  price: number;
  description: string;
  product_images: {
    image_url: string;
  }[];
  owner?: {
    store_settings?: {
      name?: string;
    };
  };
}

interface FlashSaleProduct {
  id: string;
  product: Product;
  special_price: number;
}

interface FlashSale {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  start_time: string;
  end_time: string;
  products?: FlashSaleProduct[];
}

interface FlashDealsSectionProps {
  products: FlashSaleProduct[];
}

const FlashDealsSection: React.FC<FlashDealsSectionProps> = ({ products }) => {
  const cleanImageUrl = (url: string) => {
    // Implement your logic to clean the image URL
    return url;
  };

  const calculateDiscountPercentage = (originalPrice: number, salePrice: number): number => {
    return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <Link key={product.id} href={`/products/${product.product.id}`} className="group">
          <div className="relative">
            {product.product.product_images?.[0] && (
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-200">
                <Image
                  src={cleanImageUrl(product.product.product_images[0].image_url)}
                  alt={product.product.title}
                  className="h-full w-full object-cover object-center group-hover:opacity-75"
                  width={300}
                  height={300}
                />
              </div>
            )}
            <div className="mt-4 flex justify-between">
              <div>
                <h3 className="text-sm text-gray-700">
                  <span className="font-medium">
                    {product.product.owner?.store_settings?.name || 'Store'}
                  </span>
                  <span className="block">
                    {product.product.title}
                  </span>
                </h3>
                <div className="mt-1">
                  <span className="text-sm text-gray-500 line-through">
                    {product.product.price} ETB
                  </span>
                  <span className="ml-2 text-sm font-medium text-red-600">
                    {product.special_price} ETB
                  </span>
                </div>
                <p className="mt-1 text-sm text-red-600 font-semibold">
                  {calculateDiscountPercentage(product.product.price, product.special_price)}% OFF
                </p>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default FlashDealsSection; 