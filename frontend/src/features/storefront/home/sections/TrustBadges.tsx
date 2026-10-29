import { Fragment } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks';

type Badge = { icon: string; title: string; text: string };

function Run({ badges, hidden }: { badges: Badge[]; hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {badges.map((b) => (
        <Fragment key={b.title}>
          <li className="flex items-baseline gap-3 whitespace-nowrap px-8">
            <span className="text-[clamp(1.25rem,1rem+1vw,1.75rem)] font-semibold tracking-tight text-ink">{b.title}</span>
            {b.text ? <span className="text-sm text-ink-muted">{b.text}</span> : null}
          </li>
          <li aria-hidden="true" className="text-ink-muted">
            ✳
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

/** The store's promises as a slow ticker; a plain wrapped list for reduced motion. */
export function TrustBadges({ badges }: { badges: Badge[] }) {
  const reduce = usePrefersReducedMotion();
  return (
    <section aria-label="Why shop with us" className="overflow-hidden border-y border-line py-6">
      {reduce ? (
        <div className="container-page flex flex-wrap justify-center">
          <Run badges={badges} />
        </div>
      ) : (
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
          <Run badges={badges} />
          <Run badges={badges} hidden />
        </div>
      )}
    </section>
  );
}
