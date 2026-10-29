import { ShoppingBag, Zap } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ProductDetail, Variant } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { useCart } from '@/api/hooks/cart';
import { flyToBag } from '@/components/motion/FlyToCart';
import { MAX_PER_LINE, useGuestCart } from '@/stores/cart';

interface ProductPurchaseProps {
  product: ProductDetail;
  variant: Variant | undefined;
  compact?: boolean;
  onAdded?: () => void;
}

export function ProductPurchase({ product, variant, compact, onAdded }: ProductPurchaseProps) {
  const [quantity, setQuantity] = useState(1);
  const { add } = useCart();
  const openDrawer = useGuestCart((s) => s.setDrawerOpen);
  const navigate = useNavigate();
  const inStock = !!variant && variant.stock > 0;
  const max = variant ? Math.min(variant.stock, MAX_PER_LINE) : 1;

  const image = product.images[0]?.renditions['400'] ?? product.images[0]?.url ?? null;

  const addToBag = async () => {
    if (!variant || !inStock) return false;
    await add.mutateAsync({
      line: {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand?.name ?? null,
        variantLabel: variant.label,
        image,
        pricePaise: variant.price_paise,
        mrpPaise: variant.mrp_paise,
        maxQuantity: variant.stock,
      },
      quantity: Math.min(quantity, max),
    });
    return true;
  };

  return (
    <div className="space-y-4">
      {variant ? (
        <p className="text-sm" aria-live="polite">
          {!inStock ? (
            <span className="font-medium text-danger">This option is sold out. Try another, or check back soon.</span>
          ) : variant.is_low_stock ? (
            <span className="font-medium text-charcoal-700">Only {variant.stock} left. Selling quickly.</span>
          ) : (
            <span className="text-success">In stock and ready to ship</span>
          )}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">Choose your options to see availability.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} max={max} onChange={setQuantity} disabled={!inStock} />
        <Button
          size="lg"
          className="flex-1"
          disabled={!inStock}
          icon={<ShoppingBag className="h-4 w-4" />}
          data-add-to-bag
          loading={add.isPending}
          onClick={async (e) => {
            const button = e.currentTarget;
            if (await addToBag().catch(() => false)) {
              flyToBag(button, image ?? undefined);
              toast.success(`${product.name} is in your bag`, {
                description: variant?.label || undefined,
                action: { label: 'View bag', onClick: () => openDrawer(true) },
              });
              onAdded?.();
            }
          }}
        >
          Add to bag
        </Button>
      </div>
      {!compact ? (
        <Button
          variant="secondary"
          size="lg"
          block
          disabled={!inStock}
          icon={<Zap className="h-4 w-4" />}
          onClick={async () => {
            if (await addToBag().catch(() => false)) navigate('/checkout');
          }}
        >
          Buy now
        </Button>
      ) : null}
    </div>
  );
}
