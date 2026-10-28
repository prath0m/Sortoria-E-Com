import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/stores/auth';
import { useGuestWishlist } from '@/stores/wishlist';
import { api } from '../client';
import type { ProductCard } from '../types';

interface WishlistPayload {
  product_ids: number[];
  products: ProductCard[];
}

const KEY = ['wishlist'];

export function useWishlist() {
  const signedIn = useAuth((s) => s.status === 'authenticated');
  const guest = useGuestWishlist();
  const qc = useQueryClient();

  const server = useQuery({
    queryKey: KEY,
    queryFn: () => api<WishlistPayload>('/wishlist/'),
    enabled: signedIn,
  });

  const ids = signedIn ? (server.data?.product_ids ?? []) : guest.ids;

  const toggle = useMutation({
    mutationFn: async (productId: number) => {
      const has = ids.includes(productId);
      if (!signedIn) {
        guest.toggle(productId);
        return { added: !has, data: null };
      }
      const data = has
        ? await api<WishlistPayload>(`/wishlist/${productId}/`, { method: 'DELETE' })
        : await api<WishlistPayload>('/wishlist/', { method: 'POST', body: { product_id: productId } });
      return { added: !has, data };
    },
    onMutate: async (productId) => {
      if (!signedIn) return;
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<WishlistPayload>(KEY);
      if (previous) {
        const has = previous.product_ids.includes(productId);
        qc.setQueryData<WishlistPayload>(KEY, {
          ...previous,
          product_ids: has ? previous.product_ids.filter((id) => id !== productId) : [productId, ...previous.product_ids],
        });
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(KEY, context.previous);
      toast.error("We couldn't update your wishlist. Please try again.");
    },
    onSuccess: ({ added, data }) => {
      if (data) qc.setQueryData(KEY, data);
      toast(added ? 'Saved to your wishlist' : 'Removed from your wishlist');
    },
  });

  return { signedIn, ids, has: (id: number) => ids.includes(id), toggle, server };
}
