import type { ReactNode } from 'react';
import { Reveal } from '@/components/motion/Reveal';

export function AuthLayout({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <div className="container-page relative flex justify-center py-14 md:py-20">
        <Reveal className="w-full max-w-md">
          <p className="eyebrow text-center">{eyebrow}</p>
          <h1 className="mt-3 text-center text-display-lg">{title}</h1>
          {intro ? <p className="mt-3 text-center text-ink-soft">{intro}</p> : null}
          <div className="mt-10 rounded-sm border border-line bg-surface-raised p-6 shadow-soft sm:p-8">{children}</div>
        </Reveal>
      </div>
    </div>
  );
}
