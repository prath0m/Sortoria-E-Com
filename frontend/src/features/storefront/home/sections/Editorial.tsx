import { useRef } from 'react';
import { Reveal } from '@/components/motion/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { useGsap } from '../useScrollTrigger';
import { toSrcSet } from '@/lib/srcset';

export function Editorial({ eyebrow, title, body, image, renditions, cta }: { eyebrow: string; title: string; body: string; image: string | null; renditions?: Record<string, string>; cta?: { label: string; url: string } }) {
  const ref = useRef<HTMLElement>(null);
  useGsap(ref, ({ gsap }) => {
    gsap.fromTo('[data-editorial-img]', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: ref.current, scrub: true } });
  });
  return (
    <section ref={ref} className="container-page relative grid items-center gap-10 overflow-x-clip py-16 md:grid-cols-2 lg:gap-20 lg:py-24">
      <div className="relative h-[28rem] overflow-hidden rounded-md md:h-[42rem]">
        {image ? <img data-editorial-img src={image} srcSet={toSrcSet(renditions)} sizes="(min-width: 1024px) 50vw, 100vw" alt="" loading="lazy" className="absolute inset-[-10%_0] h-[120%] w-full object-cover" /> : null}
      </div>
      <Reveal className="relative">
        <p className="text-sm text-ink-muted">{eyebrow}</p>
        <h2 className="mt-4 text-[clamp(2.25rem,1.3rem+3.6vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.05em]">{title}</h2>
        <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink-soft">{body}</p>
        {cta?.label ? (
          <ButtonLink to={cta.url} variant="primary" size="lg" className="mt-10">
            {cta.label}
          </ButtonLink>
        ) : null}
      </Reveal>
    </section>
  );
}
