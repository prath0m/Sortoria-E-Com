import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ApiError } from '@/api/client';
import { useAuth } from '@/stores/auth';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <RouterProvider router={router} />
          <Toaster
            position="bottom-center"
            toastOptions={{
              className: '!rounded-xs !border-line !bg-surface-raised !font-sans !text-ink !shadow-lift',
            }}
          />
        </MotionConfig>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
