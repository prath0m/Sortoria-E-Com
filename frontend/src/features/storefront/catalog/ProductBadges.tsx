import { Badge } from '@/components/ui/Badge';
import type { ProductCard } from '@/api/types';

export function ProductBadges({ product, className }: { product: ProductCard; className?: string }) {
  const badges = [];
  if (!product.in_stock) badges.push(<Badge key="oos" tone="dark">Sold out</Badge>);
  else if (product.flash_sale) badges.push(<Badge key="flash" tone="sale">{product.flash_sale.kind === 'daily_deal' ? 'Deal of the day' : 'Flash sale'}</Badge>);
  else if (product.discount_pct >= 5) badges.push(<Badge key="sale" tone="sale">{product.discount_pct}% off</Badge>);
  if (product.is_new && product.in_stock) badges.push(<Badge key="new" tone="new">New</Badge>);
  if (!badges.length) return null;
  return <div className={className}>{badges}</div>;
}
