import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { Banner, CmsPage, HomeSectionData } from '../types';

export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: () => api<{ sections: HomeSectionData[] }>('/home/').then((r) => r.sections),
    staleTime: 60_000,
  });
}

export function useBanners(placement: 'home' | 'offers' | 'cart') {
  return useQuery({ queryKey: ['banners', placement], queryFn: () => api<Banner[]>('/cms/banners/', { query: { placement } }), staleTime: 5 * 60_000 });
}

export function usePage(slug: string | undefined) {
  return useQuery({ queryKey: ['page', slug], queryFn: () => api<CmsPage>(`/pages/${slug}/`), enabled: !!slug });
}

export function useFooterPages() {
  return useQuery({ queryKey: ['pages'], queryFn: () => api<{ title: string; slug: string }[]>('/pages/'), staleTime: 10 * 60_000 });
}

export function useSubscribe() {
  return useMutation({
    mutationFn: (input: { email: string; source: string }) =>
      api<{ detail: string }>('/newsletter/subscribe/', { method: 'POST', body: input }),
  });
}

export function useNewsletterAction(action: 'confirm' | 'unsubscribe') {
  return useMutation({
    mutationFn: (token: string) => api<{ email: string; status: string }>(`/newsletter/${action}/`, { method: 'POST', body: { token } }),
  });
}
