import { useProductBatch } from '@/api/hooks/catalog';
import { useWishlist } from '@/api/hooks/wishlist';
import { Reveal } from '@/components/motion/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { Seo } from '@/lib/seo';
import { ProductGrid } from '../catalog/ProductGrid';

export default function WishlistPage() {
  const { signedIn, ids, server } = useWishlist();
  const guest = useProductBatch(signedIn ? [] : ids);
  const products = signedIn ? server.data?.products.filter((p) => ids.includes(p.id)) : guest.data;
  const loading = signedIn ? server.isLoading : ids.length > 0 && guest.isLoading;

  return (
    <>
      <Seo title="Wishlist" noindex />
      <div className="container-page py-10 lg:py-14">
        <Reveal>
          <p className="eyebrow">Saved for you</p>
          <h1 className="mt-2 text-display-lg">Wishlist</h1>
          {!signedIn && ids.length ? (
            <p className="mt-3 text-sm text-ink-soft">
              Sign in to keep your wishlist across devices. It will be saved to your account automatically.
            </p>
          ) : null}
        </Reveal>
        <div className="mt-10">
          {loading ? (
            <ProductGridSkeleton count={4} />
          ) : products?.length ? (
            <ProductGrid products={products} />
          ) : (
            <EmptyState
              illustration="heart"
              title="Nothing saved yet"
              description="Tap the heart on anything you love and we'll keep it here for you."
              action={<ButtonLink to="/shop">Discover something</ButtonLink>}
            />
          )}
        </div>
      </div>
    </>
  );
}
