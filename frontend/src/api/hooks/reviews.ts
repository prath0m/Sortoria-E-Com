import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { Review, ReviewPage } from '../types';

export function useReviews(slug: string, params: { sort: string; rating: string; page: number }) {
  return useQuery({
    queryKey: ['reviews', slug, params],
    queryFn: () => api<ReviewPage>(`/products/${slug}/reviews/`, { query: { ...params, page_size: 6 } }),
    placeholderData: keepPreviousData,
  });
}

export function useSubmitReview(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api<Review>(`/products/${slug}/reviews/`, { method: 'POST', body: form }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews', slug] }),
  });
}
