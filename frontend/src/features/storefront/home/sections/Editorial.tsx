import { useRef } from 'react';
import { BotanicalBranch } from '@/components/brand/Illustrations';
import { Reveal } from '@/components/motion/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { useGsap } from '../useScrollTrigger';

export function Editorial({ eyebrow, title, body, image, cta }: { eyebrow: string; title: string; body: string; image: string | null; cta?: { label: string; url: string } }) {
  const ref = useRef<HTMLElement>(null);
  useGsap(ref, ({ gsap }) => {
    gsap.fromTo('[data-editorial-img]', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: ref.current, scrub: true } });
  });
  return (
    <section ref={ref} className="container-page relative grid items-center gap-10 overflow-x-clip py-16 md:grid-cols-2 lg:gap-20 lg:py-24">
      <div className="relative h-[26rem] overflow-hidden rounded-sm md:h-[36rem]">
        {image ? <img data-editorial-img src={image} alt="" loading="lazy" className="absolute inset-[-10%_0] h-[120%] w-full object-cover" /> : null}
      </div>
      <Reveal className="relative">
        <BotanicalBranch className="absolute -right-6 -top-16 h-28 w-48 opacity-70" />
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 text-display-xl">{title}</h2>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">{body}</p>
        {cta?.label ? (
          <ButtonLink to={cta.url} variant="secondary" className="mt-8">
            {cta.label}
          </ButtonLink>
        ) : null}
      </Reveal>
    </section>
  );
}
