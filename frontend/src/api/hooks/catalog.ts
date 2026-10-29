import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, buildQuery, peekInlined } from '../client';
import { qk } from '../queryKeys';
import type {
  Brand,
  CategoryDetail,
  Facets,
  Paginated,
  ProductCard,
  ProductDetail,
  Suggestions,
} from '../types';

export function useCategory(slug: string | undefined) {
  return useQuery({
    queryKey: qk.category(slug ?? ''),
    queryFn: () => api<CategoryDetail>(`/categories/${slug}/`),
    initialData: () => peekInlined<CategoryDetail>(`/categories/${slug}/`),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

export function useBrand(slug: string | undefined) {
  return useQuery({
    queryKey: qk.brand(slug ?? ''),
    queryFn: () => api<Brand>(`/brands/${slug}/`),
    enabled: !!slug,
  });
}

export function useProducts(params: URLSearchParams, enabled = true) {
  const key = params.toString();
  return useQuery({
    queryKey: qk.products(key),
    queryFn: ({ signal }) => api<Paginated<ProductCard>>('/products/', { query: params, signal }),
    initialData: () => peekInlined<Paginated<ProductCard>>(`/products/${buildQuery(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useInfiniteProducts(params: URLSearchParams, enabled = true) {
  const base = new URLSearchParams(params);
  base.delete('page');
  return useInfiniteQuery({
    queryKey: qk.productsInfinite(base.toString()),
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams(base);
      query.set('page', String(pageParam));
      return api<Paginated<ProductCard>>('/products/', { query, signal });
    },
    initialPageParam: 1,
    initialData: () => {
      const first = new URLSearchParams(base);
      first.set('page', '1');
      const page = peekInlined<Paginated<ProductCard>>(`/products/${buildQuery(first)}`);
      return page ? { pages: [page], pageParams: [1] } : undefined;
    },
    getNextPageParam: (last) => (last.page < last.total_pages ? last.page + 1 : undefined),
    enabled,
  });
}

export function useFacets(params: URLSearchParams) {
  const query = new URLSearchParams(params);
  query.delete('page');
  query.delete('sort');
  query.delete('view');
  return useQuery({
    queryKey: qk.facets(query.toString()),
    queryFn: ({ signal }) => api<Facets>('/products/facets/', { query, signal }),
    initialData: () => peekInlined<Facets>(`/products/facets/${buildQuery(query)}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: qk.product(slug ?? ''),
    queryFn: () => api<ProductDetail>(`/products/${slug}/`),
    initialData: () => peekInlined<ProductDetail>(`/products/${slug}/`),
    enabled: !!slug,
  });
}

export function useRelatedProducts(slug: string | undefined) {
  return useQuery({
    queryKey: qk.related(slug ?? ''),
    queryFn: () => api<ProductCard[]>(`/products/${slug}/related/`),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

export function useProductBatch(ids: number[]) {
  return useQuery({
    queryKey: qk.batch(ids),
    queryFn: () => api<ProductCard[]>('/products/batch/', { query: { ids } }),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
}

export function useSuggestions(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: qk.suggest(term),
    queryFn: ({ signal }) => api<Suggestions>('/search/suggest/', { query: { q: term }, signal }),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
