import { Monogram } from '@/components/brand/Logo';

export function PageLoader() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-[50vh] items-center justify-center">
      <Monogram className="h-12 w-12 animate-pulse opacity-70" />
    </div>
  );
}
