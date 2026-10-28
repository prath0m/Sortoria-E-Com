import { Logo } from '@/components/brand/Logo';

export function App() {
  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center gap-6 bg-cream-100 px-4 text-center">
      <Logo className="h-10" />
      <p className="eyebrow">Crafted with intention. Worn for a lifetime.</p>
    </main>
  );
}
