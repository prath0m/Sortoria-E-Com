import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HeroSlide } from '@/api/types';
import { buttonClasses } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { gsap } from '../useScrollTrigger';
import { toSrcSet } from '@/lib/srcset';

const INTERVAL = 7000;

function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <span data-word className="inline-block will-change-transform">
            {word}
            {' '}
          </span>
        </span>
      ))}
    </>
  );
}

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const reduce = usePrefersReducedMotion();
  const textRef = useRef<HTMLDivElement>(null);
  const count = slides.length;
  const slide = slides[index];
  const running = count > 1 && !paused && !hovering && !reduce;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go(index + 1), INTERVAL);
    return () => window.clearTimeout(t);
  }, [running, index, go]);

  useEffect(() => {
    const onVisibility = () => setHovering(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // GSAP text reveal: headline words rise from behind their masks, supporting copy follows.
  useEffect(() => {
    const node = textRef.current;
    if (!node || reduce) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.from('[data-eyebrow]', { y: 16, autoAlpha: 0, duration: 0.8 })
        .from('[data-word]', { yPercent: 115, duration: 1.1, stagger: 0.07 }, '-=0.5')
        .from('[data-sub]', { y: 18, autoAlpha: 0, duration: 0.9 }, '-=0.7')
        .from('[data-cta]', { y: 14, autoAlpha: 0, duration: 0.8, stagger: 0.08 }, '-=0.6');
    }, node);
    return () => ctx.revert();
  }, [index, reduce]);

  if (!slide) return null;
  const light = slide.text_theme === 'light';

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      className="grain relative isolate h-[78svh] min-h-[32rem] overflow-hidden bg-ink md:h-[88vh] md:max-h-[56rem]"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHovering(false);
      }}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={slide.id}
          className="absolute inset-0 -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 1.2, ease: [0.65, 0, 0.35, 1] }}
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${count}`}
        >
          <motion.picture
            className="block h-full w-full"
            initial={{ scale: reduce ? 1 : 1.12 }}
            animate={{ scale: 1 }}
            transition={{ duration: reduce ? 0 : 9, ease: 'linear' }}
          >
            {slide.mobile_image ? (
              <source media="(max-width: 767px)" srcSet={toSrcSet(slide.renditions?.mobile_image) ?? slide.mobile_image} sizes="100vw" />
            ) : null}
            <img
              src={slide.image}
              srcSet={toSrcSet(slide.renditions?.image)}
              sizes="100vw"
              alt={slide.image_alt}
              className="h-full w-full object-cover"
              {...{ fetchpriority: index === 0 ? 'high' : 'auto' }}
            />
          </motion.picture>
          <div
            className={cn(
              'absolute inset-0',
              // Mobile text spans the width, so the scrim runs bottom-up there and left-right on larger screens.
              light
                ? 'bg-gradient-to-t from-ink/85 via-ink/50 to-ink/20 md:bg-gradient-to-r md:from-ink/75 md:via-ink/35 md:to-transparent'
                : 'bg-gradient-to-t from-cream-50/95 via-cream-50/75 to-cream-50/30 md:bg-gradient-to-r md:from-cream-50/90 md:via-cream-50/50 md:to-transparent',
            )}
          />
        </motion.div>
      </AnimatePresence>

      <div className="container-page relative z-[2] flex h-full items-center">
        <div
          key={slide.id}
          ref={textRef}
          className={cn(
            'max-w-2xl',
            slide.text_align === 'center' && 'mx-auto text-center',
            slide.text_align === 'right' && 'ml-auto text-right',
          )}
          aria-live={running ? 'off' : 'polite'}
        >
          {slide.eyebrow ? (
            <p data-eyebrow className={cn('eyebrow', light ? 'text-gold-200' : 'text-burgundy-700')}>
              {slide.eyebrow}
            </p>
          ) : null}
          <h1 className={cn('mt-4 text-display-2xl', light ? 'text-cream-50' : 'text-burgundy-900')}>
            <Words text={slide.headline} />
          </h1>
          {slide.subtext ? (
            <p data-sub className={cn('mt-6 max-w-xl text-lg', light ? 'text-cream-100' : 'text-ink-soft')}>
              {slide.subtext}
            </p>
          ) : null}
          <div className={cn('mt-10 flex flex-wrap gap-3', slide.text_align === 'center' && 'justify-center')}>
            {slide.cta_label ? (
              <Link data-cta to={slide.cta_url} className={buttonClasses({ size: 'lg', variant: light ? 'gold' : 'primary' })}>
                {slide.cta_label}
              </Link>
            ) : null}
            {slide.secondary_cta_label ? (
              <Link
                data-cta
                to={slide.secondary_cta_url}
                className={cn(
                  buttonClasses({ size: 'lg', variant: 'secondary' }),
                  light && 'border-cream-100 text-cream-50 hover:bg-cream-50 hover:text-burgundy-900',
                )}
              >
                {slide.secondary_cta_label}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {count > 1 ? (
        <div className="container-page absolute inset-x-0 bottom-6 z-[3] flex items-center gap-4 md:bottom-10">
          <div className="flex flex-1 gap-2" role="group" aria-label="Choose slide">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show slide ${i + 1}: ${s.headline}`}
                aria-current={i === index}
                className="group relative h-8 flex-1 max-w-24"
              >
                <span className={cn('absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 overflow-hidden rounded-full', light ? 'bg-cream-50/30' : 'bg-ink/20')}>
                  {i === index ? (
                    <motion.span
                      key={`${index}-${running}`}
                      className="block h-full origin-left bg-gold-300"
                      initial={{ scaleX: running ? 0 : 1 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: running ? INTERVAL / 1000 : 0, ease: 'linear' }}
                    />
                  ) : (
                    <span className={cn('block h-full transition-transform', light ? 'bg-cream-50/70' : 'bg-ink/50', i < index ? 'scale-x-100' : 'scale-x-0')} />
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className={cn('flex gap-1', light ? 'text-cream-50' : 'text-ink')}>
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play slideshow' : 'Pause slideshow'} className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full', light ? 'hover:bg-cream-50/10' : 'hover:bg-ink/5')}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full border', light ? 'border-cream-50/30 hover:bg-cream-50/10' : 'border-ink/25 hover:bg-ink/5')}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full border', light ? 'border-cream-50/30 hover:bg-cream-50/10' : 'border-ink/25 hover:bg-ink/5')}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
