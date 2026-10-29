import { Plus, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCart } from '@/api/hooks/cart';
import type { BundleOffer } from '@/api/types';
import { flyToBag } from '@/components/motion/FlyToCart';
import { Button } from '@/components/ui/Button';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { formatMoney } from '@/lib/money';

export function BundleCard({ bundle }: { bundle: BundleOffer }) {
  const { add } = useCart();
  const navigate = useNavigate();
  const needsChoice = bundle.items.filter((i) => !i.product.default_variant_id);

  const addSet = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    if (needsChoice.length) {
      toast('Choose your options first', { description: `${needsChoice[0].product.name} comes in a few versions.` });
      navigate(`/products/${needsChoice[0].product.slug}`);
      return;
    }
    for (const { product, quantity } of bundle.items) {
      await add.mutateAsync({
        quantity,
        line: {
          variantId: product.default_variant_id!,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          brand: product.brand,
          variantLabel: '',
          image: product.images[0]?.renditions['400'] ?? null,
          pricePaise: product.price_paise,
          mrpPaise: product.mrp_paise,
          maxQuantity: 10,
        },
      });
    }
    flyToBag(target, bundle.items[0]?.product.images[0]?.renditions['400']);
    toast.success(`${bundle.title} is in your bag`, { description: `You save ${formatMoney(bundle.saving_paise)}.` });
  };

  return (
    <article className="flex flex-col rounded-sm border border-line bg-surface-raised p-6">
      <div className="flex items-center gap-3">
        {bundle.items.map(({ product }, i) => (
          <div key={product.id} className="flex items-center gap-3">
            {i > 0 ? <Plus className="h-4 w-4 text-iris-600" aria-hidden="true" /> : null}
            <Link to={`/products/${product.slug}`} className="block h-28 w-24 overflow-hidden rounded-xs bg-paper-200">
              {product.images[0] ? (
                <ResponsiveImage src={product.images[0].url} renditions={product.images[0].renditions} alt={product.images[0].alt} sizes="96px" className="h-full w-full object-cover" />
              ) : null}
            </Link>
          </div>
        ))}
      </div>
      <h3 className="mt-6 text-display-sm">
        <Link to={`/offers/bundles/${bundle.slug}`} className="hover:text-charcoal-700">{bundle.title}</Link>
      </h3>
      <p className="mt-2 flex-1 text-sm text-ink-soft">{bundle.description}</p>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-lg font-semibold">{formatMoney(bundle.bundle_price_paise)}</span>
        <span className="text-sm text-ink-muted line-through">{formatMoney(bundle.value_paise)}</span>
        <span className="text-sm font-semibold text-charcoal-700">Save {formatMoney(bundle.saving_paise)}</span>
      </div>
      <Button className="mt-5" icon={<ShoppingBag className="h-4 w-4" />} loading={add.isPending} onClick={addSet}>
        Add the set to bag
      </Button>
    </article>
  );
}
