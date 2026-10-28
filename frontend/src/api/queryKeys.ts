/** Central query keys so invalidation stays consistent across features. */
export const qk = {
  settings: ['store-settings'] as const,
  navigation: ['navigation'] as const,
  me: ['me'] as const,
  addresses: ['addresses'] as const,
  category: (slug: string) => ['category', slug] as const,
  brand: (slug: string) => ['brand', slug] as const,
  brands: ['brands'] as const,
  products: (params: string) => ['products', params] as const,
  productsInfinite: (params: string) => ['products-infinite', params] as const,
  facets: (params: string) => ['facets', params] as const,
  product: (slug: string) => ['product', slug] as const,
  related: (slug: string) => ['related', slug] as const,
  batch: (ids: number[]) => ['batch', ids.join(',')] as const,
  suggest: (q: string) => ['suggest', q] as const,
};
